export const ROLE_RANK: Record<string, number> = {
  viewer: 10,
  manager: 20,
  chef: 30,
  director: 40,
  global_admin: 90,
  super_admin: 100,
};

export const MANAGEABLE_ROLES = ['global_admin', 'director', 'chef', 'manager', 'viewer'] as const;

export const isAdminRole = (role: unknown): role is 'super_admin' | 'global_admin' =>
  role === 'super_admin' || role === 'global_admin';

export const canManageTarget = (
  actor: { id: string; role: string; protected_user?: boolean | null },
  target: { id: string; role: string; protected_user?: boolean | null }
) => {
  if (actor.id === target.id) {
    return { ok: false as const, error: 'Vous ne pouvez pas modifier votre propre compte via cette action.' };
  }

  if (actor.role === 'super_admin') {
    return { ok: true as const };
  }

  if (actor.role !== 'global_admin') {
    return { ok: false as const, error: 'Droits insuffisants.' };
  }

  if (target.protected_user) {
    return { ok: false as const, error: 'Cet utilisateur est protégé et ne peut pas être modifié.' };
  }

  if (ROLE_RANK[target.role] >= ROLE_RANK.global_admin) {
    return { ok: false as const, error: 'Vous ne pouvez pas modifier ce niveau de compte.' };
  }

  return { ok: true as const };
};
