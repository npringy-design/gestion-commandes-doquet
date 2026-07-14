import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = path => readFileSync(join(process.cwd(), path), 'utf8');

const permissions = read('src/lib/permissions.ts');
const serverPermissions = read('api/_lib/permissions.ts');
const userManagementPage = read('src/pages/UserManagementPage.tsx');
const userUpdateRoute = read('api/admin/users/update.ts');
const profilesSql = read('SUPABASE_PROFILES_SETUP.sql');
const userSiteSql = read('SUPABASE_USER_SITE_ACCESS.sql');
const appStateRlsSql = read('SUPABASE_APP_STATE_RLS_LOCKDOWN.sql');
const hardeningSql = read('SUPABASE_SECURITY_RLS_HARDENING.sql');
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
    new RegExp(`['"]${role}['"]`),
    `Le rôle ${role} doit rester défini dans le contrat applicatif`
  );
  assert.match(
    profilesSql,
    new RegExp(`['"]${role}['"]`),
    `Le rôle ${role} doit rester présent dans l'enum SQL`
  );
  assert.match(
    serverPermissions,
    new RegExp(`['"]${role}['"]`),
    `Le rôle ${role} doit rester connu des contrôles serveur`
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
assert.match(
  serverPermissions,
  /if \(actor\.id === target\.id\)[\s\S]*Vous ne pouvez pas modifier votre propre compte/,
  'Le serveur doit bloquer la gestion de son propre compte'
);
assert.match(
  serverPermissions,
  /if \(target\.protected_user\)[\s\S]*utilisateur est protégé/,
  'Le serveur doit bloquer les comptes protégés'
);
assert.match(
  serverPermissions,
  /target\.role === 'super_admin'/,
  'Le serveur doit protéger le rôle super_admin'
);

assert.match(
  userManagementPage,
  /\/api\/admin\/users\/create/,
  'La création utilisateur doit passer par une route serveur'
);
assert.match(
  userManagementPage,
  /\/api\/admin\/users\/update/,
  'La modification utilisateur doit passer par une route serveur'
);
assert.match(
  userUpdateRoute,
  /canManageTarget\(auth\.profile, target\)/,
  'La route de modification doit vérifier le compte ciblé'
);
assert.match(
  userUpdateRoute,
  /supabaseAdmin[\s\S]*\.from\('profiles'\)[\s\S]*\.update/,
  'Les modifications de profils doivent rester réalisées côté serveur'
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

for (const table of ['profiles', 'user_site_access', 'app_state', 'order_line_states']) {
  assert.match(
    hardeningSql,
    new RegExp(`ALTER TABLE public\\.${table} FORCE ROW LEVEL SECURITY`, 'i'),
    `Le durcissement doit forcer RLS sur ${table}`
  );
  assert.match(
    hardeningSql,
    new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM anon`, 'i'),
    `anon ne doit conserver aucun privilège sur ${table}`
  );
  assert.match(
    auditSql,
    new RegExp(`['"]${table}['"]`),
    `L'audit Supabase doit couvrir la table ${table}`
  );
}

assert.match(
  hardeningSql,
  /DROP POLICY IF EXISTS "profiles_update_admin_all" ON public\.profiles/,
  'La politique large de modification directe des profils doit être supprimée'
);
assert.match(
  hardeningSql,
  /DROP POLICY IF EXISTS "profiles_delete_admin_only" ON public\.profiles/,
  'La suppression directe de profils doit être retirée du frontend'
);
assert.match(
  hardeningSql,
  /CREATE POLICY "profiles_select_own"[\s\S]*USING \(id = auth\.uid\(\)\)/,
  'Le frontend doit seulement lire son propre profil'
);
assert.match(
  hardeningSql,
  /CREATE POLICY "user_site_access_select_own"[\s\S]*USING \(user_id = auth\.uid\(\)\)/,
  'Le frontend doit seulement lire ses propres affectations de sites'
);
assert.match(
  hardeningSql,
  /GRANT SELECT ON TABLE public\.profiles TO authenticated/,
  'authenticated doit disposer uniquement de la lecture SQL nécessaire sur profiles'
);
assert.match(
  hardeningSql,
  /GRANT SELECT ON TABLE public\.user_site_access TO authenticated/,
  'authenticated doit disposer uniquement de la lecture SQL nécessaire sur user_site_access'
);
assert.doesNotMatch(
  hardeningSql,
  /GRANT[^;]*(INSERT|UPDATE|DELETE)[^;]*public\.(profiles|user_site_access)[^;]*TO authenticated/i,
  'Le frontend ne doit pas obtenir de droit d’écriture direct sur profiles ou user_site_access'
);

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
  deploymentDoc,
  /Ne pas toucher a Supabase production pendant les tests staging/i,
  'La documentation doit interdire les tests sur Supabase production'
);
assert.match(
  stagingChangelog,
  /SUPABASE_APP_STATE_RLS_LOCKDOWN\.sql/,
  'L’ordre d’installation doit conserver le verrouillage RLS app_state'
);

console.log(
  'Contrat sécurité OK : hiérarchie contrôlée côté serveur, écritures utilisateurs fermées au frontend, RLS forcée et anon révoqué.'
);
