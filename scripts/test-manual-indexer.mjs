import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-manual-indexer-'));

try {
  writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8');
  for (const name of ['manualIndexer', 'manualPdfReader']) {
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
    writeFileSync(join(tempDir, `${name}.mjs`), outputText.replace(/from '\.\/manualIndexer'/g, "from './manualIndexer.mjs'"), 'utf8');
  }
  const { indexManualPages, buildManualRows, describeLevel, highlightSegments, normalizeText, parseLines, toDisplayCase, splitTitle, matchKey, DEFAULT_UNITS } = await import(
    pathToFileURL(join(tempDir, 'manualIndexer.mjs')).href
  );
  const { readManualPdf } = await import(pathToFileURL(join(tempDir, 'manualPdfReader.mjs')).href);

  const it = (str, x, y, size = 9) => ({ str, x, y, size, width: str.length * size * 0.5 });
  const hippo = {
    headers: [
      { text: 'INGREDIENTS POUR', type: 'ingredients' },
      { text: 'EN MISE EN PLACE', type: 'mise_en_place' },
      { text: 'À LA COMMANDE', type: 'a_la_commande' },
      { text: 'DRESSAGE', type: 'dressage' },
      { text: 'QUALITÉ', type: 'qualite' },
    ],
    ignoredLines: ['©copyright'],
    subFichePrefix: 'SF',
    units: [...DEFAULT_UNITS],
  };
  const none = { headers: [], ignoredLines: [], subFichePrefix: '', units: [...DEFAULT_UNITS] };

  const hippoPages = [
    { page: 1, items: [it('MANUEL OPERATOIRE FROID', 40, 700), it('Sommaire', 40, 680)] },
    {
      page: 2,
      items: [
        it('CRÈME BRÛLÉE', 40, 780, 18),
        it('❑ INGREDIENTS POUR 1 PORTION « À LA CARTE » :', 40, 740),
        it('160 G', 40, 728), it('SF CREME BRULEE', 80, 728),
        it('INGREDIENTS POUR 10 PORTIONS « EN MENUS » :', 40, 700),
        it('50 G', 40, 688), it('SUCRE', 80, 688),
        it('EN MISE EN PLACE :', 40, 660), it('Cuire 30 min', 40, 648),
        it('DRESSAGE :', 320, 740), it('Assiette creuse', 320, 728),
        it('Qualité :', 320, 690), it('Croûte fine', 320, 678),
        it('©copyright Hippopotamus', 40, 30),
        it('TARTE', 40, 400, 18),
        it('INGREDIENTS POUR 1 PORTION :', 40, 360), it('1 PC', 40, 348),
      ],
    },
    { page: 3, items: [it('Suite de la tarte sur la page suivante', 40, 700)] },
  ];

  const index = indexManualPages(hippoPages, hippo);
  assert.equal(index.niveau, 3);
  assert.equal(index.nbPages, 3);
  assert.equal(index.fiches.length, 2);
  assert.equal(index.pages.length, 3, 'chaque page non vide reste indexée (niveau 1)');
  assert.ok(!index.pages[1].texte.includes('copyright'), 'ligne ignorée absente aussi du niveau page');
  const [brulee, tarte] = index.fiches;
  assert.equal(brulee.titre, 'CRÈME BRÛLÉE');
  assert.equal(brulee.page, 2);
  assert.deepEqual(
    brulee.sections.map((s) => s.typeRubrique),
    ['ingredients', 'ingredients', 'mise_en_place', 'dressage', 'qualite'],
    'deux blocs d\'ingrédients conservés, colonne droite rattachée à ses en-têtes',
  );
  assert.equal(brulee.sections[0].libelle, 'INGREDIENTS POUR 1 PORTION « À LA CARTE »');
  assert.equal(brulee.sections[0].texte, '160 G SF CREME BRULEE');
  assert.equal(brulee.sections[1].texte, '50 G SUCRE');
  assert.equal(brulee.sections[3].texte, 'Assiette creuse');
  assert.deepEqual(brulee.sousFiches, ['creme brulee']);
  assert.match(tarte.sections.at(-1).texte, /Suite de la tarte/, 'une fiche court jusqu\'au titre suivant, page suivante comprise');
  assert.ok(!brulee.sections.some((s) => /copyright/i.test(s.texte)));

  // Sans en-têtes (site sans réglages) : fiches en un seul bloc, niveau 2.
  const level2 = indexManualPages(hippoPages, none);
  assert.equal(level2.niveau, 2);
  assert.equal(level2.fiches.length, 2);
  assert.equal(level2.fiches[0].sections.length, 1);
  assert.equal(level2.fiches[0].sections[0].typeRubrique, 'autre');
  assert.match(level2.fiches[0].sections[0].texte, /Assiette creuse/);
  assert.match(describeLevel(level2), /sans rubriques/);

  // Sans titre : niveau 1, pages uniquement.
  const flat = indexManualPages([{ page: 1, items: [it('Texte', 10, 700), it('Autre ligne', 10, 680)] }], hippo);
  assert.equal(flat.niveau, 1);
  assert.equal(flat.fiches.length, 0);
  assert.equal(flat.pages.length, 1);
  assert.match(describeLevel(flat), /1 pages? indexées?|1 pages indexées/);

  // Réglages différents : un autre en-tête et un autre préfixe fonctionnent sans changer le code.
  const custom = indexManualPages(
    [{ page: 1, items: [it('RISOTTO', 40, 780, 18), it('Composition :', 40, 740), it('2 kg RECETTE_DE_BASE ris', 40, 728), it('Finition', 320, 740), it('Parmesan', 320, 728)] }],
    { headers: [{ text: 'composition', type: 'ingredients' }, { text: 'finition', type: 'dressage' }], ignoredLines: [], subFichePrefix: 'RECETTE_DE_BASE', units: ['kg'] },
  );
  assert.equal(custom.niveau, 3);
  assert.deepEqual(custom.fiches[0].sousFiches, ['ris']);
  assert.equal(custom.fiches[0].sections[1].typeRubrique, 'dressage');

  // Lignes SQL.
  const rows = buildManualRows(index);
  assert.equal(rows.filter((r) => r.type === 'page').length, 3);
  assert.equal(rows.filter((r) => r.type === 'fiche').length, 2);
  assert.equal(rows.find((r) => r.type === 'fiche').sections[0].type_rubrique, 'ingredients');

  // Adaptateur pdf.js minimal.
  const fakeDoc = {
    numPages: 1,
    getPage: async () => ({
      getTextContent: async () => ({
        items: [
          { str: 'TITRE', transform: [18, 0, 0, 18, 40, 780], width: 50 },
          { str: 'DRESSAGE : verre', transform: [9, 0, 0, 9, 40, 740], width: 60 },
          { str: 'ligne un', transform: [9, 0, 0, 9, 40, 720], width: 40 },
          { str: 'ligne deux', transform: [9, 0, 0, 9, 40, 700], width: 40 },
          { marks: true },
        ],
      }),
    }),
  };
  const fromPdf = await readManualPdf(fakeDoc, hippo);
  assert.equal(fromPdf.fiches[0].titre, 'TITRE');
  assert.equal(fromPdf.fiches[0].sections[0].typeRubrique, 'dressage');
  assert.equal(fromPdf.fiches[0].sections[0].texte, 'verre\nligne un\nligne deux');

  // Surlignage sans tenir compte des accents.
  const parts = highlightSegments('Crème brûlée maison', 'creme brul');
  assert.deepEqual(parts.filter((p) => p.match).map((p) => p.text), ['Crème', 'brûlée']);
  assert.equal(normalizeText('À LA COMMANDE'), 'a la commande');
  assert.deepEqual(highlightSegments('abc', ''), [{ text: 'abc', match: false }]);

  // Lignes typées : ingrédient, étape, puce, texte.
  assert.deepEqual(brulee.sections[0].lignes[0], {
    kind: 'ingredient', brut: '160 G SF CREME BRULEE', affichage: '160 G Creme brulee',
    quantite: '160', unite: 'G', produit: 'Creme brulee', sousFiche: 'creme brulee',
  });
  assert.equal(brulee.sections[1].lignes[0].quantite, '50');
  assert.equal(brulee.sections[1].lignes[0].produit, 'Sucre');

  const typed = parseLines(
    ['1,5 KG FARINE', '2 MINI MOUSSE AU CHOCOLAT', '1- CHAUFFER LE LAIT', 'A 80 DEGRES', '▪ PUIS REMUER', '2. SERVIR'],
    DEFAULT_UNITS, 'SF',
  );
  assert.deepEqual(typed.map((l) => l.kind), ['ingredient', 'ingredient', 'etape', 'etape']);
  assert.equal(typed[0].quantite, '1,5');
  assert.equal(typed[0].unite, 'KG');
  assert.equal(typed[1].unite, undefined, 'MINI n’est pas une unité');
  assert.equal(typed[1].produit, 'Mini mousse au chocolat');
  assert.equal(typed[2].numero, '1');
  assert.equal(typed[2].brut, 'CHAUFFER LE LAIT A 80 DEGRES', 'ligne sans numéro rattachée à l’étape en cours');
  assert.deepEqual(typed[2].sousLignes, [{ brut: 'PUIS REMUER', affichage: 'Puis remuer' }], 'puce après une étape = sous-ligne');
  assert.equal(typed[3].affichage, 'Servir');
  const loose = parseLines(['- ATTENTION CHAUD', 'TEXTE LIBRE', '-18°C'], DEFAULT_UNITS, '');
  assert.deepEqual(loose.map((l) => l.kind), ['puce', 'texte', 'texte'], 'puce sans étape, texte, valeur négative');

  // Unités propres au site : sans « kg » dans la liste, 1,5 KG reste dans le produit.
  assert.equal(parseLines(['2 KG SEL'], ['g'], '')[0].unite, undefined);
  assert.equal(parseLines(['2 kg SEL'], ['KG'], '')[0].unite, 'kg', 'comparaison sans casse');

  // Deux colonnes d'ingrédients : jamais fusionnées ligne à ligne.
  const twoCols = indexManualPages(
    [{ page: 1, items: [
      it('GÂTEAU', 40, 780, 18),
      it('INGREDIENTS POUR 1 PORTION :', 40, 740),
      it('1 MINI MOUSSE AU CHOCOLAT', 40, 720), it('1 SUCRE BUCHETTE HIPPO 3G', 300, 720),
      it('2 FRAISES', 40, 706), it('1 MENTHE', 300, 706),
    ] }],
    hippo,
  );
  assert.deepEqual(
    twoCols.fiches[0].sections[0].lignes.map((l) => l.brut),
    ['1 MINI MOUSSE AU CHOCOLAT', '2 FRAISES', '1 SUCRE BUCHETTE HIPPO 3G', '1 MENTHE'],
    'colonne de gauche de haut en bas, puis colonne de droite',
  );

  // Tableau quantité | produit : un grand écart ne crée pas de colonnes.
  const table = indexManualPages(
    [{ page: 1, items: [
      it('SOUPE', 40, 780, 18),
      it('INGREDIENTS POUR 1 PORTION :', 40, 740),
      it('200 G', 40, 720), it('CAROTTES', 200, 720),
      it('50 G', 40, 706), it('OIGNONS', 200, 706),
    ] }],
    hippo,
  );
  assert.deepEqual(table.fiches[0].sections[0].lignes.map((l) => l.brut), ['200 G CAROTTES', '50 G OIGNONS']);

  // Casse d'affichage : majuscule initiale, nombres et unités intacts.
  assert.equal(toDisplayCase('CUIRE 30 MIN A 180°C AVEC 200 G DE BEURRE'), 'Cuire 30 min a 180°C avec 200 G de beurre');
  assert.deepEqual(splitTitle('CAFÉ GOURMAND - CAFÉ/THÉ GOURMAND'), { principal: 'CAFÉ GOURMAND', sousTitre: 'CAFÉ/THÉ GOURMAND' });
  assert.deepEqual(splitTitle('TARTE-TATIN'), { principal: 'TARTE-TATIN', sousTitre: '' });

  // Rapprochement tolérant des sous-fiches.
  assert.equal(matchKey('CREME BRULEE 50 G'), matchKey('crème brûlée'));
  assert.equal(matchKey('creme brulee 50'), 'creme brulee');
  assert.equal(matchKey('Pâte à choux (base)'), 'pate a choux base');
  assert.notEqual(matchKey('mousse 3 chocolats'), matchKey('mousse'));

  // Version de format et lignes envoyées à la base.
  assert.ok(rows.filter((r) => r.type === 'fiche').every((r) => r.format_version === 2));
  assert.equal(rows.find((r) => r.type === 'fiche').sections[0].lignes[0].sous_fiche, 'creme brulee');

  console.log('Indexation des manuels : niveaux 1, 2 et 3, réglages par site, sous-fiches et surlignage OK.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
