import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const modelPath = join(root, 'src', 'utils', 'takeRateRowEditingModel.ts');
const pagePath = join(root, 'src', 'pages', 'TakeRatePage.tsx');
const source = readFileSync(modelPath, 'utf8');
const pageSource = readFileSync(pagePath, 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-take-rate-row-editing-'));

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

  const compiledPath = join(tempDir, 'takeRateRowEditingModel.mjs');
  writeFileSync(compiledPath, outputText, 'utf8');
  const model = await import(pathToFileURL(compiledPath).href);

  const empty = model.createEmptyTakeRateRow('new-1');
  assert.deepEqual(empty, {
    id: 'new-1', label: '', family: '', linkedImports: [], costHt: '', sellPriceHt: '',
    marginPercent: '', marginEuro: '', marginSource: '', matchedMarginLabel: '', matchedMarginSheet: '',
  });

  const burger = {
    id: 'p1', label: 'Burger', family: 'Burgers', linkedImports: ['Burger vente'],
    costHt: '2,00', sellPriceHt: '10,00', marginSource: 'auto',
  };
  const dessert = { id: 'p2', label: 'Dessert', family: 'Desserts', linkedImports: [] };
  const rows = [burger, dessert];

  const appended = model.appendTakeRateRow(rows, empty);
  assert.deepEqual(appended.map(row => row.id), ['p1', 'p2', 'new-1']);
  assert.equal(rows.length, 2, 'Ajouter une ligne ne doit pas modifier la collection existante');

  const renamed = model.updateTakeRateRow(rows, 'p1', { label: 'Burger Bacon' });
  assert.equal(renamed[0].label, 'Burger Bacon');
  assert.equal(renamed[0].marginSource, 'auto', 'Une édition de libellé ne doit pas devenir une marge manuelle');
  const manual = model.updateTakeRateRow(rows, 'p1', { costHt: '2,50' });
  assert.equal(manual[0].costHt, '2,50');
  assert.equal(manual[0].marginSource, 'manual', 'Une édition de marge doit être marquée manuelle');
  assert.equal(burger.costHt, '2,00', 'La ligne source doit rester intacte');

  const linked = model.addTakeRateImportLinks(rows, 'p2', ['Dessert vente', 'Dessert vente']);
  assert.deepEqual(linked[1].linkedImports, ['Dessert vente']);
  const linkedTwice = model.addTakeRateImportLinks(linked, 'p2', ['Dessert XL', 'Dessert vente']);
  assert.deepEqual(linkedTwice[1].linkedImports, ['Dessert vente', 'Dessert XL']);
  const unlinked = model.removeTakeRateImportLink(linkedTwice, 'p2', 'Dessert vente');
  assert.deepEqual(unlinked[1].linkedImports, ['Dessert XL']);

  assert.deepEqual(model.removeTakeRateRows(rows, ['p1']).map(row => row.id), ['p2']);
  assert.deepEqual(model.toggleTakeRateRowSelection([], 'p1'), ['p1']);
  assert.deepEqual(model.toggleTakeRateRowSelection(['p1'], 'p1'), []);
  assert.deepEqual(model.toggleAllVisibleTakeRateRows(['hors-filtre'], ['p1', 'p2']), ['hors-filtre', 'p1', 'p2']);
  assert.deepEqual(model.toggleAllVisibleTakeRateRows(['hors-filtre', 'p1', 'p2'], ['p1', 'p2']), ['hors-filtre']);

  const pending = model.togglePendingTakeRateImport({}, 'p1', 'Burger XL');
  assert.deepEqual(pending, { p1: ['Burger XL'] });
  assert.deepEqual(model.togglePendingTakeRateImport(pending, 'p1', 'Burger XL'), {});

  assert.match(pageSource, /updateTakeRateRow\(prev, rowId, patch\)/,
    'Les éditions doivent utiliser le modèle commun');
  assert.match(pageSource, /addTakeRateImportLinks\(prev, rowId, pending\)/,
    'La validation multiple doit utiliser la déduplication testée');
  assert.doesNotMatch(pageSource, /setRows\(\(prev\) => \{[\s\S]{0,200}setBaseRows/,
    'Les setters rows et baseRows ne doivent plus être imbriqués');

  console.log('Édition Taux de prise OK : ajout, suppression, marge manuelle, sélections et liaisons protégés.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
