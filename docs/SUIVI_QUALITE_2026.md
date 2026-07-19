# Suivi qualité 2026

Dernière mise à jour : 19 juillet 2026
Branche de référence : `codex-setup-staging-workflow`  
Commit initial : `918a7871991021e7e9c185e4c0f2828220c09413`

Ce document est le tableau d'avancement opérationnel de la feuille de route. Un lot commencé mais non entièrement validé ne modifie pas le pourcentage global.

## Avancement

| Lot | Poids | Statut | Preuve |
| --- | ---: | --- | --- |
| 0. Référence et garde-fous | 5 % | Terminé production | Validation utilisateur obtenue, promotion `main` autorisée |
| 1. Sécurité et dépendances | 15 % | Terminé production | Toutes les étapes validées sur TEST puis promues sur `main` |
| 2. Supabase et données | 15 % | En cours | Inventaire 2.1a réalisé en lecture seule ; aucune base modifiée |
| 3. Sauvegarde, hors-ligne et conflits | 15 % | À faire | — |
| 4. Architecture et organisation | 20 % | À faire | — |
| 5. Interface, performance et accessibilité | 15 % | À faire | — |
| 6. Tests, CI et exploitation | 10 % | À faire | — |
| 7. Certification finale | 5 % | À faire | — |

**Progression terminée : 20 %.**

## Lot 0 terminé

- [x] confirmer la branche officielle et l'alignement initial avec `main` ;
- [x] enregistrer le commit de départ ;
- [x] enregistrer les métriques techniques initiales ;
- [x] lister les parcours métier à préserver ;
- [x] renforcer les instructions `AGENTS.md` ;
- [x] intégrer la feuille de route complète au dépôt ;
- [x] exécuter `npm run verify` depuis l'état documenté ;
- [x] vérifier que le déploiement TEST correspondant est prêt ;
- [x] promouvoir le lot documentaire sur `main` après validation utilisateur ;
- [x] clôturer le lot 0 et porter la progression fixe à 5 %.

Vérification locale du 18 juillet 2026 : `npm run verify` entièrement vert, build Vite réussi en 5,02 secondes. L'avertissement du chunk `vendor` supérieur à 650 Ko est conservé comme mesure initiale et sera traité au lot 5.

Publication TEST du 18 juillet 2026 : commits distants `defec495` puis `ee98a17`, builds Vercel `gestion-commande-test` et preview `gestion-commandes-doquet` réussis. Aucun comportement applicatif n'a été modifié. Validation utilisateur reçue pour la promotion documentaire sur `main`.

## Étape 1.1a terminée en production

### Sécuriser `/api/ai-assistant`

- [x] exiger une session Supabase valide ;
- [x] refuser les sessions absentes ou invalides ;
- [x] vérifier que le profil est actif ;
- [x] appliquer une limite de débit simple par utilisateur ;
- [x] conserver les limites de taille existantes et borner la durée de l'appel OpenAI ;
- [x] ajouter des tests autorisé, anonyme, session invalide et limite dépassée ;
- [x] intégrer les tests à `npm run verify` ;
- [x] déployer et vérifier sur TEST ;
- [x] documenter le retour arrière avant toute promotion production ;
- [x] vérifier le parcours depuis une session réellement connectée jusqu'à la fonction protégée.

Cette étape reste isolée des migrations Supabase, de la mise à jour des dépendances et des changements visuels.

Implémentation locale du 18 juillet 2026 : authentification active factorisée dans `api/_lib/auth.ts`, quota et limites isolés dans `api/_lib/aiAssistantSecurity.ts`, jeton ajouté au frontend et test dédié ajouté à la vérification complète. Le quota simple est par instance Vercel ; l'authentification ferme dès cette étape les appels publics anonymes.

Publication TEST : commit `2f66e39ee83e03c539075b96616a195754a2ddfd`, builds Vercel verts. Contrôles directs de l'API déployée : requête sans jeton refusée en `401`, jeton invalide refusé en `401`, corps supérieur à 32 000 octets refusé en `413`.

Validation utilisateur : la demande depuis l'application TEST connectée atteint la fonction protégée. La génération d'une réponse OpenAI ne peut pas être validée tant que le compte API reste sans crédits ; cette limitation externe ne remet pas en cause les contrôles de sécurité testés. Promotion sur `main` au commit `2f66e39ee83e03c539075b96616a195754a2ddfd`, déploiement Vercel production confirmé `READY`.

## Étape 1.1b terminée

### Lot 1 — Étape 1.1b : supprimer le proxy Supabase Auth générique

- [x] confirmer qu'aucun code applicatif n'appelle `/api/auth/supabase` ;
- [x] confirmer que connexion, récupération et changement de mot de passe utilisent des chemins dédiés ;
- [x] supprimer la route générique au lieu de conserver une liste blanche vide ;
- [x] ajouter un test empêchant sa réintroduction silencieuse ;
- [x] documenter les parcours conservés et le retour arrière ;
- [x] exécuter `npm run verify` ;
- [x] déployer sur TEST et confirmer que l'ancienne route répond `404` ;
- [x] valider les parcours d'authentification sur TEST avant promotion production.

Publication TEST : commit `ee5d063ac347e3292f6a1ed2c65508ee789a2314`, déploiement Vercel `READY`. Contrôles directs : application `200`, proxy supprimé `404`, route dédiée `/api/auth/complete-password-change` toujours présente et limitée à `POST` (`405` sur une lecture).

Validation utilisateur reçue le 18 juillet 2026 pour les parcours de connexion et de récupération de mot de passe. Promotion production de l'étape 1.1 autorisée.

## Étape 1.2a terminée

### Lot 1 — Étape 1.2a : inventorier et borner les imports utilisateurs

- [x] inventorier tous les points d'entrée PDF, XLSX et CSV ;
- [x] relever les bibliothèques, traitements synchrones et limites actuelles ;
- [x] fixer des tailles maximales adaptées à chaque type de fichier ;
- [x] créer un validateur commun testable avant parsing ;
- [x] vérifier le type réel du fichier au-delà de son extension ;
- [x] brancher les contrôles sur chaque point d'entrée sans modifier les règles métier ;
- [x] couvrir les fichiers trop lourds, incohérents et corrompus par des tests ;
- [x] exécuter `npm run verify` ;
- [x] déployer sur TEST ;
- [x] valider sans écriture métier à l'aide de fichiers générés en mémoire.

Implémentation locale du 18 juillet 2026 : trois entrées confirmées et documentées. Limites fixées à 8 Mo pour CSV/TXT, 15 Mo pour XLS/XLSX et 20 Mo pour PDF. Le contrôle commun vérifie le contenu réel avant les parseurs existants, qui restent inchangés. `npm run verify` est entièrement vert avec le nouveau test dédié.

Publication TEST : commit `8b6996be10c6768297a5810cfc7f9a9475bc01d0`, déploiement Vercel `READY`, page d'accueil contrôlée en `200`. La validation est volontairement non destructive : aucun import manuel n'est réalisé, car il modifierait les données de TEST. Les fichiers générés en mémoire couvrent les acceptations et refus avant parsing, sans appel Supabase ni persistance. Promotion production autorisée.

## Étape 1.2b terminée

### Lot 1 — Étape 1.2b : rendre les traitements d'import résistants aux blocages

- [x] mesurer les traitements synchrones et les volumes intermédiaires ;
- [x] uniformiser les erreurs des parseurs sans exposer de détail interne ;
- [x] borner la durée des traitements PDF et OCR ;
- [x] garantir le nettoyage des ressources après erreur ou annulation ;
- [x] isoler dans un Worker les traitements dont la mesure confirme le besoin ;
- [x] couvrir fichier réellement corrompu, timeout et annulation ;
- [x] exécuter `npm run verify` ;
- [x] déployer puis contrôler sur TEST.

Mesure locale du 18 juillet 2026 : lecture XLSX de 5,6 Mo / 30 001 lignes en environ 1 023 ms, pic observé autour de 190 Mo ; CSV de 1,7 Mo / 100 001 lignes en environ 100 ms. Décision : Worker dédié pour XLS/XLSX, Worker PapaParse existant pour CSV/TXT. Aucun accès Supabase ou changement métier.

Vérification locale du 18 juillet 2026 : `npm run verify` entièrement vert, y compris les tests de succès, erreur, timeout, annulation et nettoyage des Workers, le typecheck, le build Vite et le contrôle des secrets. Les scénarios utilisent des données synthétiques en mémoire et ne déclenchent aucune écriture Supabase.

Publication TEST : commit `9484b8d325c8e19eee526c9ff288bc9c513de99a`, déploiement Vercel `READY`, page d'accueil contrôlée en `200`. Validation utilisateur reçue le 18 juillet 2026 pour la promotion sur `main`. Aucun import réel, accès Supabase ou changement de donnée n'a été nécessaire.

## Étape 1.2c terminée

### Lot 1 — Étape 1.2c : neutraliser les formules dangereuses dans les exports

- [x] inventorier les exports CSV et Excel réellement générés par l'application ;
- [x] identifier les cellules provenant de saisies ou de fichiers utilisateurs ;
- [x] neutraliser les préfixes de formule dangereux sans modifier les valeurs métier affichées ;
- [x] couvrir les préfixes `=`, `+`, `-`, `@`, les espaces initiaux et les valeurs légitimes ;
- [x] exécuter `npm run verify` ;
- [x] déployer et contrôler sur TEST sans modifier les données existantes.

Inventaire du 18 juillet 2026 : aucun export CSV ou Excel n'est généré par l'application. Les conversions existantes restent internes aux imports et ne déclenchent aucun téléchargement. Une protection pure, un sérialiseur CSV sûr et un contrat d'architecture sont ajoutés pour rendre obligatoire le chemin sécurisé lors de tout futur export. Aucun écran, calcul, import ou accès Supabase n'est modifié.

Vérification locale du 18 juillet 2026 : `npm run verify` entièrement vert avec le nouveau contrôle intégré, le typecheck, le build Vite et le contrôle des secrets. Les tests utilisent uniquement des tableaux synthétiques en mémoire et ne créent aucun fichier ni aucune écriture métier.

Publication TEST : commit `9af47d204fb7b4184793f059247074823b643a29`, déploiement Vercel `READY`, page d'accueil contrôlée en `200`. Validation utilisateur reçue le 18 juillet 2026 pour la promotion sur `main`. Aucun export réel, fichier téléchargé ou accès Supabase n'a été nécessaire.

## Étape 1.3a terminée

### Lot 1 — Étape 1.3a : mesurer et corriger les dépendances avec correctif compatible

- [x] mesurer `npm audit` sur le lockfile exact, dépendances de production et de développement ;
- [x] classer chaque avis par dépendance directe ou transitive et par exposition réelle dans l'application ;
- [x] mettre à jour uniquement les dépendances disposant d'un correctif compatible, par groupe réversible ;
- [x] conserver `xlsx` dans une décision séparée puisqu'aucun correctif npm n'est annoncé ;
- [x] comparer le typecheck, les tests, le build et les poids de chunks avant/après ;
- [x] exécuter `npm run verify` ;
- [x] déployer et contrôler sur TEST.

Mesure et correction du 18 juillet 2026 : l'audit complet passe de 16 entrées agrégées à 1, et l'audit production de 6 à 1. Les résolutions compatibles de Vite, Babel, PostCSS, Picomatch, `ws`, Lodash et leurs transitives sont inscrites dans le lockfile sans `--force` ni changement majeur déclaré. Seul `xlsx` reste élevé et sans correctif npm ; son usage réel sera traité dans l'étape dédiée.

Vérification locale : réinstallation propre `npm ci`, `npm run verify`, typecheck, tests, build Vite 6.4.3 et contrôle des secrets entièrement verts. Les tailles principales restent identiques à la mesure précédant cette mise à jour. Aucun code applicatif, calcul, écran ou accès Supabase n'est modifié.

Publication TEST : commit `dc2583c0d8891f1957e2f8baf771dd5b951b166e`, déploiement Vercel `READY`, page d'accueil contrôlée en `200`. Validation utilisateur reçue le 18 juillet 2026 pour la promotion sur `main`.

## Étape 1.3b terminée en production

### Lot 1 — Étape 1.3b : retirer la dépendance npm vulnérable `xlsx`

- [x] inventorier les API `xlsx` réellement utilisées par les deux parcours d'import ;
- [x] comparer une version SheetJS corrigée distribuée officiellement et une alternative maintenue ;
- [x] choisir une solution compatible navigateur et Worker sans chargement externe à l'exécution ;
- [x] migrer les lectures XLS/XLSX sans modifier les résultats des parsers métier ;
- [x] renforcer les tests sur les classeurs valides, corrompus, volumineux et multi-feuilles ;
- [x] supprimer `xlsx` du registre npm et confirmer l'audit résiduel ;
- [x] exécuter `npm run verify` et comparer le build ;
- [x] déployer et contrôler les imports sur TEST avec des fichiers synthétiques sans écriture métier.

Décision du 18 juillet 2026 : les deux parcours utilisent seulement `read`, `sheet_to_csv`, `sheet_to_json` et les utilitaires de classeur dans leur Worker. La version npm publique 0.18.5, signalée comme obsolète par l'éditeur, est remplacée par le tarball officiel SheetJS CE 0.20.3, verrouillé par URL et intégrité dans le lockfile. [La documentation SheetJS](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/) indique que le registre npm public n'est plus la source à jour et fournit cette distribution officielle. ExcelJS a été écarté pour cette étape car son périmètre documenté est XLSX, alors que l'application doit préserver les imports XLS historiques.

Le chargement reste entièrement bundlé au build dans le Worker : aucune ressource SheetJS n'est récupérée par le navigateur à l'exécution. Le test de non-régression sérialise puis relit de vrais classeurs synthétiques XLS et XLSX, avec multi-feuilles, fichier corrompu et 10 000 lignes. L'audit complet et l'audit production passent tous deux de 1 alerte élevée à 0.

Vérification locale : réinstallation propre `npm ci`, audits complet et production, `npm run verify`, typecheck, tests, build et contrôle des secrets entièrement verts. Les bundles initiaux restent stables. Seul le Worker tableur différé passe de 432,61 Ko à 503,13 Ko brut, soit +70,52 Ko ; il reste absent du chargement initial.

Publication TEST : commit `93dc143ed0d804a1a46cf53246066ace93285c39`, déploiement Vercel `dpl_HXbcPPeyTsDdzH2M1MezPjd1j8Xc` `READY`, page d'accueil contrôlée en `200`. Les contrôles XLS/XLSX sont entièrement synthétiques et ne lisent ni n'écrivent aucune donnée métier. Validation utilisateur reçue le 18 juillet 2026 ; promotion sur `main` autorisée.

Promotion production : code et clôture publiés sur `main`, puis déploiement isolé au commit `bd4933ffb7a90e34099a4e82c0a752027e45ee10`. Déploiement Vercel `dpl_5ddFQqWjGeMocSUBPPubbWH3knZv` confirmé `READY`, alias de production actif et page d'accueil contrôlée en `200`.

## Lot 1 terminé en production

### Lot 1 — Étape 1.3c : en-têtes navigateur et contrôle final des secrets

- [x] inventorier les ressources, API et Workers nécessaires avant de définir la CSP ;
- [x] ajouter CSP, protection anti-framing, referrer policy et permissions policy dans la configuration Vercel ;
- [x] préserver explicitement Supabase, les polices, le Worker tableur, PDF et OCR sans assouplissement global inutile ;
- [x] ajouter un contrôle automatisé des en-têtes et de la politique CSP ;
- [x] confirmer qu'aucun secret n'apparaît dans le bundle frontend et les sources publiées ;
- [x] exécuter `npm run verify` et contrôler les parcours sur TEST avant promotion.

Inventaire du 18 juillet 2026 : l'application charge Supabase en HTTPS/WSS, Google Fonts, une texture externe, Tailwind CDN et les ressources OCR Tesseract sur jsDelivr. PDF.js et SheetJS sont servis par l'origine dans des Workers dédiés. La CSP autorise uniquement ces besoins. OpenAI reste serveur à serveur et n'est pas autorisé côté navigateur.

Phase d'observation préparée : les en-têtes anti-framing, MIME, referrer et permissions sont actifs, tandis que la CSP commence en `Report-Only` sur TEST. Un contrôle dédié verrouille sa structure. Le contrôle des secrets inspecte désormais le bundle produit, les JWT `service_role`, les clés serveur probables et l'absence de source maps.

Vérification locale : `npm run verify` entièrement vert avec le nouveau contrat des en-têtes, le typecheck, les tests métier, le build inchangé et le scan des sources puis du bundle final. La validation Vercel et l'observation navigateur restent à effectuer avant le passage de la CSP en mode bloquant.

Premier contrôle Vercel : la forme `/:path*` protégeait les chemins non vides mais pas la racine. Le test HTTP l'a détecté avant le passage en blocage. Le motif est corrigé en `/(.*)` et le contrat automatisé exige désormais explicitement cette couverture globale.

Observation TEST : commit `78222e30eee0a3200983d495f8140fbf72acfd77`, déploiement Vercel `dpl_28EzGgSkEnqG6cJDTrKCmX8CsBmP` `READY`. L'accueil répond `200` avec CSP Report-Only, anti-framing, MIME, referrer et permissions. La politique passe maintenant en mode bloquant sur TEST ; aucune promotion `main` n'est autorisée avant le contrôle visuel.

CSP bloquante publiée sur TEST : commit `d4912190b1250c99f1d740426195c936575c325b`, déploiement Vercel `dpl_6ytFo7wVayHBgupuAnYuEXJXYZKF` `READY`. L'alias TEST et sa feuille de styles répondent `200`. Les réponses exposent bien `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` et `Permissions-Policy`, sans conserver l'ancien en-tête Report-Only. Une nouvelle exécution locale de `npm run verify` est entièrement verte et le scan du bundle ne trouve ni secret serveur, ni JWT `service_role`, ni source map publiée.

Le journal Vercel signale parallèlement des erreurs TypeScript préexistantes dans `api/admin/users/*`. Elles ne bloquent pas le build Vercel et ne sont pas causées par les en-têtes, mais confirment la dette déjà inscrite au lot 4.4 : le dossier `api` est encore exclu du typecheck principal. Elles seront corrigées dans ce lot dédié afin de ne pas mélanger sécurité navigateur et refactoring backend. Le contrôle visuel de la connexion et des ressources chargées avec la CSP bloquante reste nécessaire avant promotion.

Validation utilisateur reçue le 18 juillet 2026 : connexion, accueil, paramètres et trame de commande s'affichent normalement sous CSP bloquante, sans écran blanc ni anomalie visuelle. Aucun import, enregistrement ou changement de donnée n'a été nécessaire. La promotion de l'étape 1.3c sur `main` est autorisée.

Promotion production : `main` avancée sans divergence sur le commit `2e74757a92f0277cb52b7aa3606d6f44b87c0eca`. Déploiement Vercel `dpl_39pBzznk6au9NBahvS4MJ6hNFuc7` confirmé `READY`. L'accueil et sa feuille de styles répondent `200` sur l'alias public, avec CSP bloquante et les quatre autres en-têtes attendus. Le lot 1 est terminé en production et la progression fixe passe à 20 %.

## Étape 2.1a terminée en production

### Lot 2 — Étape 2.1a : inventaire du schéma et des scripts SQL

- [x] identifier sans ambiguïté les projets Supabase production et TEST ;
- [x] inventorier en lecture seule les tables, colonnes, contraintes, index et triggers ;
- [x] comparer les politiques RLS, privilèges et publications Realtime ;
- [x] relever l'historique et le SQL des migrations distantes ;
- [x] inventorier les scripts SQL du dépôt et leurs contradictions ;
- [x] identifier les tables réellement consommées par Hippo Commandes ;
- [x] isoler les objets historiques et ceux appartenant à l'autre application ;
- [x] relever les advisors sécurité et performance sans appliquer de remédiation ;
- [x] documenter la source de vérité proposée et l'absence de mutation.

Résultat du 19 juillet 2026 : les quatre tables métier ont un socle RLS et Realtime cohérent, mais TEST et production divergent sur `profiles`, plusieurs triggers, index et objets historiques. Les migrations distantes `order_line_states` ne sont pas versionnées dans le dépôt. Le détail complet se trouve dans `docs/INVENTAIRE_SCHEMA_SUPABASE_2026.md`.

Aucune donnée, table, politique, fonction, publication ou configuration Auth n'a été modifiée. Après vérification et publication documentaire sur TEST, la prochaine étape sera 2.1b : définir la baseline cible et les migrations de convergence, toujours sans les exécuter sur production.

Publication TEST : commit `d4c55fd402eb9fe86670043836181ff712ccf791`, déploiement Vercel `dpl_DcCSXg92cbb3hbNvbNLGbw8Dq29s` `READY`, accueil `200`. `npm run verify` est entièrement vert. Cette publication est exclusivement documentaire et n'appelle aucune API de mutation Supabase.

Validation utilisateur reçue le 19 juillet 2026. La promotion documentaire de l'inventaire sur `main` est autorisée. Cette validation ne donne l'autorisation d'exécuter aucune migration ni de modifier les données TEST ou production.

Promotion production : `main` avancée sans divergence sur le commit `4a3736d887d58c33bf0898fdc21cb04f044045e8`. Déploiement Vercel `dpl_CRK9RqPfCAgYj8iqE2pY8qDLKkPq` confirmé `READY`, alias public en `200` avec les en-têtes de sécurité attendus. L'étape 2.1a est terminée en production sans aucune mutation Supabase ; la progression globale reste à 20 % tant que le lot 2 n'est pas entièrement terminé.

## Étape 2.1b terminée en production

### Lot 2 — Étape 2.1b : définir la baseline cible et les migrations de convergence

- [x] fixer le schéma cible de chaque table réellement utilisée par Hippo Commandes ;
- [x] trancher explicitement les divergences `profiles`, triggers, contraintes et index ;
- [x] récupérer les migrations distantes manquantes dans un historique versionné ;
- [x] préparer des migrations ordonnées avec préconditions et retour arrière ;
- [x] archiver les scripts SQL contradictoires sans supprimer les preuves historiques ;
- [x] vérifier statiquement la reproductibilité et l'absence de droits larges à `anon` ;
- [x] documenter le plan d'essai sur Supabase TEST avant toute exécution.

Cette étape prépare la source de vérité dans le dépôt. Elle n'autorise encore aucune exécution sur Supabase production et ne doit toucher ni aux objets `suivi_gestion_*` de TEST, ni aux tables historiques exclues par l'inventaire.

La baseline et la convergence sont désormais sous `supabase/migrations/`, avec un rollback par migration. Les trois versions `order_line_states` retrouvées dans les historiques TEST et production sont conservées dans `supabase/legacy/remote_history/` et la reprise historique des blobs est interdite au rejeu automatique. Les anciens scripts manuels restent consultables sous `supabase/legacy/` et le diagnostic en lecture seule sous `supabase/diagnostics/`.

Décisions structurantes : `profiles.role` devient un texte contraint avec défaut `commande`, `email` devient obligatoire et unique, `must_change_password` est intégré, les fonctions privilégiées passent dans le schéma non exposé `private`, les index redondants sont retirés et les privilèges communs minimaux sont reproduits. Les objets legacy de production sont conservés : le contrôle complémentaire a trouvé 3 lignes `sites`, 2 lignes `user_sites` et 2 profils utilisant encore `default_site_id`.

Vérifications locales : contrôles statiques des migrations et du contrat de sécurité verts ; les deux migrations et leurs deux rollbacks sont acceptés par le parseur natif PostgreSQL 17. `npm run verify` est entièrement vert, y compris typecheck, tests métier, build et scan des secrets. Aucun SQL n'a été exécuté sur Supabase TEST ou production. `supabase db reset` reste à exécuter sur une machine disposant de Docker avant toute application distante.

Publication TEST : commit `8e99934b287f9600327a218cc7d1b6853be138a9`, déploiement Vercel `dpl_FdKQyfpRfg1u4AS3dPCjWypRL3hm` `READY`, alias TEST en `200` avec les en-têtes de sécurité attendus. Cette publication ne déclenche pas les fichiers de migration et n'a modifié aucune base. `main` reste au commit `db1b1032312b7711cb5a0055c4660b0763631e85`.

Validation utilisateur reçue le 19 juillet 2026. La promotion de la baseline, des archives et des contrôles sur `main` est autorisée. Cette validation n'autorise l'exécution d'aucune migration ni aucune mutation de Supabase TEST ou production.

Promotion production : `main` avancée sans divergence sur le commit `ffe8c8f6405441c78fa8089ebc385bf8cf99e66a`. Déploiement Vercel `dpl_9KtgggN2tADxBTiJZTHyPEtBKQK8` confirmé `READY`, alias public en `200` avec les en-têtes de sécurité attendus. La publication des fichiers n'a exécuté aucun SQL et les deux bases Supabase restent inchangées. L'étape 2.1b est terminée en production ; la progression globale reste à 20 % jusqu'à la clôture complète du lot 2.

## Étape actuellement ouverte

### Lot 2 — Étape 2.1c : valider l'exécution de la baseline avant Supabase TEST

- [x] rejouer les migrations sur une base PostgreSQL 17.5 jetable en mémoire, Docker étant indisponible ;
- [ ] confirmer le même rejeu avec `supabase db reset --local --no-seed` sur la stack Docker officielle ;
- [x] contrôler les schémas, contraintes, RLS, privilèges, triggers et publications Realtime obtenus ;
- [x] exécuter les rollbacks sur cette base jetable, vérifier l'absence de résidu, puis reconstruire la baseline ;
- [x] comparer les historiques TEST/production et déterminer la liste exacte du dry-run TEST ;
- [ ] confirmer cette liste avec `supabase db push --dry-run` depuis une CLI liée disposant de ses secrets locaux ;
- [x] capturer avant exécution les définitions, empreintes et volumes des objets Hippo Commandes et `suivi_gestion_*` ;
- [ ] obtenir une autorisation utilisateur explicite avant toute application réelle sur Supabase TEST.

La promotion des fichiers sur `main` ne déclenche aucun SQL. La production reste interdite à cette étape ; seule une validation sur environnement local jetable puis un dry-run TEST sont autorisés sans nouvelle décision utilisateur.

Palier technique du 19 juillet 2026 : le rejeu PostgreSQL 17.5 est vert et a permis de corriger un helper public résiduel après rollback. Le préflight TEST est intégralement vert sur les données de convergence. L'historique réel diffère : TEST contient `20260713091142`, production contient `20260713104058` et `20260713104108`. Trois ponts actifs sans DDL réconcilient désormais ces timestamps avant la baseline. Le rapport et les empreintes avant migration sont consignés dans `docs/VALIDATION_BASELINE_SUPABASE_TEST_2026.md`. Aucune base n'a été modifiée.

Publication TEST : commit `ef299b5f2591eca37c98721eeb38605e7231c70f`, déploiement Vercel `dpl_tJ5839YnNmrp86LrzyGDwBc2CAQc` confirmé `READY`, alias TEST en `200` avec les en-têtes de sécurité attendus. `npm run verify`, le parseur PostgreSQL 17 et le rejeu PostgreSQL 17.5 sont verts. Cette publication ne déclenche aucun SQL et attend la validation utilisateur avant toute promotion sur `main`.

Validation utilisateur reçue le 19 juillet 2026 pour la promotion de ce palier technique sur `main`. Cette validation couvre uniquement les fichiers, contrôles et rapports ; elle n'autorise ni l'application des migrations ni aucune mutation de Supabase TEST ou production.

Promotion production du dépôt : `main` avancée sans divergence sur le commit `b824e7ae5e01cbf8ebd588999316d320ed841715`. Déploiement Vercel `dpl_26MtWSUN9yeSJRzYG6CXUj9Zprkm` confirmé `READY`, alias public en `200` avec les en-têtes de sécurité attendus. Aucun SQL n'a été exécuté et les bases restent inchangées. L'étape 2.1c reste ouverte pour les deux confirmations CLI officielles ; la progression globale reste à 20 % jusqu'à la clôture du lot 2.

## Backlog hors pourcentage

Vide au démarrage. Toute idée future non critique est ajoutée ici sans modifier les lots ni l'avancement.
