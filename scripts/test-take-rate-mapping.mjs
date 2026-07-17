import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const resultsModelPath = join(root, 'src', 'utils', 'takeRateResultsModel.ts');
const mappingModelPath = join(root, 'src', 'utils', 'takeRateMappingModel.ts');
const pagePath = join(root, 'src', 'pages', 'TakeRatePage.tsx');
const tempDir = mkdtempSync(join(root, '.take-rate-mapping-'));

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
  transpile(mappingModelPath, 'takeRateMappingModel.raw.mjs');
  const mappingOutput = readFileSync(join(tempDir, 'takeRateMappingModel.raw.mjs'), 'utf8')
    .replace("'./takeRateResultsModel'", "'./takeRateResultsModel.mjs'");
  const compiledMappingPath = join(tempDir, 'takeRateMappingModel.mjs');
  writeFileSync(compiledMappingPath, mappingOutput, 'utf8');
  const model = await import(pathToFileURL(compiledMappingPath).href);

  assert.equal(model.scoreTakeRateImportMatch('Burger Bacon', 'Burger Bacon'), 1000,
    'Un libellé identique doit rester prioritaire');
  assert.ok(model.scoreTakeRateImportMatch('Menu Burger Bacon', 'Burger Bacon XL') >= 155,
    'Les mots génériques et un suffixe import ne doivent pas empêcher une correspondance sûre');
  assert.equal(model.scoreTakeRateImportMatch('Burger Bacon', 'Burger simple'), -1,
    'Un mot métier manquant doit interdire la correspondance');
  assert.equal(
    model.scoreTakeRateImportMatch('Mix fromager (10 pièces)', 'Mix fromager (20 pièces)'),
    -1,
    'Les variantes 10 et 20 pièces ne doivent jamais être reliées automatiquement',
  );
  assert.equal(model.scoreTakeRateImportMatch('', 'Burger Bacon'), -1);

  const rows = [
    { id: 'auto', label: 'Burger Bacon', family: 'Burgers', linkedImports: [] },
    { id: 'variant', label: 'Mix fromager (10 pièces)', family: 'Fromager', linkedImports: [] },
    { id: 'manual', label: 'Dessert maison', family: 'Desserts', linkedImports: ['Lien manuel'] },
  ];
  const linked = model.applyAutomaticTakeRateLinks(rows, [
    { label: 'Burger Bacon XL' },
    { label: 'Burger Bacon' },
    { label: 'Mix fromager (20 pièces)' },
    { label: 'Dessert maison du jour' },
  ]);

  assert.equal(linked.changed, true);
  assert.deepEqual(linked.rows[0].linkedImports, ['Burger Bacon'],
    'La meilleure correspondance doit être choisie, même si elle arrive après une correspondance partielle');
  assert.deepEqual(linked.rows[1].linkedImports, [],
    'Une variante différente doit rester à vérifier');
  assert.deepEqual(linked.rows[2].linkedImports, ['Lien manuel'],
    'Une liaison existante ne doit jamais être remplacée automatiquement');

  const salesByImport = {
    'burger bacon': 12,
    'lien manuel': 0,
  };
  assert.equal(model.getTakeRateLinkedSales(linked.rows[0], salesByImport), 12);
  assert.equal(model.getTakeRateMappingStatus(linked.rows[0], salesByImport), 'ok');
  assert.equal(model.getTakeRateMappingStatus(linked.rows[1], salesByImport), 'review');
  assert.equal(model.getTakeRateMappingStatus(linked.rows[2], salesByImport), 'review',
    'Une liaison sans vente doit rester signalée à vérifier');
  assert.equal(model.getTakeRateMappingStatus(
    { label: 'Sans famille', family: '', linkedImports: ['Burger Bacon'] },
    salesByImport,
  ), 'review');

  const pageSource = readFileSync(pagePath, 'utf8');
  assert.match(pageSource, /applyAutomaticTakeRateLinks(?:<TakeRateMappingRow>)?\(rows, importRows\)/,
    'La page doit déléguer la liaison automatique au modèle testé');
  assert.match(pageSource, /getTakeRateMappingStatus/,
    'Le statut de contrôle doit venir du même modèle');
  assert.doesNotMatch(pageSource, /const scoreImportMatch|const strongTokens/,
    'Le score ne doit pas être recopié dans le composant');

  console.log('Liaisons taux de prise OK : score, variantes, choix automatique, ventes et statuts protégés.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
