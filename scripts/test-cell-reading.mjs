import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const sourcePath = join(root, 'src', 'utils', 'cellReading.ts');
const source = readFileSync(sourcePath, 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-cell-reading-'));

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

  const compiledPath = join(tempDir, 'cellReading.mjs');
  writeFileSync(compiledPath, outputText, 'utf8');
  const { normalizeReading: n, voteReadings: v, reviewCell: r, hasUnreadableSymbol: s } = await import(pathToFileURL(compiledPath).href);

  // --- Réparation typographique limitée aux mesures --------------------------
  assert.equal(n('Crème sucrée pièce 700 mi DEBIC'), 'Crème sucrée pièce 700 ml DEBIC');
  assert.equal(n('bidon 100 ci OVIPAC'), 'bidon 100 cl OVIPAC');
  assert.equal(n('Nids 27-37q pièces'), 'Nids 27-37 g pièces');
  assert.equal(n('Magret (env. 250/350qg) pièce'), 'Magret (env. 250/350qg) pièce');
  assert.equal(n('auL'), 'au L');
  assert.equal(n('au Kg'), 'au Kg');
  assert.equal(n('aukg'), 'au Kg');
  assert.equal(n('Mini mixeur mi-cuit'), 'Mini mixeur mi-cuit');
  assert.equal(n('Lait 2 mi'), 'Lait 2 ml');

  // Un mot de libellé n'est jamais modifié ; seuls les espaces sont compactés
  assert.equal(n('  Steak \n  haché   100 g '), 'Steak haché 100 g');
  assert.equal(n('ka'), 'ka', 'Une unité inconnue reste telle quelle');
  assert.equal(n('Ke'), 'Ke');
  assert.equal(n('Mimi 3 mini'), 'Mimi 3 mini', 'Seule une mesure isolée après un nombre est réparée');

  // --- Vote entre lectures -----------------------------------------------------
  assert.deepEqual(v(['sac', 'Sac', 'sac', 'sac']), { text: 'sac', agreed: true });
  assert.deepEqual(v(['700 mi', '700 ml']), { text: '700 ml', agreed: true });
  assert.equal(v(['Sorbet 2,4 L', 'Sorbet 2.4 L']).agreed, false);
  assert.equal(v(['Sorbet 2,4 L', 'Sorbet 2.4 L', 'Sorbet 2,4 L', 'Sorbet 2.4 L']).agreed, false);
  assert.equal(v(['Cacahuèëtes', 'Cacahuëètes', 'Cacahuètes', 'Cacahuètes']).text, 'Cacahuètes');
  assert.equal(v(['Cacahuèëtes', 'Cacahuëètes', 'Cacahuètes', 'Cacahuètes']).agreed, true);
  assert.equal(v(['seul']).agreed, true);
  assert.equal(v([]).text, '');
  assert.equal(v([]).agreed, false);
  assert.equal(v(['', '  ']).text, '', 'Des lectures vides ne donnent aucun texte');
  assert.deepEqual(v(['sac', 'sac', 'colis']), { text: 'sac', agreed: true }, '2 contre 1 : accord');
  assert.deepEqual(v(['a1', 'b2']), { text: 'a1', agreed: false }, 'Égalité : la première lecture, sans accord');

  // --- Symboles illisibles -----------------------------------------------------
  assert.equal(s('Pancake @11.5 cm'), true);
  assert.equal(s('à | unité'), true);
  assert.equal(s("Filet d'ÉLEVEURS (180/210) 5x180g - 20%"), false);
  assert.equal(s('Crème brûlée à la vanille Bourbon'), false);
  assert.equal(s('Œufs 90 pièces'), false);
  assert.equal(s('Piment d’Espelette AOP'), false);
  assert.equal(s(''), false);

  // --- Signalement -------------------------------------------------------------
  assert.deepEqual(r({ text: 'à | unité', agreed: true }), ['symbole illisible']);
  assert.deepEqual(r({ text: 'Sorbet 2,4 L', agreed: false }), ['lectures divergentes']);
  assert.deepEqual(r({ text: 'Pancake @11.5', agreed: false }), ['lectures divergentes', 'symbole illisible']);
  assert.deepEqual(r({ text: 'Steak haché', agreed: true }), []);

  console.log('Lecture de cellule OK : réparation des mesures, vote entre lectures et signalement des doutes protégés.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
