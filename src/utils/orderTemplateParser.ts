// =============================================================
// utils/orderTemplateParser.ts
// Découpage en tableau (Articles / Unité de stockage / Conditionnement)
// d'un « Bon de préparation de commande » Adoria, à partir de mots
// positionnés (issus de pdf.js ou d'un OCR tesseract.js).
//
// Convention : yTop croît vers le bas de page (comme les bbox OCR).
// Pour du texte pdf.js (origine en bas), convertir avant l'appel :
// yTop = hauteurPage - transform[5].
//
// Particularité du gabarit Adoria : le nom d'article peut wrapper sur
// plusieurs lignes physiques alors que les valeurs Code / Unité de Stock /
// Conditionnement n'apparaissent que sur UNE seule ligne, verticalement
// centrée dans la hauteur de la ligne logique. On regroupe donc les lignes
// physiques par « ancre » (la ligne qui porte une valeur Code ou Unité/
// Conditionnement) en rattachant chaque ligne voisine sans donnée à
// l'ancre la plus proche verticalement.
// =============================================================

export interface ExtractedWord {
  text: string;
  x: number;
  yTop: number;
  height?: number;
  lineId?: string;
  // Confiance OCR du mot (0-100), absente pour le texte natif.
  confidence?: number;
}

export interface ParsedTemplateRow {
  sourceCode?: string;
  article: string;
  storageUnit: string;
  packagingUnit: string;
  // Confiance OCR minimale (0-100) de chaque cellule d'unité ; absente pour le
  // texte natif ou une cellule vide, considérée alors comme fiable.
  cellConfidence?: { article?: number; storageUnit?: number; packagingUnit?: number };
}

export interface PageExtractionDebug {
  wordCount: number;
  lineCount: number;
  headerFound: boolean;
  rowCount: number;
  codeCount: number;
  incompleteCodeCount: number;
  suspiciousRowCount: number;
}

export interface DocumentExtractionResult {
  rows: ParsedTemplateRow[];
  headerFound: boolean;
  pagesDebug: PageExtractionDebug[];
  codeCount: number;
  incompleteCodeCount: number;
  suspiciousRowCount: number;
  needsReview: boolean;
  // Lignes illisibles écartées de `rows` (voir `separateUnreadableRows`),
  // à ressaisir manuellement plutôt qu'importées silencieusement.
  droppedRows?: ParsedTemplateRow[];
}

interface ColumnBounds {
  hasCodeColumn: boolean;
  stockTamponStart: number | null;
  unitStart: number;
  conditionStart: number;
}

const stripAccents = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '');
const normalize = (value: string) => stripAccents(value).toLowerCase();

// Retire les barres verticales de bordure de tableau que l'OCR capture
// parfois comme caractères "|" isolés ou accolés à un mot voisin.
const cleanWordText = (text: string): string => text.replace(/^\|+/, '').replace(/\|+$/, '').trim();

// Tolérance appliquée aux frontières de colonnes pour absorber l'imprécision
// des positions (quelques pixels) issues de l'OCR ou d'un en-tête dont le
// libellé est centré dans une colonne plus large que le texte lui-même.
const COLUMN_MARGIN = 15;

// Un mot uniquement numérique de 3 chiffres ou plus, en tête de la zone
// Code+Articles, est traité comme la valeur de la colonne "Code". Une ligne
// wrappée commençant par un grammage séparé (ex: "400 g PUIGRENIER") doit
// toutefois rester une continuation de l'article, pas devenir un nouveau code.
// Code numérique, ou précédé d'un préfixe de lettres (« COJ-123217 »). Seul son
// alignement dans la colonne Code en fait un code : un grammage de continuation
// ne s'y trouve pas.
const CODE_VALUE_PATTERN = /^(?:[A-Za-z]{1,6}[-_.]?)?\d{3,}$/;
const ARTICLE_QUANTITY_VALUE_PATTERN = /^\d{1,4}(?:[.,]\d+)?$/;
const ARTICLE_QUANTITY_UNIT_PATTERN = /^(?:g|gr|kg|ml|cl|l)$/i;

const startsWithArticleQuantity = (words: ExtractedWord[]): boolean =>
  words.length >= 2 &&
  ARTICLE_QUANTITY_VALUE_PATTERN.test(words[0].text) &&
  ARTICLE_QUANTITY_UNIT_PATTERN.test(words[1].text);

// Un fragment Unité/Conditionnement récupéré sur une ligne voisine (wrap)
// n'est retenu que s'il contient au moins 2 caractères alphanumériques utiles.
// Les tokens isolés "a", "L" et "g" restent admis car ils peuvent compléter
// une vraie unité répartie sur plusieurs baselines ("au" / "L").
const isPlausibleUnitFragment = (text: string): boolean => {
  const useful = text.replace(/[^a-zà-ÿ0-9]/gi, '');
  return useful.length >= 2 || /^(?:a|l|g)$/i.test(useful);
};

const UNIT_KEYWORD_PATTERN =
  /\b(au|aux|a|l|unite|piece|pieces|kg|g|gr|ml|cl|l|litre|litres|bac|carton|colis|sachet|sac|boite|pot|seau|barquette|poche|bidon|bouteille|botte|filet|flacon|bocal|paquet|plateau|tube|gourde|tranche|portion|plaquette|plaque|brique|bombe|pack|lot)\b/;

const isPlausibleUnitValue = (text: string): boolean => {
  const normalized = normalize(text)
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (!normalized) return false;
  if (/[?]/.test(text)) return false;
  if (/\bx\s*\d+\b/i.test(text)) return true;
  if (UNIT_KEYWORD_PATTERN.test(normalized)) return true;
  return false;
};

const normalizeLooseUnitText = (text: string): string =>
  normalize(text)
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const pushUniqueUnitFragment = (fragments: string[], value: string): void => {
  const normalizedValue = normalizeLooseUnitText(value);
  if (!normalizedValue) return;
  if (fragments.some((fragment) => normalizeLooseUnitText(fragment) === normalizedValue)) return;
  fragments.push(value);
};

const cleanImportedStorageUnit = (text: string): string => {
  const loose = normalizeLooseUnitText(text);
  if (!loose) return '';

  if (/^au\s*l$|^aul$/.test(loose)) return 'au L';
  if (/^au\s*kg$|^aukg$/.test(loose)) return 'au Kg';
  if (/\bbac\b/.test(loose)) return 'bac';
  if (/\btranche\b/.test(loose)) return 'tranche';
  if (/\bpieces?\b|\bpiece\b|\bpi\s*ce\b/.test(loose)) return 'pièce';
  if (/\bunite?\b|\bunit\b/.test(loose)) return "à l'unité";
  if (/\bkg\b|\bka\b|\bfe\b|\bra\b/.test(loose)) return 'au Kg';
  if (/\bl\b/.test(loose)) return 'au L';
  if (/\bau\b|\baux\b/.test(loose) || loose === 'a') return 'au Kg';

  return text
    .replace(/[;:,?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const cleanImportedPackagingUnit = (text: string): string => {
  const loose = normalizeLooseUnitText(text);
  if (!loose) return '';

  const kindMatch = loose.match(/\b(carton|colis|bac|sachet|sac|boite|pot|seau|barquette|poche|bidon|bouteille|plaque|brique|bombe|pack|lot)\b/);
  const quantityMatch = loose.match(/(?:\bx\b\s*)?(\d+)\b/);

  if (kindMatch) {
    const kind = kindMatch[1] === 'boite' ? 'boîte' : kindMatch[1];
    return quantityMatch ? `${kind} x ${quantityMatch[1]}` : kind;
  }

  return text
    .replace(/[;:,?]+/g, ' ')
    .replace(/\s*x\s*/gi, ' x ')
    .replace(/\s+/g, ' ')
    .trim();
};

const cleanImportedArticleText = (text: string): string =>
  text
    // Confusion OCR courante et non ambiguë dans une quantité : « 700 mi »
    // correspond à l'unité millilitre, pas au mot français « mi ».
    .replace(/\b(\d+(?:[.,]\d+)?)\s+mi\b/gi, '$1 ml')
    .trim();

const inferStorageUnitFromArticle = (article: string): string => {
  const loose = normalizeLooseUnitText(article);
  if (!loose) return '';

  if (/\bau\s+kg\b|\baux\s+kg\b/.test(loose)) return 'au Kg';
  if (/\btranche\b/.test(loose)) return 'tranche';
  if (/\bpieces?\b|\bpiece\b|\bpi\s*ce\b/.test(loose)) return 'pièce';
  if (/\bbac\b/.test(loose)) return 'bac';
  if (/\b\d+(?:[.,]\d+)?\s*(kg|g|gr)\b/.test(loose)) return 'au Kg';
  if (/\b\d+(?:[.,]\d+)?\s*(l|litre|litres|cl|ml)\b/.test(loose)) return 'au L';

  return '';
};

// Certaines extractions placent une valeur de stockage juste après la
// frontière calculée de la colonne. Les valeurs ci-dessous ne sont pas des
// conditionnements : si la cellule stockage est vide, on peut donc les
// remettre à gauche sans dépendre d'un fournisseur ou d'un libellé produit.
const isUnambiguousStorageOnlyValue = (value: string): boolean =>
  /^(?:au\s+kg|au\s+l|a\s+l\s+unite|a\s+lunite)$/i.test(normalizeLooseUnitText(value));

const editDistance = (a: string, b: string): number => {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[b.length];
};

// Une ligne OCR dont la confiance moyenne est très basse est illisible
// (« sosie de pou pren nue ») : son texte n'est pas repris dans le libellé voisin,
// mais la ligne de tableau correspondante est signalée à contrôler plutôt que
// laissée tronquée sans avertissement.
const LOW_CONFIDENCE_LINE_THRESHOLD = 45;

const meanConfidence = (words: ExtractedWord[]): number | undefined => {
  const values = words
    .map((word) => word.confidence)
    .filter((value): value is number => typeof value === 'number');
  return values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : undefined;
};

const repairParsedRow = (row: ParsedTemplateRow): ParsedTemplateRow => {
  const article = cleanImportedArticleText(row.article);
  let storageUnit = cleanImportedStorageUnit(row.storageUnit);
  let packagingUnit = cleanImportedPackagingUnit(row.packagingUnit);

  if (!storageUnit && isUnambiguousStorageOnlyValue(packagingUnit)) {
    storageUnit = cleanImportedStorageUnit(packagingUnit);
    packagingUnit = '';
  }

  if (!storageUnit) storageUnit = inferStorageUnitFromArticle(article);

  return {
    ...row,
    article,
    storageUnit,
    packagingUnit,
  };
};

const isSuspiciousArticleText = (article: string): boolean => {
  const trimmed = article.trim();
  if (!trimmed || /[?�]{2,}|�/.test(trimmed) || /-\s*$/.test(trimmed)) return true;

  const lines = trimmed.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (lines.some((line) => line.replace(/[^a-zà-ÿ0-9]/gi, '').length <= 1)) return true;

  const tokens = normalizeLooseUnitText(trimmed).split(' ').filter(Boolean);
  if (tokens.length >= 4) {
    const shortTokenCount = tokens.filter((token) => token.length <= 2).length;
    const letterCount = tokens.join('').length;
    if (shortTokenCount / tokens.length >= 0.5 && letterCount < 18) return true;
  }

  return false;
};

// Une valeur d'unité est lisible si elle ressemble à un mot ou un court groupe de
// mots. Aucune liste d'unités : un conditionnement inédit n'est donc pas suspect.
const isReadableUnitValue = (text: string): boolean => {
  const normalized = normalizeLooseUnitText(text);
  if (!normalized || /[?�]/.test(text)) return false;
  if (normalized.split(' ').length > 5) return false;
  return normalized.replace(/ /g, '').length >= 2 || /^[lga]$/.test(normalized);
};

// Au-dessus : lecture OCR fiable, qui sert de référence. En dessous du second
// seuil : lecture trop incertaine pour ne pas être signalée à l'utilisateur.
const RELIABLE_CELL_CONFIDENCE = 85;
const UNRELIABLE_CELL_CONFIDENCE = 70;
// Un mot de libellé de confiance inférieure à ce seuil (« eur » à la place de
// « Oeuf PRE ») rend la ligne à contrôler, sans modifier le texte lu.
const UNRELIABLE_ARTICLE_CONFIDENCE = 40;

const isSuspiciousParsedRow = (row: ParsedTemplateRow): boolean =>
  isSuspiciousArticleText(row.article) ||
  !row.storageUnit.trim() ||
  !row.packagingUnit.trim() ||
  !isReadableUnitValue(row.storageUnit) ||
  !isReadableUnitValue(row.packagingUnit) ||
  (row.cellConfidence?.article ?? 100) < UNRELIABLE_ARTICLE_CONFIDENCE ||
  (row.cellConfidence?.storageUnit ?? 100) < UNRELIABLE_CELL_CONFIDENCE ||
  (row.cellConfidence?.packagingUnit ?? 100) < UNRELIABLE_CELL_CONFIDENCE;

const getArticleWords = (article: string): string[] =>
  normalizeLooseUnitText(article).split(' ').filter((word) => /[a-z]{3,}/.test(word));

// Libellé lisible : au moins un vrai mot. Un tableau ne contient jamais de ligne
// sans lettres (numéro, bordure) : elle est un fragment et non un produit.
const hasReadableArticle = (article: string): boolean => getArticleWords(article).length >= 1;

// Libellé substantiel : un mot long, ou plusieurs mots. Sert à juger une ligne
// retrouvée par une seule des deux lectures, sans code correspondant ailleurs.
const hasSubstantialArticle = (article: string): boolean => {
  const words = getArticleWords(article);
  return words.some((word) => word.replace(/[^a-z]/g, '').length >= 4) || words.length >= 2;
};

// Ligne issue d'une lecture secondaire sans correspondance : elle n'est retenue
// que si elle ressemble à une vraie ligne de tableau.
const isCredibleSecondaryRow = (row: ParsedTemplateRow): boolean =>
  hasSubstantialArticle(row.article) && !isSuspiciousParsedRow(row);

const mergeCellConfidence = (
  primary: ParsedTemplateRow,
  secondary: ParsedTemplateRow | undefined,
  articleSource: ParsedTemplateRow | undefined,
): ParsedTemplateRow['cellConfidence'] => ({
  article: articleSource?.cellConfidence?.article,
  storageUnit: primary.storageUnit ? primary.cellConfidence?.storageUnit : secondary?.cellConfidence?.storageUnit,
  packagingUnit: primary.packagingUnit ? primary.cellConfidence?.packagingUnit : secondary?.cellConfidence?.packagingUnit,
});

// Une valeur d'unité lue avec une confiance faible (« Ke » pour « au Kg ») est
// ramenée à la valeur très proche lue de façon fiable dans le même document, si
// elle est unique. Une lecture fiable n'est jamais modifiée : aucune liste
// d'unités, seul le document lui-même sert de référence.
const reconcileUnitsWithReliableValues = (rows: ParsedTemplateRow[]): ParsedTemplateRow[] => {
  let result = rows;

  (['storageUnit', 'packagingUnit'] as const).forEach((field) => {
    const reliable = new Map<string, { count: number; display: string }>();
    result.forEach((row) => {
      const confidence = row.cellConfidence?.[field];
      if (confidence !== undefined && confidence < RELIABLE_CELL_CONFIDENCE) return;
      const key = normalizeLooseUnitText(row[field]);
      if (!key) return;
      const entry = reliable.get(key);
      if (entry) entry.count += 1;
      else reliable.set(key, { count: 1, display: row[field] });
    });
    const references = [...reliable.entries()].filter(([, entry]) => entry.count >= 2);

    result = result.map((row) => {
      const confidence = row.cellConfidence?.[field];
      if (confidence === undefined || confidence >= RELIABLE_CELL_CONFIDENCE) return row;
      const key = normalizeLooseUnitText(row[field]);
      if (!key) return row;

      const confirmed = { ...row.cellConfidence, [field]: undefined };
      if ((reliable.get(key)?.count ?? 0) >= 2) return { ...row, cellConfidence: confirmed };

      // Valeur de référence entourée d'un ou deux mots parasites (« Là pièce »).
      const tokens = key.split(' ');
      for (let length = tokens.length - 1; length >= 1 && tokens.length - length <= 2; length -= 1) {
        const matches = new Set<string>();
        for (let start = 0; start + length <= tokens.length; start += 1) {
          const candidate = tokens.slice(start, start + length).join(' ');
          if ((reliable.get(candidate)?.count ?? 0) >= 2) matches.add(candidate);
        }
        if (matches.size === 1) {
          const [match] = [...matches];
          return { ...row, [field]: reliable.get(match)!.display, cellConfidence: confirmed };
        }
        if (matches.size > 1) return row;
      }

      const maxDistance = Math.max(1, Math.floor(key.length / 5));
      let best: { display: string } | null = null;
      let bestDistance = Infinity;
      let tie = false;
      for (const [referenceKey, entry] of references) {
        const candidates = [referenceKey];
        if (!key.includes(' ')) {
          candidates.push(...referenceKey.split(' ').filter((token) => token.length >= 2));
        }
        const distance = Math.min(...candidates.map((candidate) => editDistance(key, candidate)));
        if (distance < bestDistance) {
          best = entry;
          bestDistance = distance;
          tie = false;
        } else if (distance === bestDistance && entry !== best) {
          tie = true;
        }
      }

      if (!best || tie || bestDistance > maxDistance) return row;
      return { ...row, [field]: (best as { display: string }).display, cellConfidence: confirmed };
    });
  });

  return result;
};

// Une ligne secondaire sans code correspondant en primaire peut quand même
// décrire un article déjà retenu (code mal lu par l'une des deux lectures).
// Égalité stricte après normalisation : aucune distance d'édition disponible.
const hasEquivalentArticle = (rows: ParsedTemplateRow[], article: string): boolean => {
  const target = normalizeLooseUnitText(article);
  if (!target) return false;
  return rows.some((row) => normalizeLooseUnitText(row.article) === target);
};

// Insère une ligne issue d'une lecture secondaire à sa place dans le document :
// juste après la ligne qui la précède dans cette lecture (ou juste avant celle
// qui la suit), au lieu de la rejeter en fin de tableau.
const insertInDocumentOrder = (
  rows: ParsedTemplateRow[],
  sourceRows: ParsedTemplateRow[],
  sourceIndex: number,
  newRow: ParsedTemplateRow,
): void => {
  const positionOf = (candidate: ParsedTemplateRow) =>
    candidate.sourceCode ? rows.findIndex((row) => row.sourceCode === candidate.sourceCode) : -1;
  for (let i = sourceIndex - 1; i >= 0; i -= 1) {
    const position = positionOf(sourceRows[i]);
    if (position >= 0) {
      rows.splice(position + 1, 0, newRow);
      return;
    }
  }
  for (let i = sourceIndex + 1; i < sourceRows.length; i += 1) {
    const position = positionOf(sourceRows[i]);
    if (position >= 0) {
      rows.splice(position, 0, newRow);
      return;
    }
  }
  rows.push(newRow);
};

// Retire de `rows` les fragments sans libellé exploitable ; elles sont conservées
// dans `droppedRows` pour que l'UI les signale. Une ligne dont seules les unités
// sont incertaines reste dans le tableau, modifiable, et est signalée à contrôler.
export const separateUnreadableRows = (
  result: DocumentExtractionResult,
): DocumentExtractionResult => {
  const rows = result.rows.filter((row) => hasReadableArticle(row.article));
  const droppedRows = result.rows.filter((row) => !hasReadableArticle(row.article));
  if (droppedRows.length === 0) return { ...result, droppedRows: [] };
  return {
    ...result,
    rows,
    droppedRows,
    suspiciousRowCount: rows.filter(isSuspiciousParsedRow).length,
    needsReview: true,
  };
};

// Regroupe les mots d'une page en lignes en fonction de leur proximité verticale.
// Tolérance généreuse car les bbox OCR (rendu canvas) sont moins régulières
// que les positions natives pdf.js.
const clusterLines = (words: ExtractedWord[], tolerance?: number): ExtractedWord[][] => {
  // Tesseract fournit déjà l'appartenance exacte de chaque mot à une ligne.
  // La conserver évite de séparer un tiret, un « g » ou une lettre basse dont
  // la bbox verticale diffère des autres glyphes de la même phrase.
  const explicitLines = new Map<string, ExtractedWord[]>();
  const positionalWords: ExtractedWord[] = [];
  words.forEach((word) => {
    if (!word.lineId) {
      positionalWords.push(word);
      return;
    }
    const line = explicitLines.get(word.lineId) ?? [];
    line.push(word);
    explicitLines.set(word.lineId, line);
  });

  const measuredHeights = words
    .map((word) => word.height ?? 0)
    .filter((height) => Number.isFinite(height) && height > 0)
    .sort((a, b) => a - b);
  const medianHeight = measuredHeights.length > 0
    ? measuredHeights[Math.floor(measuredHeights.length / 2)]
    : 0;
  const resolvedTolerance = tolerance ?? (medianHeight > 0
    ? Math.max(6, Math.min(14, medianHeight * 0.65))
    : 6);
  const sorted = [...positionalWords].sort((a, b) => a.yTop - b.yTop || a.x - b.x);
  const lines: ExtractedWord[][] = [];

  sorted.forEach((word) => {
    const currentLine = lines[lines.length - 1];
    const currentY = currentLine
      ? currentLine.reduce((total, item) => total + item.yTop, 0) / currentLine.length
      : 0;
    if (currentLine && Math.abs(currentY - word.yTop) <= resolvedTolerance) {
      currentLine.push(word);
    } else {
      lines.push([word]);
    }
  });

  const groupedLines = [
    ...lines,
    ...[...explicitLines.values()].map((line) => line.sort((a, b) => a.x - b.x)),
  ];

  return groupedLines.sort((a, b) => {
    const averageY = (line: ExtractedWord[]) =>
      line.reduce((total, word) => total + word.yTop, 0) / Math.max(1, line.length);
    return averageY(a) - averageY(b) || a[0].x - b[0].x;
  });
};

// Repère l'en-tête (Code / Articles / [Stock Tampon] / Unité de Stock /
// Unité de conditionnement) à partir d'un ensemble de mots (plusieurs lignes
// fusionnées : l'en-tête réel s'étale souvent sur 3 à 5 lignes à cause des
// libellés multi-mots wrappés dans des colonnes étroites).
const detectHeaderBounds = (words: ExtractedWord[]): ColumnBounds | null => {
  const sorted = [...words].sort((a, b) => a.x - b.x);
  const joined = sorted.map((w) => normalize(w.text)).join(' ');

  if (!joined.includes('article')) return null;
  if (!joined.includes('stock')) return null;
  if (!joined.includes('condition')) return null;

  const codeWord = sorted.find((w) => normalize(w.text).startsWith('code'));
  const unitWord = sorted.find((w) => normalize(w.text).startsWith('unit'));
  const conditionWord = sorted.find((w) => normalize(w.text).startsWith('condition'));
  const stockTamponWord = sorted.find((w) => normalize(w.text).startsWith('tampon'));
  if (!unitWord || !conditionWord) return null;

  return {
    hasCodeColumn: !!codeWord,
    stockTamponStart: stockTamponWord ? stockTamponWord.x : null,
    unitStart: unitWord.x,
    conditionStart: conditionWord.x,
  };
};

// Nombre maximal de lignes consécutives fusionnées pour retrouver un en-tête
// réparti sur plusieurs lignes (wrap des libellés "Unité de Stock", etc.).
const HEADER_WINDOW_MAX_LINES = 6;

// Nombre maximal de lignes "en-tête" isolées précédentes à rattacher (ex :
// "Code" séparé par l'OCR du reste de la ligne d'en-tête).
const HEADER_LEADING_MAX_LINES = 4;

// Vocabulaire strictement composé de libellés d'en-tête (colonnes Code/
// Articles/Stock Tampon/Unité de Stock/Conditionnement + sous-colonnes
// "A commander" répétées : Date/Stock/Cde.). Sert à absorber les lignes
// d'en-tête résiduelles (ex: "Tampon" isolé, "Stock Cde. Stock Cde. ...")
// qui suivent la fenêtre minimale ayant permis de détecter les colonnes.
const HEADER_VOCAB = /^(articles?|code|unit[eé]?|de|stock|tampon|conditionnement|condition|date|cde\.?|a|commander)$/;

const isHeaderLikeLine = (line: ExtractedWord[]): boolean => {
  const words = line.map((w) => cleanWordText(w.text)).filter((t) => t.length > 0);
  if (words.length === 0) return true;
  return words.every((w) => HEADER_VOCAB.test(normalize(w)) || /^[^a-z0-9]+$/i.test(w));
};

// Marge de sécurité pour l'extension gloutonne des lignes d'en-tête restantes.
const HEADER_TRAILING_MAX_LINES = 8;

// Pieds/en-têtes de page à ignorer : numérotation ("Page 2/5"), dates,
// URL et horodatage ajoutés par un export "Imprimer en PDF" navigateur.
const isNoiseLine = (joinedText: string): boolean => {
  const trimmed = joinedText.trim();
  if (!trimmed) return true;
  if (/^page\s*\d/i.test(trimmed)) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(trimmed)) return true;
  if (/https?:\/\//i.test(trimmed)) return true;
  if (/adoria\.com/i.test(trimmed)) return true;
  return false;
};

interface LineInfo {
  yTop: number;
  articleText: string;
  storageUnit: string;
  packagingUnit: string;
  isAnchor: boolean;
  codeValue: string;
  articleConfidence?: number;
  storageConfidence?: number;
  packagingConfidence?: number;
  unreadable?: boolean;
}

const minConfidence = (words: ExtractedWord[]): number | undefined => {
  const values = words
    .map((word) => word.confidence)
    .filter((value): value is number => typeof value === 'number');
  return values.length > 0 ? Math.min(...values) : undefined;
};

const minDefined = (a: number | undefined, b: number | undefined): number | undefined =>
  a === undefined ? b : b === undefined ? a : Math.min(a, b);

// Fragments d'une cellule répartie sur plusieurs lignes : texte joint et plus
// faible confiance parmi eux.
const joinFragments = (
  fragments: string[],
  confidences: (number | undefined)[],
): { text: string; confidence: number | undefined } => ({
  text: fragments.join(' ').trim(),
  confidence: confidences.reduce<number | undefined>((lowest, value) => minDefined(lowest, value), undefined),
});

const pushUnitFragment = (
  fragments: string[],
  confidences: (number | undefined)[],
  value: string,
  confidence: number | undefined,
): void => {
  const before = fragments.length;
  pushUniqueUnitFragment(fragments, value);
  if (fragments.length > before) confidences.push(confidence);
};

// Traite les mots d'une page et renvoie les lignes de tableau détectées.
// `carriedBounds` permet de garder les colonnes détectées sur une page
// précédente si l'en-tête n'est pas répété sur la page courante.
export const extractRowsFromPageWords = (
  words: ExtractedWord[],
  carriedBounds: ColumnBounds | null = null
): { rows: ParsedTemplateRow[]; bounds: ColumnBounds | null; debug: PageExtractionDebug } => {
  const lines = clusterLines(words);
  let bounds = carriedBounds;
  let headerFound = false;
  const bodyLines: ExtractedWord[][] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const lineJoined = normalize(line.map((w) => w.text).join(' '));

    let headerBounds: ColumnBounds | null = null;
    let consumed = 1;

    // On ne tente la fusion multi-lignes que si cette ligne contient déjà
    // une piste sérieuse (le mot "Articles"), pour éviter de déclencher une
    // fausse détection sur une ligne de données quelconque.
    if (lineJoined.includes('article')) {
      // L'OCR peut isoler le mot "Code" dans un bloc distinct de celui des
      // libellés "Articles / Stock / Unité", bien qu'il soit sur la même
      // ligne visuelle d'en-tête : on inclut aussi les lignes précédentes
      // purement "en-tête" (ex: "Code" isolé) dans la fenêtre de détection.
      let leadStart = i;
      while (
        leadStart > 0 &&
        i - leadStart < HEADER_LEADING_MAX_LINES &&
        isHeaderLikeLine(lines[leadStart - 1])
      ) {
        leadStart -= 1;
      }
      for (let windowSize = 1; windowSize <= HEADER_WINDOW_MAX_LINES && i + windowSize <= lines.length; windowSize++) {
        const merged = lines.slice(leadStart, i + windowSize).flat();
        const candidate = detectHeaderBounds(merged);
        if (candidate) {
          headerBounds = candidate;
          consumed = windowSize;
          break;
        }
      }
    }

    if (headerBounds) {
      bounds = headerBounds;
      headerFound = true;
      // La fenêtre minimale suffit à satisfaire les mots-clés, mais l'en-tête
      // réel peut continuer sur quelques lignes de plus (libellé "Tampon"
      // isolé, sous-colonnes "Stock | Cde." répétées) : on les absorbe tant
      // qu'elles ne contiennent que du vocabulaire d'en-tête.
      let extended = i + consumed;
      while (
        extended < lines.length &&
        extended - i < HEADER_TRAILING_MAX_LINES &&
        isHeaderLikeLine(lines[extended])
      ) {
        extended += 1;
      }
      i = extended;
      continue;
    }

    if (bounds) bodyLines.push(line);
    i += 1;
  }

  const rows: ParsedTemplateRow[] = [];

  if (!bounds) {
    return {
      rows,
      bounds,
      debug: {
        wordCount: words.length,
        lineCount: lines.length,
        headerFound,
        rowCount: 0,
        codeCount: 0,
        incompleteCodeCount: 0,
        suspiciousRowCount: 0,
      },
    };
  }

  const { hasCodeColumn, stockTamponStart, unitStart, conditionStart } = bounds;
  const adjustedStockTamponStart = stockTamponStart !== null ? stockTamponStart - COLUMN_MARGIN : null;
  const adjustedUnitStart = unitStart - COLUMN_MARGIN;
  const adjustedConditionStart = conditionStart - COLUMN_MARGIN;
  const articleEnd = adjustedStockTamponStart ?? adjustedUnitStart;

  // La colonne Code est estimée à partir de la position dominante des
  // nombres placés en tête de la zone Code+Articles. Cela distingue un vrai
  // code court d'un grammage de continuation dont le "g" aurait été placé
  // sur une baseline différente par le PDF ou l'OCR.
  const numericStarts = bodyLines.flatMap((line) => {
    const sorted = line
      .map((word) => ({ ...word, text: cleanWordText(word.text) }))
      .filter((word) => word.text && word.x < articleEnd)
      .sort((a, b) => a.x - b.x);
    const first = sorted[0];
    return first && CODE_VALUE_PATTERN.test(first.text) ? [first] : [];
  });
  const strongCodeStarts = numericStarts.filter((word) => word.text.length >= 5);
  const codeColumnSamples = strongCodeStarts.length > 0 ? strongCodeStarts : numericStarts;
  const sortedCodeXs = codeColumnSamples.map((word) => word.x).sort((a, b) => a - b);
  const dominantCodeX = sortedCodeXs.length > 0
    ? sortedCodeXs[Math.floor(sortedCodeXs.length / 2)]
    : null;
  const codeColumnTolerance = dominantCodeX === null
    ? 0
    : Math.max(12, Math.abs(adjustedUnitStart - dominantCodeX) * 0.12);

  const lineInfos: LineInfo[] = [];

  bodyLines.forEach((line) => {
    const cleanedWords = line
      .map((w) => ({ ...w, text: cleanWordText(w.text) }))
      .filter((w) => w.text.length > 0);
    if (cleanedWords.length === 0) return;

    const sorted = [...cleanedWords].sort((a, b) => a.x - b.x);
    const joined = sorted.map((w) => w.text).join(' ');
    if (isNoiseLine(joined)) return;

    const lineConfidence = meanConfidence(sorted);
    if (sorted.length >= 2 && lineConfidence !== undefined && lineConfidence < LOW_CONFIDENCE_LINE_THRESHOLD) {
      lineInfos.push({
        yTop: line[0].yTop,
        articleText: '',
        storageUnit: '',
        packagingUnit: '',
        isAnchor: false,
        codeValue: '',
        unreadable: true,
      });
      return;
    }

    let articleWords = sorted.filter((w) => w.x < articleEnd);
    let isAnchorFromCode = false;
    let codeValue = '';
    if (
      hasCodeColumn &&
      articleWords.length > 0 &&
      CODE_VALUE_PATTERN.test(articleWords[0].text) &&
      dominantCodeX !== null &&
      Math.abs(articleWords[0].x - dominantCodeX) <= codeColumnTolerance &&
      !startsWithArticleQuantity(articleWords)
    ) {
      codeValue = articleWords[0].text;
      articleWords = articleWords.slice(1);
      isAnchorFromCode = true;
    }

    const storageWords = sorted.filter((w) => w.x >= adjustedUnitStart && w.x < adjustedConditionStart);
    const packagingWords = sorted.filter((w) => w.x >= adjustedConditionStart);
    const rawStorageUnit = storageWords.map((w) => w.text).join(' ').trim();
    const rawPackagingUnit = packagingWords.map((w) => w.text).join(' ').trim();
    const storageUnit = cleanImportedStorageUnit(rawStorageUnit);
    const packagingUnit = cleanImportedPackagingUnit(rawPackagingUnit);
    const articleText = articleWords.map((w) => w.text).join(' ').trim();
    const isPlausibleDataRow =
      isPlausibleUnitValue(rawStorageUnit) ||
      isPlausibleUnitValue(rawPackagingUnit) ||
      storageUnit.length > 0 ||
      packagingUnit.length > 0;

    lineInfos.push({
      yTop: line[0].yTop,
      articleText,
      // On conserve les fragments bruts jusqu'au regroupement de la ligne
      // logique. Nettoyer "au" avant de voir le fragment voisin "L" le
      // convertirait à tort en "au Kg".
      storageUnit: rawStorageUnit,
      packagingUnit: rawPackagingUnit,
      articleConfidence: minConfidence(articleWords),
      storageConfidence: minConfidence(storageWords),
      packagingConfidence: minConfidence(packagingWords),
      codeValue,
      // La présence du code suffit à ancrer la ligne logique. Le PDF peut
      // positionner le code, l'article et les unités sur des baselines
      // différentes : exiger l'unité sur la même ligne ferait disparaître
      // silencieusement l'article complet.
      isAnchor: hasCodeColumn
        ? isAnchorFromCode
        : isPlausibleDataRow,
    });
  });

  const anchorIndices = lineInfos.reduce<number[]>((acc, l, idx) => {
    if (l.isAnchor) acc.push(idx);
    return acc;
  }, []);

  if (anchorIndices.length === 0) {
    // Repli : pas de ligne "ancre" détectée (aucune valeur unité/conditionnement
    // reconnue) -> traitement simple ligne à ligne.
    lineInfos.forEach((l) => {
      if (l.articleText) {
        rows.push({
          sourceCode: l.codeValue || undefined,
          article: l.articleText,
          storageUnit: cleanImportedStorageUnit(l.storageUnit) || inferStorageUnitFromArticle(l.articleText),
          packagingUnit: cleanImportedPackagingUnit(l.packagingUnit),
          cellConfidence: { storageUnit: l.storageConfidence, packagingUnit: l.packagingConfidence },
        });
      }
    });
  } else {
    const articleTextByAnchorPos: string[][] = anchorIndices.map(() => []);
    const storageUnitByAnchorPos: string[][] = anchorIndices.map(() => []);
    const packagingUnitByAnchorPos: string[][] = anchorIndices.map(() => []);
    const articleConfidenceByAnchorPos: (number | undefined)[] = anchorIndices.map(() => undefined);
    const storageFragmentConfidences: (number | undefined)[][] = anchorIndices.map(() => []);
    const packagingFragmentConfidences: (number | undefined)[][] = anchorIndices.map(() => []);

    // La distance admissible dépend de l'espacement réel des codes. Elle
    // s'adapte donc aussi bien aux coordonnées pdf.js qu'aux coordonnées OCR
    // rendues à une échelle supérieure, sans seuil fixe propre à un fichier.
    const getAnchorMergeDistance = (anchorPos: number): number => {
      const anchorY = lineInfos[anchorIndices[anchorPos]].yTop;
      const neighborGaps: number[] = [];
      if (anchorPos > 0) neighborGaps.push(anchorY - lineInfos[anchorIndices[anchorPos - 1]].yTop);
      if (anchorPos < anchorIndices.length - 1) {
        neighborGaps.push(lineInfos[anchorIndices[anchorPos + 1]].yTop - anchorY);
      }
      if (neighborGaps.length === 0) return 90;
      return Math.max(30, Math.min(180, Math.min(...neighborGaps) * 0.5));
    };

    lineInfos.forEach((line, idx) => {
      let nearestPos = 0;
      let bestDistance = Infinity;
      anchorIndices.forEach((anchorIdx, pos) => {
        const distance = Math.abs(lineInfos[anchorIdx].yTop - line.yTop);
        if (distance < bestDistance) {
          bestDistance = distance;
          nearestPos = pos;
        }
      });
      if (bestDistance > getAnchorMergeDistance(nearestPos)) return;

      // Ligne "ancre" elle-même : on garde toujours son contenu, même court.
      // Ligne voisine (wrap d'article ou de valeur) : un fragment Unité/
      // Conditionnement isolé et trop court (1 caractère utile ou moins) est
      // presque toujours une bordure de tableau mal lue par l'OCR plutôt
      // qu'une vraie suite de valeur ("=" , "a", "R 9", "A"...).
      const isOwnAnchorLine = idx === anchorIndices[nearestPos];

      if (line.unreadable) articleConfidenceByAnchorPos[nearestPos] = 0;
      articleConfidenceByAnchorPos[nearestPos] = minDefined(
        articleConfidenceByAnchorPos[nearestPos],
        line.articleConfidence,
      );
      if (line.articleText) articleTextByAnchorPos[nearestPos].push(line.articleText);
      if (line.storageUnit && (isOwnAnchorLine || isPlausibleUnitFragment(line.storageUnit))) {
        pushUnitFragment(
          storageUnitByAnchorPos[nearestPos],
          storageFragmentConfidences[nearestPos],
          line.storageUnit,
          line.storageConfidence,
        );
      }
      if (line.packagingUnit && (isOwnAnchorLine || isPlausibleUnitFragment(line.packagingUnit))) {
        pushUnitFragment(
          packagingUnitByAnchorPos[nearestPos],
          packagingFragmentConfidences[nearestPos],
          line.packagingUnit,
          line.packagingConfidence,
        );
      }
    });

    anchorIndices.forEach((_anchorIdx, pos) => {
      const article = articleTextByAnchorPos[pos].join('\n').trim();
      const storageCell = joinFragments(storageUnitByAnchorPos[pos], storageFragmentConfidences[pos]);
      const packagingCell = joinFragments(packagingUnitByAnchorPos[pos], packagingFragmentConfidences[pos]);
      const storageUnit = cleanImportedStorageUnit(storageCell.text) || inferStorageUnitFromArticle(article);
      if (article) {
        rows.push({
          sourceCode: lineInfos[anchorIndices[pos]].codeValue || undefined,
          article,
          storageUnit,
          packagingUnit: cleanImportedPackagingUnit(packagingCell.text),
          cellConfidence: {
            article: articleConfidenceByAnchorPos[pos],
            storageUnit: storageCell.confidence,
            packagingUnit: packagingCell.confidence,
          },
        });
      }
    });
  }

  const repairedRows = rows.map(repairParsedRow);
  rows.splice(0, rows.length, ...repairedRows);

  const codeCount = hasCodeColumn ? anchorIndices.length : 0;
  const incompleteCodeCount = hasCodeColumn ? Math.max(0, codeCount - rows.length) : 0;
  const suspiciousRowCount = rows.filter(isSuspiciousParsedRow).length;

  return {
    rows,
    bounds,
    debug: {
      wordCount: words.length,
      lineCount: lines.length,
      headerFound,
      rowCount: rows.length,
      codeCount,
      incompleteCodeCount,
      suspiciousRowCount,
    },
  };
};

// Combine les mots de plusieurs pages (dans l'ordre) en lignes de tableau.
export const extractRowsFromDocumentWords = (
  pagesWords: ExtractedWord[][]
): DocumentExtractionResult => {
  const rows: ParsedTemplateRow[] = [];
  const pagesDebug: PageExtractionDebug[] = [];
  let bounds: ColumnBounds | null = null;
  let headerFound = false;

  pagesWords.forEach((words) => {
    const result = extractRowsFromPageWords(words, bounds);
    bounds = result.bounds;
    if (result.debug.headerFound) headerFound = true;
    pagesDebug.push(result.debug);
    rows.push(...result.rows);
  });

  const reconciledRows = reconcileUnitsWithReliableValues(rows);
  const codeCount = pagesDebug.reduce((total, page) => total + page.codeCount, 0);
  const incompleteCodeCount = pagesDebug.reduce((total, page) => total + page.incompleteCodeCount, 0);
  const suspiciousRowCount = reconciledRows.filter(isSuspiciousParsedRow).length;
  const needsReview =
    !headerFound ||
    reconciledRows.length === 0 ||
    incompleteCodeCount > 0 ||
    suspiciousRowCount > 0;

  return {
    rows: reconciledRows,
    headerFound,
    pagesDebug,
    codeCount,
    incompleteCodeCount,
    suspiciousRowCount,
    needsReview,
  };
};

// Compare deux extractions (texte natif / OCR) sans dépendre d'un fournisseur
// ou d'un libellé particulier. La complétude prime, puis la qualité des champs.
export const scoreTemplateExtraction = (result: DocumentExtractionResult): number => {
  const completeRows = result.rows.length - result.suspiciousRowCount;
  const codedRows = result.rows.filter((row) => row.sourceCode).length;
  const uncodedRows = result.rows.length - codedRows;
  const rowScore = codedRows > 0
    ? codedRows * 240 - uncodedRows * 120
    : result.rows.length * 200;
  return (
    rowScore +
    completeRows * 25 -
    result.incompleteCodeCount * 150 -
    result.suspiciousRowCount * 35 +
    (result.headerFound ? 20 : -200)
  );
};

const scoreOcrArticleCandidate = (article: string): number => {
  const cleaned = cleanImportedArticleText(article);
  if (!cleaned) return -1000;
  const usefulLength = cleaned.replace(/[^a-zà-ÿ0-9]/gi, '').length;
  const lineBonus = Math.max(0, cleaned.split(/\n+/).filter(Boolean).length - 1) * 8;
  return usefulLength + lineBonus - (isSuspiciousArticleText(cleaned) ? 80 : 0);
};

// Deux segmentations OCR peuvent être complémentaires : AUTO lit mieux les
// blocs de texte complexes, tandis que SINGLE_BLOCK conserve parfois mieux
// la structure des lignes d'un tableau quadrillé. On aligne les résultats par
// code et on choisit le libellé le plus complet, sans jamais créer une ligne
// issue d'un fragment OCR dépourvu de code.
export const mergeOcrExtractions = (
  firstResult: DocumentExtractionResult,
  secondResult: DocumentExtractionResult,
): DocumentExtractionResult => {
  const countCodedRows = (result: DocumentExtractionResult) =>
    result.rows.filter((row) => row.sourceCode).length;
  const firstCoded = countCodedRows(firstResult);
  const secondCoded = countCodedRows(secondResult);
  const primary = secondCoded > firstCoded || (
    secondCoded === firstCoded && scoreTemplateExtraction(secondResult) > scoreTemplateExtraction(firstResult)
  ) ? secondResult : firstResult;
  const secondary = primary === firstResult ? secondResult : firstResult;
  const secondaryByCode = new Map(
    secondary.rows
      .filter((row) => row.sourceCode)
      .map((row) => [row.sourceCode as string, row]),
  );
  const primaryCodes = new Set(primary.rows.map((row) => row.sourceCode).filter(Boolean));

  const rows = primary.rows
    .filter((row) => row.sourceCode || countCodedRows(primary) === 0)
    .map((primaryRow) => {
      const secondaryRow = primaryRow.sourceCode
        ? secondaryByCode.get(primaryRow.sourceCode)
        : undefined;
      const secondaryArticleWins = Boolean(secondaryRow) &&
        scoreOcrArticleCandidate(secondaryRow!.article) > scoreOcrArticleCandidate(primaryRow.article);
      const article = secondaryArticleWins ? secondaryRow!.article : primaryRow.article;
      return repairParsedRow({
        sourceCode: primaryRow.sourceCode || secondaryRow?.sourceCode,
        article,
        storageUnit: primaryRow.storageUnit || secondaryRow?.storageUnit || '',
        packagingUnit: primaryRow.packagingUnit || secondaryRow?.packagingUnit || '',
        cellConfidence: mergeCellConfidence(primaryRow, secondaryRow, secondaryArticleWins ? secondaryRow : primaryRow),
      });
    });

  secondary.rows.forEach((row, secondaryIndex) => {
    if (
      row.sourceCode &&
      !primaryCodes.has(row.sourceCode) &&
      !hasEquivalentArticle(rows, row.article)
    ) {
      // Un fragment douteux sans correspondance n'est pas une vraie ligne.
      const repaired = repairParsedRow(row);
      if (isCredibleSecondaryRow(repaired)) insertInDocumentOrder(rows, secondary.rows, secondaryIndex, repaired);
    }
  });

  const returnedCodeCount = new Set(rows.map((row) => row.sourceCode).filter(Boolean)).size;
  // Les deux lectures se complètent : le total détecté ne peut pas être
  // inférieur au nombre de codes réellement restitués par leur union.
  const codeCount = Math.max(firstResult.codeCount, secondResult.codeCount, returnedCodeCount);
  const incompleteCodeCount = Math.max(0, codeCount - returnedCodeCount);
  const suspiciousRowCount = rows.filter(isSuspiciousParsedRow).length;
  const headerFound = firstResult.headerFound || secondResult.headerFound;

  return {
    rows,
    headerFound,
    pagesDebug: primary.pagesDebug,
    codeCount,
    incompleteCodeCount,
    suspiciousRowCount,
    needsReview: !headerFound || rows.length === 0 || incompleteCodeCount > 0 || suspiciousRowCount > 0,
  };
};

// Le texte natif d'un PDF est généralement plus fidèle que l'OCR pour les
// accents, marques et fins de lignes. L'OCR reste utile pour compléter un code
// ou une cellule réellement absente. Cette fusion conserve donc le libellé
// natif et ne prend dans l'OCR que les champs manquants, en alignant les lignes
// par code produit plutôt que par leur position dans le tableau.
export const mergeTemplateExtractions = (
  nativeResult: DocumentExtractionResult,
  ocrResult: DocumentExtractionResult,
): DocumentExtractionResult => {
  if (nativeResult.rows.length === 0) return ocrResult;
  if (ocrResult.rows.length === 0) return nativeResult;

  const ocrByCode = new Map(
    ocrResult.rows
      .filter((row) => row.sourceCode)
      .map((row) => [row.sourceCode as string, row]),
  );
  const nativeCodes = new Set(nativeResult.rows.map((row) => row.sourceCode).filter(Boolean));

  const rows = nativeResult.rows.map((nativeRow, index) => {
    const ocrRow = nativeRow.sourceCode
      ? ocrByCode.get(nativeRow.sourceCode)
      : ocrResult.rows[index];

    const ocrArticleWins = Boolean(
      nativeRow.article &&
      isSuspiciousArticleText(nativeRow.article) &&
      ocrRow?.article &&
      !isSuspiciousArticleText(ocrRow.article),
    );

    return repairParsedRow({
      sourceCode: nativeRow.sourceCode || ocrRow?.sourceCode,
      // Ne jamais remplacer un texte PDF existant par une reconnaissance
      // visuelle moins fidèle, sauf si ce texte est corrompu et que l'OCR
      // propose un libellé sain. Elle peut sinon combler une valeur vide.
      article: ocrArticleWins ? ocrRow!.article : nativeRow.article || ocrRow?.article || '',
      storageUnit: nativeRow.storageUnit || ocrRow?.storageUnit || '',
      packagingUnit: nativeRow.packagingUnit || ocrRow?.packagingUnit || '',
      cellConfidence: mergeCellConfidence(
        nativeRow,
        ocrRow,
        ocrArticleWins || !nativeRow.article ? ocrRow : nativeRow,
      ),
    });
  });

  ocrResult.rows.forEach((ocrRow, ocrIndex) => {
    if (
      ocrRow.sourceCode &&
      !nativeCodes.has(ocrRow.sourceCode) &&
      !hasEquivalentArticle(rows, ocrRow.article)
    ) {
      const repaired = repairParsedRow(ocrRow);
      if (isCredibleSecondaryRow(repaired)) insertInDocumentOrder(rows, ocrResult.rows, ocrIndex, repaired);
    }
  });

  const returnedCodeCount = new Set(rows.map((row) => row.sourceCode).filter(Boolean)).size;
  const codeCount = Math.max(nativeResult.codeCount, ocrResult.codeCount, returnedCodeCount);
  const incompleteCodeCount = Math.max(0, codeCount - returnedCodeCount);
  const suspiciousRowCount = rows.filter(isSuspiciousParsedRow).length;
  const headerFound = nativeResult.headerFound || ocrResult.headerFound;
  const needsReview =
    !headerFound ||
    rows.length === 0 ||
    incompleteCodeCount > 0 ||
    suspiciousRowCount > 0;

  return {
    rows,
    headerFound,
    pagesDebug: nativeResult.pagesDebug,
    codeCount,
    incompleteCodeCount,
    suspiciousRowCount,
    needsReview,
  };
};
