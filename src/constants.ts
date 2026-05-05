// =============================================================
// constants.ts
// Toutes les constantes globales de l'application
// Extraites de App.tsx pour éviter les redondances
// =============================================================

export const MONTHS_ORDER = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
] as const;

export type MonthKey = typeof MONTHS_ORDER[number];

export const DAYS_OF_WEEK = [
  "Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"
];

export const DAYS_OF_WEEK_LABELS = ["lu", "ma", "me", "je", "ve", "sa", "di"];

export const MONTHS_DISPLAY_CONFIG = [
  { label: "JANVIER",   key: "jan" },
  { label: "FÉVRIER",   key: "feb" },
  { label: "MARS",      key: "mar" },
  { label: "AVRIL",     key: "apr" },
  { label: "MAI",       key: "may" },
  { label: "JUIN",      key: "jun" },
  { label: "JUILLET",   key: "jul" },
  { label: "AOÛT",      key: "aug" },
  { label: "SEPTEMBRE", key: "sep" },
  { label: "OCTOBRE",   key: "oct" },
  { label: "NOVEMBRE",  key: "nov" },
  { label: "DÉCEMBRE",  key: "dec" },
] as const;

// Correspondance clé interne (jan/feb...) → nom complet (Janvier/Février...)
export const MONTH_KEY_TO_NAME: Record<string, string> = {
  jan: 'Janvier', feb: 'Février',  mar: 'Mars',     apr: 'Avril',
  may: 'Mai',     jun: 'Juin',     jul: 'Juillet',  aug: 'Août',
  sep: 'Septembre', oct: 'Octobre', nov: 'Novembre', dec: 'Décembre',
};

export const SITES = {
  hippo_thillois: {
    id: 'hippo_thillois',
    name: 'Hippo Thillois',
  },
  hippo_st_thibault: {
    id: 'hippo_st_thibault',
    name: 'Hippo St Thibault',
  },
} as const;

export type SiteId = keyof typeof SITES;

export const ACTIVE_SITE_STORAGE_KEY = 'hippo_active_site_id';

export const isSiteId = (value: unknown): value is SiteId =>
  typeof value === 'string' && value in SITES;

export type AppEnvironment = 'production' | 'staging' | 'test' | 'development';

const configuredAppEnv = (import.meta.env.VITE_APP_ENV as string | undefined)?.trim().toLowerCase();

export const APP_ENV: AppEnvironment =
  configuredAppEnv === 'staging' || configuredAppEnv === 'test' || configuredAppEnv === 'development'
    ? configuredAppEnv
    : 'production';

export const IS_NON_PRODUCTION_ENV = APP_ENV !== 'production';

const currentHost = typeof window === 'undefined' ? '' : window.location.hostname.toLowerCase();

export const IS_TEST_RUNTIME =
  IS_NON_PRODUCTION_ENV
  || currentHost.includes('test')
  || currentHost.includes('staging');

export const APP_ENV_LABEL =
  (import.meta.env.VITE_APP_ENV_LABEL as string | undefined)?.trim()
  || (IS_TEST_RUNTIME ? 'TEST' : 'PRODUCTION');

export const getDisplaySiteName = (siteName: string): string =>
  IS_TEST_RUNTIME ? `${siteName} - TEST` : siteName;

export const getDisplaySiteShortName = (siteName: string): string => {
  const shortName = siteName.replace(/^Hippo\s+/i, '');
  return IS_TEST_RUNTIME ? `${shortName} TEST` : shortName;
};

const configuredSiteId = (import.meta.env.VITE_SITE_ID as string | undefined)?.trim();

const readStoredSiteId = (): SiteId | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.sessionStorage.getItem(ACTIVE_SITE_STORAGE_KEY);
    return isSiteId(stored) ? stored : null;
  } catch {
    return null;
  }
};

// Site courant utilisé pour isoler Supabase.
// Garder hippo_thillois en défaut protège les données existantes.
export const CURRENT_SITE_ID =
  readStoredSiteId() ?? (isSiteId(configuredSiteId) ? configuredSiteId : 'hippo_thillois');

// Préfixe réservé aux préférences d'interface locales, pas aux données métier.
export const STORAGE_PREFIX = `hippo_v6_${CURRENT_SITE_ID}_`;

// Types de vues de navigation
export type CoreView =
  | 'home'
  | 'suppliers'
  | 'stats'
  | 'ratios'
  | 'daily_forecast'
  | 'admin_dashboard'
  | 'supplier_settings'
  | 'user_management'
  | 'cost_analysis'
  | 'prep_sheet'
  | 'prep_ratios'
  | 'take_rate'
  | 'take_rate_sheet'
  | 'product_mix';

export type View = CoreView | (string & {});

// IDs des fournisseurs
export type SupplierId = string;

export const SUPPLIER_LABELS: Record<string, { name: string; subtitle: string }> = {
  doquet:        { name: "DOQUET",            subtitle: "Softs • Jus • Cocktails" },
  vins:          { name: "Richard Vins",      subtitle: "Cave • Alcools"          },
  viandes:       { name: "Plaine Maison",     subtitle: "Boucherie • Grill"       },
  domafrais:     { name: "Domafrais Viandes", subtitle: "Viandes • Volailles"     },
  domafrais_bof: { name: "Domafrais B.O.F",   subtitle: "Crémerie • Fromages"     },
  domafrais_surgele: { name: "Domafrais Surgelé", subtitle: "Surgelés • Glaces" },
  pomona_terre_azur: { name: "Pomona Terre Azur", subtitle: "Fruits • Légumes" },
  pomona_episaveurs: { name: "Pomona Episaveurs", subtitle: "Épicerie • Aides culinaires" },
};


export const RESERVED_VIEWS = new Set<CoreView>([
  'home',
  'suppliers',
  'stats',
  'ratios',
  'daily_forecast',
  'admin_dashboard',
  'supplier_settings',
  'user_management',
  'cost_analysis',
  'prep_sheet',
  'prep_ratios',
  'take_rate',
  'take_rate_sheet',
  'product_mix',
]);

export const slugifySupplierId = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
