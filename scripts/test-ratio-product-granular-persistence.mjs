import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const modelPath = join(root, 'src', 'hooks', 'ratioProductPersistenceModel.ts');
const persistencePath = join(root, 'src', 'hooks', 'useAppStatePersistence.ts');
const rawModelSource = readFileSync(modelPath, 'utf8');
const persistenceSource = readFileSync(persistencePath, 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-ratio-product-persistence-'));

try {
  const { outputText, diagnostics = [] } = ts.transpileModule(rawModelSource, {
    fileName: modelPath,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
      isolatedModules: false,
    },
  });

  assert.equal(
    diagnostics.length,
    0,
    diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')).join('\n'),
  );

  const compiledPath = join(tempDir, 'ratioProductPersistenceModel.mjs');
  writeFileSync(compiledPath, outputText, 'utf8');
  const model = await import(pathToFileURL(compiledPath).href);

  const product = (id, name) => ({
    id,
    supplierId: 'domafrais_surgele',
    name,
    searchName: name,
    packaging: 1,
    defaultMargin: 0,
    salesHistory: {},
  });

  const legacyA = product('a', 'Abricot');
  const legacyB = product('b', 'Boeuf');
  const updatedA = { ...legacyA, searchName: 'Abricot exact' };
  const newC = product('custom:é/3', 'Carpaccio');
  const orphanD = product('d', 'Datte');
  const legacyOnlyE = product('e', 'Endive supprimée');
  const cKey = model.getRatioProductStateKey(newC.id);

  assert.equal(model.getRatioProductIdFromStateKey(cKey), newC.id,
    'La clé doit conserver même les identifiants spéciaux');
  assert.equal(model.getRatioProductIdFromStateKey('covers'), null);

  const merged = model.mergeGranularRatioProducts({
    products: [legacyA, legacyB, legacyOnlyE],
    [model.getRatioProductStateKey('a')]: updatedA,
    [model.getRatioProductStateKey('b')]: model.createRatioProductTombstone('b'),
    [cKey]: newC,
    [model.getRatioProductStateKey('d')]: orphanD,
    [model.RATIO_PRODUCT_ORDER_KEY]: [newC.id, 'a'],
  });

  assert.deepEqual(merged.map(item => item.id), [newC.id, 'a', 'd'],
    'L’ordre granulaire doit être respecté et une ligne isolée récupérée sans perte');
  assert.equal(merged[1].searchName, 'Abricot exact',
    'La ligne granulaire doit remplacer uniquement sa copie historique');
  assert.equal(merged.some(item => item.id === 'b'), false,
    'Une suppression granulaire doit masquer la copie de l’ancien bloc');
  assert.equal(merged.some(item => item.id === 'e'), false,
    'La liste d’ordre moderne ne doit pas ressusciter une ancienne fiche supprimée');

  assert.deepEqual(
    model.mergeGranularRatioProducts({ products: [legacyA, legacyB] }),
    [legacyA, legacyB],
    'L’ancien bloc doit rester entièrement compatible tant qu’aucune ligne granulaire n’existe',
  );

  assert.doesNotMatch(persistenceSource, /persistAppState\('products'/,
    'Le catalogue complet ne doit plus être sauvegardé après une modification');
  assert.match(persistenceSource, /getRatioProductStateKey\(product\.id\)/,
    'Une modification doit cibler la clé du seul produit concerné');
  assert.match(persistenceSource, /createRatioProductTombstone\(productId\)/,
    'Une suppression doit rester persistante sans réécrire le catalogue');
  assert.match(persistenceSource, /persistAppState\(RATIO_PRODUCT_ORDER_KEY, currentOrder/,
    'Le glisser-déposer doit sauvegarder seulement la petite liste d’ordre');

  console.log('Persistance vente ratio OK : une ligne par produit, ordre séparé et ancien bloc compatible.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
