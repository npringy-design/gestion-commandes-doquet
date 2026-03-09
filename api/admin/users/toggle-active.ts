import { requireAdmin } from '../../_lib/auth.js';
import { assertServerEnv, supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { badRequest, forbidden, methodNotAllowed, sendJson, serverError, unauthorized } from '../../_lib/http.js';
import { canManageTarget } from '../../_lib/permissions.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'PATCH') return methodNotAllowed(res, ['PATCH']);

  try {
    assertServerEnv();

    const auth = await requireAdmin(req);
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(res, auth.error);
      return forbidden(res, auth.error);
    }

    const id = String(req.body?.id ?? '').trim();
    if (!id) return badRequest(res, 'Identifiant utilisateur (id) requis.');

    const { data: existing, error: existingErr } = await supabaseAdmin
      .from('profiles')
      .select('id, role, is_active, protected_user')
      .eq('id', id)
      .single();

    if (existingErr || !existing) {
      return sendJson(res, 404, { ok: false, error: 'Profil utilisateur introuvable.' });
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
