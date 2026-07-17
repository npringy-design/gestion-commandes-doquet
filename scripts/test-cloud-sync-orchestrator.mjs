import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(
  join(process.cwd(), 'src', 'hooks', 'useCloudSync.ts'),
  'utf8',
);

const delegatedHooks = [
  'useReliableSaveLifecycle',
  'useAppStateHydration',
  'useOrderLineSync',
  'useAppStateRealtimeEvents',
  'useCloudHydrationCoordinator',
  'useCloudRealtime',
  'useAppStatePersistence',
];

delegatedHooks.forEach(hookName => {
  assert.match(
    source,
    new RegExp(`import[\\s\\S]*?${hookName}[\\s\\S]*?from`),
    `useCloudSync doit importer ${hookName}`,
  );
  assert.match(
    source,
    new RegExp(`${hookName}\\(\\{`),
    `useCloudSync doit déléguer à ${hookName}`,
  );
});

const forbiddenResponsibilities = [
  /from ['"]\.\.\/lib\/supabaseClient['"]/,
  /from ['"]\.\.\/utils\/supabase['"]/,
  /from ['"]\.\.\/utils\/reliableSaveQueue['"]/,
  /loadAllFromSupabase/,
  /scheduleReliable(?:AppState|OrderLine)Save/,
  /\.channel\(/,
  /addEventListener\(/,
  /removeEventListener\(/,
  /setTimeout\(/,
  /clearTimeout\(/,
  /deleteOrderLineState/,
];

forbiddenResponsibilities.forEach(pattern => {
  assert.doesNotMatch(
    source,
    pattern,
    `useCloudSync doit rester un orchestrateur sans responsabilité directe (${pattern})`,
  );
});

assert.match(
  source,
  /return \{\s*supabaseLoaded,\s*syncStatus,\s*pendingSaveCount,\s*orderLineStates,\s*updateOrderLineField,\s*deleteOrderLineForProduct,\s*\};/,
  'Le contrat public historique de useCloudSync doit rester limité et stable',
);

console.log('Orchestrateur cloud OK : responsabilités déléguées et contrat public stable.');
