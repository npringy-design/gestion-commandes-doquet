import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const modelPath = join(process.cwd(), 'src', 'hooks', 'appStateSyncModel.ts');
const cloudSyncPath = join(process.cwd(), 'src', 'hooks', 'useCloudSync.ts');
const hydrationHookPath = join(process.cwd(), 'src', 'hooks', 'useAppStateHydration.ts');
const rawModelSource = readFileSync(modelPath, 'utf8');
const cloudSyncSource = readFileSync(cloudSyncPath, 'utf8');
const hydrationHookSource = readFileSync(hydrationHookPath, 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-app-state-sync-'));

try {
  const testableSource = rawModelSource.replace(
    /import \{[\s\S]*?\} from '\.\/appStateHelpers';\n/,
    `const mergeAndNormalizeProducts = value => ({ normalized: 'products', value });\nconst mergeSupplierConfigsWithDefaults = value => ({ normalized: 'supplierConfigs', value });\n`,
  );

  const { outputText, diagnostics = [] } = ts.transpileModule(testableSource, {
    fileName: modelPath,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
      isolatedModules: false,
    },
  });

  assert.equal(
    diagnostics.length,
    0,
    diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')).join('\n'),
  );

  const compiledPath = join(tempDir, 'appStateSyncModel.mjs');
  writeFileSync(compiledPath, outputText, 'utf8');
  const model = await import(pathToFileURL(compiledPath).href);

  const emptySnapshot = model.buildAppStateSnapshot([], {});
  assert.deepEqual(emptySnapshot.values, {}, 'Une réponse vide ne doit produire aucune valeur à appliquer');
  assert.deepEqual(emptySnapshot.updatedAtByKey, {}, 'Une réponse vide ne doit modifier aucun curseur cloud');

  const partialSnapshot = model.buildAppStateSnapshot([
    { key: 'covers', value: { monday: 120 }, updated_at: '2026-07-15T08:00:00.000Z' },
  ], {});
  assert.deepEqual(
    partialSnapshot.values,
    { covers: { monday: 120 } },
    'Une réponse partielle ne doit contenir que les clés réellement reçues',
  );

  const staleSnapshot = model.buildAppStateSnapshot([
    { key: 'products', value: [{ id: 'old' }], updated_at: '2026-07-15T08:00:00.000Z' },
  ], { products: '2026-07-15T08:01:00.000Z' });
  assert.deepEqual(
    staleSnapshot.values,
    {},
    'Une ligne cloud plus ancienne qu’une modification locale doit être ignorée',
  );

  const legacySnapshot = model.buildAppStateSnapshot([
    { key: 'orderStates', value: { product1: { margin: 1.1 } }, updated_at: '2026-07-15T08:02:00.000Z' },
  ], {});
  assert.deepEqual(
    legacySnapshot.values.orderStates,
    { product1: { margin: 1.1 } },
    'Le filet historique orderStates doit rester disponible pour la migration en mémoire',
  );

  const calls = [];
  const setters = {
    covers: value => calls.push(['covers', value]),
    dailyCovers: value => calls.push(['dailyCovers', value]),
    products: value => calls.push(['products', value]),
    supplierConfigs: value => calls.push(['supplierConfigs', value]),
  };

  const appliedPartial = model.applyAppStateValues({ covers: { monday: 80 } }, setters);
  assert.deepEqual(appliedPartial, ['covers']);
  assert.deepEqual(calls, [['covers', { monday: 80 }]], 'Les clés absentes ne doivent déclencher aucun setter');

  calls.length = 0;
  const skippedDailyCovers = model.applyAppStateValues({
    dailyCovers: { '2026-07': [{ midi: '', soir: '' }] },
  }, setters);
  assert.deepEqual(skippedDailyCovers, [], 'Un calendrier vide ne doit pas remplacer les données déjà présentes');
  assert.deepEqual(calls, []);

  const appliedDailyCovers = model.applyAppStateValues({
    dailyCovers: { '2026-07': [{ midi: 25, soir: '' }] },
  }, setters);
  assert.deepEqual(appliedDailyCovers, ['dailyCovers']);

  calls.length = 0;
  model.applyAppStateValues({
    products: [{ id: 'p1' }],
    supplierConfigs: { doquet: { cutoffTime: '10:00' } },
  }, setters);
  assert.equal(calls[0][1].normalized, 'supplierConfigs', 'Les paramètres fournisseurs doivent rester normalisés');
  assert.equal(calls[1][1].normalized, 'products', 'Les produits doivent rester normalisés');

  assert.equal(
    model.stableStringify({ b: 2, a: 1 }),
    model.stableStringify({ a: 1, b: 2 }),
    'La signature doit rester stable quel que soit l’ordre des propriétés',
  );

  assert.match(
    cloudSyncSource,
    /useAppStateHydration/,
    'useCloudSync doit déléguer le chargement app_state au hook dédié',
  );
  assert.match(
    cloudSyncSource,
    /const cloudValues = hydrateAppStateRows\(cloud\)/,
    'Le chargement initial doit utiliser le module centralisé',
  );
  assert.doesNotMatch(
    cloudSyncSource,
    /case 'covers'/,
    'La liste des clés app_state ne doit plus être dupliquée dans useCloudSync',
  );
  assert.doesNotMatch(
    cloudSyncSource,
    /if \(cloudMap\./,
    'Le chargement initial ne doit plus appliquer les clés une par une dans useCloudSync',
  );
  assert.match(
    hydrationHookSource,
    /buildAppStateSnapshot\(rows, localTsByKey\.current\)/,
    'Le hook dédié doit filtrer les lignes anciennes avant application',
  );
  assert.doesNotMatch(
    hydrationHookSource,
    /applyAppStateValues\(\{\},/,
    'Le hook dédié ne doit jamais appliquer volontairement un état global vide',
  );

  console.log('Synchronisation app_state OK : réponse vide/partielle protégée, LWW, normalisation et application centralisée.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
