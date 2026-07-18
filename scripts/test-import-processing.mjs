import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const processingPath = join(root, 'src', 'utils', 'importProcessing.ts');
const spreadsheetPath = join(root, 'src', 'utils', 'spreadsheetImportWorker.ts');
const processingSource = readFileSync(processingPath, 'utf8');
const spreadsheetSource = readFileSync(spreadsheetPath, 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-import-processing-'));

const compile = (source, fileName) => {
  const result = ts.transpileModule(source, {
    fileName,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
    },
  });
  assert.equal(
    result.diagnostics?.length ?? 0,
    0,
    (result.diagnostics ?? [])
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
      .join('\n'),
  );
  return result.outputText;
};

const createWorkerFactory = (behavior) => {
  const workers = [];
  const factory = () => {
    const worker = {
      onmessage: null,
      onerror: null,
      terminated: false,
      postMessage(message) {
        behavior(worker, message);
      },
      terminate() {
        worker.terminated = true;
      },
    };
    workers.push(worker);
    return worker;
  };
  return { factory, workers };
};

try {
  writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8');
  writeFileSync(join(tempDir, 'importProcessing.mjs'), compile(processingSource, processingPath), 'utf8');
  const compiledSpreadsheet = compile(spreadsheetSource, spreadsheetPath)
    .replace("'./importProcessing'", "'./importProcessing.mjs'");
  writeFileSync(join(tempDir, 'spreadsheetImportWorker.mjs'), compiledSpreadsheet, 'utf8');

  const processing = await import(pathToFileURL(join(tempDir, 'importProcessing.mjs')).href);
  const spreadsheet = await import(pathToFileURL(join(tempDir, 'spreadsheetImportWorker.mjs')).href);

  let timeoutCleanupCount = 0;
  await assert.rejects(
    () => processing.withImportTimeout(
      new Promise(() => undefined),
      5,
      'Délai test dépassé.',
      () => { timeoutCleanupCount += 1; },
    ),
    (error) => error.code === 'timeout' && error.message === 'Délai test dépassé.',
  );
  assert.equal(timeoutCleanupCount, 1);

  const success = createWorkerFactory((worker) => {
    queueMicrotask(() => worker.onmessage?.({ data: { ok: true, result: 'csv-result' } }));
  });
  assert.equal(await spreadsheet.runSpreadsheetImportWorker(
    'to-csv',
    new ArrayBuffer(8),
    { workerFactory: success.factory, timeoutMs: 50 },
  ), 'csv-result');
  assert.equal(success.workers[0].terminated, true, 'Le Worker doit être terminé après succès');

  const failure = createWorkerFactory((worker) => {
    queueMicrotask(() => worker.onmessage?.({ data: { ok: false } }));
  });
  await assert.rejects(
    () => spreadsheet.runSpreadsheetImportWorker(
      'margin-catalog',
      new ArrayBuffer(8),
      { workerFactory: failure.factory, timeoutMs: 50 },
    ),
    (error) => error.code === 'processing_failed',
  );
  assert.equal(failure.workers[0].terminated, true, 'Le Worker doit être terminé après erreur');

  const timedOut = createWorkerFactory(() => undefined);
  await assert.rejects(
    () => spreadsheet.runSpreadsheetImportWorker(
      'to-csv',
      new ArrayBuffer(8),
      { workerFactory: timedOut.factory, timeoutMs: 5 },
    ),
    (error) => error.code === 'timeout',
  );
  assert.equal(timedOut.workers[0].terminated, true, 'Le Worker doit être terminé après timeout');

  const controller = new AbortController();
  const cancelled = createWorkerFactory(() => undefined);
  const cancelledTask = spreadsheet.runSpreadsheetImportWorker(
    'to-csv',
    new ArrayBuffer(8),
    { workerFactory: cancelled.factory, timeoutMs: 100, signal: controller.signal },
  );
  controller.abort();
  await assert.rejects(() => cancelledTask, (error) => error.code === 'cancelled');
  assert.equal(cancelled.workers[0].terminated, true, 'Le Worker doit être terminé après annulation');

  assert.equal(
    processing.toSafeImportErrorMessage(new Error('détail interne'), 'Message public'),
    'Message public',
  );

  const csvSource = readFileSync(join(root, 'src', 'utils', 'csvHelpers.ts'), 'utf8');
  const workerSource = readFileSync(join(root, 'src', 'workers', 'spreadsheetImport.worker.ts'), 'utf8');
  const takeRateSource = readFileSync(join(root, 'src', 'pages', 'TakeRatePage.tsx'), 'utf8');
  const pdfSource = readFileSync(join(root, 'src', 'pages', 'OrderTemplatePage.tsx'), 'utf8');

  assert.match(csvSource, /worker:\s*true/, 'PapaParse doit traiter le CSV hors du thread principal');
  assert.match(csvSource, /readSpreadsheetAsCsv\(file\)/, 'Les classeurs mensuels doivent passer par le Worker');
  assert.match(workerSource, /XLSX\.read\(buffer/, 'Le parsing XLSX doit vivre dans le Worker');
  assert.match(takeRateSource, /buildMarginCatalogInWorker\(file, controller\.signal\)/);
  assert.match(pdfSource, /IMPORT_PROCESSING_TIMEOUTS\.pdfProcessing/);
  assert.match(pdfSource, /await pdf\.destroy\(\)/);
  assert.match(pdfSource, /await terminateWorker\(\)/);

  console.log('Robustesse imports OK : Workers, timeout, annulation, nettoyage et erreurs publiques protégés.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
