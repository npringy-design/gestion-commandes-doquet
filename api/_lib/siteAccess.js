import { supabaseAdmin } from './supabaseAdmin.js';

export const normalizeSiteIds = (value) => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((v) => String(v || '').trim()).filter(Boolean)));
};

export const getAllSites = async () => {
  const { data, error } = await supabaseAdmin.from('sites').select('id, code, name').order('name', { ascending: true });
  if (error) throw new Error(`Impossible de lire les sites: ${error.message}`);
  return data ?? [];
};

export const getAllSiteIds = async () => (await getAllSites()).map((site) => site.id);

export const getAllowedSiteIdsForUser = async (userId, role) => {
  if (role === 'super_admin' || role === 'global_admin') {
    return await getAllSiteIds();
  }

  const { data, error } = await supabaseAdmin.from('user_sites').select('site_id').eq('user_id', userId);
  if (error) throw new Error(`Impossible de lire les accès sites: ${error.message}`);
  return Array.from(new Set((data ?? []).map((row) => row.site_id).filter(Boolean)));
};

export const getSiteNamesByIds = async (siteIds) => {
  const ids = normalizeSiteIds(siteIds);
  if (ids.length === 0) return [];
  const { data, error } = await supabaseAdmin.from('sites').select('id, name').in('id', ids);
  if (error) throw new Error(`Impossible de lire les noms des sites: ${error.message}`);
  const map = new Map((data ?? []).map((row) => [row.id, row.name]));
  return ids.map((id) => map.get(id)).filter(Boolean);
};

export const replaceUserSites = async (userId, siteIds) => {
  const ids = normalizeSiteIds(siteIds);
  const { error: delError } = await supabaseAdmin.from('user_sites').delete().eq('user_id', userId);
  if (delError) throw new Error(`Impossible de réinitialiser les accès sites: ${delError.message}`);

  if (ids.length === 0) return;

  const payload = ids.map((siteId) => ({ user_id: userId, site_id: siteId }));
  const { error: insertError } = await supabaseAdmin.from('user_sites').insert(payload);
  if (insertError) throw new Error(`Impossible d'enregistrer les accès sites: ${insertError.message}`);
};

export const validateActorActiveSite = async (actor, activeSiteId) => {
  const normalized = String(activeSiteId || '').trim();
  if (!normalized) throw new Error('Site actif requis.');
  const allowedIds = await getAllowedSiteIdsForUser(actor.id, actor.role);
  if (!allowedIds.includes(normalized)) {
    throw new Error('Le site actif ne fait pas partie de vos accès autorisés.');
  }
  return normalized;
};

export const computeTargetSiteIds = async ({ actor, targetRole, requestedSiteIds, activeSiteId }) => {
  const normalizedRequested = normalizeSiteIds(requestedSiteIds);
  const allSiteIds = await getAllSiteIds();
  const validSiteSet = new Set(allSiteIds);

  if (targetRole === 'super_admin' || targetRole === 'global_admin') {
    return allSiteIds;
  }

  if (actor.role === 'super_admin' || actor.role === 'global_admin') {
    const filtered = normalizedRequested.filter((siteId) => validSiteSet.has(siteId));

    if (targetRole === 'director' || targetRole === 'manager_plus') {
      if (filtered.length === 0) {
        const fallback = String(activeSiteId || '').trim();
        if (fallback && validSiteSet.has(fallback)) return [fallback];
        throw new Error('Sélectionnez au moins un site.');
      }
      return filtered;
    }

    const singleSite = filtered[0] || String(activeSiteId || '').trim();
    if (!singleSite || !validSiteSet.has(singleSite)) {
      throw new Error('Sélectionnez un site valide.');
    }
    return [singleSite];
  }

  const actorSiteId = await validateActorActiveSite(actor, activeSiteId);
  return [actorSiteId];
};

export const syncProfileSites = async ({ userId, role, siteIds }) => {
  const normalizedSiteIds = normalizeSiteIds(siteIds);
  const nextDefaultSiteId = role === 'super_admin' || role === 'global_admin' ? normalizedSiteIds[0] ?? null : normalizedSiteIds[0] ?? null;

  await replaceUserSites(userId, normalizedSiteIds);

  const accessScope = role === 'super_admin' || role === 'global_admin' ? 'all' : 'current_site';
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      access_scope: accessScope,
      default_site_id: nextDefaultSiteId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    throw new Error(`Impossible de synchroniser le profil utilisateur: ${error.message}`);
  }
};
