import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const orderPagePath = join(process.cwd(), 'src', 'pages', 'SupplierOrderPage.tsx');
const calendarPath = join(process.cwd(), 'src', 'components', 'WindowsCalendar.tsx');
const orderPageSource = readFileSync(orderPagePath, 'utf8');
const calendarSource = readFileSync(calendarPath, 'utf8');

assert.match(
  orderPageSource,
  /max-w-\[1600px\] mx-auto mb-4 relative z-30 lg:z-auto/,
  'Le bandeau mobile des commandes doit rester au-dessus du tableau quand le calendrier est ouvert',
);
assert.match(
  calendarSource,
  /align === 'right' \? 'right-0' : 'left-0'/,
  'Le calendrier doit pouvoir rester dans l’écran depuis la colonne de droite',
);
assert.match(
  calendarSource,
  /top-full mt-2 z-\[9999\]/,
  'Le calendrier doit conserver sa priorité dans le bandeau qui le contient',
);
assert.doesNotMatch(
  orderPageSource,
  /max-w-\[1600px\] mx-auto mb-4 z-30(?![^\n]*lg:z-auto)/,
  'La priorité supplémentaire doit rester limitée au mobile',
);
assert.doesNotMatch(
  orderPageSource,
  /const next = new Date\(d\); next\.setDate\(d\.getDate\(\) \+ 7\)/,
  'Une date de livraison mobile exceptionnelle ne doit pas décaler automatiquement la livraison suivante',
);
assert.match(
  orderPageSource,
  /Une premiere livraison exceptionnelle[^\n]*\n\s*setNextDeliveryDateBySupplier\(prev => \{ const n = \{ \.\.\.prev \}; delete n\[currentSupplierId\]; return n; \}\);/,
  'Le calendrier mobile doit rétablir la prochaine date prévue par le rythme habituel du fournisseur',
);
assert.match(
  orderPageSource,
  /calculationMode === 'margin' && \([\s\S]*?Livr\. suivante[\s\S]*?align="right"/,
  'Le mode Marge mobile doit afficher la livraison suivante avec un calendrier aligné à droite',
);

console.log('Calendrier mobile OK : deux livraisons visibles en mode Marge et prochaine livraison régulière conservée.');
