// =============================================================
// utils/csvHelpers.ts
// Fonctions de lecture/parsing des fichiers CSV importés
// Extraites de App.tsx
//
// ⚠️  AMÉLIORATION PRÉVUE (priorité 2) :
//     Remplacer le parsing manuel par PapaParse pour mieux gérer
//     les virgules dans les valeurs, les encodages et les \r\n Windows.
// =============================================================

// -----------------------------------------------------------
// Recherche la valeur "conso théorique qté" pour un produit
// dans un CSV exporté depuis le logiciel de caisse.
//
// @param csvData       - Contenu brut du CSV (string)
// @param searchName    - Nom du produit à chercher
// @param importDivisor - Diviseur optionnel (ex: kg → pièces)
// @returns             - Valeur numérique ou null si non trouvé
// -----------------------------------------------------------
export const getImportedValueForProduct = (
  csvData:       string | undefined,
  searchName:    string,
  importDivisor?: number | string
): number | null => {
  if (!csvData) return null;

  // Découpe en lignes, filtre les lignes vides, puis en colonnes
  const rows = csvData
    .split('\n')
    .filter(r => r.trim())
    .map(r => r.split(','));

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
    const div    = Number(importDivisor);

    if (div && div > 0) {
      // Conversion (ex: kg → pièces) + arrondi au supérieur
      return Math.ceil(v / div);
    }

    return Math.round(v);
  }

  return null;
};

// -----------------------------------------------------------
// Extrait tous les noms de cellules non-numériques de tous
// les CSV importés. Utilisé pour afficher les suggestions
// de mapping produit.
//
// @param detailedInventory - Map mois → contenu CSV
// @returns                 - Ensemble de tous les noms trouvés
// -----------------------------------------------------------
export const extractAllNamesFromCsvs = (
  detailedInventory: Record<string, string>
): Set<string> => {
  const allNames = new Set<string>();

  (Object.values(detailedInventory) as string[]).forEach(csv => {
    if (!csv) return;

    const rows = csv
      .split('\n')
      .filter(r => r.trim())
      .map(r => r.split(','));

    // On ignore la ligne d'en-têtes (slice(1))
    rows.slice(1).forEach(row =>
      row.forEach(cell => {
        const val = cell.trim();
        // Garde seulement les chaînes de plus de 3 caractères non-numériques
        if (val.length > 3 && isNaN(Number(val))) {
          allNames.add(val);
        }
      })
    );
  });

  return allNames;
};
