// Lecture du tableau des allergènes d'un site (PDF exporté d'Excel : lignes =
// plats, colonnes = les 14 allergènes réglementaires, case colorée = contient).
// Module pur : aucune dépendance à React, Supabase ni pdf.js.
//
// Règle de sécurité : une information sur les allergènes n'est JAMAIS devinée.
// Au moindre doute (colonnes manquantes ou ambiguës, case partiellement
// colorée, aucun plat), la lecture est REFUSÉE avec un message clair : pas
// d'import partiel.

import { ALLERGEN_CODES, ALLERGEN_HEADER_LABELS, type AllergenCode } from './manualConstants';
import { groupLines, itemsText, normalizeText, type ManualTextItem } from './manualIndexer';

// Élément de texte d'une page, avec sa boîte englobante (les libellés d'en-tête
// sont souvent écrits à la verticale : la rotation est prise en compte à la lecture).
export interface AllergenTextItem {
  str: string;
  // Origine et taille, comme ManualTextItem (x, y = ligne de base de départ).
  x: number;
  y: number;
  size: number;
  width: number;
  // Texte tourné de 90° ou 270°.
  vertical: boolean;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

// Rectangle rempli d'une couleur autre que le blanc (origine PDF, y vers le haut).
export interface AllergenRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// Trait vertical (bordure de colonne).
export interface AllergenVLine {
  x: number;
  y0: number;
  y1: number;
}

export interface AllergenPageData {
  page: number;
  items: AllergenTextItem[];
  rects: AllergenRect[];
  vlines: AllergenVLine[];
}

export interface AllergenDish {
  categorie: string;
  nom: string;
  nomNormalise: string;
  allergenes: AllergenCode[];
  page: number;
}

// Ligne de texte de la première colonne du tableau qui n'est devenue ni plat ni catégorie.
export interface AllergenIgnoredLine {
  page: number;
  text: string;
}

export interface AllergenDocument {
  plats: AllergenDish[];
  // Lignes ignorées : le dépôt doit être revu avant d'être confirmé.
  ignorees: AllergenIgnoredLine[];
  // Date de mise à jour au format AAAA-MM-JJ, ou null si elle n'est pas dans le PDF.
  date: string | null;
}

export type AllergenReadResult =
  | { ok: true; document: AllergenDocument; error?: undefined }
  | { ok: false; error: string; document?: undefined };

const refuse = (error: string): AllergenReadResult => ({ ok: false, error });

const labelKey = (value: string): string => normalizeText(value).replace(/[^a-z0-9]+/g, ' ').trim();

const LABEL_TO_CODE: ReadonlyMap<string, AllergenCode> = (() => {
  const map = new Map<string, AllergenCode>();
  for (const code of ALLERGEN_CODES) {
    for (const label of ALLERGEN_HEADER_LABELS[code]) map.set(labelKey(label), code);
  }
  return map;
})();

const MAX_LABEL_LENGTH = 30;

interface HeaderCandidate {
  code: AllergenCode;
  vertical: boolean;
  cx: number;
  cy: number;
  size: number;
  y0: number;
  y1: number;
}

interface Column {
  code: AllergenCode;
  cx: number;
}

interface PageColumns {
  columns: Column[];
  // Les plats sont sous cette ordonnée (bas de l'en-tête) ; +infini si l'en-tête n'est pas sur la page.
  headerBottom: number;
}

const center = (item: AllergenTextItem) => ({ cx: (item.x0 + item.x1) / 2, cy: (item.y0 + item.y1) / 2 });

// Libellés d'en-tête seuls ou répartis sur deux lignes (« Fruits à » / « coques »),
// à la verticale ou à l'horizontale.
function headerCandidates(items: AllergenTextItem[]): HeaderCandidate[] {
  const short = items.filter((item) => item.str.trim().length > 0 && item.str.trim().length <= MAX_LABEL_LENGTH);
  const candidates: HeaderCandidate[] = [];
  const add = (code: AllergenCode, group: AllergenTextItem[]) => {
    const x0 = Math.min(...group.map((item) => item.x0));
    const x1 = Math.max(...group.map((item) => item.x1));
    const y0 = Math.min(...group.map((item) => item.y0));
    const y1 = Math.max(...group.map((item) => item.y1));
    candidates.push({
      code,
      vertical: group[0].vertical,
      cx: (x0 + x1) / 2,
      cy: (y0 + y1) / 2,
      size: Math.max(...group.map((item) => item.size)),
      y0,
      y1,
    });
  };
  const textOf = (item: AllergenTextItem) => item.str.trim();
  for (const item of short) {
    const code = LABEL_TO_CODE.get(labelKey(textOf(item)));
    if (code) add(code, [item]);
  }
  for (let i = 0; i < short.length; i += 1) {
    for (let j = i + 1; j < short.length; j += 1) {
      const a = short[i];
      const b = short[j];
      if (a.vertical !== b.vertical) continue;
      const size = Math.max(a.size, b.size);
      const ca = center(a);
      const cb = center(b);
      const adjacent = a.vertical
        ? Math.abs(ca.cx - cb.cx) <= size * 2.2 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0
        : Math.abs(ca.cy - cb.cy) <= size * 2.2 && Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0;
      if (!adjacent) continue;
      const code = LABEL_TO_CODE.get(labelKey(`${textOf(a)} ${textOf(b)}`)) ?? LABEL_TO_CODE.get(labelKey(`${textOf(b)} ${textOf(a)}`));
      if (code) add(code, [a, b]);
    }
  }
  return candidates;
}

type HeaderDetection =
  | { kind: 'none' }
  | { kind: 'ambiguous'; codes: AllergenCode[] }
  | { kind: 'found'; columns: PageColumns };

function detectHeader(items: AllergenTextItem[]): HeaderDetection {
  const all = headerCandidates(items);
  const distinct = (list: HeaderCandidate[]) => new Set(list.map((candidate) => candidate.code)).size;
  const vertical = all.filter((candidate) => candidate.vertical);
  const horizontal = all.filter((candidate) => !candidate.vertical);
  let chosen = distinct(vertical) >= distinct(horizontal) ? vertical : horizontal;

  // En-tête horizontal : les libellés sont sur une même ligne (les mots d'un plat qui
  // porteraient le nom d'un allergène, ailleurs dans le tableau, sont écartés).
  if (chosen.length > 0 && !chosen[0].vertical) {
    const tolerance = Math.max(...chosen.map((candidate) => candidate.size)) * 0.8;
    let best: HeaderCandidate[] = [];
    for (const anchor of chosen) {
      const group = chosen.filter((candidate) => Math.abs(candidate.cy - anchor.cy) <= tolerance);
      if (distinct(group) > distinct(best)) best = group;
    }
    chosen = best;
  }

  // Un libellé d'allergène écrit aussi ailleurs (nom de plat dans la première colonne :
  // « Œufs mayonnaise », « Lait ribot »…) n'est jamais un libellé de colonne : seuls
  // comptent les candidats situés dans l'étendue horizontale des libellés sans doublon.
  const occurrences = (code: AllergenCode) => chosen.filter((candidate) => candidate.code === code).length;
  const unique = chosen.filter((candidate) => occurrences(candidate.code) === 1);
  if (unique.length > 0) {
    const low = Math.min(...unique.map((candidate) => candidate.cx));
    const high = Math.max(...unique.map((candidate) => candidate.cx));
    chosen = chosen.filter((candidate) => occurrences(candidate.code) === 1 || (candidate.cx >= low && candidate.cx <= high));
  }

  const codes = [...new Set(chosen.map((candidate) => candidate.code))];
  if (codes.length < ALLERGEN_CODES.length) return { kind: 'none' };
  if (chosen.length !== codes.length) return { kind: 'ambiguous', codes };

  const columns = chosen.map((candidate) => ({ code: candidate.code, cx: candidate.cx })).sort((a, b) => a.cx - b.cx);
  return { kind: 'found', columns: { columns, headerBottom: Math.min(...chosen.map((candidate) => candidate.y0)) } };
}

interface Geometry {
  // bounds[i] et bounds[i + 1] encadrent la colonne i.
  bounds: number[];
  centers: number[];
}

// Bornes des colonnes : traits verticaux du tableau, sinon milieux entre les
// centres des libellés.
// Grille régulière de n + 1 traits verticaux (une colonne entre deux traits). Les
// libellés penchés ne sont pas centrés sur leur colonne : si la grille est
// unique, la i-ème colonne de gauche à droite est celle du i-ème libellé.
function gridFromVlines(columns: Column[], vlines: AllergenVLine[]): number[] | null {
  const n = columns.length;
  const pitch = (columns[n - 1].cx - columns[0].cx) / (n - 1);
  if (!(pitch > 1)) return null;
  const sorted = vlines.map((line) => line.x).sort((a, b) => a - b);
  const xs: number[] = [];
  for (const x of sorted) {
    if (xs.length === 0 || x - xs[xs.length - 1] > 0.8) xs.push(x);
  }
  const grids: number[][] = [];
  for (const start of xs) {
    const grid = [start];
    for (let k = 1; k <= n; k += 1) {
      const expected = start + pitch * k;
      const near = xs.filter((x) => Math.abs(x - expected) <= pitch * 0.12).sort((a, b) => Math.abs(a - expected) - Math.abs(b - expected));
      if (near.length === 0) break;
      grid.push(near[0]);
    }
    if (grid.length === n + 1) grids.push(grid);
  }
  // Grille unique seulement : sinon la correspondance libellé / colonne serait ambiguë.
  return grids.length === 1 ? grids[0] : null;
}

function columnGeometry(columns: Column[], vlines: AllergenVLine[]): Geometry {
  const n = columns.length;
  const grid = gridFromVlines(columns, vlines);
  if (grid) return { bounds: grid, centers: columns.map((_, i) => (grid[i] + grid[i + 1]) / 2) };
  const bounds: number[] = new Array<number>(n + 1).fill(0);
  for (let i = 1; i < n; i += 1) {
    const left = columns[i - 1].cx;
    const right = columns[i].cx;
    const mid = (left + right) / 2;
    const near = vlines
      .map((line) => line.x)
      .filter((x) => x > left && x < right && Math.abs(x - mid) <= (right - left) * 0.45)
      .sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
    bounds[i] = near.length > 0 ? near[0] : mid;
  }
  bounds[0] = columns[0].cx - (bounds[1] - columns[0].cx);
  bounds[n] = columns[n - 1].cx + (columns[n - 1].cx - bounds[n - 1]);
  const centers = columns.map((_, i) => (bounds[i] + bounds[i + 1]) / 2);
  return { bounds, centers };
}

const toManualItem = (item: AllergenTextItem): ManualTextItem => ({
  str: item.str, x: item.x0, y: item.y0, size: item.size, width: item.x1 - item.x0,
});

const DATE_PATTERN = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g;

function toIso(day: string, month: string, year: string): string | null {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2000 || y > 2100) return null;
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Date JJ/MM/AAAA la plus proche des mots « mise à jour » ; à défaut la dernière
// date trouvée ; à défaut null.
export function findUpdateDate(text: string): string | null {
  const dates: { index: number; iso: string }[] = [];
  for (const match of text.matchAll(DATE_PATTERN)) {
    const iso = toIso(match[1], match[2], match[3]);
    if (iso && match.index !== undefined) dates.push({ index: match.index, iso });
  }
  if (dates.length === 0) return null;
  const folded = normalizeText(text);
  // normalizeText ne change pas les positions des caractères de base : les dates restent alignées.
  const anchors: number[] = [];
  const anchor = /mises? a jour/g;
  for (let found = anchor.exec(folded); found; found = anchor.exec(folded)) anchors.push(found.index);
  if (anchors.length === 0) return dates[dates.length - 1].iso;
  let best = dates[0];
  let bestDistance = Infinity;
  for (const date of dates) {
    for (const at of anchors) {
      const distance = Math.abs(date.index - at);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = date;
      }
    }
  }
  return best.iso;
}

interface NameLine {
  text: string;
  // Ligne de base (pour reconnaître un pied de page répété à la même hauteur).
  y: number;
  cy: number;
  x0: number;
}

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const AVERTISSEMENT = /mise a jour|contamination|allergene|document officiel|^page\b|\b\d{1,2}[/.-]\d{1,2}[/.-]\d{4}\b/;

export function readAllergenPages(pages: AllergenPageData[]): AllergenReadResult {
  if (pages.length === 0) return refuse('Le PDF ne contient aucune page.');

  // Texte horizontal de toutes les pages : lignes répétées (pieds de page) et date.
  const pageLines = pages.map((page) => {
    const horizontal = page.items.filter((item) => !item.vertical && item.str.trim().length > 0).map(toManualItem);
    const size = median(horizontal.map((item) => item.size)) || 9;
    return groupLines(horizontal, Math.max(1.5, size * 0.4)).map((line) => ({ text: itemsText(line.items), y: line.y }));
  });
  // Pied de page = même texte À LA MÊME HAUTEUR sur au moins la moitié des pages. Un plat qui revient
  // sur plusieurs pages (menus, formules) à des hauteurs différentes n'est PAS un pied de page.
  const positions = new Map<string, { page: number; y: number }[]>();
  pageLines.forEach((lines, pageIndex) => {
    for (const line of lines) {
      const key = normalizeText(line.text);
      positions.set(key, [...(positions.get(key) ?? []), { page: pageIndex, y: line.y }]);
    }
  });
  const repeatedNeeded = Math.max(2, Math.ceil(pages.length / 2));
  const isRepeated = (text: string, y: number) => {
    const seen = positions.get(normalizeText(text)) ?? [];
    return new Set(seen.filter((entry) => Math.abs(entry.y - y) <= 3.5).map((entry) => entry.page)).size >= repeatedNeeded;
  };

  const date = findUpdateDate(pageLines.map((lines) => lines.map((line) => line.text).join('\n')).join('\n'));

  let current: PageColumns | null = null;
  let category = ''; // la catégorie continue d'une page à la suivante
  const plats: AllergenDish[] = [];
  const ignorees: AllergenIgnoredLine[] = [];

  for (const page of pages) {
    const detection = detectHeader(page.items);
    if (detection.kind === 'ambiguous') {
      return refuse('Dépôt refusé : un libellé d’allergène apparaît plusieurs fois dans l’en-tête du tableau (page ' + page.page + ').');
    }
    if (detection.kind === 'found') current = detection.columns;
    else if (current) current = { columns: current.columns, headerBottom: Infinity };
    if (!current) continue;

    const active: PageColumns = current;
    const geometry = columnGeometry(active.columns, page.vlines);
    const { bounds, centers } = geometry;
    const tableLeft = bounds[0];
    const lastCenter = centers[centers.length - 1];

    // Plats : lignes de texte horizontales à gauche de la première colonne, sous l'en-tête.
    const bodySize = median(page.items.filter((item) => !item.vertical).map((item) => item.size)) || 9;
    const nameItems = page.items
      .filter(
        (item) =>
          !item.vertical &&
          item.str.trim().length > 0 &&
          item.x1 <= tableLeft + bodySize * 0.5 &&
          center(item).cy < active.headerBottom,
      )
      .sort((a, b) => center(b).cy - center(a).cy);
    const lines: NameLine[] = [];
    let group: AllergenTextItem[] = [];
    const flush = () => {
      if (group.length === 0) return;
      const ordered = [...group].sort((a, b) => a.x0 - b.x0);
      lines.push({
        text: itemsText(ordered.map(toManualItem)),
        y: Math.min(...group.map((item) => item.y0)),
        cy: (Math.min(...group.map((item) => item.y0)) + Math.max(...group.map((item) => item.y1))) / 2,
        x0: ordered[0].x0,
      });
      group = [];
    };
    for (const item of nameItems) {
      if (group.length > 0 && Math.abs(center(group[0]).cy - center(item).cy) > Math.max(1.5, bodySize * 0.4)) flush();
      group.push(item);
    }
    flush();
    const rowHeight = median(lines.slice(1).map((line, i) => Math.abs(lines[i].cy - line.cy)));
    const nameLeft = lines.length > 0 ? Math.min(...lines.map((line) => line.x0)) : tableLeft;

    // Bords de la zone du tableau : traits verticaux s'il y en a.
    const lineTop = page.vlines.length > 0 ? Math.max(...page.vlines.map((line) => line.y1)) + bodySize : Infinity;
    const lineBottom = page.vlines.length > 0 ? Math.min(...page.vlines.map((line) => line.y0)) - bodySize : -Infinity;

    // Rectangles colorés : barres de catégorie (toute la largeur du tableau), arrière-plans
    // (écartés) et cases. Les traits très fins sont des bordures, pas des cases.
    const bars: AllergenRect[] = [];
    const cells: AllergenRect[] = [];
    for (const rect of page.rects) {
      if (rect.x1 - rect.x0 < 1.5 || rect.y1 - rect.y0 < 1.5) continue;
      const coversTable = rect.x0 <= nameLeft + bodySize && rect.x1 >= lastCenter;
      const height = rect.y1 - rect.y0;
      if (coversTable) {
        if (rowHeight > 0 && height > rowHeight * 3) continue; // arrière-plan de page ou de tableau
        bars.push(rect);
      } else {
        cells.push(rect);
      }
    }

    interface Event { cy: number; kind: 'category' | 'dish'; text: string }
    const events: Event[] = [];
    const insideBar = (cy: number) => bars.find((bar) => cy >= bar.y0 && cy <= bar.y1);
    for (const bar of bars) {
      const inside = page.items.filter((item) => {
        const c = center(item);
        return !item.vertical && c.cy >= bar.y0 && c.cy <= bar.y1 && c.cx >= bar.x0 && c.cx <= bar.x1 && item.str.trim().length > 0;
      });
      const text = itemsText(inside.map(toManualItem));
      const cy = (bar.y0 + bar.y1) / 2;
      if (!text || cy >= active.headerBottom || cy > lineTop || cy < lineBottom) continue;
      // Un texte uniquement dans la première colonne d'une ligne entièrement colorée est un plat,
      // pas une catégorie : ses cases sont masquées par la couleur, donc illisibles.
      const onlyNameColumn = inside.every((item) => item.x1 <= tableLeft + bodySize * 0.5);
      if (onlyNameColumn) {
        return refuse(
          `Dépôt refusé : la ligne « ${text} » est entièrement colorée (page ${page.page}), ses allergènes ne peuvent pas être lus avec certitude.`,
        );
      }
      events.push({ cy, kind: 'category', text });
    }
    // Texte à cheval sur la première colonne et les colonnes d'allergènes (paragraphe, nom trop long) :
    // jamais lu comme un plat, donc signalé (sauf catégories dans une barre et avertissements connus).
    for (const item of page.items) {
      const c = center(item);
      if (item.vertical || item.str.trim().length === 0 || c.cy >= active.headerBottom || c.cy > lineTop || c.cy < lineBottom) continue;
      if (item.x0 < tableLeft && item.x1 > tableLeft + bodySize * 0.5 && !insideBar(c.cy) && !AVERTISSEMENT.test(normalizeText(item.str))) {
        ignorees.push({ page: page.page, text: item.str.trim() });
      }
    }

    for (const line of lines) {
      if (insideBar(line.cy)) continue;
      if (line.cy > lineTop || line.cy < lineBottom) continue;
      if (isRepeated(line.text, line.y) || AVERTISSEMENT.test(normalizeText(line.text))) {
        ignorees.push({ page: page.page, text: line.text });
        continue;
      }
      events.push({ cy: line.cy, kind: 'dish', text: line.text });
    }
    events.sort((a, b) => b.cy - a.cy);


    for (const event of events) {
      if (event.kind === 'category') {
        category = event.text;
        continue;
      }
      const covering = cells.filter((rect) => event.cy >= rect.y0 && event.cy <= rect.y1);
      // Case partiellement colorée : un bord de rectangle tombe au milieu d'une colonne.
      for (const rect of covering) {
        for (const edge of [rect.x0, rect.x1]) {
          for (let i = 0; i < centers.length; i += 1) {
            const inner = (bounds[i + 1] - bounds[i]) * 0.3;
            if (edge > bounds[i] + inner && edge < bounds[i + 1] - inner) {
              return refuse(
                `Dépôt refusé : une case colorée du plat « ${event.text} » est partiellement remplie (page ${page.page}), l’allergène ne peut pas être lu avec certitude.`,
              );
            }
          }
        }
      }
      const allergenes: AllergenCode[] = [];
      active.columns.forEach((column, i) => {
        if (covering.some((rect) => rect.x0 <= centers[i] && centers[i] <= rect.x1)) allergenes.push(column.code);
      });
      plats.push({
        categorie: category,
        nom: event.text,
        nomNormalise: normalizeText(event.text),
        allergenes: ALLERGEN_CODES.filter((code) => allergenes.includes(code)),
        page: page.page,
      });
    }
  }

  if (!current) {
    return refuse('Dépôt refusé : les 14 colonnes d’allergènes n’ont pas toutes été retrouvées dans l’en-tête du tableau.');
  }
  if (plats.length === 0) return refuse('Dépôt refusé : aucun plat n’a été trouvé dans le tableau.');
  return { ok: true, document: { plats, date, ignorees } };
}
