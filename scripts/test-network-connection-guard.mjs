import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const guardPath = join(root, 'src', 'components', 'NetworkConnectionGuard.tsx');
const appPath = join(root, 'src', 'App.tsx');
const guardSource = readFileSync(guardPath, 'utf8');
const appSource = readFileSync(appPath, 'utf8');

const { diagnostics = [] } = ts.transpileModule(guardSource, {
  fileName: guardPath,
  reportDiagnostics: true,
  compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    verbatimModuleSyntax: false,
    isolatedModules: false,
  },
});

assert.equal(
  diagnostics.length,
  0,
  diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')).join('\n'),
);

assert.match(
  guardSource,
  /navigator\.onLine === false/,
  'Le composant doit détecter un démarrage déjà hors connexion',
);
assert.match(
  guardSource,
  /window\.addEventListener\('offline', handleOffline\)/,
  'La perte de connexion doit ouvrir immédiatement l’avertissement',
);
assert.match(
  guardSource,
  /window\.addEventListener\('online', handleOnline\)/,
  'Le retour de connexion doit retirer automatiquement l’avertissement',
);
assert.match(
  guardSource,
  /setIsOffline\(true\);[\s\S]*?setShowDialog\(true\)/,
  'La coupure doit afficher le bandeau et la fenêtre de choix',
);
assert.match(guardSource, /Connexion perdue — les données affichées peuvent ne plus être à jour\./);
assert.match(guardSource, />\s*Continuer\s*</, 'Le choix Continuer doit rester disponible');
assert.match(guardSource, />\s*Quitter\s*</, 'Le choix Quitter doit rester disponible');
assert.match(
  guardSource,
  /const handleContinue[\s\S]*?setShowDialog\(false\)/,
  'Continuer doit fermer uniquement la fenêtre sans bloquer la saisie',
);
assert.match(
  guardSource,
  /const handleQuit[\s\S]*?setShowDialog\(false\);[\s\S]*?onQuit\(\)/,
  'Quitter doit fermer la fenêtre puis déléguer le retour à l’accueil',
);
assert.doesNotMatch(
  guardSource,
  /disabled=|readOnly=|setAttribute\(['"]disabled/,
  'Le mode hors connexion ne doit pas désactiver les champs de saisie',
);
assert.match(appSource, /import NetworkConnectionGuard from '.\/components\/NetworkConnectionGuard'/);
assert.match(
  appSource,
  /<NetworkConnectionGuard onQuit=\{\(\) => state\.setView\('home'\)\} \/>/,
  'Le choix Quitter doit ramener à la vue d’accueil',
);

console.log('Avertissement hors connexion OK : bandeau, pop-up Continuer/Quitter et saisie non bloquée.');
