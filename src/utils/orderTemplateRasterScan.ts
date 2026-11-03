// Lecture d'une trame sans texte natif par quadrillage détecté SUR L'IMAGE puis
// OCR cellule par cellule. Les lignes et les colonnes sont exactes par
// construction ; chaque cellule est lue séparément, plusieurs fois si besoin.
//
// La session garde ses workers OCR entre la lecture de la page 1 (qui sert à
// confirmer les colonnes) et celle des pages suivantes ; le document pdf.js reste
// ouvert tant que l'appelant ne le détruit pas.

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { cropCell, readCellText, type CellReadVariant } from './cellOcr';
import { reviewCell, type VoteResult } from './cellReading';
import { throwIfImportAborted } from './importProcessing';
import type { RotationDegrees } from './ocrOrientation';
import { matchHeaderRoles, normalizeHeaderText, type ColumnRole } from './orderTemplateColumnRoles';
import {
  OCR_RENDER_SCALE,
  detectBestRotation,
  readScannedPage,
  rotateCanvas,
  type OcrWorker,
} from './orderTemplatePdfSource';
import { buildTable, type TableLayout } from './pdfTableLayout';
import {
  analyseTable,
  cellHasInk,
  cellRect,
  toGrayImage,
  type GrayImage,
  type TableStructure,
} from './rasterTable';

// Écart maximal entre les traits verticaux de deux pages pour une même colonne.
const COLUMN_MATCH_TOLERANCE = 8;
const MAX_WORKERS = 4;

export interface RasterProgress {
  page: number;
  pageCount: number;
  cell: number;
  cellCount: number;
}

export interface RasterSession {
  pageCount: number;
  // Lit l'en-tête et les cellules de la page 1. null : aucun quadrillage détecté.
  readFirstPage: () => Promise<TableLayout | null>;
  // Lit sur la page 1 les colonnes qui ont reçu un rôle sans avoir été lues.
  completeFirstPage: (layout: TableLayout, roles: ColumnRole[]) => Promise<TableLayout>;
  // Lit les pages 2 à N avec les colonnes de la page de référence.
  readRemainingPages: (
    roles: ColumnRole[],
    reference: TableLayout,
  ) => Promise<{ layouts: TableLayout[]; wordPages: number[] }>;
  dispose: () => Promise<void>;
}

interface OcrScheduler {
  addWorker: (worker: unknown) => string;
  addJob: (action: 'recognize', image: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<unknown>;
}

interface RenderedPage {
  oriented: HTMLCanvasElement;
  gray: GrayImage;
  structure: TableStructure | null;
}

interface FirstPageState extends RenderedPage {
  structure: TableStructure;
  headerRow: string[];
  results: Map<string, VoteResult>;
  columnsRead: Set<number>;
}

const createCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const cellKey = (row: number, column: number): string => `${row}:${column}`;

const columnCountOf = (structure: TableStructure): number => structure.columnEdges.length - 1;

const hasHeaderMeaning = (text: string): boolean =>
  matchHeaderRoles(text).length > 0 || normalizeHeaderText(text) === 'code';

// Doutes sur une cellule : lectures divergentes, symbole illisible, ou cellule
// qui porte de l'encre sans qu'aucune lecture n'en tire de texte.
const reasonsOf = (vote: VoteResult | undefined): string[] => {
  if (!vote) return [];
  return vote.text === '' ? ['cellule illisible'] : reviewCell(vote);
};

export const createRasterScanSession = ({
  pdf,
  signal,
  onProgress,
}: {
  pdf: PDFDocumentProxy;
  signal?: AbortSignal;
  onProgress?: (progress: RasterProgress) => void;
}): RasterSession => {
  const pageCount = pdf.numPages;
  let rotation: RotationDegrees | null = null;
  let blockScheduler: OcrScheduler | null = null;
  let columnScheduler: OcrScheduler | null = null;
  let wordWorker: OcrWorker | null = null;
  let wordWorkerTerminate: (() => Promise<unknown>) | null = null;
  let first: FirstPageState | null = null;
  let disposed = false;

  const dispose = async (): Promise<void> => {
    if (disposed) return;
    disposed = true;
    await Promise.allSettled([
      blockScheduler?.terminate(),
      columnScheduler?.terminate(),
      wordWorkerTerminate?.(),
    ]);
    first = null;
  };
  const onAbort = () => { void dispose(); };
  signal?.addEventListener('abort', onAbort, { once: true });

  const loadTesseract = () => import('tesseract.js');

  // Au plus quatre workers en SINGLE_BLOCK, plus un worker dédié en
  // SINGLE_COLUMN pour la lecture de départage.
  const ensureSchedulers = async (): Promise<void> => {
    if (blockScheduler && columnScheduler) return;
    const { createWorker, createScheduler, PSM } = await loadTesseract();
    type PageSegmentationMode = (typeof PSM)[keyof typeof PSM];
    const hardware = typeof navigator === 'undefined' ? 2 : navigator.hardwareConcurrency || 2;
    const workerCount = Math.max(1, Math.min(MAX_WORKERS, hardware - 1));

    const build = async (count: number, mode: PageSegmentationMode): Promise<OcrScheduler> => {
      const scheduler = createScheduler() as unknown as OcrScheduler;
      const workers = await Promise.all(Array.from({ length: count }, async () => {
        const worker = await createWorker('fra');
        await worker.setParameters({ tessedit_pageseg_mode: mode });
        return worker;
      }));
      workers.forEach((worker) => scheduler.addWorker(worker));
      return scheduler;
    };

    blockScheduler = await build(workerCount, PSM.SINGLE_BLOCK);
    columnScheduler = await build(1, PSM.SINGLE_COLUMN);
    throwIfImportAborted(signal);
  };

  const recognizeText = async (canvas: HTMLCanvasElement, variant: CellReadVariant): Promise<string> => {
    const scheduler = variant === 'column' ? columnScheduler : blockScheduler;
    if (!scheduler) throw new Error('Lecteur de texte indisponible.');
    const { data } = await scheduler.addJob('recognize', canvas);
    return data.text;
  };

  const renderPage = async (pageNumber: number): Promise<{ canvas: HTMLCanvasElement }> => {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Contexte 2D introuvable.');
    await page.render({ canvasContext: context, canvas, viewport }).promise;
    page.cleanup();
    return { canvas };
  };

  // La rotation est calculée une seule fois, sur la page 1, avec la lecture de
  // page entière en segmentation automatique, puis appliquée à toutes les pages.
  const detectRotation = async (canvas: HTMLCanvasElement): Promise<RotationDegrees> => {
    const { createWorker, PSM } = await loadTesseract();
    const worker = await createWorker('fra');
    try {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
      return await detectBestRotation(worker as unknown as OcrWorker, canvas, signal);
    } finally {
      await worker.terminate().catch(() => undefined);
    }
  };

  const renderOriented = async (pageNumber: number): Promise<RenderedPage> => {
    const { canvas } = await renderPage(pageNumber);
    throwIfImportAborted(signal);
    if (rotation === null) rotation = await detectRotation(canvas);
    const oriented = rotateCanvas(canvas, rotation);
    if (oriented !== canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    const context = oriented.getContext('2d');
    if (!context) throw new Error('Contexte 2D introuvable.');
    const { data } = context.getImageData(0, 0, oriented.width, oriented.height);
    const gray = toGrayImage(data, oriented.width, oriented.height);
    return { oriented, gray, structure: analyseTable(gray) };
  };

  const release = (page: RenderedPage | null) => {
    if (!page) return;
    page.oriented.width = 0;
    page.oriented.height = 0;
  };

  // Lit les cellules qui portent de l'encre, dans les colonnes demandées.
  const readCells = async (
    page: RenderedPage & { structure: TableStructure },
    columns: number[],
    pageNumber: number,
  ): Promise<Map<string, VoteResult>> => {
    await ensureSchedulers();
    const targets: { row: number; column: number }[] = [];
    page.structure.rows.forEach((_, row) => {
      columns.forEach((column) => {
        if (cellHasInk(page.gray, cellRect(page.structure, row, column))) targets.push({ row, column });
      });
    });

    const results = new Map<string, VoteResult>();
    let done = 0;
    await Promise.all(targets.map(async ({ row, column }) => {
      throwIfImportAborted(signal);
      const vote = await readCellText({
        source: page.oriented,
        rect: cellRect(page.structure, row, column),
        createCanvas,
        read: recognizeText,
      });
      results.set(cellKey(row, column), vote);
      done += 1;
      onProgress?.({ page: pageNumber, pageCount, cell: done, cellCount: targets.length });
    }));
    return results;
  };

  const readHeader = async (
    page: RenderedPage & { structure: TableStructure },
  ): Promise<string[]> => {
    await ensureSchedulers();
    return Promise.all(page.structure.headerCells.map(async (rect) => {
      if (!rect) return '';
      const text = await recognizeText(cropCell(createCanvas, page.oriented, rect, 1), 'block');
      return text.replace(/\s+/g, ' ').trim();
    }));
  };

  const buildLayout = (
    structure: TableStructure,
    headerRow: string[] | null,
    results: Map<string, VoteResult>,
    columnPositions: { xStart: number; xEnd: number }[],
  ): TableLayout => {
    const columnCount = columnCountOf(structure);
    const rows: string[][] = [];
    const cellReasons: string[][][] = [];
    if (headerRow) {
      rows.push(Array.from({ length: columnCount }, (_, column) => headerRow[column] ?? ''));
      cellReasons.push(Array.from({ length: columnCount }, () => []));
    }
    structure.rows.forEach((_, row) => {
      rows.push(Array.from({ length: columnCount }, (__, column) => results.get(cellKey(row, column))?.text ?? ''));
      cellReasons.push(Array.from({ length: columnCount }, (__, column) => reasonsOf(results.get(cellKey(row, column)))));
    });
    return {
      source: 'grille',
      columns: Array.from({ length: columnCount }, (_, index) => ({
        index,
        headerText: headerRow?.[index] ?? '',
        xStart: columnPositions[index].xStart,
        xEnd: columnPositions[index].xEnd,
      })),
      rows,
      bodyStart: headerRow ? 1 : 0,
      cellReasons,
    };
  };

  const ownPositions = (structure: TableStructure) =>
    Array.from({ length: columnCountOf(structure) }, (_, index) => ({
      xStart: structure.columnEdges[index],
      xEnd: structure.columnEdges[index + 1],
    }));

  const firstPageLayout = (state: FirstPageState): TableLayout =>
    buildLayout(
      state.structure,
      state.structure.headerPresent ? state.headerRow : null,
      state.results,
      ownPositions(state.structure),
    );

  // Page lue par OCR de page entière quand elle n'a pas de quadrillage détectable.
  const readPageByWords = async (pageNumber: number, reference: TableLayout): Promise<TableLayout | null> => {
    if (!wordWorker) {
      const { createWorker, PSM } = await loadTesseract();
      const worker = await createWorker('fra');
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
      wordWorker = worker as unknown as OcrWorker;
      wordWorkerTerminate = () => worker.terminate();
    }
    const page = await pdf.getPage(pageNumber);
    const { content } = await readScannedPage(page, wordWorker, rotation, signal);
    page.cleanup();
    const hint = reference.columns.length > 0
      ? [reference.columns[0].xStart, ...reference.columns.map((column) => column.xEnd)]
      : undefined;
    return buildTable(content.words, content.grid, hint);
  };

  const mapColumns = (structure: TableStructure, reference: TableLayout): number[] =>
    Array.from({ length: columnCountOf(structure) }, (_, index) => {
      const left = structure.columnEdges[index];
      const right = structure.columnEdges[index + 1];
      const match = reference.columns.find(
        (column) => Math.abs(column.xStart - left) <= COLUMN_MATCH_TOLERANCE
          && Math.abs(column.xEnd - right) <= COLUMN_MATCH_TOLERANCE,
      );
      return match ? match.index : -1;
    });

  return {
    pageCount,

    async readFirstPage() {
      throwIfImportAborted(signal);
      const page = await renderOriented(1);
      const { structure } = page;
      if (!structure) {
        release(page);
        return null;
      }
      const ready = { ...page, structure };

      const headerRow = structure.headerPresent ? await readHeader(ready) : [];
      const columnCount = columnCountOf(structure);
      // Colonnes à lire : celles dont l'en-tête désigne un rôle, plus celles qui
      // portent de l'encre dans le corps (choix possible à la confirmation).
      const columns = Array.from({ length: columnCount }, (_, index) => index).filter((index) =>
        hasHeaderMeaning(headerRow[index] ?? '')
        || structure.rows.some((_, row) => cellHasInk(page.gray, cellRect(structure, row, index))));

      const results = await readCells(ready, columns, 1);
      first = { ...ready, headerRow, results, columnsRead: new Set(columns) };
      return firstPageLayout(first);
    },

    async completeFirstPage(layout, roles) {
      const state = first;
      if (!state) return layout;
      const missing = roles
        .map((role, index) => (role !== 'ignore' && !state.columnsRead.has(index) ? index : -1))
        .filter((index) => index >= 0 && index < columnCountOf(state.structure));
      if (missing.length === 0) return layout;

      const extra = await readCells(state, missing, 1);
      extra.forEach((vote, key) => state.results.set(key, vote));
      missing.forEach((index) => state.columnsRead.add(index));
      return firstPageLayout(state);
    },

    async readRemainingPages(roles, reference) {
      const layouts: TableLayout[] = [];
      const wordPages: number[] = [];

      for (let pageNumber = 2; pageNumber <= pageCount; pageNumber += 1) {
        throwIfImportAborted(signal);
        const page = await renderOriented(pageNumber);
        const { structure } = page;

        if (!structure) {
          // Pas de quadrillage détecté : lecture par colonnes, à contrôler.
          release(page);
          const layout = await readPageByWords(pageNumber, reference);
          wordPages.push(pageNumber);
          if (layout) layouts.push(layout);
          continue;
        }

        const mapping = mapColumns(structure, reference);
        const columns = mapping
          .map((referenceIndex, index) => (referenceIndex >= 0 && (roles[referenceIndex] ?? 'ignore') !== 'ignore' ? index : -1))
          .filter((index) => index >= 0);
        const results = await readCells({ ...page, structure }, columns, pageNumber);
        const positions = ownPositions(structure).map((own, index) => {
          const referenceColumn = mapping[index] >= 0 ? reference.columns[mapping[index]] : null;
          return referenceColumn ? { xStart: referenceColumn.xStart, xEnd: referenceColumn.xEnd } : own;
        });
        layouts.push(buildLayout(structure, null, results, positions));
        release(page);
      }
      return { layouts, wordPages };
    },

    dispose,
  };
};
