import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const sourcePath = join(process.cwd(), 'src', 'utils', 'productOrder.ts');
const pageSource = readFileSync(join(process.cwd(), 'src', 'pages', 'RatiosPage.tsx'), 'utf8');
const source = readFileSync(sourcePath, 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-ratio-card-order-'));

try {
  const { outputText, diagnostics = [] } = ts.transpileModule(source, {
    fileName: sourcePath,
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

  const compiledPath = join(tempDir, 'productOrder.mjs');
  writeFileSync(compiledPath, outputText, 'utf8');
  const { reorderVisibleItems } = await import(pathToFileURL(compiledPath).href);

  const products = [
    { id: 'a', supplierId: 'surgeles' },
    { id: 'other-1', supplierId: 'autre' },
    { id: 'b', supplierId: 'surgeles' },
    { id: 'c', supplierId: 'surgeles' },
    { id: 'other-2', supplierId: 'autre' },
    { id: 'd', supplierId: 'surgeles' },
  ];

  const movedDown = reorderVisibleItems(products, ['a', 'b', 'c', 'd'], 'a', 'c');
  assert.deepEqual(
    movedDown.filter(product => product.supplierId === 'surgeles').map(product => product.id),
    ['b', 'c', 'a', 'd'],
    'Une carte glissée vers le bas doit prendre la position visée dans la grille',
  );
  assert.deepEqual(
    movedDown.filter(product => product.supplierId === 'autre').map(product => product.id),
    ['other-1', 'other-2'],
    'Le déplacement ne doit pas réordonner les autres fournisseurs',
  );

  const movedUp = reorderVisibleItems(products, ['a', 'b', 'c', 'd'], 'd', 'b');
  assert.deepEqual(
    movedUp.filter(product => product.supplierId === 'surgeles').map(product => product.id),
    ['a', 'd', 'b', 'c'],
    'Une carte glissée vers le haut doit être insérée avant la carte visée',
  );

  const filteredMove = reorderVisibleItems(products, ['a', 'c', 'd'], 'd', 'a');
  assert.deepEqual(
    filteredMove.map(product => product.id),
    ['d', 'other-1', 'b', 'a', 'other-2', 'c'],
    'Les produits masqués par un filtre doivent conserver leur emplacement',
  );

  assert.equal(
    reorderVisibleItems(products, ['a', 'b'], 'inconnu', 'b'),
    products,
    'Un déplacement invalide ne doit déclencher aucune sauvegarde',
  );

  assert.match(pageSource, /draggable=\{canEdit\}/, 'Les cartes modifiables doivent être déplaçables');
  assert.match(pageSource, /onDrop=\{dropProductCard\}/, 'Le dépôt doit appliquer le nouvel ordre');
  assert.doesNotMatch(pageSource, /moveProduct\(p\.id, '(?:up|down)'\)/, 'Les anciennes flèches doivent être retirées');

  console.log('Ordre cartes ratio OK : glisser-déposer, filtres et fournisseurs isolés.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
