import { supabaseAdmin } from './supabaseAdmin.js';

const readBearerToken = (req: any): string | null => {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (!header || typeof header !== 'string') return null;
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
};

export const requireAdmin = async (req: any) => {
  const token = readBearerToken(req);
  if (!token) {
    return { ok: false as const, status: 401, error: 'Token Bearer manquant.' };
  }

  const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !userData?.user) {
    return { ok: false as const, status: 401, error: 'Session invalide ou expirée.' };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, role, is_active, access_scope, protected_user')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile) {
    return { ok: false as const, status: 403, error: 'Profil introuvable pour cet utilisateur.' };
  }

  if (!profile.is_active) {
    return { ok: false as const, status: 403, error: 'Compte administrateur inactif.' };
  }

  if (!['super_admin', 'global_admin'].includes(profile.role)) {
    return { ok: false as const, status: 403, error: 'Droits administrateur requis.' };
  }

  return { ok: true as const, user: userData.user, profile };
};
