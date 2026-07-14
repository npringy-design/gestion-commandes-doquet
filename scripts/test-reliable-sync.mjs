import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    this.map.set(key, String(value));
  }
  removeItem(key) {
    this.map.delete(key);
  }
  keys() {
    return [...this.map.keys()].sort();
  }
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const sourcePath = join(process.cwd(), 'src', 'utils', 'reliableSaveQueue.ts');
const rawSource = readFileSync(sourcePath, 'utf8');
const cloudSyncSource = readFileSync(join(process.cwd(), 'src', 'hooks', 'useCloudSync.ts'), 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-reliable-sync-'));
const storage = new MemoryStorage();
globalThis.window = { localStorage: storage };

let moduleCounter = 0;

const compileQueue = async ({ appEnv, siteId, harness }) => {
  globalThis.__reliableSyncHarness = harness;

  let source = rawSource
    .replace("import { CURRENT_SITE_ID } from '../constants';\n", '')
    .replace(/import \{[\s\S]*?\} from '\.\/supabase';\n/, '')
    .replace(
      /const APP_ENV = \(import\.meta\.env\.VITE_APP_ENV as string \| undefined\) \|\| 'production';\nconst STORAGE_KEY = `gestion-commandes:pending-saves:v1:\$\{APP_ENV\}:\$\{CURRENT_SITE_ID\}`;/,
      `const APP_ENV = ${JSON.stringify(appEnv)};\nconst CURRENT_SITE_ID = ${JSON.stringify(siteId)};\nconst STORAGE_KEY = \`gestion-commandes:pending-saves:v1:\${APP_ENV}:\${CURRENT_SITE_ID}\`;`
    );

  source = `
const loadMetaFromSupabase = async () => globalThis.__reliableSyncHarness.loadMetaFromSupabase();
const loadOrderLineStates = async () => globalThis.__reliableSyncHarness.loadOrderLineStates();
const saveToSupabase = async (...args) => globalThis.__reliableSyncHarness.saveToSupabase(...args);
const upsertOrderLineState = async (...args) => globalThis.__reliableSyncHarness.upsertOrderLineState(...args);
${source}`;

  const { outputText } = ts.transpileModule(source, {
    fileName: sourcePath,
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
      isolatedModules: false,
    },
  });

  moduleCounter += 1;
  const compiledPath = join(tempDir, `reliableSaveQueue-${moduleCounter}.mjs`);
  writeFileSync(compiledPath, outputText, 'utf8');
  return import(`${pathToFileURL(compiledPath).href}?v=${moduleCounter}`);
};

const createHarness = () => ({
  metaRows: [],
  orderRows: [],
  saveResult: null,
  upsertResult: null,
  saveCalls: [],
  upsertCalls: [],
  async loadMetaFromSupabase() {
    return this.metaRows;
  },
  async loadOrderLineStates() {
    return this.orderRows;
  },
  async saveToSupabase(...args) {
    this.saveCalls.push(args);
    return this.saveResult;
  },
  async upsertOrderLineState(...args) {
    this.upsertCalls.push(args);
    return this.upsertResult;
  },
});

try {
  assert.doesNotMatch(
    cloudSyncSource,
    /setTimeout\(\(\) => setSyncStatus\('saved'\)/,
    'Le statut Sauvegardé ne doit jamais dépendre d’un simple délai'
  );
  assert.match(
    cloudSyncSource,
    /markSaveConfirmed[\s\S]*setSyncStatus\('saved'\)/,
    'Le statut Sauvegardé doit rester lié à la confirmation Supabase'
  );

  const successHarness = createHarness();
  const successTs = '2026-07-14T10:00:00.000Z';
  successHarness.saveResult = successTs;
  const successQueue = await compileQueue({ appEnv: 'staging', siteId: 'site-a', harness: successHarness });
  let confirmed = null;
  successQueue.scheduleReliableAppStateSave(
    'covers',
    { monday: 120 },
    successTs,
    () => undefined,
    { onSaved: (_id, ts) => { confirmed = ts; } },
    0
  );
  await delay(15);
  assert.equal(confirmed, successTs, 'Une écriture acceptée doit déclencher la confirmation');
  assert.equal(successQueue.getReliablePendingSaveCount(), 0, 'Une écriture confirmée ne doit pas rester en attente');

  const retryHarness = createHarness();
  const retryQueue = await compileQueue({ appEnv: 'staging', siteId: 'site-b', harness: retryHarness });
  let pendingCount = 0;
  retryQueue.scheduleReliableAppStateSave(
    'supplierConfigs',
    { doquet: { cutoffTime: '10:00' } },
    '2026-07-14T10:01:00.000Z',
    () => undefined,
    { onPending: (_id, _ts, count) => { pendingCount = count; } },
    0
  );
  await delay(15);
  assert.equal(pendingCount, 1, 'Une écriture non confirmée doit rejoindre la file locale');
  assert.equal(retryQueue.getReliablePendingSaveCount(), 1, 'La file locale doit contenir la modification non confirmée');

  retryHarness.saveResult = '2026-07-14T10:01:00.000Z';
  const retryResult = await retryQueue.retryReliablePendingSaves();
  assert.deepEqual(
    retryResult,
    { attempted: 1, saved: 1, discarded: 0, failed: 0, pending: 0 },
    'Le retour de connexion doit renvoyer puis retirer la modification confirmée'
  );

  const conflictHarness = createHarness();
  const conflictQueue = await compileQueue({ appEnv: 'staging', siteId: 'site-c', harness: conflictHarness });
  const localTs = '2026-07-14T10:02:00.000Z';
  conflictQueue.scheduleReliableAppStateSave(
    'dailyCovers',
    { value: 80 },
    localTs,
    () => undefined,
    {},
    0
  );
  await delay(15);
  conflictHarness.metaRows = [{ key: 'dailyCovers', updated_at: '2026-07-14T10:03:00.000Z' }];
  conflictHarness.saveCalls = [];
  let conflictReason = null;
  const conflictResult = await conflictQueue.retryReliablePendingSaves({
    onError: (_id, _ts, reason) => { conflictReason = reason; },
  });
  assert.equal(conflictReason, 'conflict', 'Une donnée serveur plus récente doit être signalée comme conflit');
  assert.equal(conflictResult.discarded, 1, 'L’ancienne écriture locale doit être écartée');
  assert.equal(conflictHarness.saveCalls.length, 0, 'Une ancienne écriture ne doit pas être renvoyée sur le serveur');

  const mergeHarness = createHarness();
  mergeHarness.upsertResult = '2026-07-14T10:05:00.000Z';
  const mergeQueue = await compileQueue({ appEnv: 'staging', siteId: 'site-d', harness: mergeHarness });
  mergeQueue.scheduleReliableOrderLineSave('product-1', { stock: 5 }, '2026-07-14T10:04:00.000Z', {}, 20);
  mergeQueue.scheduleReliableOrderLineSave('product-1', { packaging: 6 }, '2026-07-14T10:05:00.000Z', {}, 20);
  await delay(40);
  assert.equal(mergeHarness.upsertCalls.length, 1, 'Deux saisies rapides du même produit doivent être regroupées');
  assert.deepEqual(
    mergeHarness.upsertCalls[0][1],
    { stock: 5, packaging: 6 },
    'Les champs saisis rapidement sur un même produit doivent tous être conservés'
  );

  const envHarness = createHarness();
  const stagingQueue = await compileQueue({ appEnv: 'staging', siteId: 'shared-site', harness: envHarness });
  stagingQueue.scheduleReliableAppStateSave('covers', { value: 1 }, '2026-07-14T10:06:00.000Z', () => undefined, {}, 0);
  await delay(15);
  const productionQueue = await compileQueue({ appEnv: 'production', siteId: 'shared-site', harness: envHarness });
  productionQueue.scheduleReliableAppStateSave('covers', { value: 2 }, '2026-07-14T10:07:00.000Z', () => undefined, {}, 0);
  await delay(15);

  assert.deepEqual(
    storage.keys().filter(key => key.includes('shared-site')),
    [
      'gestion-commandes:pending-saves:v1:production:shared-site',
      'gestion-commandes:pending-saves:v1:staging:shared-site',
    ],
    'Les files de test et de production doivent utiliser deux clés locales distinctes'
  );

  console.log('Synchronisation fiable OK : confirmation réelle, attente locale, reprise réseau, conflit, fusion produit et séparation des environnements.');
} finally {
  delete globalThis.__reliableSyncHarness;
  delete globalThis.window;
  rmSync(tempDir, { recursive: true, force: true });
}
