export const SITE_IDS = ['hippo_thillois', 'hippo_st_thibault'] as const;
export const GLOBAL_SITE_ROLES = ['super_admin', 'global_admin'] as const;

const SITE_ID_SET = new Set<string>(SITE_IDS);
const GLOBAL_SITE_ROLE_SET = new Set<string>(GLOBAL_SITE_ROLES);

export const isGlobalSiteRole = (role: unknown) =>
  typeof role === 'string' && GLOBAL_SITE_ROLE_SET.has(role);

export const hasAllSiteAccess = (profile: { role?: unknown; access_scope?: unknown } | null | undefined) =>
  Boolean(profile && (isGlobalSiteRole(profile.role) || profile.access_scope === 'all'));

export const normalizeSiteIds = (value: unknown): string[] => {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  return Array.from(new Set(raw.map(String).filter((siteId) => SITE_ID_SET.has(siteId))));
};

export const defaultSiteIdsForRole = (role: unknown) =>
  isGlobalSiteRole(role) ? [...SITE_IDS] : ['hippo_thillois'];

export const siteIdsForRole = (role: unknown, value: unknown) => {
  if (isGlobalSiteRole(role)) return [...SITE_IDS];
  const siteIds = normalizeSiteIds(value);
  return siteIds.length > 0 ? siteIds : defaultSiteIdsForRole(role);
};

export const siteIdsForProfile = (
  profile: { role?: unknown; access_scope?: unknown } | null | undefined,
  storedSiteIds: unknown,
) => {
  if (hasAllSiteAccess(profile)) return [...SITE_IDS];
  const siteIds = normalizeSiteIds(storedSiteIds);
  return siteIds.length > 0 ? siteIds : defaultSiteIdsForRole(profile?.role);
};

export const canUseSiteIds = (
  actor: { role?: unknown; access_scope?: unknown; site_ids?: unknown } | null | undefined,
  targetSiteIds: unknown,
) => {
  if (hasAllSiteAccess(actor)) return true;
  const allowedSiteIds = normalizeSiteIds(actor?.site_ids);
  const requestedSiteIds = normalizeSiteIds(targetSiteIds);
  return requestedSiteIds.length > 0 && requestedSiteIds.every((siteId) => allowedSiteIds.includes(siteId));
};

export const replaceUserSiteAccess = async (
  supabaseAdmin: any,
  userId: string,
  role: unknown,
  value: unknown,
) => {
  const siteIds = siteIdsForRole(role, value);
  const accessScope = isGlobalSiteRole(role) ? 'all' : 'current_site';

  const { error: deleteError } = await supabaseAdmin
    .from('user_site_access')
    .delete()
    .eq('user_id', userId);

  if (deleteError) {
    throw new Error(`Nettoyage accès sites impossible: ${deleteError.message}`);
  }

  if (!isGlobalSiteRole(role)) {
    const rows = siteIds.map((siteId) => ({
      user_id: userId,
      site_id: siteId,
      is_active: true,
    }));

    const { error: insertError } = await supabaseAdmin
      .from('user_site_access')
      .upsert(rows, { onConflict: 'user_id,site_id' });

    if (insertError) {
      throw new Error(`Enregistrement accès sites impossible: ${insertError.message}`);
    }
  }

  return { siteIds, accessScope };
};

export const loadSiteIdsByUser = async (supabaseAdmin: any, userIds: string[]) => {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const map = new Map<string, string[]>();
  uniqueIds.forEach((id) => map.set(id, []));

  if (uniqueIds.length === 0) return map;

  const { data, error } = await supabaseAdmin
    .from('user_site_access')
    .select('user_id, site_id, is_active')
    .in('user_id', uniqueIds);

  if (error) {
    throw new Error(`Lecture accès sites impossible: ${error.message}`);
  }

  (data ?? []).forEach((row: any) => {
    if (!row?.is_active || !SITE_ID_SET.has(row.site_id)) return;
    const current = map.get(row.user_id) ?? [];
    current.push(row.site_id);
    map.set(row.user_id, current);
  });

  return map;
};
