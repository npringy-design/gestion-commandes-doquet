import { requireAdmin } from '../../_lib/auth.js';
import { assertServerEnv, supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { badRequest, forbidden, methodNotAllowed, sendJson, serverError, unauthorized } from '../../_lib/http.js';
import { canAssignRole, canManageTarget, canUpdateUsers, MANAGEABLE_ROLES } from '../../_lib/permissions.js';
import { ensureProfileExists } from '../../_lib/profileProvisioning.js';
import {
  canUseSiteIds,
  isGlobalSiteRole,
  loadSiteIdsByUser,
  normalizeSiteIds,
  replaceUserSiteAccess,
  siteIdsForProfile,
  siteIdsForRole,
} from '../../_lib/sites.js';

type ManageableRole = (typeof MANAGEABLE_ROLES)[number];

const isManageableRole = (role: unknown): role is ManageableRole =>
  typeof role === 'string' && (MANAGEABLE_ROLES as readonly string[]).includes(role);

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
      return forbidden(res, 'Votre role ne peut pas modifier les utilisateurs.');
    }

    const id = String(req.body?.id ?? '').trim();
    const role = req.body?.role;
    const isActive = req.body?.is_active;
    const fullName = req.body?.full_name;
    const hasSiteIdsPatch = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'siteIds');

    if (!id) return badRequest(res, 'Identifiant utilisateur (id) requis.');

    let target: any;
    try {
      target = await ensureProfileExists(id);
    } catch (error: any) {
      return sendJson(res, 404, { ok: false, error: error?.message || 'Profil utilisateur introuvable.' });
    }
    const targetSiteIdsByUser = await loadSiteIdsByUser(supabaseAdmin, [id]);
    target = {
      ...target,
      site_ids: siteIdsForProfile(target, targetSiteIdsByUser.get(id) ?? []),
    };

    const permission = canManageTarget(auth.profile, target);
    if (!permission.ok) {
      return forbidden(res, permission.error);
    }

    const patch: Record<string, unknown> = {};
    const targetRole = String(target.role);
    const requestedRole = role === undefined ? targetRole : String(role);

    if (role !== undefined) {
      if (!isManageableRole(requestedRole)) {
        return badRequest(res, 'Role invalide. Valeurs autorisees: global_admin, director, manager_plus, manager, commande.');
      }
      if (!canAssignRole(auth.profile.role, requestedRole)) {
        return forbidden(res, 'Vous ne pouvez pas attribuer ce role.');
      }
      patch.role = requestedRole;
      patch.access_scope = isGlobalSiteRole(requestedRole) ? 'all' : 'current_site';
    }

    const nextRole = requestedRole;
    const requestedSiteIds = hasSiteIdsPatch ? req.body?.siteIds : target.site_ids;
    const nextSiteIds = isGlobalSiteRole(nextRole)
      ? siteIdsForRole(nextRole, requestedSiteIds)
      : normalizeSiteIds(requestedSiteIds);
    if ((hasSiteIdsPatch || role !== undefined) && !isGlobalSiteRole(nextRole) && nextSiteIds.length === 0) {
      return badRequest(res, 'Choisis au moins un site pour cet utilisateur.');
    }
    if ((hasSiteIdsPatch || role !== undefined) && !isGlobalSiteRole(nextRole) && !canUseSiteIds(auth.profile, nextSiteIds)) {
      return forbidden(res, 'Vous ne pouvez attribuer que vos propres sites.');
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return badRequest(res, 'is_active doit etre un booleen.');
      }
      patch.is_active = isActive;
    }

    if (fullName !== undefined) {
      if (fullName !== null && typeof fullName !== 'string') {
        return badRequest(res, 'full_name doit etre une string ou null.');
      }
      patch.full_name = fullName === null ? null : fullName.trim();
    }

    if (Object.keys(patch).length === 0 && !hasSiteIdsPatch) {
      return badRequest(res, 'Aucune propriete a mettre a jour (role, is_active, full_name, siteIds).');
    }

    if (Object.keys(patch).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          ...patch,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) {
        return serverError(res, `Mise a jour impossible: ${updateError.message}`);
      }
    }

    const siteAccess = (hasSiteIdsPatch || role !== undefined)
      ? await replaceUserSiteAccess(supabaseAdmin, id, nextRole, nextSiteIds)
      : { siteIds: target.site_ids ?? [], accessScope: target.access_scope };

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, is_active, access_scope, protected_user, created_at, updated_at')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return serverError(res, `Relecture du profil impossible apres mise a jour: ${error.message}`);
    }

    return sendJson(res, 200, {
      ok: true,
      message: 'Profil mis a jour avec succes.',
      user: { ...(data ?? { id, ...target, ...patch }), site_ids: siteAccess.siteIds },
    });
  } catch (error: any) {
    return serverError(res, error?.message || 'Erreur inattendue lors de la mise a jour.');
  }
}