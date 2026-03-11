import { assertServerEnv, supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { forbidden, methodNotAllowed, sendJson, serverError, unauthorized } from '../../_lib/http.js';
import { requireAdmin } from '../../_lib/auth.js';
import { ensureProfilesExist } from '../../_lib/profileProvisioning.js';
import { getAllSites, getAllowedSiteIdsForUser, validateActorActiveSite } from '../../_lib/siteAccess.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  try {
    assertServerEnv();

    const auth = await requireAdmin(req);
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(res, auth.error);
      return forbidden(res, auth.error);
    }

    const page = Math.max(Number(req.query?.page ?? 1) || 1, 1);
    const perPage = Math.min(Math.max(Number(req.query?.perPage ?? 50) || 50, 1), 200);
    const activeSiteId = String(req.query?.activeSiteId ?? '').trim();

    let validatedActiveSiteId = activeSiteId;
    if (activeSiteId) {
      validatedActiveSiteId = await validateActorActiveSite(auth.profile, activeSiteId);
    }

    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return serverError(res, `Impossible de lister les utilisateurs: ${error.message}`);

    const ids = (data?.users ?? []).map((u) => u.id);
    const profilesMap = await ensureProfilesExist(ids);
    const allSites = await getAllSites();
    const allSiteIds = allSites.map((site) => site.id);
    const allSiteNameMap = new Map(allSites.map((site) => [site.id, site.name]));

    const actorAllowedSiteIds = await getAllowedSiteIdsForUser(auth.profile.id, auth.profile.role);
    const actorSiteScope = new Set(actorAllowedSiteIds);

    const hydratedUsers = await Promise.all((data?.users ?? []).map(async (u) => {
      const p = profilesMap.get(u.id);
      const role = p?.role ?? 'commande';
      const siteIds = role === 'super_admin' || role === 'global_admin'
        ? allSiteIds
        : await getAllowedSiteIdsForUser(u.id, role);
      const siteNames = siteIds.map((siteId) => allSiteNameMap.get(siteId)).filter(Boolean);

      return {
        id: u.id,
        email: p?.email ?? u.email ?? null,
        full_name: p?.full_name ?? u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
        role,
        is_active: p?.is_active ?? true,
        access_scope: p?.access_scope ?? 'current_site',
        protected_user: p?.protected_user ?? false,
        created_at: p?.created_at ?? u.created_at,
        updated_at: p?.updated_at ?? u.updated_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        default_site_id: p?.default_site_id ?? null,
        site_ids: siteIds,
        site_names: role === 'super_admin' || role === 'global_admin' ? ['Tous les sites'] : siteNames,
      };
    }));

    const canViewUser = (target: any) => {
      if (target.id === auth.profile.id) return true;
      if (target.role === 'super_admin') return auth.profile.role === 'super_admin';
      if (target.role === 'global_admin') return auth.profile.role === 'super_admin';
      if (auth.profile.role === 'super_admin') return true;
      if (auth.profile.role === 'global_admin') return ['director', 'manager_plus', 'manager', 'commande'].includes(target.role);
      if (auth.profile.role === 'director') return ['manager_plus', 'manager', 'commande'].includes(target.role);
      if (auth.profile.role === 'manager_plus') return ['manager', 'commande'].includes(target.role);
      if (auth.profile.role === 'manager') return target.role === 'commande';
      return false;
    };

    const filteredUsers = hydratedUsers
      .filter((u) => canViewUser(u))
      .filter((u) => {
        if (validatedActiveSiteId) {
          return u.access_scope === 'all' || u.site_ids.includes(validatedActiveSiteId);
        }
        if (auth.profile.role === 'super_admin' || auth.profile.role === 'global_admin') {
          return true;
        }
        return u.site_ids.some((siteId: string) => actorSiteScope.has(siteId));
      });

    const users = filteredUsers.slice((page - 1) * perPage, page * perPage);

    return sendJson(res, 200, {
      ok: true,
      page,
      perPage,
      total: filteredUsers.length,
      users,
    });
  } catch (error: any) {
    return serverError(res, error?.message || 'Erreur inattendue lors de la liste utilisateurs.');
  }
}
