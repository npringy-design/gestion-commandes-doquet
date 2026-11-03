import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-cell-ocr-'));
const modules = ['cellReading', 'rasterTable', 'cellOcr'];

try {
  writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8');
  for (const name of modules) {
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
      outputText.replace(/from '\.\/(cellReading|rasterTable)'/g, "from './$1.mjs'"),
      'utf8',
    );
  }
  const ocr = await import(pathToFileURL(join(tempDir, 'cellOcr.mjs')).href);

  // Fabrique de canvas factice : enregistre les dimensions et les dessins.
  const created = [];
  const createCanvas = (width, height) => {
    const draws = [];
    const canvas = {
      width,
      height,
      draws,
      getContext: () => ({
        fillStyle: '',
        imageSmoothingEnabled: false,
        imageSmoothingQuality: 'low',
        fillRect: () => {},
        drawImage: (...args) => draws.push(args.slice(1)),
      }),
    };
    created.push(canvas);
    return canvas;
  };
  const source = { width: 2000, height: 1500, getContext: () => null };
  const rect = { x0: 100, y0: 200, x1: 300, y1: 330 }; // 200 x 130, intérieur 188 x 118 avec la marge de 6 px

  // --- Recadrage : marge de blanc de 20 px et échelle -----------------------------
  const crop1 = ocr.cropCell(createCanvas, source, rect, 1);
  assert.equal(ocr.CELL_PADDING, 20);
  assert.equal(crop1.width, 188 + 40);
  assert.equal(crop1.height, 118 + 40);
  assert.deepEqual(crop1.draws[0], [106, 206, 188, 118, 20, 20, 188, 118],
    'La zone intérieure (sans bordure) est copiée au centre, avec 20 px de blanc autour');
  const crop2 = ocr.cropCell(createCanvas, source, rect, 2);
  assert.equal(crop2.width, 376 + 40);
  assert.equal(crop2.height, 236 + 40);
  const crop15 = ocr.cropCell(createCanvas, source, rect, 1.5);
  assert.equal(crop15.width, 282 + 40);

  // --- Lectures A et B identiques : deux lectures seulement --------------------------
  const calls = [];
  const readWith = (answers) => async (canvas, variant) => {
    calls.push({ variant, width: canvas.width });
    return answers[calls.length - 1] ?? '';
  };

  let vote = await ocr.readCellText({ source, rect, createCanvas, read: readWith(['sac', 'Sac']) });
  assert.equal(calls.length, 2, 'Deux lectures identiques à la casse près suffisent');
  assert.deepEqual(vote, { text: 'sac', agreed: true });
  assert.deepEqual(calls.map((call) => call.variant), ['block', 'block']);
  assert.deepEqual(calls.map((call) => call.width).sort((a, b) => a - b), [228, 416], 'Échelles 1 et 2');

  // --- Désaccord : lectures C (échelle 3) et D (colonne, échelle 1,5) --------------------
  calls.length = 0;
  vote = await ocr.readCellText({
    source, rect, createCanvas,
    read: readWith(['Cacahuèëtes', 'Cacahuëètes', 'Cacahuètes', 'Cacahuètes']),
  });
  assert.equal(calls.length, 4, 'Un désaccord ajoute deux lectures');
  assert.deepEqual(vote, { text: 'Cacahuètes', agreed: true });
  assert.equal(calls.filter((call) => call.variant === 'block').length, 3, 'Trois lectures en bloc de texte');
  assert.equal(calls.filter((call) => call.variant === 'column').length, 1, 'Une lecture en colonne de texte');
  assert.ok(calls.some((call) => call.variant === 'column' && call.width === 282 + 40), 'La lecture en colonne est à l’échelle 1,5');
  assert.ok(calls.some((call) => call.variant === 'block' && call.width === 564 + 40), 'La lecture C est à l’échelle 3');

  // --- Désaccord persistant : signalé, jamais corrigé ---------------------------------------
  calls.length = 0;
  vote = await ocr.readCellText({
    source, rect, createCanvas,
    read: readWith(['Sorbet 2,4 L', 'Sorbet 2.4 L', 'Sorbet 2,4 L', 'Sorbet 2.4 L']),
  });
  assert.equal(vote.agreed, false, 'Deux contre deux : lectures divergentes');
  assert.equal(vote.text, 'Sorbet 2,4 L');

  // --- Réparation des mesures avant comparaison ------------------------------------------------
  calls.length = 0;
  vote = await ocr.readCellText({ source, rect, createCanvas, read: readWith(['700 mi', '700 ml']) });
  assert.equal(calls.length, 2, '« 700 mi » et « 700 ml » sont identiques après normalisation');
  assert.deepEqual(vote, { text: '700 ml', agreed: true });

  // --- Cellule vide : aucune lecture ne donne de texte ---------------------------------------------
  calls.length = 0;
  vote = await ocr.readCellText({ source, rect, createCanvas, read: readWith(['', '']) });
  assert.equal(vote.text, '');
  assert.equal(vote.agreed, false);

  // --- Intégration de la voie dans les sources ------------------------------------------------------
  const rasterScan = readFileSync(join(root, 'src', 'utils', 'orderTemplateRasterScan.ts'), 'utf8');
  assert.match(rasterScan, /MAX_WORKERS = 4/);
  assert.match(rasterScan, /Math\.min\(MAX_WORKERS, hardware - 1\)/, 'Au plus min(4, hardwareConcurrency - 1) workers');
  assert.match(rasterScan, /PSM\.SINGLE_BLOCK/);
  assert.match(rasterScan, /PSM\.SINGLE_COLUMN/);
  assert.match(rasterScan, /createScheduler\(\)/);
  assert.match(rasterScan, /COLUMN_MATCH_TOLERANCE = 8/, 'Colonnes des pages suivantes rattachées à 8 px près');
  assert.match(rasterScan, /readCellText\(\{/);
  assert.match(rasterScan, /cellHasInk\(/, 'Seules les cellules qui portent de l’encre sont lues');
  assert.match(rasterScan, /analyseTable\(gray\)/);
  assert.match(rasterScan, /detectBestRotation\(/, 'La rotation réutilise la détection existante');
  assert.doesNotMatch(rasterScan, /extractRulings|segmentsToRulings|mergeOcrExtractions|mergeTemplateExtractions|cleanImported|snapUnitToKnownWord|inferStorageUnitFromArticle/,
    'La voie cellule par cellule n’utilise pas la grille issue des traits du PDF ni les anciens correctifs d’unités');
  assert.doesNotMatch(rasterScan, /fetch\(|openai/i, 'Aucun appel externe');

  const pageSource = readFileSync(join(root, 'src', 'pages', 'OrderTemplatePage.tsx'), 'utf8');
  assert.match(pageSource, /createRasterScanSession\(/);
  assert.match(pageSource, /session\.readFirstPage\(\)/, 'La page 1 est lue avant la confirmation des colonnes');
  assert.match(pageSource, /session\.completeFirstPage\(/);
  assert.match(pageSource, /session\.readRemainingPages\(/, 'Les pages suivantes sont lues après la confirmation');
  assert.match(pageSource, /Aucun quadrillage détecté/, 'Sans quadrillage, un message clair et le repli par colonnes');
  assert.match(pageSource, /readScannedPages\(pdf/, 'Le repli par colonnes est conservé');
  assert.match(pageSource, /disposeRasterSession\(\)/, 'La session et le document sont libérés');
  assert.match(pageSource, /flaggedRowReasons\[row\.id\]/, 'La raison du signalement est affichée');
  assert.match(pageSource, /ligne\(s\) lue\(s\), \{importQualityReport\.flaggedRowCount\} à contrôler/);
  assert.match(readFileSync(join(root, 'src', 'utils', 'importProcessing.ts'), 'utf8'), /pdfScanOcr: 480_000/);

  console.log('OCR de cellule OK : recadrage, lectures multiples, vote et branchement de la voie sans texte natif protégés.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
