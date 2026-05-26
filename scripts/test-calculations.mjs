import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const sourcePath = join(process.cwd(), 'src', 'utils', 'calculations.ts');
const rawSource = readFileSync(sourcePath, 'utf8');
const source = rawSource.replace("import { Calculations } from '../types';\n", '');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-calculations-'));

try {
  const { outputText } = ts.transpileModule(source, {
    fileName: sourcePath,
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
      isolatedModules: false,
    },
  });

  const compiledPath = join(tempDir, 'calculations.mjs');
  writeFileSync(compiledPath, outputText, 'utf8');

  const {
    toNumber,
    calculateOrder,
    calculateTargetOrder,
  } = await import(pathToFileURL(compiledPath).href);

  assert.equal(toNumber(''), 0, 'Une saisie vide doit valoir 0 pour les calculs');
  assert.equal(toNumber(undefined), 0, 'Une valeur undefined doit valoir 0 pour les calculs');
  assert.equal(toNumber(null), 0, 'Une valeur null doit valoir 0 pour les calculs');
  assert.equal(toNumber(12.5), 12.5, 'Un nombre valide doit rester inchangé');

  assert.deepEqual(
    calculateOrder(120, 20, 55, 10, 12),
    {
      net: 45,
      needWithMargin: 50,
      realNeed: 60,
      toOrder: 5,
    },
    'Commande classique : besoin net, marge de sécurité et arrondi colisage doivent rester stables'
  );

  assert.deepEqual(
    calculateOrder(20, 5, 30, 10, 6),
    {
      net: 0,
      needWithMargin: 0,
      realNeed: 0,
      toOrder: 0,
    },
    'Si stock + livraison couvrent le besoin, aucune commande ne doit être proposée'
  );

  assert.deepEqual(
    calculateOrder(20, 0, 0, 0, ''),
    {
      net: 20,
      needWithMargin: 20,
      realNeed: 0,
      toOrder: 0,
    },
    'Sans colisage renseigné, le besoin est conservé mais aucune commande automatique ne doit sortir'
  );

  assert.deepEqual(
    calculateTargetOrder(48, '', 10, 12),
    {
      projectedStock: 0,
      missing: 0,
      toOrder: 0,
    },
    'Mode stock cible : un stock courant vide bloque le calcul pour éviter une commande fausse'
  );

  assert.deepEqual(
    calculateTargetOrder(48, 35, 10, 12),
    {
      projectedStock: 25,
      missing: 23,
      toOrder: 2,
    },
    'Mode stock cible normal : atteindre le stock cible avec arrondi au colisage'
  );

  assert.deepEqual(
    calculateTargetOrder(48, 8, 10, 12),
    {
      projectedStock: 0,
      missing: 48,
      toOrder: 5,
    },
    'Mode stock cible critique : rupture prévue, bonus maximum cible + 1 colis'
  );

  assert.deepEqual(
    calculateTargetOrder(48, 0, 100, 12),
    {
      projectedStock: 0,
      missing: 48,
      toOrder: 5,
    },
    'Mode stock cible critique : ne jamais dépasser le plafond cible + 1 colis même avec forte consommation'
  );

  console.log('Calculs commande OK : marge, stock cible, champs vides, rupture prévue et plafonds protégés.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
