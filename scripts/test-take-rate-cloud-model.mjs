import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const modelPath = join(root, 'src', 'utils', 'takeRateCloudModel.ts');
const pagePath = join(root, 'src', 'pages', 'TakeRatePage.tsx');
const resultsPath = join(root, 'src', 'pages', 'TakeRateResultsPage.tsx');
const source = readFileSync(modelPath, 'utf8');
const pageSource = readFileSync(pagePath, 'utf8');
const resultsSource = readFileSync(resultsPath, 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-take-rate-cloud-'));

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

  const compiledPath = join(tempDir, 'takeRateCloudModel.mjs');
  writeFileSync(compiledPath, outputText, 'utf8');
  const model = await import(pathToFileURL(compiledPath).href);

  const marginRow = {
    id: 'p1',
    label: 'Burger',
    family: 'Burgers',
    linkedImports: ['Burger vente'],
    marginSource: 'auto',
  };
  const decorativeRow = {
    id: 'empty', label: 'Sans marge', family: '', linkedImports: [],
  };
  const cloud = [
    { key: model.TAKE_RATE_BASE_ROWS_CLOUD_KEY, value: [marginRow, decorativeRow], updated_at: '2026-07-17T10:00:00Z' },
    { key: model.TAKE_RATE_MARGIN_CATALOG_CLOUD_KEY, value: [{ label: 'Burger' }], updated_at: '2026-07-17T10:01:00Z' },
    { key: model.TAKE_RATE_MARGIN_FILE_NAME_CLOUD_KEY, value: 'marge.xlsx', updated_at: '2026-07-17T10:02:00Z' },
    { key: model.TAKE_RATE_FROZEN_CLOUD_KEY, value: { jan: { rows: [marginRow] } }, updated_at: '2026-07-17T10:03:00Z' },
    { key: 'unrelatedKey', value: ['ignore'] },
  ];
  const hydrated = model.hydrateTakeRateCloudRows(cloud);
  assert.deepEqual(hydrated.baseRows, [marginRow], 'Une ligne sans donnée marge ne doit pas entrer dans la base');
  assert.deepEqual(hydrated.marginCatalog, [{ label: 'Burger' }]);
  assert.equal(hydrated.marginFileName, 'marge.xlsx');
  assert.deepEqual(Object.keys(hydrated.frozenMonths), ['jan']);
  assert.deepEqual(hydrated.updatedAtByKey, {
    [model.TAKE_RATE_BASE_ROWS_CLOUD_KEY]: '2026-07-17T10:00:00Z',
    [model.TAKE_RATE_MARGIN_CATALOG_CLOUD_KEY]: '2026-07-17T10:01:00Z',
    [model.TAKE_RATE_MARGIN_FILE_NAME_CLOUD_KEY]: '2026-07-17T10:02:00Z',
    [model.TAKE_RATE_FROZEN_CLOUD_KEY]: '2026-07-17T10:03:00Z',
  });
  assert.deepEqual(Object.keys(hydrated.acceptedKeys).sort(), [
    model.TAKE_RATE_BASE_ROWS_CLOUD_KEY,
    model.TAKE_RATE_FROZEN_CLOUD_KEY,
    model.TAKE_RATE_MARGIN_CATALOG_CLOUD_KEY,
    model.TAKE_RATE_MARGIN_FILE_NAME_CLOUD_KEY,
  ].sort());

  const partial = model.hydrateTakeRateCloudRows([
    { key: model.TAKE_RATE_FROZEN_CLOUD_KEY, value: { feb: { rows: [] } } },
  ]);
  assert.deepEqual(partial.baseRows, []);
  assert.deepEqual(partial.marginCatalog, []);
  assert.equal(partial.marginFileName, '');
  assert.deepEqual(Object.keys(partial.frozenMonths), ['feb']);
  assert.deepEqual(partial.acceptedKeys, { [model.TAKE_RATE_FROZEN_CLOUD_KEY]: true },
    'Les clés absentes doivent rester distinguables pour conserver les valeurs locales');

  const malformed = model.hydrateTakeRateCloudRows([
    { key: model.TAKE_RATE_BASE_ROWS_CLOUD_KEY, value: 'pas un tableau', updated_at: 'bad' },
    { key: model.TAKE_RATE_MARGIN_CATALOG_CLOUD_KEY, value: null },
    { key: model.TAKE_RATE_MARGIN_FILE_NAME_CLOUD_KEY, value: 42 },
    { key: model.TAKE_RATE_FROZEN_CLOUD_KEY, value: [] },
  ]);
  assert.deepEqual(malformed, {
    baseRows: [], marginCatalog: [], marginFileName: '', frozenMonths: {}, updatedAtByKey: {}, acceptedKeys: {},
  }, 'Une valeur mal formée doit être ignorée sans timestamp accepté');
  assert.deepEqual(model.hydrateTakeRateCloudRows(null), malformed);
  assert.equal(model.isTakeRateMarginBaseRow({ costHt: '2,00' }), true);
  assert.equal(model.isTakeRateMarginBaseRow({ label: 'seul' }), false);

  assert.match(pageSource, /hydrateTakeRateCloudRows\(cloud\)/,
    'La page de paramétrage doit utiliser le modèle cloud commun');
  assert.match(resultsSource, /hydrateTakeRateCloudRows\(cloud\)/,
    'La page résultat doit utiliser le même modèle cloud');
  assert.match(pageSource, /acceptedKeys\[TAKE_RATE_BASE_ROWS_CLOUD_KEY\]/,
    'Une réponse partielle doit conserver la valeur locale des clés absentes');
  assert.doesNotMatch(`${pageSource}\n${resultsSource}`, /entry\?\.key === TAKE_RATE_|row\?\.key === TAKE_RATE_/,
    'Les clés cloud ne doivent plus être interprétées séparément dans les pages');

  console.log('Hydratation taux de prise OK : clés, valeurs partielles, formats invalides et timestamps protégés.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
