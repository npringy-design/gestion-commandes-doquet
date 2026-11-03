// Structure d'un tableau quadrillé à partir des pixels d'une page rendue
// (déjà remise à l'endroit). Aucune dépendance : fonctions pures.
//
// Les traits sont cherchés SUR L'IMAGE, pas dans le PDF : les lignes et les
// colonnes sont alors exactes par construction, quelle que soit la façon dont
// le PDF a été produit (texte converti en tracés, page pivotée, scan).

export interface GrayImage {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray; // 1 octet par pixel, 0 = noir
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface HLine { y: number; x0: number; x1: number }
export interface VLine { x: number; y0: number; y1: number }

export interface TableStructure {
  columnEdges: number[]; // x des traits verticaux du corps ; colonne i = [edges[i], edges[i+1]]
  rows: { y0: number; y1: number }[]; // lignes du corps, de haut en bas
  headerPresent: boolean;
  headerCells: (Rect | null)[]; // zone d'en-tête de chaque colonne (null sans en-tête)
}

const DARK_LEVEL = 190;
const INK_LEVEL = 150;
const MIN_LINE_LENGTH = 120; // pixels à 216 dpi (rendu pdf.js à l'échelle 3)
const POSITION_TOLERANCE = 6;
const CELL_MARGIN = 6;

export const toGrayImage = (rgba: Uint8ClampedArray, width: number, height: number): GrayImage => {
  const data = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i += 1) {
    const p = i * 4;
    data[i] = Math.round(0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]);
  }
  return { width, height, data };
};

const clusterPositions = (values: number[], tolerance = POSITION_TOLERANCE): number[] => {
  const sorted = [...values].sort((a, b) => a - b);
  const groups: number[][] = [];
  sorted.forEach((value) => {
    const last = groups[groups.length - 1];
    if (last && value - last[last.length - 1] <= tolerance) last.push(value);
    else groups.push([value]);
  });
  return groups.map((group) => group.reduce((sum, v) => sum + v, 0) / group.length);
};

interface Band { start: number; end: number; low: number; high: number }

// Traits = suites de pixels sombres d'au moins `minLength` pixels. Un trait est
// l'ensemble des lignes (ou colonnes) consécutives qui en contiennent.
export const findRulings = (
  image: GrayImage,
  minLength = MIN_LINE_LENGTH,
): { hLines: HLine[]; vLines: VLine[] } => {
  const { width, height, data } = image;
  const dark = (x: number, y: number) => data[y * width + x] < DARK_LEVEL;

  const hLines: HLine[] = [];
  let hBand: Band | null = null;
  const flushH = () => {
    if (hBand) hLines.push({ y: (hBand.start + hBand.end) / 2, x0: hBand.low, x1: hBand.high });
    hBand = null;
  };
  for (let y = 0; y < height; y += 1) {
    let rowX0 = Infinity;
    let rowX1 = -1;
    let run = 0;
    for (let x = 0; x <= width; x += 1) {
      if (x < width && dark(x, y)) run += 1;
      else {
        if (run >= minLength) {
          rowX0 = Math.min(rowX0, x - run);
          rowX1 = Math.max(rowX1, x - 1);
        }
        run = 0;
      }
    }
    if (rowX1 >= 0) {
      if (hBand) {
        hBand.end = y;
        hBand.low = Math.min(hBand.low, rowX0);
        hBand.high = Math.max(hBand.high, rowX1);
      } else hBand = { start: y, end: y, low: rowX0, high: rowX1 };
    } else flushH();
  }
  flushH();

  const vLines: VLine[] = [];
  let vBand: Band | null = null;
  const flushV = () => {
    if (vBand) vLines.push({ x: (vBand.start + vBand.end) / 2, y0: vBand.low, y1: vBand.high });
    vBand = null;
  };
  for (let x = 0; x < width; x += 1) {
    let colY0 = Infinity;
    let colY1 = -1;
    let run = 0;
    for (let y = 0; y <= height; y += 1) {
      if (y < height && dark(x, y)) run += 1;
      else {
        if (run >= minLength) {
          colY0 = Math.min(colY0, y - run);
          colY1 = Math.max(colY1, y - 1);
        }
        run = 0;
      }
    }
    if (colY1 >= 0) {
      if (vBand) {
        vBand.end = x;
        vBand.low = Math.min(vBand.low, colY0);
        vBand.high = Math.max(vBand.high, colY1);
      } else vBand = { start: x, end: x, low: colY0, high: colY1 };
    } else flushV();
  }
  flushV();

  return { hLines, vLines };
};

// Colonnes = traits verticaux qui couvrent la dernière ligne du corps (les
// traits d'en-tête plus courts sont écartés). Lignes = intervalles entre traits
// horizontaux pleine largeur, à partir du bas de l'en-tête. Les bandes sans
// bordure en haut ou en bas du tableau sont ajoutées ; les vides sont ignorées
// plus tard via `cellHasInk`.
export const analyseTable = (image: GrayImage): TableStructure | null => {
  const { hLines, vLines } = findRulings(image);
  if (hLines.length === 0 || vLines.length < 3) return null;

  const maxExtent = Math.max(...hLines.map((h) => h.x1 - h.x0));
  const fullY = clusterPositions(
    hLines.filter((h) => h.x1 - h.x0 >= 0.9 * maxExtent).map((h) => h.y),
  );
  const tallest = vLines.reduce((best, v) => (v.y1 - v.y0 > best.y1 - best.y0 ? v : best), vLines[0]);
  const ys = fullY.length >= 2 ? fullY : [tallest.y0, tallest.y1];

  const [lastTop, lastBottom] = [ys[ys.length - 2], ys[ys.length - 1]];
  const bodyVLines = vLines.filter(
    (v) => v.y0 <= lastTop + POSITION_TOLERANCE && v.y1 >= lastBottom - POSITION_TOLERANCE,
  );
  const columnEdges = clusterPositions(bodyVLines.map((v) => v.x));
  if (columnEdges.length < 3) return null;

  const tops = bodyVLines.map((v) => v.y0);
  const topOfColumns = Math.max(...tops);
  const headerPresent = topOfColumns - Math.min(...tops) > 20;
  const bounds = ys.filter((y) => y >= topOfColumns - POSITION_TOLERANCE);
  if (bounds.length === 0) return null;

  const rows: { y0: number; y1: number }[] = [];
  if (!headerPresent && bounds[0] - topOfColumns > 30) rows.push({ y0: topOfColumns, y1: bounds[0] });
  for (let i = 0; i + 1 < bounds.length; i += 1) rows.push({ y0: bounds[i], y1: bounds[i + 1] });
  const bottomOfColumns = Math.max(...bodyVLines.map((v) => v.y1));
  if (bottomOfColumns - bounds[bounds.length - 1] > 30) {
    rows.push({ y0: bounds[bounds.length - 1], y1: bottomOfColumns });
  }

  const headerCells: (Rect | null)[] = [];
  for (let i = 0; i + 1 < columnEdges.length; i += 1) {
    if (!headerPresent) {
      headerCells.push(null);
      continue;
    }
    const edgeTops = bodyVLines
      .filter((v) => Math.abs(v.x - columnEdges[i]) < POSITION_TOLERANCE || Math.abs(v.x - columnEdges[i + 1]) < POSITION_TOLERANCE)
      .map((v) => v.y0);
    const top = edgeTops.length > 0 ? Math.max(...edgeTops) : topOfColumns;
    headerCells.push(bounds[0] - top > 40
      ? { x0: columnEdges[i], y0: top, x1: columnEdges[i + 1], y1: bounds[0] }
      : null);
  }

  return { columnEdges, rows, headerPresent, headerCells };
};

export const cellRect = (structure: TableStructure, row: number, column: number): Rect => ({
  x0: structure.columnEdges[column],
  y0: structure.rows[row].y0,
  x1: structure.columnEdges[column + 1],
  y1: structure.rows[row].y1,
});

// Zone intérieure d'une cellule (sans les traits de bordure).
export const innerRect = (rect: Rect, margin = CELL_MARGIN): Rect => ({
  x0: Math.round(rect.x0 + margin),
  y0: Math.round(rect.y0 + margin),
  x1: Math.round(rect.x1 - margin),
  y1: Math.round(rect.y1 - margin),
});

export const cellHasInk = (image: GrayImage, rect: Rect, minRatio = 0.003): boolean => {
  const inner = innerRect(rect);
  const width = inner.x1 - inner.x0;
  const height = inner.y1 - inner.y0;
  if (width <= 0 || height <= 0) return false;
  let ink = 0;
  for (let y = inner.y0; y < inner.y1; y += 1) {
    for (let x = inner.x0; x < inner.x1; x += 1) {
      if (image.data[y * image.width + x] < INK_LEVEL) ink += 1;
    }
  }
  return ink / (width * height) >= minRatio;
};
