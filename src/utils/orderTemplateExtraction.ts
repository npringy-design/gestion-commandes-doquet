// Lecture vision d'une trame de commande : types, validation des réponses et
// assemblage des pages. Module pur, sans import, partagé avec l'API serveur.
//
// Aucune correction sémantique n'est faite ici : une unité lue « ka » reste
// « ka ». Seuls les espaces sont compactés et les lignes sans article écartées ;
// tout doute est signalé à l'utilisateur plutôt que corrigé.

// Nombre maximal de pages analysées pour une trame (coût et durée de l'analyse).
export const ORDER_TEMPLATE_MAX_PAGES = 15;

export interface ColumnHint {
  code: string;
  article: string;
  storage_unit: string;
  packaging_unit: string;
}

export interface ExtractedRow {
  code: string;
  article: string;
  storage_unit: string;
  packaging_unit: string;
  uncertain: boolean;
}

export interface PageExtraction {
  has_table: boolean;
  columns: ColumnHint;
  visible_row_count: number;
  rows: ExtractedRow[];
}

// Résultat d'une page : une extraction, ou `null` si l'analyse a échoué.
export interface PageOutcome {
  pageNumber: number;
  extraction: PageExtraction | null;
}

export interface FinalizedRow {
  code: string;
  article: string;
  storageUnit: string;
  packagingUnit: string;
}

export interface ExtractionReport {
  pageCount: number;
  rowCount: number;
  declaredRowCount: number;
  flaggedRowCount: number;
  failedPages: number[];
  countMismatchPages: number[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isColumnHint = (value: unknown): value is ColumnHint =>
  isRecord(value)
  && typeof value.code === 'string'
  && typeof value.article === 'string'
  && typeof value.storage_unit === 'string'
  && typeof value.packaging_unit === 'string';

export const isExtractedRow = (value: unknown): value is ExtractedRow =>
  isRecord(value)
  && typeof value.code === 'string'
  && typeof value.article === 'string'
  && typeof value.storage_unit === 'string'
  && typeof value.packaging_unit === 'string'
  && typeof value.uncertain === 'boolean';

export const isPageExtraction = (value: unknown): value is PageExtraction =>
  isRecord(value)
  && typeof value.has_table === 'boolean'
  && isColumnHint(value.columns)
  && typeof value.visible_row_count === 'number'
  && Number.isInteger(value.visible_row_count)
  && value.visible_row_count >= 0
  && Array.isArray(value.rows)
  && value.rows.every(isExtractedRow);

const compactText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const normalizeKey = (value: string): string =>
  compactText(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Assemble les pages dans l'ordre. Retourne les lignes finales, les index des
// lignes à contrôler et un bilan chiffré.
export const finalizeExtraction = (pages: PageOutcome[]): {
  rows: FinalizedRow[];
  flaggedIndexes: number[];
  report: ExtractionReport;
} => {
  const rows: FinalizedRow[] = [];
  const flagged = new Set<number>();
  const seenKeys = new Set<string>();
  const failedPages: number[] = [];
  const countMismatchPages: number[] = [];
  let declaredRowCount = 0;

  [...pages].sort((a, b) => a.pageNumber - b.pageNumber).forEach(({ pageNumber, extraction }) => {
    if (!extraction) {
      failedPages.push(pageNumber);
      return;
    }

    declaredRowCount += extraction.visible_row_count;

    const pageRows = extraction.rows
      .map((row) => ({
        code: compactText(row.code),
        article: compactText(row.article),
        storageUnit: compactText(row.storage_unit),
        packagingUnit: compactText(row.packaging_unit),
        uncertain: row.uncertain,
      }))
      .filter((row) => row.article !== '');

    const countMismatch = pageRows.length !== extraction.visible_row_count;
    if (countMismatch) countMismatchPages.push(pageNumber);

    // Le dédoublonnage ne compare qu'aux pages précédentes : un même produit
    // répété sur deux pages (ligne coupée, en-tête repris) n'est gardé qu'une fois.
    const previousPagesKeys = new Set(seenKeys);
    pageRows.forEach((row) => {
      const key = `${normalizeKey(row.code)}|${normalizeKey(row.article)}`;
      if (previousPagesKeys.has(key)) return;
      seenKeys.add(key);

      if (row.uncertain || row.storageUnit === '' || row.packagingUnit === '' || countMismatch) {
        flagged.add(rows.length);
      }
      rows.push({
        code: row.code,
        article: row.article,
        storageUnit: row.storageUnit,
        packagingUnit: row.packagingUnit,
      });
    });
  });

  const flaggedIndexes = [...flagged].sort((a, b) => a - b);
  return {
    rows,
    flaggedIndexes,
    report: {
      pageCount: pages.length,
      rowCount: rows.length,
      declaredRowCount,
      flaggedRowCount: flaggedIndexes.length,
      failedPages: failedPages.sort((a, b) => a - b),
      countMismatchPages: countMismatchPages.sort((a, b) => a - b),
    },
  };
};

// Colonnes identifiées sur la page 1, transmises aux pages suivantes qui n'ont
// pas forcément d'en-tête. Undefined si aucune colonne n'a été reconnue.
export const columnHintFromExtraction = (extraction: PageExtraction | null): ColumnHint | undefined => {
  if (!extraction || !extraction.has_table) return undefined;
  const { columns } = extraction;
  const hasAnyColumn = columns.article !== '' || columns.storage_unit !== '' || columns.packaging_unit !== '';
  return hasAnyColumn ? columns : undefined;
};

export interface PageExtractionRequest {
  pageNumber: number;
  columnHint?: ColumnHint;
}

export interface RunPageExtractionsOptions {
  pageCount: number;
  // Analyse une page ; lève une erreur en cas d'échec.
  extractPage: (request: PageExtractionRequest) => Promise<PageExtraction>;
  // true pour une erreur qui rend inutile l'analyse des pages restantes
  // (session expirée, quota atteint).
  isFatalError?: (error: unknown) => boolean;
  shouldStop?: () => boolean;
  onPageDone?: (pageNumber: number, doneCount: number) => void;
  concurrency?: number;
}

// Page 1 d'abord (elle fournit les intitulés de colonnes), puis les pages
// suivantes en parallèle. Une page en échec n'empêche pas les autres.
export const runPageExtractions = async ({
  pageCount,
  extractPage,
  isFatalError = () => false,
  shouldStop = () => false,
  onPageDone,
  concurrency = 3,
}: RunPageExtractionsOptions): Promise<{ outcomes: PageOutcome[]; firstError: unknown }> => {
  const outcomes: PageOutcome[] = [];
  let firstError: unknown = null;
  let fatal = false;
  let doneCount = 0;

  const runPage = async (pageNumber: number, columnHint?: ColumnHint): Promise<PageExtraction | null> => {
    if (fatal || shouldStop()) {
      outcomes.push({ pageNumber, extraction: null });
      return null;
    }
    try {
      const extraction = await extractPage({ pageNumber, columnHint });
      outcomes.push({ pageNumber, extraction });
      return extraction;
    } catch (error) {
      if (firstError === null) firstError = error;
      if (isFatalError(error)) fatal = true;
      outcomes.push({ pageNumber, extraction: null });
      return null;
    } finally {
      doneCount += 1;
      onPageDone?.(pageNumber, doneCount);
    }
  };

  const firstExtraction = await runPage(1);
  const columnHint = columnHintFromExtraction(firstExtraction);

  const remaining = Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => index + 2);
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, remaining.length)) }, async () => {
    while (remaining.length > 0) {
      const pageNumber = remaining.shift();
      if (pageNumber === undefined) return;
      await runPage(pageNumber, columnHint);
    }
  });
  await Promise.all(workers);

  return { outcomes: outcomes.sort((a, b) => a.pageNumber - b.pageNumber), firstError };
};
