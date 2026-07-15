import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const modelPath = join(root, 'src', 'hooks', 'cloudRealtimeModel.ts');
const realtimeHookPath = join(root, 'src', 'hooks', 'useCloudRealtime.ts');
const cloudSyncPath = join(root, 'src', 'hooks', 'useCloudSync.ts');
const rawModelSource = readFileSync(modelPath, 'utf8');
const realtimeHookSource = readFileSync(realtimeHookPath, 'utf8');
const cloudSyncSource = readFileSync(cloudSyncPath, 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-cloud-realtime-'));

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

  const compiledPath = join(tempDir, 'cloudRealtimeModel.mjs');
  writeFileSync(compiledPath, outputText, 'utf8');
  const model = await import(pathToFileURL(compiledPath).href);

  assert.deepEqual(
    [0, 1, 2, 3, 99].map(model.getRealtimeReconnectDelay),
    [2000, 5000, 10000, 10000, 10000],
    'Les délais de reconnexion doivent rester 2 s, 5 s puis 10 s plafonné',
  );

  assert.equal(model.canScheduleRealtimeReconnect(false, false), true);
  assert.equal(model.canScheduleRealtimeReconnect(false, true), false, 'Un second timer ne doit pas être programmé');
  assert.equal(model.canScheduleRealtimeReconnect(true, false), false, 'Aucune reconnexion après destruction du hook');

  assert.equal(model.isRealtimeRetryStatus('CHANNEL_ERROR'), true);
  assert.equal(model.isRealtimeRetryStatus('TIMED_OUT'), true);
  assert.equal(model.isRealtimeRetryStatus('CLOSED'), false);

  assert.equal(model.shouldRecoverRealtimeConnection('visible', false, 'errored'), true);
  assert.equal(model.shouldRecoverRealtimeConnection('visible', false, 'joined'), false);
  assert.equal(model.shouldRecoverRealtimeConnection('hidden', false, 'errored'), false);
  assert.equal(model.shouldRecoverRealtimeConnection('visible', true, 'errored'), false);

  const accepted = model.readAppStateRealtimeEvent({
    new: {
      site_id: 'hippo_thillois',
      key: 'deliveryDateBySupplier',
      value: { doquet: '2026-07-16' },
      updated_at: '2026-07-15T09:00:00.000Z',
    },
  }, 'hippo_thillois');
  assert.deepEqual(accepted, {
    key: 'deliveryDateBySupplier',
    value: { doquet: '2026-07-16' },
    updatedAt: '2026-07-15T09:00:00.000Z',
  });

  assert.equal(
    model.readAppStateRealtimeEvent({
      new: {
        site_id: 'autre_site',
        key: 'deliveryDateBySupplier',
        value: {},
        updated_at: '2026-07-15T09:00:00.000Z',
      },
    }, 'hippo_thillois'),
    null,
    'Un événement app_state provenant d’un autre site doit être ignoré',
  );
  assert.equal(model.readAppStateRealtimeEvent({ new: { key: '', updated_at: 'x' } }, 'hippo_thillois'), null);
  assert.equal(model.readAppStateRealtimeEvent({ new: { key: 'covers' } }, 'hippo_thillois'), null);
  assert.equal(model.readAppStateRealtimeEvent({}, 'hippo_thillois'), null);

  assert.match(cloudSyncSource, /useCloudRealtime\(\{/,
    'useCloudSync doit déléguer la connexion Realtime au hook dédié');
  assert.doesNotMatch(cloudSyncSource, /\.channel\(/,
    'useCloudSync ne doit plus créer directement de canal Supabase');
  assert.doesNotMatch(cloudSyncSource, /postgres_changes/,
    'Les souscriptions Supabase ne doivent plus être dupliquées dans useCloudSync');
  assert.doesNotMatch(cloudSyncSource, /REALTIME_RECONNECT_DELAYS_MS/,
    'Les délais de reconnexion doivent vivre dans le module Realtime');
  assert.doesNotMatch(cloudSyncSource, /channelRef/,
    'Les références de canal ne doivent plus vivre dans useCloudSync');

  assert.match(realtimeHookSource, /table: 'app_state'/);
  assert.match(realtimeHookSource, /table: 'order_line_states'/);
  assert.equal(
    (realtimeHookSource.match(/filter: `site_id=eq\.\$\{CURRENT_SITE_ID\}`/g) ?? []).length,
    2,
    'Les deux souscriptions doivent rester filtrées sur le site courant',
  );
  assert.match(realtimeHookSource, /closeCurrentChannel\(\);[\s\S]*?client[\s\S]*?\.channel\(/,
    'L’ancien canal doit être fermé avant chaque nouvelle souscription');
  assert.match(realtimeHookSource, /canScheduleRealtimeReconnect\(disposed, Boolean\(reconnectTimerRef\.current\)\)/,
    'Un seul timer de reconnexion doit pouvoir être actif');
  assert.match(realtimeHookSource, /hydrateFromCloud\(\{ isReconnect: true \}\)/,
    'Le retour sur l’application doit recharger les données sans remise à zéro');
  assert.match(realtimeHookSource, /getReliablePendingSaveCount\(\) > 0/,
    'Les sauvegardes en attente doivent être renvoyées au retour sur l’application');
  assert.doesNotMatch(realtimeHookSource, /deleteOrderLineState|saveToSupabase|removeState|set[A-Z][A-Za-z]+\(\{\}\)/,
    'Le hook Realtime ne doit ni supprimer ni remettre à zéro des données');

  console.log('Realtime OK : filtres site, canal unique, reconnexion 2/5/10 s et reprise sans effacement.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
