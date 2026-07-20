// =============================================================
// utils/csvHelpers.ts
// Fonctions de lecture/parsing des fichiers CSV importes
// =============================================================

import Papa from 'papaparse';
import { readSpreadsheetAsCsv } from './spreadsheetImportWorker';

const parseCSV = (csvData: string): string[][] => {
  const result = Papa.parse<string[]>(csvData, {
    dynamicTyping: false,
    skipEmptyLines: true,
  });

  return (result.data as unknown as string[][]) ?? [];
};

const normalizeText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Normalisation réservée aux liaisons explicites : contrairement au score
// approché, elle conserve le contenu des parenthèses et tous les nombres afin
// de ne jamais confondre deux variantes (10/20 pièces, 100/140 g, etc.).
const normalizeExactText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const WEAK_MATCH_TOKENS = new Set([
  'au', 'aux', 'a', 'l', 'le', 'la', 'les', 'de', 'du', 'des', 'd', 'et',
  'kg', 'g', 'gr', 'piece', 'pieces', 'carton', 'colis', 'sachet', 'sac',
  'bac', 'boite', 'x',
]);

const getStrongTokens = (value: string): string[] =>
  normalizeText(value)
    .split(' ')
    .filter((token) => token.length >= 3 && !WEAK_MATCH_TOKENS.has(token));

const getImportMatchScore = (searchName: string, importName: string): number => {
  const normalizedSearch = normalizeText(searchName);
  const normalizedImport = normalizeText(importName);
  if (!normalizedSearch || !normalizedImport) return 0;
  if (normalizedSearch === normalizedImport) return 1000;

  const searchTokens = getStrongTokens(searchName);
  const importTokens = getStrongTokens(importName);
  if (searchTokens.length < 2 || importTokens.length < 2) return 0;

  const importTokenSet = new Set(importTokens);
  const searchTokenSet = new Set(searchTokens);
  const common = Array.from(searchTokenSet).filter((token) => importTokenSet.has(token));
  const searchCoverage = common.length / searchTokenSet.size;
  const importCoverage = common.length / new Set(importTokens).size;

  if (common.length < 3) return 0;
  if (searchCoverage < 0.45 || importCoverage < 0.45) return 0;

  const lengthPenalty = Math.abs(searchTokens.length - importTokens.length) * 4;
  const substringBonus = normalizedSearch.includes(normalizedImport) || normalizedImport.includes(normalizedSearch) ? 25 : 0;
  return Math.round(common.length * 45 + searchCoverage * 55 + importCoverage * 45 + substringBonus - lengthPenalty);
};

const isConfidentImportMatch = (searchName: string, importName: string): boolean =>
  getImportMatchScore(searchName, importName) >= 135;

const findHeaderIndex = (header: string[], candidates: string[]) => {
  const normalizedCandidates = candidates.map(normalizeText);
  const normalizedHeader = header.map(normalizeText);
  const exactIndex = normalizedHeader.findIndex((cell) => normalizedCandidates.includes(cell));
  if (exactIndex !== -1) return exactIndex;

  return normalizedHeader.findIndex((cell) => (
    normalizedCandidates.some((candidate) => cell.includes(candidate))
  ));
};

const PRODUCT_NAME_COLUMN_CANDIDATES = [
  'libelle',
  'libelle produit',
  'libelle article',
  'designation',
  'produit',
  'article',
];

const DEFAULT_VALUE_COLUMN_CANDIDATES = [
  'conso theorique qte',
  'conso theorique qt',
  'conso theorique quantite',
  'consommation theorique qte',
  'consommation theorique qt',
  'consommation theorique quantite',
  'conso qte',
  'conso qt',
];

const parseNumber = (value: unknown) => {
  const rawValue = parseFloat(String(value || '').replace(/[^\d,.-]/g, '').replace(',', '.'));
  return Number.isNaN(rawValue) ? 0 : rawValue;
};

const roundImportedValue = (value: number) =>
  Math.round(value * 1000) / 1000;

export const getImportedValueForProduct = (
  csvData: string | undefined,
  searchName: string,
  importDivisor?: number | '',
  valueColumnCandidates: string[] = DEFAULT_VALUE_COLUMN_CANDIDATES,
  nameColumnCandidates: string[] = PRODUCT_NAME_COLUMN_CANDIDATES
): number | null => {
  if (!csvData || !searchName.trim()) return null;

  const rows = parseCSV(csvData);
  if (rows.length < 2) return null;

  const header = rows[0].map((h) => h.trim());
  const valueIdx = findHeaderIndex(header, valueColumnCandidates);
  const nameIdx = findHeaderIndex(header, nameColumnCandidates);
  if (valueIdx === -1) return null;

  // Une sélection effectuée dans la liste des produits importés enregistre le
  // libellé exact de la ligne. Dans ce cas, cette liaison manuelle doit primer
  // sur la recherche approchée, sinon des variantes proches (grammage, recette,
  // pourcentage...) seraient additionnées au produit choisi.
  const dataRows = rows.slice(1);
  const normalizedSearchName = normalizeExactText(searchName);
  const exactRows = nameIdx >= 0
    ? dataRows.filter((row) => normalizeExactText(String(row[nameIdx] || '')) === normalizedSearchName)
    : [];

  if (exactRows.length > 0) {
    const exactTotal = exactRows.reduce((sum, row) => sum + parseNumber(row[valueIdx]), 0);
    const div = importDivisor === '' || importDivisor === undefined ? 0 : Number(importDivisor);
    if (div && div > 0) return Math.ceil(exactTotal / div);
    return roundImportedValue(exactTotal);
  }

  let hasMatch = false;
  const total = dataRows.reduce((sum, row) => {
    const rowName = nameIdx >= 0 ? String(row[nameIdx] || '') : '';
    const isMatch = nameIdx >= 0
      ? isConfidentImportMatch(searchName, rowName)
      : row.some((cell) => isConfidentImportMatch(searchName, String(cell || '')));

    if (!isMatch || !row[valueIdx]) return sum;

    hasMatch = true;
    return sum + parseNumber(row[valueIdx]);
  }, 0);

  if (!hasMatch) return null;

  const div = importDivisor === '' || importDivisor === undefined ? 0 : Number(importDivisor);
  if (div && div > 0) return Math.ceil(total / div);
  return roundImportedValue(total);
};

export const hasImportedProductMatch = (
  csvData: string | undefined,
  searchName: string,
  nameColumnCandidates: string[] = PRODUCT_NAME_COLUMN_CANDIDATES
): boolean => {
  if (!csvData || !searchName.trim()) return false;

  const rows = parseCSV(csvData);
  if (rows.length < 2) return false;

  const header = rows[0].map((h) => h.trim());
  const nameIdx = findHeaderIndex(header, nameColumnCandidates);
  return rows.slice(1).some((row) => (
    nameIdx >= 0
      ? isConfidentImportMatch(searchName, String(row[nameIdx] || ''))
      : row.some((cell) => isConfidentImportMatch(searchName, String(cell || '')))
  ));
};

export const matchesImportedProductName = (searchName: string, importName: string): boolean =>
  isConfidentImportMatch(searchName, importName);

export const buildImportedValueLookup = (
  csvData: string | undefined,
  valueColumnCandidates: string[] = DEFAULT_VALUE_COLUMN_CANDIDATES,
  nameColumnCandidates: string[] = PRODUCT_NAME_COLUMN_CANDIDATES
): Map<string, number> => {
  const lookup = new Map<string, number>();
  if (!csvData) return lookup;

  const rows = parseCSV(csvData);
  if (rows.length < 2) return lookup;

  const header = rows[0].map((h) => h.trim());
  const valueIdx = findHeaderIndex(header, valueColumnCandidates);
  const nameIdx = findHeaderIndex(header, nameColumnCandidates);
  if (valueIdx === -1) return lookup;

  rows.slice(1).forEach((row) => {
    const value = parseNumber(row[valueIdx]);
    const nameCells = nameIdx >= 0 ? [row[nameIdx]] : row;

    nameCells.forEach((cell) => {
      const normalized = normalizeText(String(cell || ''));
      if (normalized) lookup.set(normalized, (lookup.get(normalized) || 0) + value);
    });
  });

  lookup.forEach((value, key) => {
    lookup.set(key, roundImportedValue(value));
  });

  return lookup;
};

export const extractAllNamesFromCsvs = (
  detailedInventory: Record<string, string>
): Set<string> => {
  const allNames = new Set<string>();

  Object.values(detailedInventory).forEach(csv => {
    if (!csv) return;

    const rows = parseCSV(csv);
    const header = rows[0]?.map((h) => h.trim()) ?? [];
    const nameIdx = findHeaderIndex(header, PRODUCT_NAME_COLUMN_CANDIDATES);

    rows.slice(1).forEach(row => {
      const cells = nameIdx >= 0 ? [row[nameIdx]] : row;
      cells.forEach(cell => {
        const val = String(cell || '').trim();
        if (val.length > 3 && isNaN(Number(val))) {
          allNames.add(val);
        }
      });
    });
  });

  return allNames;
};

export const readFileAsCSV = (file: File): Promise<string> => {
  if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
    return readSpreadsheetAsCsv(file);
  }

  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      download: false,
      worker: true,
      skipEmptyLines: true,
      complete: (results) => {
        const cleanCSV = Papa.unparse((results.data as unknown as string[][]) ?? []);
        resolve(cleanCSV);
      },
      error: () => reject(new Error('Impossible de lire ce fichier CSV. Vérifie qu’il n’est pas corrompu.')),
    });
  });
};
