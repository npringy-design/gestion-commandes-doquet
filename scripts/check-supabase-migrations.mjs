import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = path => readFileSync(join(root, path), 'utf8');
const listSql = path => readdirSync(join(root, path)).filter(name => name.endsWith('.sql')).sort();

const migrations = listSql('supabase/migrations');
assert.deepEqual(
  migrations,
  [
    '20260713091142_create_order_line_states.sql',
    '20260713104058_create_order_line_states.sql',
    '20260713104108_migrate_data_into_order_line_states.sql',
    '20260719101200_hippo_commandes_baseline.sql',
    '20260719101210_converge_hippo_commandes_schema.sql',
  ],
  'Les trois ponts historiques doivent précéder la baseline et sa convergence'
);

const historyBridges = migrations.slice(0, 3).map(name => read(`supabase/migrations/${name}`));
const baseline = read(`supabase/migrations/${migrations[3]}`);
const convergence = read(`supabase/migrations/${migrations[4]}`);
const baselineRollback = read(`supabase/rollbacks/${migrations[3]}`);
const preflight = read('supabase/diagnostics/SUPABASE_BASELINE_PREFLIGHT_READ_ONLY.sql');
const activeSql = `${baseline}\n${convergence}`;

for (const [index, bridge] of historyBridges.entries()) {
  const executable = bridge.replace(/^\s*--.*$/gm, '').trim();
  assert.equal(executable, 'select 1;', `${migrations[index]} doit rester un pont historique sans DDL`);
}

for (const [name, sql] of [['baseline', baseline], ['convergence', convergence]]) {
  assert.match(sql, /^--[\s\S]*\bbegin;/i, `${name} doit être transactionnelle`);
  assert.match(sql, /\bcommit;\s*$/i, `${name} doit se terminer par COMMIT`);
  assert.doesNotMatch(sql, /alter\s+table\s+[^;]+disable\s+row\s+level\s+security/i);
  assert.doesNotMatch(sql, /grant\s+all[^;]*\bto\s+anon\b/i);
  assert.doesNotMatch(sql, /create\s+policy[^;]+using\s*\(\s*true\s*\)/i);
}

for (const table of ['profiles', 'user_site_access', 'app_state', 'order_line_states']) {
  assert.match(
    baseline,
    new RegExp(`create table if not exists public\\.${table}\\b`, 'i'),
    `La baseline doit créer ${table}`
  );
  assert.match(
    baseline,
    new RegExp(`alter table public\\.${table} force row level security`, 'i'),
    `La baseline doit forcer RLS sur ${table}`
  );
  assert.match(
    baseline,
    new RegExp(`revoke all on table public\\.${table} from anon`, 'i'),
    `La baseline doit révoquer anon sur ${table}`
  );
  assert.match(
    baseline,
    new RegExp(`grant all privileges on table public\\.${table} to service_role`, 'i'),
    `La baseline doit donner le chemin serveur à service_role sur ${table}`
  );
}

for (const role of ['super_admin', 'global_admin', 'director', 'manager_plus', 'manager', 'commande']) {
  assert.match(activeSql, new RegExp(`'${role}'`), `Le rôle ${role} doit rester dans le contrat SQL`);
}

assert.match(baseline, /create schema if not exists private/i);
assert.match(
  baseline,
  /function private\.can_access_app_state_site[\s\S]*security definer[\s\S]*set search_path = ''/i,
  'Le helper RLS privilégié doit être privé et avoir un search_path vide'
);
assert.match(
  baseline,
  /revoke all on function private\.can_access_app_state_site\(text\) from public/i,
  'Le helper RLS ne doit pas être exécutable par PUBLIC'
);
assert.match(
  baseline,
  /grant execute on function private\.can_access_app_state_site\(text\) to authenticated/i,
  'Les politiques authenticated doivent pouvoir exécuter le helper privé'
);
assert.match(
  baseline,
  /using \(id = \(select auth\.uid\(\)\)\)/i,
  'La politique profiles doit limiter et optimiser auth.uid()'
);
assert.match(
  baseline,
  /using \(user_id = \(select auth\.uid\(\)\)\)/i,
  'La politique user_site_access doit limiter et optimiser auth.uid()'
);
assert.match(
  baseline,
  /grant select on table public\.profiles to authenticated/i,
  'Le frontend doit uniquement lire profiles'
);
assert.doesNotMatch(
  baseline,
  /grant[^;]*(insert|update|delete)[^;]*public\.(profiles|user_site_access)[^;]*to authenticated/i,
  'Le frontend ne doit jamais écrire directement profiles ou user_site_access'
);
assert.match(baseline, /alter publication supabase_realtime add table public\.app_state/i);
assert.match(baseline, /alter publication supabase_realtime add table public\.order_line_states/i);

assert.match(convergence, /raise exception 'Convergence refusée/i);
assert.match(convergence, /alter column role type text using role::text/i);
assert.match(convergence, /add column if not exists must_change_password boolean not null default false/i);
assert.match(convergence, /drop function if exists public\.can_access_app_state_site\(text\)/i);
assert.doesNotMatch(
  convergence,
  /drop\s+(table|column)[^;]*(sites|user_sites|site_backups|default_site_id)/i,
  'La convergence ne doit pas supprimer les objets legacy encore porteurs de données'
);
assert.doesNotMatch(
  activeSql,
  /jsonb_array_elements\s*\(\s*a\.value\s*\)/i,
  'La reprise historique des blobs ne doit jamais être rejouée automatiquement'
);
assert.match(
  baselineRollback,
  /drop function if exists public\.can_access_app_state_site\(text\)/i,
  'Le rollback complet doit retirer le helper public recréé par le rollback de convergence'
);
assert.doesNotMatch(
  preflight
    .replace(/^\s*--.*$/gm, '')
    .replace(/'(?:''|[^'])*'/g, "''"),
  /\b(insert|update|delete|alter|create|drop|truncate|grant|revoke|do|call)\b/i,
  'Le préflight Supabase TEST doit rester strictement en lecture seule'
);

for (const migration of migrations.slice(3)) {
  assert.ok(
    existsSync(join(root, 'supabase/rollbacks', migration)),
    `Un retour arrière doit accompagner ${migration}`
  );
}

assert.deepEqual(
  listSql('supabase/legacy/remote_history'),
  [
    '20260713091142_create_order_line_states_test.sql',
    '20260713104058_create_order_line_states.sql',
    '20260713104108_migrate_data_into_order_line_states.sql',
  ],
  'Les migrations distantes TEST et production doivent rester archivées'
);

const rootSql = readdirSync(root).filter(name => name.endsWith('.sql'));
assert.deepEqual(rootSql, [], 'Aucun script SQL ne doit rester dispersé à la racine');
assert.ok(existsSync(join(root, 'supabase/diagnostics/SUPABASE_SECURITY_AUDIT_READ_ONLY.sql')));
assert.ok(existsSync(join(root, 'supabase/diagnostics/SUPABASE_BASELINE_PREFLIGHT_READ_ONLY.sql')));
assert.ok(existsSync(join(root, 'supabase/legacy/README.md')));

console.log(
  'Migrations Supabase OK : historiques réconciliés sans DDL, baseline ordonnée, RLS/privileges sûrs et rollbacks présents.'
);
