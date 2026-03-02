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
// ✅ Indexation rapide d'un CSV (1 seule fois)
//
// Objectif : éviter de re-split/re-find le CSV pour chaque produit.
// On construit un index : nom normalisé (lower/trim) -> conso théorique (brut)
//
// NB : on indexe *toutes* les cellules texte d'une ligne (pas seulement une colonne)
// afin de conserver la logique historique "si une cellule de la ligne = searchName".
// -----------------------------------------------------------
export const buildConsoIndexFromCsv = (
  csvData: string | undefined
): { map: Map<string, number> } | null => {
  if (!csvData) return null;

  const rows = csvData
    .split('\n')
    .filter(r => r.trim())
    .map(r => r.split(','));

  if (rows.length < 2) return null;

  const header = rows[0].map(h => h.trim().toLowerCase());
  const consoIdx = header.indexOf('conso théorique qté');
  if (consoIdx === -1) return null;

  const map = new Map<string, number>();

  // On parcourt toutes les lignes (hors header)
  for (const row of rows.slice(1)) {
    const raw = row[consoIdx];
    if (!raw) continue;
    const rawVal = parseFloat(String(raw).replace(/[^\d.-]/g, ''));
    const v = isNaN(rawVal) ? 0 : rawVal;

    // Index : chaque cellule texte de la ligne -> valeur conso
    for (const cell of row) {
      const key = String(cell ?? '').trim().toLowerCase();
      if (!key) continue;
      // ignore les valeurs purement numériques
      if (!isNaN(Number(key))) continue;
      // garde-fou: évite les clés trop courtes (bruit)
      if (key.length < 2) continue;
      if (!map.has(key)) map.set(key, v);
    }
  }

  return { map };
};

// Lookup dans l'index (applique le diviseur si demandé)
export const getImportedValueFromIndex = (
  index: { map: Map<string, number> } | null,
  searchName: string,
  importDivisor?: number | string
): number | null => {
  if (!index) return null;
  const key = String(searchName ?? '').trim().toLowerCase();
  if (!key) return null;
  const raw = index.map.get(key);
  if (raw == null) return null;

  const div = Number(importDivisor);
  if (div && div > 0) return Math.ceil(raw / div);
  return Math.round(raw);
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
