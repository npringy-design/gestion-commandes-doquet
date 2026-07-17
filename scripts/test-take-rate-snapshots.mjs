import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const modelPath = join(root, 'src', 'utils', 'takeRateSnapshot.ts');
const pagePath = join(root, 'src', 'pages', 'TakeRatePage.tsx');
const resultsPath = join(root, 'src', 'pages', 'TakeRateResultsPage.tsx');
const source = readFileSync(modelPath, 'utf8');
const pageSource = readFileSync(pagePath, 'utf8');
const resultsSource = readFileSync(resultsPath, 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-take-rate-snapshot-'));

try {
  const { outputText, diagnostics = [] } = ts.transpileModule(source, {
    fileName: modelPath,
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

  const compiledPath = join(tempDir, 'takeRateSnapshot.mjs');
  writeFileSync(compiledPath, outputText, 'utf8');
  const {
    createTakeRateMonthSnapshot,
    removeFrozenTakeRateMonth,
    resolveTakeRateMonthCovers,
    setFrozenTakeRateMonth,
  } = await import(pathToFileURL(compiledPath).href);

  assert.equal(resolveTakeRateMonthCovers(4200, 4600), 4200,
    'Un mois figé doit conserver ses propres couverts');
  assert.equal(resolveTakeRateMonthCovers(0, 4600), 0,
    'Une valeur figée à zéro reste une valeur valide');
  assert.equal(resolveTakeRateMonthCovers(undefined, 4600), 4600,
    'Un ancien snapshot sans couverts doit rester compatible');
  assert.equal(resolveTakeRateMonthCovers('4 600', 0), 4600,
    'Une ancienne valeur numérique sérialisée doit être acceptée');
  assert.equal(resolveTakeRateMonthCovers('invalide', undefined), 0,
    'Une valeur invalide ne doit jamais produire NaN');

  const sourceRows = [{ id: 'p1', label: 'Burger', linkedImports: ['Burger vente'] }];
  const sourceCatalog = [{ label: 'Burger', costHt: 2 }];
  const sourceSales = { burger: 12 };
  const snapshot = createTakeRateMonthSnapshot({
    rows: sourceRows,
    marginCatalog: sourceCatalog,
    marginFileName: 'marge.xlsx',
    salesByImport: sourceSales,
    covers: '1 200',
    frozenAt: '2026-07-17T10:00:00.000Z',
  });

  sourceRows[0].label = 'Burger modifié';
  sourceRows[0].linkedImports.push('Autre vente');
  sourceCatalog[0].costHt = 99;
  sourceSales.burger = 99;
  assert.equal(snapshot.rows[0].label, 'Burger');
  assert.deepEqual(snapshot.rows[0].linkedImports, ['Burger vente']);
  assert.equal(snapshot.marginCatalog[0].costHt, 2);
  assert.equal(snapshot.salesByImport.burger, 12);
  assert.equal(snapshot.covers, 1200);
  assert.equal(snapshot.frozenAt, '2026-07-17T10:00:00.000Z');

  const initialFrozen = { jan: snapshot };
  const withFebruary = setFrozenTakeRateMonth(initialFrozen, 'feb', { ...snapshot, frozenAt: 'feb' });
  assert.deepEqual(Object.keys(initialFrozen), ['jan'], 'Figer un mois ne doit pas modifier la collection existante');
  assert.deepEqual(Object.keys(withFebruary).sort(), ['feb', 'jan']);
  const withoutJanuary = removeFrozenTakeRateMonth(withFebruary, 'jan');
  assert.deepEqual(Object.keys(withFebruary).sort(), ['feb', 'jan'], 'Défiger ne doit pas modifier la collection existante');
  assert.deepEqual(Object.keys(withoutJanuary), ['feb']);

  assert.match(pageSource, /createTakeRateMonthSnapshot\(\{[\s\S]*?covers: covers\[selectedMonth\]/,
    'Le bouton principal doit créer un snapshot complet du mois sélectionné');
  assert.match(pageSource, /createTakeRateMonthSnapshot\(\{[\s\S]*?covers: covers\[month\.key\]/,
    'Chaque bouton mensuel doit créer le même snapshot complet');
  assert.match(pageSource, /removeFrozenTakeRateMonth/,
    'Le défigeage doit utiliser le modèle testé');
  assert.match(pageSource, /frozenMonths\[selectedMonth\]\?\.covers,[\s\S]*?covers\[selectedMonth\]/,
    'La page de paramétrage doit relire les couverts figés en priorité');
  assert.match(resultsSource, /frozenMonths\[selectedMonth\]\?\.covers,[\s\S]*?covers\[selectedMonth\]/,
    'La page résultat doit relire les couverts figés en priorité');

  console.log('Snapshots taux de prise OK : couverts, copies isolées, gel, défigeage et anciens mois protégés.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
