import { requireAdmin } from '../../_lib/auth.js';
import { assertServerEnv, supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { badRequest, forbidden, methodNotAllowed, sendJson, serverError, unauthorized } from '../../_lib/http.js';
import { canAssignRole, canCreateUsers, MANAGEABLE_ROLES } from '../../_lib/permissions.js';
import { canUseSiteIds, isGlobalSiteRole, normalizeSiteIds, replaceUserSiteAccess, siteIdsForRole } from '../../_lib/sites.js';

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
    const siteIds = isGlobalSiteRole(role) ? siteIdsForRole(role, req.body?.siteIds) : normalizeSiteIds(req.body?.siteIds);
    const fullNameRaw = req.body?.fullName;
    const fullName = typeof fullNameRaw === 'string' ? fullNameRaw.trim() : null;

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

    if (!isGlobalSiteRole(role) && siteIds.length === 0) {
      return badRequest(res, 'Choisis au moins un site pour cet utilisateur.');
    }
    if (!isGlobalSiteRole(role) && !canUseSiteIds(auth.profile, siteIds)) {
      return forbidden(res, 'Vous ne pouvez attribuer que vos propres sites.');
    }

    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingProfileError) {
      return serverError(res, `Verification email impossible: ${existingProfileError.message}`);
    }
    if (existingProfile) {
      return sendJson(res, 409, { ok: false, error: 'Un utilisateur avec cet email existe deja.' });
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
          access_scope: isGlobalSiteRole(role) ? 'all' : 'current_site',
          protected_user: false,
        },
        { onConflict: 'id' }
      )
      .select('id, email, full_name, role, is_active, access_scope, protected_user, created_at, updated_at')
      .single();

    if (profileErr || !profile) {
      return serverError(res, `Utilisateur Auth créé mais synchronisation profil échouée: ${profileErr?.message || 'profil non relu'}`);
    }

    const siteAccess = await replaceUserSiteAccess(supabaseAdmin, user.id, role, siteIds);

    return sendJson(res, 201, {
      ok: true,
      message: 'Utilisateur créé avec succès.',
      user: { ...profile, site_ids: siteAccess.siteIds },
    });
  } catch (error: any) {
    return serverError(res, error?.message || 'Erreur inattendue lors de la création utilisateur.');
  }
}
