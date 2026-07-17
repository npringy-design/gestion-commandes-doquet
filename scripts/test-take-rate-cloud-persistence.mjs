import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const modelPath = join(root, 'src', 'utils', 'takeRateCloudPersistenceModel.ts');
const hookPath = join(root, 'src', 'hooks', 'useTakeRateCloudPersistence.ts');
const pagePath = join(root, 'src', 'pages', 'TakeRatePage.tsx');
const modelSource = readFileSync(modelPath, 'utf8');
const hookSource = readFileSync(hookPath, 'utf8');
const pageSource = readFileSync(pagePath, 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-take-rate-persistence-'));

try {
  const { outputText, diagnostics = [] } = ts.transpileModule(modelSource, {
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

  const compiledPath = join(tempDir, 'takeRateCloudPersistenceModel.mjs');
  writeFileSync(compiledPath, outputText, 'utf8');
  const model = await import(pathToFileURL(compiledPath).href);

  const cloudTimestamps = { takeRateBaseRows: '2026-07-17T10:00:00.000Z' };
  let scheduled;
  const fakeSchedule = (...args) => { scheduled = args; };
  const value = [{ id: 'p1', label: 'Burger' }];
  model.scheduleTakeRateCloudSave(
    fakeSchedule,
    cloudTimestamps,
    'takeRateBaseRows',
    value,
    '2026-07-17T11:00:00.000Z',
  );

  assert.equal(scheduled[0], 'takeRateBaseRows');
  assert.equal(scheduled[1], value);
  assert.equal(scheduled[2], '2026-07-17T11:00:00.000Z');
  assert.equal(scheduled[3]('takeRateBaseRows'), '2026-07-17T10:00:00.000Z',
    'Le contrôle LWW doit relire le timestamp cloud de la clé');
  assert.equal(scheduled[5], 2500, 'Le délai historique de sauvegarde doit rester à 2,5 secondes');
  scheduled[4]('takeRateBaseRows', '2026-07-17T11:00:00.000Z');
  assert.equal(cloudTimestamps.takeRateBaseRows, '2026-07-17T11:00:00.000Z',
    'La confirmation réelle doit avancer le curseur cloud');

  model.registerTakeRateCloudTimestamps(cloudTimestamps, {
    takeRateFrozenMonths: '2026-07-17T12:00:00.000Z',
  });
  assert.equal(cloudTimestamps.takeRateFrozenMonths, '2026-07-17T12:00:00.000Z');

  for (const key of [
    'TAKE_RATE_BASE_ROWS_CLOUD_KEY',
    'TAKE_RATE_MARGIN_CATALOG_CLOUD_KEY',
    'TAKE_RATE_MARGIN_FILE_NAME_CLOUD_KEY',
    'TAKE_RATE_FROZEN_CLOUD_KEY',
  ]) {
    assert.match(hookSource, new RegExp(key), `La persistance doit conserver la clé ${key}`);
  }
  assert.match(hookSource, /const localTs = new Date\(\)\.toISOString\(\);[\s\S]*?MARGIN_CATALOG[\s\S]*?MARGIN_FILE_NAME/,
    'Le catalogue et son nom de fichier doivent partager le même timestamp');
  assert.match(pageSource, /useTakeRateCloudPersistence\(\)/,
    'La page doit déléguer ses sauvegardes au hook dédié');
  assert.doesNotMatch(pageSource, /saveToSupabaseDebounced|cloudTsRef|persistTakeRateCollection/,
    'La page ne doit plus gérer directement le délai ou les timestamps cloud');

  console.log('Persistance Taux de prise OK : quatre clés, délai, LWW, confirmation et délégation protégés.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
