import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const sourcePath = join(root, 'src', 'utils', 'csvHelpers.ts');
const ratioPageSource = readFileSync(join(root, 'src', 'pages', 'RatiosPage.tsx'), 'utf8');
const tempDir = mkdtempSync(join(root, '.ratio-import-mapping-'));

try {
  const { outputText, diagnostics = [] } = ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
    fileName: sourcePath,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      verbatimModuleSyntax: false,
    },
  });
  assert.equal(
    diagnostics.length,
    0,
    diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')).join('\n'),
  );

  writeFileSync(
    join(tempDir, 'spreadsheetImportWorker.mjs'),
    'export const readSpreadsheetAsCsv = async () => "";\n',
    'utf8',
  );
  const compiledPath = join(tempDir, 'csvHelpers.mjs');
  writeFileSync(
    compiledPath,
    outputText.replace("'./spreadsheetImportWorker'", "'./spreadsheetImportWorker.mjs'"),
    'utf8',
  );

  const { getImportedValueForProduct } = await import(pathToFileURL(compiledPath).href);
  const inventoryCsv = [
    'Produit;Conso Théorique Qté',
    'Steak haché façon bouchère 15% VBF pièce 100 g;30,2',
    'Steak haché façon bouchère 20% pièce 140 G;108,64',
    'Steak Haché rond 20% VBF 210 G;64,47',
  ].join('\n');

  assert.equal(
    getImportedValueForProduct(
      inventoryCsv,
      'Steak haché façon bouchère 15% VBF pièce 100 g',
    ),
    30.2,
    'Une liaison exacte doit lire uniquement la ligne sélectionnée, sans additionner les variantes proches',
  );
  assert.equal(
    getImportedValueForProduct(
      inventoryCsv,
      'Steak haché façon bouchère 15% VBF pièce 100 g',
      0.1,
    ),
    302,
    'Le diviseur KG vers unités doit rester appliqué après la priorité exacte',
  );

  const zeroValueCsv = [
    'Produit;Conso Théorique Qté',
    'Campari bitter 100cl;0',
  ].join('\n');
  assert.equal(
    getImportedValueForProduct(zeroValueCsv, 'Campari bitter 100cl'),
    0,
    'Une ligne trouvée avec une quantité à zéro doit rester distincte d’une absence de liaison',
  );

  const approximateCsv = [
    'Produit;Conso Théorique Qté',
    'Sauce caramel au beurre salé;4,5',
  ].join('\n');
  assert.equal(
    getImportedValueForProduct(approximateCsv, 'Sauce caramel beurre'),
    4.5,
    'La recherche automatique par mots forts doit rester disponible sans libellé exact',
  );

  const parenthesizedVariantsCsv = [
    'Produit;Conso Théorique Qté',
    'Mix fromager (10 pièces);12',
    'Mix fromager (20 pièces);5',
  ].join('\n');
  assert.equal(
    getImportedValueForProduct(parenthesizedVariantsCsv, 'Mix fromager (10 pièces)'),
    12,
    'Le contenu des parenthèses doit rester distinct dans une liaison exacte',
  );

  assert.match(
    ratioPageSource,
    /type LinkState = 'linked' \| 'linkedZero' \| 'unlinked';/,
    'Calcul vente ratio doit conserver trois états de liaison distincts',
  );
  assert.match(
    ratioPageSource,
    /linkedZero:\s*\{[\s\S]*?border-l-\[#7C3AED\][\s\S]*?bg-\[#F5F0FF\][\s\S]*?bg-\[#7C3AED\]/,
    'L’état lié à zéro doit utiliser la palette violette sur la carte et le bouton',
  );
  assert.match(
    ratioPageSource,
    /if \(liveImportedValue === null\) return 'unlinked';\s*return Number\(liveImportedValue\) === 0 \? 'linkedZero' : 'linked';/,
    'La valeur zéro doit être liée, tandis que null reste le seul état non lié',
  );
  assert.match(
    ratioPageSource,
    /\) !== 'unlinked',/,
    'Le filtre et les compteurs doivent considérer le violet comme un produit lié',
  );

  console.log('Vente ratio OK : liaison exacte, valeur zéro violette et recherche automatique conservées.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
