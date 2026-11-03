// Lecture d'une cellule de tableau par OCR : recadrage, lectures multiples et
// vote. Le moteur OCR et la fabrique de canvas sont injectés, ce qui rend la
// logique testable hors navigateur.

import { sameReading, voteReadings, type VoteResult } from './cellReading';
import { innerRect, type Rect } from './rasterTable';

// Blanc autour de la cellule recadrée : sans lui Tesseract lit mal le texte
// collé au bord de l'image.
export const CELL_PADDING = 20;

export type CellReadVariant = 'block' | 'column';

export type CellContext = Pick<
  CanvasRenderingContext2D,
  'fillStyle' | 'fillRect' | 'drawImage' | 'imageSmoothingEnabled' | 'imageSmoothingQuality'
>;

export interface CellCanvas {
  width: number;
  height: number;
  getContext: (contextId: '2d') => CellContext | null;
}

export const cropCell = <C extends CellCanvas>(
  createCanvas: (width: number, height: number) => C,
  source: CellCanvas,
  rect: Rect,
  scale: number,
): C => {
  const inner = innerRect(rect);
  const sourceWidth = Math.max(1, inner.x1 - inner.x0);
  const sourceHeight = Math.max(1, inner.y1 - inner.y0);
  const drawWidth = Math.max(1, Math.round(sourceWidth * scale));
  const drawHeight = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = createCanvas(drawWidth + 2 * CELL_PADDING, drawHeight + 2 * CELL_PADDING);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Contexte 2D introuvable.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    source as unknown as CanvasImageSource,
    inner.x0, inner.y0, sourceWidth, sourceHeight,
    CELL_PADDING, CELL_PADDING, drawWidth, drawHeight,
  );
  return canvas;
};

export interface ReadCellOptions<C extends CellCanvas> {
  source: CellCanvas;
  rect: Rect;
  createCanvas: (width: number, height: number) => C;
  // Lit une image recadrée : bloc de texte, ou colonne de texte.
  read: (canvas: C, variant: CellReadVariant) => Promise<string>;
}

// Lecture A à l'échelle 1 et lecture B à l'échelle 2. Si elles diffèrent, une
// lecture C (échelle 3) et une lecture D (échelle 1,5, colonne de texte)
// départagent par vote.
export const readCellText = async <C extends CellCanvas>({
  source,
  rect,
  createCanvas,
  read,
}: ReadCellOptions<C>): Promise<VoteResult> => {
  const render = (scale: number) => cropCell(createCanvas, source, rect, scale);

  const [a, b] = await Promise.all([read(render(1), 'block'), read(render(2), 'block')]);
  if (sameReading(a, b)) return voteReadings([a, b]);

  const [c, d] = await Promise.all([read(render(3), 'block'), read(render(1.5), 'column')]);
  return voteReadings([a, b, c, d]);
};
