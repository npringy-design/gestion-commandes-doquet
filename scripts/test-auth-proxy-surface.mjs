import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const root = process.cwd();
const removedProxy = join(root, 'api', 'auth', 'supabase.ts');
const runtimeExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);

const listRuntimeFiles = (directory) => {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listRuntimeFiles(path);
    return runtimeExtensions.has(extname(entry.name)) ? [path] : [];
  });
};

assert.equal(
  existsSync(removedProxy),
  false,
  'Le proxy Supabase auth générique ne doit pas être réintroduit.',
);

const runtimeFiles = [
  ...listRuntimeFiles(join(root, 'src')),
  ...listRuntimeFiles(join(root, 'api')),
];

const proxyCallers = runtimeFiles.filter((path) =>
  readFileSync(path, 'utf8').includes('/api/auth/supabase'),
);

assert.deepEqual(
  proxyCallers,
  [],
  'Aucun code applicatif ne doit dépendre du proxy Supabase auth supprimé.',
);

const loginSource = readFileSync(join(root, 'src', 'pages', 'LoginPage.tsx'), 'utf8');
assert.match(loginSource, /supabase\.auth\.signInWithPassword/);
assert.match(loginSource, /supabase\.auth\.resetPasswordForEmail/);

const resetSource = readFileSync(join(root, 'src', 'pages', 'ResetPasswordPage.tsx'), 'utf8');
assert.match(resetSource, /supabase\.auth\.exchangeCodeForSession/);
assert.match(resetSource, /supabase\.auth\.updateUser/);

assert.equal(
  existsSync(join(root, 'api', 'auth', 'complete-password-change.ts')),
  true,
  'La route serveur spécifique au changement de mot de passe doit rester disponible.',
);

console.log('✓ Surface du proxy Supabase auth verrouillée');
