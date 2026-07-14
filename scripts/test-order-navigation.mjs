import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const sourcePath = join(process.cwd(), 'src', 'utils', 'orderFieldNavigation.ts');
const source = readFileSync(sourcePath, 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-order-navigation-'));

try {
  const { outputText } = ts.transpileModule(source, {
    fileName: sourcePath,
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
    },
  });

  const compiledPath = join(tempDir, 'orderFieldNavigation.mjs');
  writeFileSync(compiledPath, outputText, 'utf8');
  const { buildColumnMajorTabIndexes } = await import(pathToFileURL(compiledPath).href);

  const largeTable = buildColumnMajorTabIndexes([150, 150, 150]);
  const flattened = largeTable.flat();

  assert.equal(flattened.length, 450, 'Les 450 champs doivent recevoir un ordre de navigation');
  assert.equal(new Set(flattened).size, 450, 'Aucun tabIndex ne doit être dupliqué, même au-delà de 100 produits');
  assert.deepEqual(largeTable[0].slice(0, 3), [1, 2, 3], 'La première colonne doit descendre ligne par ligne');
  assert.equal(largeTable[0][149], 150, 'La première colonne doit rester continue jusqu’à la ligne 150');
  assert.equal(largeTable[1][0], 151, 'La deuxième colonne doit commencer après la dernière ligne de la première');
  assert.equal(largeTable[2][149], 450, 'La dernière colonne doit terminer sans collision');

  assert.deepEqual(
    buildColumnMajorTabIndexes([2, 0, 3]),
    [[1, 2], [], [3, 4, 5]],
    'Une colonne masquée ou vide ne doit pas créer de trou dans la navigation'
  );

  assert.deepEqual(
    buildColumnMajorTabIndexes([2.9, -3, Number.NaN]),
    [[1, 2], [], []],
    'Les longueurs invalides doivent être neutralisées sans produire de tabIndex incohérent'
  );

  console.log('Navigation commande OK : ordre vertical stable, 150 lignes, colonnes vides et tabIndex uniques.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
