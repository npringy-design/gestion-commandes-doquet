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
      ratioLinkStatus: 'linked',
    }),
    [],
    'Une ligne cohérente et liée ne doit afficher aucune alerte'
  );

  assert.ok(
    codes(getOrderAnomalies({
      product: { ...baseProduct, packaging: '' },
      calculationMode: 'margin',
      averageRatio: 0.1,
      forecastTotal: 200,
      toOrder: 0,
      ratioLinkStatus: 'linked',
    })).includes('invalid_packaging'),
    'Un conditionnement vide doit être signalé'
  );

  assert.deepEqual(
    getOrderAnomalies({
      product: { ...baseProduct, stock: '' },
      calculationMode: 'margin',
      averageRatio: 0.1,
      forecastTotal: 200,
      toOrder: 2,
      ratioLinkStatus: 'linked',
    }),
    [],
    'Un stock vide pendant l’inventaire ne doit pas générer une fausse alerte'
  );

  assert.ok(
    codes(getOrderAnomalies({
      product: baseProduct,
      calculationMode: 'margin',
      averageRatio: 0.1,
      forecastTotal: 200,
      toOrder: 0,
      ratioLinkStatus: 'unlinked',
    })).includes('unlinked_ratio'),
    'Un produit non lié dans Calcul vente ratio doit être signalé'
  );

  assert.ok(
    !codes(getOrderAnomalies({
      product: baseProduct,
      calculationMode: 'margin',
      averageRatio: 0.1,
      forecastTotal: 200,
      toOrder: 0,
      ratioLinkStatus: 'unknown',
    })).includes('unlinked_ratio'),
    'L’absence de fichier permettant de contrôler la liaison ne doit pas produire de faux positif'
  );

  assert.ok(
    codes(getOrderAnomalies({
      product: { ...baseProduct, targetStock: '' },
      calculationMode: 'target',
      averageRatio: 0.1,
      forecastTotal: 200,
      toOrder: 0,
      ratioLinkStatus: 'linked',
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
      ratioLinkStatus: 'linked',
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
      ratioLinkStatus: 'linked',
    })).includes('duplicate_product'),
    'Un nom de produit en doublon doit être signalé'
  );

  assert.ok(
    codes(getOrderAnomalies({
      product: {
        ...baseProduct,
        name: 'Sirop citron',
        packaging: 6,
        stock: 10,
      },
      calculationMode: 'margin',
      averageRatio: 0.01,
      forecastTotal: 100,
      toOrder: 0,
      ratioLinkStatus: 'linked',
    })).includes('unusual_stock'),
    'Une saisie de stock très supérieure au besoin, comme 10 pour un besoin de 1, doit être signalée'
  );

  assert.ok(
    !codes(getOrderAnomalies({
      product: {
        ...baseProduct,
        packaging: 6,
        stock: 6,
      },
      calculationMode: 'margin',
      averageRatio: 0.01,
      forecastTotal: 100,
      toOrder: 0,
      ratioLinkStatus: 'linked',
    })).includes('unusual_stock'),
    'Un écart faible lié au conditionnement ne doit pas déclencher l’alerte de mauvaise saisie'
  );

  assert.ok(
    codes(getOrderAnomalies({
      product: { ...baseProduct, upcomingDelivery: 20 },
      calculationMode: 'margin',
      averageRatio: 0.1,
      forecastTotal: 200,
      toOrder: 0,
      ratioLinkStatus: 'linked',
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
      ratioLinkStatus: 'linked',
    })).includes('unusual_order_quantity'),
    'Une proposition de commande disproportionnée doit être signalée'
  );

  console.log('Alertes commandes OK : paramétrage, liaisons ratio, doublons et saisies disproportionnées couverts sans alerte sur stock vide.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}