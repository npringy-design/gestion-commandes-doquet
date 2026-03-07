// =============================================================
// utils/csvHelpers.ts
// Fonctions de lecture/parsing des fichiers CSV importés
//
// ✅ Utilise PapaParse pour un parsing robuste :
//    - Gère les virgules à l'intérieur des valeurs (ex: "Bœuf, haché")
//    - Gère les sauts de ligne Windows (\r\n) automatiquement
//    - Gère les encodages spéciaux (accents, caractères UTF-8)
//    - Détecte automatiquement le délimiteur (, ; \t)
// =============================================================

import Papa from 'papaparse';

// -----------------------------------------------------------
// parseCSV
// Fonction interne : parse un CSV en tableau de lignes/colonnes
// via PapaParse. Remplace les anciens split('\n') + split(',')
// -----------------------------------------------------------
const parseCSV = (csvData: string): string[][] => {
  const result = Papa.parse<string[]>(csvData, {
    // Détection automatique du délimiteur (, ; tabulation...)
    delimiter:      '',
    // Gère \r\n Windows et \n Unix sans configuration manuelle
    newline:        '',
    // Ne pas convertir automatiquement les nombres
    dynamicTyping:  false,
    // Ignore les lignes 100% vides
    skipEmptyLines: true,
  });

  return result.data;
};

// -----------------------------------------------------------
// getImportedValueForProduct
// Recherche la valeur "conso théorique qté" pour un produit
// dans un CSV exporté depuis le logiciel de caisse.
//
// @param csvData       - Contenu brut du CSV (string)
// @param searchName    - Nom du produit à chercher
// @param importDivisor - Diviseur optionnel (ex: kg → pièces)
// @returns             - Valeur numérique ou null si non trouvé
// -----------------------------------------------------------
export const getImportedValueForProduct = (
  csvData:        string | undefined,
  searchName:     string,
  importDivisor?: number | ''
): number | null => {
  if (!csvData) return null;

  const rows = parseCSV(csvData);
  if (rows.length < 2) return null;

  // Ligne d'en-têtes (première ligne)
  const header   = rows[0].map(h => h.trim().toLowerCase());
  const consoIdx = header.indexOf('conso théorique qté');
  if (consoIdx === -1) return null;

  // Cherche la ligne dont une cellule correspond au nom du produit
  const targetRow = rows.find(row =>
    row.some(cell => cell.trim().toLowerCase() === searchName.toLowerCase())
  );

  if (targetRow && targetRow[consoIdx]) {
    const rawVal = parseFloat(targetRow[consoIdx].replace(/[^\d.-]/g, ''));
    const v      = isNaN(rawVal) ? 0 : rawVal;
    // toNumber() convertit '' en 0 proprement
    const div = importDivisor === '' || importDivisor === undefined ? 0 : Number(importDivisor);

    if (div && div > 0) {
      return Math.ceil(v / div);
    }
    return Math.round(v);
  }

  return null;
};

// -----------------------------------------------------------
// extractAllNamesFromCsvs
// Extrait tous les noms non-numériques de tous les CSV importés.
// Utilisé pour les suggestions de mapping produit.
// -----------------------------------------------------------
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

// -----------------------------------------------------------
// readFileAsCSV
// Lit un fichier (CSV, TXT ou XLSX) et retourne son contenu
// sous forme de string CSV propre.
//
// Remplace le FileReader manuel dans StatsPage.tsx :
// - CSV/TXT : PapaParse lit + normalise l'encodage automatiquement
// - XLSX    : xlsx convertit en CSV comme avant
//
// @param file - Le fichier uploadé par l'utilisateur
// @returns    - Promise<string> avec le contenu CSV
// -----------------------------------------------------------
export const readFileAsCSV = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {

    // Fichier Excel → on passe par xlsx pour convertir en CSV
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      import('xlsx').then(XLSX => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = e.target?.result;
            if (!data) { reject(new Error('Fichier vide')); return; }
            const wb      = XLSX.read(data, { type: 'array' });
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

    // Fichier CSV / TXT → PapaParse lit et détecte l'encodage tout seul
    Papa.parse(file, {
      download:       false,
      skipEmptyLines: true,
      encoding:       '',
      complete: (results) => {
        // Re-sérialise en CSV propre → normalise \r\n, guillemets, etc.
        const cleanCSV = Papa.unparse(results.data as string[][]);
        resolve(cleanCSV);
      },
      error: (err: { message: string }) => {
        reject(new Error('Impossible de lire le fichier CSV : ' + err.message));
      },
    });
  });
};
