import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const sourcePath = join(process.cwd(), 'src', 'utils', 'orderAnomalies.ts');
const source = readFileSync(sourcePath, 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-order-anomalies-'));

const baseProduct = {
  id: 'p1',
  name: 'Steak haché',
  stock: 24,
  upcomingDelivery: 0,
  targetStock: 24,
  packaging: 12,
};

const codes = anomalies => anomalies.map(anomaly => anomaly.code);

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

  const compiledPath = join(tempDir, 'orderAnomalies.mjs');
  writeFileSync(compiledPath, outputText, 'utf8');

  const {
    buildOrderProductNameCounts,
    getOrderAnomalies,
    normalizeOrderProductName,
  } = await import(pathToFileURL(compiledPath).href);

  assert.equal(
    normalizeOrderProductName('  Crème BRÛLÉE  '),
    'creme brulee',
    'La détection des doublons doit ignorer accents, casse et espaces'
  );

  const nameCounts = buildOrderProductNameCounts([
    { name: 'Coca Cola' },
    { name: 'coca-cola' },
    { name: 'Orangina' },
  ]);
  assert.equal(nameCounts.get('coca cola'), 2, 'Deux libellés équivalents doivent être détectés comme doublons');

  assert.deepEqual(
    getOrderAnomalies({
      product: baseProduct,
      calculationMode: 'margin',
      averageRatio: 0.1,
      forecastTotal: 200,
      toOrder: 0,
    }),
    [],
    'Une ligne cohérente ne doit afficher aucune alerte'
  );

  assert.ok(
    codes(getOrderAnomalies({
      product: { ...baseProduct, packaging: '' },
      calculationMode: 'margin',
      averageRatio: 0.1,
      forecastTotal: 200,
      toOrder: 0,
    })).includes('invalid_packaging'),
    'Un conditionnement vide doit être signalé'
  );

  assert.ok(
    codes(getOrderAnomalies({
      product: { ...baseProduct, stock: '' },
      calculationMode: 'margin',
      averageRatio: 0.1,
      forecastTotal: 200,
      toOrder: 2,
    })).includes('missing_stock'),
    'Un stock vide avec besoin prévu doit être signalé'
  );

  assert.ok(
    !codes(getOrderAnomalies({
      product: { ...baseProduct, stock: 0 },
      calculationMode: 'margin',
      averageRatio: 0.1,
      forecastTotal: 200,
      toOrder: 2,
    })).includes('missing_stock'),
    'Un stock explicitement saisi à zéro ne doit pas être considéré comme vide'
  );

  assert.ok(
    codes(getOrderAnomalies({
      product: { ...baseProduct, targetStock: '' },
      calculationMode: 'target',
      averageRatio: 0.1,
      forecastTotal: 200,
      toOrder: 0,
    })).includes('missing_target'),
    'Le mode Cible doit signaler un stock cible vide'
  );

  assert.ok(
    codes(getOrderAnomalies({
      product: { ...baseProduct, upcomingDelivery: -3 },
      calculationMode: 'margin',
      averageRatio: 0.1,
      forecastTotal: 200,
      toOrder: 0,
    })).includes('negative_value'),
    'Une livraison négative doit être signalée'
  );

  assert.ok(
    codes(getOrderAnomalies({
      product: baseProduct,
      calculationMode: 'margin',
      averageRatio: 0.1,
      forecastTotal: 200,
      toOrder: 0,
      duplicateNameCount: 2,
    })).includes('duplicate_product'),
    'Un nom de produit en doublon doit être signalé'
  );

  assert.ok(
    codes(getOrderAnomalies({
      product: { ...baseProduct, stock: 240 },
      calculationMode: 'margin',
      averageRatio: 0.1,
      forecastTotal: 200,
      toOrder: 0,
    })).includes('unusual_stock'),
    'Un stock très supérieur au besoin doit être signalé'
  );

  assert.ok(
    codes(getOrderAnomalies({
      product: { ...baseProduct, upcomingDelivery: 20 },
      calculationMode: 'margin',
      averageRatio: 0.1,
      forecastTotal: 200,
      toOrder: 0,
    })).includes('unusual_upcoming_delivery'),
    'Une livraison à venir très supérieure au besoin doit être signalée'
  );

  assert.ok(
    codes(getOrderAnomalies({
      product: { ...baseProduct, stock: 0 },
      calculationMode: 'margin',
      averageRatio: 0.05,
      forecastTotal: 200,
      toOrder: 12,
    })).includes('unusual_order_quantity'),
    'Une proposition de commande disproportionnée doit être signalée'
  );

  console.log('Alertes commandes OK : champs manquants, doublons, valeurs négatives et quantités inhabituelles couvertes.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
