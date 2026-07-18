import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const modelPath = join(root, 'api', '_lib', 'aiAssistantSecurity.ts');
const endpointPath = join(root, 'api', 'ai-assistant.ts');
const authPath = join(root, 'api', '_lib', 'auth.ts');
const drawerPath = join(root, 'src', 'components', 'AiAssistantDrawer.tsx');
const source = readFileSync(modelPath, 'utf8');
const endpointSource = readFileSync(endpointPath, 'utf8');
const authSource = readFileSync(authPath, 'utf8');
const drawerSource = readFileSync(drawerPath, 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-ai-assistant-security-'));

try {
  const { outputText, diagnostics = [] } = ts.transpileModule(source, {
    fileName: modelPath,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
    },
  });
  assert.equal(
    diagnostics.length,
    0,
    diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')).join('\n'),
  );

  const compiledPath = join(tempDir, 'aiAssistantSecurity.mjs');
  writeFileSync(compiledPath, outputText, 'utf8');
  const security = await import(pathToFileURL(compiledPath).href);

  const endpointDiagnostics = ts.transpileModule(endpointSource, {
    fileName: endpointPath,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
    },
  }).diagnostics ?? [];
  assert.equal(
    endpointDiagnostics.length,
    0,
    endpointDiagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')).join('\n'),
  );

  const authCompilation = ts.transpileModule(authSource, {
    fileName: authPath,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
    },
  });
  assert.equal(
    authCompilation.diagnostics?.length ?? 0,
    0,
    (authCompilation.diagnostics ?? [])
      .map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
      .join('\n'),
  );
  writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8');
  writeFileSync(join(tempDir, 'auth.js'), authCompilation.outputText, 'utf8');
  writeFileSync(join(tempDir, 'permissions.js'), 'export const canAccessUserManagement = () => true;\n', 'utf8');
  writeFileSync(
    join(tempDir, 'sites.js'),
    'export const loadSiteIdsByUser = async () => new Map();\nexport const siteIdsForProfile = () => [];\n',
    'utf8',
  );
  writeFileSync(join(tempDir, 'supabaseAdmin.js'), 'export const supabaseAdmin = {};\n', 'utf8');
  const activeUserAuth = await import(pathToFileURL(join(tempDir, 'auth.js')).href);

  const createAuthClient = ({ user = { id: 'user-1' }, authError = null, profile = null, profileError = null } = {}) => ({
    auth: {
      getUser: async () => ({ data: { user }, error: authError }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: profile, error: profileError }),
        }),
      }),
    }),
  });

  assert.deepEqual(await activeUserAuth.requireActiveUser({ headers: {} }, createAuthClient()), {
    ok: false, status: 401, error: 'Token Bearer manquant.',
  });
  assert.deepEqual(await activeUserAuth.requireActiveUser(
    { headers: { authorization: 'Bearer invalide' } },
    createAuthClient({ user: null, authError: new Error('invalid') }),
  ), { ok: false, status: 401, error: 'Session invalide ou expirée.' });
  assert.deepEqual(await activeUserAuth.requireActiveUser(
    { headers: { authorization: 'Bearer valide' } },
    createAuthClient({ profile: null, profileError: new Error('missing') }),
  ), { ok: false, status: 403, error: 'Profil introuvable pour cet utilisateur.' });
  assert.deepEqual(await activeUserAuth.requireActiveUser(
    { headers: { authorization: 'Bearer valide' } },
    createAuthClient({ profile: { id: 'user-1', role: 'manager', is_active: false } }),
  ), { ok: false, status: 403, error: 'Compte utilisateur inactif.' });
  assert.deepEqual(await activeUserAuth.requireActiveUser(
    { headers: { authorization: 'Bearer valide' } },
    createAuthClient({ profile: { id: 'user-1', role: 'manager', is_active: true } }),
  ), {
    ok: true,
    user: { id: 'user-1' },
    profile: { id: 'user-1', role: 'manager', is_active: true },
  });

  const limiter = security.createFixedWindowRateLimiter(2, 1_000);
  assert.deepEqual(limiter.consume('user-1', 1_000), {
    allowed: true, remaining: 1, resetAt: 2_000, retryAfterSeconds: 0,
  });
  assert.deepEqual(limiter.consume('user-1', 1_100), {
    allowed: true, remaining: 0, resetAt: 2_000, retryAfterSeconds: 0,
  });
  assert.deepEqual(limiter.consume('user-1', 1_200), {
    allowed: false, remaining: 0, resetAt: 2_000, retryAfterSeconds: 1,
  });
  assert.equal(limiter.consume('user-2', 1_200).allowed, true, 'Le quota doit être isolé par utilisateur');
  assert.equal(limiter.consume('user-1', 2_000).allowed, true, 'Le quota doit se rouvrir après la fenêtre');

  assert.equal(security.readRequestContentLength({ headers: { 'content-length': '32001' } }), 32001);
  assert.equal(security.readRequestContentLength({ headers: { 'content-length': 'invalide' } }), null);

  assert.match(authSource, /export const requireActiveUser/,
    'Une authentification commune des utilisateurs actifs doit exister');
  assert.match(authSource, /if \(!profile\.is_active\)/,
    'Un profil inactif doit être refusé côté serveur');
  assert.match(endpointSource, /await requireActiveUser\(req\)/,
    'L endpoint IA doit vérifier la session Supabase');
  assert.match(endpointSource, /consumeAiAssistantRateLimit\(auth\.user\.id\)/,
    'Le quota doit être appliqué à l utilisateur authentifié');
  assert.match(endpointSource, /status\s*:\s*429|sendJson\(res, 429/,
    'Le dépassement de quota doit répondre 429');
  assert.match(endpointSource, /controller\.abort\(\)/,
    'L appel OpenAI doit posséder un délai maximal');
  assert.match(drawerSource, /Authorization: `Bearer \$\{accessToken\}`/,
    'Le frontend doit transmettre le jeton de session');

  console.log('Sécurité assistant IA OK : session, profil actif, quota, taille et timeout protégés.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
