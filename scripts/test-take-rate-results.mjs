import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const modelPath = join(root, 'src', 'utils', 'takeRateResultsModel.ts');
const pagePath = join(root, 'src', 'pages', 'TakeRatePage.tsx');
const resultsPath = join(root, 'src', 'pages', 'TakeRateResultsPage.tsx');
const source = readFileSync(modelPath, 'utf8');
const pageSource = readFileSync(pagePath, 'utf8');
const resultsSource = readFileSync(resultsPath, 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-take-rate-results-'));

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
  assert.equal(diagnostics.length, 0,
    diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')).join('\n'));

  const compiledPath = join(tempDir, 'takeRateResultsModel.mjs');
  writeFileSync(compiledPath, outputText, 'utf8');
  const model = await import(pathToFileURL(compiledPath).href);

  const tenPieces = "Mix' des copains fromager (10 pièces)";
  const twentyPieces = "Mix' des copains fromager (20 pièces)";
  assert.notEqual(model.normalizeTakeRateKey(tenPieces), model.normalizeTakeRateKey(twentyPieces),
    'Les variantes 10 et 20 pièces doivent garder des clés distinctes');

  const rows = [
    {
      id: '10', label: tenPieces, family: 'Fromager', linkedImports: [tenPieces],
      costHt: '2,10', sellPriceHt: '8,90', marginEuro: '6,80', marginPercent: '76,4',
    },
    {
      id: '20', label: twentyPieces, family: 'Fromager', linkedImports: [twentyPieces],
      costHt: '4,20', sellPriceHt: '17,80', marginEuro: '', marginPercent: '50',
    },
  ];
  const salesByImport = new Map([
    [model.normalizeTakeRateKey(tenPieces), 12],
    [model.normalizeTakeRateKey(twentyPieces), 5],
  ]);
  const computed = model.buildTakeRateResultRows({
    rows, salesByImport, monthCovers: 100, familyFilter: 'all', search: '', sortBy: 'takeRate',
  });

  assert.equal(computed[0].id, '10');
  assert.equal(computed[0].sales, 12, 'Les ventes 10 pièces ne doivent pas inclure les 20 pièces');
  assert.equal(computed[1].sales, 5, 'Les ventes 20 pièces doivent rester séparées');
  assert.equal(computed[0].takeRate, 12);
  assert.equal(computed[0].marginTotal, 81.6);
  assert.ok(Math.abs(computed[0].caTheo - 106.8) < 1e-9);
  assert.equal(computed[1].marginEuro, 8.9, 'La marge doit être calculée depuis le pourcentage si le montant manque');
  assert.deepEqual(computed.map(row => row.rank), [1, 2]);

  const sortedByMargin = model.buildTakeRateResultRows({
    rows, salesByImport, monthCovers: 100, familyFilter: 'all', search: '', sortBy: 'marginTotal',
  });
  assert.equal(sortedByMargin[0].id, '10');
  assert.equal(model.getMaxTakeRate(sortedByMargin), 12,
    'La barre maximale doit rester correcte quel que soit le tri actif');
  assert.equal(model.buildTakeRateResultRows({
    rows, salesByImport, monthCovers: 0, familyFilter: 'all', search: '20 pieces', sortBy: 'takeRate',
  })[0].takeRate, 0, 'Zéro couvert ne doit jamais produire Infinity');

  assert.match(pageSource, /normalizeTakeRateKey as normalize/,
    'La page de liaison doit utiliser la clé commune qui conserve les variantes');
  assert.match(resultsSource, /buildTakeRateResultRows\(\{/,
    'La page résultat doit déléguer ses calculs au modèle testé');
  assert.doesNotMatch(resultsSource, /const takeRate = monthCovers/,
    'Le calcul du taux ne doit plus être dupliqué dans le composant');

  console.log('Résultats taux de prise OK : variantes, ventes, taux, marge, CA et classement protégés.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
