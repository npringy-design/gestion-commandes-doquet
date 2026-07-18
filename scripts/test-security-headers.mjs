import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const globalRule = config.headers?.find((rule) => rule.source === '/(.*)');

assert.ok(globalRule, 'Une règle Vercel globale doit protéger toutes les routes');

const headers = Object.fromEntries(
  globalRule.headers.map(({ key, value }) => [key.toLowerCase(), value])
);

assert.equal(headers['x-frame-options'], 'DENY');
assert.equal(headers['x-content-type-options'], 'nosniff');
assert.equal(headers['referrer-policy'], 'strict-origin-when-cross-origin');
assert.match(headers['permissions-policy'], /camera=\(\)/);
assert.match(headers['permissions-policy'], /microphone=\(\)/);
assert.match(headers['permissions-policy'], /geolocation=\(\)/);
assert.match(headers['permissions-policy'], /payment=\(\)/);

const cspHeaderNames = [
  'content-security-policy',
  'content-security-policy-report-only',
].filter((name) => headers[name]);

assert.equal(cspHeaderNames.length, 1, 'Une seule CSP, observation ou blocage, doit être déclarée');
assert.equal(cspHeaderNames[0], 'content-security-policy', 'La CSP finale doit être bloquante sur TEST');

const csp = headers[cspHeaderNames[0]];
const directives = new Map(
  csp
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, ...values] = part.split(/\s+/);
      return [name, values];
    })
);

const values = (directive) => {
  assert.ok(directives.has(directive), `La directive CSP ${directive} est obligatoire`);
  return directives.get(directive);
};

assert.deepEqual(values('default-src'), ["'self'"]);
assert.deepEqual(values('base-uri'), ["'self'"]);
assert.deepEqual(values('object-src'), ["'none'"]);
assert.deepEqual(values('frame-ancestors'), ["'none'"]);
assert.deepEqual(values('frame-src'), ["'none'"]);
assert.deepEqual(values('form-action'), ["'self'"]);
assert.deepEqual(values('script-src-attr'), ["'none'"]);
assert.deepEqual(values('worker-src'), ["'self'", 'blob:']);
assert.deepEqual(values('child-src'), ["'self'", 'blob:']);
assert.deepEqual(values('upgrade-insecure-requests'), []);

const scriptSources = values('script-src');
assert.ok(scriptSources.includes("'self'"));
assert.ok(scriptSources.includes('https://cdn.tailwindcss.com'));
assert.ok(scriptSources.includes('https://cdn.jsdelivr.net'));
assert.ok(scriptSources.includes("'unsafe-eval'"), 'Exception temporaire requise par le Tailwind CDN actuel');
assert.ok(!scriptSources.includes("'unsafe-inline'"), 'Les scripts inline doivent rester interdits');
assert.ok(!scriptSources.includes('*'), 'Aucun script ne doit être autorisé depuis toutes les origines');

const styleSources = values('style-src');
assert.ok(styleSources.includes('https://fonts.googleapis.com'));
assert.ok(styleSources.includes("'unsafe-inline'"), 'Les styles React inline existants doivent rester fonctionnels');

assert.deepEqual(values('font-src'), ["'self'", 'data:', 'https://fonts.gstatic.com']);
assert.deepEqual(values('img-src'), ["'self'", 'data:', 'blob:', 'https://www.transparenttextures.com']);

const connectSources = values('connect-src');
for (const source of ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co', 'https://cdn.jsdelivr.net']) {
  assert.ok(connectSources.includes(source), `connect-src doit conserver ${source}`);
}
assert.ok(!connectSources.includes('*'), 'Les connexions réseau globales doivent rester interdites');

console.log(`En-têtes sécurité OK : CSP ${cspHeaderNames[0].endsWith('report-only') ? 'en observation' : 'bloquante'}, framing, MIME, referrer et permissions protégés.`);
