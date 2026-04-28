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
  if (valueIdx === -1) return null;

  const normalizedSearch = searchName.trim().toLowerCase();
  const targetRow = rows.find((row) =>
    row.some((cell) => cell.trim().toLowerCase() === normalizedSearch)
  );

  if (!targetRow || !targetRow[valueIdx]) return null;

  const rawVal = parseFloat(String(targetRow[valueIdx]).replace(/[^\d,.-]/g, '').replace(',', '.'));
  const v = Number.isNaN(rawVal) ? 0 : rawVal;
  const div = importDivisor === '' || importDivisor === undefined ? 0 : Number(importDivisor);

  if (div && div > 0) return Math.ceil(v / div);
  return Math.round(v);
};

export const buildImportedValueLookup = (
  csvData: string | undefined,
  valueColumnCandidates: string[] = ['conso thÃ©orique qtÃ©']
): Map<string, number> => {
  const lookup = new Map<string, number>();
  if (!csvData) return lookup;

  const rows = parseCSV(csvData);
  if (rows.length < 2) return lookup;

  const header = rows[0].map((h) => h.trim());
  const valueIdx = findHeaderIndex(header, valueColumnCandidates);
  if (valueIdx === -1) return lookup;

  rows.slice(1).forEach((row) => {
    const rawVal = parseFloat(String(row[valueIdx] || '').replace(/[^\d,.-]/g, '').replace(',', '.'));
    const value = Number.isNaN(rawVal) ? 0 : Math.round(rawVal);

    row.forEach((cell) => {
      const normalized = cell.trim().toLowerCase();
      if (normalized && !lookup.has(normalized)) lookup.set(normalized, value);
    });
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
