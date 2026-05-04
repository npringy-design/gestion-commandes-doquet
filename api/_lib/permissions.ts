export const ROLE_RANK: Record<string, number> = {
  commande: 10,
  manager: 20,
  manager_plus: 30,
  director: 40,
  global_admin: 90,
  super_admin: 100,
};

export const MANAGEABLE_ROLES = ['global_admin', 'director', 'manager_plus', 'manager', 'commande'] as const;
export const USER_MANAGEMENT_ROLES = ['super_admin', 'global_admin', 'director', 'manager_plus', 'manager'] as const;

export const canAccessUserManagement = (role: unknown) =>
  typeof role === 'string' && USER_MANAGEMENT_ROLES.includes(role as (typeof USER_MANAGEMENT_ROLES)[number]);

export const isAdminRole = (role: unknown): role is 'super_admin' | 'global_admin' =>
  role === 'super_admin' || role === 'global_admin';

export const getCreatableRoles = (actorRole: string) => {
  switch (actorRole) {
    case 'super_admin':
      return ['global_admin', 'director', 'manager_plus', 'manager', 'commande'];
    case 'global_admin':
      return ['director', 'manager_plus', 'manager', 'commande'];
    case 'director':
      return ['manager_plus', 'manager', 'commande'];
    case 'manager_plus':
      return ['manager', 'commande'];
    case 'manager':
      return ['commande'];
    default:
      return [];
  }
};

export const canAssignRole = (actorRole: string, nextRole: string) => getCreatableRoles(actorRole).includes(nextRole);

const hasAllSiteAccess = (profile: { role?: string; access_scope?: string | null }) =>
  profile.role === 'super_admin' || profile.role === 'global_admin' || profile.access_scope === 'all';

const canAccessTargetSites = (
  actor: { role: string; access_scope?: string | null; site_ids?: string[] | null },
  target: { role: string; access_scope?: string | null; site_ids?: string[] | null }
) => {
  if (hasAllSiteAccess(actor)) return true;
  if (hasAllSiteAccess(target)) return false;

  const actorSiteIds = Array.isArray(actor.site_ids) ? actor.site_ids : [];
  const targetSiteIds = Array.isArray(target.site_ids) ? target.site_ids : [];

  return targetSiteIds.length > 0 && targetSiteIds.every((siteId) => actorSiteIds.includes(siteId));
};

export const canManageTarget = (
  actor: { id: string; role: string; access_scope?: string | null; site_ids?: string[] | null; protected_user?: boolean | null },
  target: { id: string; role: string; access_scope?: string | null; site_ids?: string[] | null; protected_user?: boolean | null }
) => {
  if (actor.id === target.id) {
    return { ok: false as const, error: 'Vous ne pouvez pas modifier votre propre compte via cette action.' };
  }

  if (actor.role === 'super_admin') {
    return { ok: true as const };
  }

  if (!canAccessUserManagement(actor.role)) {
    return { ok: false as const, error: 'Droits insuffisants.' };
  }

  if (target.protected_user) {
    return { ok: false as const, error: 'Cet utilisateur est protégé et ne peut pas être modifié.' };
  }

  if (target.role === 'super_admin') {
    return { ok: false as const, error: 'Vous ne pouvez pas modifier ce niveau de compte.' };
  }

  if (actor.role === 'global_admin') {
    return ['director', 'manager_plus', 'manager', 'commande'].includes(target.role) && canAccessTargetSites(actor, target)
      ? { ok: true as const }
      : { ok: false as const, error: 'Vous ne pouvez pas modifier ce niveau de compte.' };
  }

  if (actor.role === 'director') {
    return ['manager_plus', 'manager', 'commande'].includes(target.role) && canAccessTargetSites(actor, target)
      ? { ok: true as const }
      : { ok: false as const, error: 'Vous ne pouvez agir que sur Manager+, Manager et Commande.' };
  }

  if (actor.role === 'manager_plus') {
    return ['manager', 'commande'].includes(target.role) && canAccessTargetSites(actor, target)
      ? { ok: true as const }
      : { ok: false as const, error: 'Vous ne pouvez agir que sur Manager et Commande.' };
  }

  if (actor.role === 'manager') {
    return target.role === 'commande' && canAccessTargetSites(actor, target)
      ? { ok: true as const }
      : { ok: false as const, error: 'Vous ne pouvez agir que sur le rôle Commande.' };
  }

  return { ok: false as const, error: 'Droits insuffisants.' };
};

export const canCreateUsers = (role: unknown) =>
  typeof role === 'string' && ['super_admin', 'global_admin', 'director', 'manager_plus', 'manager'].includes(role);

export const canUpdateUsers = (role: unknown) =>
  typeof role === 'string' && ['super_admin', 'global_admin', 'director', 'manager_plus', 'manager'].includes(role);

export const canDeleteUsers = (role: unknown) =>
  typeof role === 'string' && ['super_admin', 'global_admin', 'director', 'manager_plus', 'manager'].includes(role);

export const canToggleUsers = (role: unknown) =>
  typeof role === 'string' && ['super_admin', 'global_admin', 'director', 'manager_plus', 'manager'].includes(role);
