import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseMarginCatalogFromWorkbook } from '../src/utils/takeRateMarginParser.js';

const makeWorkbook = (rows, sheetName = 'Produits') => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
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

const shiftedHeaderWorkbook = makeWorkbook([
  ['Export marge carte'],
  ['Document interne'],
  [],
  ['Désignation produit', 'Famille produit', 'CM HT', 'Prix TTC', 'Marge montant', 'Marge %'],
  ['Crème brûlée', 'Dessert', '1,10 €', '6,50 €', '5,40 €', '83,1 %'],
], 'Produits 2026');

const shiftedCatalog = parseMarginCatalogFromWorkbook(shiftedHeaderWorkbook, XLSX);
assert.equal(shiftedCatalog.length, 1, 'Le parser doit retrouver une en-tete decalee dans les premieres lignes');
assert.equal(shiftedCatalog[0].label, 'Crème brûlée');
assert.equal(shiftedCatalog[0].section, 'Dessert');
assert.equal(shiftedCatalog[0].costHt, 1.1);
assert.equal(shiftedCatalog[0].sellPriceHt, 6.5);
assert.equal(shiftedCatalog[0].marginEuro, 5.4);
assert.equal(shiftedCatalog[0].marginPercent, 83.1);
assert.equal(shiftedCatalog[0].sourceSheet, 'Produits 2026', 'Un onglet proche de Produits doit etre accepte');

const missingSheetWorkbook = makeWorkbook([
  ['Produit', 'Famille', 'CR'],
  ['Produit test', 'Famille', '1,00'],
], 'Autre onglet');

assert.throws(
  () => parseMarginCatalogFromWorkbook(missingSheetWorkbook, XLSX),
  /Onglet Produits introuvable/,
  'Un classeur sans onglet Produits ou nom proche doit echouer clairement'
);

const missingProductColumnWorkbook = makeWorkbook([
  ['Famille', 'CR', 'PV HT'],
  ['Dessert', '1,00', '5,00'],
]);

assert.throws(
  () => parseMarginCatalogFromWorkbook(missingProductColumnWorkbook, XLSX),
  /Colonne Produit introuvable|Ligne d en-tete Produits introuvable/,
  'Un fichier sans colonne produit exploitable doit echouer clairement'
);

console.log('Parser marge OK : colonnes essentielles lues, variantes conservees, en-tetes decalees et erreurs protegees.');
