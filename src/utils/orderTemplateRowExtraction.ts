// Lignes de produits d'une trame, extraites des colonnes confirmées par
// l'utilisateur. Les valeurs sont recopiées telles quelles (espaces compactés) :
// aucune correction d'unité. Tout doute produit un signalement « à contrôler ».

import type { TableLayout } from './pdfTableLayout';
import {
  mapColumnsToReference,
  normalizeHeaderText,
  resolveBodyStart,
  type ColumnRole,
} from './orderTemplateColumnRoles';

export interface ImportedTemplateRow {
  code: string;
  article: string;
  storageUnit: string;
  packagingUnit: string;
  // Raisons du signalement ; vide si la ligne ne présente aucun doute.
  reasons: string[];
}

export interface ExtractedTemplate {
  rows: ImportedTemplateRow[];
  flaggedCount: number;
}

const compactText = (value: string): string => value.replace(/\s+/g, ' ').trim();

// Liste de référence volontairement simple : elle ne sert qu'à signaler une
// unité inattendue (« ka »), jamais à la corriger.
const REFERENCE_UNIT_WORDS = new Set([
  'kg', 'g', 'gr', 'l', 'litre', 'litres', 'ml', 'cl', 'au', 'aux', 'unite', 'unites', 'piece', 'pieces',
  'boite', 'carton', 'colis', 'sachet', 'sac', 'pot', 'seau', 'barquette', 'poche', 'plaque', 'plateau',
  'brique', 'bombe', 'bouteille', 'bidon', 'flacon', 'bocal', 'paquet', 'pack', 'lot', 'bac', 'tranche',
  'filet', 'botte', 'portion', 'plaquette', 'caisse', 'cagette', 'panier', 'tube', 'gourde', 'x',
]);

const singular = (word: string): string => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word);

export const isReferenceUnit = (value: string): boolean =>
  normalizeHeaderText(value)
    .split(' ')
    .filter(Boolean)
    .some((word) => REFERENCE_UNIT_WORDS.has(word) || REFERENCE_UNIT_WORDS.has(singular(word)));

export const extractTemplateRows = (
  layouts: TableLayout[],
  roles: ColumnRole[],
  headerTexts: string[],
): ExtractedTemplate => {
  const [reference] = layouts;
  if (!reference) return { rows: [], flaggedCount: 0 };

  const roleColumn = (role: ColumnRole): number => roles.indexOf(role);
  const referenceHeader = (role: ColumnRole): string => {
    const column = roleColumn(role);
    return column >= 0 ? normalizeHeaderText(headerTexts[column] ?? '') : '';
  };
  const headerArticle = referenceHeader('article');
  const headerStorage = referenceHeader('storageUnit');
  const headerPackaging = referenceHeader('packagingUnit');

  const rows: ImportedTemplateRow[] = [];

  layouts.forEach((layout, layoutIndex) => {
    // Les pages suivantes sont rattachées aux colonnes de la page de référence
    // par leur position horizontale.
    const referenceIndexes = layoutIndex === 0
      ? layout.columns.map((column) => column.index)
      : mapColumnsToReference(layout.columns, reference.columns);
    const pageRoles: ColumnRole[] = referenceIndexes.map((index) => (index >= 0 ? roles[index] ?? 'ignore' : 'ignore'));

    const columnOf = (role: ColumnRole): number => pageRoles.indexOf(role);
    const articleColumn = columnOf('article');
    const storageColumn = columnOf('storageUnit');
    const packagingColumn = columnOf('packagingUnit');
    const codeColumn = columnOf('code');
    if (articleColumn < 0) return;

    const cell = (row: string[], column: number): string => (column >= 0 ? compactText(row[column] ?? '') : '');

    const bodyStart = resolveBodyStart(layout);
    layout.rows.slice(bodyStart).forEach((row, offset) => {
      const rowIndex = bodyStart + offset;
      const article = cell(row, articleColumn);
      const storageUnit = cell(row, storageColumn);
      const packagingUnit = cell(row, packagingColumn);
      const code = cell(row, codeColumn);
      if (!article && !storageUnit && !packagingUnit && !code) return;

      // En-tête répété sur une page suivante : même texte que l'en-tête retenu.
      if (
        headerArticle !== ''
        && normalizeHeaderText(article) === headerArticle
        && (storageUnit === '' || normalizeHeaderText(storageUnit) === headerStorage)
        && (packagingUnit === '' || normalizeHeaderText(packagingUnit) === headerPackaging)
      ) {
        return;
      }

      // Doutes relevés à la lecture des cellules (OCR cellule par cellule).
      const reasons: string[] = [];
      [articleColumn, storageColumn, packagingColumn, codeColumn].forEach((column) => {
        if (column < 0) return;
        (layout.cellReasons?.[rowIndex]?.[column] ?? []).forEach((reason) => {
          if (!reasons.includes(reason)) reasons.push(reason);
        });
      });
      if (!article) reasons.push('article vide');
      if (!storageUnit) reasons.push('unité de stockage vide');
      else if (!isReferenceUnit(storageUnit)) reasons.push('unité de stockage inattendue');
      if (!packagingUnit) reasons.push('conditionnement vide');
      else if (!isReferenceUnit(packagingUnit)) reasons.push('conditionnement inattendu');

      rows.push({ code, article, storageUnit, packagingUnit, reasons });
    });
  });

  return { rows, flaggedCount: rows.filter((row) => row.reasons.length > 0).length };
};
