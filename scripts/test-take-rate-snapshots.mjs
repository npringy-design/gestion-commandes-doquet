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
  const { resolveTakeRateMonthCovers } = await import(pathToFileURL(compiledPath).href);

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

  assert.match(pageSource, /covers: resolveTakeRateMonthCovers\(undefined, covers\[selectedMonth\]\)/,
    'Le bouton principal doit figer les couverts du mois sélectionné');
  assert.match(pageSource, /covers: resolveTakeRateMonthCovers\(undefined, covers\[month\.key\]\)/,
    'Chaque bouton mensuel doit figer les couverts de son propre mois');
  assert.match(pageSource, /frozenMonths\[selectedMonth\]\?\.covers,[\s\S]*?covers\[selectedMonth\]/,
    'La page de paramétrage doit relire les couverts figés en priorité');
  assert.match(resultsSource, /frozenMonths\[selectedMonth\]\?\.covers,[\s\S]*?covers\[selectedMonth\]/,
    'La page résultat doit relire les couverts figés en priorité');

  console.log('Snapshots taux de prise OK : couverts figés et anciens mois compatibles.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
