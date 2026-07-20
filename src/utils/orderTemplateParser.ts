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
  sourceCode?: string;
  article: string;
  storageUnit: string;
  packagingUnit: string;
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
const CODE_VALUE_PATTERN = /^\d{3,}$/;
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
  /\b(au|aux|a|l|unite|piece|pieces|kg|g|gr|ml|cl|l|litre|litres|bac|carton|colis|sachet|sac|boite|pot|seau|barquette|poche|bidon|bouteille|portion|plaquette|brique|bombe|pack|lot)\b/;

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
  if (/\b\d+(?:[.,]\d+)?\s*(l|litre|litres|cl|ml)\b/.test(loose)) return 'au L';

  return '';
};

// Certaines extractions placent une valeur de stockage juste après la
// frontière calculée de la colonne. Les valeurs ci-dessous ne sont pas des
// conditionnements : si la cellule stockage est vide, on peut donc les
// remettre à gauche sans dépendre d'un fournisseur ou d'un libellé produit.
const isUnambiguousStorageOnlyValue = (value: string): boolean =>
  /^(?:au\s+kg|au\s+l|a\s+l\s+unite|a\s+lunite)$/i.test(normalizeLooseUnitText(value));

const repairParsedRow = (row: ParsedTemplateRow): ParsedTemplateRow => {
  let storageUnit = cleanImportedStorageUnit(row.storageUnit);
  let packagingUnit = cleanImportedPackagingUnit(row.packagingUnit);

  if (!storageUnit && isUnambiguousStorageOnlyValue(packagingUnit)) {
    storageUnit = cleanImportedStorageUnit(packagingUnit);
    packagingUnit = '';
  }

  if (!storageUnit) storageUnit = inferStorageUnitFromArticle(row.article);

  return {
    ...row,
    article: row.article.trim(),
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

const isSuspiciousParsedRow = (row: ParsedTemplateRow): boolean =>
  isSuspiciousArticleText(row.article) ||
  !row.storageUnit.trim() ||
  !row.packagingUnit.trim() ||
  !isPlausibleUnitValue(row.storageUnit) ||
  !isPlausibleUnitValue(row.packagingUnit);

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
  codeValue: string;
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

    lineInfos.push({
      yTop: line[0].yTop,
      articleText,
      // On conserve les fragments bruts jusqu'au regroupement de la ligne
      // logique. Nettoyer "au" avant de voir le fragment voisin "L" le
      // convertirait à tort en "au Kg".
      storageUnit: rawStorageUnit,
      packagingUnit: rawPackagingUnit,
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
        });
      }
    });
  } else {
    const articleTextByAnchorPos: string[][] = anchorIndices.map(() => []);
    const storageUnitByAnchorPos: string[][] = anchorIndices.map(() => []);
    const packagingUnitByAnchorPos: string[][] = anchorIndices.map(() => []);

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

      if (line.articleText) articleTextByAnchorPos[nearestPos].push(line.articleText);
      if (line.storageUnit && (isOwnAnchorLine || isPlausibleUnitFragment(line.storageUnit))) {
        pushUniqueUnitFragment(storageUnitByAnchorPos[nearestPos], line.storageUnit);
      }
      if (line.packagingUnit && (isOwnAnchorLine || isPlausibleUnitFragment(line.packagingUnit))) {
        pushUniqueUnitFragment(packagingUnitByAnchorPos[nearestPos], line.packagingUnit);
      }
    });

    anchorIndices.forEach((_anchorIdx, pos) => {
      const article = articleTextByAnchorPos[pos].join('\n').trim();
      const storageUnit =
        cleanImportedStorageUnit(storageUnitByAnchorPos[pos].join(' ').trim()) ||
        inferStorageUnitFromArticle(article);
      if (article) {
        rows.push({
          sourceCode: lineInfos[anchorIndices[pos]].codeValue || undefined,
          article,
          storageUnit,
          packagingUnit: cleanImportedPackagingUnit(packagingUnitByAnchorPos[pos].join(' ').trim()),
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

  const codeCount = pagesDebug.reduce((total, page) => total + page.codeCount, 0);
  const incompleteCodeCount = pagesDebug.reduce((total, page) => total + page.incompleteCodeCount, 0);
  const suspiciousRowCount = pagesDebug.reduce((total, page) => total + page.suspiciousRowCount, 0);
  const needsReview =
    !headerFound ||
    rows.length === 0 ||
    incompleteCodeCount > 0 ||
    suspiciousRowCount > 0;

  return {
    rows,
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
  return (
    result.rows.length * 200 +
    completeRows * 25 -
    result.incompleteCodeCount * 150 -
    result.suspiciousRowCount * 35 +
    (result.headerFound ? 20 : -200)
  );
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

    return repairParsedRow({
      sourceCode: nativeRow.sourceCode || ocrRow?.sourceCode,
      // Ne jamais remplacer un texte PDF existant par une reconnaissance
      // visuelle moins fidèle. Elle peut seulement combler une valeur vide.
      article: nativeRow.article || ocrRow?.article || '',
      storageUnit: nativeRow.storageUnit || ocrRow?.storageUnit || '',
      packagingUnit: nativeRow.packagingUnit || ocrRow?.packagingUnit || '',
    });
  });

  ocrResult.rows.forEach((ocrRow) => {
    if (ocrRow.sourceCode && !nativeCodes.has(ocrRow.sourceCode)) {
      rows.push(repairParsedRow(ocrRow));
    }
  });

  const codeCount = Math.max(nativeResult.codeCount, ocrResult.codeCount);
  const returnedCodeCount = new Set(rows.map((row) => row.sourceCode).filter(Boolean)).size;
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
