// Adaptateur pdf.js -> lecture du tableau des allergènes. Ne dépend pas de
// pdf.js : il reçoit un document déjà ouvert (interface minimale) et la table
// des opérateurs (`pdfjs.OPS`), ce qui permet de l'utiliser dans le navigateur
// comme dans un test Node.
//
// Texte : la rotation des éléments de pdf.js (transform) est prise en compte.
// Cases : les rectangles remplis sont lus dans la liste d'opérations
// (getOperatorList) avec la matrice courante ; une couleur de remplissage autre
// que le blanc compte. Les couleurs illisibles comptent comme colorées.

import {
  readAllergenPages,
  type AllergenPageData,
  type AllergenReadResult,
  type AllergenRect,
  type AllergenTextItem,
  type AllergenVLine,
} from './allergenReader';

interface PdfPageLike {
  getTextContent(): Promise<{ items: ReadonlyArray<unknown> }>;
  getOperatorList(): Promise<{ fnArray: ArrayLike<number>; argsArray: ReadonlyArray<unknown> }>;
}

export interface AllergenPdfDocumentLike {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageLike>;
}

// Table des opérateurs de pdf.js (pdfjs.OPS).
export type PdfOps = Readonly<Record<string, number>>;

interface PdfTextItemLike {
  str?: string;
  transform?: ArrayLike<number>;
  width?: number;
}

type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

// Nouvelle matrice courante après `m` : CTM' = m × CTM (convention PDF).
function multiply(m: Matrix, c: Matrix): Matrix {
  return [
    m[0] * c[0] + m[1] * c[2],
    m[0] * c[1] + m[1] * c[3],
    m[2] * c[0] + m[3] * c[2],
    m[2] * c[1] + m[3] * c[3],
    m[4] * c[0] + m[5] * c[2] + c[4],
    m[4] * c[1] + m[5] * c[3] + c[5],
  ];
}

const apply = (m: Matrix, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

const asMatrix = (value: unknown): Matrix | null => {
  if (!value || typeof value !== 'object' || !('length' in value)) return null;
  const list = Array.from(value as ArrayLike<number>);
  return list.length >= 6 && list.slice(0, 6).every((n) => typeof n === 'number') ? [list[0], list[1], list[2], list[3], list[4], list[5]] : null;
};

export function toAllergenTextItem(raw: unknown): AllergenTextItem | null {
  const item = raw as PdfTextItemLike;
  if (typeof item.str !== 'string' || !item.transform || item.transform.length < 6) return null;
  const [a, b, c, d, e, f] = Array.from(item.transform);
  const length = Math.hypot(a, b);
  const size = Math.hypot(c, d) || length;
  const width = item.width ?? 0;
  const dirX = length > 0 ? a / length : 1;
  const dirY = length > 0 ? b / length : 0;
  const xs = [e, e + dirX * width, e + c, e + dirX * width + c];
  const ys = [f, f + dirY * width, f + d, f + dirY * width + d];
  return {
    str: item.str.normalize('NFC'),
    x: e,
    y: f,
    size,
    width,
    vertical: Math.abs(b) > Math.abs(a),
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
  };
}

// Couleur de remplissage : blanc (ou transparent) = pas de case ; tout le reste compte.
export function isColoredFill(args: ReadonlyArray<unknown>): boolean {
  const first = args[0];
  if (typeof first === 'string') {
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(first.trim());
    if (hex) {
      const value = hex[1].length === 3 ? hex[1].split('').map((ch) => ch + ch).join('') : hex[1];
      const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
      return channels.some((channel) => channel < 250);
    }
    const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(first.trim());
    if (rgb) return [rgb[1], rgb[2], rgb[3]].some((channel) => Number(channel) < 250);
    return first.trim().toLowerCase() !== 'transparent' && first.trim().toLowerCase() !== 'white';
  }
  if (args.length >= 3 && args.slice(0, 3).every((n) => typeof n === 'number')) {
    return args.slice(0, 3).some((channel) => (channel as number) < 250);
  }
  return true;
}

interface GraphicsState {
  matrix: Matrix;
  colored: boolean;
}

function readGraphics(
  ops: PdfOps,
  fnArray: ArrayLike<number>,
  argsArray: ReadonlyArray<unknown>,
): { rects: AllergenRect[]; vlines: AllergenVLine[] } {
  const op = (name: string) => ops[name] ?? -1;
  const fills = new Set([op('fill'), op('eoFill'), op('fillStroke'), op('eoFillStroke'), op('closeFillStroke'), op('closeEOFillStroke')]);
  const strokes = new Set([op('stroke'), op('closeStroke'), op('fillStroke'), op('eoFillStroke'), op('closeFillStroke'), op('closeEOFillStroke')]);
  const rects: AllergenRect[] = [];
  const vlines: AllergenVLine[] = [];
  let state: GraphicsState = { matrix: IDENTITY, colored: true }; // le noir est la couleur par défaut
  const stack: GraphicsState[] = [];

  const handlePath = (paint: number, data: ArrayLike<number>) => {
    const subpaths: [number, number][][] = [];
    let currentPath: [number, number][] = [];
    const push = (x: number, y: number) => currentPath.push(apply(state.matrix, x, y));
    for (let i = 0; i < data.length;) {
      const code = data[i];
      if (code === 0) {
        if (currentPath.length > 0) subpaths.push(currentPath);
        currentPath = [];
        push(data[i + 1], data[i + 2]);
        i += 3;
      } else if (code === 1) {
        push(data[i + 1], data[i + 2]);
        i += 3;
      } else if (code === 2) {
        push(data[i + 1], data[i + 2]);
        push(data[i + 3], data[i + 4]);
        push(data[i + 5], data[i + 6]);
        i += 7;
      } else if (code === 3) {
        push(data[i + 1], data[i + 2]);
        push(data[i + 3], data[i + 4]);
        i += 5;
      } else {
        i += 1;
      }
    }
    if (currentPath.length > 0) subpaths.push(currentPath);

    for (const points of subpaths) {
      const xs = points.map((p) => p[0]);
      const ys = points.map((p) => p[1]);
      const box = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
      if (fills.has(paint)) {
        if (box.x1 - box.x0 < 1.5 && box.y1 - box.y0 >= 5) vlines.push({ x: (box.x0 + box.x1) / 2, y0: box.y0, y1: box.y1 });
        else if (state.colored && box.x1 > box.x0 && box.y1 > box.y0) rects.push(box);
      }
      if (strokes.has(paint)) {
        for (let k = 1; k < points.length; k += 1) {
          const [ax, ay] = points[k - 1];
          const [bx, by] = points[k];
          if (Math.abs(ax - bx) < 0.01 && Math.abs(ay - by) >= 5) vlines.push({ x: ax, y0: Math.min(ay, by), y1: Math.max(ay, by) });
        }
      }
    }
  };

  for (let index = 0; index < fnArray.length; index += 1) {
    const fn = fnArray[index];
    const args = argsArray[index];
    const list: ReadonlyArray<unknown> = Array.isArray(args) ? args : [];
    if (fn === op('save')) {
      stack.push(state);
    } else if (fn === op('restore')) {
      state = stack.pop() ?? state;
    } else if (fn === op('transform')) {
      const matrix = asMatrix(list);
      if (matrix) state = { ...state, matrix: multiply(matrix, state.matrix) };
    } else if (fn === op('paintFormXObjectBegin')) {
      stack.push(state);
      const matrix = asMatrix(list[0]);
      if (matrix) state = { ...state, matrix: multiply(matrix, state.matrix) };
    } else if (fn === op('paintFormXObjectEnd')) {
      state = stack.pop() ?? state;
    } else if (fn === op('setFillRGBColor')) {
      state = { ...state, colored: isColoredFill(list) };
    } else if (fn === op('setFillTransparent')) {
      state = { ...state, colored: false };
    } else if (fn === op('setFillColorN')) {
      state = { ...state, colored: true };
    } else if (fn === op('constructPath')) {
      const paint = typeof list[0] === 'number' ? list[0] : -1;
      const pathList = list[1];
      const path = Array.isArray(pathList) ? pathList[0] : null;
      if (path && typeof path === 'object' && 'length' in path) handlePath(paint, path as ArrayLike<number>);
    }
  }
  return { rects, vlines };
}

export async function readAllergenPdf(doc: AllergenPdfDocumentLike, ops: PdfOps): Promise<AllergenReadResult> {
  const pages: AllergenPageData[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items.map(toAllergenTextItem).filter((item): item is AllergenTextItem => item !== null);
    const operators = await page.getOperatorList();
    const graphics = readGraphics(ops, operators.fnArray, operators.argsArray);
    pages.push({ page: pageNumber, items, rects: graphics.rects, vlines: graphics.vlines });
  }
  return readAllergenPages(pages);
}
