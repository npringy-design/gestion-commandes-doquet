import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const sourcePath = join(root, 'src', 'utils', 'orderTemplateExtraction.ts');
const source = readFileSync(sourcePath, 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-order-template-extraction-'));

try {
  const { outputText, diagnostics = [] } = ts.transpileModule(source, {
    fileName: sourcePath,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
    },
  });
  assert.equal(
    diagnostics.length,
    0,
    diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')).join('\n'),
  );
  assert.doesNotMatch(source, /^import /m, 'Le module doit rester pur : il est aussi chargé par l’API serveur');
  assert.doesNotMatch(source, /\bany\b/, 'Le type guard ne doit utiliser aucun any');

  const compiledPath = join(tempDir, 'orderTemplateExtraction.mjs');
  writeFileSync(compiledPath, outputText, 'utf8');
  const extraction = await import(pathToFileURL(compiledPath).href);

  const columns = { code: 'Code', article: 'Articles', storage_unit: 'Unité de Stock', packaging_unit: 'Unité de conditionnement' };
  const row = (code, article, storage = 'au Kg', packaging = 'colis', uncertain = false) => ({
    code, article, storage_unit: storage, packaging_unit: packaging, uncertain,
  });
  const page = (rows, declared = rows.length, extra = {}) => ({
    has_table: true, columns, visible_row_count: declared, rows, ...extra,
  });

  // --- Réponses malformées rejetées ---
  assert.equal(extraction.isPageExtraction(page([row('1', 'Banane')])), true);
  assert.equal(extraction.isPageExtraction(null), false);
  assert.equal(extraction.isPageExtraction('texte'), false);
  assert.equal(extraction.isPageExtraction({ ...page([]), rows: 'x' }), false, 'rows doit être un tableau');
  assert.equal(extraction.isPageExtraction({ ...page([]), has_table: 'oui' }), false);
  assert.equal(extraction.isPageExtraction({ ...page([]), visible_row_count: 2.5 }), false, 'Le compte doit être entier');
  assert.equal(extraction.isPageExtraction({ ...page([]), visible_row_count: -1 }), false);
  assert.equal(extraction.isPageExtraction({ ...page([]), columns: { ...columns, article: 3 } }), false);
  assert.equal(extraction.isPageExtraction({ ...page([]), columns: undefined }), false);
  assert.equal(
    extraction.isPageExtraction(page([{ ...row('1', 'Banane'), uncertain: 'non' }])),
    false,
    'Une ligne dont uncertain n’est pas booléen doit être rejetée',
  );
  assert.equal(
    extraction.isPageExtraction(page([{ code: '1', article: 'Banane', storage_unit: 'au Kg', uncertain: false }])),
    false,
    'Une ligne incomplète doit être rejetée',
  );
  assert.equal(extraction.isColumnHint(columns), true);
  assert.equal(extraction.isColumnHint({ code: '' }), false);

  // --- Assemblage : aucune correction d'unité, seulement espaces compactés ---
  const verbatim = extraction.finalizeExtraction([
    { pageNumber: 1, extraction: page([row(' 42 ', '  Steak   haché \n 100 g ', 'ka', 'bt  x  6')]) },
  ]);
  assert.deepEqual(verbatim.rows, [
    { code: '42', article: 'Steak haché 100 g', storageUnit: 'ka', packagingUnit: 'bt x 6' },
  ]);
  assert.equal(verbatim.rows[0].storageUnit, 'ka', '« ka » doit rester « ka »');
  assert.deepEqual(verbatim.flaggedIndexes, [], 'Une ligne complète et certaine n’est pas signalée');
  assert.equal(verbatim.report.rowCount, 1);
  assert.equal(verbatim.report.declaredRowCount, 1);

  // --- Lignes sans article écartées ---
  const withoutArticle = extraction.finalizeExtraction([
    { pageNumber: 1, extraction: page([row('1', 'Banane'), row('2', '   '), row('3', '')], 3) },
  ]);
  assert.deepEqual(withoutArticle.rows.map((item) => item.code), ['1']);
  assert.deepEqual(withoutArticle.report.countMismatchPages, [1], 'Le compte annoncé diffère des lignes retenues');
  assert.deepEqual(withoutArticle.flaggedIndexes, [0], 'Un écart de comptage signale les lignes de la page');

  // --- Dédoublonnage inter-pages (code + article normalisés) ---
  const dedup = extraction.finalizeExtraction([
    { pageNumber: 1, extraction: page([row('100', 'Crème fraîche 5 L'), row('200', 'Beurre doux')]) },
    { pageNumber: 2, extraction: page([row(' 100 ', 'CREME  fraiche 5 l'), row('300', 'Sucre')]) },
  ]);
  assert.deepEqual(dedup.rows.map((item) => item.code), ['100', '200', '300'],
    'Une ligne répétée sur la page suivante ne doit être gardée qu’une fois');
  assert.equal(dedup.rows[0].article, 'Crème fraîche 5 L', 'La première occurrence est conservée telle quelle');
  const sameProductOtherCode = extraction.finalizeExtraction([
    { pageNumber: 1, extraction: page([row('100', 'Sucre')]) },
    { pageNumber: 2, extraction: page([row('101', 'Sucre')]) },
  ]);
  assert.equal(sameProductOtherCode.rows.length, 2, 'Le code fait partie de la clé de dédoublonnage');
  const samePage = extraction.finalizeExtraction([
    { pageNumber: 1, extraction: page([row('', 'Sel fin'), row('', 'Sel fin')]) },
  ]);
  assert.equal(samePage.rows.length, 2, 'Le dédoublonnage ne concerne que les pages différentes');

  // --- Règles de signalement ---
  const flags = extraction.finalizeExtraction([
    {
      pageNumber: 1,
      extraction: page([
        row('1', 'Certaine'),
        row('2', 'Incertaine', 'au Kg', 'colis', true),
        row('3', 'Stockage vide', '', 'colis'),
        row('4', 'Conditionnement vide', 'au Kg', ''),
      ]),
    },
  ]);
  assert.deepEqual(flags.flaggedIndexes, [1, 2, 3]);
  assert.equal(flags.report.flaggedRowCount, 3);

  const mismatch = extraction.finalizeExtraction([
    { pageNumber: 1, extraction: page([row('1', 'Banane'), row('2', 'Citron')], 3) },
    { pageNumber: 2, extraction: page([row('3', 'Sucre')]) },
  ]);
  assert.deepEqual(mismatch.flaggedIndexes, [0, 1], 'Seule la page dont le compte diffère est signalée');
  assert.deepEqual(mismatch.report.countMismatchPages, [1]);
  assert.equal(mismatch.report.declaredRowCount, 4);
  assert.equal(mismatch.report.rowCount, 3);

  const failed = extraction.finalizeExtraction([
    { pageNumber: 2, extraction: null },
    { pageNumber: 1, extraction: page([row('1', 'Banane')]) },
    { pageNumber: 3, extraction: null },
  ]);
  assert.deepEqual(failed.report.failedPages, [2, 3], 'Les pages en échec sont listées');
  assert.equal(failed.rows.length, 1, 'Les pages réussies sont conservées');
  assert.equal(failed.report.pageCount, 3);

  const emptyPage = extraction.finalizeExtraction([
    { pageNumber: 1, extraction: page([row('1', 'Banane')]) },
    { pageNumber: 2, extraction: { has_table: false, columns, visible_row_count: 0, rows: [] } },
  ]);
  assert.deepEqual(emptyPage.flaggedIndexes, [], 'Une page sans tableau n’est pas une erreur');

  // --- Indications de colonnes ---
  assert.deepEqual(extraction.columnHintFromExtraction(page([])), columns);
  assert.equal(extraction.columnHintFromExtraction(null), undefined);
  assert.equal(
    extraction.columnHintFromExtraction(page([], 0, { columns: { code: '', article: '', storage_unit: '', packaging_unit: '' } })),
    undefined,
    'Sans colonne reconnue, aucune indication n’est transmise',
  );

  // --- Orchestration : page 1 d'abord, puis les autres en parallèle (3 max) ---
  const calls = [];
  let running = 0;
  let maxRunning = 0;
  const okRun = await extraction.runPageExtractions({
    pageCount: 7,
    extractPage: async ({ pageNumber, columnHint }) => {
      calls.push({ pageNumber, columnHint });
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return page([row(String(pageNumber), `Produit ${pageNumber}`)]);
    },
  });
  assert.equal(calls[0].pageNumber, 1, 'La page 1 est analysée en premier');
  assert.equal(calls[0].columnHint, undefined);
  assert.ok(calls.slice(1).every((call) => call.columnHint?.article === 'Articles'),
    'Les pages suivantes reçoivent les intitulés relevés sur la page 1');
  assert.ok(maxRunning <= 3 && maxRunning >= 2, `Parallélisme borné à 3 (observé : ${maxRunning})`);
  assert.deepEqual(okRun.outcomes.map((outcome) => outcome.pageNumber), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(okRun.firstError, null);

  const partial = await extraction.runPageExtractions({
    pageCount: 4,
    extractPage: async ({ pageNumber }) => {
      if (pageNumber === 3) throw new Error('boom');
      return page([row(String(pageNumber), `Produit ${pageNumber}`)]);
    },
  });
  assert.deepEqual(partial.outcomes.map((outcome) => outcome.extraction === null), [false, false, true, false],
    'Une page en échec n’empêche pas les autres');
  assert.equal(partial.firstError instanceof Error, true);

  const fatalCalls = [];
  const fatal = await extraction.runPageExtractions({
    pageCount: 6,
    concurrency: 1,
    isFatalError: (error) => error?.status === 429,
    extractPage: async ({ pageNumber }) => {
      fatalCalls.push(pageNumber);
      if (pageNumber === 2) throw Object.assign(new Error('quota'), { status: 429 });
      return page([row(String(pageNumber), `Produit ${pageNumber}`)]);
    },
  });
  assert.deepEqual(fatalCalls, [1, 2], 'Après une erreur fatale, les pages restantes ne sont plus envoyées');
  assert.deepEqual(fatal.outcomes.filter((outcome) => outcome.extraction === null).map((outcome) => outcome.pageNumber), [2, 3, 4, 5, 6]);
  assert.equal(fatal.firstError.status, 429);

  const failedFirst = await extraction.runPageExtractions({
    pageCount: 2,
    extractPage: async ({ pageNumber, columnHint }) => {
      if (pageNumber === 1) throw new Error('page 1 en échec');
      assert.equal(columnHint, undefined, 'Sans page 1, aucune indication de colonnes');
      return page([row('2', 'Produit 2')]);
    },
  });
  assert.deepEqual(failedFirst.outcomes.map((outcome) => outcome.extraction === null), [true, false]);

  const stopped = await extraction.runPageExtractions({
    pageCount: 3,
    shouldStop: () => true,
    extractPage: async () => { throw new Error('ne doit pas être appelée'); },
  });
  assert.equal(stopped.outcomes.every((outcome) => outcome.extraction === null), true);

  // --- Aucune correction sémantique d'unité dans le flux ---
  const forbidden = /cleanImported|snapUnitToKnownWord|inferStorageUnitFromArticle|normalizeLooseUnitText/;
  const pageSource = readFileSync(join(root, 'src', 'pages', 'OrderTemplatePage.tsx'), 'utf8');
  for (const file of [
    join(root, 'src', 'utils', 'orderTemplateExtraction.ts'),
    join(root, 'src', 'utils', 'orderTemplateExtractionClient.ts'),
    join(root, 'src', 'utils', 'orderTemplatePdfPages.ts'),
    join(root, 'api', 'order-template-extract.ts'),
  ]) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), forbidden, `${file} ne doit corriger aucune unité`);
  }
  assert.doesNotMatch(pageSource, /orderTemplateParser|tesseract|extractViaOcr|extractViaText|detectBestRotation|cropOrderTemplateOcrArea/,
    'L’ancien flux OCR positionnel ne doit plus être utilisé par la page');
  assert.match(pageSource, /runPageExtractions\(/, 'La page doit analyser les pages via la lecture vision');
  assert.match(pageSource, /flaggedRowIds/, 'Les lignes à contrôler doivent être surlignées');
  assert.match(pageSource, /await validateImportFile\(file, 'order-template-pdf'\)/);
  assert.match(pageSource, /new AbortController\(\)/);
  assert.match(pageSource, /withImportTimeout\(/);

  const pdfPagesSource = readFileSync(join(root, 'src', 'utils', 'orderTemplatePdfPages.ts'), 'utf8');
  assert.match(pdfPagesSource, /ORDER_TEMPLATE_PAGE_LONG_SIDE_PX = 1800/);
  assert.match(pdfPagesSource, /ORDER_TEMPLATE_PAGE_JPEG_QUALITY = 0\.85/);
  assert.match(source, /ORDER_TEMPLATE_MAX_PAGES = 15/);

  console.log('Extraction trame vision OK : réponses validées, assemblage verbatim, signalements, dédoublonnage et orchestration protégés.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
