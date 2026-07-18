import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import { parseMarginCatalogFromWorkbook } from '../src/utils/takeRateMarginParser.js';

const readWorkbook = (bytes, operation = 'margin-catalog') =>
  XLSX.read(bytes, {
    type: 'array',
    cellFormula: operation === 'margin-catalog',
    cellText: true,
    cellNF: false,
  });

const createWorkbook = (productRows) => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Feuille sans produits'],
      ['Cette feuille vérifie que la sélection ne dépend pas de la première position'],
    ]),
    'Résumé'
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Export marge carte'],
      [],
      ['Produit', 'Famille', 'CR', 'PV HT', 'Marge', 'Marge %'],
      ...productRows,
    ]),
    'Produits 2026'
  );
  return workbook;
};

const expectedRows = [
  ['Crème brûlée', 'Dessert', 1.1, 6.5, 5.4, 83.1],
  ["Mix' fromager (10 pièces)", 'Fromager', 2.1, 8.9, 6.8, 76.4],
];

for (const bookType of ['xlsx', 'xls']) {
  const bytes = XLSX.write(createWorkbook(expectedRows), { bookType, type: 'array' });
  const reloaded = readWorkbook(bytes);
  const catalog = parseMarginCatalogFromWorkbook(reloaded, XLSX);

  assert.equal(catalog.length, 2, `Le round-trip ${bookType} doit conserver les deux produits`);
  assert.deepEqual(
    catalog.map(({ label, section, costHt, sellPriceHt, marginEuro, marginPercent, sourceSheet }) => ({
      label,
      section,
      costHt,
      sellPriceHt,
      marginEuro,
      marginPercent,
      sourceSheet,
    })),
    expectedRows.map(([label, section, costHt, sellPriceHt, marginEuro, marginPercent]) => ({
      label,
      section,
      costHt,
      sellPriceHt,
      marginEuro,
      marginPercent,
      sourceSheet: 'Produits 2026',
    })),
    `Les résultats métier ${bookType} doivent rester identiques après sérialisation`
  );
}

const csvWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  csvWorkbook,
  XLSX.utils.aoa_to_sheet([
    ['Produit', 'Quantité'],
    ['Crème brûlée', 12],
  ]),
  'Import'
);
const csvBytes = XLSX.write(csvWorkbook, { bookType: 'xlsx', type: 'array' });
const csvReloaded = readWorkbook(csvBytes, 'to-csv');
const csvResult = XLSX.utils.sheet_to_csv(csvReloaded.Sheets[csvReloaded.SheetNames[0]]);
assert.match(csvResult, /Produit,Quantité/);
assert.match(csvResult, /Crème brûlée,12/);

assert.throws(
  () => readWorkbook(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x01, 0x02, 0x03])),
  /ZIP|Unsupported|corrupt/i,
  'Un faux classeur ZIP tronqué doit être rejeté'
);

const largeRows = Array.from({ length: 10_000 }, (_, index) => [
  `Produit ${index + 1}`,
  index % 2 ? 'Dessert' : 'Plat',
  1.25,
  5.5,
  4.25,
  77.3,
]);
const largeBytes = XLSX.write(createWorkbook(largeRows), { bookType: 'xlsx', type: 'array' });
const largeCatalog = parseMarginCatalogFromWorkbook(readWorkbook(largeBytes), XLSX);
assert.equal(largeCatalog.length, 10_000, 'Un classeur synthétique volumineux doit rester entièrement lisible');
assert.equal(largeCatalog.at(-1)?.label, 'Produit 10000');

const packageManifest = JSON.parse(await readFile(new URL('../node_modules/xlsx/package.json', import.meta.url), 'utf8'));
assert.equal(packageManifest.version, '0.20.3', 'La distribution SheetJS corrigée doit rester verrouillée en 0.20.3');

const projectManifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(
  projectManifest.dependencies.xlsx,
  'https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz',
  'SheetJS doit être installé depuis sa distribution officielle corrigée et non depuis le registre npm obsolète'
);

console.log('SheetJS OK : XLS, XLSX, multi-feuilles, CSV, corruption et 10 000 lignes contrôlés.');
