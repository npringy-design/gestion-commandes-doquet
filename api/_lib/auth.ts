import { canAccessUserManagement } from './permissions.js';
import { loadSiteIdsByUser, siteIdsForProfile } from './sites.js';
import { supabaseAdmin } from './supabaseAdmin.js';

const readBearerToken = (req: any): string | null => {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (!header || typeof header !== 'string') return null;
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
};

export const requireActiveUser = async (req: any, client = supabaseAdmin) => {
  const token = readBearerToken(req);
  if (!token) {
    return { ok: false as const, status: 401, error: 'Token Bearer manquant.' };
  }

  const { data: userData, error: authError } = await client.auth.getUser(token);
  if (authError || !userData?.user) {
    return { ok: false as const, status: 401, error: 'Session invalide ou expirée.' };
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id, role, is_active, access_scope, protected_user')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile) {
    return { ok: false as const, status: 403, error: 'Profil introuvable pour cet utilisateur.' };
  }

  if (!profile.is_active) {
    return { ok: false as const, status: 403, error: 'Compte utilisateur inactif.' };
  }

  return { ok: true as const, user: userData.user, profile };
};

export const requireAdmin = async (req: any) => {
  const auth = await requireActiveUser(req);
  if (!auth.ok) return auth;

  const { user, profile } = auth;

  if (!canAccessUserManagement(profile.role)) {
    return { ok: false as const, status: 403, error: 'Droits de gestion utilisateurs requis.' };
  }

  const siteIdsByUser = await loadSiteIdsByUser(supabaseAdmin, [profile.id]);
  const siteIds = siteIdsForProfile(profile, siteIdsByUser.get(profile.id) ?? []);

  return { ok: true as const, user, profile: { ...profile, site_ids: siteIds } };
};
