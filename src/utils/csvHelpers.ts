// =============================================================
// utils/csvHelpers.ts
// Fonctions de lecture/parsing des fichiers CSV importes
// =============================================================

import Papa from 'papaparse';

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

  const normalizedSearch = normalizeText(searchName);
  let hasMatch = false;
  const total = rows.slice(1).reduce((sum, row) => {
    const isMatch = nameIdx >= 0
      ? normalizeText(String(row[nameIdx] || '')) === normalizedSearch
      : row.some((cell) => normalizeText(cell) === normalizedSearch);

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
  const normalizedSearch = normalizeText(searchName);

  return rows.slice(1).some((row) => (
    nameIdx >= 0
      ? normalizeText(String(row[nameIdx] || '')) === normalizedSearch
      : row.some((cell) => normalizeText(cell) === normalizedSearch)
  ));
};

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
  return new Promise((resolve, reject) => {
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      import('xlsx').then(XLSX => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = e.target?.result;
            if (!data) { reject(new Error('Fichier vide')); return; }
            const wb = XLSX.read(data, { type: 'array' });
            const csvText = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
            resolve(csvText);
          } catch (err) {
            reject(new Error('Impossible de lire le fichier Excel : ' + (err as Error).message));
          }
        };
        reader.onerror = () => reject(new Error('Erreur de lecture du fichier Excel'));
        reader.readAsArrayBuffer(file);
      });
      return;
    }

    Papa.parse<string[]>(file, {
      download: false,
      skipEmptyLines: true,
      complete: (results) => {
        const cleanCSV = Papa.unparse((results.data as unknown as string[][]) ?? []);
        resolve(cleanCSV);
      },
      error: (err) => {
        reject(new Error('Impossible de lire le fichier CSV : ' + err.message));
      },
    });
  });
};
