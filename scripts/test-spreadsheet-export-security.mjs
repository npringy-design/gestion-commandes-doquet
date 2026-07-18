import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const utilityPath = join(root, 'src', 'utils', 'spreadsheetExportSecurity.ts');
const source = readFileSync(utilityPath, 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-spreadsheet-export-'));

const listSourceFiles = (directory) => readdirSync(directory).flatMap((entry) => {
  const path = join(directory, entry);
  return statSync(path).isDirectory()
    ? listSourceFiles(path)
    : ['.ts', '.tsx', '.js', '.jsx'].includes(extname(path)) ? [path] : [];
});

try {
  const compilation = ts.transpileModule(source, {
    fileName: utilityPath,
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

  writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8');
  writeFileSync(join(tempDir, 'spreadsheetExportSecurity.mjs'), compilation.outputText, 'utf8');
  const security = await import(pathToFileURL(join(tempDir, 'spreadsheetExportSecurity.mjs')).href);

  const dangerousValues = [
    '=2+2',
    '+SUM(1,1)',
    '-1+1',
    '@SUM(1,1)',
    '   =HYPERLINK("https://example.invalid")',
    '\n=2+2',
    '\r=2+2',
  ];
  dangerousValues.forEach((value) => {
    assert.equal(security.isPotentialSpreadsheetFormula(value), true);
    assert.equal(
      security.sanitizeSpreadsheetExportCell(value),
      `\t${value}`,
      `La valeur dangereuse doit devenir du texte : ${JSON.stringify(value)}`,
    );
  });

  const alreadyProtected = '\t=2+2';
  assert.equal(security.sanitizeSpreadsheetExportCell(alreadyProtected), alreadyProtected);

  const legitimateValues = ['Steak haché', 'Coca-Cola', 'Produit = spécial', '42', '', '   '];
  legitimateValues.forEach((value) => {
    assert.equal(security.isPotentialSpreadsheetFormula(value), false);
    assert.equal(security.sanitizeSpreadsheetExportCell(value), value);
  });
  assert.equal(security.sanitizeSpreadsheetExportCell(-42), -42);
  assert.equal(security.sanitizeSpreadsheetExportCell(0), 0);
  assert.equal(security.sanitizeSpreadsheetExportCell(true), true);
  assert.equal(security.sanitizeSpreadsheetExportCell(null), null);

  const originalRows = [['Produit', '=2+2'], ['Quantité', -12]];
  const protectedRows = security.sanitizeSpreadsheetExportRows(originalRows);
  assert.deepEqual(originalRows, [['Produit', '=2+2'], ['Quantité', -12]], 'Les données source ne doivent pas muter');
  assert.deepEqual(protectedRows, [['Produit', '\t=2+2'], ['Quantité', -12]]);

  const csv = security.serializeSafeSpreadsheetCsv([
    ['Libellé', 'Valeur'],
    ['=2+2', 'Texte avec "guillemets"'],
    ['Nombre', -12],
  ]);
  assert.equal(
    csv,
    '"Libellé";"Valeur"\r\n"\t=2+2";"Texte avec ""guillemets"""\r\n"Nombre";-12',
  );

  const directWriterPatterns = [
    /XLSX\.write(?:File)?\s*\(/,
    /writeFileXLSX\s*\(/,
    /(?:json|aoa)_to_sheet\s*\(/,
    /book_new\s*\(/,
    /text\/csv/i,
    /application\/vnd\.(?:ms-excel|openxmlformats-officedocument\.spreadsheetml\.sheet)/i,
    /URL\.createObjectURL\s*\(/,
    /new Blob\s*\(/,
    /\.download\s*=/,
    /setAttribute\(\s*['"]download['"]/,
    /saveAs\s*\(/,
  ];
  const unexpectedWriters = listSourceFiles(join(root, 'src'))
    .filter((path) => path !== utilityPath)
    .filter((path) => directWriterPatterns.some((pattern) => pattern.test(readFileSync(path, 'utf8'))));
  assert.deepEqual(
    unexpectedWriters,
    [],
    `Un export tableur direct contourne la protection centrale : ${unexpectedWriters.join(', ')}`,
  );

  console.log('Sécurité exports tableurs OK : formules neutralisées, valeurs légitimes préservées et aucun export direct non protégé.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
