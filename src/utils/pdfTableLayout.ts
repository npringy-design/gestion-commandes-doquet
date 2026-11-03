// Lecture géométrique d'un tableau PDF : orientation de la page, traits de la
// grille, colonnes et lignes. Fonctions pures, sans dépendance : les mots
// viennent du texte natif pdf.js ou d'un OCR, les traits de la liste
// d'opérateurs pdf.js.
//
// Rien ici ne comprend le sens d'une colonne ni ne corrige une valeur : le
// module restitue des cellules de texte, recopiées telles quelles.

export interface PdfWord {
  text: string;
  x: number;
  yTop: number;
  width: number;
  height: number;
}

// Élément de texte pdf.js (getTextContent), réduit aux champs utilisés.
export interface TextItemLike {
  str: string;
  transform: ArrayLike<number>;
  width: number;
  height: number;
}

export interface Ruling {
  orientation: 'horizontal' | 'vertical';
  position: number;
  start: number;
  end: number;
}

export interface RawSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface TableGrid {
  columnEdges: number[];
  rowEdges: number[];
}

export interface TableColumn {
  index: number;
  headerText: string;
  xStart: number;
  xEnd: number;
}

export interface TableLayout {
  source: 'grille' | 'colonnes';
  columns: TableColumn[];
  rows: string[][];
  // Index de la première ligne de produits quand un en-tête a pu être isolé
  // sans connaître le sens des colonnes (colonne Code), sinon 0.
  bodyStart: number;
}

export interface PdfOperatorList {
  fnArray: ArrayLike<number>;
  argsArray: ArrayLike<unknown>;
}

// Codes d'opérateurs pdf.js (objet OPS), transmis par l'appelant pour que ce
// module reste sans dépendance.
export interface PdfOps {
  save: number;
  restore: number;
  transform: number;
  constructPath: number;
  paintFormXObjectBegin: number;
  paintFormXObjectEnd: number;
  stroke: number;
  closeStroke: number;
  fill: number;
  eoFill: number;
  fillStroke: number;
  eoFillStroke: number;
  closeFillStroke: number;
  closeEOFillStroke: number;
}

// Un trait a moins de 3 pt d'épaisseur ; en dessous de 6 pt de long, c'est un
// point ou un tiret de texte, pas un trait de tableau.
export const MAX_RULING_THICKNESS = 3;
export const MIN_RULING_LENGTH = 6;
const MIN_GRID_LINE_LENGTH = 20;
const GRID_LINE_EXTENT_RATIO = 0.4;
const RULING_POSITION_TOLERANCE = 1.5;
const RULING_GAP_TOLERANCE = 2;
const GRID_EDGE_TOLERANCE = 3;
const WHITESPACE_VALLEY_RATIO = 1.5;
const CODE_CELL_PATTERN = /^(?:[A-Za-z]{1,6}[-_.]?)?\d{3,}$/;

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

const compactText = (value: string): string => value.replace(/\s+/g, ' ').trim();

// Les barres de bordure que l'OCR accole à une valeur (« 288031 | ») ne sont pas
// un défaut du code.
const BORDER_NOISE = /^[\s|]+|[\s|]+$/g;

export const isCodeCell = (value: string): boolean =>
  CODE_CELL_PATTERN.test(compactText(value).replace(BORDER_NOISE, ''));

// ---------------------------------------------------------------------------
// Orientation
// ---------------------------------------------------------------------------

// Ramène un point du repère PDF (y vers le haut, page éventuellement pivotée
// de `angle` radians) dans un repère haut-gauche non pivoté (y vers le bas).
export const toUprightFrame = (x: number, y: number, angle: number): { x: number; y: number } => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: x * cos + y * sin, y: -(-x * sin + y * cos) };
};

const NINETY_DEGREES = Math.PI / 2;
const ANGLE_SNAP = (3 * Math.PI) / 180;

// Angle dominant du texte, pondéré par la longueur des chaînes, arrondi au
// multiple de 90° le plus proche quand il en est à moins de 3°.
export const getDominantTextAngle = (items: TextItemLike[]): number => {
  let sumCos = 0;
  let sumSin = 0;
  items.forEach((item) => {
    const a = item.transform[0];
    const b = item.transform[1];
    const norm = Math.hypot(a, b);
    const weight = item.str.trim().length;
    if (norm === 0 || weight === 0) return;
    sumCos += (a / norm) * weight;
    sumSin += (b / norm) * weight;
  });
  if (sumCos === 0 && sumSin === 0) return 0;
  const angle = Math.atan2(sumSin, sumCos);
  const nearest = Math.round(angle / NINETY_DEGREES) * NINETY_DEGREES;
  return Math.abs(angle - nearest) <= ANGLE_SNAP ? nearest : angle;
};

export const normalizePageOrientation = (
  items: TextItemLike[],
): { angle: number; words: PdfWord[] } => {
  const angle = getDominantTextAngle(items);
  const words: PdfWord[] = [];

  items.forEach((item) => {
    const text = compactText(item.str);
    if (!text) return;
    const origin = toUprightFrame(item.transform[4], item.transform[5], angle);
    const fontHeight = item.height > 0
      ? item.height
      : Math.hypot(item.transform[2], item.transform[3]);
    // `origin` est le début de la ligne de base : le haut du texte est au-dessus.
    words.push({
      text,
      x: origin.x,
      yTop: origin.y - fontHeight,
      width: Math.max(0, item.width),
      height: fontHeight,
    });
  });

  return { angle, words };
};

// ---------------------------------------------------------------------------
// Traits (liste d'opérateurs pdf.js)
// ---------------------------------------------------------------------------

type Matrix = readonly [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

// Même composition que ctx.transform(a, b, c, d, e, f) : `matrix` s'applique
// d'abord, puis la transformation courante.
const multiply = (current: Matrix, matrix: Matrix): Matrix => [
  current[0] * matrix[0] + current[2] * matrix[1],
  current[1] * matrix[0] + current[3] * matrix[1],
  current[0] * matrix[2] + current[2] * matrix[3],
  current[1] * matrix[2] + current[3] * matrix[3],
  current[0] * matrix[4] + current[2] * matrix[5] + current[4],
  current[1] * matrix[4] + current[3] * matrix[5] + current[5],
];

const applyMatrix = (matrix: Matrix, x: number, y: number): { x: number; y: number } => ({
  x: matrix[0] * x + matrix[2] * y + matrix[4],
  y: matrix[1] * x + matrix[3] * y + matrix[5],
});

const toMatrix = (value: unknown): Matrix | null => {
  if (value === null || typeof value !== 'object') return null;
  const candidate = value as ArrayLike<unknown>;
  if (typeof candidate.length !== 'number' || candidate.length < 6) return null;
  const numbers: number[] = [];
  for (let index = 0; index < 6; index += 1) {
    const entry = candidate[index];
    if (typeof entry !== 'number' || !Number.isFinite(entry)) return null;
    numbers.push(entry);
  }
  return [numbers[0], numbers[1], numbers[2], numbers[3], numbers[4], numbers[5]];
};

interface SubPath {
  points: { x: number; y: number }[];
  hasCurve: boolean;
  closed: boolean;
}

// Opérateurs de tracé pdf.js ≥ 5 : 0 moveTo, 1 lineTo, 2 curveTo,
// 3 quadraticCurveTo, 4 closePath, suivis de leurs coordonnées.
const parsePathData = (data: ArrayLike<number>): SubPath[] => {
  const subPaths: SubPath[] = [];
  let current: SubPath | null = null;
  let index = 0;
  const startSubPath = (x: number, y: number) => {
    current = { points: [{ x, y }], hasCurve: false, closed: false };
    subPaths.push(current);
  };

  while (index < data.length) {
    const op = data[index];
    index += 1;
    if (op === 0) {
      startSubPath(data[index], data[index + 1]);
      index += 2;
    } else if (op === 1) {
      if (!current) startSubPath(data[index], data[index + 1]);
      else (current as SubPath).points.push({ x: data[index], y: data[index + 1] });
      index += 2;
    } else if (op === 2) {
      if (current) (current as SubPath).hasCurve = true;
      index += 6;
    } else if (op === 3) {
      if (current) (current as SubPath).hasCurve = true;
      index += 4;
    } else if (op === 4) {
      if (current) (current as SubPath).closed = true;
    } else {
      break;
    }
  }
  return subPaths;
};

// Ancien format (pdf.js ≤ 4) : tableau d'opérateurs puis tableau de coordonnées.
// 13 moveTo, 14 lineTo, 15 curveTo, 16 curveTo2, 17 curveTo3, 18 closePath,
// 19 rectangle.
const parseLegacyPath = (ops: ArrayLike<number>, coords: ArrayLike<number>): SubPath[] => {
  const subPaths: SubPath[] = [];
  let current: SubPath | null = null;
  let index = 0;
  for (let opIndex = 0; opIndex < ops.length; opIndex += 1) {
    const op = ops[opIndex];
    if (op === 13) {
      current = { points: [{ x: coords[index], y: coords[index + 1] }], hasCurve: false, closed: false };
      subPaths.push(current);
      index += 2;
    } else if (op === 14) {
      if (current) (current as SubPath).points.push({ x: coords[index], y: coords[index + 1] });
      index += 2;
    } else if (op === 15 || op === 16 || op === 17) {
      if (current) (current as SubPath).hasCurve = true;
      index += op === 15 ? 6 : 4;
    } else if (op === 18) {
      if (current) (current as SubPath).closed = true;
    } else if (op === 19) {
      const x = coords[index];
      const y = coords[index + 1];
      const width = coords[index + 2];
      const height = coords[index + 3];
      subPaths.push({
        points: [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }],
        hasCurve: false,
        closed: true,
      });
      index += 4;
    }
  }
  return subPaths;
};

const readPaths = (args: unknown): SubPath[] => {
  if (!Array.isArray(args)) return [];
  const [first, second] = args as unknown[];
  if (Array.isArray(first) && second !== null && typeof second === 'object') {
    return parseLegacyPath(first as number[], second as ArrayLike<number>);
  }
  const container = Array.isArray(second) ? (second as unknown[])[0] : second;
  if (container === null || typeof container !== 'object') return [];
  return parsePathData(container as ArrayLike<number>);
};

const AXIS_TOLERANCE = 0.05;

// Segments horizontaux ou verticaux fins : traits tracés, ou rectangles de
// moins de 3 pt d'épaisseur. Les coordonnées sont celles de l'espace page, la
// transformation courante étant appliquée.
export const extractRawSegments = (opList: PdfOperatorList, ops: PdfOps): RawSegment[] => {
  const paintOps = new Set([
    ops.stroke, ops.closeStroke, ops.fill, ops.eoFill,
    ops.fillStroke, ops.eoFillStroke, ops.closeFillStroke, ops.closeEOFillStroke,
  ]);
  const segments: RawSegment[] = [];
  const stack: Matrix[] = [];
  let ctm: Matrix = IDENTITY;

  for (let index = 0; index < opList.fnArray.length; index += 1) {
    const fn = opList.fnArray[index];
    const args = opList.argsArray[index];

    if (fn === ops.save) {
      stack.push(ctm);
    } else if (fn === ops.restore) {
      ctm = stack.pop() ?? IDENTITY;
    } else if (fn === ops.transform) {
      const matrix = toMatrix(args);
      if (matrix) ctm = multiply(ctm, matrix);
    } else if (fn === ops.paintFormXObjectBegin) {
      stack.push(ctm);
      const matrix = Array.isArray(args) ? toMatrix((args as unknown[])[0]) : null;
      if (matrix) ctm = multiply(ctm, matrix);
    } else if (fn === ops.paintFormXObjectEnd) {
      ctm = stack.pop() ?? IDENTITY;
    } else if (fn === ops.constructPath) {
      const paintOp = Array.isArray(args) && typeof (args as unknown[])[0] === 'number'
        ? (args as number[])[0]
        : null;
      // Un tracé destiné au rognage (endPath) ou à un état inconnu n'est pas un trait.
      if (paintOp !== null && !paintOps.has(paintOp)) continue;

      readPaths(args).forEach((subPath) => {
        if (subPath.hasCurve || subPath.points.length < 2) return;
        const points = subPath.points.map((point) => applyMatrix(ctm, point.x, point.y));

        if (points.length === 2 && !subPath.closed) {
          const [a, b] = points;
          const horizontal = Math.abs(a.y - b.y) <= AXIS_TOLERANCE;
          const vertical = Math.abs(a.x - b.x) <= AXIS_TOLERANCE;
          if ((horizontal || vertical) && Math.hypot(a.x - b.x, a.y - b.y) >= MIN_RULING_LENGTH) {
            segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
          }
          return;
        }

        const xs = points.map((point) => point.x);
        const ys = points.map((point) => point.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const isRectangle = points.every(
          (point) =>
            (Math.abs(point.x - minX) <= AXIS_TOLERANCE || Math.abs(point.x - maxX) <= AXIS_TOLERANCE)
            && (Math.abs(point.y - minY) <= AXIS_TOLERANCE || Math.abs(point.y - maxY) <= AXIS_TOLERANCE),
        );
        if (!isRectangle) return;

        const width = maxX - minX;
        const height = maxY - minY;
        if (Math.max(width, height) < MIN_RULING_LENGTH || Math.min(width, height) >= MAX_RULING_THICKNESS) return;
        if (width >= height) {
          const y = (minY + maxY) / 2;
          segments.push({ x1: minX, y1: y, x2: maxX, y2: y });
        } else {
          const x = (minX + maxX) / 2;
          segments.push({ x1: x, y1: minY, x2: x, y2: maxY });
        }
      });
    }
  }
  return segments;
};

// Projette les segments dans le repère de travail (`mapPoint`), les classe en
// horizontaux ou verticaux, puis fusionne les segments colinéaires.
export const segmentsToRulings = (
  segments: RawSegment[],
  mapPoint: (x: number, y: number) => { x: number; y: number } = (x, y) => ({ x, y }),
): Ruling[] => {
  const raw: Ruling[] = segments.map((segment) => {
    const a = mapPoint(segment.x1, segment.y1);
    const b = mapPoint(segment.x2, segment.y2);
    return Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)
      ? { orientation: 'horizontal', position: (a.y + b.y) / 2, start: Math.min(a.x, b.x), end: Math.max(a.x, b.x) }
      : { orientation: 'vertical', position: (a.x + b.x) / 2, start: Math.min(a.y, b.y), end: Math.max(a.y, b.y) };
  });

  const merged: Ruling[] = [];
  (['horizontal', 'vertical'] as const).forEach((orientation) => {
    const sorted = raw
      .filter((ruling) => ruling.orientation === orientation)
      .sort((a, b) => a.position - b.position || a.start - b.start);

    // Regroupe les positions voisines, puis soude les tronçons qui se touchent.
    const groups: Ruling[][] = [];
    sorted.forEach((ruling) => {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && ruling.position - lastGroup[0].position <= RULING_POSITION_TOLERANCE) lastGroup.push(ruling);
      else groups.push([ruling]);
    });

    groups.forEach((group) => {
      const position = group.reduce((total, ruling) => total + ruling.position, 0) / group.length;
      const byStart = [...group].sort((a, b) => a.start - b.start);
      let current = { start: byStart[0].start, end: byStart[0].end };
      const flush = () => merged.push({ orientation, position, start: current.start, end: current.end });
      byStart.slice(1).forEach((ruling) => {
        if (ruling.start <= current.end + RULING_GAP_TOLERANCE) current.end = Math.max(current.end, ruling.end);
        else {
          flush();
          current = { start: ruling.start, end: ruling.end };
        }
      });
      flush();
    });
  });
  return merged;
};

// Traits d'une page, ramenés dans le repère haut-gauche non pivoté de l'angle donné.
export const extractRulings = (opList: PdfOperatorList, ops: PdfOps, angle = 0): Ruling[] =>
  segmentsToRulings(extractRawSegments(opList, ops), (x, y) => toUprightFrame(x, y, angle));

// ---------------------------------------------------------------------------
// Grille
// ---------------------------------------------------------------------------

const clusterPositions = (positions: number[], tolerance: number): number[] => {
  const sorted = [...positions].sort((a, b) => a - b);
  const clusters: number[][] = [];
  sorted.forEach((value) => {
    const last = clusters[clusters.length - 1];
    if (last && value - last[last.length - 1] <= tolerance) last.push(value);
    else clusters.push([value]);
  });
  return clusters.map((cluster) => cluster.reduce((total, value) => total + value, 0) / cluster.length);
};

const keepSignificant = (rulings: Ruling[]): Ruling[] => {
  const long = rulings.filter((ruling) => ruling.end - ruling.start >= MIN_GRID_LINE_LENGTH);
  if (long.length === 0) return [];
  const extent = Math.max(...long.map((ruling) => ruling.end)) - Math.min(...long.map((ruling) => ruling.start));
  return long.filter((ruling) => ruling.end - ruling.start >= extent * GRID_LINE_EXTENT_RATIO);
};

// Une grille exige au moins trois traits verticaux et trois horizontaux
// significatifs ; sinon la lecture se replie sur les espaces entre colonnes.
export const buildGrid = (rulings: Ruling[]): TableGrid | null => {
  const verticals = keepSignificant(rulings.filter((ruling) => ruling.orientation === 'vertical'));
  const horizontals = keepSignificant(rulings.filter((ruling) => ruling.orientation === 'horizontal'));
  if (verticals.length < 3 || horizontals.length < 3) return null;

  const columnEdges = clusterPositions(verticals.map((ruling) => ruling.position), GRID_EDGE_TOLERANCE);
  const rowEdges = clusterPositions(horizontals.map((ruling) => ruling.position), GRID_EDGE_TOLERANCE);
  if (columnEdges.length < 3 || rowEdges.length < 3) return null;

  // Une dernière ligne ou une dernière colonne peut ne pas avoir de trait de
  // fermeture (bas de page, bord de la page) : l'étendue des traits opposés la ferme.
  const top = Math.min(...verticals.map((ruling) => ruling.start));
  const bottom = Math.max(...verticals.map((ruling) => ruling.end));
  const left = Math.min(...horizontals.map((ruling) => ruling.start));
  const right = Math.max(...horizontals.map((ruling) => ruling.end));
  if (top < rowEdges[0] - GRID_EDGE_TOLERANCE) rowEdges.unshift(top);
  if (bottom > rowEdges[rowEdges.length - 1] + GRID_EDGE_TOLERANCE) rowEdges.push(bottom);
  if (left < columnEdges[0] - GRID_EDGE_TOLERANCE) columnEdges.unshift(left);
  if (right > columnEdges[columnEdges.length - 1] + GRID_EDGE_TOLERANCE) columnEdges.push(right);

  return { columnEdges, rowEdges };
};

// ---------------------------------------------------------------------------
// Colonnes sans grille
// ---------------------------------------------------------------------------

const clusterLines = (words: PdfWord[]): PdfWord[][] => {
  if (words.length === 0) return [];
  const tolerance = Math.max(2, median(words.map((word) => word.height)) * 0.6);
  const sorted = [...words].sort((a, b) => a.yTop + a.height / 2 - (b.yTop + b.height / 2) || a.x - b.x);
  const lines: PdfWord[][] = [];
  let center = 0;
  sorted.forEach((word) => {
    const wordCenter = word.yTop + word.height / 2;
    const last = lines[lines.length - 1];
    if (last && Math.abs(wordCenter - center) <= tolerance) {
      last.push(word);
      center = last.reduce((total, item) => total + item.yTop + item.height / 2, 0) / last.length;
    } else {
      lines.push([word]);
      center = wordCenter;
    }
  });
  return lines.map((line) => line.sort((a, b) => a.x - b.x));
};

// Projection horizontale de tous les mots : une vallée vide plus large que
// 1,5 fois l'espace médian entre deux mots d'une même ligne sépare deux colonnes.
export const detectColumnsByWhitespace = (words: PdfWord[]): number[] | null => {
  if (words.length < 2) return null;

  const gaps: number[] = [];
  clusterLines(words).forEach((line) => {
    for (let index = 1; index < line.length; index += 1) {
      const gap = line[index].x - (line[index - 1].x + line[index - 1].width);
      if (gap > 0) gaps.push(gap);
    }
  });
  const medianSpace = gaps.length > 0 ? median(gaps) : 5;
  const minimumValley = medianSpace * WHITESPACE_VALLEY_RATIO;

  const intervals = words
    .map((word) => ({ start: word.x, end: word.x + word.width }))
    .sort((a, b) => a.start - b.start);
  const covered: { start: number; end: number }[] = [];
  intervals.forEach((interval) => {
    const last = covered[covered.length - 1];
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else covered.push({ ...interval });
  });

  const edges = [covered[0].start - 1];
  for (let index = 1; index < covered.length; index += 1) {
    const valley = covered[index].start - covered[index - 1].end;
    if (valley > minimumValley) edges.push((covered[index].start + covered[index - 1].end) / 2);
  }
  edges.push(covered[covered.length - 1].end + 1);
  return edges.length >= 3 ? edges : null;
};

// ---------------------------------------------------------------------------
// Tableau
// ---------------------------------------------------------------------------

const bandIndex = (edges: number[], value: number): number => {
  for (let index = 0; index < edges.length - 1; index += 1) {
    if (value >= edges[index] && value < edges[index + 1]) return index;
  }
  return -1;
};

const joinWordsInReadingOrder = (words: PdfWord[]): string =>
  compactText(clusterLines(words).map((line) => line.map((word) => word.text).join(' ')).join(' '));

const buildColumns = (edges: number[], rows: string[][], bodyStart: number): TableColumn[] =>
  Array.from({ length: edges.length - 1 }, (_, index) => ({
    index,
    headerText: compactText(rows.slice(0, bodyStart).map((row) => row[index] ?? '').join(' ')),
    xStart: edges[index],
    xEnd: edges[index + 1],
  }));

// Colonne dominée par des codes (au moins 3 valeurs de 3 chiffres ou plus et
// la moitié des cellules non vides).
const findCodeColumn = (rows: string[][], columnCount: number): number => {
  let best = -1;
  let bestCount = 2;
  for (let column = 0; column < columnCount; column += 1) {
    const filled = rows.map((row) => row[column] ?? '').filter((cell) => cell !== '');
    const codes = filled.filter(isCodeCell).length;
    if (codes > bestCount && codes * 2 >= filled.length) {
      best = column;
      bestCount = codes;
    }
  }
  return best;
};

const buildGridTable = (words: PdfWord[], grid: TableGrid): TableLayout => {
  const { columnEdges, rowEdges } = grid;
  const cellWords: PdfWord[][][] = rowEdges.slice(0, -1).map(() => columnEdges.slice(0, -1).map(() => []));

  words.forEach((word) => {
    const column = bandIndex(columnEdges, word.x + word.width / 2);
    const row = bandIndex(rowEdges, word.yTop + word.height / 2);
    if (column >= 0 && row >= 0) cellWords[row][column].push(word);
  });

  const allRows = cellWords.map((row) => row.map(joinWordsInReadingOrder));
  const rows = allRows.filter((row) => row.some((cell) => cell !== ''));

  const codeColumn = findCodeColumn(rows, columnEdges.length - 1);
  const firstProduct = codeColumn >= 0 ? rows.findIndex((row) => isCodeCell(row[codeColumn])) : -1;
  const bodyStart = firstProduct > 0 ? firstProduct : 0;

  return { source: 'grille', columns: buildColumns(columnEdges, rows, bodyStart), rows, bodyStart };
};

const buildColumnsTable = (words: PdfWord[], edges: number[]): TableLayout => {
  const lines = clusterLines(words);
  const lineCells = lines.map((line) => {
    const cells: PdfWord[][] = edges.slice(0, -1).map(() => []);
    line.forEach((word) => {
      const column = bandIndex(edges, word.x + word.width / 2);
      if (column >= 0) cells[column].push(word);
    });
    return cells.map(joinWordsInReadingOrder);
  });
  const lineYs = lines.map((line) => line.reduce((total, word) => total + word.yTop, 0) / line.length);
  const columnCount = edges.length - 1;

  const codeColumn = findCodeColumn(lineCells, columnCount);
  const textLengths = Array.from({ length: columnCount }, (_, column) =>
    lineCells.reduce((total, cells) => total + cells[column].length, 0));
  let articleColumn = -1;
  textLengths.forEach((length, column) => {
    if (column !== codeColumn && (articleColumn === -1 || length > textLengths[articleColumn])) articleColumn = column;
  });

  const isAnchor = (cells: string[]): boolean => codeColumn >= 0
    ? isCodeCell(cells[codeColumn])
    : cells.some((cell, column) => column !== articleColumn && cell !== '');

  const anchors = lineCells.map((cells, index) => (isAnchor(cells) ? index : -1)).filter((index) => index >= 0);
  if (anchors.length === 0) {
    return { source: 'colonnes', columns: buildColumns(edges, lineCells, 0), rows: lineCells, bodyStart: 0 };
  }

  // Une ligne sans ancre se rattache à l'ancre la plus proche, y compris la
  // première ligne d'un libellé placée au-dessus de son code (code centré dans
  // la cellule). Au-delà de cette distance elle reste une ligne à part : avant
  // la première ancre c'est l'en-tête, après la dernière un pied de page.
  const maxAttachDistance = Math.max(8, median(words.map((word) => word.height)) * 2.2);
  const nearestAnchor = (lineIndex: number): number => {
    let nearest = 0;
    anchors.forEach((anchor, position) => {
      if (Math.abs(lineYs[anchor] - lineYs[lineIndex]) < Math.abs(lineYs[anchors[nearest]] - lineYs[lineIndex])) {
        nearest = position;
      }
    });
    return nearest;
  };
  const groups: number[][] = anchors.map((anchor) => [anchor]);
  const orphanLines: number[] = [];
  lineCells.forEach((_cells, lineIndex) => {
    if (anchors.includes(lineIndex)) return;
    const nearest = nearestAnchor(lineIndex);
    if (Math.abs(lineYs[anchors[nearest]] - lineYs[lineIndex]) <= maxAttachDistance) groups[nearest].push(lineIndex);
    else orphanLines.push(lineIndex);
  });

  const entries = [
    ...groups.map((group) => ({
      y: Math.min(...group.map((lineIndex) => lineYs[lineIndex])),
      cells: Array.from({ length: columnCount }, (_, column) =>
        compactText([...group].sort((x, y) => x - y).map((lineIndex) => lineCells[lineIndex][column]).join(' '))),
      isProduct: true,
    })),
    ...orphanLines.map((lineIndex) => ({ y: lineYs[lineIndex], cells: lineCells[lineIndex], isProduct: false })),
  ].sort((x, y) => x.y - y.y);

  // Les lignes à part situées avant le premier produit forment l'en-tête.
  const firstProductEntry = entries.findIndex((entry) => entry.isProduct);
  const headerRows = entries.slice(0, firstProductEntry).map((entry) => entry.cells);
  const productRows = entries.slice(firstProductEntry).map((entry) => entry.cells);

  const rows = [...headerRows, ...productRows];
  const bodyStart = codeColumn >= 0 ? headerRows.length : 0;
  return { source: 'colonnes', columns: buildColumns(edges, rows, bodyStart), rows, bodyStart };
};

// Avec une grille, une bande de ligne est un produit ; sinon les colonnes
// viennent des espaces et un produit commence à sa valeur Code (ou, sans
// colonne Code, à sa première cellule d'unité non vide).
//
// `columnEdgesHint` : bornes de colonnes d'une page précédente, utilisées à la
// place de la détection par espaces quand la page n'a pas de grille (dernière
// page très courte, par exemple).
export const buildTable = (
  words: PdfWord[],
  grid: TableGrid | null,
  columnEdgesHint?: number[],
): TableLayout | null => {
  if (words.length === 0) return null;
  if (grid) return buildGridTable(words, grid);
  const edges = columnEdgesHint && columnEdgesHint.length >= 3
    ? columnEdgesHint
    : detectColumnsByWhitespace(words);
  return edges ? buildColumnsTable(words, edges) : null;
};
