import { requireAdmin } from '../../_lib/auth.js';
import { assertServerEnv, supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { badRequest, forbidden, methodNotAllowed, sendJson, serverError, unauthorized } from '../../_lib/http.js';
import { canAssignRole, canCreateUsers, MANAGEABLE_ROLES } from '../../_lib/permissions.js';
import { canUseSiteIds, isGlobalSiteRole, normalizeSiteIds, replaceUserSiteAccess, siteIdsForRole } from '../../_lib/sites.js';

const ALLOWED_ROLES = new Set(MANAGEABLE_ROLES);
const INVITE_REDIRECT_URL = 'https://gestion-commandes-doquet.vercel.app';

const isMailLimitError = (message: string) => {
  const lowered = message.toLowerCase();
  return lowered.includes('rate') || lowered.includes('limit') || lowered.includes('too many');
};

const findAuthUserByEmail = async (email: string) => {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((item) => item.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 1000) return null;
  }
  return null;
};

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
      return badRequest(res, 'Mot de passe temporaire requis (minimum 8 caracteres).');
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

    let emailSent = true;
    let emailWarning: string | null = null;
    let created: any = null;

    const { data: invited, error: createError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: INVITE_REDIRECT_URL,
      data: {
        full_name: fullName ?? undefined,
        role,
        must_change_password: true,
      },
    });

    if (createError) {
      const lowered = createError.message.toLowerCase();
      if (lowered.includes('already') || lowered.includes('exists') || lowered.includes('registered')) {
        return sendJson(res, 409, { ok: false, error: 'Un utilisateur avec cet email existe déjà.' });
      }
      if (!isMailLimitError(createError.message)) {
        return serverError(res, `Invitation Supabase impossible: ${createError.message}`);
      }

      const { data: fallbackCreated, error: fallbackError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName ?? undefined,
          role,
          must_change_password: true,
        },
        app_metadata: {
          role,
        },
      });

      if (fallbackError) {
        const fallbackLowered = fallbackError.message.toLowerCase();
        if (fallbackLowered.includes('already') || fallbackLowered.includes('exists') || fallbackLowered.includes('registered')) {
          const existingAuthUser = await findAuthUserByEmail(email);
          if (!existingAuthUser) {
            return sendJson(res, 409, { ok: false, error: 'Un utilisateur avec cet email existe deja.' });
          }

          const { data: updatedAuthUser, error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              ...(existingAuthUser.user_metadata ?? {}),
              full_name: fullName ?? undefined,
              role,
              must_change_password: true,
            },
            app_metadata: {
              ...(existingAuthUser.app_metadata ?? {}),
              role,
            },
          });

          if (updateAuthError) {
            return serverError(res, `Compte existant mais mot de passe temporaire impossible: ${updateAuthError.message}`);
          }

          created = { user: updatedAuthUser.user };
          emailSent = false;
          emailWarning = 'Limite d envoi Supabase atteinte. Compte existant active avec mot de passe temporaire.';
        } else {
          return serverError(res, `Invitation bloquee par Supabase et creation temporaire impossible: ${fallbackError.message}`);
        }
      } else {
        created = fallbackCreated;
        emailSent = false;
        emailWarning = 'Limite d envoi Supabase atteinte. Compte cree sans email: donnez le mot de passe temporaire a l utilisateur.';
      }
    } else {
      created = invited;
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
      email_sent: emailSent,
      email_warning: emailWarning,
      message: emailSent ? 'Invitation envoyee avec succes.' : 'Compte cree avec mot de passe temporaire.',
      user: { ...profile, site_ids: siteAccess.siteIds },
    });
  } catch (error: any) {
    return serverError(res, error?.message || 'Erreur inattendue lors de la création utilisateur.');
  }
}
