// =============================================================
// utils/csvHelpers.ts
// Fonctions de lecture/parsing des fichiers CSV importés
// =============================================================

import Papa from 'papaparse';

const parseCSV = (csvData: string): string[][] => {
  const result = Papa.parse<string[]>(csvData, {
    dynamicTyping: false,
    skipEmptyLines: true,
  });

  return (result.data as unknown as string[][]) ?? [];
};

const normalizeHeader = (value: string) => value.trim().toLowerCase();

const findHeaderIndex = (header: string[], candidates: string[]) => {
  const normalizedCandidates = candidates.map(normalizeHeader);
  return header.findIndex((cell) => normalizedCandidates.includes(normalizeHeader(cell)));
};

const PRODUCT_NAME_COLUMN_CANDIDATES = [
  'libellÃ©',
  'libelle',
  'libellÃ© produit',
  'libelle produit',
  'libellÃ© article',
  'libelle article',
  'designation',
  'dÃ©signation',
  'produit',
  'article',
];

export const getImportedValueForProduct = (
  csvData: string | undefined,
  searchName: string,
  importDivisor?: number | '',
  valueColumnCandidates: string[] = ['conso théorique qté']
): number | null => {
  if (!csvData || !searchName.trim()) return null;

  const rows = parseCSV(csvData);
  if (rows.length < 2) return null;

  const header = rows[0].map((h) => h.trim());
  const valueIdx = findHeaderIndex(header, valueColumnCandidates);
  const nameIdx = findHeaderIndex(header, nameColumnCandidates);
  if (valueIdx === -1) return null;

  const normalizedSearch = searchName.trim().toLowerCase();
  let hasMatch = false;
  const total = rows.slice(1).reduce((sum, row) => {
    const isMatch = nameIdx >= 0
      ? String(row[nameIdx] || '').trim().toLowerCase() === normalizedSearch
      : row.some((cell) => cell.trim().toLowerCase() === normalizedSearch);
    if (!isMatch || !row[valueIdx]) return sum;

    hasMatch = true;
    const rawVal = parseFloat(String(row[valueIdx]).replace(/[^\d,.-]/g, '').replace(',', '.'));
    return sum + (Number.isNaN(rawVal) ? 0 : rawVal);
  }, 0);

  if (!hasMatch) return null;

  const div = importDivisor === '' || importDivisor === undefined ? 0 : Number(importDivisor);

  if (div && div > 0) return Math.ceil(total / div);
  return Math.round(total);
};

export const buildImportedValueLookup = (
  csvData: string | undefined,
  valueColumnCandidates: string[] = ['conso thÃ©orique qtÃ©'],
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
    const rawVal = parseFloat(String(row[valueIdx] || '').replace(/[^\d,.-]/g, '').replace(',', '.'));
    const value = Number.isNaN(rawVal) ? 0 : rawVal;

    const nameCells = nameIdx >= 0 ? [row[nameIdx]] : row;
    nameCells.forEach((cell) => {
      const normalized = String(cell || '').trim().toLowerCase();
      if (normalized) lookup.set(normalized, (lookup.get(normalized) || 0) + value);
    });
  });

  lookup.forEach((value, key) => {
    lookup.set(key, Math.round(value));
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

    rows.slice(1).forEach(row =>
      row.forEach(cell => {
        const val = cell.trim();
        if (val.length > 3 && isNaN(Number(val))) {
          allNames.add(val);
        }
      })
    );
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
