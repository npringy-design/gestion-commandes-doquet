import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseMarginCatalogFromWorkbook } from '../src/utils/takeRateMarginParser.js';

const makeWorkbook = (rows) => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Produits');
  return workbook;
};

const primaryWorkbook = makeWorkbook([
  ['Produit', 'Famille', 'CR', 'PV HT', 'Marge', 'Marge %'],
  ["Mix' des copains fromager (10 pièces)", 'Fromager', '2,10', '8,90', '6,80', '76,4%'],
  ["Mix' des copains fromager (20 pièces)", 'Fromager', '4,20', '17,80', '13,60', '76,4%'],
  ['Burger classique', 'Plat', '3,50', '14,90', '11,40', '76,5%'],
]);

const primaryCatalog = parseMarginCatalogFromWorkbook(primaryWorkbook, XLSX);
const labels = primaryCatalog.map((item) => item.label);

assert.equal(primaryCatalog.length, 3, 'Le parser doit conserver une ligne par produit importe');
assert.deepEqual(labels, [
  "Mix' des copains fromager (10 pièces)",
  "Mix' des copains fromager (20 pièces)",
  'Burger classique',
]);
assert.equal(new Set(labels).size, 3, 'Aucun regroupement automatique ne doit fusionner les produits');
assert.equal(primaryCatalog[0].section, 'Fromager');
assert.equal(primaryCatalog[0].costHt, 2.1);
assert.equal(primaryCatalog[0].sellPriceHt, 8.9);
assert.equal(primaryCatalog[0].marginEuro, 6.8);
assert.equal(primaryCatalog[0].marginPercent, 76.4);
assert.notEqual(primaryCatalog[0].normalized, primaryCatalog[1].normalized, 'Les variantes proches doivent garder deux identifiants distincts');

const aliasWorkbook = makeWorkbook([
  ['Produit', 'Famille', 'Coût de revient', 'Prix TTC', 'Marge HT'],
  ['Produit alias', 'Dessert', '1,25', '5,50', '4,25'],
]);

const aliasCatalog = parseMarginCatalogFromWorkbook(aliasWorkbook, XLSX);

assert.equal(aliasCatalog.length, 1);
assert.equal(aliasCatalog[0].label, 'Produit alias');
assert.equal(aliasCatalog[0].costHt, 1.25);
assert.equal(aliasCatalog[0].sellPriceHt, 5.5);
assert.equal(aliasCatalog[0].marginEuro, 4.25);

console.log('Parser marge OK : colonnes essentielles lues, variantes conservees, aucune fusion approximative.');
