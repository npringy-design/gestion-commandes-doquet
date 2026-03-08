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

// Préfixe utilisé pour toutes les clés localStorage
export const STORAGE_PREFIX = 'hippo_v6_';

// Types de vues de navigation
export type View =
  | 'home'
  | 'suppliers'
  | 'doquet'
  | 'vins'
  | 'viandes'
  | 'domafrais'
  | 'domafrais_bof'
  | 'domafrais_surgele'
  | 'pomona_terre_azur'
  | 'pomona_episaveurs'
  | 'stats'
  | 'ratios'
  | 'daily_forecast'
  | 'admin_dashboard'
  | 'supplier_settings'
  | 'user_management'
  | 'cost_analysis';

// IDs des fournisseurs
export type SupplierId = 'doquet' | 'vins' | 'viandes' | 'domafrais' | 'domafrais_bof' | 'domafrais_surgele' | 'pomona_terre_azur' | 'pomona_episaveurs';

export const SUPPLIER_LABELS: Record<SupplierId, { name: string; subtitle: string }> = {
  doquet:        { name: "DOQUET",            subtitle: "Softs • Jus • Cocktails" },
  vins:          { name: "Richard Vins",      subtitle: "Cave • Alcools"          },
  viandes:       { name: "Plaine Maison",     subtitle: "Boucherie • Grill"       },
  domafrais:     { name: "Domafrais Viandes", subtitle: "Viandes • Volailles"     },
  domafrais_bof: { name: "Domafrais B.O.F",   subtitle: "Crémerie • Fromages"     },
  domafrais_surgele: { name: "Domafrais Surgelé", subtitle: "Surgelés • Glaces" },
  pomona_terre_azur: { name: "Pomona Terre Azur", subtitle: "Fruits • Légumes" },
  pomona_episaveurs: { name: "Pomona Episaveurs", subtitle: "Épicerie • Aides culinaires" },
};
