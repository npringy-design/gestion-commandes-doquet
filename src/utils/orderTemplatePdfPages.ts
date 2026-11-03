import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ImportProcessingError, throwIfImportAborted } from './importProcessing';
import { ORDER_TEMPLATE_MAX_PAGES } from './orderTemplateExtraction';

export const ORDER_TEMPLATE_PAGE_LONG_SIDE_PX = 1800;
export const ORDER_TEMPLATE_PAGE_JPEG_QUALITY = 0.85;

export interface RenderedPdfPage {
  pageNumber: number;
  // Data URL JPEG de la page, déjà orientée par pdf.js.
  pageImage: string;
  // Texte natif de la page, vide pour un PDF image.
  nativeText: string;
}

export const assertOrderTemplatePageCount = (pageCount: number): void => {
  if (pageCount > ORDER_TEMPLATE_MAX_PAGES) {
    throw new ImportProcessingError(
      'processing_failed',
      `Ce PDF compte ${pageCount} pages ; la limite est de ${ORDER_TEMPLATE_MAX_PAGES} pages. Découpe le fichier puis réessaie.`,
    );
  }
};

// Échelle qui ramène le plus grand côté de la page à la taille d'envoi.
export const getOrderTemplateRenderScale = (pageWidth: number, pageHeight: number): number => {
  const longSide = Math.max(pageWidth, pageHeight);
  return longSide > 0 ? ORDER_TEMPLATE_PAGE_LONG_SIDE_PX / longSide : 1;
};

const readTextItem = (item: unknown): string => {
  if (typeof item !== 'object' || item === null) return '';
  const { str } = item as { str?: unknown };
  return typeof str === 'string' ? str : '';
};

export const renderOrderTemplatePage = async (
  pdf: PDFDocumentProxy,
  pageNumber: number,
  signal?: AbortSignal,
): Promise<RenderedPdfPage> => {
  throwIfImportAborted(signal);
  const page = await pdf.getPage(pageNumber);

  const baseViewport = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({
    scale: getOrderTemplateRenderScale(baseViewport.width, baseViewport.height),
  });

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Contexte 2D introuvable.');

  // Un JPEG n'a pas de transparence : sans fond blanc, les zones vides seraient noires.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, canvas, viewport }).promise;
  throwIfImportAborted(signal);

  const textContent = await page.getTextContent();
  const nativeText = textContent.items
    .map(readTextItem)
    .filter((text) => text.trim() !== '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const pageImage = canvas.toDataURL('image/jpeg', ORDER_TEMPLATE_PAGE_JPEG_QUALITY);
  page.cleanup();

  return { pageNumber, pageImage, nativeText };
};
