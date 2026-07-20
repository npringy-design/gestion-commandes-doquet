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
    scoreTemplateExtraction,
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

  console.log('Parser trame commande OK : codes, bandes multilignes, pages, echelle OCR et qualite proteges.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
