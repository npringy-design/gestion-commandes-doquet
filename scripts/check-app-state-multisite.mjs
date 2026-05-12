import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sourcePath = join(process.cwd(), 'src', 'utils', 'supabase.ts');
const source = readFileSync(sourcePath, 'utf8');

const compact = source.replace(/\s+/g, ' ');

const checks = [
  {
    label: 'app_state doit rester la table controlee',
    test: () => /const\s+TABLE\s*=\s*['"]app_state['"]/.test(source),
  },
  {
    label: 'CURRENT_SITE_ID doit alimenter SITE_ID_QUERY',
    test: () => /const\s+SITE_ID_QUERY\s*=\s*encodeURIComponent\(CURRENT_SITE_ID\)/.test(source),
  },
  {
    label: 'upsert doit utiliser le conflit site_id,key',
    test: () => /const\s+SITE_KEY_CONFLICT\s*=\s*['"]site_id,key['"]/.test(source),
  },
  {
    label: 'loadAllFromSupabase doit filtrer par site_id',
    test: () => /loadAllFromSupabase[\s\S]*select=site_id,key,value,updated_at&site_id=eq\.\$\{SITE_ID_QUERY\}/.test(source),
  },
  {
    label: 'loadKeysFromSupabase doit filtrer par site_id avant key',
    test: () => /loadKeysFromSupabase[\s\S]*select=site_id,key,value,updated_at&site_id=eq\.\$\{SITE_ID_QUERY\}&key=in\.\(\$\{encoded\}\)/.test(source),
  },
  {
    label: 'saveToSupabase doit ecrire site_id dans le payload',
    test: () => /const\s+payload\s*=\s*\{\s*site_id:\s*CURRENT_SITE_ID,\s*key,\s*value,\s*updated_at:\s*ts\s*\}/.test(source),
  },
  {
    label: 'saveToSupabase doit upsert avec on_conflict site_id,key',
    test: () => /on_conflict=\$\{SITE_KEY_CONFLICT\}/.test(source),
  },
  {
    label: 'fallback update doit filtrer par site_id et key',
    test: () => /site_id=eq\.\$\{SITE_ID_QUERY\}&key=eq\.\$\{encodeURIComponent\(key\)\}/.test(source),
  },
  {
    label: 'aucun on_conflict=key seul ne doit exister',
    test: () => !/on_conflict\s*=\s*key|on_conflict=key/.test(compact),
  },
  {
    label: 'aucun payload app_state ne doit reposer uniquement sur key',
    test: () => !/const\s+payload\s*=\s*\{\s*key\s*,/.test(source),
  },
];

const failures = checks.filter((check) => !check.test());

if (failures.length > 0) {
  console.error('Isolation multisite app_state non conforme :');
  for (const failure of failures) {
    console.error(`- ${failure.label}`);
  }
  process.exit(1);
}

console.log('Isolation multisite app_state OK : lectures filtrees par site_id, sauvegardes avec site_id, conflit site_id,key.');
