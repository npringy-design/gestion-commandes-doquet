import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const tempDir = mkdtempSync(join(tmpdir(), 'gestion-supplier-dates-'));
const dateHelpersPath = join(process.cwd(), 'src', 'utils', 'dateHelpers.ts');
const rawSource = readFileSync(dateHelpersPath, 'utf8');

try {
  writeFileSync(
    join(tempDir, 'constants.mjs'),
    'export const MONTHS_ORDER = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];\n',
    'utf8'
  );

  const source = rawSource
    .replace("import type { SupplierConfig, DeliveryRule } from '../types';\n", '')
    .replace("import type { DailyCover } from '../data';\n", '')
    .replace("import { MONTHS_ORDER } from '../constants';", "import { MONTHS_ORDER } from './constants.mjs';");

  const { outputText } = ts.transpileModule(source, {
    fileName: dateHelpersPath,
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
      isolatedModules: false,
    },
  });

  const compiledPath = join(tempDir, 'dateHelpers.mjs');
  writeFileSync(compiledPath, outputText, 'utf8');

  const { getDeliveryDates, getForecastForWindow } = await import(pathToFileURL(compiledPath).href);

  const doquet = {
    id: 'doquet',
    name: 'Doquet',
    deliveryDay: 3,
    cutoffDay: 2,
    cutoffTime: '10:00',
    deliveryRules: [{ cutoffDay: 2, deliveryDay: 3 }],
  };

  const domafrais = {
    id: 'domafrais',
    name: 'Domafrais',
    deliveryDay: 3,
    cutoffDay: 1,
    cutoffTime: '10:00',
    deliveryRules: [
      { cutoffDay: 1, deliveryDay: 3 },
      { cutoffDay: 3, deliveryDay: 5 },
    ],
  };

  // Les calculs métier manipulent des jours calendaires locaux. Une conversion
  // en UTC peut reculer la date à la veille pour une livraison à minuit.
  const dateKey = (date) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

  const doquetBeforeCutoff = getDeliveryDates(doquet, new Date(2026, 5, 2, 9, 30));
  assert.equal(dateKey(doquetBeforeCutoff.delivery), '2026-06-03', 'Doquet mardi avant 10h doit livrer mercredi de la même semaine');
  assert.equal(dateKey(doquetBeforeCutoff.delivery2), '2026-06-10', 'Doquet doit couvrir jusqu’à la livraison physique suivante du mercredi suivant');
  assert.equal(dateKey(doquetBeforeCutoff.forecastEnd), '2026-06-09', 'Doquet doit couvrir jusqu’à mardi soir avant la prochaine livraison');

  const doquetAfterCutoff = getDeliveryDates(doquet, new Date(2026, 5, 2, 10, 30));
  assert.equal(dateKey(doquetAfterCutoff.delivery), '2026-06-10', 'Doquet mardi après 10h doit basculer sur le mercredi suivant');
  assert.equal(dateKey(doquetAfterCutoff.delivery2), '2026-06-17', 'Doquet après cut-off doit garder une fréquence hebdomadaire de livraison');
  assert.equal(dateKey(doquetAfterCutoff.forecastEnd), '2026-06-16', 'Doquet après cut-off doit couvrir jusqu’au mardi suivant');

  const domafraisMonday = getDeliveryDates(domafrais, new Date(2026, 5, 1, 9, 0));
  assert.equal(dateKey(domafraisMonday.delivery), '2026-06-03', 'Domafrais lundi avant cut-off doit livrer mercredi');
  assert.equal(dateKey(domafraisMonday.delivery2), '2026-06-05', 'Domafrais après livraison mercredi doit voir la livraison physique du vendredi');
  assert.equal(dateKey(domafraisMonday.forecastEnd), '2026-06-04', 'Domafrais commande lundi doit couvrir mercredi et jeudi avant la livraison vendredi');

  const domafraisWednesday = getDeliveryDates(domafrais, new Date(2026, 5, 3, 9, 0));
  assert.equal(dateKey(domafraisWednesday.delivery), '2026-06-05', 'Domafrais mercredi avant cut-off doit livrer vendredi');
  assert.equal(dateKey(domafraisWednesday.delivery2), '2026-06-10', 'Domafrais après livraison vendredi doit voir la livraison physique du mercredi suivant');
  assert.equal(dateKey(domafraisWednesday.forecastEnd), '2026-06-09', 'Domafrais livraison vendredi doit couvrir jusqu’au mardi soir suivant');

  const covers = {
    may: Array.from({ length: 31 }, () => ({ midi: 1, soir: 10 })),
    jun: Array.from({ length: 30 }, () => ({ midi: 1, soir: 10 })),
    jul: Array.from({ length: 31 }, () => ({ midi: 1, soir: 10 })),
  };

  const crossMonth = getForecastForWindow(new Date(2026, 5, 2), covers, new Date(2026, 4, 31, 16, 0));
  assert.deepEqual(
    crossMonth,
    { midi: 2, soir: 30, total: 32 },
    'Prévision à cheval sur deux mois : après 15h, exclure le midi du jour mais garder le soir et les jours suivants'
  );

  console.log('Dates fournisseurs OK : Doquet, Domafrais, cut-offs, livraison suivante physique et prévision multi-mois protégés.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
