import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const resultsModelPath = join(root, 'src', 'utils', 'takeRateResultsModel.ts');
const marginRowsModelPath = join(root, 'src', 'utils', 'takeRateMarginRowsModel.ts');
const pagePath = join(root, 'src', 'pages', 'TakeRatePage.tsx');
const tempDir = mkdtempSync(join(root, '.take-rate-margin-rows-'));

const transpile = (sourcePath, outputName) => {
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
    diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')).join('\n'),
  );
  writeFileSync(join(tempDir, outputName), outputText, 'utf8');
};

try {
  transpile(resultsModelPath, 'takeRateResultsModel.mjs');
  transpile(marginRowsModelPath, 'takeRateMarginRowsModel.raw.mjs');
  const modelOutput = readFileSync(join(tempDir, 'takeRateMarginRowsModel.raw.mjs'), 'utf8')
    .replace("'./takeRateResultsModel'", "'./takeRateResultsModel.mjs'");
  const compiledModelPath = join(tempDir, 'takeRateMarginRowsModel.mjs');
  writeFileSync(compiledModelPath, modelOutput, 'utf8');
  const model = await import(pathToFileURL(compiledModelPath).href);

  const existingRows = [
    {
      id: 'keep-10',
      label: 'Mix fromager (10 pièces)',
      family: 'Ancienne famille',
      linkedImports: ['Vente 10 pièces'],
      costHt: '1,00',
      sellPriceHt: '2,00',
      marginPercent: '50,0',
      marginEuro: '1,00',
      marginSource: 'manual',
      matchedMarginLabel: 'Mix fromager (10 pièces)',
      matchedMarginSheet: 'Ancien onglet',
    },
    {
      id: 'keep-20',
      label: 'Mix fromager (20 pièces)',
      family: 'Ancienne famille',
      linkedImports: ['Vente 20 pièces'],
      matchedMarginLabel: 'Mix fromager (20 pièces)',
    },
    {
      id: 'removed',
      label: 'Ancien produit supprimé',
      family: 'Ancien',
      linkedImports: ['Ancienne vente'],
    },
  ];
  const originalRows = structuredClone(existingRows);
  const catalog = [
    {
      label: 'Mix fromager (20 pièces)',
      normalized: '42-mix fromager',
      costHt: 4.2,
      sellPriceHt: 17.8,
      marginPercent: 0.5,
      marginEuro: 13.6,
      sourceSheet: 'Produits 2026',
      section: 'Fromager',
    },
    {
      label: 'Mix fromager (10 pièces)',
      normalized: '18-mix fromager',
      costHt: 2.1,
      sellPriceHt: 8.9,
      marginPercent: 76.4,
      marginEuro: 6.8,
      sourceSheet: 'Produits 2026',
      section: 'Fromager',
    },
    {
      label: 'Nouveau produit',
      normalized: 'nouveau produit',
      costHt: null,
      sellPriceHt: 10,
      marginPercent: null,
      marginEuro: null,
      sourceSheet: 'Produits 2026',
      section: 'Nouveautés',
    },
  ];

  const rows = model.buildTakeRateRowsFromMarginCatalog(catalog, existingRows);
  assert.equal(rows.length, 3, 'Un produit retiré du nouveau catalogue ne doit pas être recréé');
  assert.equal(rows[0].id, 'keep-20');
  assert.deepEqual(rows[0].linkedImports, ['Vente 20 pièces'],
    'La variante 20 pièces doit conserver uniquement sa propre liaison');
  assert.equal(rows[1].id, 'keep-10');
  assert.deepEqual(rows[1].linkedImports, ['Vente 10 pièces'],
    'La variante 10 pièces doit conserver uniquement sa propre liaison');
  assert.equal(rows[1].family, 'Fromager', 'La famille doit venir du nouveau catalogue');
  assert.equal(rows[1].costHt, '2,10', 'Les nouvelles valeurs marge doivent remplacer les anciennes');
  assert.equal(rows[1].marginPercent, '76,4');
  assert.equal(rows[1].matchedMarginSheet, 'Produits 2026');
  assert.equal(rows[1].marginSource, 'auto');
  assert.deepEqual(rows[2].linkedImports, [], 'Un nouveau produit doit démarrer sans liaison inventée');
  assert.match(rows[2].id, /^margin-3-nouveau produit$/);
  assert.deepEqual(existingRows, originalRows, 'La fusion ne doit pas modifier les lignes existantes en place');
  assert.notEqual(catalog[0].normalized, 'mix fromager 20 pieces',
    'Le test doit couvrir le champ historique préfixé par le numéro de ligne Excel');

  const pageSource = readFileSync(pagePath, 'utf8');
  assert.match(pageSource, /buildTakeRateRowsFromMarginCatalog\(catalog, baseRowsRef\.current\)/,
    'Le réimport doit transmettre les liaisons existantes au modèle');
  assert.doesNotMatch(pageSource, /generateRowsFromMarginCatalog\(catalog, \[\]\)/,
    'Le réimport ne doit plus reconstruire volontairement une base vide');
  assert.doesNotMatch(pageSource, /generatedBase[^\n]*linkedImports: \[\]/,
    'Les liaisons conservées ne doivent pas être effacées après la fusion');

  console.log('Réimport marge OK : liaisons, variantes et identifiants conservés, nouvelles valeurs appliquées.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
