// Indexation générique d'un manuel opératoire (PDF avec vrai texte) en trois
// niveaux : pages, fiches, rubriques. Module pur : aucune dépendance à React,
// Supabase ni pdf.js. Aucun réglage par site : les rubriques, les lignes à
// ignorer, les sous-fiches et les synonymes sont détectés automatiquement ou
// définis dans manualConstants.ts.

import {
  ALLERGEN_SYNONYMS,
  HEADER_KEYWORDS,
  MANUAL_FORMAT_VERSION,
  STOP_WORDS,
  SUB_FICHE_PREFIXES,
  SYNONYMS,
  UNITS,
  type SectionType,
} from './manualConstants';

export { MANUAL_FORMAT_VERSION, SECTION_TYPES, SECTION_TYPE_LABELS, type SectionType } from './manualConstants';

export type LineKind = 'ingredient' | 'etape' | 'puce' | 'texte';

export interface SubLine {
  brut: string;
  affichage: string;
}

// Ligne typée d'une rubrique. `brut` = texte tel que lu dans le PDF,
// `affichage` = version avec première lettre en majuscule et reste en minuscules.
export interface SectionLine {
  kind: LineKind;
  brut: string;
  affichage: string;
  quantite?: string;
  unite?: string;
  produit?: string;
  sousFiche?: string;
  numero?: string;
  sousLignes?: SubLine[];
}

export interface ManualSection {
  typeRubrique: SectionType;
  libelle: string;
  texte: string;
  lignes: SectionLine[];
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
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/\s+/g, ' ')
    .trim();
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export interface Line {
  y: number;
  items: ManualTextItem[];
}

export function groupLines(items: ManualTextItem[], tolerance: number): Line[] {
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

// Écart horizontal (en fraction de la taille du texte) sous lequel deux morceaux
// d'une même ligne sont collés : « Caf » + « é » donne « Café ».
const GLUE_GAP_RATIO = 0.12;

// Texte d'une ligne (ou d'une suite d'éléments). Les morceaux sont collés quand
// il n'y a pas d'écart réel entre eux (accent ou lettre isolée par le PDF) ;
// sinon une espace est insérée. Le résultat est en Unicode NFC.
export function itemsText(items: ManualTextItem[]): string {
  let text = '';
  let previous: ManualTextItem | null = null;
  for (const item of items) {
    const part = item.str.normalize('NFC');
    if (part.trim().length === 0) {
      text += ' ';
      continue;
    }
    if (previous && !/\s$/.test(text) && !/^\s/.test(part)) {
      const known = previous.width > 0;
      const gap = item.x - (previous.x + previous.width);
      if (!known || gap > Math.max(previous.size, item.size) * GLUE_GAP_RATIO) text += ' ';
    }
    text += part;
    previous = item;
  }
  return text.replace(/\s+/g, ' ').trim();
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

interface HeaderMatch {
  type: SectionType;
  libelle: string;
}

// En-tête de rubrique : ligne entièrement en majuscules (chiffres, ponctuation
// et guillemets ignorés) qui se termine par « : ». Son type se déduit des mots
// qu'elle contient (HEADER_KEYWORDS), sans tenir compte des accents.
export function matchHeader(rawText: string): HeaderMatch | null {
  const stripped = rawText.replace(BULLET_PREFIX, '').trim();
  if (!stripped.endsWith(':')) return null;
  const libelle = stripped.slice(0, -1).trim();
  const letters = libelle.replace(/[^\p{L}]/gu, '');
  if (letters.length < 2 || letters !== letters.toUpperCase()) return null;
  const normalized = normalizeText(libelle);
  for (const rule of HEADER_KEYWORDS) {
    if (rule.words.some((word) => normalized.includes(word))) return { type: rule.type, libelle };
  }
  return { type: 'autre', libelle };
}

// Textes (morceaux de ligne) identiques, après normalisation, sur au moins la
// moitié des pages : pieds de page, copyrights, quelle que soit la marque.
// Les en-têtes de rubrique ne sont jamais considérés comme répétés.
function findRepeatedTexts(pages: ManualPageItems[], tolerance: number, gap: number): Set<string> {
  const counts = new Map<string, number>();
  for (const page of pages) {
    const seen = new Set<string>();
    const items = page.items.filter((item) => item.str.trim().length > 0);
    for (const line of groupLines(items, tolerance)) {
      for (const run of splitRuns(line, gap)) {
        const raw = itemsText(run);
        const text = normalizeText(raw);
        if (text.length >= 4 && matchHeader(raw) === null) seen.add(text);
      }
    }
    for (const text of seen) counts.set(text, (counts.get(text) ?? 0) + 1);
  }
  const needed = Math.max(2, Math.ceil(pages.length / 2));
  const repeated = new Set<string>();
  for (const [text, count] of counts) {
    if (count >= needed) repeated.add(text);
  }
  return repeated;
}

function dropRepeatedRuns(items: ManualTextItem[], repeated: Set<string>, tolerance: number, gap: number): ManualTextItem[] {
  if (repeated.size === 0) return items;
  const kept: ManualTextItem[] = [];
  for (const line of groupLines(items, tolerance)) {
    for (const run of splitRuns(line, gap)) {
      if (!repeated.has(normalizeText(itemsText(run)))) kept.push(...run);
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
  tolerance: number;
  gap: number;
  columnGap: number;
  columnTolerance: number;
  units: Set<string>;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Première lettre en majuscule, reste en minuscules. Les mots contenant un
// chiffre et les unités restent intacts.
export function toDisplayCase(text: string, units: readonly string[] = UNITS): string {
  const unitSet = new Set(units.map(normalizeText));
  let first = true;
  return text
    .split(/(\s+)/)
    .map((part) => {
      if (part === '' || /^\s+$/.test(part)) return part;
      const hasLetter = /\p{L}/u.test(part);
      const letters = normalizeText(part.replace(/[^\p{L}\p{N}]/gu, ''));
      const keep = /\d/.test(part) || unitSet.has(letters);
      let value = keep ? part : part.toLowerCase();
      if (first && hasLetter) {
        first = false;
        if (!keep) {
          const index = value.search(/\p{L}/u);
          value = value.slice(0, index) + value.charAt(index).toUpperCase() + value.slice(index + 1);
        }
      }
      return value;
    })
    .join('');
}

// « CAFÉ GOURMAND - Café/thé gourmand » : le texte après un tiret entouré
// d'espaces est le sous-titre.
export function splitTitle(titre: string): { principal: string; sousTitre: string } {
  const match = /^(.*?)\s+[-–—]\s+(.+)$/.exec(titre.trim());
  return match ? { principal: match[1].trim(), sousTitre: match[2].trim() } : { principal: titre.trim(), sousTitre: '' };
}

const STOP_WORD_SET: ReadonlySet<string> = new Set(STOP_WORDS);

// Clé de rapprochement tolérante entre un nom de sous-fiche et un titre de fiche :
// sans accents, sans ponctuation, sans mots vides et sans grammage final
// (« SF MOUSSE CHOCOLAT » et « MOUSSE AU CHOCOLAT » donnent « mousse chocolat »).
export function matchKey(value: string): string {
  let key = normalizeText(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word.length > 0 && !STOP_WORD_SET.has(word))
    .join(' ');
  const trailing = /\s*\b\d+(?:\s*(?:g|gr|kg|mg|l|cl|ml))?$/;
  while (trailing.test(key) && key.replace(trailing, '').trim().length > 0) key = key.replace(trailing, '').trim();
  return key;
}

export interface QueryAnalysis {
  // Mots à chercher : sans synonymes ni mots vides, normalisés.
  terms: string[];
  // Rubriques à mettre en avant, déduites des synonymes.
  targets: SectionType[];
  // La requête contenait des mots mais aucun mot de recherche : il faut préciser le plat.
  vague: boolean;
  // La requête contenait un synonyme d'allergène : recherche aussi dans le tableau des allergènes.
  allergens: boolean;
}

const ALLERGEN_SYNONYM_SET: ReadonlySet<string> = new Set(ALLERGEN_SYNONYMS);
const SYNONYM_TARGETS = new Map<string, SectionType[]>();
for (const [type, words] of Object.entries(SYNONYMS) as [keyof typeof SYNONYMS, readonly string[]][]) {
  for (const word of words) SYNONYM_TARGETS.set(word, [...(SYNONYM_TARGETS.get(word) ?? []), type]);
}

export function queryTokens(query: string): string[] {
  return normalizeText(query).split(/[^a-z0-9]+/).filter((token) => token.length > 0);
}

// Un synonyme est retiré des termes et désigne une rubrique ; un mot vide est ignoré.
export function analyzeQuery(query: string): QueryAnalysis {
  const tokens = queryTokens(query);
  const terms: string[] = [];
  const targets: SectionType[] = [];
  let allergens = false;
  for (const token of tokens) {
    if (ALLERGEN_SYNONYM_SET.has(token)) {
      allergens = true;
      continue;
    }
    const synonymTargets = SYNONYM_TARGETS.get(token);
    if (synonymTargets) {
      for (const target of synonymTargets) if (!targets.includes(target)) targets.push(target);
    } else if (!STOP_WORD_SET.has(token) && !terms.includes(token)) {
      terms.push(token);
    }
  }
  return { terms, targets, vague: tokens.length > 0 && terms.length === 0, allergens };
}

const PUCE_PATTERN = /^(?:[▪•◦·*]|[-–—](?!\d))\s*(.+)$/u;
const ETAPE_PATTERN = /^(\d+)\s*(?:-|–|\)|\.(?!\d))\s*(.+)$/u;
const INGREDIENT_PATTERN = /^(\d+(?:[.,]\d+)?)\s*(.+)$/u;

// Lignes typées : ingrédient, étape (avec sous-lignes), puce, texte.
export function parseLines(
  rawLines: readonly string[],
  units: readonly string[] = UNITS,
  subFichePrefixes: readonly string[] = SUB_FICHE_PREFIXES,
): SectionLine[] {
  const unitSet = new Set(units.map(normalizeText));
  const prefixes = subFichePrefixes.map((prefix) => prefix.trim()).filter((prefix) => prefix.length > 0);
  // Préfixe en mot isolé uniquement : « SF MOUSSE », pas « SFINGE ».
  const prefixPattern = prefixes.length > 0
    ? new RegExp(`^(?:${prefixes.map(escapeRegExp).join('|')})\\s+(.+)$`, 'i')
    : null;
  const lines: SectionLine[] = [];
  let currentStep: SectionLine | null = null;

  for (const raw of rawLines) {
    const text = raw.trim();
    if (!text) continue;

    const puce = PUCE_PATTERN.exec(text);
    if (puce) {
      const sub: SubLine = { brut: puce[1].trim(), affichage: toDisplayCase(puce[1].trim(), units) };
      if (currentStep) {
        currentStep.sousLignes = [...(currentStep.sousLignes ?? []), sub];
      } else {
        lines.push({ kind: 'puce', brut: sub.brut, affichage: sub.affichage });
      }
      continue;
    }

    const etape = ETAPE_PATTERN.exec(text);
    if (etape) {
      const step: SectionLine = {
        kind: 'etape',
        brut: etape[2].trim(),
        affichage: toDisplayCase(etape[2].trim(), units),
        numero: etape[1],
      };
      lines.push(step);
      currentStep = step;
      continue;
    }

    const ingredient = INGREDIENT_PATTERN.exec(text);
    if (ingredient) {
      let rest = ingredient[2].trim();
      let unite: string | undefined;
      const firstWord = rest.split(/\s+/)[0];
      if (unitSet.has(normalizeText(firstWord))) {
        unite = firstWord;
        rest = rest.slice(firstWord.length).trim();
      }
      let sousFiche: string | undefined;
      const prefixMatch = prefixPattern?.exec(rest);
      if (prefixMatch) {
        sousFiche = normalizeText(prefixMatch[1]);
        rest = prefixMatch[1].trim();
      }
      const produit = toDisplayCase(rest, units);
      lines.push({
        kind: 'ingredient',
        brut: text,
        affichage: [ingredient[1], unite, produit].filter((part) => part).join(' '),
        quantite: ingredient[1],
        ...(unite ? { unite } : {}),
        produit,
        ...(sousFiche ? { sousFiche } : {}),
      });
      currentStep = null;
      continue;
    }

    if (currentStep) {
      currentStep.brut = `${currentStep.brut} ${text}`;
      currentStep.affichage = toDisplayCase(currentStep.brut, units);
    } else {
      lines.push({ kind: 'texte', brut: text, affichage: toDisplayCase(text, units) });
    }
  }
  return lines;
}

// Un nombre seul ou suivi d'une unité du site : « 200 », « 160 g ».
const looksLikeQuantity = (text: string, units: Set<string>) => {
  const match = /^\d+(?:[.,]\d+)?\s*([a-z]*)$/.exec(normalizeText(text));
  return match !== null && (match[1] === '' || units.has(match[1]));
};

// Lit les lignes d'un bloc de rubrique. Si le texte se répartit en colonnes
// (grand écart horizontal net entre groupes de lignes), chaque colonne est lue
// séparément, de haut en bas, puis la colonne suivante : deux morceaux de ligne
// de colonnes différentes ne sont jamais fusionnés.
function readBlockLines(items: ManualTextItem[], context: SegmentContext): string[] {
  const { tolerance, columnGap, columnTolerance } = context;
  const plain = (source: ManualTextItem[]) =>
    groupLines(source, tolerance).map((line) => itemsText(line.items)).filter((text) => text.length > 0);
  if (items.length === 0) return [];

  const lines = groupLines(items, tolerance);
  const candidates: { x: number; tableLike: boolean }[] = [];
  for (const line of lines) {
    const runs = splitRuns(line, columnGap);
    for (let i = 1; i < runs.length; i += 1) {
      candidates.push({ x: runs[i][0].x, tableLike: looksLikeQuantity(itemsText(runs[i - 1]), context.units) });
    }
  }
  if (candidates.length === 0) return plain(items);

  // Regroupe les positions proches ; une frontière où la partie gauche est
  // presque toujours une simple quantité est un tableau quantité | produit, pas
  // deux colonnes.
  const clusters: { x: number; count: number; tableLike: number }[] = [];
  for (const candidate of [...candidates].sort((a, b) => a.x - b.x)) {
    const last = clusters[clusters.length - 1];
    if (last && candidate.x - last.x <= columnTolerance) {
      last.count += 1;
      last.tableLike += candidate.tableLike ? 1 : 0;
    } else {
      clusters.push({ x: candidate.x, count: 1, tableLike: candidate.tableLike ? 1 : 0 });
    }
  }
  const bounds = clusters
    .filter((cluster) => cluster.tableLike * 2 < cluster.count)
    .map((cluster) => cluster.x)
    .filter((x) => !items.some((item) => item.x < x - columnTolerance && itemEnd(item) > x - 2));
  if (bounds.length === 0) return plain(items);

  const columns: ManualTextItem[][] = [[], ...bounds.map(() => [])];
  for (const item of items) {
    let index = 0;
    bounds.forEach((bound, i) => {
      if (item.x + columnTolerance >= bound) index = i + 1;
    });
    columns[index].push(item);
  }
  return columns.flatMap((column) => plain(column));
}

interface RawBlock {
  type: SectionType;
  libelle: string;
  items: ManualTextItem[];
}

function toSection(block: RawBlock, context: SegmentContext): ManualSection | null {
  const lines = readBlockLines(block.items, context);
  const texte = lines.join('\n').trim();
  if (!texte && !block.libelle) return null;
  return {
    typeRubrique: block.type,
    libelle: block.libelle,
    texte,
    lignes: parseLines(lines),
  };
}

// Répartit le texte d'un segment (une zone de fiche sur une page) en rubriques.
function readSegment(items: ManualTextItem[], context: SegmentContext): ManualSection[] {
  const { tolerance, gap, columnTolerance } = context;
  const whole = (): ManualSection[] => {
    const section = toSection({ type: 'autre', libelle: '', items }, context);
    return section ? [section] : [];
  };

  // Colonnes : positions horizontales des en-têtes reconnus sur le segment.
  const headerXs: number[] = [];
  for (const line of groupLines(items, tolerance)) {
    for (const run of splitRuns(line, gap)) {
      const first = run.find((item) => item.str.replace(BULLET_PREFIX, '').trim().length > 0);
      if (first && matchHeader(itemsText(run))) headerXs.push(first.x);
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
    const blocks: RawBlock[] = [];
    let current: RawBlock | null = null;
    for (const line of groupLines(columnItems, tolerance)) {
      const runs = splitRuns(line, gap);
      const header = matchHeader(itemsText(runs[0]));
      if (header) {
        current = { type: header.type, libelle: header.libelle, items: runs.slice(1).flat() };
        blocks.push(current);
      } else {
        if (!current) {
          current = { type: 'autre', libelle: '', items: [] };
          blocks.push(current);
        }
        current.items.push(...line.items);
      }
    }
    for (const block of blocks) {
      const section = toSection(block, context);
      if (section) sections.push(section);
    }
  }
  return sections;
}

function extractSousFiches(sections: ManualSection[]): string[] {
  const names = new Set<string>();
  for (const section of sections) {
    for (const line of section.lignes) {
      if (line.kind === 'ingredient' && line.sousFiche) names.add(line.sousFiche);
    }
  }
  return [...names];
}

interface FicheBuilder {
  titre: string;
  page: number;
  segments: { items: ManualTextItem[]; continuation: boolean }[];
}

export function indexManualPages(pages: ManualPageItems[]): ManualIndex {
  const bodySize = median(
    pages.flatMap((page) => page.items.filter((item) => item.str.trim().length > 0 && item.size > 0).map((item) => item.size)),
  );
  const tolerance = Math.max(1.5, bodySize * 0.4);
  const gap = Math.max(6, bodySize * 4);
  const columnTolerance = Math.max(8, bodySize * 2);
  const threshold = bodySize * TITLE_SIZE_RATIO;
  const columnGap = Math.max(30, bodySize * 5);
  const context: SegmentContext = {
    tolerance,
    gap,
    columnGap,
    columnTolerance,
    units: new Set(UNITS.map(normalizeText)),
  };
  const repeated = findRepeatedTexts(pages, tolerance, gap);

  const indexedPages: IndexedPage[] = [];
  const builders: FicheBuilder[] = [];
  let current: FicheBuilder | null = null;

  for (const page of pages) {
    const items = dropRepeatedRuns(
      page.items.filter((item) => item.str.trim().length > 0),
      repeated,
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
        last.lignes = parseLines(last.texte.split('\n'));
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
      sousFiches: extractSousFiches(sections),
    });
  }

  const hasRubriques = fiches.some((fiche) => fiche.sections.some((section) => section.typeRubrique !== 'autre' || section.libelle !== ''));
  const niveau: IndexLevel = fiches.length === 0 ? 1 : hasRubriques ? 3 : 2;
  return { nbPages: pages.length, niveau, pages: indexedPages, fiches };
}

// Lignes envoyées à la fonction SQL de remplacement (format snake_case).
export interface RowLine {
  kind: LineKind;
  brut: string;
  affichage: string;
  quantite?: string;
  unite?: string;
  produit?: string;
  sous_fiche?: string;
  numero?: string;
  sous_lignes?: SubLine[];
}

export interface ManualRow {
  type: 'page' | 'fiche';
  titre: string | null;
  titre_normalise: string;
  page: number;
  ordre: number;
  format_version: number;
  sections: { type_rubrique: SectionType; libelle: string; texte: string; lignes: RowLine[] }[];
  sous_fiches: string[];
}

const lineToRow = (line: SectionLine): RowLine => ({
  kind: line.kind,
  brut: line.brut,
  affichage: line.affichage,
  ...(line.quantite !== undefined ? { quantite: line.quantite } : {}),
  ...(line.unite !== undefined ? { unite: line.unite } : {}),
  ...(line.produit !== undefined ? { produit: line.produit } : {}),
  ...(line.sousFiche !== undefined ? { sous_fiche: line.sousFiche } : {}),
  ...(line.numero !== undefined ? { numero: line.numero } : {}),
  ...(line.sousLignes ? { sous_lignes: line.sousLignes } : {}),
});

export function buildManualRows(index: ManualIndex): ManualRow[] {
  const pageRows: ManualRow[] = index.pages.map((page) => ({
    type: 'page',
    titre: null,
    titre_normalise: '',
    page: page.page,
    ordre: page.page,
    format_version: MANUAL_FORMAT_VERSION,
    sections: [{ type_rubrique: 'autre', libelle: '', texte: page.texte, lignes: [] }],
    sous_fiches: [],
  }));
  const ficheRows: ManualRow[] = index.fiches.map((fiche) => ({
    type: 'fiche',
    titre: fiche.titre,
    titre_normalise: fiche.titreNormalise,
    page: fiche.page,
    ordre: fiche.ordre,
    format_version: MANUAL_FORMAT_VERSION,
    sections: fiche.sections.map((section) => ({
      type_rubrique: section.typeRubrique,
      libelle: section.libelle,
      texte: section.texte,
      lignes: section.lignes.map(lineToRow),
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

// Surligne les termes de recherche (déjà nettoyés par analyzeQuery : ni synonymes
// ni mots vides), sans tenir compte des accents ni de la casse.
export function highlightSegments(text: string, terms: readonly string[]): { text: string; match: boolean }[] {
  const tokens = terms.map((term) => normalizeText(term)).filter((token) => token.length > 0);
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
