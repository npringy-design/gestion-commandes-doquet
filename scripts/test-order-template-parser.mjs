import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const sourcePath = join(root, 'src', 'utils', 'orderTemplateParser.ts');
const tempDir = mkdtempSync(join(root, '.order-template-parser-'));

const wordsAt = (text, x, yTop) =>
  text.split(/\s+/).map((word, index) => ({ text: word, x: x + index * 15, yTop }));

const articleLine = ({ yTop, code, article, storageUnit = 'au Kg', packagingUnit = '' }) => [
  ...(code ? wordsAt(code, 20, yTop) : []),
  ...wordsAt(article, 100, yTop),
  ...(storageUnit ? wordsAt(storageUnit, 310, yTop) : []),
  ...(packagingUnit ? wordsAt(packagingUnit, 470, yTop) : []),
];

try {
  const { outputText, diagnostics = [] } = ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
    fileName: sourcePath,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
    },
  });
  assert.equal(
    diagnostics.length,
    0,
    diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')).join('\n'),
  );

  const compiledPath = join(tempDir, 'orderTemplateParser.mjs');
  writeFileSync(compiledPath, outputText, 'utf8');
  const {
    extractRowsFromDocumentWords,
    extractRowsFromPageWords,
    mergeOcrExtractions,
    mergeTemplateExtractions,
    scoreTemplateExtraction,
    separateUnreadableRows,
  } = await import(pathToFileURL(compiledPath).href);

  const header = [
    { text: 'Code', x: 20, yTop: 20 },
    { text: 'Articles', x: 100, yTop: 20 },
    { text: 'Unité', x: 310, yTop: 20 },
    { text: 'de', x: 340, yTop: 20 },
    { text: 'Stock', x: 365, yTop: 20 },
    { text: 'Unité', x: 440, yTop: 20 },
    { text: 'de', x: 455, yTop: 20 },
    { text: 'conditionnement', x: 470, yTop: 20 },
  ];

  const domafraisWords = [
    ...header,
    ...articleLine({ yTop: 100, code: '147017', article: 'Andouillette 5a Troye (200gx2) sachet', packagingUnit: 'carton x 8' }),
    ...articleLine({ yTop: 118, article: '400 g LA CHAMPENOISE' }),
    ...articleLine({ yTop: 180, code: '72372', article: 'Bavette aloyau Irlande pièce 160 g', packagingUnit: 'poche x 5' }),
    ...articleLine({ yTop: 198, article: 'LESAGE' }),
    ...articleLine({ yTop: 248, article: 'Cote de boeuf VBF décongelé pièce 400', storageUnit: 'au' }),
    ...wordsAt('200269', 20, 268),
    ...articleLine({ yTop: 288, article: 'g PUIGRENIER', storageUnit: 'Kg', packagingUnit: 'pièce' }),
    ...articleLine({ yTop: 340, code: '200272', article: 'Entrecôte VBF Décongelé pièce pièce', packagingUnit: 'poche x 2' }),
    ...articleLine({ yTop: 358, article: '300 G PUIGRENIER' }),
    ...articleLine({ yTop: 420, code: '140680', article: 'Faux filet VBF decongel pièce 200 G', packagingUnit: 'poche x 5' }),
    ...articleLine({ yTop: 438, article: 'PUIGRENIER' }),
    ...articleLine({ yTop: 500, code: '73201', article: 'Onglet boeuf irlandais pièce 200 G', packagingUnit: 'poche x 5' }),
    ...articleLine({ yTop: 518, article: 'LESAGE' }),
    ...articleLine({ yTop: 580, code: '200746', article: 'Persillé irlandais pièce 170 g LESAGE', packagingUnit: 'poche x 5' }),
  ];

  const { rows, debug } = extractRowsFromPageWords(domafraisWords);

  assert.equal(debug.headerFound, true, 'L en-tete Domafrais doit etre detecte');
  assert.equal(debug.codeCount, 7, 'Chaque code article doit devenir une ancre logique');
  assert.equal(debug.incompleteCodeCount, 0, 'Aucun code detecte ne doit disparaitre du resultat');
  assert.equal(rows.length, 7, 'Les sept articles du PDF doivent produire exactement sept lignes');
  assert.deepEqual(
    rows.map((row) => row.article),
    [
      'Andouillette 5a Troye (200gx2) sachet\n400 g LA CHAMPENOISE',
      'Bavette aloyau Irlande pièce 160 g\nLESAGE',
      'Cote de boeuf VBF décongelé pièce 400\ng PUIGRENIER',
      'Entrecôte VBF Décongelé pièce pièce\n300 G PUIGRENIER',
      'Faux filet VBF decongel pièce 200 G\nPUIGRENIER',
      'Onglet boeuf irlandais pièce 200 G\nLESAGE',
      'Persillé irlandais pièce 170 g LESAGE',
    ],
    'Les retours a la ligne internes doivent rester rattaches a leur article',
  );
  assert.deepEqual(
    rows.map((row) => row.storageUnit),
    Array(7).fill('au Kg'),
    'Une unite repetee sur les lignes physiques ne doit pas devenir "au Kg au Kg"',
  );
  assert.deepEqual(
    rows.map((row) => row.packagingUnit),
    ['carton x 8', 'poche x 5', 'pièce', 'poche x 2', 'poche x 5', 'poche x 5', 'poche x 5'],
  );

  const shortCodeWords = [
    ...header,
    ...articleLine({ yTop: 100, code: '400', article: 'Produit test', packagingUnit: 'carton x 2' }),
  ];
  assert.equal(
    extractRowsFromPageWords(shortCodeWords).rows.length,
    1,
    'Un vrai code article de trois chiffres doit rester accepte',
  );

  const scaledOcrWords = [
    ...header,
    ...articleLine({ yTop: 140, article: 'Crème anglaise bouteille 1 L', storageUnit: 'bouteille' }),
    ...wordsAt('550770', 20, 200),
    ...articleLine({ yTop: 260, article: 'PRESIDENT RDP', storageUnit: '', packagingUnit: 'carton x 6' }),
    ...articleLine({ yTop: 380, article: 'Crème fraîche brique 100 cl BOURG', storageUnit: 'au L' }),
    ...wordsAt('100246', 20, 440),
    ...articleLine({ yTop: 500, article: 'FLEURI', storageUnit: '', packagingUnit: 'brique' }),
  ];
  const scaledOcrResult = extractRowsFromPageWords(scaledOcrWords);
  assert.equal(scaledOcrResult.rows.length, 2, 'Le regroupement doit s adapter a l echelle verticale de l OCR');
  assert.deepEqual(
    scaledOcrResult.rows.map((row) => row.article),
    ['Crème anglaise bouteille 1 L\nPRESIDENT RDP', 'Crème fraîche brique 100 cl BOURG\nFLEURI'],
    'Les continuations eloignees doivent suivre les bandes definies par les codes voisins',
  );

  const splitLiterWords = [
    ...header,
    ...articleLine({ yTop: 100, code: '56468', article: 'Crème liquide UHT brique 1 L', storageUnit: 'au', packagingUnit: 'carton' }),
    ...articleLine({ yTop: 118, article: 'BOURG FLEURI', storageUnit: 'L', packagingUnit: 'x 6' }),
  ];
  const splitLiterResult = extractRowsFromPageWords(splitLiterWords);
  assert.equal(splitLiterResult.rows[0].storageUnit, 'au L', 'Les fragments "au" et "L" doivent etre nettoyes ensemble');
  assert.equal(splitLiterResult.rows[0].packagingUnit, 'carton x 6', 'Le conditionnement fragmente doit etre recompose');

  const splitQuantityWords = [
    ...header,
    ...articleLine({ yTop: 100, code: '43263', article: 'Mini Dés Roquefort barquette', packagingUnit: 'lot x 2' }),
    ...wordsAt('250', 100, 116),
    ...wordsAt('g', 100, 126),
    ...articleLine({ yTop: 180, code: '190064', article: 'Oeuf 53 63 pièce 53 g FERME DU PRE', storageUnit: 'pièce', packagingUnit: 'boîte x 90' }),
  ];
  const splitQuantityResult = extractRowsFromPageWords(splitQuantityWords);
  assert.equal(splitQuantityResult.rows.length, 2, 'Un grammage dont le nombre et l unite ont deux baselines ne doit pas creer un faux code');
  assert.equal(
    splitQuantityResult.rows[0].article,
    'Mini Dés Roquefort barquette\n250\ng',
    'Le grammage fragmente doit rester avec le produit precedent',
  );
  assert.equal(
    splitQuantityResult.rows[1].article,
    'Oeuf 53 63 pièce 53 g FERME DU PRE',
    'Le fragment du grammage precedent ne doit pas polluer le produit suivant',
  );

  const pageOne = [
    ...header,
    ...articleLine({ yTop: 100, code: '190081', article: 'Comté AOP râpé 33% sachet 1 Kg', packagingUnit: 'sachet' }),
    ...articleLine({ yTop: 118, article: 'FRANCE FRAIS' }),
  ];
  const pageTwo = [
    ...wordsAt('20/07/2026 13:33', 20, 10),
    ...articleLine({ yTop: 100, code: '550770', article: 'Crème anglaise bouteille 1 L', storageUnit: 'bouteille', packagingUnit: 'carton x 6' }),
    ...articleLine({ yTop: 118, article: 'PRESIDENT RDP', storageUnit: '' }),
  ];
  const multipageResult = extractRowsFromDocumentWords([pageOne, pageTwo]);
  assert.equal(multipageResult.rows.length, 2, 'Les colonnes doivent rester actives sur une page suivante sans nouvel en-tete');
  assert.equal(multipageResult.codeCount, 2);
  assert.equal(multipageResult.incompleteCodeCount, 0);

  const degradedWords = [
    ...header,
    ...articleLine({ yTop: 100, code: '56253', article: 'pero tee da UT', storageUnit: 'bombe', packagingUnit: 'colis x 6' }),
  ];
  const degradedResult = extractRowsFromDocumentWords([degradedWords]);
  assert.equal(degradedResult.needsReview, true, 'Un libelle fortement fragmente doit demander un repli ou un controle');
  assert.equal(degradedResult.suspiciousRowCount, 1);
  assert.ok(
    scoreTemplateExtraction(multipageResult) > scoreTemplateExtraction(degradedResult),
    'Une extraction complete et lisible doit etre preferee a une extraction degradee',
  );

  const missingLiterUnitWords = [
    ...header,
    ...articleLine({
      yTop: 100,
      code: '900001',
      article: 'Préparation dessert brique 100 cl',
      storageUnit: '',
      packagingUnit: 'carton x 6',
    }),
  ];
  const missingLiterUnitResult = extractRowsFromDocumentWords([missingLiterUnitWords]);
  assert.equal(
    missingLiterUnitResult.rows[0].storageUnit,
    'au L',
    'Une unité liquide absente doit être déduite du volume de l article',
  );

  const shiftedStorageWords = [
    ...header,
    ...articleLine({
      yTop: 100,
      code: '900002',
      article: 'Fromage affiné',
      storageUnit: '',
      packagingUnit: 'au Kg',
    }),
  ];
  const shiftedStorageResult = extractRowsFromDocumentWords([shiftedStorageWords]);
  assert.equal(shiftedStorageResult.rows[0].storageUnit, 'au Kg');
  assert.equal(
    shiftedStorageResult.rows[0].packagingUnit,
    '',
    'Une valeur au Kg décalée dans conditionnement doit revenir dans stockage',
  );

  const faithfulNativeWords = [
    ...header,
    ...articleLine({
      yTop: 100,
      code: '900003',
      article: 'Crème anglaise bouteille 1 L',
      storageUnit: 'bouteille',
      packagingUnit: 'carton x 6',
    }),
    ...articleLine({ yTop: 118, article: 'MARQUE COMPLETE', storageUnit: '' }),
  ];
  const damagedOcrWords = [
    ...header,
    ...articleLine({
      yTop: 100,
      code: '900003',
      article: 'Crée anglaise pouteille 1 L',
      storageUnit: 'bouteille',
      packagingUnit: 'carfon x 6',
    }),
  ];
  const hybridResult = mergeTemplateExtractions(
    extractRowsFromDocumentWords([faithfulNativeWords]),
    extractRowsFromDocumentWords([damagedOcrWords]),
  );
  assert.equal(
    hybridResult.rows[0].article,
    'Crème anglaise bouteille 1 L\nMARQUE COMPLETE',
    'L OCR ne doit jamais manger ou déformer un libellé natif existant',
  );
  assert.equal(
    hybridResult.rows[0].packagingUnit,
    'carton x 6',
    'L OCR ne doit pas remplacer un conditionnement natif plus fidèle',
  );

  const offsetGlyphWords = [
    ...header,
    { text: '900004', x: 20, yTop: 100, height: 18 },
    { text: 'Produit', x: 100, yTop: 100, height: 18 },
    { text: 'MARQUE', x: 160, yTop: 100, height: 18 },
    // Les petits glyphes comme le tiret ont souvent une bbox plus basse que
    // les lettres de la même ligne dans Tesseract.
    { text: '-', x: 230, yTop: 108, height: 5 },
    { text: 'SUITE', x: 245, yTop: 100, height: 18 },
    { text: 'au', x: 310, yTop: 100, height: 18 },
    { text: 'Kg', x: 340, yTop: 100, height: 18 },
    { text: 'carton', x: 470, yTop: 100, height: 18 },
  ];
  assert.equal(
    extractRowsFromDocumentWords([offsetGlyphWords]).rows[0].article,
    'Produit MARQUE - SUITE',
    'La tolérance verticale doit suivre la taille OCR et garder les petits glyphes sur leur ligne',
  );

  const explicitOcrLineWords = [
    ...header,
    { text: '900005', x: 20, yTop: 100, height: 18, lineId: 'ocr-row-1' },
    { text: 'Préparation', x: 100, yTop: 100, height: 18, lineId: 'ocr-row-1' },
    { text: '700', x: 190, yTop: 100, height: 18, lineId: 'ocr-row-1' },
    { text: 'mi', x: 225, yTop: 108, height: 5, lineId: 'ocr-row-1' },
    { text: 'au', x: 310, yTop: 100, height: 18, lineId: 'ocr-row-1' },
    { text: 'L', x: 340, yTop: 108, height: 5, lineId: 'ocr-row-1' },
    { text: 'plaque', x: 470, yTop: 100, height: 18, lineId: 'ocr-row-1' },
  ];
  const explicitOcrLineResult = extractRowsFromDocumentWords([explicitOcrLineWords]);
  assert.equal(
    explicitOcrLineResult.rows[0].article,
    'Préparation 700 ml',
    'Les lignes natives de Tesseract doivent être conservées et la quantité ml normalisée',
  );
  assert.equal(explicitOcrLineResult.rows[0].storageUnit, 'au L');
  assert.equal(explicitOcrLineResult.suspiciousRowCount, 0, 'Le conditionnement plaque est une valeur valide');

  const makeOcrResult = (rows, codeCount, suspiciousRowCount = 0) => ({
    rows,
    headerFound: true,
    pagesDebug: [],
    codeCount,
    incompleteCodeCount: 0,
    suspiciousRowCount,
    needsReview: suspiciousRowCount > 0,
  });
  const structuredOcrResult = makeOcrResult([
    { sourceCode: 'A100', article: 'Produit incomplet', storageUnit: 'au Kg', packagingUnit: 'carton x 6' },
    { sourceCode: 'B200', article: 'Deuxième produit complet', storageUnit: 'pièce', packagingUnit: 'boîte x 10' },
  ], 2);
  const automaticOcrResult = makeOcrResult([
    { sourceCode: 'A100', article: 'Produit automatique MARQUE COMPLETE', storageUnit: 'au Kg', packagingUnit: 'carton x 6' },
    { article: '45468', storageUnit: 'au Kg', packagingUnit: '' },
  ], 1, 1);
  const dualOcrResult = mergeOcrExtractions(automaticOcrResult, structuredOcrResult);
  assert.equal(dualOcrResult.rows.length, 2, 'Les fragments OCR sans code ne doivent pas créer de produits');
  assert.equal(
    dualOcrResult.rows[0].article,
    'Produit automatique MARQUE COMPLETE',
    'Le libellé le plus complet doit compléter la segmentation la plus structurée',
  );
  assert.deepEqual(
    dualOcrResult.rows.map((row) => row.sourceCode),
    ['A100', 'B200'],
    'Les lignes doivent rester alignées par code article',
  );

  // 1. Un libellé natif corrompu est remplacé par l'OCR sain.
  const garbledNative = mergeTemplateExtractions(
    makeOcrResult([{ sourceCode: 'Z1', article: 'Cr? me ??', storageUnit: 'au Kg', packagingUnit: 'carton x 6' }], 1, 1),
    makeOcrResult([{ sourceCode: 'Z1', article: 'Crème fraîche entière 5 L', storageUnit: 'au Kg', packagingUnit: 'carton x 6' }], 1),
  );
  assert.equal(garbledNative.rows[0].article, 'Crème fraîche entière 5 L', 'Un libellé natif suspect doit céder la place à un OCR sain');

  // 2. Une ligne secondaire sans code correspondant ne duplique pas un article déjà retenu.
  const duplicateNative = mergeTemplateExtractions(
    makeOcrResult([{ sourceCode: 'A1', article: 'Beurre doux 250 g', storageUnit: 'au Kg', packagingUnit: 'carton x 6' }], 1),
    makeOcrResult([{ sourceCode: 'A1-OCR', article: 'BEURRE doux 250 g', storageUnit: 'au Kg', packagingUnit: 'carton x 6' }], 1),
  );
  assert.equal(duplicateNative.rows.length, 1, 'Un article quasi identique ne doit pas être dupliqué (natif + OCR)');
  const duplicateOcr = mergeOcrExtractions(
    makeOcrResult([{ sourceCode: 'A1', article: 'Beurre doux 250 g', storageUnit: 'au Kg', packagingUnit: 'carton x 6' }], 1),
    makeOcrResult([{ sourceCode: 'A1X', article: 'Beurre  doux 250g', storageUnit: 'au Kg', packagingUnit: 'carton x 6' }], 1),
  );
  assert.equal(duplicateOcr.rows.length, 2, 'Une normalisation différente reste distincte (égalité stricte)');
  const duplicateOcrSame = mergeOcrExtractions(
    makeOcrResult([{ sourceCode: 'A1', article: 'Beurre doux 250 g', storageUnit: 'au Kg', packagingUnit: 'carton x 6' }], 1),
    makeOcrResult([{ sourceCode: 'A1X', article: 'Beurre doux 250 g', storageUnit: 'au Kg', packagingUnit: 'carton x 6' }], 1),
  );
  assert.equal(duplicateOcrSame.rows.length, 1, 'Un article identique ne doit pas être dupliqué (OCR + OCR)');

  // 3. Les fragments sans libellé sont écartés et tracés.
  const separated = separateUnreadableRows(makeOcrResult([
    { sourceCode: 'OK1', article: 'Produit lisible', storageUnit: 'au Kg', packagingUnit: 'carton x 6' },
    { sourceCode: 'KO1', article: '45468 ??', storageUnit: 'au Kg', packagingUnit: 'carton x 6' },
  ], 2, 1));
  assert.deepEqual(separated.rows.map((row) => row.sourceCode), ['OK1']);
  assert.deepEqual(separated.droppedRows.map((row) => row.sourceCode), ['KO1']);

  // 4. Un fragment douteux sans correspondance n'est jamais promu en ligne.
  const fragmentOnly = mergeOcrExtractions(
    makeOcrResult([{ sourceCode: 'A1', article: 'Beurre doux 250 g', storageUnit: 'au Kg', packagingUnit: 'carton x 6' }], 1),
    makeOcrResult([{ sourceCode: 'F9', article: 'CNE AE 10500410', storageUnit: 'aa', packagingUnit: 'sem' }], 1),
  );
  assert.deepEqual(fragmentOnly.rows.map((row) => row.sourceCode), ['A1'], 'Un fragment douteux ne doit pas devenir une ligne');

  // 5. Une ligne retrouvée par la lecture secondaire garde sa place dans le document
  // et le total détecté inclut l'union des deux lectures.
  const mk = (code, article) => ({ sourceCode: code, article, storageUnit: 'au Kg', packagingUnit: 'carton x 6' });
  const ordered = mergeTemplateExtractions(
    makeOcrResult([mk('T1', 'Tabasco rouge 60 ml'), mk('P3', 'Pomme deshydrate barquette')], 2),
    makeOcrResult([mk('T1', 'Tabasco rouge 60 ml'), mk('A2', 'Ananas deshydrate barquette'), mk('C2', 'Citron vert deshydrate'), mk('P3', 'Pomme deshydrate barquette')], 4),
  );
  assert.deepEqual(ordered.rows.map((row) => row.sourceCode), ['T1', 'A2', 'C2', 'P3'], 'L’ordre du PDF doit être conservé');
  assert.equal(ordered.codeCount, 4);
  assert.equal(ordered.incompleteCodeCount, 0);

  // 6. Codes à préfixe : seul l'alignement dans la colonne Code compte.
  const prefixedResult = extractRowsFromDocumentWords([[
    ...header,
    ...articleLine({ yTop: 100, code: '123872', article: 'Orange à jus filet 2 Kg', packagingUnit: 'filet' }),
    ...articleLine({ yTop: 160, code: 'COJ-123217', article: 'Fruits de la passion colis 2 Kg', packagingUnit: 'colis' }),
    ...articleLine({ yTop: 220, code: '153806', article: 'Cébette botte 300 G', packagingUnit: 'botte' }),
  ]]);
  assert.deepEqual(
    prefixedResult.rows.map((row) => row.sourceCode),
    ['123872', 'COJ-123217', '153806'],
    'Un code à préfixe de lettres doit ancrer sa ligne',
  );
  assert.equal(prefixedResult.suspiciousRowCount, 0, 'Un conditionnement inédit n’est pas une erreur de lecture');
  assert.equal(prefixedResult.rows[2].packagingUnit, 'botte', 'Aucune liste d’unités ne doit réécrire « botte »');

  // 7. Réconciliation par confiance OCR : seule une lecture peu fiable est corrigée,
  // et seulement vers une valeur lue de façon fiable dans le même document.
  const confidenceLine = ({
    yTop, code, article, storage = 'au Kg', packaging = '', articleConfidence = 96, storageConfidence = 96, packagingConfidence = 96,
  }) => [
    ...wordsAt(code, 20, yTop).map((word) => ({ ...word, confidence: 96 })),
    ...wordsAt(article, 100, yTop).map((word) => ({ ...word, confidence: articleConfidence })),
    ...wordsAt(storage, 310, yTop).map((word) => ({ ...word, confidence: storageConfidence })),
    ...wordsAt(packaging, 470, yTop).map((word) => ({ ...word, confidence: packagingConfidence })),
  ];
  const reconciled = extractRowsFromDocumentWords([[
    ...header,
    ...confidenceLine({ yTop: 100, code: '100001', article: 'Banane moyenne colis', packaging: 'colis' }),
    ...confidenceLine({ yTop: 160, code: '100002', article: 'Citron jaune colis', packaging: 'colis' }),
    ...confidenceLine({ yTop: 220, code: '100003', article: 'Citron vert colis', packaging: 'colis' }),
    ...confidenceLine({ yTop: 280, code: '100004', article: 'Tomate grosse colis', storage: 'Ke', storageConfidence: 50, packaging: 'colis' }),
    ...confidenceLine({ yTop: 340, code: '100005', article: 'Assaisonnement agrumes', packaging: 'bouteille' }),
    ...confidenceLine({ yTop: 400, code: '100006', article: 'Assaisonnement fumé', packaging: 'bouteille' }),
    ...confidenceLine({ yTop: 460, code: '100007', article: 'Assaisonnement citron', packaging: 'boutellle', packagingConfidence: 82 }),
    ...confidenceLine({ yTop: 520, code: '100008', article: 'Camembert fermier pièce', packaging: 'pièce' }),
    ...confidenceLine({ yTop: 580, code: '100009', article: 'Reblochon fermier pièce', packaging: 'pièce' }),
    ...confidenceLine({ yTop: 640, code: '100010', article: 'Grana Padano pièce', packaging: 'Là pièce', packagingConfidence: 40 }),
  ]]);
  const byCode = Object.fromEntries(reconciled.rows.map((row) => [row.sourceCode, row]));
  assert.equal(byCode['100004'].storageUnit, 'au Kg', '« Ke » lu à faible confiance est ramené à « au Kg » lu ailleurs');
  assert.equal(byCode['100007'].packagingUnit, 'bouteille', 'Une faute de lecture est ramenée à la valeur fiable du document');
  assert.equal(byCode['100010'].packagingUnit, 'pièce', 'Un mot parasite autour d’une valeur de référence est retiré');
  assert.equal(reconciled.suspiciousRowCount, 0, 'Les lectures corrigées ne doivent plus être signalées');

  const reliableRare = extractRowsFromDocumentWords([[
    ...header,
    ...confidenceLine({ yTop: 100, code: '200001', article: 'Ciboulette entière', packaging: 'boîte' }),
    ...confidenceLine({ yTop: 160, code: '200002', article: 'Persil plat entier', packaging: 'boîte' }),
    ...confidenceLine({ yTop: 220, code: '200003', article: 'Thym sec entier', packaging: 'boîte' }),
    ...confidenceLine({ yTop: 280, code: '200004', article: 'Cébette botte entière', packaging: 'botte' }),
  ]]);
  assert.equal(
    reliableRare.rows.find((row) => row.sourceCode === '200004').packagingUnit,
    'botte',
    'Une lecture fiable n’est jamais modifiée, même proche d’une valeur plus fréquente',
  );

  // 8. Une ligne OCR illisible n'est pas reprise dans le libellé et le signale.
  const unreadableLine = extractRowsFromDocumentWords([[
    ...header,
    ...confidenceLine({ yTop: 100, code: '300001', article: 'Jus de veau lié', packaging: 'boîte' }),
    ...wordsAt('sosie de pou pren', 100, 125).map((word) => ({ ...word, confidence: 5 })),
    ...confidenceLine({ yTop: 160, code: '300002', article: 'Fond de volaille', packaging: 'boîte' }),
  ]]);
  const unreadableRow = unreadableLine.rows.find((row) => row.sourceCode === '300001');
  assert.doesNotMatch(unreadableRow.article, /sosie/, 'Le texte illisible ne doit pas polluer le libellé');
  assert.equal(unreadableLine.suspiciousRowCount, 1, 'La ligne dont le libellé est incomplet doit être signalée');
  assert.equal(
    separateUnreadableRows(unreadableLine).rows.length,
    2,
    'Une ligne signalée reste dans le tableau pour être contrôlée',
  );

  console.log('Parser trame commande OK : codes, bandes multilignes, fusion OCR, unités et qualité protégés.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
