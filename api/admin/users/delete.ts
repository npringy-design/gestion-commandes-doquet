import { requireAdmin } from '../../_lib/auth.js';
import { assertServerEnv, supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { badRequest, forbidden, methodNotAllowed, sendJson, serverError, unauthorized } from '../../_lib/http.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'DELETE') return methodNotAllowed(res, ['DELETE']);

  try {
    assertServerEnv();

    const auth = await requireAdmin(req);
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(res, auth.error);
      return forbidden(res, auth.error);
    }

    const id = String(req.body?.id ?? req.query?.id ?? '').trim();
    if (!id) return badRequest(res, 'Identifiant utilisateur (id) requis.');

    if (id === auth.user.id) {
      return badRequest(res, 'Un admin ne peut pas supprimer son propre compte via cet endpoint.');
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id, false);
    if (error) {
      return serverError(res, `Suppression utilisateur impossible: ${error.message}`);
    }

    return sendJson(res, 200, {
      ok: true,
      message: 'Utilisateur supprimé définitivement.',
      id,
    });
  } catch (error: any) {
    return serverError(res, error?.message || 'Erreur inattendue lors de la suppression utilisateur.');
  }
}
