# Sécurité navigateur et en-têtes HTTP

Date : 18 juillet 2026  
Périmètre : lot 1, étape 1.3c

## Inventaire des ressources autorisées

| Origine | Usage réel | Directive CSP |
| --- | --- | --- |
| origine de l'application | scripts, styles, images, API Vercel, Workers PDF et tableur | `'self'` |
| `*.supabase.co` en HTTPS et WSS | Auth, REST et Realtime | `connect-src` |
| `cdn.tailwindcss.com` | compilateur Tailwind historique chargé dans `index.html` | `script-src` |
| `fonts.googleapis.com` et `fonts.gstatic.com` | feuilles de style et fichiers Google Fonts | `style-src`, `font-src` |
| `www.transparenttextures.com` | texture des écrans de connexion et fournisseurs | `img-src` |
| `cdn.jsdelivr.net` | Worker, cœur WASM et langue française de Tesseract.js | `script-src`, `connect-src` |
| URL `blob:` | Workers Tesseract et ressources navigateur temporaires | `worker-src`, `child-src`, `img-src`, `media-src` |

Les appels OpenAI sont exclusivement serveur à serveur via `/api/ai-assistant` : `api.openai.com` n'est donc pas autorisé par la CSP du navigateur. Les liens GPT configurables s'ouvrent comme une navigation externe et ne chargent aucune ressource dans l'application.

## Politique déployée

`vercel.json` applique les en-têtes à toutes les routes :

- CSP limitant scripts, connexions, images, polices, formulaires, objets, cadres et Workers ;
- `X-Frame-Options: DENY` en défense complémentaire anti-framing ;
- `X-Content-Type-Options: nosniff` ;
- `Referrer-Policy: strict-origin-when-cross-origin` ;
- `Permissions-Policy` désactivant caméra, microphone, géolocalisation, paiement, USB, port série, Bluetooth et suivi publicitaire du navigateur.

La CSP est d'abord publiée en `Content-Security-Policy-Report-Only` sur TEST, conformément à la [recommandation Vercel](https://vercel.com/docs/cdn-security/security-headers), puis remplacée par l'en-tête bloquant après observation des parcours.

## Exceptions temporaires explicites

`script-src` contient `'unsafe-eval'` uniquement parce que `cdn.tailwindcss.com` compile actuellement les classes dans le navigateur. `style-src` contient `'unsafe-inline'` car de nombreux composants React utilisent des styles calculés. Ces exceptions ne sont pas étendues aux scripts inline, qui restent interdits par `script-src-attr 'none'` et l'absence de `'unsafe-inline'` dans `script-src`.

La migration future de Tailwind vers le build local devra retirer `cdn.tailwindcss.com` et `'unsafe-eval'`. La suppression des styles inline pourra ensuite réduire séparément `style-src`.

## Contrôles automatisés

`npm run test:security-headers` vérifie la présence des cinq en-têtes, la portée globale, les directives minimales, les seules origines nécessaires et l'absence de jokers globaux pour les scripts et connexions.

`npm run check:secrets`, exécuté après le build, contrôle désormais aussi `dist/` : aucune clé OpenAI, clé Supabase secrète, JWT `service_role`, clé privée ou source map ne doit être publiée. L'URL et la clé publique Supabase destinées au frontend ne sont pas classées comme secrets.

## Retour arrière

Retirer `vercel.json` restaure les réponses précédentes. En cas de blocage pendant le test CSP, revenir temporairement à `Content-Security-Policy-Report-Only` permet de diagnostiquer sans désactiver les quatre autres en-têtes. Aucune donnée, migration Supabase ou configuration métier n'est modifiée par cette étape.
