import { requireAdmin } from '../../_lib/auth.js';
import { assertServerEnv, supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { badRequest, forbidden, methodNotAllowed, sendJson, serverError, unauthorized } from '../../_lib/http.js';
import { canAssignRole, canCreateUsers, isAdminRole, MANAGEABLE_ROLES } from '../../_lib/permissions.js';
import { computeTargetSiteIds, getAllowedSiteIdsForUser, syncProfileSites } from '../../_lib/siteAccess.js';

const ALLOWED_ROLES = new Set(MANAGEABLE_ROLES);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    assertServerEnv();

    const auth = await requireAdmin(req);
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(res, auth.error);
      return forbidden(res, auth.error);
    }

    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const tempPassword = String(req.body?.tempPassword ?? '');
    const role = String(req.body?.role ?? 'commande');
    const fullNameRaw = req.body?.fullName;
    const fullName = typeof fullNameRaw === 'string' ? fullNameRaw.trim() : null;
    const requestedSiteIds = Array.isArray(req.body?.siteIds) ? req.body.siteIds : [];
    const activeSiteId = String(req.body?.activeSiteId ?? '').trim();

    if (!email) return badRequest(res, 'Email requis.');
    if (!tempPassword || tempPassword.length < 8) {
      return badRequest(res, 'Mot de passe temporaire requis (minimum 8 caractères).');
    }
    if (!canCreateUsers(auth.profile.role)) {
      return forbidden(res, 'Votre rôle peut uniquement consulter ou créer selon ses droits.');
    }
    if (!ALLOWED_ROLES.has(role)) {
      return badRequest(res, 'Rôle invalide. Valeurs autorisées: global_admin, director, manager_plus, manager, commande.');
    }
    if (!canAssignRole(auth.profile.role, role)) {
      return forbidden(res, 'Vous ne pouvez pas attribuer ce rôle.');
    }

    const targetSiteIds = await computeTargetSiteIds({
      actor: auth.profile,
      targetRole: role,
      requestedSiteIds,
      activeSiteId,
    });

    const { data: existingUsersData, error: existingUsersError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (existingUsersError) {
      return serverError(res, `Impossible de vérifier les emails existants: ${existingUsersError.message}`);
    }

    const existingAuthUser = (existingUsersData?.users ?? []).find((entry) => String(entry.email ?? '').trim().toLowerCase() === email);

    if (existingAuthUser) {
      if (!isAdminRole(auth.profile.role)) {
        return sendJson(res, 409, { ok: false, error: 'Cet email existe déjà. Seuls les super_admin et global_admin peuvent étendre ses accès sites.' });
      }

      const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, role, is_active, access_scope, protected_user, created_at, updated_at, default_site_id')
        .eq('id', existingAuthUser.id)
        .maybeSingle();

      if (existingProfileError || !existingProfile) {
        return serverError(res, `Impossible de relire le profil existant: ${existingProfileError?.message || 'profil introuvable'}`);
      }

      const mergedSiteIds = Array.from(new Set([
        ...(await getAllowedSiteIdsForUser(existingProfile.id, existingProfile.role)),
        ...targetSiteIds,
      ]));

      await syncProfileSites({
        userId: existingProfile.id,
        role: existingProfile.role,
        siteIds: existingProfile.role === 'super_admin' || existingProfile.role === 'global_admin'
          ? await getAllowedSiteIdsForUser(auth.profile.id, auth.profile.role)
          : mergedSiteIds,
      });

      const { data: refreshedProfile, error: refreshedError } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, role, is_active, access_scope, protected_user, created_at, updated_at, default_site_id')
        .eq('id', existingProfile.id)
        .single();

      if (refreshedError || !refreshedProfile) {
        return serverError(res, `Extension d'accès effectuée mais relecture impossible: ${refreshedError?.message || 'profil non relu'}`);
      }

      return sendJson(res, 200, {
        ok: true,
        message: 'Utilisateur existant détecté : accès sites étendus avec succès.',
        user: refreshedProfile,
      });
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName ?? undefined,
        role,
      },
      app_metadata: {
        role,
      },
    });

    if (createError) {
      const lowered = createError.message.toLowerCase();
      if (lowered.includes('already') || lowered.includes('exists') || lowered.includes('registered')) {
        return sendJson(res, 409, { ok: false, error: 'Un utilisateur avec cet email existe déjà.' });
      }
      return serverError(res, `Création utilisateur impossible: ${createError.message}`);
    }

    const user = created.user;
    if (!user) return serverError(res, 'Utilisateur créé mais réponse incomplète (user manquant).');

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email,
          full_name: fullName,
          role,
          is_active: true,
          access_scope: role === 'super_admin' || role === 'global_admin' ? 'all' : 'current_site',
          protected_user: false,
          default_site_id: targetSiteIds[0] ?? null,
        },
        { onConflict: 'id' }
      )
      .select('id, email, full_name, role, is_active, access_scope, protected_user, created_at, updated_at, default_site_id')
      .single();

    if (profileErr || !profile) {
      return serverError(res, `Utilisateur Auth créé mais synchronisation profil échouée: ${profileErr?.message || 'profil non relu'}`);
    }

    await syncProfileSites({ userId: user.id, role, siteIds: targetSiteIds });

    const { data: finalProfile, error: finalProfileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, is_active, access_scope, protected_user, created_at, updated_at, default_site_id')
      .eq('id', user.id)
      .single();

    if (finalProfileErr || !finalProfile) {
      return serverError(res, `Utilisateur créé mais relecture finale impossible: ${finalProfileErr?.message || 'profil non relu'}`);
    }

    return sendJson(res, 201, {
      ok: true,
      message: 'Utilisateur créé avec succès.',
      user: finalProfile,
    });
  } catch (error: any) {
    return serverError(res, error?.message || 'Erreur inattendue lors de la création utilisateur.');
  }
}
