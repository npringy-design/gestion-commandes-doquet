import { requireAdmin } from '../../_lib/auth.js';
import { assertServerEnv, supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { badRequest, forbidden, methodNotAllowed, sendJson, serverError, unauthorized } from '../../_lib/http.js';
import { canDeleteUsers, canManageTarget } from '../../_lib/permissions.js';
import { ensureProfileExists } from '../../_lib/profileProvisioning.js';
import { loadSiteIdsByUser, siteIdsForProfile } from '../../_lib/sites.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'DELETE') return methodNotAllowed(res, ['DELETE']);

  try {
    assertServerEnv();

    const auth = await requireAdmin(req);
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(res, auth.error);
      return forbidden(res, auth.error);
    }

    if (!canDeleteUsers(auth.profile.role)) {
      return forbidden(res, 'Votre rôle ne peut pas supprimer les utilisateurs.');
    }

    const id = String(req.body?.id ?? req.query?.id ?? '').trim();
    if (!id) return badRequest(res, 'Identifiant utilisateur (id) requis.');

    let target: any;
    try {
      target = await ensureProfileExists(id);
    } catch (error: any) {
      return sendJson(res, 404, { ok: false, error: error?.message || 'Profil utilisateur introuvable.' });
    }
    const siteIdsByUser = await loadSiteIdsByUser(supabaseAdmin, [id]);
    target = {
      ...target,
      site_ids: siteIdsForProfile(target, siteIdsByUser.get(id) ?? []),
    };

    const permission = canManageTarget(auth.profile, target);
    if (!permission.ok) {
      return forbidden(res, permission.error);
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
