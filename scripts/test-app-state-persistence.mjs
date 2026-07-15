import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const modelPath = join(process.cwd(), 'src', 'hooks', 'appStatePersistenceModel.ts');
const hookPath = join(process.cwd(), 'src', 'hooks', 'useAppStatePersistence.ts');
const cloudSyncPath = join(process.cwd(), 'src', 'hooks', 'useCloudSync.ts');
const rawModelSource = readFileSync(modelPath, 'utf8');
const hookSource = readFileSync(hookPath, 'utf8');
const cloudSyncSource = readFileSync(cloudSyncPath, 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-app-state-persistence-'));

try {
  const { outputText, diagnostics = [] } = ts.transpileModule(rawModelSource, {
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

  const compiledPath = join(tempDir, 'appStatePersistenceModel.mjs');
  writeFileSync(compiledPath, outputText, 'utf8');
  const model = await import(pathToFileURL(compiledPath).href);

  const baseDecision = {
    key: 'covers',
    signature: '{"monday":120}',
    lastPersistedSignature: undefined,
    initialCloudLoadSucceeded: true,
    isHydratingFromCloud: false,
    supabaseLoaded: true,
    supabaseConfigured: true,
  };

  assert.equal(
    model.getAppStatePersistenceDecision({
      ...baseDecision,
      lastPersistedSignature: baseDecision.signature,
    }),
    'skip',
    'Une valeur déjà persistée ne doit pas être renvoyée',
  );
  assert.equal(
    model.getAppStatePersistenceDecision({
      ...baseDecision,
      key: 'inventory',
      signature: '{}',
      initialCloudLoadSucceeded: false,
    }),
    'protect-empty',
    'Un inventaire vide avant le premier chargement cloud doit être protégé',
  );
  assert.equal(
    model.getAppStatePersistenceDecision({ ...baseDecision, isHydratingFromCloud: true }),
    'remember',
    'Une hydratation cloud doit seulement mémoriser la signature locale',
  );
  assert.equal(
    model.getAppStatePersistenceDecision({ ...baseDecision, supabaseLoaded: false }),
    'remember',
    'Aucune sauvegarde ne doit partir avant la fin du chargement Supabase',
  );
  assert.equal(
    model.getAppStatePersistenceDecision(baseDecision),
    'save',
    'Une modification prête doit être envoyée vers la sauvegarde fiable',
  );

  assert.equal(model.getAppStateSaveDebounceMs('products'), 0);
  assert.equal(model.getAppStateSaveDebounceMs('deliveryDateBySupplier'), 1200);
  assert.equal(model.getAppStateSaveDebounceMs('covers'), 2000);
  assert.equal(model.getAppStateSaveDebounceMs('prepImportsByMonth'), 5000);
  assert.equal(model.getAppStateSaveDebounceMs('inventory'), 8000);
  assert.equal(model.getAppStateSaveDebounceMs('unknown'), 1500);
  assert.equal(model.getAppStateSaveDebounceMs('inventory', 75), 75);

  assert.match(
    hookSource,
    /scheduleReliableAppStateSave\(/,
    'Le hook dédié doit conserver la file de sauvegarde fiable',
  );
  assert.match(
    hookSource,
    /lastCloudUpdatedAtByKey\.current\[currentKey\]/,
    'Le contrôle de conflit LWW doit rester branché sur le timestamp cloud',
  );
  for (const key of [
    'covers',
    'dailyCovers',
    'inventory',
    'salesHtByMonth',
    'costMatterByMonth',
    'validatedMonths',
    'prepValidatedMonths',
    'supplierConfigs',
    'deliveryDateBySupplier',
    'nextDeliveryDateBySupplier',
    'products',
    'prepItems',
    'prepImportsByMonth',
    'prepSheetStocks',
    'prepBatches',
    'prepForecasts',
    'orderTemplateRows',
  ]) {
    assert.match(hookSource, new RegExp(`persistAppState\\('${key}'`), `La clé ${key} doit rester sauvegardée`);
  }

  assert.match(
    cloudSyncSource,
    /useAppStatePersistence\(\{/,
    'useCloudSync doit déléguer la sauvegarde app_state au hook dédié',
  );
  assert.doesNotMatch(
    cloudSyncSource,
    /scheduleReliableAppStateSave/,
    'useCloudSync ne doit plus planifier directement les sauvegardes app_state',
  );
  assert.doesNotMatch(
    cloudSyncSource,
    /persistEverywhere/,
    'L’ancienne fonction de persistance ne doit pas rester dupliquée',
  );

  console.log('Persistance app_state OK : garde-fous, délais, LWW, clés et délégation centralisés.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
