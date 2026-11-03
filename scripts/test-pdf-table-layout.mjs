import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-pdf-table-layout-'));
const moduleNames = ['pdfTableLayout', 'orderTemplateColumnRoles', 'orderTemplateRowExtraction', 'ocrOrientation'];

try {
  writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8');
  for (const name of moduleNames) {
    const sourcePath = join(root, 'src', 'utils', `${name}.ts`);
    const source = readFileSync(sourcePath, 'utf8');
    assert.doesNotMatch(source, /\bany\b/, `${name} ne doit utiliser aucun any`);
    const { outputText, diagnostics = [] } = ts.transpileModule(source, {
      fileName: sourcePath,
      reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
    });
    assert.equal(
      diagnostics.length,
      0,
      diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')).join('\n'),
    );
    writeFileSync(
      join(tempDir, `${name}.mjs`),
      outputText.replace(/from '\.\/(pdfTableLayout|orderTemplateColumnRoles)'/g, "from './$1.mjs'"),
      'utf8',
    );
  }
  const layoutLib = await import(pathToFileURL(join(tempDir, 'pdfTableLayout.mjs')).href);
  const rolesLib = await import(pathToFileURL(join(tempDir, 'orderTemplateColumnRoles.mjs')).href);
  const rowsLib = await import(pathToFileURL(join(tempDir, 'orderTemplateRowExtraction.mjs')).href);
  const orientationLib = await import(pathToFileURL(join(tempDir, 'ocrOrientation.mjs')).href);

  // Aucune correction sémantique d'unité, aucune IA, aucune API dans ces modules.
  const forbidden = /cleanImported|snapUnitToKnownWord|inferStorageUnitFromArticle|mergeOcrExtractions|mergeTemplateExtractions|openai|fetch\(/i;
  for (const name of moduleNames) {
    assert.doesNotMatch(readFileSync(join(root, 'src', 'utils', `${name}.ts`), 'utf8'), forbidden, `${name} doit rester déterministe`);
  }

  // --- Jeux synthétiques -------------------------------------------------
  const PDF_OPS = {
    save: 10, restore: 11, transform: 12, constructPath: 91,
    paintFormXObjectBegin: 74, paintFormXObjectEnd: 75,
    stroke: 20, closeStroke: 21, fill: 22, eoFill: 23,
    fillStroke: 24, eoFillStroke: 25, closeFillStroke: 26, closeEOFillStroke: 27,
  };
  const COLUMN_EDGES = [0, 60, 260, 370, 460];
  const ROW_EDGES = [0, 30, 70, 110, 150];
  const w = (text, x, yTop, width = text.length * 6, height = 10) => ({ text, x, yTop, width, height });

  // Une cellule de plusieurs mots est restituée mot par mot, séparés par 6 pt.
  const t = (text, x, yTop) => {
    let cursor = x;
    return text.split(' ').map((token) => {
      const word = w(token, cursor, yTop);
      cursor += word.width + 6;
      return word;
    });
  };
  const headerWords = [
    ...t('Code', 10, 10), ...t('Articles', 100, 10), ...t('Unité de Stock', 270, 8),
    ...t('Unité de', 380, 8), ...t('conditionnement', 380, 16),
  ];
  const upright = [
    ...headerWords,
    // Produit 1 : libellé sur trois lignes physiques.
    ...t('100001', 10, 45), ...t('Steak haché', 70, 33), ...t('façon bouchère', 70, 45), ...t('100 g', 70, 57),
    ...t('au Kg', 270, 45), ...t('carton x 6', 380, 45),
    // Produits 2 et 3.
    ...t('100002', 10, 85), ...t('Beurre doux', 70, 85), ...t('au Kg', 270, 85), ...t('plaque', 380, 85),
    ...t('100003', 10, 125), ...t('Crème liquide', 70, 119), ...t('1 L', 70, 131), ...t('au L', 270, 125), ...t('brique', 380, 125),
  ];

  // Rectangle fin (trait) en coordonnées PDF, dans le format de tracé de pdf.js ≥ 5.
  const rectPath = (x0, y0, x1, y1) => new Float32Array([0, x0, y0, 1, x1, y0, 1, x1, y1, 1, x0, y1, 4]);
  const fromUpright = (u, vd, angle) => ({
    x: u * Math.cos(angle) + vd * Math.sin(angle),
    y: u * Math.sin(angle) - vd * Math.cos(angle),
  });

  const buildOperatorList = (angle, rowEdges = ROW_EDGES, columnEdges = COLUMN_EDGES) => {
    const fnArray = [];
    const argsArray = [];
    const pushRect = (corners) => {
      const xs = corners.map((point) => point.x);
      const ys = corners.map((point) => point.y);
      fnArray.push(PDF_OPS.constructPath);
      argsArray.push([PDF_OPS.fill, [rectPath(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys))], null]);
    };
    const height = rowEdges[rowEdges.length - 1];
    const width = columnEdges[columnEdges.length - 1];
    rowEdges.forEach((v) => pushRect([
      fromUpright(0, v - 0.5, angle), fromUpright(width, v - 0.5, angle),
      fromUpright(width, v + 0.5, angle), fromUpright(0, v + 0.5, angle),
    ]));
    columnEdges.forEach((u) => pushRect([
      fromUpright(u - 0.5, 0, angle), fromUpright(u + 0.5, 0, angle),
      fromUpright(u + 0.5, height, angle), fromUpright(u - 0.5, height, angle),
    ]));
    return { fnArray, argsArray };
  };

  const toTextItems = (words, angle) => words.map((word) => {
    const origin = fromUpright(word.x, word.yTop + word.height, angle);
    return {
      str: word.text,
      transform: [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), origin.x, origin.y],
      width: word.width,
      height: word.height,
    };
  });

  const productRows = (layout) => layout.rows.slice(layout.bodyStart);

  // --- Grille 3 colonnes, libellé sur 3 lignes : un seul produit ---------
  const grid = layoutLib.buildGrid(layoutLib.extractRulings(buildOperatorList(0), PDF_OPS, 0).map((ruling) => ruling));
  assert.ok(grid, 'Une grille de 4 colonnes et 4 lignes doit être reconnue');
  const gridLayout = layoutLib.buildTable(
    layoutLib.normalizePageOrientation(toTextItems(upright, 0)).words,
    grid,
  );
  assert.equal(gridLayout.source, 'grille');
  assert.equal(productRows(gridLayout).length, 3, 'Une bande de ligne = un produit');
  assert.equal(productRows(gridLayout)[0][1], 'Steak haché façon bouchère 100 g',
    'Le libellé sur trois lignes physiques est fusionné avec des espaces');
  assert.equal(productRows(gridLayout)[0][2], 'au Kg');
  assert.equal(productRows(gridLayout)[0][3], 'carton x 6');
  assert.equal(gridLayout.bodyStart, 1, 'L’en-tête est isolé par la colonne Code');

  // --- Contenu pivoté à 90° : même tableau --------------------------------
  const angle90 = Math.PI / 2;
  const rotated = layoutLib.normalizePageOrientation(toTextItems(upright, angle90));
  assert.ok(Math.abs(rotated.angle - angle90) < 1e-9, 'L’angle dominant du texte est détecté');
  const rotatedGrid = layoutLib.buildGrid(layoutLib.extractRulings(buildOperatorList(angle90), PDF_OPS, rotated.angle));
  assert.ok(rotatedGrid, 'Les traits pivotés doivent former la même grille');
  const rotatedLayout = layoutLib.buildTable(rotated.words, rotatedGrid);
  assert.deepEqual(rotatedLayout.rows, gridLayout.rows, 'Un tableau pivoté à 90° donne les mêmes cellules');
  assert.equal(rotatedLayout.bodyStart, gridLayout.bodyStart);

  // Rotation de 270° (texte lisible de haut en bas)
  const angle270 = -Math.PI / 2;
  const rotated270 = layoutLib.normalizePageOrientation(toTextItems(upright, angle270));
  assert.deepEqual(
    layoutLib.buildTable(rotated270.words, layoutLib.buildGrid(layoutLib.extractRulings(buildOperatorList(angle270), PDF_OPS, rotated270.angle))).rows,
    gridLayout.rows,
    'Un tableau pivoté à -90° donne les mêmes cellules',
  );

  // --- Transformations courantes appliquées aux traits ---------------------
  const translated = {
    fnArray: [PDF_OPS.save, PDF_OPS.transform, PDF_OPS.constructPath, PDF_OPS.restore, PDF_OPS.constructPath],
    argsArray: [
      null,
      [1, 0, 0, 1, 100, 50],
      [PDF_OPS.fill, [rectPath(0, 0, 80, 1)], null],
      null,
      [PDF_OPS.fill, [rectPath(0, 0, 80, 1)], null],
    ],
  };
  const translatedRulings = layoutLib.extractRulings(translated, PDF_OPS, 0);
  assert.equal(translatedRulings.length, 2, 'Deux traits horizontaux, l’un décalé par la transformation');
  const positions = translatedRulings.map((ruling) => ruling.start).sort((a, b) => a - b);
  assert.deepEqual(positions, [0, 100], 'La transformation courante est appliquée puis annulée par restore');

  // --- Seuils : traits fins seulement, tracés courbes et clips ignorés -------
  const noisy = {
    fnArray: [PDF_OPS.constructPath, PDF_OPS.constructPath, PDF_OPS.constructPath, PDF_OPS.constructPath],
    argsArray: [
      [PDF_OPS.fill, [rectPath(0, 0, 200, 40)], null], // grande cellule remplie : pas un trait
      [PDF_OPS.fill, [rectPath(0, 0, 1, 8)], null], // lettre « l » : trop court pour la grille mais segment valide
      [PDF_OPS.fill, [new Float32Array([0, 0, 0, 2, 5, 5, 5, 5, 10, 10, 4])], null], // courbe
      [28, [rectPath(0, 0, 100, 1)], null], // rognage (endPath) : ignoré
    ],
  };
  const noisyRulings = layoutLib.extractRulings(noisy, PDF_OPS, 0);
  assert.equal(noisyRulings.length, 1, 'Seule la barre verticale de 1 x 8 pt est un segment');
  assert.equal(layoutLib.buildGrid(noisyRulings), null, 'Un segment de 8 pt ne forme pas une grille');

  // Ancien format de tracé (pdf.js ≤ 4) : opérateurs puis coordonnées, sans opérateur de peinture
  const legacyRulings = layoutLib.extractRulings(
    { fnArray: [PDF_OPS.constructPath], argsArray: [[[13, 14], [10, 20, 90, 20]]] },
    PDF_OPS,
    0,
  );
  assert.equal(legacyRulings.length, 1, 'Un trait tracé au format historique est reconnu');
  const legacyRect = layoutLib.extractRulings(
    { fnArray: [PDF_OPS.constructPath], argsArray: [[[19], [10, 20, 80, 1]]] },
    PDF_OPS,
    0,
  );
  assert.equal(legacyRect.length, 1, 'Un rectangle fin au format historique est reconnu');

  // Fusion de segments colinéaires
  const split = {
    fnArray: [PDF_OPS.constructPath, PDF_OPS.constructPath, PDF_OPS.constructPath],
    argsArray: [
      [PDF_OPS.fill, [rectPath(0, 10, 50, 11)], null],
      [PDF_OPS.fill, [rectPath(50.5, 10, 120, 11)], null],
      [PDF_OPS.fill, [rectPath(200, 10, 260, 11)], null],
    ],
  };
  const mergedRulings = layoutLib.extractRulings(split, PDF_OPS, 0);
  assert.equal(mergedRulings.length, 2, 'Les segments colinéaires qui se touchent sont fusionnés');

  // --- Grille dont la dernière ligne n'a pas de trait de fermeture ----------
  const openBottomRows = [0, 30, 70, 110];
  const openGrid = layoutLib.buildGrid(layoutLib.extractRulings(
    (() => {
      const base = buildOperatorList(0, ROW_EDGES, COLUMN_EDGES);
      const keep = base.fnArray.map((_, index) => index).filter((index) => {
        if (index >= ROW_EDGES.length) return true;
        return openBottomRows.includes(ROW_EDGES[index]);
      });
      return { fnArray: keep.map((index) => base.fnArray[index]), argsArray: keep.map((index) => base.argsArray[index]) };
    })(),
    PDF_OPS,
    0,
  ));
  assert.ok(openGrid && openGrid.rowEdges.length === ROW_EDGES.length,
    'La dernière bande est fermée par l’étendue des traits verticaux');

  // --- Sans grille : colonnes par espaces, produit ancré sur le Code --------
  const noGridLayout = layoutLib.buildTable(upright, null);
  assert.equal(noGridLayout.source, 'colonnes');
  assert.equal(noGridLayout.bodyStart, 2, 'Les deux lignes physiques d’en-tête précèdent le premier code');
  const noGridProducts = productRows(noGridLayout);
  assert.equal(noGridProducts.length, 3);
  const articleColumn = noGridLayout.columns.findIndex((column) => noGridProducts[0][column.index].includes('Steak'));
  assert.ok(articleColumn >= 0);
  assert.equal(noGridProducts[0][articleColumn], 'Steak haché façon bouchère 100 g',
    'Les lignes sans ancre se rattachent à l’ancre la plus proche verticalement');
  assert.equal(noGridProducts[2][articleColumn], 'Crème liquide 1 L');
  const edges = layoutLib.detectColumnsByWhitespace(upright);
  assert.ok(edges && edges.length === 5, `Quatre colonnes séparées par des espaces (observé : ${edges?.length - 1})`);

  // Une ligne éloignée de toute ancre (pied de page) n'est pas collée à un produit
  const withFooter = layoutLib.buildTable([...upright, w('https://exemple.test/bon', 70, 400)], null);
  assert.ok(productRows(withFooter).length >= 4, 'Un pied de page reste une ligne à part');
  assert.equal(productRows(withFooter)[2][articleColumn], 'Crème liquide 1 L');

  // Sans grille ni assez de mots : pas de tableau
  assert.equal(layoutLib.buildTable([], null), null);
  assert.equal(layoutLib.detectColumnsByWhitespace([w('seul', 0, 0)]), null);

  // Colonnes imposées par la page précédente
  const hinted = layoutLib.buildTable([...t('100009', 10, 10), ...t('Sucre', 70, 10), ...t('au Kg', 270, 10), ...t('sac', 380, 10)], null, COLUMN_EDGES);
  assert.equal(hinted.columns.length, 4, 'Une page sans grille reprend les colonnes de la page précédente');
  assert.equal(hinted.rows[hinted.bodyStart][1], 'Sucre');

  // --- Codes : bordure OCR, préfixe de lettres -----------------------------
  assert.equal(layoutLib.isCodeCell('288031 |'), true, 'Une barre de bordure OCR ne fait pas perdre le code');
  assert.equal(layoutLib.isCodeCell('COJ-123217'), true);
  assert.equal(layoutLib.isCodeCell('12'), false);
  assert.equal(layoutLib.isCodeCell('Steak 100'), false);

  // --- Rôles de colonnes ---------------------------------------------------
  const layoutOf = (headers, productCells = []) => ({
    source: 'grille',
    columns: headers.map((headerText, index) => ({ index, headerText, xStart: index * 100, xEnd: index * 100 + 100 })),
    rows: [headers, ...productCells],
    bodyStart: 0,
  });
  const sample = (article, storage, packaging) => [['Produit test', storage, packaging, article].slice(0, 3)];

  const synonyms = [
    [['Désignation', 'Unité de commande', 'Colisage'], ['article', 'storageUnit', 'packagingUnit']],
    [['Libellé', 'Unité de stockage', 'Conditionnement'], ['article', 'storageUnit', 'packagingUnit']],
    [['Produit', 'Unité', 'Cond.'], ['article', 'storageUnit', 'packagingUnit']],
    [['Description', 'Unité de stock', 'UC'], ['article', 'storageUnit', 'packagingUnit']],
    [['Articles', 'Unité de Stock', 'Unité de conditionnement'], ['article', 'storageUnit', 'packagingUnit']],
    [['ARTICLE', 'UNITÉ DE STOCKAGE', 'CONDITIONNEMENT'], ['article', 'storageUnit', 'packagingUnit']],
  ];
  for (const [headers, expected] of synonyms) {
    const suggestion = rolesLib.suggestColumnRoles(layoutOf(headers, sample('x', 'au Kg', 'colis')));
    assert.deepEqual(suggestion.roles, expected, `Synonymes reconnus : ${headers.join(' / ')}`);
    assert.equal(suggestion.overall, 'sure', `Un seul candidat par rôle : ${headers.join(' / ')}`);
  }

  // En-tête reconnu sur plusieurs lignes, colonne Code et colonne de saisie ignorée
  const codeLayout = {
    source: 'grille',
    columns: ['Code', 'Articles', 'Stock Tampon', 'Unité de Stock', 'Unité de conditionnement']
      .map((headerText, index) => ({ index, headerText: '', xStart: index * 100, xEnd: index * 100 + 100 })),
    rows: [
      ['Code', 'Articles', 'Stock Tampon', 'Unité de Stock', 'Unité de conditionnement'],
      ['100001', 'Steak', '', 'au Kg', 'carton'],
      ['100002', 'Beurre', '', 'au Kg', 'plaque'],
      ['100003', 'Crème', '', 'au L', 'brique'],
    ],
    bodyStart: 1,
  };
  const codeSuggestion = rolesLib.suggestColumnRoles(codeLayout);
  assert.deepEqual(codeSuggestion.roles, ['code', 'article', 'ignore', 'storageUnit', 'packagingUnit']);
  assert.equal(codeSuggestion.overall, 'sure');

  // Deux colonnes candidates pour un même rôle : suggestion incertaine
  const ambiguous = rolesLib.suggestColumnRoles(layoutOf(['Article', 'Désignation', 'Unité de stock', 'Conditionnement']));
  assert.equal(ambiguous.overall, 'unsure', 'Deux colonnes candidates pour l’article donnent unsure');
  assert.deepEqual(ambiguous.confidence.slice(0, 2), ['unsure', 'unsure']);
  assert.equal(ambiguous.roles.filter((role) => role === 'article').length, 1, 'Un seul rôle article est attribué');

  // Rôle absent : incertain, rien n'est deviné
  const missing = rolesLib.suggestColumnRoles(layoutOf(['Article', 'Unité de stock', 'Quantité']));
  assert.equal(missing.overall, 'unsure');
  assert.equal(missing.roles[2], 'ignore');

  // « Unité de conditionnement » n'est jamais prise pour une unité de stockage
  assert.deepEqual(rolesLib.matchHeaderRoles('Unité de conditionnement'), ['packagingUnit']);
  assert.deepEqual(rolesLib.matchHeaderRoles('Unité de Stock'), ['storageUnit']);
  assert.deepEqual(rolesLib.matchHeaderRoles('Stock Tampon'), []);

  // Mémorisation par fournisseur
  const storedMapping = rolesLib.buildStoredMapping(['Désignation', 'Unité de commande', 'Colisage', ''], ['article', 'storageUnit', 'packagingUnit', 'ignore']);
  assert.deepEqual(storedMapping, { designation: 'article', 'unite de commande': 'storageUnit', colisage: 'packagingUnit' });
  assert.deepEqual(
    rolesLib.applyStoredMapping(storedMapping, ['DÉSIGNATION', 'Unité de commande', 'Colisage', ''], ['ignore', 'ignore', 'ignore', 'code']),
    ['article', 'storageUnit', 'packagingUnit', 'code'],
    'Les intitulés normalisés (sans accent ni casse) retrouvent leurs rôles',
  );
  assert.equal(rolesLib.applyStoredMapping(storedMapping, ['Désignation', 'Autre', 'Colisage'], []), null,
    'Un intitulé inconnu invalide le choix mémorisé');
  assert.equal(rolesLib.applyStoredMapping(null, ['Désignation'], []), null);

  const memory = new Map();
  const fakeStorage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  assert.equal(rolesLib.saveStoredColumnMapping('doquet', storedMapping, fakeStorage), true);
  assert.ok(memory.has('orderTemplateColumnMapping:doquet'), 'Clé orderTemplateColumnMapping:{supplierId}');
  assert.deepEqual(rolesLib.loadStoredColumnMapping('doquet', fakeStorage), storedMapping);
  assert.equal(rolesLib.loadStoredColumnMapping('autre', fakeStorage), null);
  memory.set('orderTemplateColumnMapping:abime', '{pas du json');
  assert.equal(rolesLib.loadStoredColumnMapping('abime', fakeStorage), null, 'Un stockage corrompu est ignoré');
  const failingStorage = { getItem: () => { throw new Error('refusé'); }, setItem: () => { throw new Error('quota'); } };
  assert.equal(rolesLib.loadStoredColumnMapping('doquet', failingStorage), null, 'Lecture protégée par try/catch');
  assert.equal(rolesLib.saveStoredColumnMapping('doquet', storedMapping, failingStorage), false, 'Écriture protégée par try/catch');
  assert.equal(rolesLib.loadStoredColumnMapping('doquet', null), null);

  // Code mal lu : le produit n'est pas pris pour un en-tête
  const garbledCode = {
    source: 'grille',
    columns: codeLayout.columns,
    rows: [
      ['Code', 'Articles', 'Stock Tampon', 'Unité de Stock', 'Unité de conditionnement'],
      ['10O001', 'Steak haché', '', 'au Kg', 'carton'],
      ['100002', 'Beurre', '', 'au Kg', 'plaque'],
      ['100003', 'Crème', '', 'au L', 'brique'],
      ['100004', 'Sucre', '', 'au Kg', 'sac'],
    ],
    bodyStart: 2,
  };
  assert.equal(rolesLib.resolveBodyStart(garbledCode), 1, 'Un produit au code illisible reste dans le corps du tableau');

  // --- Extraction des lignes ------------------------------------------------
  const rolesForCodeLayout = codeSuggestion.roles;
  const extracted = rowsLib.extractTemplateRows([codeLayout], rolesForCodeLayout, codeSuggestion.headerTexts);
  assert.equal(extracted.rows.length, 3);
  assert.equal(extracted.flaggedCount, 0);
  assert.deepEqual(extracted.rows[0], { code: '100001', article: 'Steak', storageUnit: 'au Kg', packagingUnit: 'carton', reasons: [] });

  // « ka » conservé tel quel, signalé et jamais corrigé
  const kaLayout = { ...codeLayout, rows: [...codeLayout.rows, ['100004', 'Farine   de   blé', '', 'ka', 'sac']] };
  const kaExtracted = rowsLib.extractTemplateRows([kaLayout], rolesForCodeLayout, codeSuggestion.headerTexts);
  const kaRow = kaExtracted.rows.find((row) => row.code === '100004');
  assert.equal(kaRow.storageUnit, 'ka', 'La valeur « ka » est recopiée telle quelle');
  assert.equal(kaRow.article, 'Farine de blé', 'Seuls les espaces sont compactés');
  assert.deepEqual(kaRow.reasons, ['unité de stockage inattendue'], 'La valeur « ka » est signalée à contrôler');
  assert.equal(kaExtracted.flaggedCount, 1);

  // Cellules vides signalées
  const emptyLayout = { ...codeLayout, rows: [codeLayout.rows[0], ['100005', '', '', '', ''], ['100006', 'Sel', '', '', 'sac']] };
  const emptyExtracted = rowsLib.extractTemplateRows([emptyLayout], rolesForCodeLayout, codeSuggestion.headerTexts);
  assert.deepEqual(emptyExtracted.rows[0].reasons, ['article vide', 'unité de stockage vide', 'conditionnement vide']);
  assert.deepEqual(emptyExtracted.rows[1].reasons, ['unité de stockage vide']);

  // En-tête répété sur la page 2 : ignoré
  const page2 = {
    ...codeLayout,
    rows: [codeLayout.rows[0], ['100007', 'Poivre', '', 'au Kg', 'boîte']],
    bodyStart: 0,
  };
  const twoPages = rowsLib.extractTemplateRows([codeLayout, page2], rolesForCodeLayout, codeSuggestion.headerTexts);
  assert.equal(twoPages.rows.length, 4, 'L’en-tête répété de la page 2 n’est pas importé comme produit');
  assert.equal(twoPages.rows[3].article, 'Poivre');
  assert.ok(twoPages.rows.every((row) => row.article.toLowerCase() !== 'articles'));

  // Colonnes de la page 2 décalées : rattachées par leur position horizontale
  const shifted = {
    source: 'grille',
    columns: codeLayout.columns.map((column) => ({ ...column, xStart: column.xStart + 8, xEnd: column.xEnd + 8 })),
    rows: [['100008', 'Thym', '', 'au Kg', 'sachet']],
    bodyStart: 0,
  };
  const shiftedExtracted = rowsLib.extractTemplateRows([codeLayout, shifted], rolesForCodeLayout, codeSuggestion.headerTexts);
  assert.equal(shiftedExtracted.rows.at(-1).article, 'Thym');
  assert.equal(shiftedExtracted.rows.at(-1).packagingUnit, 'sachet');

  // Aperçu et colonnes visibles
  assert.equal(rolesLib.getPreviewRows(codeLayout, 1).length, 3);
  assert.equal(rolesLib.getPreviewRows(codeLayout, 1, 2).length, 2);
  assert.deepEqual(rolesLib.getNonEmptyColumnIndexes(codeLayout, 1), [0, 1, 3, 4],
    'La colonne « Stock Tampon », vide dans le corps du tableau, n’est pas proposée');
  const withEmptyColumns = { ...codeLayout, columns: [...codeLayout.columns, { index: 5, headerText: '', xStart: 500, xEnd: 600 }], rows: codeLayout.rows.map((row) => [...row, '']) };
  assert.ok(!rolesLib.getNonEmptyColumnIndexes(withEmptyColumns, 1).includes(5), 'Une colonne de saisie vide n’est pas affichée');

  // --- Orientation d'une page lue par OCR ------------------------------------
  const shape = (text, width, height) => ({ text, width, height });
  const wideWords = Array.from({ length: 10 }, (_, index) => shape(`mot${index}`, 40, 12));
  const tallWords = Array.from({ length: 10 }, (_, index) => shape(`mot${index}`, 12, 40));
  assert.equal(orientationLib.isSidewaysWords(wideWords), false);
  assert.equal(orientationLib.isSidewaysWords(tallWords), true, 'Des mots plus hauts que larges : page lue de côté');
  assert.equal(orientationLib.isSidewaysWords(tallWords.slice(0, 3)), false, 'Trop peu de mots pour conclure');
  assert.equal(orientationLib.isSidewaysWords([...tallWords.map((word) => ({ ...word, text: 'a' })), ...wideWords.slice(0, 2)]), false,
    'Les mots de moins de 3 caractères ne comptent pas');

  // Cas réel : la lecture de côté (180°) a une confiance égale à la lecture à l'endroit (90°)
  assert.equal(
    orientationLib.pickBestRotation([
      { degrees: 0, confidence: 42, sideways: true },
      { degrees: 90, confidence: 93, sideways: false },
      { degrees: 180, confidence: 93.5, sideways: true },
      { degrees: 270, confidence: 46, sideways: false },
    ]),
    90,
    'Une orientation lue de côté n’est jamais retenue, même avec la meilleure confiance',
  );
  assert.equal(orientationLib.pickBestRotation([
    { degrees: 0, confidence: 80, sideways: false },
    { degrees: 90, confidence: 80, sideways: false },
  ]), 0, 'À égalité, la première orientation est gardée');
  assert.equal(orientationLib.pickBestRotation([
    { degrees: 0, confidence: 30, sideways: true },
    { degrees: 180, confidence: 60, sideways: true },
  ]), 180, 'Si aucune orientation n’est sûre, la plus confiante est retenue');
  assert.equal(orientationLib.pickBestRotation([]), 0);

  // Position d'un point après rotation horaire (image de 100 x 60)
  const at = (x, y, degrees) => orientationLib.rotatePoint(x, y, degrees, 100, 60);
  assert.deepEqual(at(0, 0, 0), { x: 0, y: 0 });
  assert.deepEqual(at(0, 0, 90), { x: 60, y: 0 }, 'Rotation horaire de 90° : le coin haut-gauche passe en haut à droite');
  assert.deepEqual(at(100, 0, 90), { x: 60, y: 100 });
  assert.deepEqual(at(0, 60, 90), { x: 0, y: 0 });
  assert.deepEqual(at(0, 0, 180), { x: 100, y: 60 });
  assert.deepEqual(at(0, 0, 270), { x: 0, y: 100 }, 'Rotation de 270° : le coin haut-gauche passe en bas à gauche');
  assert.deepEqual(at(100, 0, 270), { x: 0, y: 0 });
  assert.deepEqual(at(0, 60, 270), { x: 60, y: 100 });

  // Intégration dans la page : confirmation, mémorisation, surlignage, scan
  const pageSource = readFileSync(join(root, 'src', 'pages', 'OrderTemplatePage.tsx'), 'utf8');
  assert.match(pageSource, /await validateImportFile\(file, 'order-template-pdf'\)/);
  assert.match(pageSource, /new AbortController\(\)/);
  assert.match(pageSource, /withImportTimeout\(/);
  assert.match(pageSource, /flaggedRowIds/);
  assert.match(pageSource, /PDF scanné : lecture moins fiable, contrôle obligatoire\./);
  assert.match(pageSource, /saveStoredColumnMapping\(selectedSupplierId/);
  assert.match(pageSource, /!scanned && pending\.allSure/, 'Un PDF scanné exige toujours la confirmation des colonnes');
  assert.doesNotMatch(pageSource, /orderTemplateParser|\/api\/order-template-extract|openai|fetch\(/i,
    'La page ne doit appeler ni l’ancien parseur ni une API externe');
  const sourceFile = readFileSync(join(root, 'src', 'utils', 'orderTemplatePdfSource.ts'), 'utf8');
  assert.match(sourceFile, /NATIVE_TEXT_MIN_CHARS = 20/);
  assert.match(sourceFile, /pickBestRotation\(candidates\)/, 'L’orientation est choisie sans se fier à la seule confiance');
  assert.match(sourceFile, /isSidewaysWords\(collectOcrWords\(data\.blocks\)\)/, 'Une page encore lue de côté est refusée plutôt que mal importée');
  assert.match(sourceFile, /import\('tesseract\.js'\)/, 'Tesseract reste chargé à la demande pour les PDF scannés');
  assert.doesNotMatch(sourceFile, /fetch\(|openai/i);

  console.log('Lecture tableau PDF OK : orientation, grille, colonnes, rôles, mémorisation et signalements protégés.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
