import { requireAdmin } from '../../_lib/auth.js';
import { assertServerEnv, supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { badRequest, forbidden, methodNotAllowed, sendJson, serverError, unauthorized } from '../../_lib/http.js';
import { MANAGEABLE_ROLES } from '../../_lib/permissions.js';

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
    const role = String(req.body?.role ?? 'viewer');
    const fullNameRaw = req.body?.fullName;
    const fullName = typeof fullNameRaw === 'string' ? fullNameRaw.trim() : null;

    if (!email) return badRequest(res, 'Email requis.');
    if (!tempPassword || tempPassword.length < 8) {
      return badRequest(res, 'Mot de passe temporaire requis (minimum 8 caractères).');
    }
    if (!ALLOWED_ROLES.has(role)) {
      return badRequest(res, 'Rôle invalide. Valeurs autorisées: global_admin, director, chef, manager, viewer.');
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName ?? undefined,
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

    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email,
          full_name: fullName,
          role,
          is_active: true,
          access_scope: role === 'global_admin' ? 'all' : 'current_site',
          protected_user: false,
        },
        { onConflict: 'id' }
      );

    if (profileErr) {
      return serverError(res, `Utilisateur Auth créé mais synchronisation profil échouée: ${profileErr.message}`);
    }

    return sendJson(res, 201, {
      ok: true,
      message: 'Utilisateur créé avec succès.',
      user: {
        id: user.id,
        email,
        full_name: fullName,
        role,
        is_active: true,
      },
    });
  } catch (error: any) {
    return serverError(res, error?.message || 'Erreur inattendue lors de la création utilisateur.');
  }
}
