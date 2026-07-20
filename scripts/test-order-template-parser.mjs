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
  const { extractRowsFromPageWords } = await import(pathToFileURL(compiledPath).href);

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
    ...articleLine({ yTop: 260, code: '200269', article: 'Cote de boeuf VBF décongelé pièce 400', packagingUnit: 'pièce' }),
    ...articleLine({ yTop: 278, article: 'g PUIGRENIER' }),
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

  console.log('Parser trame commande OK : articles multilignes regroupes, grammages preserves et unites dedupliquees.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
