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
  for (const name of ['manualConstants', 'manualIndexer', 'manualPdfReader']) {
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
      outputText
        .replace(/from '\.\/manualIndexer'/g, "from './manualIndexer.mjs'")
        .replace(/from '\.\/manualConstants'/g, "from './manualConstants.mjs'"),
      'utf8',
    );
  }
  const {
    indexManualPages, buildManualRows, describeLevel, highlightSegments, normalizeText, parseLines,
    toDisplayCase, splitTitle, matchKey, matchHeader, analyzeQuery,
  } = await import(pathToFileURL(join(tempDir, 'manualIndexer.mjs')).href);
  const { UNITS, SUB_FICHE_PREFIXES, STOP_WORDS, SYNONYMS, HEADER_KEYWORDS, MANUAL_FORMAT_VERSION } = await import(
    pathToFileURL(join(tempDir, 'manualConstants.mjs')).href
  );
  const { readManualPdf } = await import(pathToFileURL(join(tempDir, 'manualPdfReader.mjs')).href);

  const it = (str, x, y, size = 9) => ({ str, x, y, size, width: str.length * size * 0.5 });
  const copyright = (page) => it('©copyright Hippopotamus', 40, 30 + page * 0);

  assert.equal(MANUAL_FORMAT_VERSION, 3);

  // --- Détection automatique des en-têtes de rubrique ---
  assert.deepEqual(matchHeader('❑ INGREDIENTS POUR 1 PORTION « À LA CARTE » :'), {
    type: 'ingredients', libelle: 'INGREDIENTS POUR 1 PORTION « À LA CARTE »',
  });
  assert.equal(matchHeader('EN MISE EN PLACE :').type, 'mise_en_place');
  assert.equal(matchHeader('À LA COMMANDE :').type, 'a_la_commande');
  assert.equal(matchHeader('DRESSAGE :').type, 'dressage');
  assert.equal(matchHeader('QUALITÉ :').type, 'qualite');
  assert.equal(matchHeader('MÉMO :').type, 'qualite');
  assert.deepEqual(matchHeader('POUR LA SAUCE :'), { type: 'autre', libelle: 'POUR LA SAUCE' }, 'autre : libellé conservé');
  assert.equal(matchHeader('Qualité :'), null, 'pas entièrement en majuscules');
  assert.equal(matchHeader('DRESSAGE'), null, 'sans « : »');
  assert.equal(matchHeader('12 :'), null, 'sans lettres');
  assert.ok(HEADER_KEYWORDS.length >= 5);

  // --- Pages d'un manuel (même pied de page sur plus de la moitié des pages) ---
  const hippoPages = [
    { page: 1, items: [it('MANUEL OPERATOIRE FROID', 40, 700), it('Sommaire', 40, 680), copyright(1)] },
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
        it('QUALITÉ :', 320, 690), it('Croûte fine', 320, 678),
        copyright(2),
        it('TARTE', 40, 400, 18),
        it('INGREDIENTS POUR 1 PORTION :', 40, 360), it('1 PC', 40, 348),
      ],
    },
    { page: 3, items: [it('Suite de la tarte sur la page suivante', 40, 700), copyright(3)] },
  ];

  const index = indexManualPages(hippoPages);
  assert.equal(index.niveau, 3);
  assert.equal(index.nbPages, 3);
  assert.equal(index.fiches.length, 2);
  assert.equal(index.pages.length, 3, 'chaque page non vide reste indexée (niveau 1)');
  assert.ok(index.pages.every((p) => !p.texte.includes('copyright')), 'ligne répétée absente aussi du niveau page');
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

  // Un en-tête de rubrique répété sur toutes les pages n'est jamais pris pour un pied de page.
  const headerEveryPage = indexManualPages([1, 2, 3].map((page) => ({
    page,
    items: [it(`PLAT ${page}`, 40, 780, 18), it('DRESSAGE :', 40, 740), it(`Verre ${page}`, 40, 728)],
  })));
  assert.equal(headerEveryPage.fiches.length, 3);
  assert.ok(headerEveryPage.fiches.every((f) => f.sections[0].typeRubrique === 'dressage'));

  // Un document d'une ou deux pages ne perd rien : rien n'est « répété ».
  const single = indexManualPages([{ page: 1, items: [it('PLAT', 40, 780, 18), it('Texte unique ici', 40, 740), it('Deuxième ligne', 40, 728), it('Troisième ligne', 40, 716)] }]);
  assert.equal(single.fiches[0].sections[0].texte, 'Texte unique ici\nDeuxième ligne\nTroisième ligne');

  // Sans en-têtes : fiches en un seul bloc, niveau 2.
  const level2 = indexManualPages([
    { page: 1, items: [it('SOUPE', 40, 780, 18), it('Assiette creuse', 40, 740), it('Carottes', 40, 728)] },
    { page: 2, items: [it('TARTE', 40, 780, 18), it('Pâte brisée', 40, 740)] },
  ]);
  assert.equal(level2.niveau, 2);
  assert.equal(level2.fiches.length, 2);
  assert.equal(level2.fiches[0].sections.length, 1);
  assert.equal(level2.fiches[0].sections[0].typeRubrique, 'autre');
  assert.match(level2.fiches[0].sections[0].texte, /Assiette creuse/);
  assert.match(describeLevel(level2), /sans rubriques/);

  // Sans titre : niveau 1, pages uniquement.
  const flat = indexManualPages([{ page: 1, items: [it('Texte', 10, 700), it('Autre ligne', 10, 680)] }]);
  assert.equal(flat.niveau, 1);
  assert.equal(flat.fiches.length, 0);
  assert.equal(flat.pages.length, 1);
  assert.match(describeLevel(flat), /1 pages? indexées?|1 pages indexées/);

  // En-tête inconnu : rubrique « autre » avec son libellé, niveau 3.
  const custom = indexManualPages([
    { page: 1, items: [it('RISOTTO', 40, 780, 18), it('POUR LE RIZ :', 40, 740), it('2 kg ris', 40, 728), it('MÉMO :', 320, 740), it('Parmesan', 320, 728)] },
  ]);
  assert.equal(custom.niveau, 3);
  assert.deepEqual(custom.fiches[0].sections.map((s) => [s.typeRubrique, s.libelle]), [['autre', 'POUR LE RIZ'], ['qualite', 'MÉMO']]);

  // --- Accents coupés : morceaux collés sans écart réel, NFC ---
  const accents = indexManualPages([
    { page: 1, items: [
      it('CAFÉ', 40, 780, 18),
      it('DRESSAGE :', 40, 740),
      it('Caf', 40, 728), it('é', 53.5, 728),
      it('Café', 40, 714), it('thé', 61, 714),
      it('Café noir', 40, 700),
    ] },
  ]);
  assert.deepEqual(accents.fiches[0].sections[0].texte.split('\n'), ['Café', 'Café thé', 'Café noir']);

  // --- Lignes SQL ---
  const rows = buildManualRows(index);
  assert.equal(rows.filter((r) => r.type === 'page').length, 3);
  assert.equal(rows.filter((r) => r.type === 'fiche').length, 2);
  assert.equal(rows.find((r) => r.type === 'fiche').sections[0].type_rubrique, 'ingredients');
  assert.ok(rows.filter((r) => r.type === 'fiche').every((r) => r.format_version === 3));
  assert.equal(rows.find((r) => r.type === 'fiche').sections[0].lignes[0].sous_fiche, 'creme brulee');

  // --- Adaptateur pdf.js minimal ---
  const fakeDoc = {
    numPages: 1,
    getPage: async () => ({
      getTextContent: async () => ({
        items: [
          { str: 'TITRE', transform: [18, 0, 0, 18, 40, 780], width: 50 },
          { str: 'DRESSAGE :', transform: [9, 0, 0, 9, 40, 740], width: 60 },
          { str: 'ligne un', transform: [9, 0, 0, 9, 40, 720], width: 40 },
          { str: 'ligne deux', transform: [9, 0, 0, 9, 40, 700], width: 40 },
          { marks: true },
        ],
      }),
    }),
  };
  const fromPdf = await readManualPdf(fakeDoc);
  assert.equal(fromPdf.fiches[0].titre, 'TITRE');
  assert.equal(fromPdf.fiches[0].sections[0].typeRubrique, 'dressage');
  assert.equal(fromPdf.fiches[0].sections[0].texte, 'ligne un\nligne deux');

  // --- Surlignage : termes nettoyés, sans accents ---
  const parts = highlightSegments('Crème brûlée maison', ['creme', 'brul']);
  assert.deepEqual(parts.filter((p) => p.match).map((p) => p.text), ['Crème', 'brûlée']);
  assert.equal(normalizeText('À LA COMMANDE'), 'a la commande');
  assert.deepEqual(highlightSegments('abc', []), [{ text: 'abc', match: false }]);

  // --- Lignes typées : ingrédient, étape, puce, texte ---
  assert.deepEqual(brulee.sections[0].lignes[0], {
    kind: 'ingredient', brut: '160 G SF CREME BRULEE', affichage: '160 G Creme brulee',
    quantite: '160', unite: 'G', produit: 'Creme brulee', sousFiche: 'creme brulee',
  });
  assert.equal(brulee.sections[1].lignes[0].quantite, '50');
  assert.equal(brulee.sections[1].lignes[0].produit, 'Sucre');

  const typed = parseLines(
    ['1,5 KG FARINE', '2 MINI MOUSSE AU CHOCOLAT', '1- CHAUFFER LE LAIT', 'A 80 DEGRES', '▪ PUIS REMUER', '2. SERVIR'],
    UNITS, SUB_FICHE_PREFIXES,
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
  const loose = parseLines(['- ATTENTION CHAUD', 'TEXTE LIBRE', '-18°C'], UNITS, []);
  assert.deepEqual(loose.map((l) => l.kind), ['puce', 'texte', 'texte'], 'puce sans étape, texte, valeur négative');

  // Unités : liste constante, comparaison sans casse, pluriels reconnus.
  assert.equal(parseLines(['2 KG SEL'], ['g'], [])[0].unite, undefined);
  assert.equal(parseLines(['2 kg SEL'], ['KG'], [])[0].unite, 'kg');
  assert.equal(parseLines(['3 TRANCHES JAMBON'])[0].unite, 'TRANCHES');
  assert.equal(parseLines(['2 PORTIONS RIZ'])[0].unite, 'PORTIONS');

  // Préfixe de sous-fiche : « SF » en mot isolé uniquement.
  assert.equal(parseLines(['1 SF MOUSSE CHOCOLAT'])[0].sousFiche, 'mousse chocolat');
  assert.equal(parseLines(['1 SFINGE AU SUCRE'])[0].sousFiche, undefined);
  assert.deepEqual(SUB_FICHE_PREFIXES, ['SF']);

  // Deux colonnes d'ingrédients : jamais fusionnées ligne à ligne.
  const twoCols = indexManualPages([{ page: 1, items: [
    it('GÂTEAU', 40, 780, 18),
    it('INGREDIENTS POUR 1 PORTION :', 40, 740),
    it('1 MINI MOUSSE AU CHOCOLAT', 40, 720), it('1 SUCRE BUCHETTE HIPPO 3G', 300, 720),
    it('2 FRAISES', 40, 706), it('1 MENTHE', 300, 706),
  ] }]);
  assert.deepEqual(
    twoCols.fiches[0].sections[0].lignes.map((l) => l.brut),
    ['1 MINI MOUSSE AU CHOCOLAT', '2 FRAISES', '1 SUCRE BUCHETTE HIPPO 3G', '1 MENTHE'],
    'colonne de gauche de haut en bas, puis colonne de droite',
  );

  // Tableau quantité | produit : un grand écart ne crée pas de colonnes.
  const table = indexManualPages([{ page: 1, items: [
    it('SOUPE', 40, 780, 18),
    it('INGREDIENTS POUR 1 PORTION :', 40, 740),
    it('200 G', 40, 720), it('CAROTTES', 200, 720),
    it('50 G', 40, 706), it('OIGNONS', 200, 706),
  ] }]);
  assert.deepEqual(table.fiches[0].sections[0].lignes.map((l) => l.brut), ['200 G CAROTTES', '50 G OIGNONS']);

  // --- Casse d'affichage ---
  assert.equal(toDisplayCase('CUIRE 30 MIN A 180°C AVEC 200 G DE BEURRE'), 'Cuire 30 min a 180°C avec 200 G de beurre');
  assert.equal(
    toDisplayCase('INGREDIENTS POUR 1 PORTION « À LA CARTE »', []),
    'Ingredients pour 1 portion « à la carte »',
    'intertitre de rubrique : majuscule initiale, reste en minuscules',
  );
  assert.deepEqual(splitTitle('CAFÉ GOURMAND - CAFÉ/THÉ GOURMAND'), { principal: 'CAFÉ GOURMAND', sousTitre: 'CAFÉ/THÉ GOURMAND' });
  assert.deepEqual(splitTitle('TARTE-TATIN'), { principal: 'TARTE-TATIN', sousTitre: '' });

  // --- Rapprochement tolérant des sous-fiches (sans mots vides) ---
  assert.equal(matchKey('CREME BRULEE 50 G'), matchKey('crème brûlée'));
  assert.equal(matchKey('creme brulee 50'), 'creme brulee');
  assert.equal(matchKey('Pâte à choux (base)'), 'pate choux base');
  assert.notEqual(matchKey('mousse 3 chocolats'), matchKey('mousse'));
  assert.equal(matchKey('SF MOUSSE CHOCOLAT'.replace(/^SF\s+/, '')), matchKey('MOUSSE AU CHOCOLAT'), 'MOUSSE CHOCOLAT = MOUSSE AU CHOCOLAT');
  assert.equal(matchKey("Tarte d'orange"), matchKey('TARTE ORANGE'));

  // --- Constantes : synonymes, mots vides ---
  assert.ok(STOP_WORDS.includes('au') && STOP_WORDS.includes('pour'));
  assert.ok(SYNONYMS.ingredients.includes('poids') && SYNONYMS.dressage.includes('ramequin'));

  // --- Analyse de la requête ---
  assert.deepEqual(analyzeQuery('recette mousse au chocolat'), {
    terms: ['mousse', 'chocolat'], targets: ['mise_en_place', 'a_la_commande'], vague: false,
  });
  assert.deepEqual(analyzeQuery('Poids mousse au chocolat'), { terms: ['mousse', 'chocolat'], targets: ['ingredients'], vague: false });
  assert.deepEqual(analyzeQuery('café gourmand'), { terms: ['cafe', 'gourmand'], targets: [], vague: false });
  assert.deepEqual(analyzeQuery('température brochette poulet'), {
    terms: ['brochette', 'poulet'], targets: ['mise_en_place', 'a_la_commande'], vague: false,
  });
  assert.deepEqual(analyzeQuery('la cuisson'), { terms: [], targets: ['mise_en_place', 'a_la_commande'], vague: true });
  assert.deepEqual(analyzeQuery('le la de'), { terms: [], targets: [], vague: true });
  assert.deepEqual(analyzeQuery('  '), { terms: [], targets: [], vague: false });
  assert.deepEqual(analyzeQuery('mousse mousse').terms, ['mousse'], 'doublons retirés');
  // Un synonyme n'est jamais surligné : il n'est pas dans les termes.
  const noSynonymMark = highlightSegments('Poids de la recette', analyzeQuery('poids recette').terms);
  assert.deepEqual(noSynonymMark, [{ text: 'Poids de la recette', match: false }]);

  console.log('Indexation des manuels : niveaux 1, 2 et 3, détection automatique, accents, sous-fiches, synonymes et surlignage OK.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
