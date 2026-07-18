import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const modelPath = join(root, 'src', 'utils', 'importFileValidation.ts');
const source = readFileSync(modelPath, 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-import-validation-'));

const toBytes = (value) => typeof value === 'string'
  ? new TextEncoder().encode(value)
  : Uint8Array.from(value);

const createFile = (name, content, options = {}) => {
  const bytes = toBytes(content);
  const declaredSize = options.size ?? bytes.length;
  const sliceBytes = (start = 0, end = bytes.length) => bytes.slice(start, Math.min(end, bytes.length));

  return {
    name,
    size: declaredSize,
    type: options.type ?? '',
    slice: (start, end) => ({
      arrayBuffer: async () => {
        const sliced = sliceBytes(start, end);
        return sliced.buffer.slice(sliced.byteOffset, sliced.byteOffset + sliced.byteLength);
      },
    }),
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
};

try {
  const compilation = ts.transpileModule(source, {
    fileName: modelPath,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
    },
  });
  assert.equal(
    compilation.diagnostics?.length ?? 0,
    0,
    (compilation.diagnostics ?? [])
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
      .join('\n'),
  );

  const compiledPath = join(tempDir, 'importFileValidation.mjs');
  writeFileSync(compiledPath, compilation.outputText, 'utf8');
  const validation = await import(pathToFileURL(compiledPath).href);

  const validPdf = createFile('commande.pdf', 'préfixe\n%PDF-1.7\ncontenu');
  assert.equal((await validation.validateImportFile(validPdf, 'order-template-pdf')).format, 'pdf');

  const xlsxBytes = Uint8Array.from([
    0x50, 0x4b, 0x03, 0x04,
    ...new TextEncoder().encode('[Content_Types].xml xl/workbook.xml'),
  ]);
  assert.equal(
    (await validation.validateImportFile(createFile('marge.xlsx', xlsxBytes), 'margin-workbook')).format,
    'xlsx',
  );

  const xlsBytes = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00];
  assert.equal(
    (await validation.validateImportFile(createFile('inventaire.xls', xlsBytes), 'tabular')).format,
    'xls',
  );

  assert.equal(
    (await validation.validateImportFile(createFile('production.csv', 'Produit;Quantité\nSteak;12'), 'tabular')).format,
    'text',
  );

  await assert.rejects(
    () => validation.validateImportFile(createFile('vide.csv', ''), 'tabular'),
    (error) => error.code === 'empty_file',
  );
  await assert.rejects(
    () => validation.validateImportFile(createFile('renomme.pdf', 'pas un pdf'), 'order-template-pdf'),
    (error) => error.code === 'invalid_signature',
  );
  await assert.rejects(
    () => validation.validateImportFile(createFile('archive.xlsx', [0x50, 0x4b, 0x03, 0x04, 0x01]), 'margin-workbook'),
    (error) => error.code === 'invalid_signature',
  );
  await assert.rejects(
    () => validation.validateImportFile(createFile('binaire.csv', [65, 0, 66]), 'tabular'),
    (error) => error.code === 'invalid_signature',
  );
  await assert.rejects(
    () => validation.validateImportFile(createFile('image.png', 'image'), 'tabular'),
    (error) => error.code === 'unsupported_extension',
  );
  await assert.rejects(
    () => validation.validateImportFile(
      createFile('lourd.pdf', '%PDF-1.7', { size: validation.IMPORT_FILE_LIMITS.pdf + 1 }),
      'order-template-pdf',
    ),
    (error) => error.code === 'file_too_large' && error.message.includes('20 Mo'),
  );

  const statsSource = readFileSync(join(root, 'src', 'pages', 'StatsPage.tsx'), 'utf8');
  const takeRateSource = readFileSync(join(root, 'src', 'pages', 'TakeRatePage.tsx'), 'utf8');
  const orderTemplateSource = readFileSync(join(root, 'src', 'pages', 'OrderTemplatePage.tsx'), 'utf8');

  assert.match(statsSource, /await validateImportFile\(file, 'tabular'\)[\s\S]*?readFileAsCSV\(file\)/);
  assert.match(takeRateSource, /await validateImportFile\(file, 'margin-workbook'\)[\s\S]*?buildMarginCatalogInWorker\(file, controller\.signal\)/);
  assert.match(orderTemplateSource, /await validateImportFile\(file, 'order-template-pdf'\)[\s\S]*?file\.arrayBuffer\(\)/);

  console.log('Validation imports OK : taille, extension, signatures PDF/Excel/texte et intégrations protégées.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
