// Mots et traits d'un PDF de trame, pour pdfTableLayout :
//  - texte natif pdf.js quand le PDF en contient ;
//  - sinon OCR Tesseract (PDF scanné ou texte converti en tracés), avec les
//    traits de la grille lus dans le PDF et ramenés dans l'image de l'OCR.
// Aucune fusion entre texte natif et OCR : un document est lu par une seule voie.

import { OPS, type PDFDocumentProxy } from 'pdfjs-dist';
import { ImportProcessingError, throwIfImportAborted } from './importProcessing';
import {
  ROTATION_CANDIDATES,
  isSidewaysWords,
  pickBestRotation,
  rotatePoint,
  type RotationCandidate,
  type RotationDegrees,
} from './ocrOrientation';
import {
  buildGrid,
  buildTable,
  extractRawSegments,
  extractRulings,
  normalizePageOrientation,
  segmentsToRulings,
  type PdfOperatorList,
  type PdfOps,
  type PdfWord,
  type TableGrid,
  type TableLayout,
  type TextItemLike,
} from './pdfTableLayout';

// En dessous de ce nombre de caractères de texte natif, le PDF est traité comme scanné.
export const NATIVE_TEXT_MIN_CHARS = 20;

const PDF_OPS: PdfOps = {
  save: OPS.save,
  restore: OPS.restore,
  transform: OPS.transform,
  constructPath: OPS.constructPath,
  paintFormXObjectBegin: OPS.paintFormXObjectBegin,
  paintFormXObjectEnd: OPS.paintFormXObjectEnd,
  stroke: OPS.stroke,
  closeStroke: OPS.closeStroke,
  fill: OPS.fill,
  eoFill: OPS.eoFill,
  fillStroke: OPS.fillStroke,
  eoFillStroke: OPS.eoFillStroke,
  closeFillStroke: OPS.closeFillStroke,
  closeEOFillStroke: OPS.closeEOFillStroke,
};

export interface PageContent {
  words: PdfWord[];
  grid: TableGrid | null;
}

const isTextItemLike = (item: unknown): item is TextItemLike => {
  if (item === null || typeof item !== 'object') return false;
  const candidate = item as Partial<TextItemLike>;
  return typeof candidate.str === 'string'
    && typeof candidate.width === 'number'
    && typeof candidate.height === 'number'
    && candidate.transform !== undefined
    && typeof candidate.transform.length === 'number';
};

// ---------------------------------------------------------------------------
// Texte natif
// ---------------------------------------------------------------------------

export const readNativePages = async (
  pdf: PDFDocumentProxy,
  signal?: AbortSignal,
): Promise<{ pages: PageContent[]; totalChars: number }> => {
  const collected: { page: Awaited<ReturnType<PDFDocumentProxy['getPage']>>; items: TextItemLike[] }[] = [];
  let totalChars = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    throwIfImportAborted(signal);
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const items: TextItemLike[] = [];
    textContent.items.forEach((item) => {
      if (!isTextItemLike(item)) return;
      items.push(item);
      totalChars += item.str.trim().length;
    });
    collected.push({ page, items });
  }

  // Document sans texte natif : inutile de lire les traits ici, la voie OCR les relit.
  if (totalChars < NATIVE_TEXT_MIN_CHARS) {
    collected.forEach(({ page }) => page.cleanup());
    return { pages: [], totalChars };
  }

  const pages: PageContent[] = [];
  for (const { page, items } of collected) {
    throwIfImportAborted(signal);
    const { angle, words } = normalizePageOrientation(items);
    const operatorList: PdfOperatorList = await page.getOperatorList();
    pages.push({ words, grid: buildGrid(extractRulings(operatorList, PDF_OPS, angle)) });
    page.cleanup();
  }
  return { pages, totalChars };
};

// ---------------------------------------------------------------------------
// OCR
// ---------------------------------------------------------------------------

const OCR_RENDER_SCALE = 3;
const ROTATION_DETECTION_MAX_SIDE = 1400;

// Certains PDF « Imprimer en PDF » dessinent le tableau pivoté dans le flux
// sans poser /Rotate : pdf.js les rend « sur le côté ».
const rotateCanvas = (source: HTMLCanvasElement, degrees: RotationDegrees): HTMLCanvasElement => {
  if (degrees === 0) return source;
  const rotated = document.createElement('canvas');
  const context = rotated.getContext('2d');
  if (!context) throw new Error('Contexte 2D introuvable.');

  if (degrees === 180) {
    rotated.width = source.width;
    rotated.height = source.height;
    context.translate(rotated.width, rotated.height);
    context.rotate(Math.PI);
  } else if (degrees === 90) {
    rotated.width = source.height;
    rotated.height = source.width;
    context.translate(rotated.width, 0);
    context.rotate(Math.PI / 2);
  } else {
    rotated.width = source.height;
    rotated.height = source.width;
    context.translate(0, rotated.height);
    context.rotate(-Math.PI / 2);
  }
  context.drawImage(source, 0, 0);
  return rotated;
};

const downscaleForDetection = (source: HTMLCanvasElement): HTMLCanvasElement => {
  const longSide = Math.max(source.width, source.height);
  if (longSide <= ROTATION_DETECTION_MAX_SIDE) return source;
  const ratio = ROTATION_DETECTION_MAX_SIDE / longSide;
  const reduced = document.createElement('canvas');
  reduced.width = Math.round(source.width * ratio);
  reduced.height = Math.round(source.height * ratio);
  const context = reduced.getContext('2d');
  if (!context) throw new Error('Contexte 2D introuvable.');
  context.drawImage(source, 0, 0, reduced.width, reduced.height);
  return reduced;
};

interface OcrWorker {
  recognize: (
    image: HTMLCanvasElement,
    options: Record<string, never>,
    output: { blocks: boolean },
  ) => Promise<{ data: { confidence: number; blocks?: OcrBlock[] | null } }>;
  terminate: () => Promise<unknown>;
}

interface OcrBlock {
  paragraphs: { lines: { words: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[] }[] }[];
}

// Mots d'un résultat OCR, avec leurs dimensions.
const collectOcrWords = (blocks: OcrBlock[] | null | undefined) => {
  const words: { text: string; width: number; height: number }[] = [];
  (blocks ?? []).forEach((block) => {
    block.paragraphs.forEach((paragraph) => {
      paragraph.lines.forEach((line) => {
        line.words.forEach((word) => {
          words.push({
            text: word.text,
            width: word.bbox.x1 - word.bbox.x0,
            height: word.bbox.y1 - word.bbox.y0,
          });
        });
      });
    });
  });
  return words;
};

// L'orientation retenue est celle qui lit la page à l'endroit avec la meilleure
// confiance : une page lue de côté ou à l'envers peut avoir une confiance
// presque égale, mais ses mots sont alors plus hauts que larges.
const detectBestRotation = async (
  worker: OcrWorker,
  canvas: HTMLCanvasElement,
  signal?: AbortSignal,
): Promise<RotationDegrees> => {
  const reduced = downscaleForDetection(canvas);
  const candidates: RotationCandidate[] = [];
  for (const degrees of ROTATION_CANDIDATES) {
    throwIfImportAborted(signal);
    const { data } = await worker.recognize(rotateCanvas(reduced, degrees), {}, { blocks: true });
    candidates.push({
      degrees,
      confidence: data.confidence,
      sideways: isSidewaysWords(collectOcrWords(data.blocks)),
    });
  }
  return pickBestRotation(candidates);
};

// Barres de bordure de tableau que l'OCR accole aux mots ou lit comme mots isolés.
const cleanOcrWordText = (text: string): string => text.replace(/^[\s|]+|[\s|]+$/g, '');
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

export const readScannedPages = async (
  pdf: PDFDocumentProxy,
  options: {
    signal?: AbortSignal;
    onPage?: (pageNumber: number, pageCount: number) => void;
  } = {},
): Promise<PageContent[]> => {
  const { signal, onPage } = options;
  const { createWorker, PSM } = await import('tesseract.js');
  const worker = await createWorker('fra');
  const ocrWorker = worker as unknown as OcrWorker;
  // AUTO détecte blocs et colonnes avant de reconnaître les mots.
  await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });

  let terminated = false;
  const terminate = async () => {
    if (terminated) return;
    terminated = true;
    await worker.terminate();
  };
  const abort = () => { void terminate().catch(() => undefined); };
  signal?.addEventListener('abort', abort, { once: true });

  const pages: PageContent[] = [];
  let rotation: RotationDegrees | null = null;

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      throwIfImportAborted(signal);
      onPage?.(pageNumber, pdf.numPages);
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Contexte 2D introuvable.');
      await page.render({ canvasContext: context, canvas, viewport }).promise;
      throwIfImportAborted(signal);

      if (rotation === null) rotation = await detectBestRotation(ocrWorker, canvas, signal);
      const degrees = rotation;
      const oriented = rotateCanvas(canvas, degrees);

      const { data } = await ocrWorker.recognize(oriented, {}, { blocks: true });
      throwIfImportAborted(signal);

      if (isSidewaysWords(collectOcrWords(data.blocks))) {
        throw new ImportProcessingError(
          'processing_failed',
          'La page n’a pas pu être remise à l’endroit pour la lecture visuelle. Saisis la trame manuellement.',
        );
      }

      const words: PdfWord[] = [];
      (data.blocks ?? []).forEach((block) => {
        block.paragraphs.forEach((paragraph) => {
          paragraph.lines.forEach((line) => {
            line.words.forEach((word) => {
              const text = cleanOcrWordText(word.text);
              if (!text || !HAS_LETTER_OR_DIGIT.test(text)) return;
              words.push({
                text,
                x: word.bbox.x0,
                yTop: word.bbox.y0,
                width: Math.max(1, word.bbox.x1 - word.bbox.x0),
                height: Math.max(1, word.bbox.y1 - word.bbox.y0),
              });
            });
          });
        });
      });

      // La grille est lue dans le PDF (traits vectoriels) puis ramenée dans
      // l'image tournée que l'OCR a lue.
      const operatorList: PdfOperatorList = await page.getOperatorList();
      const rulings = segmentsToRulings(extractRawSegments(operatorList, PDF_OPS), (x, y) => {
        const [viewportX, viewportY] = viewport.convertToViewportPoint(x, y);
        return rotatePoint(viewportX, viewportY, degrees, canvas.width, canvas.height);
      });
      pages.push({ words, grid: buildGrid(rulings) });
      page.cleanup();
    }
  } finally {
    signal?.removeEventListener('abort', abort);
    await terminate().catch(() => undefined);
  }
  return pages;
};

// ---------------------------------------------------------------------------
// Pages vers tableaux
// ---------------------------------------------------------------------------

// Une page sans grille (dernière page très courte, par exemple) reprend les
// colonnes de la dernière page qui en avait une.
export const buildPageLayouts = (pages: PageContent[]): TableLayout[] => {
  const layouts: TableLayout[] = [];
  let columnEdgesHint: number[] | undefined;
  pages.forEach(({ words, grid }) => {
    const layout = buildTable(words, grid, columnEdgesHint);
    if (grid) columnEdgesHint = grid.columnEdges;
    if (layout) layouts.push(layout);
  });
  return layouts;
};
