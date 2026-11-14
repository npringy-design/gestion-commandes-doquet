// Indexation générique d'un manuel opératoire (PDF avec vrai texte) en trois
// niveaux : pages, fiches, rubriques. Module pur : aucune dépendance à React,
// Supabase ni pdf.js. Rien de propre à une marque : les en-têtes de rubriques,
// les lignes à ignorer et le préfixe de sous-fiche viennent des réglages du site.

export type SectionType =
  | 'ingredients'
  | 'mise_en_place'
  | 'a_la_commande'
  | 'dressage'
  | 'qualite'
  | 'autre';

export const SECTION_TYPES: readonly SectionType[] = [
  'ingredients',
  'mise_en_place',
  'a_la_commande',
  'dressage',
  'qualite',
  'autre',
];

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  ingredients: 'Ingrédients',
  mise_en_place: 'Mise en place',
  a_la_commande: 'À la commande',
  dressage: 'Dressage',
  qualite: 'Qualité',
  autre: 'Autre',
};

export interface HeaderRule {
  text: string;
  type: SectionType;
}

export interface ManualIndexSettings {
  headers: HeaderRule[];
  ignoredLines: string[];
  subFichePrefix: string;
}

export interface ManualSection {
  typeRubrique: SectionType;
  libelle: string;
  texte: string;
}

export interface IndexedPage {
  page: number;
  texte: string;
}

export interface IndexedFiche {
  titre: string;
  titreNormalise: string;
  page: number;
  ordre: number;
  sections: ManualSection[];
  sousFiches: string[];
}

export type IndexLevel = 1 | 2 | 3;

export interface ManualIndex {
  nbPages: number;
  niveau: IndexLevel;
  pages: IndexedPage[];
  fiches: IndexedFiche[];
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

// Un titre est un texte de taille >= 1,5 fois la taille médiane du document.
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

function itemsText(items: ManualTextItem[]): string {
  return items
    .map((item) => item.str.trim())
    .filter((part) => part.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function itemEnd(item: ManualTextItem): number {
  const width = item.width > 0 ? item.width : item.str.length * item.size * 0.5;
  return item.x + width;
}

// Une ligne visuelle peut contenir plusieurs colonnes : on la découpe en
// séquences d'éléments séparées par un grand espace horizontal.
function splitRuns(line: Line, gap: number): ManualTextItem[][] {
  const runs: ManualTextItem[][] = [];
  for (const item of line.items) {
    const run = runs[runs.length - 1];
    if (run && item.x - itemEnd(run[run.length - 1]) <= gap) {
      run.push(item);
    } else {
      runs.push([item]);
    }
  }
  return runs;
}

const BULLET_PREFIX = /^[\s❑□▪•■☐◦·\-–—*]+/u;

function matchHeader(rawText: string, headers: readonly HeaderRule[]): { type: SectionType; libelle: string; rest: string } | null {
  if (headers.length === 0) return null;
  const stripped = rawText.replace(BULLET_PREFIX, '').trim();
  if (!stripped) return null;
  const normalized = normalizeText(stripped);
  let best: HeaderRule | null = null;
  let bestLength = 0;
  for (const rule of headers) {
    const head = normalizeText(rule.text);
    if (head.length > bestLength && normalized.startsWith(head)) {
      best = rule;
      bestLength = head.length;
    }
  }
  if (!best) return null;
  const colon = stripped.indexOf(':');
  return colon >= 0
    ? { type: best.type, libelle: stripped.slice(0, colon).trim(), rest: stripped.slice(colon + 1).trim() }
    : { type: best.type, libelle: stripped, rest: '' };
}

function dropIgnoredRuns(items: ManualTextItem[], ignored: string[], tolerance: number, gap: number): ManualTextItem[] {
  if (ignored.length === 0) return items;
  const kept: ManualTextItem[] = [];
  for (const line of groupLines(items, tolerance)) {
    for (const run of splitRuns(line, gap)) {
      const text = normalizeText(itemsText(run));
      if (!ignored.some((pattern) => text.includes(pattern))) kept.push(...run);
    }
  }
  return kept;
}

interface TitleBlock {
  text: string;
  y: number;
}

function findTitles(items: ManualTextItem[], threshold: number, tolerance: number): TitleBlock[] {
  const big = items.filter((item) => item.size >= threshold);
  const blocks: TitleBlock[] = [];
  let lastLineY = 0;
  for (const line of groupLines(big, tolerance)) {
    const size = Math.max(...line.items.map((item) => item.size));
    const text = itemsText(line.items);
    const last = blocks[blocks.length - 1];
    if (last && lastLineY - line.y <= size * 2.2) {
      last.text = `${last.text} ${text}`.trim();
    } else {
      blocks.push({ text, y: line.y });
    }
    lastLineY = line.y;
  }
  return blocks.filter((block) => block.text.length > 0);
}

function linesText(items: ManualTextItem[], tolerance: number): string {
  return groupLines(items, tolerance)
    .map((line) => itemsText(line.items))
    .filter((text) => text.length > 0)
    .join('\n');
}

interface SegmentContext {
  settings: ManualIndexSettings;
  tolerance: number;
  gap: number;
  columnTolerance: number;
}

// Répartit le texte d'un segment (une zone de fiche sur une page) en rubriques.
function readSegment(items: ManualTextItem[], context: SegmentContext): ManualSection[] {
  const { settings, tolerance, gap, columnTolerance } = context;
  const whole = (): ManualSection[] => {
    const texte = linesText(items, tolerance);
    return texte ? [{ typeRubrique: 'autre', libelle: '', texte }] : [];
  };
  if (settings.headers.length === 0) return whole();

  // Colonnes : positions horizontales des en-têtes reconnus sur le segment.
  const headerXs: number[] = [];
  for (const line of groupLines(items, tolerance)) {
    for (const run of splitRuns(line, gap)) {
      const first = run.find((item) => item.str.replace(BULLET_PREFIX, '').trim().length > 0);
      if (first && matchHeader(itemsText(run), settings.headers)) headerXs.push(first.x);
    }
  }
  if (headerXs.length === 0) return whole();

  const starts: number[] = [];
  for (const x of [...headerXs].sort((a, b) => a - b)) {
    if (starts.length === 0 || x - starts[starts.length - 1] > columnTolerance) starts.push(x);
  }
  const columns: ManualTextItem[][] = starts.map(() => []);
  for (const item of items) {
    let index = 0;
    for (let i = 0; i < starts.length; i += 1) {
      if (item.x + columnTolerance >= starts[i]) index = i;
    }
    columns[index].push(item);
  }

  const sections: ManualSection[] = [];
  for (const columnItems of columns) {
    let current: { type: SectionType; libelle: string; parts: string[] } | null = null;
    const flush = () => {
      if (!current) return;
      const texte = current.parts.join('\n').trim();
      if (texte || current.libelle) sections.push({ typeRubrique: current.type, libelle: current.libelle, texte });
      current = null;
    };
    for (const line of groupLines(columnItems, tolerance)) {
      const text = itemsText(line.items);
      if (!text) continue;
      const header = matchHeader(text, settings.headers);
      if (header) {
        flush();
        current = { type: header.type, libelle: header.libelle, parts: header.rest ? [header.rest] : [] };
      } else if (current) {
        current.parts.push(text);
      } else {
        current = { type: 'autre', libelle: '', parts: [text] };
      }
    }
    flush();
  }
  return sections;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractSousFiches(sections: ManualSection[], prefix: string): string[] {
  const normalizedPrefix = normalizeText(prefix);
  if (!normalizedPrefix) return [];
  const pattern = new RegExp(`(?:^|\\s)${escapeRegExp(normalizedPrefix)}\\s+(.+)$`);
  const names = new Set<string>();
  for (const section of sections) {
    if (section.typeRubrique !== 'ingredients') continue;
    for (const line of section.texte.split('\n')) {
      const match = pattern.exec(normalizeText(line));
      const name = match?.[1]?.trim();
      if (name) names.add(name);
    }
  }
  return [...names];
}

interface FicheBuilder {
  titre: string;
  page: number;
  segments: { items: ManualTextItem[]; continuation: boolean }[];
}

export function indexManualPages(pages: ManualPageItems[], settings: ManualIndexSettings): ManualIndex {
  const ignored = settings.ignoredLines.map(normalizeText).filter((pattern) => pattern.length > 0);
  const bodySize = median(
    pages.flatMap((page) => page.items.filter((item) => item.str.trim().length > 0 && item.size > 0).map((item) => item.size)),
  );
  const tolerance = Math.max(1.5, bodySize * 0.4);
  const gap = Math.max(6, bodySize * 4);
  const columnTolerance = Math.max(8, bodySize * 2);
  const threshold = bodySize * TITLE_SIZE_RATIO;
  const context: SegmentContext = { settings, tolerance, gap, columnTolerance };

  const indexedPages: IndexedPage[] = [];
  const builders: FicheBuilder[] = [];
  let current: FicheBuilder | null = null;

  for (const page of pages) {
    const items = dropIgnoredRuns(
      page.items.filter((item) => item.str.trim().length > 0),
      ignored,
      tolerance,
      gap,
    );

    // Niveau 1 : texte de la page, toujours conservé.
    const texte = linesText(items, tolerance);
    if (texte) indexedPages.push({ page: page.page, texte });
    if (bodySize <= 0) continue;

    // Niveau 2 : une fiche commence à un titre et va jusqu'au titre suivant.
    const titles = findTitles(items, threshold, tolerance);
    const body = items.filter((item) => item.size < threshold);
    if (titles.length === 0) {
      current?.segments.push({ items: body, continuation: true });
      continue;
    }
    // Le texte situé au-dessus du premier titre est un en-tête de page : ignoré.
    for (let index = 0; index < titles.length; index += 1) {
      const title = titles[index];
      const next = titles[index + 1];
      const zone = body.filter((item) => item.y < title.y && (!next || item.y > next.y));
      current = { titre: title.text, page: page.page, segments: [{ items: zone, continuation: false }] };
      builders.push(current);
    }
  }

  const fiches: IndexedFiche[] = [];
  for (const builder of builders) {
    const sections: ManualSection[] = [];
    for (const segment of builder.segments) {
      const segmentSections = readSegment(segment.items, context);
      const head = segmentSections[0];
      const last = sections[sections.length - 1];
      if (segment.continuation && head && head.typeRubrique === 'autre' && head.libelle === '' && last) {
        last.texte = `${last.texte}\n${head.texte}`.trim();
        sections.push(...segmentSections.slice(1));
      } else {
        sections.push(...segmentSections);
      }
    }
    if (sections.length === 0) continue;
    fiches.push({
      titre: builder.titre,
      titreNormalise: normalizeText(builder.titre),
      page: builder.page,
      ordre: fiches.length,
      sections,
      sousFiches: extractSousFiches(sections, settings.subFichePrefix),
    });
  }

  const hasRubriques = fiches.some((fiche) => fiche.sections.some((section) => section.typeRubrique !== 'autre'));
  const niveau: IndexLevel = fiches.length === 0 ? 1 : hasRubriques ? 3 : 2;
  return { nbPages: pages.length, niveau, pages: indexedPages, fiches };
}

// Lignes envoyées à la fonction SQL de remplacement (format snake_case).
export interface ManualRow {
  type: 'page' | 'fiche';
  titre: string | null;
  titre_normalise: string;
  page: number;
  ordre: number;
  sections: { type_rubrique: SectionType; libelle: string; texte: string }[];
  sous_fiches: string[];
}

export function buildManualRows(index: ManualIndex): ManualRow[] {
  const pageRows: ManualRow[] = index.pages.map((page) => ({
    type: 'page',
    titre: null,
    titre_normalise: '',
    page: page.page,
    ordre: page.page,
    sections: [{ type_rubrique: 'autre', libelle: '', texte: page.texte }],
    sous_fiches: [],
  }));
  const ficheRows: ManualRow[] = index.fiches.map((fiche) => ({
    type: 'fiche',
    titre: fiche.titre,
    titre_normalise: fiche.titreNormalise,
    page: fiche.page,
    ordre: fiche.ordre,
    sections: fiche.sections.map((section) => ({
      type_rubrique: section.typeRubrique,
      libelle: section.libelle,
      texte: section.texte,
    })),
    sous_fiches: fiche.sousFiches,
  }));
  return [...pageRows, ...ficheRows];
}

export function describeLevel(index: ManualIndex): string {
  if (index.niveau === 3) return `${index.fiches.length} fiches, découpées en rubriques`;
  if (index.niveau === 2) return `${index.fiches.length} fiches repérées, sans rubriques reconnues`;
  return `${index.pages.length} pages indexées, aucune fiche repérée`;
}

// Mots de la requête, normalisés : sert à surligner sans tenir compte des accents.
export function highlightSegments(text: string, query: string): { text: string; match: boolean }[] {
  const tokens = normalizeText(query).split(/[^a-z0-9]+/).filter((token) => token.length > 0);
  if (tokens.length === 0 || text.length === 0) return [{ text, match: false }];
  // NFD retire les accents sans changer la longueur d'un caractère de base : on
  // compare caractère par caractère sur une copie normalisée de même longueur.
  const folded = Array.from(text).map((char) => normalizeText(char).slice(0, 1) || char.toLowerCase());
  const chars = Array.from(text);
  const marked = new Array<boolean>(chars.length).fill(false);
  const isWordChar = (char: string) => /[a-z0-9]/.test(char);
  let i = 0;
  while (i < chars.length) {
    if (!isWordChar(folded[i]) || (i > 0 && isWordChar(folded[i - 1]))) {
      i += 1;
      continue;
    }
    let end = i;
    while (end < chars.length && isWordChar(folded[end])) end += 1;
    const word = folded.slice(i, end).join('');
    if (tokens.some((token) => word.startsWith(token))) {
      for (let k = i; k < end; k += 1) marked[k] = true;
    }
    i = end;
  }
  const segments: { text: string; match: boolean }[] = [];
  chars.forEach((char, index) => {
    const last = segments[segments.length - 1];
    if (last && last.match === marked[index]) last.text += char;
    else segments.push({ text: char, match: marked[index] });
  });
  return segments;
}
