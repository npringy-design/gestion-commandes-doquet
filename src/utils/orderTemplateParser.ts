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
}

export interface ParsedTemplateRow {
  article: string;
  storageUnit: string;
  packagingUnit: string;
}

export interface PageExtractionDebug {
  wordCount: number;
  lineCount: number;
  headerFound: boolean;
  rowCount: number;
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
// Code+Articles, est traité comme la valeur de la colonne "Code" (les
// quantités isolées type "5" ou "20g" ne matchent pas ce format).
const CODE_VALUE_PATTERN = /^\d{3,}$/;

// Un fragment Unité/Conditionnement récupéré sur une ligne voisine (wrap)
// n'est retenu que s'il contient au moins 2 caractères alphanumériques utiles :
// un fragment plus court ("=", "a", "A", "9"...) est presque toujours une
// bordure de tableau mal lue par l'OCR, pas une vraie suite de valeur.
const isPlausibleUnitFragment = (text: string): boolean =>
  text.replace(/[^a-zà-ÿ0-9]/gi, '').length >= 2;

const UNIT_KEYWORD_PATTERN =
  /\b(au|aux|a|l|unite|piece|pieces|kg|g|gr|ml|cl|l|litre|litres|bac|carton|colis|sachet|sac|boite|pot|seau|barquette|poche|bidon|bouteille|portion|plaquette)\b/;

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

const cleanImportedStorageUnit = (text: string): string => {
  const loose = normalizeLooseUnitText(text);
  if (!loose) return '';

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

  const kindMatch = loose.match(/\b(carton|colis|bac|sachet|sac|boite|pot|seau|barquette|poche|bidon|bouteille)\b/);
  const quantityMatch = loose.match(/(?:\bx\b\s*)?(\d+)\b/);

  if (kindMatch) {
    const kind = kindMatch[1];
    return quantityMatch ? `${kind} x ${quantityMatch[1]}` : kind;
  }

  return text
    .replace(/[;:,?]+/g, ' ')
    .replace(/\s*x\s*/gi, ' x ')
    .replace(/\s+/g, ' ')
    .trim();
};

const inferStorageUnitFromArticle = (article: string): string => {
  const loose = normalizeLooseUnitText(article);
  if (!loose) return '';

  if (/\bau\s+kg\b|\baux\s+kg\b/.test(loose)) return 'au Kg';
  if (/\btranche\b/.test(loose)) return 'tranche';
  if (/\bpieces?\b|\bpiece\b|\bpi\s*ce\b/.test(loose)) return 'pièce';
  if (/\bbac\b/.test(loose)) return 'bac';
  if (/\b\d+(?:[.,]\d+)?\s*(kg|g|gr)\b/.test(loose)) return 'au Kg';

  return '';
};

// Regroupe les mots d'une page en lignes en fonction de leur proximité verticale.
// Tolérance généreuse car les bbox OCR (rendu canvas) sont moins régulières
// que les positions natives pdf.js.
const clusterLines = (words: ExtractedWord[], tolerance = 6): ExtractedWord[][] => {
  const sorted = [...words].sort((a, b) => a.yTop - b.yTop || a.x - b.x);
  const lines: ExtractedWord[][] = [];

  sorted.forEach((word) => {
    const currentLine = lines[lines.length - 1];
    if (currentLine && Math.abs(currentLine[0].yTop - word.yTop) <= tolerance) {
      currentLine.push(word);
    } else {
      lines.push([word]);
    }
  });

  return lines;
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
}

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
      for (let windowSize = 1; windowSize <= HEADER_WINDOW_MAX_LINES && i + windowSize <= lines.length; windowSize++) {
        const merged = lines.slice(i, i + windowSize).flat();
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
    return { rows, bounds, debug: { wordCount: words.length, lineCount: lines.length, headerFound, rowCount: 0 } };
  }

  const { hasCodeColumn, stockTamponStart, unitStart, conditionStart } = bounds;
  const adjustedStockTamponStart = stockTamponStart !== null ? stockTamponStart - COLUMN_MARGIN : null;
  const adjustedUnitStart = unitStart - COLUMN_MARGIN;
  const adjustedConditionStart = conditionStart - COLUMN_MARGIN;
  const articleEnd = adjustedStockTamponStart ?? adjustedUnitStart;

  const lineInfos: LineInfo[] = [];

  bodyLines.forEach((line) => {
    const cleanedWords = line
      .map((w) => ({ ...w, text: cleanWordText(w.text) }))
      .filter((w) => w.text.length > 0);
    if (cleanedWords.length === 0) return;

    const sorted = [...cleanedWords].sort((a, b) => a.x - b.x);
    const joined = sorted.map((w) => w.text).join(' ');
    if (isNoiseLine(joined)) return;

    let articleWords = sorted.filter((w) => w.x < articleEnd);
    let isAnchorFromCode = false;
    if (hasCodeColumn && articleWords.length > 0 && CODE_VALUE_PATTERN.test(articleWords[0].text)) {
      articleWords = articleWords.slice(1);
      isAnchorFromCode = true;
    }

    const rawStorageUnit = sorted
      .filter((w) => w.x >= adjustedUnitStart && w.x < adjustedConditionStart)
      .map((w) => w.text)
      .join(' ')
      .trim();
    const rawPackagingUnit = sorted.filter((w) => w.x >= adjustedConditionStart).map((w) => w.text).join(' ').trim();
    const storageUnit = cleanImportedStorageUnit(rawStorageUnit);
    const packagingUnit = cleanImportedPackagingUnit(rawPackagingUnit);
    const articleText = articleWords.map((w) => w.text).join(' ').trim();
    const isPlausibleDataRow =
      isPlausibleUnitValue(rawStorageUnit) ||
      isPlausibleUnitValue(rawPackagingUnit) ||
      storageUnit.length > 0 ||
      packagingUnit.length > 0;

    if (hasCodeColumn && isAnchorFromCode && !isPlausibleDataRow) return;

    lineInfos.push({
      yTop: line[0].yTop,
      articleText,
      storageUnit,
      packagingUnit,
      // Quand une colonne Code existe, seule une ligne portant un vrai code
      // démarre une nouvelle ligne logique : une valeur Unité/Conditionnement
      // qui déborde sur la ligne suivante (ex: "à" / "l'unité") ne doit pas
      // créer une seconde ligne de tableau pour le même produit.
      isAnchor: hasCodeColumn
        ? isAnchorFromCode && isPlausibleDataRow
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
        rows.push({ article: l.articleText, storageUnit: l.storageUnit, packagingUnit: l.packagingUnit });
      }
    });
  } else {
    const articleTextByAnchorPos: string[][] = anchorIndices.map(() => []);
    const storageUnitByAnchorPos: string[][] = anchorIndices.map(() => []);
    const packagingUnitByAnchorPos: string[][] = anchorIndices.map(() => []);

    // Du bruit résiduel (fragment d'en-tête, section) peut traîner isolé entre
    // deux lignes réelles : on ne rattache une ligne à l'ancre la plus proche
    // que si elle en reste réellement proche (même bloc visuel de ligne),
    // sinon on la jette plutôt que de polluer une ligne de tableau valide.
    const MAX_ANCHOR_MERGE_DISTANCE = 45;

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
      if (bestDistance > MAX_ANCHOR_MERGE_DISTANCE) return;

      // Ligne "ancre" elle-même : on garde toujours son contenu, même court.
      // Ligne voisine (wrap d'article ou de valeur) : un fragment Unité/
      // Conditionnement isolé et trop court (1 caractère utile ou moins) est
      // presque toujours une bordure de tableau mal lue par l'OCR plutôt
      // qu'une vraie suite de valeur ("=" , "a", "R 9", "A"...).
      const isOwnAnchorLine = idx === anchorIndices[nearestPos];

      if (line.articleText) articleTextByAnchorPos[nearestPos].push(line.articleText);
      if (line.storageUnit && (isOwnAnchorLine || isPlausibleUnitFragment(line.storageUnit))) {
        storageUnitByAnchorPos[nearestPos].push(line.storageUnit);
      }
      if (line.packagingUnit && (isOwnAnchorLine || isPlausibleUnitFragment(line.packagingUnit))) {
        packagingUnitByAnchorPos[nearestPos].push(line.packagingUnit);
      }
    });

    anchorIndices.forEach((_anchorIdx, pos) => {
      const article = articleTextByAnchorPos[pos].join('\n').trim();
      const storageUnit = storageUnitByAnchorPos[pos].join(' ').trim() || inferStorageUnitFromArticle(article);
      if (article) {
        rows.push({
          article,
          storageUnit,
          packagingUnit: packagingUnitByAnchorPos[pos].join(' ').trim(),
        });
      }
    });
  }

  return {
    rows,
    bounds,
    debug: { wordCount: words.length, lineCount: lines.length, headerFound, rowCount: rows.length },
  };
};

// Combine les mots de plusieurs pages (dans l'ordre) en lignes de tableau.
export const extractRowsFromDocumentWords = (
  pagesWords: ExtractedWord[][]
): { rows: ParsedTemplateRow[]; headerFound: boolean; pagesDebug: PageExtractionDebug[] } => {
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

  return { rows, headerFound, pagesDebug };
};
