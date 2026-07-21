import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const sourcePath = join(process.cwd(), 'src', 'utils', 'ratioFreezeModel.ts');
const source = readFileSync(sourcePath, 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-ratio-freeze-'));

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

  const compiledPath = join(tempDir, 'ratioFreezeModel.mjs');
  writeFileSync(compiledPath, outputText, 'utf8');
  const model = await import(pathToFileURL(compiledPath).href);

  const legacy = { oct: true };
  let suppliers = {};
  let products = {};

  assert.equal(
    model.isRatioSupplierMonthFrozen(legacy, suppliers, 'bof', 'oct'),
    true,
    'Un ancien mois figé doit rester figé avant migration fournisseur',
  );

  suppliers = model.setRatioSupplierMonthFreeze(suppliers, 'bof', 'oct', false);
  assert.equal(model.isRatioSupplierMonthFrozen(legacy, suppliers, 'bof', 'oct'), false);
  assert.equal(
    model.isRatioSupplierMonthFrozen(legacy, suppliers, 'viandes', 'oct'),
    true,
    'Défiger B.O.F. ne doit pas défiger Viandes',
  );

  suppliers = model.setRatioSupplierMonthFreeze(suppliers, 'bof', 'oct', true);
  products = model.setRatioProductMonthUnfrozen(products, 'produit-1', 'oct', true);
  assert.equal(
    model.isRatioProductMonthFrozen(legacy, suppliers, products, 'bof', 'produit-1', 'oct'),
    false,
    'Un produit explicitement défigé doit être ouvert',
  );
  assert.equal(
    model.isRatioProductMonthFrozen(legacy, suppliers, products, 'bof', 'produit-2', 'oct'),
    true,
    'Les autres produits du fournisseur doivent rester figés',
  );

  products = model.openNewRatioProductsForMonths(
    products,
    ['nouveau-carpaccio'],
    ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
  );
  assert.deepEqual(
    Object.keys(products['nouveau-carpaccio']),
    ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
    'Les douze mois du nouveau produit doivent être défigés individuellement',
  );
  assert.equal(
    model.isRatioProductMonthFrozen(legacy, suppliers, products, 'bof', 'nouveau-carpaccio', 'oct'),
    false,
    'Un nouveau produit doit être paramétrable sans défiger les produits existants',
  );
  assert.equal(
    model.isRatioProductMonthFrozen(legacy, suppliers, products, 'bof', 'produit-2', 'oct'),
    true,
    'L’ouverture automatique du nouveau produit ne doit pas défiger les autres produits',
  );

  products = model.clearRatioProductMonthOverrides(products, ['produit-1'], 'oct');
  assert.equal(
    model.isRatioProductMonthFrozen(legacy, suppliers, products, 'bof', 'produit-1', 'oct'),
    true,
    'Refiger le fournisseur doit supprimer l’exception produit',
  );

  console.log('Figement vente OK : migration, fournisseur isolé et douze mois du nouveau produit ouverts.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
