import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const modelPath = join(root, 'src', 'hooks', 'appStateRealtimeEventModel.ts');
const hookPath = join(root, 'src', 'hooks', 'useAppStateRealtimeEvents.ts');
const cloudSyncPath = join(root, 'src', 'hooks', 'useCloudSync.ts');
const rawModelSource = readFileSync(modelPath, 'utf8');
const hookSource = readFileSync(hookPath, 'utf8');
const cloudSyncSource = readFileSync(cloudSyncPath, 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-app-state-realtime-'));

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

  const compiledPath = join(tempDir, 'appStateRealtimeEventModel.mjs');
  writeFileSync(compiledPath, outputText, 'utf8');
  const model = await import(pathToFileURL(compiledPath).href);
  const base = {
    key: 'deliveryDateBySupplier',
    cloudTs: '2026-07-17T10:00:00.000Z',
    localTs: undefined,
    userIsTyping: false,
  };

  assert.equal(model.getAppStateRealtimeDecision(base), 'apply');
  assert.equal(model.getAppStateRealtimeDecision({ ...base, key: 'nextDeliveryDateBySupplier' }), 'apply');
  assert.equal(model.getAppStateRealtimeDecision({ ...base, key: 'covers' }), 'ignore',
    'Realtime doit rester limité aux deux dates de livraison');
  assert.equal(model.getAppStateRealtimeDecision({ ...base, localTs: base.cloudTs }), 'ignore',
    'Une valeur cloud identique ou plus ancienne ne doit pas remplacer la saisie locale');
  assert.equal(model.getAppStateRealtimeDecision({
    ...base,
    localTs: '2026-07-17T10:01:00.000Z',
  }), 'ignore');
  assert.equal(model.getAppStateRealtimeDecision({
    ...base,
    localTs: '2026-07-17T09:59:00.000Z',
    userIsTyping: true,
  }), 'apply', 'Les deux dates conservent leur application immédiate historique');

  assert.match(cloudSyncSource, /useAppStateRealtimeEvents\(\{/,
    'useCloudSync doit déléguer les événements app_state au hook dédié');
  assert.doesNotMatch(cloudSyncSource, /REALTIME_KEYS|DEFER_WHILE_TYPING|pendingRealtimeRef|isUserTyping/,
    'Le filtrage et la file temporaire ne doivent plus être dupliqués dans useCloudSync');
  assert.match(hookSource, /getAppStateRealtimeDecision\(\{/,
    'Le hook doit utiliser la décision pure avant toute application');
  assert.match(hookSource, /if \(decision === 'ignore'\) return;[\s\S]*?lastCloudUpdatedAtByKey\.current\[key\] = cloudTs/,
    'Un événement ignoré ne doit pas avancer le curseur cloud');
  assert.match(hookSource, /if \(!existing \|\| cloudTs > existing\.ts\)/,
    'La file temporaire doit conserver uniquement l’événement le plus récent par clé');
  assert.match(hookSource, /setTimeout\([\s\S]*?150\);/,
    'Le délai historique de vidage doit rester de 150 ms');
  assert.doesNotMatch(hookSource, /saveToSupabase|deleteOrderLineState|deleteFromSupabase/,
    'Le traitement des événements ne doit ni écrire ni supprimer dans Supabase');

  console.log('Événements app_state Realtime OK : clés autorisées, LWW, application et file temporaire protégés.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
