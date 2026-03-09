import { requireAdmin } from '../../_lib/auth.js';
import { assertServerEnv, supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { badRequest, forbidden, methodNotAllowed, sendJson, serverError, unauthorized } from '../../_lib/http.js';
import { canManageTarget, canToggleUsers } from '../../_lib/permissions.js';
import { ensureProfileExists } from '../../_lib/profileProvisioning.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'PATCH') return methodNotAllowed(res, ['PATCH']);

  try {
    assertServerEnv();

    const auth = await requireAdmin(req);
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(res, auth.error);
      return forbidden(res, auth.error);
    }

    if (!canToggleUsers(auth.profile.role)) {
      return forbidden(res, 'Votre rôle ne peut pas activer ou désactiver les utilisateurs.');
    }

    const id = String(req.body?.id ?? '').trim();
    if (!id) return badRequest(res, 'Identifiant utilisateur (id) requis.');

    let existing: any;
    try {
      existing = await ensureProfileExists(id);
    } catch (error: any) {
      return sendJson(res, 404, { ok: false, error: error?.message || 'Profil utilisateur introuvable.' });
    }

    const permission = canManageTarget(auth.profile, existing);
    if (!permission.ok) {
      return forbidden(res, permission.error);
    }

    const nextActive = !existing.is_active;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: nextActive })
      .eq('id', id)
      .select('id, email, full_name, role, is_active, access_scope, protected_user, created_at, updated_at')
      .single();

    if (error) {
      return serverError(res, `Impossible de changer le statut actif: ${error.message}`);
    }

    return sendJson(res, 200, {
      ok: true,
      message: nextActive ? 'Utilisateur réactivé.' : 'Utilisateur désactivé.',
      user: data,
    });
  } catch (error: any) {
    return serverError(res, error?.message || 'Erreur inattendue lors du changement de statut.');
  }
}
