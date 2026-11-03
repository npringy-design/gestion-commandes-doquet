import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const sourcePath = join(root, 'src', 'utils', 'rasterTable.ts');
const source = readFileSync(sourcePath, 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'gestion-raster-table-'));

try {
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
  assert.doesNotMatch(source, /^import /m, 'Le module doit rester pur et sans dépendance');
  assert.doesNotMatch(source, /\bany\b/, 'Aucun any');

  const compiledPath = join(tempDir, 'rasterTable.mjs');
  writeFileSync(compiledPath, outputText, 'utf8');
  const raster = await import(pathToFileURL(compiledPath).href);

  // --- Images synthétiques : octets dessinés à la main, aucun fichier image ----
  const createImage = (width, height) => ({ width, height, data: new Uint8Array(width * height).fill(255) });
  const fill = (image, x0, y0, x1, y1, level = 0) => {
    for (let y = Math.max(0, y0); y < Math.min(image.height, y1); y += 1) {
      for (let x = Math.max(0, x0); x < Math.min(image.width, x1); x += 1) image.data[y * image.width + x] = level;
    }
  };
  const hLine = (image, y, x0, x1, level = 0, thickness = 3) => fill(image, x0, y, x1 + 1, y + thickness, level);
  const vLine = (image, x, y0, y1, level = 0, thickness = 3) => fill(image, x, y0, x + thickness, y1 + 1, level);
  const near = (value, expected, tolerance = 4) => Math.abs(value - expected) <= tolerance;

  // Un mot dessiné : bloc sombre dans une cellule
  const ink = (image, rect, level = 60) => fill(image, rect.x0 + 20, rect.y0 + 30, rect.x0 + 90, rect.y0 + 50, level);

  const COLUMN_X = [50, 250, 450, 650, 850];

  // --- Conversion en niveaux de gris ------------------------------------------------
  const rgba = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255]);
  const gray = raster.toGrayImage(rgba, 4, 1);
  assert.deepEqual([...gray.data], [255, 0, 76, 150], 'Luminance pondérée (blanc, noir, rouge, vert)');

  // --- 1. Grille avec en-tête fusionné : traits d'en-tête plus courts ---------------
  const withHeader = createImage(1000, 900);
  for (let y = 100; y <= 800; y += 100) hLine(withHeader, y, 50, 850);
  [50, 250, 850].forEach((x) => vLine(withHeader, x, 100, 803)); // pleine hauteur, en-tête compris
  [450, 650].forEach((x) => vLine(withHeader, x, 200, 803)); // sous la cellule fusionnée : corps seulement
  const headerStructure = raster.analyseTable(withHeader);
  assert.ok(headerStructure, 'Une grille avec en-tête doit être reconnue');
  assert.equal(headerStructure.columnEdges.length, 5, 'Quatre colonnes');
  COLUMN_X.forEach((x, index) => assert.ok(near(headerStructure.columnEdges[index], x + 1), `Trait vertical ${index}`));
  assert.equal(headerStructure.headerPresent, true);
  assert.equal(headerStructure.rows.length, 6, 'Six lignes de corps sous l’en-tête');
  assert.ok(near(headerStructure.rows[0].y0, 201) && near(headerStructure.rows[0].y1, 301), 'La première ligne du corps commence sous l’en-tête');
  assert.ok(headerStructure.headerCells[0], 'La première colonne possède sa cellule d’en-tête');
  assert.ok(near(headerStructure.headerCells[0].y0, 101) && near(headerStructure.headerCells[0].y1, 201));
  assert.equal(headerStructure.headerCells[1], null, 'Une colonne sans trait d’en-tête propre n’a pas de cellule d’en-tête');
  assert.equal(headerStructure.headerCells.length, 4);

  // Géométrie des cellules
  const cell = raster.cellRect(headerStructure, 2, 1);
  assert.ok(near(cell.x0, 251) && near(cell.x1, 451) && near(cell.y0, 401) && near(cell.y1, 501));
  const inner = raster.innerRect(cell);
  assert.ok(inner.x0 > cell.x0 && inner.y0 > cell.y0 && inner.x1 < cell.x1 && inner.y1 < cell.y1, 'La zone intérieure exclut la bordure');

  // --- 2. Grille sans en-tête, bande vide sans bordure en haut ----------------------
  const noHeader = createImage(1000, 900);
  for (let y = 200; y <= 800; y += 100) hLine(noHeader, y, 50, 850);
  COLUMN_X.forEach((x) => vLine(noHeader, x, 100, 803));
  const noHeaderStructure = raster.analyseTable(noHeader);
  assert.ok(noHeaderStructure);
  assert.equal(noHeaderStructure.headerPresent, false, 'Tous les traits partent du même point : pas d’en-tête');
  assert.equal(noHeaderStructure.rows.length, 7, 'La bande sans bordure en haut est ajoutée');
  assert.ok(near(noHeaderStructure.rows[0].y0, 101) && near(noHeaderStructure.rows[0].y1, 201));
  assert.ok(noHeaderStructure.headerCells.every((headerCell) => headerCell === null));
  ink(noHeader, raster.cellRect(noHeaderStructure, 1, 0));
  assert.equal(raster.cellHasInk(noHeader, raster.cellRect(noHeaderStructure, 0, 0)), false, 'La bande vide du haut n’a pas d’encre');
  assert.equal(raster.cellHasInk(noHeader, raster.cellRect(noHeaderStructure, 1, 0)), true);

  // --- 3. Dernière page à une seule ligne ---------------------------------------------
  const singleRow = createImage(1000, 400);
  [100, 230].forEach((y) => hLine(singleRow, y, 50, 650));
  [50, 250, 450, 650].forEach((x) => vLine(singleRow, x, 100, 233));
  const singleStructure = raster.analyseTable(singleRow);
  assert.ok(singleStructure, 'Une page d’une ligne est reconnue');
  assert.equal(singleStructure.rows.length, 1);
  assert.equal(singleStructure.columnEdges.length, 4);

  // --- 4. Bande vide en bas, ignorée par cellHasInk -----------------------------------
  const emptyBottom = createImage(1000, 1000);
  for (let y = 100; y <= 500; y += 100) hLine(emptyBottom, y, 50, 850);
  COLUMN_X.forEach((x) => vLine(emptyBottom, x, 100, 680)); // les traits dépassent la dernière bordure
  const bottomStructure = raster.analyseTable(emptyBottom);
  assert.ok(bottomStructure);
  assert.equal(bottomStructure.rows.length, 5, 'Quatre lignes bordées et une bande sans bordure en bas');
  ink(emptyBottom, raster.cellRect(bottomStructure, 3, 2));
  assert.equal(raster.cellHasInk(emptyBottom, raster.cellRect(bottomStructure, 3, 2)), true);
  assert.equal(raster.cellHasInk(emptyBottom, raster.cellRect(bottomStructure, 4, 2)), false, 'La bande vide du bas est ignorée');
  assert.equal(raster.cellHasInk(emptyBottom, raster.cellRect(bottomStructure, 0, 0)), false, 'Une cellule vide n’a pas d’encre malgré ses bordures');

  // --- 5. Image sans trait ---------------------------------------------------------------
  assert.equal(raster.analyseTable(createImage(600, 600)), null, 'Aucun quadrillage : null');
  const onlyText = createImage(600, 600);
  fill(onlyText, 100, 100, 300, 120, 0);
  assert.equal(raster.analyseTable(onlyText), null, 'Du texte seul n’est pas un quadrillage');
  const fewLines = createImage(900, 900);
  hLine(fewLines, 100, 50, 850);
  hLine(fewLines, 300, 50, 850);
  vLine(fewLines, 50, 100, 303);
  vLine(fewLines, 850, 100, 303);
  assert.equal(raster.analyseTable(fewLines), null, 'Moins de trois traits verticaux : null');

  // --- 6. Traits gris fins (niveau 130) ----------------------------------------------------
  const grayGrid = createImage(1000, 900);
  for (let y = 100; y <= 800; y += 100) hLine(grayGrid, y, 50, 850, 130, 1);
  COLUMN_X.forEach((x) => vLine(grayGrid, x, 100, 801, 130, 1));
  const grayStructure = raster.analyseTable(grayGrid);
  assert.ok(grayStructure, 'Des traits gris d’un pixel sont détectés');
  assert.equal(grayStructure.columnEdges.length, 5);
  assert.equal(grayStructure.rows.length, 7);

  const lightGrid = createImage(1000, 900);
  for (let y = 100; y <= 800; y += 100) hLine(lightGrid, y, 50, 850, 215, 1);
  COLUMN_X.forEach((x) => vLine(lightGrid, x, 100, 801, 215, 1));
  assert.equal(raster.analyseTable(lightGrid), null, 'Un trait presque blanc (niveau 215) n’est pas un trait');

  // --- Traits détectés, seuils ----------------------------------------------------------------
  const { hLines, vLines } = raster.findRulings(grayGrid);
  assert.equal(hLines.length, 8);
  assert.equal(vLines.length, 5);
  const short = createImage(400, 400);
  hLine(short, 100, 50, 150); // 100 px : sous le seuil de 120 px
  assert.equal(raster.findRulings(short).hLines.length, 0, 'Un trait de moins de 120 px est ignoré');
  assert.equal(raster.findRulings(short, 80).hLines.length, 1, 'Le seuil est réglable');

  // Encre : seuil de niveau et surface
  const faint = createImage(300, 300);
  const faintRect = { x0: 0, y0: 0, x1: 300, y1: 300 };
  fill(faint, 20, 30, 90, 50, 170);
  assert.equal(raster.cellHasInk(faint, faintRect), false, 'Un gris clair (170) n’est pas de l’encre');
  fill(faint, 20, 30, 90, 50, 120);
  assert.equal(raster.cellHasInk(faint, faintRect), true);
  assert.equal(raster.cellHasInk(faint, { x0: 10, y0: 10, x1: 12, y1: 12 }), false, 'Une cellule trop petite n’a pas de zone intérieure');

  console.log('Tableau sur image OK : grille avec ou sans en-tête, bandes vides, dernière page, traits gris et absence de quadrillage protégés.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
