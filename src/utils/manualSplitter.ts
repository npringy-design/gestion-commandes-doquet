// Découpage d'un manuel opératoire (PDF avec vrai texte) en fiches.
// Module pur : aucune dépendance à React, Supabase ni pdf.js. Les éléments de
// texte viennent d'un adaptateur (manualPdfReader.ts) ; ici on ne fait que de
// la géométrie et de la reconnaissance d'en-têtes.

export type SectionType =
  | 'ingredients'
  | 'mise_en_place'
  | 'a_la_commande'
  | 'dressage'
  | 'qualite'
  | 'autre';

export interface ManualSection {
  type: SectionType;
  libelle: string;
  texte: string;
}

export interface ManualFiche {
  titre: string;
  titreNormalise: string;
  page: number;
  ordre: number;
  sections: ManualSection[];
  sousFiches: string[];
}

// Élément de texte d'une page. x/y : origine PDF (y vers le haut), y = ligne de base.
export interface ManualTextItem {
  str: string;
  x: number;
  y: number;
  size: number;
  width: number;
}

export interface ManualPageItems {
  page: number;
  items: ManualTextItem[];
}

// Seuil de titre : taille >= 1,5 fois la taille médiane du document.
export const TITLE_SIZE_RATIO = 1.5;

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

interface Line {
  y: number;
  items: ManualTextItem[];
}

function groupLines(items: ManualTextItem[], tolerance: number): Line[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];
  for (const item of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - item.y) <= tolerance) {
      last.items.push(item);
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }
  for (const line of lines) line.items.sort((a, b) => a.x - b.x);
  return lines;
}

function lineText(line: Line): string {
  return line.items
    .map((item) => item.str.trim())
    .filter((part) => part.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const COPYRIGHT_PATTERN = /©\s*copyright|\(c\)\s*copyright/i;
const BULLET_PREFIX = /^[\s❑□▪•■☐]+/u;

interface HeaderMatch {
  type: SectionType;
  libelle: string;
  rest: string;
}

function matchHeader(rawText: string): HeaderMatch | null {
  const text = rawText.replace(BULLET_PREFIX, '').trim();
  const normalized = normalizeText(text);
  const colon = text.indexOf(':');
  const before = colon >= 0 ? text.slice(0, colon).trim() : text;
  const rest = colon >= 0 ? text.slice(colon + 1).trim() : '';

  if (/^ingredients?\s+pour\b/.test(normalized)) {
    return { type: 'ingredients', libelle: before, rest };
  }
  if (colon < 0) return null;
  const head = normalizeText(before);
  if (head === 'en mise en place') return { type: 'mise_en_place', libelle: before, rest };
  if (head === 'a la commande') return { type: 'a_la_commande', libelle: before, rest };
  if (head === 'dressage') return { type: 'dressage', libelle: before, rest };
  if (head === 'qualite') return { type: 'qualite', libelle: before, rest };
  return null;
}

// Noms de sous-fiches : « SF » suivi d'un nom dans une ligne d'ingrédient.
function extractSousFiches(texte: string): string[] {
  const names: string[] = [];
  for (const line of texte.split('\n')) {
    const match = /(?:^|\s)SF\s+(.+)$/i.exec(line);
    if (!match) continue;
    const name = normalizeText(match[1]);
    if (name) names.push(name);
  }
  return names;
}

interface TitleBlock {
  text: string;
  y: number;
  size: number;
}

function findTitles(items: ManualTextItem[], threshold: number, tolerance: number): TitleBlock[] {
  const big = items.filter((item) => item.size >= threshold && item.str.trim().length > 0);
  const lines = groupLines(big, tolerance);
  const blocks: TitleBlock[] = [];
  let lastLineY = 0;
  for (const line of lines) {
    const size = Math.max(...line.items.map((item) => item.size));
    const last = blocks[blocks.length - 1];
    if (last && lastLineY - line.y <= size * 2.2) {
      last.text = `${last.text} ${lineText(line)}`.trim();
    } else {
      blocks.push({ text: lineText(line), y: line.y, size });
    }
    lastLineY = line.y;
  }
  return blocks;
}

function readSections(bodyItems: ManualTextItem[], tolerance: number): ManualSection[] {
  const lines = groupLines(bodyItems, tolerance).filter((line) => !COPYRIGHT_PATTERN.test(lineText(line)));
  if (lines.length === 0) return [];

  // Frontière entre colonnes : position horizontale de l'en-tête DRESSAGE.
  let boundary = Number.POSITIVE_INFINITY;
  for (const line of lines) {
    for (const item of line.items) {
      const header = matchHeader(item.str);
      if (header && header.type === 'dressage') boundary = Math.min(boundary, item.x);
    }
  }
  const margin = tolerance;
  const splitColumn = (column: 'left' | 'right'): Line[] => {
    const wanted = bodyItems.filter((item) => (column === 'left' ? item.x < boundary - margin : item.x >= boundary - margin));
    return groupLines(wanted, tolerance).filter((line) => !COPYRIGHT_PATTERN.test(lineText(line)));
  };
  const columns = boundary === Number.POSITIVE_INFINITY ? [splitColumn('left')] : [splitColumn('left'), splitColumn('right')];

  const sections: ManualSection[] = [];
  for (const columnLines of columns) {
    let current: { type: SectionType; libelle: string; parts: string[] } | null = null;
    const flush = () => {
      if (current) {
        sections.push({ type: current.type, libelle: current.libelle, texte: current.parts.join('\n').trim() });
        current = null;
      }
    };
    for (const line of columnLines) {
      const text = lineText(line);
      if (!text) continue;
      const header = matchHeader(text);
      if (header) {
        flush();
        current = { type: header.type, libelle: header.libelle, parts: header.rest ? [header.rest] : [] };
      } else if (current) {
        current.parts.push(text);
      }
    }
    flush();
  }
  return sections;
}

export function splitManualPages(pages: ManualPageItems[]): ManualFiche[] {
  const sizes = pages.flatMap((page) =>
    page.items.filter((item) => item.str.trim().length > 0 && item.size > 0).map((item) => item.size),
  );
  const bodySize = median(sizes);
  if (bodySize <= 0) return [];
  const threshold = bodySize * TITLE_SIZE_RATIO;
  const tolerance = Math.max(1.5, bodySize * 0.4);

  const fiches: ManualFiche[] = [];
  for (const page of pages) {
    const items = page.items.filter((item) => item.str.trim().length > 0);
    const titles = findTitles(items, threshold, tolerance);
    if (titles.length === 0) continue;
    const bodyItems = items.filter((item) => item.size < threshold);

    titles.forEach((title, index) => {
      const next = titles[index + 1];
      const zone = bodyItems.filter((item) => item.y < title.y && (!next || item.y > next.y));
      const sections = readSections(zone, tolerance);
      if (sections.length === 0) return;
      const sousFiches = new Set<string>();
      for (const section of sections) {
        if (section.type === 'ingredients') extractSousFiches(section.texte).forEach((name) => sousFiches.add(name));
      }
      fiches.push({
        titre: title.text,
        titreNormalise: normalizeText(title.text),
        page: page.page,
        ordre: fiches.length,
        sections,
        sousFiches: [...sousFiches],
      });
    });
  }
  return fiches;
}
