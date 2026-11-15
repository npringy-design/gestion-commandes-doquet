import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-allergen-reader-'));

try {
  writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8');
  for (const name of ['manualConstants', 'manualIndexer', 'allergenReader', 'allergenPdfReader']) {
    const sourcePath = join(root, 'src', 'utils', `${name}.ts`);
    const source = readFileSync(sourcePath, 'utf8');
    assert.doesNotMatch(source, /\bany\b/, `${name} ne doit utiliser aucun any`);
    assert.doesNotMatch(source, /@ts-ignore/, `${name} ne doit pas utiliser @ts-ignore`);
    assert.doesNotMatch(source, /from ['"](react|@supabase)/, `${name} doit rester pur`);
    const { outputText, diagnostics = [] } = ts.transpileModule(source, {
      fileName: sourcePath,
      reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
    });
    assert.equal(diagnostics.length, 0);
    writeFileSync(
      join(tempDir, `${name}.mjs`),
      outputText.replace(/from '\.\/(\w+)'/g, "from './$1.mjs'"),
      'utf8',
    );
  }
  const { readAllergenPdf, isColoredFill } = await import(pathToFileURL(join(tempDir, 'allergenPdfReader.mjs')).href);
  const { findUpdateDate, groupDishes, summarizeDishes } = await import(pathToFileURL(join(tempDir, 'allergenReader.mjs')).href);
  const { ALLERGEN_CODES, ALLERGEN_WARNING, ALLERGEN_WARNING_SHORT } = await import(pathToFileURL(join(tempDir, 'manualConstants.mjs')).href);
  const { analyzeQuery, normalizeText } = await import(pathToFileURL(join(tempDir, 'manualIndexer.mjs')).href);

  // Opérateurs pdf.js (valeurs de pdfjs.OPS).
  const OPS = {
    save: 10, restore: 11, transform: 12, fill: 22, eoFill: 23, fillStroke: 24, eoFillStroke: 25,
    closeFillStroke: 26, closeEOFillStroke: 27, stroke: 20, closeStroke: 21,
    setFillRGBColor: 59, setFillColorN: 55, setFillTransparent: 93, constructPath: 91,
    paintFormXObjectBegin: 74, paintFormXObjectEnd: 75,
  };

  const LABELS = [
    'Gluten', 'Crustacés', 'Œufs', 'Poissons', 'Arachides', 'Soja', 'Lait',
    ['Fruits à', 'coques'], 'Céleri', 'Moutarde', 'Sésame', 'Sulfites', 'Lupin', 'Mollusques',
  ];
  const col = (i) => 210 + 20 * i; // centre de la colonne i (bornes 200 + 20 i)

  // Libellé vertical (lecture de bas en haut) : transform [0, s, -s, 0, e, f].
  const vertical = (str, cx, y = 700) => ({ str, transform: [0, 9, -9, 0, cx + 4.5, y], width: str.length * 4.5 });
  const horizontal = (str, x, y) => ({ str, transform: [9, 0, 0, 9, x, y], width: str.length * 4.5 });
  const headerItems = (skip = null) => {
    const items = [];
    LABELS.forEach((label, i) => {
      if (skip === i) return;
      if (Array.isArray(label)) {
        items.push(vertical(label[0], col(i) - 5), vertical(label[1], col(i) + 5));
      } else {
        items.push(vertical(label, col(i)));
      }
    });
    return items;
  };

  const rect = (x0, y0, x1, y1) => [0, x0, y0, 1, x1, y0, 1, x1, y1, 1, x0, y1, 4];
  const cellRect = (i0, i1, baseline) => rect(200 + 20 * i0, baseline - 4, 220 + 20 * i1, baseline + 10);
  const path = (paint, data) => [paint, [new Float32Array(data)], null];

  const buildPage = ({ texts, drawings }) => ({
    getTextContent: async () => ({ items: texts }),
    getOperatorList: async () => {
      const fnArray = [];
      const argsArray = [];
      for (const [fn, args] of drawings) {
        fnArray.push(fn);
        argsArray.push(args);
      }
      return { fnArray, argsArray };
    },
  });
  const docOf = (...pages) => ({ numPages: pages.length, getPage: async (n) => pages[n - 1] });
  const color = (hex) => [OPS.setFillRGBColor, [hex]];
  const fill = (data) => [OPS.constructPath, path(OPS.fill, data)];

  // --- Page 1 : en-tête vertical, catégories, plats, cases contiguës ---
  const page1 = buildPage({
    texts: [
      horizontal('TABLEAU DES ALLERGENES', 40, 780),
      horizontal('Mise à jour du 15/10/2026', 40, 760),
      ...headerItems(),
      horizontal('LES SAUCES', 300, 671),
      horizontal('ŒUFS MAYONNAISE', 40, 650),
      horizontal('POIREAUX SIGNATURE', 40, 630),
      horizontal('LES BURGERS', 300, 591),
      horizontal('BURGER MONTAGNARD', 40, 570),
      horizontal('SALADE VERTE', 40, 550),
      horizontal('Ne tient pas compte des éventuelles contaminations croisées. Document officiel à consulter.', 40, 100),
    ],
    drawings: [
      color('#ffffff'), fill(rect(0, 0, 600, 800)), // fond blanc : ignoré
      color('#d9d9d9'), fill(rect(30, 668, 500, 682)), fill(rect(30, 588, 500, 602)), // barres de catégorie
      color('#ffc000'),
      // Œufs mayonnaise : gluten, œufs, lait, moutarde, sulfites
      fill(cellRect(0, 0, 650)), fill(cellRect(2, 2, 650)), fill(cellRect(6, 6, 650)), fill(cellRect(9, 9, 650)), fill(cellRect(11, 11, 650)),
      // Poireaux signature : œufs, fruits à coques + céleri + moutarde (UN SEUL grand rectangle), sulfites
      fill(cellRect(2, 2, 630)), fill(cellRect(7, 9, 630)), fill(cellRect(11, 11, 630)),
      // Burger Montagnard : gluten, œufs, lait, moutarde, sésame, sulfites, mollusques
      fill(cellRect(0, 0, 570)), fill(cellRect(2, 2, 570)), fill(cellRect(6, 6, 570)), fill(cellRect(9, 10, 570)),
      fill(cellRect(11, 11, 570)), fill(cellRect(13, 13, 570)),
      // Bordures fines noires : ni cases ni barres
      color('#000000'), fill(rect(200, 540, 201, 700)),
    ],
  });
  // --- Page 2 : pas d'en-tête (colonnes de la page 1), pied de page variable ---
  const page2 = buildPage({
    texts: [
      horizontal('FRITES MAISON', 40, 750),
      horizontal('Page 2/2', 40, 40),
    ],
    drawings: [color('#ffc000'), fill(cellRect(1, 1, 750))],
  });

  const result = await readAllergenPdf(docOf(page1, page2), OPS);
  assert.equal(result.ok, true, result.ok ? '' : result.error);
  const byName = new Map(result.document.plats.map((plat) => [plat.nom, plat]));
  assert.deepEqual(result.document.plats.map((plat) => plat.nom), [
    'ŒUFS MAYONNAISE', 'POIREAUX SIGNATURE', 'BURGER MONTAGNARD', 'SALADE VERTE', 'FRITES MAISON',
  ], 'barres de catégorie, avertissements et pieds de page ne sont pas des plats');
  assert.equal(result.document.date, '2026-10-15');
  assert.deepEqual(byName.get('ŒUFS MAYONNAISE').allergenes, ['gluten', 'oeufs', 'lait', 'moutarde', 'sulfites']);
  assert.deepEqual(
    byName.get('POIREAUX SIGNATURE').allergenes,
    ['oeufs', 'fruits_a_coques', 'celeri', 'moutarde', 'sulfites'],
    'un grand rectangle sur plusieurs colonnes coche chaque colonne dont le centre est couvert',
  );
  assert.deepEqual(
    byName.get('BURGER MONTAGNARD').allergenes,
    ['gluten', 'oeufs', 'lait', 'moutarde', 'sesame', 'sulfites', 'mollusques'],
  );
  assert.deepEqual(byName.get('SALADE VERTE').allergenes, [], 'sans case colorée : liste vide (jamais « sans allergène »)');
  assert.equal(byName.get('ŒUFS MAYONNAISE').categorie, 'LES SAUCES');
  assert.equal(byName.get('POIREAUX SIGNATURE').categorie, 'LES SAUCES');
  assert.equal(byName.get('BURGER MONTAGNARD').categorie, 'LES BURGERS');
  assert.equal(byName.get('FRITES MAISON').categorie, 'LES BURGERS', 'la catégorie continue sur la page suivante');
  assert.deepEqual(byName.get('FRITES MAISON').allergenes, ['crustaces'], 'colonnes de la page 1 réutilisées');
  assert.equal(byName.get('ŒUFS MAYONNAISE').nomNormalise, 'oeufs mayonnaise');
  assert.equal(byName.get('ŒUFS MAYONNAISE').page, 1);
  assert.equal(byName.get('FRITES MAISON').page, 2);

  // --- Refus : une colonne d'allergène introuvable ---
  const missing = buildPage({ texts: [...headerItems(12), horizontal('PLAT', 40, 650)], drawings: [] });
  const missingResult = await readAllergenPdf(docOf(missing), OPS);
  assert.equal(missingResult.ok, false);
  assert.match(missingResult.error, /14 colonnes/);

  // --- Refus : libellé en double dans l'en-tête ---
  const doubled = buildPage({ texts: [...headerItems(), vertical('Lait', col(6) + 3, 710), horizontal('PLAT', 40, 650)], drawings: [] });
  const doubledResult = await readAllergenPdf(docOf(doubled), OPS);
  assert.equal(doubledResult.ok, false);

  // --- Refus : case partiellement colorée ---
  const partial = buildPage({
    texts: [...headerItems(), horizontal('PLAT DOUTEUX', 40, 650)],
    drawings: [color('#ffc000'), fill(rect(210, 646, 240, 660))],
  });
  const partialResult = await readAllergenPdf(docOf(partial), OPS);
  assert.equal(partialResult.ok, false);
  assert.match(partialResult.error, /partiellement/);

  // --- Refus : aucun plat ---
  const empty = buildPage({ texts: headerItems(), drawings: [] });
  const emptyResult = await readAllergenPdf(docOf(empty), OPS);
  assert.equal(emptyResult.ok, false);
  assert.match(emptyResult.error, /aucun plat/i);

  // --- Rotation à 270° (lecture de haut en bas) ---
  const down = (str, cx, y = 760) => ({ str, transform: [0, -9, 9, 0, cx - 4.5, y], width: str.length * 4.5 });
  const downItems = [];
  LABELS.forEach((label, i) => {
    if (Array.isArray(label)) downItems.push(down(label[0], col(i) + 5), down(label[1], col(i) - 5));
    else downItems.push(down(label, col(i)));
  });
  const rotated = buildPage({ texts: [...downItems, horizontal('PLAT TOURNE', 40, 650)], drawings: [color('#ffc000'), fill(cellRect(7, 7, 650))] });
  const rotatedResult = await readAllergenPdf(docOf(rotated), OPS);
  assert.equal(rotatedResult.ok, true, rotatedResult.ok ? '' : rotatedResult.error);
  assert.deepEqual(rotatedResult.document.plats[0].allergenes, ['fruits_a_coques']);

  // --- En-tête horizontal, libellé sur deux lignes ---
  const flatHeader = [];
  LABELS.forEach((label, i) => {
    if (Array.isArray(label)) {
      flatHeader.push(horizontal(label[0], col(i) - 8, 712), horizontal(label[1], col(i) - 6, 702));
    } else {
      flatHeader.push(horizontal(label, col(i) - label.length * 2.25, 702));
    }
  });
  const flat = buildPage({ texts: [...flatHeader, horizontal('PLAT PLAT', 40, 650), horizontal('Moutarde de Dijon', 40, 630)], drawings: [color('#ffc000'), fill(cellRect(9, 9, 650))] });
  const flatResult = await readAllergenPdf(docOf(flat), OPS);
  assert.equal(flatResult.ok, true, flatResult.ok ? '' : flatResult.error);
  assert.deepEqual(flatResult.document.plats.map((plat) => plat.nom), ['PLAT PLAT', 'Moutarde de Dijon']);
  assert.deepEqual(flatResult.document.plats[0].allergenes, ['moutarde']);

  // --- Un plat qui revient sur plusieurs pages (menus) n'est pas un pied de page ---
  const repeated1 = buildPage({ texts: [...headerItems(), horizontal('BURGER X', 40, 650), horizontal('PLAT UNIQUE', 40, 630)], drawings: [color('#ffc000'), fill(cellRect(0, 0, 650))] });
  const repeated2 = buildPage({ texts: [horizontal('BURGER X', 40, 700), horizontal('MENU DU JOUR SUITE', 40, 600)], drawings: [color('#ffc000'), fill(cellRect(0, 0, 700))] });
  const repeated3 = buildPage({ texts: [horizontal('BURGER X', 40, 720)], drawings: [color('#ffc000'), fill(cellRect(0, 0, 720))] });
  const repeatedResult = await readAllergenPdf(docOf(repeated1, repeated2, repeated3), OPS);
  assert.equal(repeatedResult.ok, true, repeatedResult.ok ? '' : repeatedResult.error);
  assert.equal(repeatedResult.document.plats.filter((plat) => plat.nom === 'BURGER X').length, 3, 'plat repété à des hauteurs différentes : conservé');
  assert.deepEqual(repeatedResult.document.ignorees, []);
  // Même texte à la même hauteur sur toutes les pages : pied de page, ignoré ET compté.
  const footer = (text, y) => buildPage({ texts: [...headerItems(), horizontal('UN PLAT', 40, y), horizontal(text, 40, 120)], drawings: [] });
  const footerResult = await readAllergenPdf(docOf(footer('Société X', 650), footer('Société X', 640)), OPS);
  assert.equal(footerResult.ok, true);
  assert.equal(footerResult.document.plats.filter((plat) => plat.nom === 'Société X').length, 0);
  assert.equal(footerResult.document.ignorees.length >= 1, true, 'une ligne ignorée est comptée');

  // --- Un plat dont le nom est un libellé d'allergène n'est jamais un libellé de colonne ---
  const named = buildPage({
    texts: [...headerItems(), horizontal('Œufs', 40, 650), horizontal('Lait', 40, 630), horizontal('ŒUFS MAYONNAISE', 40, 610)],
    drawings: [color('#ffc000'), fill(cellRect(0, 0, 650)), fill(cellRect(6, 6, 630)), fill(cellRect(0, 2, 610)), fill(cellRect(6, 6, 610)), fill(cellRect(9, 9, 610)), fill(cellRect(11, 11, 610))],
  });
  const namedResult = await readAllergenPdf(docOf(named), OPS);
  assert.equal(namedResult.ok, true, namedResult.ok ? '' : namedResult.error);
  assert.deepEqual(namedResult.document.plats.map((plat) => plat.nom), ['Œufs', 'Lait', 'ŒUFS MAYONNAISE']);
  assert.deepEqual(namedResult.document.plats[2].allergenes, ['gluten', 'crustaces', 'oeufs', 'lait', 'moutarde', 'sulfites']);

  // --- Ligne entièrement colorée dans la première colonne : refus ---
  const highlighted = buildPage({
    texts: [...headerItems(), horizontal('PLAT SURLIGNE', 40, 650)],
    drawings: [color('#ffff99'), fill(rect(30, 646, 500, 660))],
  });
  const highlightedResult = await readAllergenPdf(docOf(highlighted), OPS);
  assert.equal(highlightedResult.ok, false);
  assert.match(highlightedResult.error, /entièrement colorée/);

  // --- Texte à cheval sur les colonnes : compté comme ligne non reconnue ---
  const overflow = buildPage({
    texts: [...headerItems(), horizontal('PLAT NORMAL', 40, 650), horizontal('Texte libre qui déborde largement sur les colonnes du tableau', 100, 620)],
    drawings: [],
  });
  const overflowResult = await readAllergenPdf(docOf(overflow), OPS);
  assert.equal(overflowResult.ok, true);
  assert.deepEqual(overflowResult.document.plats.map((plat) => plat.nom), ['PLAT NORMAL']);
  assert.equal(overflowResult.document.ignorees.length, 1);
  assert.match(overflowResult.document.ignorees[0].text, /déborde/);

  // --- Libellés penchés, décalés par rapport aux cases : la grille des traits fait foi ---
  const tilted = [];
  LABELS.forEach((label, i) => {
    const name = Array.isArray(label) ? label.join(' ') : label;
    tilted.push({ str: name, transform: [1.68, 2.91, -2.91, 1.68, 200 + 20 * (i + 1) - 2, 700], width: name.length * 1.5 });
  });
  const thin = (x) => fill(rect(x, 560, x + 0.5, 680));
  const grid = buildPage({
    texts: [...tilted, horizontal('PLAT GRILLE', 40, 650)],
    drawings: [color('#000000'), ...Array.from({ length: 15 }, (_, k) => thin(200 + 20 * k)), color('#ffc000'), fill(cellRect(2, 2, 650)), fill(cellRect(7, 7, 650))],
  });
  const gridResult = await readAllergenPdf(docOf(grid), OPS);
  assert.equal(gridResult.ok, true, gridResult.ok ? '' : gridResult.error);
  assert.deepEqual(gridResult.document.plats[0].allergenes, ['oeufs', 'fruits_a_coques']);

  // --- Regroupement des plats en double ---
  const dish = (nom, categorie, allergenes) => ({ nom, categorie, allergenes, nomNormalise: nom.toLowerCase().replace('œ', 'oe') });
  const same = ['gluten', 'oeufs', 'lait', 'moutarde', 'sulfites'];
  const rowsSame = [
    dish('Œufs mayonnaise', 'LES ENTRÉES', same),
    dish('ŒUFS MAYONNAISE', 'MENU COUP DE CŒUR', [...same].reverse()),
    dish('Œufs mayonnaise', 'MENU DÉJEUNER', same),
    dish('Mousse au chocolat', 'LES DESSERTS', ['oeufs', 'lait']),
  ];
  const groupedSame = groupDishes(rowsSame);
  assert.equal(groupedSame.length, 2, 'mêmes allergènes : un seul résultat par plat');
  assert.deepEqual(groupedSame[0].alsoIn, ['MENU COUP DE CŒUR', 'MENU DÉJEUNER']);
  assert.equal(groupedSame[0].conflict, false);
  assert.equal(groupedSame[1].alsoIn.length, 0);
  const groupedDiff = groupDishes([dish('Mousse au chocolat', 'LES DESSERTS', ['oeufs', 'lait']), dish('Mousse au chocolat', 'MENU', ['oeufs'])]);
  assert.equal(groupedDiff.length, 2, 'allergènes différents : jamais regroupés');
  assert.ok(groupedDiff.every((group) => group.conflict), 'conflit signalé sur chaque résultat');
  assert.deepEqual(groupDishes([dish('Œufs mayonnaise', 'A', same), dish('Œufs mayonnaise XL', 'B', same)]).length, 2, 'un nom contenu dans un autre n’est jamais regroupé');
  const summary = summarizeDishes([...rowsSame, dish('Mousse au chocolat', 'MENU', ['oeufs'])]);
  assert.equal(summary.lignes, 5);
  assert.equal(summary.distincts, 2);
  assert.equal(summary.conflits.length, 1);
  assert.equal(summary.conflits[0].nom, 'Mousse au chocolat');

  // --- Date de mise à jour ---
  assert.equal(findUpdateDate('Mise à jour du 15/10/2026\nautre 01/01/2020'), '2026-10-15');
  assert.equal(findUpdateDate('Édité le 01/01/2020 ... Mise à jour : 03/04/2026'), '2026-04-03');
  assert.equal(findUpdateDate('Édité le 01/01/2020 puis 03/04/2026'), '2026-04-03', 'à défaut : la dernière date');
  assert.equal(findUpdateDate('aucune date ici'), null);
  assert.equal(findUpdateDate('Mise à jour 45/13/2026'), null, 'date invalide ignorée');

  // --- Couleurs ---
  assert.equal(isColoredFill(['#ffffff']), false);
  assert.equal(isColoredFill(['#fff']), false);
  assert.equal(isColoredFill(['#ffc000']), true);
  assert.equal(isColoredFill([255, 255, 255]), false);
  assert.equal(isColoredFill([200, 200, 200]), true);
  assert.equal(isColoredFill(['motif inconnu']), true, 'une couleur illisible compte comme colorée');

  // --- Requêtes : synonymes d'allergènes et questions ---
  for (const phrase of [
    "quelles sont les allergènes pour l'oeuf mayonnaise ?",
    "dis moi si y'a des allergènes dans l'oeuf mayo",
    'allergènes oeuf mayo',
  ]) {
    const analysis = analyzeQuery(phrase);
    assert.equal(analysis.allergens, true, phrase);
    assert.deepEqual(analysis.terms.slice(0, 1), ['oeuf'], phrase);
    assert.ok(!analysis.terms.some((term) => term.startsWith('allerg')), 'un synonyme d’allergène n’est jamais un terme');
    assert.equal(analysis.vague, false);
  }
  assert.deepEqual(analyzeQuery('quelles sont les allergènes pour l’œuf mayonnaise').terms, ['oeuf', 'mayonnaise'], 'œ devient oe');
  assert.equal(analyzeQuery('quelles sont les allergies ?').vague, true);
  assert.equal(analyzeQuery('recette mousse').allergens, false);
  assert.deepEqual(analyzeQuery("qu'est-ce qu'il y a dans les burgers").terms, ['burgers']);

  // --- Normalisation unique : élisions, ligatures ---
  assert.equal(normalizeText("l'oeuf mayo"), 'oeuf mayo');
  assert.equal(normalizeText('l’oeuf mayo'), 'oeuf mayo', 'apostrophe courbe');
  assert.equal(normalizeText('Œufs mayonnaise'), 'oeufs mayonnaise');
  assert.equal(normalizeText("Tarte d'orange"), 'tarte orange');
  assert.equal(normalizeText("AUJOURD'HUI"), "aujourd'hui", 'une apostrophe au milieu d’un mot reste');
  assert.deepEqual(analyzeQuery('qu’est-ce'), { terms: [], targets: [], vague: true, allergens: false }, 'qu’est-ce est entièrement retiré');
  assert.deepEqual(analyzeQuery("quelles sont les allergenes de l'oeuf mayo").terms, ['oeuf', 'mayo']);
  assert.deepEqual(analyzeQuery('allergènes mayo').terms, ['mayo']);
  assert.equal(analyzeQuery('allergènes mayo').allergens, true);

  assert.equal(ALLERGEN_CODES.length, 14);
  assert.match(ALLERGEN_WARNING, /contaminations croisées/);
  assert.match(ALLERGEN_WARNING, /guide allergènes officiel/);
  assert.match(ALLERGEN_WARNING_SHORT, /guide officiel/);

  console.log('Allergènes : en-têtes verticaux et horizontaux, cases contiguës, catégories, refus en cas de doute et requêtes OK.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
