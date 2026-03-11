import type { AppProfile, AppRole } from '../auth/AuthProvider';

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  GLOBAL_ADMIN: 'global_admin',
  DIRECTOR: 'director',
  MANAGER_PLUS: 'manager_plus',
  MANAGER: 'manager',
  COMMANDE: 'commande',
} as const;

export const ROLE_LEVEL: Record<AppRole, number> = {
  super_admin: 100,
  global_admin: 90,
  director: 70,
  manager_plus: 50,
  manager: 40,
  commande: 10,
};

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'SUPER_ADMIN',
  global_admin: 'GLOBAL_ADMIN',
  director: 'DIRECTOR',
  manager_plus: 'MANAGER+',
  manager: 'MANAGER',
  commande: 'COMMANDE',
};

export function canAccessAdminDashboard(profile: AppProfile | null) {
  return [ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER_PLUS].includes((profile?.role ?? '') as AppRole);
}

export function canAccessUserManagement(profile: AppProfile | null) {
  return [ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER_PLUS, ROLES.MANAGER].includes((profile?.role ?? '') as AppRole);
}

export function canAccessSupplierSettings(profile: AppProfile | null) {
  return [ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.DIRECTOR].includes((profile?.role ?? '') as AppRole);
}

export function canAccessStatsPage(profile: AppProfile | null) {
  return [ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER_PLUS, ROLES.MANAGER].includes((profile?.role ?? '') as AppRole);
}

export function canEditRatios(profile: AppProfile | null) {
  return [ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER_PLUS].includes((profile?.role ?? '') as AppRole);
}

export function canEditPreviCouverts(profile: AppProfile | null) {
  return [ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER_PLUS].includes((profile?.role ?? '') as AppRole);
}

export function canAccessDailyForecast(profile: AppProfile | null) {
  return canEditPreviCouverts(profile);
}

export function canAccessRatiosPage(profile: AppProfile | null) {
  return [ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER_PLUS].includes((profile?.role ?? '') as AppRole);
}

export function canImportData(profile: AppProfile | null) {
  return [ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER_PLUS, ROLES.MANAGER].includes((profile?.role ?? '') as AppRole);
}

export function canDeleteImport(profile: AppProfile | null) {
  return [ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER_PLUS].includes((profile?.role ?? '') as AppRole);
}

export function canEditSettingsFields(profile: AppProfile | null) {
  return canAccessStatsPage(profile);
}

export function isReadOnlyAnalyse(profile: AppProfile | null) {
  return profile?.role === ROLES.COMMANDE;
}

export function isCommandeRole(profile: AppProfile | null) {
  return profile?.role === ROLES.COMMANDE;
}

export function getCreatableRoles(profile: AppProfile | null): AppRole[] {
  switch (profile?.role) {
    case ROLES.SUPER_ADMIN:
      return [ROLES.GLOBAL_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER_PLUS, ROLES.MANAGER, ROLES.COMMANDE];
    case ROLES.GLOBAL_ADMIN:
      return [ROLES.DIRECTOR, ROLES.MANAGER_PLUS, ROLES.MANAGER, ROLES.COMMANDE];
    case ROLES.DIRECTOR:
      return [ROLES.MANAGER_PLUS, ROLES.MANAGER, ROLES.COMMANDE];
    case ROLES.MANAGER_PLUS:
      return [ROLES.MANAGER, ROLES.COMMANDE];
    case ROLES.MANAGER:
      return [ROLES.COMMANDE];
    default:
      return [];
  }
}

export function canAssignRole(profile: AppProfile | null, role: AppRole) {
  return getCreatableRoles(profile).includes(role);
}

export function canManageTarget(profile: AppProfile | null, target: Pick<AppProfile, 'id' | 'role' | 'protected_user'> | null) {
  if (!profile || !target) return false;
  if (profile.id === target.id) return false;
  if (profile.role === ROLES.SUPER_ADMIN) return target.role !== ROLES.SUPER_ADMIN;
  if (target.protected_user || target.role === ROLES.SUPER_ADMIN) return false;

  switch (profile.role) {
    case ROLES.GLOBAL_ADMIN:
      return [ROLES.DIRECTOR, ROLES.MANAGER_PLUS, ROLES.MANAGER, ROLES.COMMANDE].includes(target.role);
    case ROLES.DIRECTOR:
      return [ROLES.MANAGER_PLUS, ROLES.MANAGER, ROLES.COMMANDE].includes(target.role);
    case ROLES.MANAGER_PLUS:
      return [ROLES.MANAGER, ROLES.COMMANDE].includes(target.role);
    case ROLES.MANAGER:
      return target.role === ROLES.COMMANDE;
    default:
      return false;
  }
}

export function getAssignableRoleOptions(profile: AppProfile | null, target: Pick<AppProfile, 'id' | 'role' | 'protected_user'> | null): AppRole[] {
  if (!profile) return [];
  if (target?.role === ROLES.SUPER_ADMIN) return [ROLES.SUPER_ADMIN];
  if (!target || !canManageTarget(profile, target)) return [];
  return getCreatableRoles(profile);
}
