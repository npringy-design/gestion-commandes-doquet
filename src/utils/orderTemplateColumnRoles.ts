// Sens des colonnes d'un tableau lu par pdfTableLayout : suggestion à partir
// des intitulés, confiance, et mémorisation du choix confirmé par fournisseur.
//
// Les rôles sont toujours proposés puis confirmés par l'utilisateur ; aucune
// position fixe ni libellé unique n'est supposé.

import { isCodeCell, type TableColumn, type TableLayout } from './pdfTableLayout';

export type ColumnRole = 'article' | 'storageUnit' | 'packagingUnit' | 'code' | 'ignore';
export type RoleConfidence = 'sure' | 'unsure';

export const COLUMN_ROLES: ColumnRole[] = ['article', 'storageUnit', 'packagingUnit', 'code', 'ignore'];

export const COLUMN_ROLE_LABELS: Record<ColumnRole, string> = {
  article: 'Article',
  storageUnit: 'Unité de stockage',
  packagingUnit: 'Conditionnement',
  code: 'Code',
  ignore: 'Ignorer',
};

export interface ColumnRoleSuggestion {
  roles: ColumnRole[];
  // Confiance par colonne : `unsure` si plusieurs colonnes se disputent un rôle.
  confidence: RoleConfidence[];
  headerTexts: string[];
  bodyStart: number;
  // `sure` seulement si article, stockage et conditionnement ont chacun un
  // unique candidat.
  overall: RoleConfidence;
}

export const normalizeHeaderText = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const headerWords = (text: string): string[] => normalizeHeaderText(text).split(' ').filter(Boolean);

// Un mot d'intitulé correspond à un synonyme s'il le commence (« articles »
// pour « article ») ; les abréviations très courtes exigent le mot entier.
const ARTICLE_STEMS = ['article', 'designation', 'libelle', 'produit', 'description'];
const PACKAGING_STEMS = ['conditionnement', 'colisage'];
const PACKAGING_EXACT_WORDS = ['cond', 'uc'];
const STORAGE_PHRASES = ['unite de stock', 'unite de stockage', 'unite de commande'];

const startsWithAny = (word: string, stems: string[]): boolean => stems.some((stem) => word.startsWith(stem));

export const matchHeaderRoles = (headerText: string): ColumnRole[] => {
  const normalized = normalizeHeaderText(headerText);
  if (!normalized) return [];
  const words = headerWords(headerText);
  const roles: ColumnRole[] = [];

  if (words.some((word) => startsWithAny(word, ARTICLE_STEMS))) roles.push('article');
  if (
    words.some((word) => startsWithAny(word, PACKAGING_STEMS) || PACKAGING_EXACT_WORDS.includes(word))
  ) {
    roles.push('packagingUnit');
  } else if (
    STORAGE_PHRASES.some((phrase) => normalized.includes(phrase)) || words.some((word) => word === 'unite' || word === 'unites')
  ) {
    // « Unité de conditionnement » contient « unité » : le conditionnement l'emporte.
    roles.push('storageUnit');
  }
  return roles;
};

const countHeaderMatches = (cells: string[]): number =>
  cells.filter((cell) => matchHeaderRoles(cell).length > 0).length;

// Première ligne d'au moins deux cellules d'intitulé reconnues.
export const findHeaderRowIndex = (rows: string[][]): number =>
  rows.findIndex((row) => countHeaderMatches(row) >= 2);

const isHeaderLikeRow = (row: string[]): boolean =>
  row.some((cell) => matchHeaderRoles(cell).length > 0 || normalizeHeaderText(cell) === 'code');

// Début des lignes de produits : isolé par la colonne Code quand elle existe,
// sinon par la ligne d'en-tête reconnue. Un code mal lu ne doit pas faire
// passer un produit pour un en-tête : on remonte tant que la ligne précédente
// ne ressemble pas à un en-tête.
export const resolveBodyStart = (layout: TableLayout): number => {
  let start = layout.bodyStart;
  if (start <= 0) {
    const headerRow = findHeaderRowIndex(layout.rows);
    return headerRow >= 0 ? headerRow + 1 : 0;
  }
  while (start > 0 && !isHeaderLikeRow(layout.rows[start - 1])) start -= 1;
  return start;
};

export const getHeaderTexts = (layout: TableLayout, bodyStart = resolveBodyStart(layout)): string[] =>
  layout.columns.map((column) => {
    if (bodyStart <= 0) return '';
    if (layout.bodyStart > 0) {
      return layout.rows
        .slice(0, bodyStart)
        .map((row) => row[column.index] ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    return (layout.rows[bodyStart - 1]?.[column.index] ?? '').trim();
  });

const findCodeColumnIndex = (layout: TableLayout, bodyStart: number): number => {
  let best = -1;
  let bestCount = 2;
  layout.columns.forEach((column) => {
    const cells = layout.rows.slice(bodyStart).map((row) => row[column.index] ?? '').filter((cell) => cell !== '');
    const codes = cells.filter(isCodeCell).length;
    if (codes > bestCount && codes * 2 >= cells.length) {
      best = column.index;
      bestCount = codes;
    }
  });
  return best;
};

export const suggestColumnRoles = (layout: TableLayout): ColumnRoleSuggestion => {
  const bodyStart = resolveBodyStart(layout);
  const headerTexts = getHeaderTexts(layout, bodyStart);
  const columnCount = layout.columns.length;
  const roles: ColumnRole[] = Array.from({ length: columnCount }, () => 'ignore');
  const confidence: RoleConfidence[] = Array.from({ length: columnCount }, () => 'sure');

  const codeColumn = findCodeColumnIndex(layout, bodyStart);
  const matches = headerTexts.map((text) => matchHeaderRoles(text));

  let allRolesSure = true;
  (['article', 'storageUnit', 'packagingUnit'] as const).forEach((role) => {
    const candidates = matches
      .map((columnRoles, column) => (columnRoles.includes(role) && column !== codeColumn ? column : -1))
      .filter((column) => column >= 0);
    if (candidates.length === 0) {
      allRolesSure = false;
      return;
    }
    roles[candidates[0]] = role;
    if (candidates.length > 1) {
      allRolesSure = false;
      candidates.forEach((column) => { confidence[column] = 'unsure'; });
    }
  });

  if (codeColumn >= 0 && roles[codeColumn] === 'ignore') roles[codeColumn] = 'code';

  return {
    roles,
    confidence,
    headerTexts,
    bodyStart,
    overall: allRolesSure ? 'sure' : 'unsure',
  };
};

// Aperçu des premières lignes de produits pour la confirmation.
export const getPreviewRows = (layout: TableLayout, bodyStart: number, count = 5): string[][] =>
  layout.rows.slice(bodyStart).filter((row) => row.some((cell) => cell !== '')).slice(0, count);

// Colonnes sans aucune valeur dans le corps du tableau (zones de saisie vides) :
// inutiles à proposer pour un rôle.
export const getNonEmptyColumnIndexes = (layout: TableLayout, bodyStart: number): number[] =>
  layout.columns
    .map((column) => column.index)
    .filter((index) => layout.rows.some((row, rowIndex) => rowIndex >= bodyStart && (row[index] ?? '') !== ''));

// ---------------------------------------------------------------------------
// Pages suivantes : associer chaque colonne à celle de la page de référence
// ---------------------------------------------------------------------------

export const mapColumnsToReference = (columns: TableColumn[], reference: TableColumn[]): number[] =>
  columns.map((column) => {
    let best = -1;
    let bestOverlap = 0;
    reference.forEach((candidate) => {
      const overlap = Math.min(column.xEnd, candidate.xEnd) - Math.max(column.xStart, candidate.xStart);
      const smaller = Math.min(column.xEnd - column.xStart, candidate.xEnd - candidate.xStart);
      if (overlap > bestOverlap && smaller > 0 && overlap >= smaller * 0.5) {
        best = candidate.index;
        bestOverlap = overlap;
      }
    });
    return best;
  });

// ---------------------------------------------------------------------------
// Mémorisation par fournisseur (localStorage, sans migration Supabase)
// ---------------------------------------------------------------------------

export type StoredColumnMapping = Record<string, ColumnRole>;

export const getColumnMappingStorageKey = (supplierId: string): string =>
  `orderTemplateColumnMapping:${supplierId}`;

const isColumnRole = (value: unknown): value is ColumnRole =>
  typeof value === 'string' && (COLUMN_ROLES as string[]).includes(value);

// Intitulés normalisés vers rôles, pour les seules colonnes qui ont un intitulé.
export const buildStoredMapping = (headerTexts: string[], roles: ColumnRole[]): StoredColumnMapping => {
  const mapping: StoredColumnMapping = {};
  headerTexts.forEach((text, index) => {
    const key = normalizeHeaderText(text);
    if (key) mapping[key] = roles[index] ?? 'ignore';
  });
  return mapping;
};

// Rôles mémorisés applicables à ces intitulés : tous les intitulés doivent
// être connus et l'article doit être désigné ; sinon null.
export const applyStoredMapping = (
  stored: StoredColumnMapping | null,
  headerTexts: string[],
  fallbackRoles: ColumnRole[],
): ColumnRole[] | null => {
  if (!stored) return null;
  const roles: ColumnRole[] = [];
  for (let index = 0; index < headerTexts.length; index += 1) {
    const key = normalizeHeaderText(headerTexts[index]);
    if (!key) {
      roles.push(fallbackRoles[index] ?? 'ignore');
    } else if (stored[key] !== undefined) {
      roles.push(stored[key]);
    } else {
      return null;
    }
  }
  return roles.includes('article') ? roles : null;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const defaultStorage = (): StorageLike | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

export const loadStoredColumnMapping = (
  supplierId: string,
  storage: StorageLike | null = defaultStorage(),
): StoredColumnMapping | null => {
  if (!storage || !supplierId) return null;
  try {
    const raw = storage.getItem(getColumnMappingStorageKey(supplierId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const mapping: StoredColumnMapping = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
      if (isColumnRole(value)) mapping[key] = value;
    });
    return Object.keys(mapping).length > 0 ? mapping : null;
  } catch {
    return null;
  }
};

export const saveStoredColumnMapping = (
  supplierId: string,
  mapping: StoredColumnMapping,
  storage: StorageLike | null = defaultStorage(),
): boolean => {
  if (!storage || !supplierId || Object.keys(mapping).length === 0) return false;
  try {
    storage.setItem(getColumnMappingStorageKey(supplierId), JSON.stringify(mapping));
    return true;
  } catch {
    return false;
  }
};
