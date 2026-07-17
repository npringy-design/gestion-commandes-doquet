import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const resultsModelPath = join(root, 'src', 'utils', 'takeRateResultsModel.ts');
const parserPath = join(root, 'src', 'utils', 'takeRateSalesParser.ts');
const pagePath = join(root, 'src', 'pages', 'TakeRatePage.tsx');
const resultsPagePath = join(root, 'src', 'pages', 'TakeRateResultsPage.tsx');
const tempDir = mkdtempSync(join(root, '.take-rate-sales-parser-'));

const transpile = (sourcePath, outputName) => {
  const { outputText, diagnostics = [] } = ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
    fileName: sourcePath,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
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
  transpile(parserPath, 'takeRateSalesParser.raw.mjs');
  const parserOutput = readFileSync(join(tempDir, 'takeRateSalesParser.raw.mjs'), 'utf8')
    .replace("'./takeRateResultsModel'", "'./takeRateResultsModel.mjs'");
  const compiledParserPath = join(tempDir, 'takeRateSalesParser.mjs');
  writeFileSync(compiledParserPath, parserOutput, 'utf8');

  const parser = await import(pathToFileURL(compiledParserPath).href);
  const semicolonCsv = [
    'Libellé;Nombre;Note',
    'Mix fromager (10 pièces);12;simple',
    'Mix fromager (20 pièces);5;simple',
    'Mix fromager (10 pièces);3;doublon',
    '"Burger; signature";"1 234,5";"avec; séparateur"',
  ].join('\n');
  const rows = parser.buildTakeRateImportRows(semicolonCsv);
  const sales = parser.buildTakeRateSalesObject(rows);

  assert.equal(sales['mix fromager 10 pieces'], 15, 'Les lignes identiques doivent être additionnées');
  assert.equal(sales['mix fromager 20 pieces'], 5, 'Les variantes doivent rester séparées');
  assert.equal(sales['burger signature'], 1234.5, 'Un séparateur entre guillemets ne doit pas couper le libellé');

  const tabSales = parser.buildTakeRateSalesMap('Désignation\tNb\nProduit A\t2\nProduit A\t4');
  assert.equal(tabSales.get('produit a'), 6, 'Les imports tabulés doivent rester compatibles');

  const commaRows = parser.buildTakeRateImportRows('Produit,Nombre\n"Produit, avec virgule",7');
  assert.equal(commaRows[0].label, 'Produit, avec virgule');
  assert.equal(commaRows[0].quantity, 7);

  const multilineRows = parser.buildTakeRateImportRows('Article;Nombre\n"Produit\nsur deux lignes";8');
  assert.equal(multilineRows[0].normalized, 'produit sur deux lignes');
  assert.equal(multilineRows[0].quantity, 8, 'Un champ CSV multiligne doit être lu comme une seule vente');

  assert.deepEqual(parser.buildTakeRateImportRows('Colonne;Valeur\nA;2'), [],
    'Un import sans colonnes produit et quantité ne doit produire aucune vente');
  assert.deepEqual(parser.buildTakeRateImportRows(''), []);

  const pageSource = readFileSync(pagePath, 'utf8');
  const resultsSource = readFileSync(resultsPagePath, 'utf8');
  assert.match(pageSource, /buildTakeRateImportRows/,
    'La page de paramétrage doit utiliser le parseur partagé');
  assert.match(resultsSource, /buildTakeRateSalesMap/,
    'La page résultat doit utiliser le même parseur partagé');
  assert.doesNotMatch(`${pageSource}\n${resultsSource}`, /const parseCsvLine|const detectDelimiter/,
    'Les parseurs CSV locaux ne doivent pas réapparaître dans les pages');

  console.log('Imports taux de prise OK : CSV, tabulations, guillemets, variantes et cumuls protégés.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
