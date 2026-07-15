import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const modelPath = join(process.cwd(), 'src', 'hooks', 'orderLineSyncModel.ts');
const hookPath = join(process.cwd(), 'src', 'hooks', 'useOrderLineSync.ts');
const cloudSyncPath = join(process.cwd(), 'src', 'hooks', 'useCloudSync.ts');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-order-line-sync-'));

try {
  const modelSource = readFileSync(modelPath, 'utf8');
  const hookSource = readFileSync(hookPath, 'utf8');
  const cloudSyncSource = readFileSync(cloudSyncPath, 'utf8');

  const { outputText } = ts.transpileModule(modelSource, {
    fileName: modelPath,
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
      isolatedModules: false,
    },
  });

  const compiledPath = join(tempDir, 'orderLineSyncModel.mjs');
  writeFileSync(compiledPath, outputText, 'utf8');
  const model = await import(pathToFileURL(compiledPath).href);

  assert.deepEqual(model.toOrderLinePatch('stock', 8), { stock: 8 });
  assert.deepEqual(model.toOrderLinePatch('upcomingDelivery', 3), { upcoming_delivery: 3 });
  assert.deepEqual(model.toOrderLinePatch('targetStock', ''), { target_stock: null });
  assert.deepEqual(model.toOrderLinePatch('packaging', 12), { packaging: 12 });
  assert.deepEqual(model.toOrderLinePatch('margin', 30), { margin: 30 });

  const previous = {
    'product-a': { stock: 4, packaging: 6, updatedAt: '2026-07-15T08:00:00.000Z' },
    'product-b': { stock: 10, packaging: 12, updatedAt: '2026-07-15T08:00:00.000Z' },
  };

  const localTimestamps = {
    'product-a': '2026-07-15T08:10:00.000Z',
  };

  const staleMerge = model.mergeOrderLineRows(
    previous,
    [{
      product_id: 'product-a',
      stock: 1,
      upcoming_delivery: null,
      target_stock: null,
      packaging: 6,
      margin: 15,
      updated_at: '2026-07-15T08:05:00.000Z',
    }],
    localTimestamps,
  );

  assert.equal(
    staleMerge.next,
    previous,
    'Une ligne cloud plus ancienne que la saisie locale ne doit pas remplacer les données affichées',
  );
  assert.deepEqual(staleMerge.acceptedCloudTsByProductId, {});

  const freshMerge = model.mergeOrderLineRows(
    previous,
    [{
      product_id: 'product-a',
      stock: 7,
      upcoming_delivery: null,
      target_stock: 18,
      packaging: 6,
      margin: 30,
      updated_at: '2026-07-15T08:15:00.000Z',
    }],
    localTimestamps,
  );

  assert.notEqual(freshMerge.next, previous);
  assert.deepEqual(
    freshMerge.next['product-b'],
    previous['product-b'],
    'La mise à jour d’un produit ne doit jamais effacer ou remplacer les autres lignes du site',
  );
  assert.deepEqual(freshMerge.next['product-a'], {
    stock: 7,
    upcomingDelivery: '',
    targetStock: 18,
    packaging: 6,
    margin: 30,
    updatedAt: '2026-07-15T08:15:00.000Z',
  });

  const emptyMerge = model.mergeOrderLineRows(previous, [], localTimestamps);
  assert.equal(
    emptyMerge.next,
    previous,
    'Une réponse vide ne doit jamais vider les lignes déjà présentes',
  );

  const legacyMap = model.buildLegacyOrderLineStateMap(
    [
      {
        id: 'legacy-a',
        name: 'Article A',
        searchName: 'Article A',
        stock: 5,
        upcomingDelivery: 2,
        targetStock: 9,
        packaging: 6,
        salesHistory: {},
      },
      {
        id: 'legacy-b',
        name: 'Article B',
        searchName: 'Article B',
        stock: '',
        upcomingDelivery: '',
        targetStock: '',
        packaging: 12,
        salesHistory: {},
      },
    ],
    {
      'legacy-a': { stock: 5, upcomingDelivery: 2, targetStock: 9, margin: 45 },
      'legacy-b': { stock: '', upcomingDelivery: '', targetStock: '', margin: 15 },
    },
  );

  assert.deepEqual(legacyMap, {
    'legacy-a': {
      stock: 5,
      upcomingDelivery: 2,
      targetStock: 9,
      packaging: 6,
      margin: 45,
    },
    'legacy-b': {
      stock: '',
      upcomingDelivery: '',
      targetStock: '',
      packaging: 12,
      margin: 15,
    },
  });

  assert.equal(model.getOrderLineSaveId('product-a'), 'order:product-a');
  assert.equal(model.getProductIdFromOrderLineSaveId('order:product-a'), 'product-a');
  assert.equal(model.getProductIdFromOrderLineSaveId('app:products'), null);

  assert.doesNotMatch(
    cloudSyncSource,
    /loadOrderLineStates|scheduleReliableOrderLineSave|deleteOrderLineState|ORDER_LINE_FIELD_TO_COLUMN/,
    'useCloudSync doit déléguer la gestion détaillée des lignes au hook dédié',
  );
  assert.match(
    cloudSyncSource,
    /useOrderLineSync\(/,
    'useCloudSync doit utiliser le hook dédié aux lignes de commande',
  );
  assert.match(
    hookSource,
    /if \(isReconnect\) return;/,
    'Une reconnexion avec réponse vide doit conserver les données déjà chargées',
  );
  assert.match(
    hookSource,
    /deleteOrderLineState\(productId\)/,
    'La suppression en base doit rester limitée à un productId explicitement demandé',
  );
  assert.doesNotMatch(
    hookSource,
    /deleteOrderLineState\(\)|deleteOrderLineStates|truncate|from\(['"]order_line_states['"]\)\.delete\(\)(?![\s\S]*productId)/i,
    'Aucune suppression globale des lignes de commande ne doit être introduite',
  );

  console.log('Synchronisation lignes commandes OK : fusion ciblée, protection LWW, conservation sur réponse vide, compatibilité historique et absence de suppression globale.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
