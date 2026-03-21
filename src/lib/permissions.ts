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

const hasRole = (profile: AppProfile | null, roles: readonly AppRole[]) => (
  !!profile?.role && roles.includes(profile.role)
);

const ADMIN_DASHBOARD_ROLES: AppRole[] = [ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER_PLUS];
const USER_MANAGEMENT_ROLES: AppRole[] = [ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER_PLUS, ROLES.MANAGER];
const SUPPLIER_SETTINGS_ROLES: AppRole[] = [ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.DIRECTOR];
const STATS_ROLES: AppRole[] = [ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER_PLUS, ROLES.MANAGER];
const EDIT_ROLES: AppRole[] = [ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER_PLUS];
const GLOBAL_ADMIN_MANAGEABLE: AppRole[] = [ROLES.DIRECTOR, ROLES.MANAGER_PLUS, ROLES.MANAGER, ROLES.COMMANDE];
const DIRECTOR_MANAGEABLE: AppRole[] = [ROLES.MANAGER_PLUS, ROLES.MANAGER, ROLES.COMMANDE];
const MANAGER_PLUS_MANAGEABLE: AppRole[] = [ROLES.MANAGER, ROLES.COMMANDE];

export function canAccessAdminDashboard(profile: AppProfile | null) {
  return hasRole(profile, ADMIN_DASHBOARD_ROLES);
}

export function canAccessUserManagement(profile: AppProfile | null) {
  return hasRole(profile, USER_MANAGEMENT_ROLES);
}

export function canAccessSupplierSettings(profile: AppProfile | null) {
  return hasRole(profile, SUPPLIER_SETTINGS_ROLES);
}

export function canAccessStatsPage(profile: AppProfile | null) {
  return hasRole(profile, STATS_ROLES);
}

export function canEditRatios(profile: AppProfile | null) {
  return hasRole(profile, EDIT_ROLES);
}

export function canEditPreviCouverts(profile: AppProfile | null) {
  return hasRole(profile, EDIT_ROLES);
}

export function canAccessDailyForecast(profile: AppProfile | null) {
  return canEditPreviCouverts(profile);
}

export function canAccessRatiosPage(profile: AppProfile | null) {
  return hasRole(profile, EDIT_ROLES);
}

export function canImportData(profile: AppProfile | null) {
  return hasRole(profile, STATS_ROLES);
}

export function canDeleteImport(profile: AppProfile | null) {
  return hasRole(profile, EDIT_ROLES);
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
  if (profile.role === ROLES.SUPER_ADMIN) return true;
  if (target.protected_user || target.role === ROLES.SUPER_ADMIN) return false;

  switch (profile.role) {
    case ROLES.GLOBAL_ADMIN:
      return GLOBAL_ADMIN_MANAGEABLE.includes(target.role);
    case ROLES.DIRECTOR:
      return DIRECTOR_MANAGEABLE.includes(target.role);
    case ROLES.MANAGER_PLUS:
      return MANAGER_PLUS_MANAGEABLE.includes(target.role);
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
