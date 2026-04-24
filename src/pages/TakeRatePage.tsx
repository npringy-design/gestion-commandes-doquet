import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MONTHS_DISPLAY_CONFIG, STORAGE_PREFIX, View } from '../constants';

interface MarginCatalogItem {
  label: string;
  normalized: string;
  costHt: number | null;
  sellPriceHt: number | null;
  marginPercent: number | null;
  marginEuro: number | null;
  sourceSheet: string;
  section: string;
}

export interface TakeRateMappingRow {
  id: string;
  label: string;
  family: string;
  linkedImports: string[];
  costHt?: string;
  sellPriceHt?: string;
  marginPercent?: string;
  marginEuro?: string;
  marginSource?: 'auto' | 'manual' | '';
  matchedMarginLabel?: string;
  matchedMarginSheet?: string;
}

interface TakeRatePageProps {
  setView: (view: View) => void;
  prepImportsByMonth: Record<string, string>;
}

type RowStatus = 'ok' | 'review' | 'unlinked';

const ROWS_STORAGE_KEY = `${STORAGE_PREFIX}take_rate_rows_v3`;
const LEGACY_ROWS_STORAGE_KEYS = [
  `${STORAGE_PREFIX}take_rate_rows_v2`,
  `${STORAGE_PREFIX}take_rate_rows_v1`,
];
const MARGIN_STORAGE_KEY = `${STORAGE_PREFIX}take_rate_margin_catalog_v1`;
const MARGIN_FILE_NAME_STORAGE_KEY = `${STORAGE_PREFIX}take_rate_margin_file_name_v1`;

const createEmptyRow = (): TakeRateMappingRow => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  label: '',
  family: '',
  linkedImports: [],
  costHt: '',
  sellPriceHt: '',
  marginPercent: '',
  marginEuro: '',
  marginSource: '',
  matchedMarginLabel: '',
  matchedMarginSheet: '',
});

const normalize = (value: string) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (value: string) => normalize(value).split(' ').filter(Boolean);

const parseCsvLine = (line: string, delimiter: string) => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
};

const detectDelimiter = (input: string) => {
  const firstLine = input.split(/\r?\n/).find((line) => line.trim().length > 0) ?? '';
  const candidates = [';', '\t', ','];
  let best = ';';
  let bestScore = -1;

  candidates.forEach((candidate) => {
    const score = firstLine.split(candidate).length;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  });

  return best;
};

const pickPreferredLabelColumn = (header: string[]) => {
  const exactPriority = ['libelle', 'libellé', 'label', 'designation', 'désignation', 'article', 'nom', 'item'].map(normalize);
  for (const preferred of exactPriority) {
    const exactIndex = header.findIndex((cell) => cell === preferred);
    if (exactIndex !== -1) return exactIndex;
  }

  const containsPriority = ['libelle', 'libellé', 'designation', 'désignation', 'article', 'nom', 'item', 'produit'].map(normalize);
  for (const preferred of containsPriority) {
    const containsIndex = header.findIndex((cell) => cell.includes(preferred));
    if (containsIndex !== -1) return containsIndex;
  }

  return 0;
};

const extractImportLabels = (content: string): string[] => {
  if (!content?.trim()) return [];

  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(content);
  const header = parseCsvLine(lines[0], delimiter).map(normalize);
  const nameIndex = pickPreferredLabelColumn(header);

  const labels: string[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i], delimiter);
    const label = String(cols[nameIndex] ?? '').trim();
    const normalized = normalize(label);
    if (!label || !normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    labels.push(label);
  }

  return labels;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\u00a0/g, ' ').replace(/€/g, '').replace(/%/g, '').replace(/\s/g, '').replace(',', '.');
  if (!cleaned || cleaned === '-') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDecimal = (value: number | null) => (value === null || !Number.isFinite(value) ? '' : value.toFixed(2).replace('.', ','));
const formatPercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '';
  const ratio = value <= 1 ? value * 100 : value;
  return ratio.toFixed(1).replace('.', ',');
};

const normalizeRow = (row: any): TakeRateMappingRow => ({
  id: String(row.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
  label: String(row.label ?? ''),
  family: String(row.family ?? ''),
  linkedImports: Array.isArray(row.linkedImports) ? row.linkedImports.map(String) : [],
  costHt: String(row.costHt ?? ''),
  sellPriceHt: String(row.sellPriceHt ?? ''),
  marginPercent: String(row.marginPercent ?? ''),
  marginEuro: String(row.marginEuro ?? ''),
  marginSource: row.marginSource === 'manual' || row.marginSource === 'auto' ? row.marginSource : '',
  matchedMarginLabel: String(row.matchedMarginLabel ?? ''),
  matchedMarginSheet: String(row.matchedMarginSheet ?? ''),
});

const inferFamilyFromSheet = (sheet: string) => {
  const normalized = normalize(sheet);
  if (normalized.includes('boeuf')) return 'Boeuf';
  if (normalized.includes('boisson')) return 'Boissons';
  if (normalized.includes('vin')) return 'Vins';
  if (normalized.includes('formule')) return 'Menus';
  if (normalized.includes('food')) return 'Food';
  if (normalized.includes('produit')) return 'Produits';
  return '';
};

const cleanSectionLabel = (value: string) =>
  String(value ?? '')
    .replace(/[:\-–—]+$/g, '')
    .replace(/^[:\-–—]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const cleanProductLabel = (value: string) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return '';
  return cleanSectionLabel(lines[0]);
};

const FORMULA_LIKE_RE = /^=|^<openpyxl\./i;

const SECTION_BLOCKED_NORMALIZED = new Set([
  'sites',
  'site',
  'natio',
  'shf',
  'natio shf',
  'natio et shf',
  'fond de carte',
  'saisonniere',
  'saisonniere ah25',
  'prog caisse',
  'hors carte',
  'offre',
  'offre food automne hiver 2025',
  'offre boeuf 2025 2026',
  'offre boisson ah25',
  'offre vins 2025 2026',
  'offre food',
  'offre boeuf',
  'offre boisson',
  'offre vins',
  'produits',
  'produit',
  'recettes',
  'recette',
  'etat',
  'cr',
  'pvc',
  'marge',
  'format',
  'picto',
  'composition',
  'compositions',
  'provenance',
  'prix kg',
  'inflation',
  'vin au verre',
  'mae photo',
  'commentaires brief liquides ah25',
  'les descriptions et intitules sont encore en cours de travail',
  'les descriptions et intitulés sont encore en cours de travail',
  'conserver',
  'conserve',
  'modifier',
  'ajouter',
  'ajout',
  'supprimer',
  'supprime'
]);

const SIMPLE_STATUS_NORMALIZED = new Set(['conserver', 'conserve', 'modifier', 'ajouter', 'ajout', 'supprimer', 'supprime']);
const SIMPLE_RECIPE_NORMALIZED = new Set(['fond de carte', 'saisonniere', 'prog caisse', 'hors carte']);
const SIMPLE_SITE_NORMALIZED = new Set(['natio', 'shf', 'natio shf', 'natio et shf', 'shf zone1', 'shf zone 1', 'shf zone2', 'shf zone 2']);

const looksLikeFormatValue = (value: string) => {
  const normalized = normalize(value);
  if (!normalized) return false;
  return /(verre|bouteille|carafe|cl|magnum)/.test(normalized);
};

const isLikelySectionLabel = (value: string) => {
  const label = cleanSectionLabel(value);
  const normalized = normalize(label);
  if (!label || !normalized) return false;
  if (FORMULA_LIKE_RE.test(label)) return false;
  if (/\d/.test(normalized)) return false;
  if (normalized.length < 3 || normalized.length > 55) return false;
  if (SECTION_BLOCKED_NORMALIZED.has(normalized)) return false;
  if (looksLikeFormatValue(label)) return false;

  const blockedTokens = ['cm', 'pv', 'pvc', 'marge', 'libelle', 'libellé', 'designation', 'désignation', 'article', 'nom', 'produit', 'total', 'sous total'];
  if (blockedTokens.some((token) => normalized === token || normalized.includes(token))) return false;

  const tokens = normalized.split(' ').filter(Boolean);
  return tokens.length <= 6;
};

const isLikelyProductLabel = (value: string) => {
  const label = cleanSectionLabel(value);
  const normalized = normalize(label);
  if (!label || !normalized) return false;
  if (FORMULA_LIKE_RE.test(label)) return false;
  if (!/[a-z]/.test(normalized)) return false;

  const blockedPatterns = [
    /^total$/,
    /^sous total$/,
    /^total general$/,
    /^total général$/,
    /^marge$/,
    /^cm$/,
    /^pv$/,
    /^pvc$/,
    /^food$/,
    /^boeuf$/,
    /^boissons$/,
    /^vins?$/,
    /^formules?$/,
    /^offre$/,
  ];

  if (blockedPatterns.some((pattern) => pattern.test(normalized))) return false;
  if (SECTION_BLOCKED_NORMALIZED.has(normalized)) return false;
  if (normalized.includes('marge') && normalized.split(' ').length <= 3) return false;
  if (normalized.includes('total')) return false;

  return true;
};

const findWorkbookSheetName = (sheetNames: string[], expectedName: string) => {
  const expectedNormalized = normalize(expectedName);
  const exact = sheetNames.find((name) => normalize(name) === expectedNormalized);
  if (exact) return exact;

  return (
    sheetNames.find((name) => {
      const candidate = normalize(name);
      return candidate.includes(expectedNormalized) || expectedNormalized.includes(candidate);
    }) ?? null
  );
};

type MarginSourceConfig = {
  name: string;
  productCol: number;
  costCol: number;
  sellCol: number;
  marginCol: number;
  startRow: number;
  sectionCol?: number;
  formatCol?: number;
  stateCol?: number;
  familyFallback?: string;
  sectionMode?: 'simple' | 'hierarchical' | 'menu';
};

const getSimpleCellString = (row: Array<string | number | null>, index: number) => cleanSectionLabel(String(row[index] ?? '').trim());

const getSectionCandidate = (value: string) => {
  const label = cleanSectionLabel(value);
  return isLikelySectionLabel(label) ? label : '';
};

const isSimpleStatusValue = (value: string) => SIMPLE_STATUS_NORMALIZED.has(normalize(value));
const isSimpleRecipeValue = (value: string) => SIMPLE_RECIPE_NORMALIZED.has(normalize(value));
const isSimpleSiteValue = (value: string) => SIMPLE_SITE_NORMALIZED.has(normalize(value));

const buildWineLabel = (baseLabel: string, formatLabel: string) => {
  const base = cleanProductLabel(baseLabel);
  const format = cleanSectionLabel(formatLabel);
  if (!base) return '';
  if (!format) return base;
  const normalizedBase = normalize(base);
  const normalizedFormat = normalize(format);
  if (normalizedBase.includes(normalizedFormat)) return base;
  return `${base} - ${format}`;
};

const isLikelyWineDescriptor = (value: string) => {
  const label = cleanProductLabel(value);
  const normalized = normalize(label);
  if (!label || !normalized) return false;
  if (FORMULA_LIKE_RE.test(label)) return false;

  const wineNameHints = [' aop ', ' aoc ', ' igp ', ' domaine ', ' chateau ', ' château ', ' cuvee ', ' cuvée ', ' maison ', ' peyrassol', ' guigal', ' millebuis', ' gerard bertrand', ' bertrand', ' belleruche', ' vin des hippopotes'];
  const padded = ` ${normalized} `;
  if (wineNameHints.some((hint) => padded.includes(hint))) return false;
  if (normalized.includes(' - ')) return false;
  if ((label.match(/,/g) ?? []).length >= 2) return true;
  if (normalized.split(' ').length >= 4) return true;
  return false;
};

const buildSimpleMarginItems = (
  rows: Array<Array<string | number | null>>,
  source: MarginSourceConfig,
  actualSheetName: string
): MarginCatalogItem[] => {
  const items: MarginCatalogItem[] = [];
  let currentSection = source.familyFallback || inferFamilyFromSheet(actualSheetName);

  for (let i = source.startRow; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const sectionCell = source.sectionCol !== undefined ? getSimpleCellString(row, source.sectionCol) : '';
    const rawProduct = getSimpleCellString(row, source.productCol);
    const label = cleanProductLabel(rawProduct);
    const costHt = toNumber(row[source.costCol]);
    const sellPriceHt = toNumber(row[source.sellCol]);
    const marginPercent = toNumber(row[source.marginCol]);
    const numericCount = [costHt, sellPriceHt, marginPercent].filter((value) => value !== null).length;

    if (sectionCell && !isSimpleSiteValue(sectionCell) && !isSimpleRecipeValue(sectionCell) && !isSimpleStatusValue(sectionCell) && !looksLikeFormatValue(sectionCell)) {
      const sectionCandidate = getSectionCandidate(sectionCell);
      if (sectionCandidate) currentSection = sectionCandidate;
    }

    if (!label) continue;
    if (!isLikelyProductLabel(label)) continue;

    const normalized = normalize(label);
    if (!normalized) continue;

    const marginEuro = sellPriceHt !== null && costHt !== null ? sellPriceHt - costHt : null;
    if (costHt === null && sellPriceHt === null && marginPercent === null && marginEuro === null) continue;

    items.push({
      label,
      normalized,
      costHt,
      sellPriceHt,
      marginPercent,
      marginEuro,
      sourceSheet: actualSheetName.trim(),
      section: currentSection || source.familyFallback || inferFamilyFromSheet(actualSheetName),
    });
  }

  return items;
};

const buildWineMarginItems = (
  rows: Array<Array<string | number | null>>,
  source: MarginSourceConfig,
  actualSheetName: string
): MarginCatalogItem[] => {
  const items: MarginCatalogItem[] = [];
  let majorSection = source.familyFallback || inferFamilyFromSheet(actualSheetName);
  let subSection = '';
  let lastWineBaseLabel = '';

  for (let i = source.startRow; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const leftCell = source.sectionCol !== undefined ? getSimpleCellString(row, source.sectionCol) : '';
    const formatLabel = source.formatCol !== undefined ? getSimpleCellString(row, source.formatCol) : '';
    const rawProduct = getSimpleCellString(row, source.productCol);
    const productLabel = cleanProductLabel(rawProduct);

    const costHt = toNumber(row[source.costCol]);
    const sellPriceHt = toNumber(row[source.sellCol]);
    const marginPercent = toNumber(row[source.marginCol]);
    const numericCount = [costHt, sellPriceHt, marginPercent].filter((value) => value !== null).length;

    if (leftCell && !isSimpleStatusValue(leftCell) && !looksLikeFormatValue(leftCell) && !productLabel && numericCount === 0) {
      const sectionCandidate = getSectionCandidate(leftCell);
      if (sectionCandidate) {
        const normalizedSection = normalize(sectionCandidate);
        if (normalizedSection.startsWith('vins ') || normalizedSection === 'carafes') {
          majorSection = sectionCandidate;
          subSection = '';
        } else {
          subSection = sectionCandidate;
        }
      }
      continue;
    }

    if (!formatLabel && !productLabel) continue;

    let baseLabel = '';
    if (productLabel && !isLikelyWineDescriptor(productLabel) && isLikelyProductLabel(productLabel)) {
      baseLabel = productLabel;
      lastWineBaseLabel = productLabel;
    } else if (lastWineBaseLabel) {
      baseLabel = lastWineBaseLabel;
    }

    const label = buildWineLabel(baseLabel, formatLabel);
    if (!label) continue;

    const normalized = normalize(label);
    if (!normalized) continue;

    const marginEuro = sellPriceHt !== null && costHt !== null ? sellPriceHt - costHt : null;
    if (costHt === null && sellPriceHt === null && marginPercent === null && marginEuro === null) continue;

    const section = subSection ? `${majorSection} • ${subSection}` : majorSection || source.familyFallback || inferFamilyFromSheet(actualSheetName);

    items.push({
      label,
      normalized,
      costHt,
      sellPriceHt,
      marginPercent,
      marginEuro,
      sourceSheet: actualSheetName.trim(),
      section,
    });
  }

  return items;
};

const buildMenuMarginItems = (
  rows: Array<Array<string | number | null>>,
  source: MarginSourceConfig,
  actualSheetName: string
): MarginCatalogItem[] => {
  const items: MarginCatalogItem[] = [];
  let currentMenu = source.familyFallback || inferFamilyFromSheet(actualSheetName);
  let currentSubSection = '';

  for (let i = source.startRow; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const sectionCell = source.sectionCol !== undefined ? getSimpleCellString(row, source.sectionCol) : '';
    const rawProduct = getSimpleCellString(row, source.productCol);
    const label = cleanProductLabel(rawProduct);
    const costHt = toNumber(row[source.costCol]);
    const sellPriceHt = toNumber(row[source.sellCol]);
    const marginPercent = toNumber(row[source.marginCol]);

    if (sectionCell && !isSimpleRecipeValue(sectionCell) && !isSimpleStatusValue(sectionCell) && !looksLikeFormatValue(sectionCell)) {
      const normalizedSection = normalize(sectionCell);
      if (normalizedSection.startsWith('menu ')) {
        currentMenu = sectionCell;
        currentSubSection = '';
      } else {
        const sectionCandidate = getSectionCandidate(sectionCell);
        if (sectionCandidate) currentSubSection = sectionCandidate;
      }
    }

    if (!label || !isLikelyProductLabel(label)) continue;

    const normalized = normalize(label);
    if (!normalized) continue;

    const marginEuro = sellPriceHt !== null && costHt !== null ? sellPriceHt - costHt : null;
    if (costHt === null && sellPriceHt === null && marginPercent === null && marginEuro === null) continue;

    const section = currentSubSection ? `${currentMenu} • ${currentSubSection}` : currentMenu || source.familyFallback || inferFamilyFromSheet(actualSheetName);

    items.push({
      label,
      normalized,
      costHt,
      sellPriceHt,
      marginPercent,
      marginEuro,
      sourceSheet: actualSheetName.trim(),
      section,
    });
  }

  return items;
};

const buildMarginItemsFromRows = (
  rows: Array<Array<string | number | null>>,
  source: MarginSourceConfig,
  actualSheetName: string
) => {
  if (source.sectionMode === 'hierarchical') {
    return buildWineMarginItems(rows, source, actualSheetName);
  }

  if (source.sectionMode === 'menu') {
    return buildMenuMarginItems(rows, source, actualSheetName);
  }

  return buildSimpleMarginItems(rows, source, actualSheetName);
};
const IMPORT_GENERIC_TOKENS = new Set([
  'menu', 'menus', 'carte', 'formule', 'formules', 'supp', 'sup', 'supplement', 'supplements', 'a', 'au', 'aux', 'de', 'des', 'du', 'la', 'le', 'les', 'hors', 'emporter', 'take', 'away', 'avec', 'sans', 'sur', 'place', 'mid', 'soir', 'midi', 'plat', 'plats', 'portion', 'portions', 'petit', 'petite', 'grand', 'grande'
]);

const getStrongTokens = (value: string) => {
  const tokens = tokenize(value);
  const strong = tokens.filter((token) => !IMPORT_GENERIC_TOKENS.has(token));
  return strong.length > 0 ? strong : tokens;
};

const scoreImportMatch = (rowLabel: string, importLabel: string) => {
  const normalizedRow = normalize(rowLabel);
  const normalizedImport = normalize(importLabel);
  if (!normalizedRow || !normalizedImport) return -1;
  if (normalizedRow === normalizedImport) return 1000;

  const rowTokens = getStrongTokens(rowLabel);
  const importTokens = getStrongTokens(importLabel);
  const intersection = rowTokens.filter((token) => importTokens.includes(token));
  if (intersection.length === 0) return -1;

  const rowCovered = intersection.length / Math.max(rowTokens.length, 1);
  const allRowInsideImport = intersection.length === rowTokens.length;
  const substringBonus = normalizedImport.includes(normalizedRow) || normalizedRow.includes(normalizedImport) ? 70 : 0;
  const exactStrongBonus = rowTokens.join(' ') === importTokens.join(' ') ? 120 : 0;
  const extraPenalty = importTokens.length > rowTokens.length + 3 ? 20 : 0;

  return rowCovered * 140 + intersection.length * 25 + (allRowInsideImport ? 90 : 0) + substringBonus + exactStrongBonus - extraPenalty;
};


const findHeaderRowIndex = (rows: Array<Array<string | number | null>>) => {
  for (let i = 0; i < Math.min(rows.length, 20); i += 1) {
    const row = rows[i] ?? [];
    const normalizedRow = row.map((cell) => normalize(String(cell ?? '')));
    const hasProductLike = normalizedRow.some(
      (cell) => cell === 'produits' || cell === 'produit' || cell === 'offre',
    );
    const hasCostLike = normalizedRow.some(
      (cell) =>
        cell.includes('cout de revient') ||
        cell === 'cr' ||
        cell.includes('cr moyen') ||
        cell.includes('cout'),
    );
    if (hasProductLike && hasCostLike) return i;
  }
  return -1;
};

const pickColumnIndex = (headers: string[], matchers: Array<(value: string) => boolean>) => {
  for (let i = 0; i < headers.length; i += 1) {
    if (matchers.some((matcher) => matcher(headers[i]))) return i;
  }
  return -1;
};

const inferMarginColumnIndex = (rows: Array<Array<string | number | null>>, startRow: number, productCol: number, excluded: number[]) => {
  const maxCols = Math.max(...rows.slice(0, Math.min(rows.length, 20)).map((row) => row.length), 0);
  let bestIndex = -1;
  let bestScore = -1;

  for (let col = 0; col < maxCols; col += 1) {
    if (excluded.includes(col)) continue;

    let score = 0;
    let samples = 0;
    for (let i = startRow; i < Math.min(rows.length, startRow + 40); i += 1) {
      const row = rows[i] ?? [];
      const label = cleanProductLabel(String(row[productCol] ?? ''));
      const value = toNumber(row[col]);
      if (!label || value === null) continue;
      samples += 1;
      if (value >= 0 && value <= 1.2) score += 3;
      if (value > 1.2 && value <= 100) score += 1;
    }

    if (samples > 0 && score > bestScore) {
      bestScore = score;
      bestIndex = col;
    }
  }

  return bestIndex;
};

const buildFlexibleSheetItems = (
  rows: Array<Array<string | number | null>>,
  actualSheetName: string
): MarginCatalogItem[] => {
  const headerRowIndex = findHeaderRowIndex(rows);
  if (headerRowIndex < 0) return [];

  const headers = (rows[headerRowIndex] ?? []).map((cell) => normalize(String(cell ?? '')));
  const productCol = pickColumnIndex(headers, [
    (value) => value === 'produits' || value === 'produit',
    (value) => value === 'offre',
  ]);
  const familyCol = pickColumnIndex(headers, [
    (value) => value === 'famille',
    (value) => value.includes('section'),
  ]);
  const costCol = pickColumnIndex(headers, [
    (value) => value.includes('cout de revient'),
    (value) => value === 'cr',
    (value) => value.includes('cr moyen'),
    (value) => value.includes('cout'),
  ]);
  const sellPriceHtCol = pickColumnIndex(headers, [
    (value) => value.includes('prix ht'),
  ]);
  const sellPriceTtcCol = pickColumnIndex(headers, [
    (value) => value.includes('prix ttc'),
    (value) => value.includes('perso prix'),
    (value) => value === 'pvc',
    (value) => value.includes('prix'),
  ]);

  let marginCol = pickColumnIndex(headers, [(value) => value.includes('marge')]);
  const startRow = headerRowIndex + 1;

  if (productCol < 0 || costCol < 0) return [];
  if (marginCol < 0) {
    marginCol = inferMarginColumnIndex(
      rows,
      startRow,
      productCol,
      [productCol, familyCol, costCol, sellPriceHtCol, sellPriceTtcCol].filter((value) => value >= 0),
    );
  }

  const items: MarginCatalogItem[] = [];
  const defaultSection = inferFamilyFromSheet(actualSheetName) || actualSheetName.trim();

  for (let i = startRow; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const label = cleanProductLabel(String(row[productCol] ?? ''));
    if (!label || !isLikelyProductLabel(label)) continue;

    const explicitFamily = familyCol >= 0 ? cleanSectionLabel(String(row[familyCol] ?? '')) : '';
    const costHt = toNumber(row[costCol]);
    const sellPriceHtRaw = sellPriceHtCol >= 0 ? toNumber(row[sellPriceHtCol]) : null;
    const sellPriceTtcRaw = sellPriceTtcCol >= 0 ? toNumber(row[sellPriceTtcCol]) : null;
    const marginPercent = marginCol >= 0 ? toNumber(row[marginCol]) : null;
    const sellPriceHt = sellPriceHtRaw !== null ? sellPriceHtRaw : sellPriceTtcRaw !== null ? sellPriceTtcRaw / 1.1 : null;
    const marginEuro = sellPriceHt !== null && costHt !== null ? sellPriceHt - costHt : null;

    if (costHt === null && sellPriceHt === null && marginPercent === null && marginEuro === null) continue;

    const normalized = normalize(label);
    if (!normalized) continue;

    items.push({
      label,
      normalized,
      costHt,
      sellPriceHt,
      marginPercent,
      marginEuro,
      sourceSheet: actualSheetName.trim(),
      section: explicitFamily || defaultSection,
    });
  }

  return items;
};

const buildMarginCatalogFromWorkbook = async (file: File): Promise<MarginCatalogItem[]> => {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellFormula: true, cellText: true, cellNF: false });

  const map = new Map<string, MarginCatalogItem>();

  const flexibleSheetNames = ['Produits', 'FOOD', 'Formules', 'FORMULES'];
  flexibleSheetNames.forEach((expectedName) => {
    const actualSheetName = findWorkbookSheetName(workbook.SheetNames, expectedName);
    if (!actualSheetName) return;

    const sheet = workbook.Sheets[actualSheetName];
    if (!sheet) return;

    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    });

    const items = buildFlexibleSheetItems(rows, actualSheetName);
    items.forEach((candidate) => {
      if (!map.has(candidate.normalized)) {
        map.set(candidate.normalized, candidate);
      }
    });
  });

  if (map.size > 0) {
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }

  const sources: MarginSourceConfig[] = [
    { name: 'FOOD', productCol: 2, costCol: 6, sellCol: 8, marginCol: 13, startRow: 9, sectionCol: 0, familyFallback: 'Food' },
    { name: 'BOEUF ', productCol: 2, costCol: 9, sellCol: 11, marginCol: 16, startRow: 9, sectionCol: 0, familyFallback: 'Boeuf' },
    { name: 'BOISSONS', productCol: 2, costCol: 5, sellCol: 8, marginCol: 13, startRow: 8, sectionCol: 0, familyFallback: 'Boissons' },
    { name: 'VINS_2025_-_2026', productCol: 2, costCol: 10, sellCol: 11, marginCol: 12, startRow: 8, sectionCol: 0, formatCol: 1, stateCol: 0, familyFallback: 'Vins', sectionMode: 'hierarchical' },
    { name: 'FORMULES', productCol: 3, costCol: 6, sellCol: 8, marginCol: 11, startRow: 4, sectionCol: 1, familyFallback: 'Menus', sectionMode: 'menu' },
  ];

  sources.forEach((source) => {
    const actualSheetName = findWorkbookSheetName(workbook.SheetNames, source.name);
    if (!actualSheetName) return;

    const sheet = workbook.Sheets[actualSheetName];
    if (!sheet) return;

    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    });

    const items = buildMarginItemsFromRows(rows, source, actualSheetName);

    items.forEach((candidate) => {
      const existing = map.get(candidate.normalized);
      const existingScore = existing
        ? Number(existing.sellPriceHt !== null) +
          Number(existing.costHt !== null) +
          Number(existing.marginPercent !== null) +
          Number(existing.marginEuro !== null) +
          Number(Boolean(existing.section))
        : -1;
      const candidateScore =
        Number(candidate.sellPriceHt !== null) +
        Number(candidate.costHt !== null) +
        Number(candidate.marginPercent !== null) +
        Number(candidate.marginEuro !== null) +
        Number(Boolean(candidate.section));

      if (!existing || candidateScore >= existingScore) {
        map.set(candidate.normalized, candidate);
      }
    });
  });

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
};

const generateRowsFromMarginCatalog = (catalog: MarginCatalogItem[], existingRows: TakeRateMappingRow[]) => {
  const byMarginLabel = new Map<string, TakeRateMappingRow>();
  existingRows.forEach((row) => {
    const keys = [normalize(row.matchedMarginLabel || ''), normalize(row.label || '')].filter(Boolean);
    keys.forEach((key) => {
      if (!byMarginLabel.has(key)) byMarginLabel.set(key, row);
    });
  });

  return catalog.map((item) => {
    const existing = byMarginLabel.get(item.normalized);
    const manualMargin = existing?.marginSource === 'manual';

    return normalizeRow({
      id: existing?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      label: existing?.label?.trim() ? existing.label : item.label,
      family: existing?.family?.trim() ? existing.family : item.section || inferFamilyFromSheet(item.sourceSheet),
      linkedImports: existing?.linkedImports ?? [],
      costHt: manualMargin ? existing?.costHt : formatDecimal(item.costHt),
      sellPriceHt: manualMargin ? existing?.sellPriceHt : formatDecimal(item.sellPriceHt),
      marginPercent: manualMargin ? existing?.marginPercent : formatPercent(item.marginPercent),
      marginEuro: manualMargin ? existing?.marginEuro : formatDecimal(item.marginEuro),
      marginSource: manualMargin ? 'manual' : 'auto',
      matchedMarginLabel: item.label,
      matchedMarginSheet: item.sourceSheet,
    });
  });
};

const autoLinkImportsToRows = (rows: TakeRateMappingRow[], availableImports: string[]) => {
  const ownership = new Map<string, string>();
  rows.forEach((row) => {
    row.linkedImports.forEach((item) => ownership.set(item, row.id));
  });

  const nextRows = rows.map((row) => ({ ...row, linkedImports: [...row.linkedImports] }));
  const byId = new Map(nextRows.map((row) => [row.id, row]));

  availableImports.forEach((importLabel) => {
    if (ownership.has(importLabel)) return;

    let bestRow: TakeRateMappingRow | null = null;
    let bestScore = -1;
    nextRows.forEach((row) => {
      const score = scoreImportMatch(row.label || row.matchedMarginLabel || '', importLabel);
      if (score > bestScore) {
        bestScore = score;
        bestRow = row;
      }
    });

    if (!bestRow || bestScore < 135) return;
    const target = byId.get(bestRow.id);
    if (!target || target.linkedImports.includes(importLabel)) return;
    target.linkedImports.push(importLabel);
  });

  return nextRows;
};

const getRowStatus = (row: TakeRateMappingRow): RowStatus => {
  if (row.linkedImports.length === 0) return 'unlinked';
  if (!row.family.trim()) return 'review';
  return 'ok';
};

const statusMeta: Record<RowStatus, { label: string; pill: string; rowRing: string }> = {
  ok: {
    label: 'OK',
    pill: 'border-[#B9DEC9] bg-[#EAF7EF] text-[#1F7A4D]',
    rowRing: 'shadow-[inset_4px_0_0_#2E8D63]',
  },
  review: {
    label: 'À vérifier',
    pill: 'border-[#E5C27A] bg-[#FFF6DE] text-[#9A6A13]',
    rowRing: 'shadow-[inset_4px_0_0_#D79A1E]',
  },
  unlinked: {
    label: 'Non lié',
    pill: 'border-[#E5B4A8] bg-[#FCEEE8] text-[#B44E2E]',
    rowRing: 'shadow-[inset_4px_0_0_#C55D3D]',
  },
};

const TakeRatePage: React.FC<TakeRatePageProps> = ({ setView, prepImportsByMonth }) => {
  const [rows, setRows] = useState<TakeRateMappingRow[]>([]);
  const [searchByRow, setSearchByRow] = useState<Record<string, string>>({});
  const [openSearchRow, setOpenSearchRow] = useState<string | null>(null);
  const [openLinkedRow, setOpenLinkedRow] = useState<string | null>(null);
  const [marginCatalog, setMarginCatalog] = useState<MarginCatalogItem[]>([]);
  const [marginFileName, setMarginFileName] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [isImportingMargin, setIsImportingMargin] = useState(false);
  const [familyFilter, setFamilyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | RowStatus>('all');
  const [productSearch, setProductSearch] = useState('');
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [pendingImportsByRow, setPendingImportsByRow] = useState<Record<string, string[]>>({});
  const [didHydrateRows, setDidHydrateRows] = useState(false);
  const [didHydrateMargin, setDidHydrateMargin] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollInnerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const storageKeys = [ROWS_STORAGE_KEY, ...LEGACY_ROWS_STORAGE_KEYS];
      for (const key of storageKeys) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRows(parsed.map(normalizeRow));
          break;
        }
      }
    } catch (_error) {}
    finally {
      setDidHydrateRows(true);
    }
  }, []);

  useEffect(() => {
    const serialized = JSON.stringify(rows);
    localStorage.setItem(ROWS_STORAGE_KEY, serialized);
    LEGACY_ROWS_STORAGE_KEYS.forEach((key) => localStorage.setItem(key, serialized));
  }, [rows]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MARGIN_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setMarginCatalog(parsed as MarginCatalogItem[]);
      setMarginFileName(localStorage.getItem(MARGIN_FILE_NAME_STORAGE_KEY) ?? '');
    } catch (_error) {}
    finally {
      setDidHydrateMargin(true);
    }
  }, []);

  const availableImports = useMemo(() => {
    const unique = new Set<string>();
    MONTHS_DISPLAY_CONFIG.forEach(({ key }) => {
      extractImportLabels(prepImportsByMonth[key] ?? '').forEach((label) => unique.add(label));
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [prepImportsByMonth]);

  useEffect(() => {
    if (!didHydrateRows || !didHydrateMargin) return;
    if (rows.length > 0 || marginCatalog.length === 0) return;

    const rebuilt = autoLinkImportsToRows(generateRowsFromMarginCatalog(marginCatalog, []), availableImports);
    if (rebuilt.length > 0) {
      setRows(rebuilt);
      setImportMessage((prev) => prev || `Lignes reconstruites depuis le fichier marge : ${rebuilt.length}.`);
    }
  }, [didHydrateRows, didHydrateMargin, rows.length, marginCatalog, availableImports]);

  const familyOptions = useMemo(() => {
    const unique = new Set<string>();
    rows.forEach((row) => {
      const value = row.family.trim();
      if (value) unique.add(value);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalizedProductSearch = normalize(productSearch);

    return rows.filter((row) => {
      const rowStatus = getRowStatus(row);
      const familyValue = row.family.trim();

      const familyMatches =
        familyFilter === 'all'
          ? true
          : familyFilter === '__none__'
            ? familyValue === ''
            : familyValue === familyFilter;

      const statusMatches = statusFilter === 'all' ? true : rowStatus === statusFilter;
      const productMatches =
        !normalizedProductSearch ||
        normalize(row.label).includes(normalizedProductSearch) ||
        normalize(row.matchedMarginLabel ?? '').includes(normalizedProductSearch);

      return familyMatches && statusMatches && productMatches;
    });
  }, [rows, familyFilter, statusFilter, productSearch]);

  useEffect(() => {
    setSelectedRowIds((prev) => prev.filter((id) => rows.some((row) => row.id === id)));
  }, [rows]);

  useEffect(() => {
    setPendingImportsByRow((prev) => {
      const validIds = new Set(rows.map((row) => row.id));
      const next: Record<string, string[]> = {};
      Object.entries(prev).forEach(([rowId, items]) => {
        if (!validIds.has(rowId)) return;
        const row = rows.find((entry) => entry.id === rowId);
        const deduped = Array.from(new Set(items.filter((item) => item && !row?.linkedImports.includes(item))));
        if (deduped.length > 0) next[rowId] = deduped;
      });
      return next;
    });
  }, [rows]);

  useEffect(() => {
    const tableEl = tableScrollRef.current;
    const bottomEl = bottomScrollRef.current;
    const innerEl = bottomScrollInnerRef.current;
    if (!tableEl || !bottomEl || !innerEl) return;

    const syncInnerWidth = () => {
      innerEl.style.width = `${tableEl.scrollWidth}px`;
      bottomEl.scrollLeft = tableEl.scrollLeft;
    };

    syncInnerWidth();

    let syncingFromTable = false;
    let syncingFromBottom = false;

    const handleTableScroll = () => {
      if (syncingFromBottom) {
        syncingFromBottom = false;
        return;
      }
      syncingFromTable = true;
      bottomEl.scrollLeft = tableEl.scrollLeft;
    };

    const handleBottomScroll = () => {
      if (syncingFromTable) {
        syncingFromTable = false;
        return;
      }
      syncingFromBottom = true;
      tableEl.scrollLeft = bottomEl.scrollLeft;
    };

    tableEl.addEventListener('scroll', handleTableScroll);
    bottomEl.addEventListener('scroll', handleBottomScroll);
    window.addEventListener('resize', syncInnerWidth);

    return () => {
      tableEl.removeEventListener('scroll', handleTableScroll);
      bottomEl.removeEventListener('scroll', handleBottomScroll);
      window.removeEventListener('resize', syncInnerWidth);
    };
  }, [filteredRows.length, rows.length]);

  const addRow = () => setRows((prev) => [...prev, createEmptyRow()]);

  const toggleRowSelection = (rowId: string) => {
    setSelectedRowIds((prev) => (prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]));
  };

  const toggleSelectAllVisibleRows = () => {
    const visibleIds = filteredRows.map((row) => row.id);
    if (visibleIds.length === 0) return;

    setSelectedRowIds((prev) => {
      const allVisibleSelected = visibleIds.every((id) => prev.includes(id));
      if (allVisibleSelected) {
        return prev.filter((id) => !visibleIds.includes(id));
      }
      return Array.from(new Set([...prev, ...visibleIds]));
    });
  };

  const removeSelectedRows = () => {
    if (selectedRowIds.length === 0) return;
    const selectedSet = new Set(selectedRowIds);

    setRows((prev) => prev.filter((row) => !selectedSet.has(row.id)));
    setSelectedRowIds([]);
    setSearchByRow((prev) => {
      const next = { ...prev };
      selectedSet.forEach((id) => delete next[id]);
      return next;
    });
    setPendingImportsByRow((prev) => {
      const next = { ...prev };
      selectedSet.forEach((id) => delete next[id]);
      return next;
    });

    if (openSearchRow && selectedSet.has(openSearchRow)) setOpenSearchRow(null);
    if (openLinkedRow && selectedSet.has(openLinkedRow)) setOpenLinkedRow(null);
  };

  const queueImportForRow = (rowId: string, importLabel: string) => {
    setPendingImportsByRow((prev) => {
      const current = prev[rowId] ?? [];
      if (current.includes(importLabel)) return prev;
      return { ...prev, [rowId]: [...current, importLabel] };
    });
    setOpenSearchRow(rowId);
  };

  const removePendingImportFromRow = (rowId: string, importLabel: string) => {
    setPendingImportsByRow((prev) => {
      const current = (prev[rowId] ?? []).filter((item) => item !== importLabel);
      if (current.length === 0) {
        const next = { ...prev };
        delete next[rowId];
        return next;
      }
      return { ...prev, [rowId]: current };
    });
  };

  const validatePendingImportsForRow = (rowId: string) => {
    const pending = pendingImportsByRow[rowId] ?? [];
    if (pending.length === 0) return;

    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, linkedImports: Array.from(new Set([...row.linkedImports, ...pending])) } : row))
    );
    setPendingImportsByRow((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
    setOpenLinkedRow(rowId);
  };

  const updateRow = (rowId: string, patch: Partial<TakeRateMappingRow>) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const next = normalizeRow({ ...row, ...patch });
        if ('costHt' in patch || 'sellPriceHt' in patch || 'marginPercent' in patch || 'marginEuro' in patch) {
          next.marginSource = 'manual';
        }
        return next;
      })
    );
  };

  const removeRow = (rowId: string) => {
    setRows((prev) => prev.filter((row) => row.id !== rowId));
    setSearchByRow((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
    setPendingImportsByRow((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
    if (openSearchRow === rowId) setOpenSearchRow(null);
    if (openLinkedRow === rowId) setOpenLinkedRow(null);
  };

  const addImportToRow = (rowId: string, importLabel: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) {
          return row.linkedImports.includes(importLabel)
            ? { ...row, linkedImports: row.linkedImports.filter((item) => item !== importLabel) }
            : row;
        }
        if (row.linkedImports.includes(importLabel)) return row;
        return { ...row, linkedImports: [...row.linkedImports, importLabel] };
      })
    );
  };

  const removeImportFromRow = (rowId: string, importLabel: string) => {
    setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, linkedImports: row.linkedImports.filter((item) => item !== importLabel) } : row)));
  };

  const filteredImportsByRow = useMemo(() => {
    const result: Record<string, string[]> = {};
    rows.forEach((row) => {
      const query = normalize(searchByRow[row.id] ?? '');
      const pending = pendingImportsByRow[row.id] ?? [];
      const base = availableImports.filter((item) => !row.linkedImports.includes(item) && !pending.includes(item));
      result[row.id] = query ? base.filter((item) => normalize(item).includes(query)).slice(0, 60) : base.slice(0, 30);
    });
    return result;
  }, [availableImports, rows, searchByRow, pendingImportsByRow]);

  const handleImportMarginFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImportingMargin(true);
    setImportMessage('');

    try {
      const catalog = await buildMarginCatalogFromWorkbook(file);
      setMarginCatalog(catalog);
      setMarginFileName(file.name);
      if (catalog.length === 0) {
        setRows([]);
        setImportMessage('0 produit marge détecté. Vérifie la structure du fichier.');
        localStorage.removeItem(MARGIN_STORAGE_KEY);
        localStorage.removeItem(MARGIN_FILE_NAME_STORAGE_KEY);
        return;
      }
      localStorage.setItem(MARGIN_STORAGE_KEY, JSON.stringify(catalog));
      localStorage.setItem(MARGIN_FILE_NAME_STORAGE_KEY, file.name);

      setRows((prev) => {
        const generated = generateRowsFromMarginCatalog(catalog, prev);
        const linked = autoLinkImportsToRows(generated, availableImports);
        const autoLinks = linked.reduce((sum, row) => sum + row.linkedImports.length, 0);
        const sectionCount = new Set(catalog.map((item) => item.section.trim()).filter(Boolean)).size;
        setImportMessage(`${catalog.length} produits marge générés • ${sectionCount} sections détectées • ${autoLinks} liens import détectés.`);
        return linked;
      });
    } catch (_error) {
      setImportMessage('Import marge impossible. Vérifie le fichier ou la librairie xlsx.');
    } finally {
      setIsImportingMargin(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleDeleteMarginImport = () => {
    setMarginCatalog([]);
    setMarginFileName('');
    localStorage.removeItem(MARGIN_STORAGE_KEY);
    localStorage.removeItem(MARGIN_FILE_NAME_STORAGE_KEY);
    setRows([]);
    setSearchByRow({});
    setOpenSearchRow(null);
    setOpenLinkedRow(null);
    setPendingImportsByRow({});
    setSelectedRowIds([]);
    setImportMessage('Import marge supprimé. Tu peux réimporter le fichier.');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };


  const autoLinkAllImports = () => {
    setRows((prev) => {
      const linked = autoLinkImportsToRows(prev, availableImports);
      const totalLinks = linked.reduce((sum, row) => sum + row.linkedImports.length, 0);
      setImportMessage(`${totalLinks} liens import actuellement détectés.`);
      return linked;
    });
  };

  const visibleRowIds = filteredRows.map((row) => row.id);
  const visibleSelectedCount = visibleRowIds.filter((id) => selectedRowIds.includes(id)).length;
  const allVisibleRowsSelected = visibleRowIds.length > 0 && visibleSelectedCount === visibleRowIds.length;
  const linkedCount = rows.reduce((sum, row) => sum + row.linkedImports.length, 0);
  const okCount = rows.filter((row) => getRowStatus(row) === 'ok').length;
  const reviewCount = rows.filter((row) => getRowStatus(row) === 'review').length;
  const withoutLinkCount = rows.filter((row) => getRowStatus(row) === 'unlinked').length;

  return (
    <div className="flex h-full min-h-screen bg-[#EDE2D6] text-[#4B2D22]">
      <aside className="hidden w-[250px] shrink-0 border-r border-[#D2B8A1] bg-[linear-gradient(180deg,#F4E8DC_0%,#E9D8C8_100%)] px-4 py-5 xl:flex xl:flex-col xl:gap-4">
        <div className="overflow-hidden rounded-[26px] border border-[#2E8D63] bg-[linear-gradient(180deg,#39B37D_0%,#239062_100%)] shadow-[0_10px_20px_rgba(30,96,68,0.18)]">
          <div className="h-1.5 bg-gradient-to-r from-[#D4F3E4] via-[#8AE0B9] to-[#239062]" />
          <div className="p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#E7FFF3]">Paramétrage</p>
            <h1 className="mt-2 text-[21px] font-black leading-none text-white xl:text-[23px]">
              Taux
              <br />
              de prise
            </h1>
          </div>
        </div>

        <button
          onClick={() => setView('stats')}
          className="rounded-[22px] border border-[#D9A72B] bg-[linear-gradient(180deg,#F3C63D_0%,#E3A91F_100%)] px-4 py-3.5 text-center text-[13px] font-black uppercase tracking-[0.12em] text-[#4D2B18] shadow-[0_4px_0_#B8810F] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#B8810F]"
        >
          Retour paramètres
        </button>

        <button
          onClick={() => setView('take_rate_sheet')}
          className="rounded-[22px] border border-[#B69034] bg-[linear-gradient(180deg,#E5B548_0%,#CC9530_100%)] px-4 py-3.5 text-center text-[13px] font-black uppercase tracking-[0.12em] text-[#4D2B18] shadow-[0_4px_0_#9A691B] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#9A691B]"
        >
          Voir la feuille
        </button>

        <div className="rounded-[22px] border border-[#D7BFAB] bg-[#FFF8F1] px-4 py-4 shadow-[0_8px_18px_rgba(96,56,34,0.08)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#93644D]">Résumé</p>
          <div className="mt-3 space-y-2 text-[13px] font-semibold text-[#6E4736]">
            <div className="flex items-center justify-between gap-3"><span>Produits</span><span>{rows.length}</span></div>
            <div className="flex items-center justify-between gap-3"><span>Liens import</span><span>{linkedCount}</span></div>
            <div className="flex items-center justify-between gap-3"><span>OK</span><span>{okCount}</span></div>
            <div className="flex items-center justify-between gap-3"><span>À vérifier</span><span>{reviewCount}</span></div>
            <div className="flex items-center justify-between gap-3"><span>Non liés</span><span>{withoutLinkCount}</span></div>
            <div className="flex items-center justify-between gap-3"><span>Réfs marge</span><span>{marginCatalog.length}</span></div>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden p-4 pb-20 xl:p-5 xl:pb-24">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-[#D8BEA8] bg-[#FFF8F1] shadow-[0_18px_40px_rgba(104,63,39,0.10)]">
          <div className="border-b border-[#E6D4C4] bg-[linear-gradient(180deg,#FBF4EC_0%,#F5EADD_100%)] px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.20em] text-[#8F624B]">Base marge + liaison ventes</p>
                <h2 className="mt-1 text-[21px] font-black text-[#582F21]">Paramétrage taux de prise</h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportMarginFile} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-[16px] border border-[#B55A3C] bg-[#F7E8DE] px-4 py-2.5 text-[12px] font-black uppercase tracking-[0.08em] text-[#8D4F35] transition hover:bg-[#F2DDCF]"
                >
                  {isImportingMargin ? 'Import...' : 'Importer fichier marge'}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteMarginImport}
                  disabled={marginCatalog.length === 0 && rows.length === 0 && !marginFileName}
                  className="rounded-[16px] border border-[#D7BEA9] bg-[#FFF7F1] px-4 py-2.5 text-[12px] font-black uppercase tracking-[0.08em] text-[#9A6149] transition hover:bg-[#F7EBDD] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Supprimer import marge
                </button>
                <button
                  type="button"
                  onClick={autoLinkAllImports}
                  className="rounded-[16px] border border-[#D2B39C] bg-[#F8EDE1] px-4 py-2.5 text-[12px] font-black uppercase tracking-[0.08em] text-[#7F563F] transition hover:bg-[#F2E2D0]"
                >
                  Auto-lier imports
                </button>
                <button
                  onClick={addRow}
                  className="rounded-[16px] border border-[#2E8D63] bg-[linear-gradient(180deg,#39B37D_0%,#239062_100%)] px-4 py-2.5 text-[12px] font-black uppercase tracking-[0.08em] text-white shadow-[0_4px_0_#196A48] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#196A48]"
                >
                  Ajouter une ligne
                </button>
                <button
                  type="button"
                  onClick={toggleSelectAllVisibleRows}
                  className="rounded-[16px] border border-[#D2B39C] bg-[#F8EDE1] px-4 py-2.5 text-[12px] font-black uppercase tracking-[0.08em] text-[#7F563F] transition hover:bg-[#F2E2D0]"
                >
                  {allVisibleRowsSelected ? 'Désélectionner visibles' : 'Sélectionner visibles'}
                </button>
                <button
                  type="button"
                  onClick={removeSelectedRows}
                  disabled={selectedRowIds.length === 0}
                  className="rounded-[16px] border border-[#C16A48] bg-[#FCEEE7] px-4 py-2.5 text-[12px] font-black uppercase tracking-[0.08em] text-[#A24E30] transition hover:bg-[#F9E2D6] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Supprimer sélection
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] font-semibold text-[#7A5240]">
              <span>{marginFileName ? `Fichier marge : ${marginFileName}` : 'Aucun fichier marge chargé'}</span>
              {importMessage ? <span className="text-[#9A4F33]">• {importMessage}</span> : null}
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="min-w-[280px] flex-1">
                <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.08em] text-[#8A604B]">Recherche produit</span>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Rechercher un produit marge..."
                  className="w-full rounded-[14px] border border-[#D7BEA9] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#4F2E22] outline-none transition focus:border-[#B55A3C] focus:ring-2 focus:ring-[#E8B59E]"
                />
              </label>

              <label className="min-w-[180px]">
                <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.08em] text-[#8A604B]">Famille</span>
                <select
                  value={familyFilter}
                  onChange={(e) => setFamilyFilter(e.target.value)}
                  className="w-full rounded-[14px] border border-[#D7BEA9] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#4F2E22] outline-none transition focus:border-[#B55A3C] focus:ring-2 focus:ring-[#E8B59E]"
                >
                  <option value="all">Toutes</option>
                  <option value="__none__">Sans famille</option>
                  {familyOptions.map((family) => (
                    <option key={family} value={family}>{family}</option>
                  ))}
                </select>
              </label>

              <label className="min-w-[180px]">
                <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.08em] text-[#8A604B]">État</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | RowStatus)}
                  className="w-full rounded-[14px] border border-[#D7BEA9] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#4F2E22] outline-none transition focus:border-[#B55A3C] focus:ring-2 focus:ring-[#E8B59E]"
                >
                  <option value="all">Tous</option>
                  <option value="ok">OK</option>
                  <option value="review">À vérifier</option>
                  <option value="unlinked">Non liés</option>
                </select>
              </label>

              <div className="pb-1 text-[12px] font-semibold text-[#7A5240]">
                {filteredRows.length} ligne{filteredRows.length > 1 ? 's' : ''} affichée{filteredRows.length > 1 ? 's' : ''}
                {visibleSelectedCount > 0 ? ` • ${visibleSelectedCount} sélectionnée${visibleSelectedCount > 1 ? 's' : ''}` : ''}
              </div>
            </div>
          </div>

          <div ref={tableScrollRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#F7F0E7]">
            <table className="w-full min-w-[1660px] table-fixed border-separate border-spacing-0">
              <colgroup>
                <col className="w-[4%]" />
                <col className="w-[8%]" />
                <col className="w-[18%]" />
                <col className="w-[11%]" />
                <col className="w-[23%]" />
                <col className="w-[22%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[6%]" />
                <col className="w-[6%]" />
                <col className="w-[4%]" />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#EADACA] text-[#71402D]">
                  <th className="border-b border-[#DCC2AB] px-2 py-4 text-center text-[12px] font-black uppercase tracking-[0.07em]">
                    <input
                      type="checkbox"
                      checked={allVisibleRowsSelected}
                      onChange={toggleSelectAllVisibleRows}
                      aria-label="Sélectionner toutes les lignes visibles"
                      className="h-4 w-4 rounded border-[#B98D76] text-[#A24E30] focus:ring-[#D9A58F]"
                    />
                  </th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">État</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Produit marge</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Famille</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Recherche import</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Produits liés</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">CM HT</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">PV HT</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Marge €</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Marge %</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-center text-[12px] font-black uppercase tracking-[0.07em]">Suppr.</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-10 text-center text-[14px] font-semibold text-[#8B6650]">
                      Aucune ligne pour ce filtre.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, rowIndex) => {
                    const searchValue = searchByRow[row.id] ?? '';
                    const suggestions = filteredImportsByRow[row.id] ?? [];
                    const pendingImports = pendingImportsByRow[row.id] ?? [];
                    const isSearchOpen = openSearchRow === row.id;
                    const isLinkedOpen = openLinkedRow === row.id;
                    const status = getRowStatus(row);
                    const meta = statusMeta[status];

                    return (
                      <tr key={row.id} className={`${rowIndex % 2 === 0 ? 'bg-[#FFF9F2]' : 'bg-[#FCF4EB]'} ${meta.rowRing}`}>
                        <td className="border-b border-[#E8D8C8] px-2 py-3 align-top text-center">
                          <input
                            type="checkbox"
                            checked={selectedRowIds.includes(row.id)}
                            onChange={() => toggleRowSelection(row.id)}
                            aria-label={`Sélectionner ${row.label || 'la ligne'}`}
                            className="mt-1 h-4 w-4 rounded border-[#B98D76] text-[#A24E30] focus:ring-[#D9A58F]"
                          />
                        </td>
                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <div className="space-y-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${meta.pill}`}>
                              {meta.label}
                            </span>
                            <div className="text-[11px] font-semibold text-[#8A604B]">
                              {row.linkedImports.length} lien{row.linkedImports.length > 1 ? 's' : ''}
                            </div>
                          </div>
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={row.label}
                              onChange={(e) => updateRow(row.id, { label: e.target.value })}
                              placeholder="Ex. Steak au poivre"
                              className="w-full rounded-[14px] border border-[#D7BEA9] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#4F2E22] outline-none transition focus:border-[#B55A3C] focus:ring-2 focus:ring-[#E8B59E]"
                            />
                            {row.matchedMarginLabel ? (
                              <div className="rounded-[12px] border border-[#D7BEA9] bg-[#FAF1E7] px-2.5 py-2 text-[11px] font-semibold text-[#7A5240]">
                                Base marge : {row.matchedMarginLabel}
                                {row.matchedMarginSheet ? ` • ${row.matchedMarginSheet}` : ''}
                              </div>
                            ) : null}
                          </div>
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <input
                            type="text"
                            value={row.family}
                            onChange={(e) => updateRow(row.id, { family: e.target.value })}
                            placeholder="Ex. Dessert"
                            className="w-full rounded-[14px] border border-[#D7BEA9] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#4F2E22] outline-none transition focus:border-[#B55A3C] focus:ring-2 focus:ring-[#E8B59E]"
                          />
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setOpenSearchRow((prev) => (prev === row.id ? null : row.id))}
                                className="rounded-[12px] border border-[#B55A3C] bg-[#F7E8DE] px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#8D4F35] transition hover:bg-[#F2DDCF]"
                              >
                                Rechercher
                              </button>
                              <input
                                type="text"
                                value={searchValue}
                                onChange={(e) => {
                                  setSearchByRow((prev) => ({ ...prev, [row.id]: e.target.value }));
                                  setOpenSearchRow(row.id);
                                }}
                                placeholder="Nom import..."
                                className="min-w-0 flex-1 rounded-[12px] border border-[#D7BEA9] bg-white px-3 py-2 text-[12px] font-medium text-[#4F2E22] outline-none transition focus:border-[#B55A3C] focus:ring-2 focus:ring-[#E8B59E]"
                              />
                            </div>

                            {pendingImports.length > 0 && (
                              <div className="space-y-2 rounded-[16px] border border-[#E1CDBD] bg-[#FFF6EE] p-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-black uppercase tracking-[0.07em] text-[#8D4F35]">Sélection en attente</span>
                                  <button
                                    type="button"
                                    onClick={() => validatePendingImportsForRow(row.id)}
                                    className="rounded-[10px] border border-[#2E8D63] bg-[linear-gradient(180deg,#39B37D_0%,#239062_100%)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.06em] text-white"
                                  >
                                    Valider les liens
                                  </button>
                                </div>
                                <div className="space-y-1.5">
                                  {pendingImports.map((item) => (
                                    <div key={item} className="flex items-center justify-between gap-2 rounded-[12px] border border-[#E8D8C8] bg-white px-3 py-2">
                                      <span className="text-[12px] font-semibold text-[#5B3728]">{item}</span>
                                      <button
                                        type="button"
                                        onClick={() => removePendingImportFromRow(row.id, item)}
                                        className="rounded-[10px] border border-[#E6B9A5] bg-[#FCEEE7] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.05em] text-[#A24E30] transition hover:bg-[#F9E2D6]"
                                      >
                                        Retirer
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {isSearchOpen && (
                              <div className="max-h-44 overflow-auto rounded-[16px] border border-[#DCC5B1] bg-[#FFFDF9] p-2 shadow-[0_12px_24px_rgba(87,52,33,0.10)]">
                                {suggestions.length > 0 ? (
                                  <div className="space-y-1.5">
                                    {suggestions.map((item) => (
                                      <button
                                        key={item}
                                        type="button"
                                        onClick={() => queueImportForRow(row.id, item)}
                                        className="flex w-full items-center justify-between rounded-[12px] border border-[#E8D8C8] bg-white px-3 py-2 text-left text-[12px] font-semibold text-[#5B3728] transition hover:border-[#B55A3C] hover:bg-[#FFF4EC]"
                                      >
                                        <span className="pr-3">{item}</span>
                                        <span className="text-[10px] font-black uppercase tracking-[0.06em] text-[#A15839]">Ajouter</span>
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="px-2 py-3 text-[12px] font-medium text-[#8B6650]">Aucun résultat.</div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => setOpenLinkedRow((prev) => (prev === row.id ? null : row.id))}
                              className="rounded-[12px] border border-[#D2B39C] bg-[#F8EDE1] px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#7F563F] transition hover:bg-[#F2E2D0]"
                            >
                              {row.linkedImports.length} lié{row.linkedImports.length > 1 ? 's' : ''}
                            </button>

                            {isLinkedOpen && (
                              <div className="space-y-1.5 rounded-[16px] border border-[#DCC5B1] bg-[#FFFDF9] p-2 shadow-[0_12px_24px_rgba(87,52,33,0.10)]">
                                {row.linkedImports.length > 0 ? (
                                  row.linkedImports.map((item) => (
                                    <div key={item} className="flex items-center justify-between gap-2 rounded-[12px] border border-[#E8D8C8] bg-white px-3 py-2">
                                      <span className="text-[12px] font-semibold text-[#5B3728]">{item}</span>
                                      <button
                                        type="button"
                                        onClick={() => removeImportFromRow(row.id, item)}
                                        className="rounded-[10px] border border-[#E6B9A5] bg-[#FCEEE7] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.05em] text-[#A24E30] transition hover:bg-[#F9E2D6]"
                                      >
                                        Retirer
                                      </button>
                                    </div>
                                  ))
                                ) : (
                                  <div className="px-2 py-3 text-[12px] font-medium text-[#8B6650]">Aucun produit lié.</div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <input
                            type="text"
                            value={row.costHt ?? ''}
                            onChange={(e) => updateRow(row.id, { costHt: e.target.value })}
                            placeholder="0,00"
                            className="w-full rounded-[14px] border border-[#D7BEA9] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#4F2E22] outline-none transition focus:border-[#B55A3C] focus:ring-2 focus:ring-[#E8B59E]"
                          />
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <input
                            type="text"
                            value={row.sellPriceHt ?? ''}
                            onChange={(e) => updateRow(row.id, { sellPriceHt: e.target.value })}
                            placeholder="0,00"
                            className="w-full rounded-[14px] border border-[#D7BEA9] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#4F2E22] outline-none transition focus:border-[#B55A3C] focus:ring-2 focus:ring-[#E8B59E]"
                          />
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <input
                            type="text"
                            value={row.marginEuro ?? ''}
                            onChange={(e) => updateRow(row.id, { marginEuro: e.target.value })}
                            placeholder="0,00"
                            className="w-full rounded-[14px] border border-[#D7BEA9] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#4F2E22] outline-none transition focus:border-[#B55A3C] focus:ring-2 focus:ring-[#E8B59E]"
                          />
                        </td>

                        <td className="border-b border-[#E8D8C8] px-3 py-3 align-top">
                          <input
                            type="text"
                            value={row.marginPercent ?? ''}
                            onChange={(e) => updateRow(row.id, { marginPercent: e.target.value })}
                            placeholder="0,0"
                            className="w-full rounded-[14px] border border-[#D7BEA9] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#4F2E22] outline-none transition focus:border-[#B55A3C] focus:ring-2 focus:ring-[#E8B59E]"
                          />
                        </td>

                        <td className="border-b border-[#E8D8C8] px-2 py-3 align-top">
                          <button
                            type="button"
                            onClick={() => removeRow(row.id)}
                            className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#D8B39E] bg-[#F6E7DA] text-[#A5502F] transition hover:bg-[#EFDCC8]"
                            title="Supprimer la ligne"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.8" d="M6 6l12 12M18 6L6 18" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </section>

        <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-30 px-4 pb-3 xl:left-[19rem] xl:px-5">
          <div className="pointer-events-auto rounded-[16px] border border-[#D8BEA8] bg-[#FFF8F1]/95 shadow-[0_-8px_24px_rgba(104,63,39,0.12)] backdrop-blur">
            <div
              ref={bottomScrollRef}
              className="overflow-x-auto overflow-y-hidden rounded-[16px]"
            >
              <div ref={bottomScrollInnerRef} className="h-4" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TakeRatePage;
