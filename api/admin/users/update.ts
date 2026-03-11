import { requireAdmin } from '../../_lib/auth.js';
import { assertServerEnv, supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { badRequest, forbidden, methodNotAllowed, sendJson, serverError, unauthorized } from '../../_lib/http.js';
import { canAssignRole, canManageTarget, canUpdateUsers, MANAGEABLE_ROLES } from '../../_lib/permissions.js';
import { computeTargetSiteIds, getAllowedSiteIdsForUser, syncProfileSites } from '../../_lib/siteAccess.js';
import { ensureProfileExists } from '../../_lib/profileProvisioning.js';

const ALLOWED_ROLES = new Set(MANAGEABLE_ROLES);

export default async function handler(req: any, res: any) {
  if (req.method !== 'PATCH') return methodNotAllowed(res, ['PATCH']);

  try {
    assertServerEnv();

    const auth = await requireAdmin(req);
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(res, auth.error);
      return forbidden(res, auth.error);
    }

    if (!canUpdateUsers(auth.profile.role)) {
      return forbidden(res, 'Votre rôle ne peut pas modifier les utilisateurs.');
    }

    const id = String(req.body?.id ?? '').trim();
    const role = req.body?.role;
    const isActive = req.body?.is_active;
    const fullName = req.body?.full_name;
    const requestedSiteIds = Array.isArray(req.body?.siteIds) ? req.body.siteIds : undefined;
    const activeSiteId = String(req.body?.activeSiteId ?? '').trim();

    if (!id) return badRequest(res, 'Identifiant utilisateur (id) requis.');

    let target: any;
    try {
      target = await ensureProfileExists(id);
    } catch (error: any) {
      return sendJson(res, 404, { ok: false, error: error?.message || 'Profil utilisateur introuvable.' });
    }

    const permission = canManageTarget(auth.profile, target);
    if (!permission.ok) {
      return forbidden(res, permission.error);
    }

    const patch: Record<string, unknown> = {};

    let nextRole = target.role;

    if (role !== undefined) {
      nextRole = String(role);
      if (!ALLOWED_ROLES.has(nextRole)) {
        return badRequest(res, 'Rôle invalide. Valeurs autorisées: global_admin, director, manager_plus, manager, commande.');
      }
      if (!canAssignRole(auth.profile.role, nextRole)) {
        return forbidden(res, 'Vous ne pouvez pas attribuer ce rôle.');
      }
      patch.role = nextRole;
      patch.access_scope = nextRole === 'global_admin' ? 'all' : 'current_site';
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return badRequest(res, 'is_active doit être un booléen.');
      }
      patch.is_active = isActive;
    }

    if (fullName !== undefined) {
      if (fullName !== null && typeof fullName !== 'string') {
        return badRequest(res, 'full_name doit être une string ou null.');
      }
      patch.full_name = fullName === null ? null : fullName.trim();
    }

    const shouldSyncSites = requestedSiteIds !== undefined || role !== undefined;
    let nextSiteIds = await getAllowedSiteIdsForUser(target.id, target.role);

    if (shouldSyncSites) {
      nextSiteIds = await computeTargetSiteIds({
        actor: auth.profile,
        targetRole: nextRole,
        requestedSiteIds: requestedSiteIds ?? nextSiteIds,
        activeSiteId,
      });
      patch.default_site_id = nextSiteIds[0] ?? null;
    }

    if (Object.keys(patch).length === 0) {
      return badRequest(res, 'Aucune propriété à mettre à jour (role, is_active, full_name, siteIds).');
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      return serverError(res, `Mise à jour impossible: ${updateError.message}`);
    }

    if (shouldSyncSites) {
      await syncProfileSites({ userId: id, role: nextRole, siteIds: nextSiteIds });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, is_active, access_scope, protected_user, created_at, updated_at, default_site_id')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return serverError(res, `Relecture du profil impossible après mise à jour: ${error.message}`);
    }

    return sendJson(res, 200, {
      ok: true,
      message: 'Profil mis à jour avec succès.',
      user: data ?? { id, ...target, ...patch },
    });
  } catch (error: any) {
    return serverError(res, error?.message || 'Erreur inattendue lors de la mise à jour.');
  }
}
