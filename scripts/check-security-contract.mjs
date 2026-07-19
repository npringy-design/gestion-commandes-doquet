import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = path => readFileSync(join(process.cwd(), path), 'utf8');

const permissions = read('src/lib/permissions.ts');
const serverPermissions = read('api/_lib/permissions.ts');
const userManagementPage = read('src/pages/UserManagementPage.tsx');
const userUpdateRoute = read('api/admin/users/update.ts');
const baseline = read('supabase/migrations/20260719101200_hippo_commandes_baseline.sql');
const convergence = read('supabase/migrations/20260719101210_converge_hippo_commandes_schema.sql');
const deploymentDoc = read('docs/DEPLOIEMENT.md');

const roles = [
  'super_admin',
  'global_admin',
  'director',
  'manager_plus',
  'manager',
  'commande',
];

for (const role of roles) {
  assert.match(permissions, new RegExp(`['"]${role}['"]`));
  assert.match(serverPermissions, new RegExp(`['"]${role}['"]`));
  assert.match(`${baseline}\n${convergence}`, new RegExp(`'${role}'`));
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
  'Les comptes protégés et super-admin doivent rester bloqués'
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
assert.match(serverPermissions, /target\.role === 'super_admin'/);

assert.match(userManagementPage, /\/api\/admin\/users\/create/);
assert.match(userManagementPage, /\/api\/admin\/users\/update/);
assert.match(userUpdateRoute, /canManageTarget\(auth\.profile, target\)/);
assert.match(
  userUpdateRoute,
  /supabaseAdmin[\s\S]*\.from\('profiles'\)[\s\S]*\.update/,
  'Les profils doivent rester modifiés avec le client serveur'
);

for (const table of ['profiles', 'user_site_access', 'app_state', 'order_line_states']) {
  assert.match(
    baseline,
    new RegExp(`alter table public\\.${table} force row level security`, 'i'),
    `RLS doit rester forcée sur ${table}`
  );
  assert.match(
    baseline,
    new RegExp(`revoke all on table public\\.${table} from anon`, 'i'),
    `anon doit rester révoqué sur ${table}`
  );
}

assert.match(
  baseline,
  /create policy profiles_select_own[\s\S]*using \(id = \(select auth\.uid\(\)\)\)/i,
  'Le frontend doit seulement lire son propre profil'
);
assert.match(
  baseline,
  /create policy user_site_access_select_own[\s\S]*using \(user_id = \(select auth\.uid\(\)\)\)/i,
  'Le frontend doit seulement lire ses propres affectations'
);
assert.match(baseline, /grant select on table public\.profiles to authenticated/i);
assert.match(baseline, /grant select on table public\.user_site_access to authenticated/i);
assert.doesNotMatch(
  baseline,
  /grant[^;]*(insert|update|delete)[^;]*public\.(profiles|user_site_access)[^;]*to authenticated/i,
  'Le frontend ne doit pas écrire directement les comptes ou leurs sites'
);
assert.match(
  baseline,
  /function private\.can_access_app_state_site[\s\S]*security definer[\s\S]*set search_path = ''/i,
  'Le helper RLS doit rester privé et déterministe sur son search_path'
);
assert.match(
  convergence,
  /drop function if exists public\.can_access_app_state_site\(text\)/i,
  'La fonction SECURITY DEFINER historique ne doit pas rester exposée dans public'
);

assert.match(
  deploymentDoc,
  /Ne pas toucher a Supabase production pendant les tests staging/i,
  'La documentation doit interdire les essais sur Supabase production'
);

console.log(
  'Contrat sécurité OK : hiérarchie serveur, RLS privée, privilèges minimaux et isolation des écritures protégés.'
);
