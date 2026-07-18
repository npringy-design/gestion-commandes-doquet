# Référence initiale qualité — 18 juillet 2026

Cette référence décrit l'état avant le nouveau chantier qualité. Les mesures futures doivent être comparées à ces valeurs, sans réinterpréter rétroactivement la note de départ.

## Version contrôlée

- dépôt : `gestion-commandes-doquet` ;
- branche : `codex-setup-staging-workflow` ;
- commit : `918a7871991021e7e9c185e4c0f2828220c09413` ;
- `main` et `codex-setup-staging-workflow` alignées au démarrage ;
- Node/npm utilisés pour l'audit : environnement Codex, npm `11.9.0` ;
- version du lockfile : 3.

## Taille et organisation

- 21 830 lignes dans les fichiers TypeScript/JavaScript de `src`, `dashboard_cm` et `api` ;
- 24 scripts de tests appelés par `npm run verify` ;
- 3 contrôles appelés par `npm run verify` ;
- 438 appels d'assertion recensés dans les scripts ;
- `App.tsx` : 49 lignes ;
- `DashboardApp.tsx` : 1 167 lignes ;
- `TakeRatePage.tsx` : 961 lignes ;
- `useAppState.ts` : 519 lignes ;
- `AppRouter.tsx` : 515 lignes.

## Build initial

Mesures du dernier build Vite local avant chantier :

| Élément | Taille brute | Taille gzip approximative | Chargement |
| --- | ---: | ---: | --- |
| `index` | 192 161 octets | 47 877 octets | initial |
| `vendor` | 860 792 octets | 267 502 octets | initial, préchargé |
| `supabase` | 168 049 octets | 44 346 octets | initial, préchargé |
| `charts` | 264 298 octets | 60 810 octets | différé |
| `xlsx` | 429 530 octets | 143 080 octets | différé |

JavaScript initial gzip approximatif : 360 Ko, hors Tailwind CDN et polices externes.

Autres actifs importants :

- `au-bureau-montevrain-home.png` : 2 516 781 octets ;
- `hippopotamus-thillois-home.jpg` : 1 001 666 octets ;
- worker PDF : environ 2,2 Mo, différé ;
- Tailwind chargé depuis `cdn.tailwindcss.com` en production.

## Dépendances et sécurité

Résultat du 18 juillet 2026. La base des avis npm change avec le temps ; toute comparaison doit préciser sa date et son périmètre.

| Commande | Total | Élevées | Moyennes | Faibles |
| --- | ---: | ---: | ---: | ---: |
| `npm audit` | 16 | 6 | 6 | 4 |
| `npm audit --omit=dev` | 6 | 4 | 2 | 0 |

Principales dépendances concernées en production : `xlsx`, `lodash` via Recharts et `ws` via Supabase Realtime. Vite est également concerné dans l'environnement de développement/build.

### Mesure après correctifs compatibles — étape 1.3a

Le même lockfile a été remesuré avant et après `npm audit fix` sans `--force`. Le chiffre npm représente des entrées agrégées dans l'arbre, pas seize vulnérabilités indépendantes.

| Périmètre | Avant | Après | Reste |
| --- | ---: | ---: | --- |
| Audit complet | 16 : 6 élevées, 6 moyennes, 4 faibles | 1 élevée | `xlsx` |
| Production uniquement | 6 : 4 élevées, 2 moyennes | 1 élevée | `xlsx` |

Classification et décision :

| Chaîne | Type / exposition | Correction compatible |
| --- | --- | --- |
| Vite → Picomatch, PostCSS, Fdir, Tinyglobby | direct développement/build ; serveur Vite absent de la production Vercel servie | Vite `6.4.1 → 6.4.3`, Picomatch `4.0.3 → 4.0.5`, PostCSS `8.5.8 → 8.5.19` et transitives |
| plugin React → Babel | direct développement/build | Babel `7.29.0 → 7.29.7` et aides transitives |
| Supabase Realtime → `ws` | transitif production ; chaîne Realtime utilisée par l'application | `ws` `8.19.0 → 8.21.1` |
| Recharts → Lodash | transitif production ; bibliothèque de graphiques chargée dans l'application | Lodash `4.17.23 → 4.18.1` |
| `xlsx` | direct production ; lecture de fichiers utilisateurs réellement accessible | aucune version corrigée sur le registre npm ; décision reportée à l'étape dédiée |

Au total, 27 résolutions compatibles du lockfile sont actualisées sans changement de version majeure déclarée dans `package.json`. Une réinstallation propre par `npm ci` et `npm run verify` réussit. Les principaux fichiers de build restent inchangés pour cette étape : `vendor` 860,79 Ko, `index` 193,79 Ko, `charts` 264,30 Ko et Worker tableur 432,61 Ko.

### Mesure après remplacement de SheetJS — étape 1.3b

La version publique npm `xlsx@0.18.5` est remplacée par la distribution officielle SheetJS CE `0.20.3`, fixée par URL et intégrité dans le lockfile. Le nombre de dépendances passe de 205 à 197 au total et de 82 à 74 en production. Les audits complet et production passent chacun de 1 alerte élevée à 0.

Les bundles initiaux restent stables : `vendor` 860,79 Ko, `index` 193,79 Ko et `charts` 264,30 Ko. Le Worker tableur différé passe de 432,61 Ko à 503,13 Ko brut, soit +70,52 Ko ; sa taille gzip mesurée est de 162,68 Ko. Aucun octet supplémentaire n'est préchargé avec la page initiale.

Risques ouverts confirmés :

- `/api/ai-assistant` sans authentification ni limitation de débit ;
- `api` exclu du typecheck principal ;
- absence de migration versionnée créant `order_line_states` ;
- scripts Supabase divergents ou incomplets ;
- TypeScript strict désactivé ;
- Tailwind CDN en production.

## Parcours métier à préserver

Les lots techniques ne doivent pas modifier les résultats ou comportements suivants :

1. connexion, déconnexion et maintien de session pendant une commande ;
2. sélection du site autorisé et conservation après actualisation ;
3. calcul des commandes fournisseurs et dates de couverture ;
4. saisie des stocks, livraisons, conditionnements et marges ;
5. reprise des saisies après perte et retour du réseau ;
6. import marge, conservation des variantes et liaisons de produits ;
7. création, figement, défigement et rechargement d'un mois de Taux de prise ;
8. calculs de ratios, préparation, anomalies et coût matière ;
9. import de trames CSV/XLSX/PDF ;
10. respect des rôles et de l'isolation par site.

Les tests existants utilisent principalement des données synthétiques directement intégrées aux scripts. Les futurs fichiers d'import de référence devront être anonymisés avant leur ajout au dépôt.

## Limites de cette référence

- Les 438 assertions ne correspondent pas à 438 parcours utilisateurs complets.
- Le résultat `npm audit` peut évoluer sans changement du lockfile.
- La présence d'un script de trigger SQL dans le dépôt ne prouve pas son installation sur TEST ou production.
- Les mesures de bundle sont des tailles de build, pas encore des mesures Lighthouse sur téléphone réel.
