// Vérification hors application du découpage des manuels opératoires.
// Usage : node scripts/check-manuels-operatoires.mjs [dossier]   (défaut : tmp/manuels)
// Lit chaque PDF du dossier avec pdf.js (build legacy Node) et affiche le
// nombre de fiches, les titres avec leur page et le détail de CRÈME BRÛLÉE.

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const folder = resolve(process.argv[2] ?? join(root, 'tmp', 'manuels'));
const expected = { chaud: 39, froid: 39, 'sous-fiches': 74, 'sous fiches': 74, sous_fiches: 74 };

if (!existsSync(folder)) {
  console.error(`Dossier introuvable : ${folder}\nPlacez les trois PDF dans tmp/manuels/ puis relancez.`);
  process.exit(1);
}
const files = readdirSync(folder).filter((name) => name.toLowerCase().endsWith('.pdf'));
if (files.length === 0) {
  console.error(`Aucun PDF dans ${folder}.`);
  process.exit(1);
}

const tempDir = mkdtempSync(join(tmpdir(), 'check-manuels-'));
try {
  writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8');
  for (const name of ['manualSplitter', 'manualPdfReader']) {
    const sourcePath = join(root, 'src', 'utils', `${name}.ts`);
    const { outputText } = ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
      fileName: sourcePath,
      compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
    });
    writeFileSync(join(tempDir, `${name}.mjs`), outputText.replace(/from '\.\/manualSplitter'/g, "from './manualSplitter.mjs'"), 'utf8');
  }
  const { readManualPdf } = await import(pathToFileURL(join(tempDir, 'manualPdfReader.mjs')).href);
  const { normalizeText } = await import(pathToFileURL(join(tempDir, 'manualSplitter.mjs')).href);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  for (const file of files.sort()) {
    const data = new Uint8Array(readFileSync(join(folder, file)));
    const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
    const { nbPages, fiches } = await readManualPdf(doc);
    const key = Object.keys(expected).find((k) => normalizeText(file).includes(k));
    console.log(`\n=== ${file} — ${nbPages} pages — ${fiches.length} fiches${key ? ` (attendu ≈ ${expected[key]})` : ''} ===`);
    for (const fiche of fiches) {
      console.log(`  p.${String(fiche.page).padStart(2)}  ${fiche.titre}   [${fiche.sections.map((s) => s.type).join(', ')}]`);
    }
    if (normalizeText(file).includes('froid')) {
      const brulee = fiches.find((fiche) => fiche.titreNormalise.includes('creme brulee'));
      console.log('\n--- Détail de la fiche CRÈME BRÛLÉE (Froid) ---');
      if (!brulee) console.log('  Fiche introuvable.');
      else console.log(JSON.stringify(brulee, null, 2));
    }
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
