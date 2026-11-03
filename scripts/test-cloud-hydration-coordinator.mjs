import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const coordinatorPath = join(root, 'src', 'hooks', 'useCloudHydrationCoordinator.ts');
const cloudSyncPath = join(root, 'src', 'hooks', 'useCloudSync.ts');
const coordinatorSource = readFileSync(coordinatorPath, 'utf8');
const cloudSyncSource = readFileSync(cloudSyncPath, 'utf8');

assert.match(
  cloudSyncSource,
  /useCloudHydrationCoordinator\(\{/,
  'useCloudSync doit déléguer le chargement et les reprises au coordinateur dédié',
);
assert.doesNotMatch(
  cloudSyncSource,
  /loadAllFromSupabase/,
  'useCloudSync ne doit plus charger directement app_state',
);
assert.doesNotMatch(
  cloudSyncSource,
  /addEventListener\('online'/,
  'useCloudSync ne doit plus installer directement l’écouteur de reprise réseau',
);

assert.match(coordinatorSource, /if \(!isSupabaseConfigured\(\)\) \{[\s\S]*?setSupabaseLoaded\(true\);[\s\S]*?return;/,
  'Sans configuration Supabase, le chargement doit se terminer sans requête');
assert.match(coordinatorSource, /initialCloudLoadSucceededRef\.current = cloud !== null/,
  'Une réponse nulle ne doit jamais être considérée comme un chargement cloud réussi');

const loadIndex = coordinatorSource.indexOf('await loadAllFromSupabase()');
const appStateIndex = coordinatorSource.indexOf('hydrateAppStateRows(cloud)');
const orderLinesIndex = coordinatorSource.indexOf('await hydrateOrderLineStates({');
assert.ok(loadIndex >= 0 && loadIndex < appStateIndex && appStateIndex < orderLinesIndex,
  'Le chargement doit conserver l’ordre Supabase, app_state puis lignes de commande');

assert.match(coordinatorSource, /isReconnect: options\.isReconnect/,
  'Le mode reconnexion doit rester transmis aux lignes de commande');
assert.match(coordinatorSource, /legacyProducts: cloudValues\.products/,
  'Le filet historique des produits doit rester disponible au premier chargement');
assert.match(coordinatorSource, /legacyOrderStates: cloudValues\.orderStates/,
  'Le filet historique des anciennes lignes doit rester disponible au premier chargement');
assert.match(coordinatorSource, /finally \{[\s\S]*?setSupabaseLoaded\(true\);[\s\S]*?\}/,
  'Le chargement doit toujours libérer l’interface, même après une exception');

assert.match(coordinatorSource, /void hydrateFromCloud\(\);/,
  'Le chargement initial doit toujours être déclenché au montage');
assert.match(coordinatorSource, /retryReliableSaves\(\{[\s\S]*?confirmRetriedOrderLineSave,[\s\S]*?hydrateFromCloud/,
  'La reprise doit confirmer les lignes puis utiliser le même rechargement sécurisé');
assert.match(coordinatorSource, /window\.addEventListener\('online', handleOnline\)/,
  'Les sauvegardes en attente doivent être reprises au retour du réseau');
assert.match(coordinatorSource, /window\.removeEventListener\('online', handleOnline\)/,
  'L’écouteur réseau doit être retiré à la destruction du coordinateur');
assert.doesNotMatch(coordinatorSource, /deleteOrderLineState|deleteFromSupabase|set[A-Z][A-Za-z]+\(\{\}\)/,
  'Le coordinateur ne doit ni supprimer ni remettre à zéro des données');

// Une reprise cloud ne doit jamais écraser un champ en cours d'édition.
assert.match(coordinatorSource, /options\.isReconnect && isUserTyping\(\)/,
  'Une reprise après coupure doit être repoussée pendant une saisie');
assert.match(coordinatorSource, /runOrDefer\(\(\) => \{ void loadFromCloud\(options\); \}\)/,
  'La reprise différée doit relancer le même rechargement cloud sécurisé');

const tempDir = mkdtempSync(join(root, '.idle-deferral-'));
try {
  const source = readFileSync(join(root, 'src', 'hooks', 'idleDeferralModel.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  });
  const modulePath = join(tempDir, 'idleDeferralModel.mjs');
  writeFileSync(modulePath, outputText, 'utf8');
  const { createIdleDeferral } = await import(pathToFileURL(modulePath).href);

  let busy = false;
  let listener = null;
  let subscriptions = 0;
  const scheduled = [];
  const deferral = createIdleDeferral({
    isBusy: () => busy,
    subscribe: (onActivity) => { subscriptions += 1; listener = onActivity; return () => { listener = null; }; },
    schedule: (callback) => { scheduled.push(callback); },
  });
  const flushScheduled = () => scheduled.splice(0).forEach((callback) => callback());

  const runs = [];
  assert.equal(deferral.runOrDefer(() => runs.push('immediate')), false);
  assert.deepEqual(runs, ['immediate'], 'Sans saisie, la reprise s’exécute immédiatement');

  busy = true;
  assert.equal(deferral.runOrDefer(() => runs.push('first')), true);
  assert.equal(deferral.runOrDefer(() => runs.push('second')), true);
  assert.equal(subscriptions, 1, 'Un seul écouteur doit être posé pour plusieurs reprises différées');
  assert.deepEqual(runs, ['immediate'], 'Rien ne s’exécute pendant la saisie');

  listener();
  flushScheduled();
  assert.deepEqual(runs, ['immediate'], 'Un focusout vers un autre champ ne doit pas déclencher la reprise');

  busy = false;
  listener();
  flushScheduled();
  assert.deepEqual(runs, ['immediate', 'second'], 'La dernière reprise demandée s’exécute une fois la saisie terminée');
  assert.equal(listener, null, 'L’écouteur doit être retiré après la reprise');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

console.log('Hydratation cloud OK : ordre de chargement, reprise réseau et filets historiques conservés.');
