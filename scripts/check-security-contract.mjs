import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = path => readFileSync(join(process.cwd(), path), 'utf8');

const permissions = read('src/lib/permissions.ts');
const profilesSql = read('SUPABASE_PROFILES_SETUP.sql');
const userSiteSql = read('SUPABASE_USER_SITE_ACCESS.sql');
const appStateRlsSql = read('SUPABASE_APP_STATE_RLS_LOCKDOWN.sql');
const auditSql = read('SUPABASE_SECURITY_AUDIT_READ_ONLY.sql');
const deploymentDoc = read('docs/DEPLOIEMENT.md');
const stagingChangelog = read('TEST_ENVIRONMENT_CHANGELOG.md');

const roles = [
  'super_admin',
  'global_admin',
  'director',
  'manager_plus',
  'manager',
  'commande',
];

for (const role of roles) {
  assert.match(
    permissions,
    new RegExp(`['\"]${role}['\"]`),
    `Le rôle ${role} doit rester défini dans le contrat applicatif`
  );
  assert.match(
    profilesSql,
    new RegExp(`['\"]${role}['\"]`),
    `Le rôle ${role} doit rester présent dans l'enum SQL`
  );
}

assert.match(
  permissions,
  /case ROLES\.MANAGER:[\s\S]*return \[ROLES\.COMMANDE\]/,
  'Un manager ne doit pouvoir créer que le rôle commande'
);
assert.match(
  permissions,
  /case ROLES\.MANAGER_PLUS:[\s\S]*ROLES\.MANAGER[\s\S]*ROLES\.COMMANDE/,
  'Un manager+ doit rester limité aux rôles manager et commande'
);
assert.match(
  permissions,
  /if \(profile\.id === target\.id\) return false;/,
  'Un utilisateur ne doit pas pouvoir se gérer lui-même via l’interface'
);
assert.match(
  permissions,
  /target\.protected_user \|\| target\.role === ROLES\.SUPER_ADMIN/,
  'Les comptes protégés et super-admin doivent rester bloqués pour les rôles non super-admin'
);

for (const [label, sql, table] of [
  ['profiles', profilesSql, 'profiles'],
  ['user_site_access', userSiteSql, 'user_site_access'],
  ['app_state', appStateRlsSql, 'app_state'],
]) {
  assert.match(
    sql,
    new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, 'i'),
    `RLS doit rester activé sur ${label}`
  );
  assert.match(
    sql,
    new RegExp(`ALTER TABLE public\\.${table} FORCE ROW LEVEL SECURITY`, 'i'),
    `RLS doit rester forcé sur ${label}`
  );
}

assert.match(
  appStateRlsSql,
  /REVOKE ALL ON public\.app_state FROM anon/i,
  'La clé anon ne doit pas conserver de privilège direct sur app_state après verrouillage'
);
assert.match(
  appStateRlsSql,
  /TO authenticated/i,
  'Les politiques app_state doivent cibler les utilisateurs authentifiés'
);
assert.match(
  userSiteSql,
  /CREATE POLICY "user_site_access_select_own"[\s\S]*user_id = auth\.uid\(\)/,
  'Chaque utilisateur doit pouvoir lire uniquement ses propres accès en plus des droits de gestion'
);

for (const table of ['profiles', 'user_site_access', 'app_state', 'order_line_states']) {
  assert.match(
    auditSql,
    new RegExp(`['\"]${table}['\"]`),
    `L'audit Supabase doit couvrir la table ${table}`
  );
}

assert.match(
  deploymentDoc,
  /Ne pas toucher a Supabase production pendant les tests staging/i,
  'La documentation doit interdire les tests sur Supabase production'
);
assert.match(
  stagingChangelog,
  /SUPABASE_APP_STATE_RLS_LOCKDOWN\.sql/,
  'L’ordre d’installation doit conserver le verrouillage RLS app_state'
);

const profilePolicyIsBroad = /profiles_update_admin_all[\s\S]*is_current_user_admin\(\)/.test(profilesSql);
const sitePolicyIsBroad = /user_site_access_write_admin[\s\S]*is_current_user_admin\(\)/.test(userSiteSql);

if (profilePolicyIsBroad || sitePolicyIsBroad) {
  console.warn(
    'Audit sécurité : les scripts SQL de base utilisent encore une autorisation admin générale. ' +
    'Le fichier SUPABASE_SECURITY_AUDIT_READ_ONLY.sql doit confirmer les politiques réellement déployées avant tout durcissement.'
  );
}

console.log(
  'Contrat sécurité OK : rôles applicatifs/SQL alignés, RLS requis et audit live Supabase disponible.'
);
