import { supabaseAdmin } from './supabaseAdmin.js';
import { isGlobalSiteRole } from './sites.js';

const normalizeRole = (value: unknown): string => {
  const role = typeof value === 'string' ? value : 'commande';
  return ['super_admin', 'global_admin', 'director', 'manager_plus', 'manager', 'commande'].includes(role)
    ? role
    : 'commande';
};

const scopeFromRole = (role: string): 'all' | 'current_site' =>
  isGlobalSiteRole(role) ? 'all' : 'current_site';

export const ensureProfileExists = async (userId: string) => {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, role, is_active, access_scope, protected_user, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Impossible de lire le profil: ${existingError.message}`);
  }

  if (existing) {
    return existing;
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (authError || !authData?.user) {
    throw new Error(authError?.message || 'Utilisateur Auth introuvable.');
  }

  const authUser = authData.user;
  const fullName =
    typeof authUser.user_metadata?.full_name === 'string'
      ? authUser.user_metadata.full_name.trim()
      : typeof authUser.user_metadata?.name === 'string'
        ? authUser.user_metadata.name.trim()
        : null;
  const role = normalizeRole(authUser.app_metadata?.role ?? authUser.user_metadata?.role);

  const payload = {
    id: authUser.id,
    email: authUser.email ?? null,
    full_name: fullName,
    role,
    is_active: true,
    access_scope: scopeFromRole(role),
    protected_user: false,
  };

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('id, email, full_name, role, is_active, access_scope, protected_user, created_at, updated_at')
    .single();

  if (insertError) {
    throw new Error(`Impossible de créer le profil manquant: ${insertError.message}`);
  }

  return inserted;
};

export const ensureProfilesExist = async (userIds: string[]) => {
  if (userIds.length === 0) return new Map<string, any>();

  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const { data: profiles, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, role, is_active, access_scope, protected_user, created_at, updated_at')
    .in('id', uniqueIds);

  if (profileError) {
    throw new Error(`Impossible de lire les profils: ${profileError.message}`);
  }

  const map = new Map<string, any>((profiles ?? []).map((profile) => [profile.id, profile]));
  const missingIds = uniqueIds.filter((id) => !map.has(id));

  for (const missingId of missingIds) {
    const created = await ensureProfileExists(missingId);
    map.set(created.id, created);
  }

  return map;
};
