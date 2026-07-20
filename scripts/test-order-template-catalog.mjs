import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const sourcePath = join(process.cwd(), 'src', 'utils', 'orderTemplateCatalog.ts');
const source = readFileSync(sourcePath, 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-order-template-catalog-'));

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

  const compiledPath = join(tempDir, 'orderTemplateCatalog.mjs');
  writeFileSync(compiledPath, outputText, 'utf8');
  const catalog = await import(pathToFileURL(compiledPath).href);

  const supplierOptions = catalog.getOrderTemplateSupplierOptions({
    historique: { id: 'historique', name: 'Historique', isArchived: true },
    doquet: { id: 'doquet', name: 'Doquet' },
    nouveau_fournisseur: { id: 'nouveau_fournisseur', name: 'Nouveau fournisseur' },
  });
  assert.deepEqual(
    supplierOptions.map(supplier => supplier.id),
    ['doquet', 'nouveau_fournisseur'],
    'Tout fournisseur actif créé dans les paramètres doit apparaître dans les trames, même sans produit',
  );

  const products = [{
    id: 'p1',
    supplierId: 'bof',
    name: 'Steak 100 g',
    searchName: 'STEAK HACHE IMPORT',
    storageUnit: 'au Kg',
    packagingUnit: 'carton x 10',
    packaging: 10,
    salesHistory: { oct: 204 },
    ratioSnapshots: { oct: { salesValue: 204, ratio: 0.04 } },
  }];

  const legacyRows = [{ id: 'r1', article: 'Steak 100 g', storageUnit: 'au Kg', packagingUnit: 'carton x 10' }];
  const linkedLegacy = catalog.linkTemplateRowsToExistingProducts(legacyRows, products, 'bof');
  assert.equal(linkedLegacy[0].productId, 'p1', 'Une ancienne ligne doit retrouver son produit sans recréation');

  const result = catalog.synchronizeOrderTemplateProducts({
    rows: [
      { ...linkedLegacy[0], article: 'Steak 100 g nouvelle présentation', packagingUnit: 'carton x 16' },
      { id: 'r2', article: 'Nouveau produit', storageUnit: 'pièce', packagingUnit: 'boîte x 6' },
    ],
    products,
    supplierId: 'bof',
    makeProductId: index => `new-${index}`,
  });

  assert.equal(result.updates.length, 1);
  assert.equal(result.updates[0].id, 'p1');
  assert.equal(result.updates[0].packaging, 16);
  assert.equal(result.creations.length, 1);
  assert.equal(result.creations[0].packaging, 6);
  assert.equal(result.linkedRows[0].productId, 'p1');
  assert.equal(result.linkedRows[1].productId, 'new-1');

  const updatedExisting = { ...products[0], ...result.updates[0] };
  assert.equal(updatedExisting.searchName, 'STEAK HACHE IMPORT', 'Le mapping manuel doit être conservé');
  assert.deepEqual(updatedExisting.salesHistory, { oct: 204 }, 'L’historique de ventes doit être conservé');
  assert.deepEqual(
    updatedExisting.ratioSnapshots,
    { oct: { salesValue: 204, ratio: 0.04 } },
    'Les ratios figés doivent être conservés',
  );

  const rebuilt = catalog.buildTemplateRowsFromProducts(products, 'bof');
  assert.equal(rebuilt.length, 1);
  assert.equal(rebuilt[0].productId, 'p1');
  assert.equal(rebuilt[0].packagingUnit, 'carton x 10');

  console.log('Catalogue trames OK : réouverture, mise à jour ciblée, création et paramètres ratio conservés.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
