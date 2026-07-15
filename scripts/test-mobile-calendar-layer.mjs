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
  /absolute left-0 top-full mt-2 z-\[9999\]/,
  'Le calendrier doit conserver sa priorité dans le bandeau qui le contient',
);
assert.doesNotMatch(
  orderPageSource,
  /max-w-\[1600px\] mx-auto mb-4 z-30(?![^\n]*lg:z-auto)/,
  'La priorité supplémentaire doit rester limitée au mobile',
);

console.log('Calendrier mobile OK : bandeau au-dessus du tableau, priorité locale conservée et desktop inchangé.');
