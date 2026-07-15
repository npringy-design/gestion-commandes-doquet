import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const modelPath = join(process.cwd(), 'src', 'hooks', 'reliableSaveLifecycleModel.ts');
const hookPath = join(process.cwd(), 'src', 'hooks', 'useReliableSaveLifecycle.ts');
const cloudSyncPath = join(process.cwd(), 'src', 'hooks', 'useCloudSync.ts');
const rawModelSource = readFileSync(modelPath, 'utf8');
const hookSource = readFileSync(hookPath, 'utf8');
const cloudSyncSource = readFileSync(cloudSyncPath, 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-reliable-save-lifecycle-'));

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

  const compiledPath = join(tempDir, 'reliableSaveLifecycleModel.mjs');
  writeFileSync(compiledPath, outputText, 'utf8');
  const model = await import(pathToFileURL(compiledPath).href);

  assert.equal(model.SAVED_STATUS_VISIBLE_MS, 1800, 'Le statut Sauvegardé doit rester visible 1,8 seconde');
  assert.equal(model.SAVE_PROBLEM_THROTTLE_MS, 5000, 'Les alertes doivent conserver leur limitation à 5 secondes');
  assert.equal(model.getConfirmedSyncStatus(1, 0), 'pending');
  assert.equal(model.getConfirmedSyncStatus(0, 1), 'saving');
  assert.equal(model.getConfirmedSyncStatus(0, 0), 'saved');

  assert.deepEqual(
    model.getPendingSaveFeedback(true),
    {
      status: 'pending',
      message: 'Sauvegarde non confirmée. La modification est conservée sur cet appareil et sera renvoyée automatiquement.',
    },
  );
  assert.equal(model.getPendingSaveFeedback(false).status, 'error');
  assert.equal(model.getSaveErrorFeedback('conflict', 1).status, 'pending');
  assert.equal(
    model.getSaveErrorFeedback('conflict', 0).message,
    'Une modification plus récente existe déjà. Les données du serveur ont été conservées.',
  );
  assert.equal(
    model.getSaveErrorFeedback('storage', 0).message,
    'La modification ne peut pas être sécurisée localement. Gardez cette page ouverte.',
  );
  assert.equal(
    model.getSaveErrorFeedback('network', 0).message,
    'Erreur de sauvegarde. Une nouvelle tentative sera effectuée automatiquement.',
  );

  assert.match(hookSource, /retryReliablePendingSaves\(/, 'La reprise de la file locale doit rester centralisée');
  assert.match(hookSource, /visibilitychange/, 'La file doit toujours être vidée quand la page devient cachée');
  assert.match(hookSource, /pagehide/, 'La file doit toujours être vidée avant la fermeture de la page');
  assert.match(
    cloudSyncSource,
    /useReliableSaveLifecycle\(\{/,
    'useCloudSync doit déléguer le cycle de vie des sauvegardes au hook dédié',
  );
  assert.doesNotMatch(cloudSyncSource, /retryReliablePendingSaves/, 'useCloudSync ne doit plus reprendre directement la file');
  assert.doesNotMatch(cloudSyncSource, /getReliablePendingSaveCount/, 'useCloudSync ne doit plus compter directement la file');
  assert.doesNotMatch(cloudSyncSource, /flushReliablePendingSaves/, 'useCloudSync ne doit plus vider directement la file');

  console.log('Cycle sauvegardes fiable OK : statuts, messages, délais, reprise et délégation protégés.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
