import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const sourcePath = join(root, 'src', 'utils', 'columnMapping.ts');
const source = readFileSync(sourcePath, 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-column-mapping-'));

try {
  const { outputText, diagnostics = [] } = ts.transpileModule(source, {
    fileName: sourcePath,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
  });
  assert.equal(
    diagnostics.length,
    0,
    diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')).join('\n'),
  );
  assert.doesNotMatch(source, /^import /m, 'Le module doit rester pur et sans dépendance');
  assert.doesNotMatch(source, /\bany\b/, 'Aucun any');

  const compiledPath = join(tempDir, 'columnMapping.mjs');
  writeFileSync(compiledPath, outputText, 'utf8');
  const { mapColumnsToReferenceColumns: map } = await import(pathToFileURL(compiledPath).href);

  // Colonnes d'une page de référence à partir de ses traits verticaux
  const columnsOf = (edges) => edges.slice(0, -1).map((xStart, index) => ({ index, xStart, xEnd: edges[index + 1] }));

  // Relevés réels : six premiers traits verticaux (donc cinq colonnes ici),
  // les largeurs changent d'une page d'en-tête à l'autre, pas la structure.
  const viandeP1 = [102, 273, 713, 807, 911, 1126];
  const viandeP3 = [102, 278, 744, 841, 911, 1126];
  const surgelP1 = [102, 278, 744, 841, 911, 1126];
  const surgelP5 = [102, 271, 722, 818, 911, 1126];
  const episaveursP1 = [102, 269, 713, 807, 911, 1126];
  const episaveursP5 = [102, 273, 731, 825, 911, 1126];

  assert.deepEqual(map(viandeP3, columnsOf(viandeP1)), [0, 1, 2, 3, 4],
    'Domafrais viande/BOF : les traits de la page 3 se sont déplacés de 44 px, les colonnes restent les mêmes');
  assert.deepEqual(map(surgelP5, columnsOf(surgelP1)), [0, 1, 2, 3, 4], 'Domafrais surgelé : identité');
  assert.deepEqual(map(episaveursP5, columnsOf(episaveursP1)), [0, 1, 2, 3, 4], 'Épisaveurs : identité');
  assert.deepEqual(map(surgelP1, columnsOf(viandeP1)), [0, 1, 2, 3, 4], 'Une page d’un autre PDF de même structure est associée par rang');

  // Même nombre de colonnes : le rang prime, même si les positions ne se recouvrent plus
  assert.deepEqual(map([102, 400, 500, 600, 700, 800], columnsOf(viandeP1)), [0, 1, 2, 3, 4]);

  // Nombre de colonnes différent : recouvrement d'au moins la moitié de la plus petite colonne
  const reference = columnsOf(viandeP1);
  assert.deepEqual(
    map([102, 273, 807, 911, 1126], reference),
    [0, 1, 3, 4],
    'Page à 4 colonnes contre une référence à 5 : les colonnes qui se recouvrent sont associées',
  );
  assert.deepEqual(
    map([102, 273, 713, 1300, 1400], reference),
    [0, 1, 4, -1],
    'Une colonne sans recouvrement vaut -1',
  );
  assert.deepEqual(map([5000, 5100, 5200], reference), [-1, -1], 'Aucune colonne ne correspond');
  assert.deepEqual(
    map([102, 260, 273, 713, 807, 911, 1126], reference),
    [0, 0, 1, 2, 3, 4],
    'Une colonne étroite incluse dans une colonne de la référence s’y rattache',
  );
  assert.deepEqual(
    map([90, 150, 400, 500], [{ index: 0, xStart: 0, xEnd: 100 }, { index: 1, xStart: 200, xEnd: 300 }]),
    [-1, 1, -1],
    'Un recouvrement inférieur à la moitié de la plus petite colonne n’associe rien',
  );

  // Page à plus de colonnes que la référence
  assert.deepEqual(map([102, 273, 400, 713, 807, 911, 1126], reference), [0, 1, 1, 2, 3, 4],
    'Deux colonnes de la page peuvent se rattacher à une même colonne de la référence');

  // Références vides
  assert.deepEqual(map([], []), []);
  assert.deepEqual(map([0, 100, 200], []), [-1, -1]);
  assert.deepEqual(map([], columnsOf(viandeP1)), []);
  assert.deepEqual(map([100], columnsOf(viandeP1)), []);

  // Branchement dans la lecture des pages
  const rasterScan = readFileSync(join(root, 'src', 'utils', 'orderTemplateRasterScan.ts'), 'utf8');
  assert.match(rasterScan, /mapColumnsToReferenceColumns\(structure\.columnEdges, reference\.columns\)/);
  assert.doesNotMatch(rasterScan, /COLUMN_MATCH_TOLERANCE/, 'Plus de tolérance fixe de position entre pages');
  assert.match(rasterScan, /unmatchedPages/, 'Les pages aux colonnes non reconnues sont renvoyées');
  const pageSource = readFileSync(join(root, 'src', 'pages', 'OrderTemplatePage.tsx'), 'utf8');
  assert.match(pageSource, /colonnes non reconnues, lignes à vérifier/, 'Le rapport signale les pages aux colonnes non reconnues');
  assert.match(pageSource, /importWithRoles\(pending, roles, result\.unmatchedPages\)/);

  console.log('Association des colonnes OK : largeurs variables entre pages, recouvrement, références vides et pages non reconnues protégés.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
