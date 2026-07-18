# Suivi qualité 2026

Dernière mise à jour : 18 juillet 2026  
Branche de référence : `codex-setup-staging-workflow`  
Commit initial : `918a7871991021e7e9c185e4c0f2828220c09413`

Ce document est le tableau d'avancement opérationnel de la feuille de route. Un lot commencé mais non entièrement validé ne modifie pas le pourcentage global.

## Avancement

| Lot | Poids | Statut | Preuve |
| --- | ---: | --- | --- |
| 0. Référence et garde-fous | 5 % | Terminé production | Validation utilisateur obtenue, promotion `main` autorisée |
| 1. Sécurité et dépendances | 15 % | En cours | Étapes 1.1, 1.2, 1.3a et 1.3b validées ; étape 1.3c ouverte |
| 2. Supabase et données | 15 % | À faire | — |
| 3. Sauvegarde, hors-ligne et conflits | 15 % | À faire | — |
| 4. Architecture et organisation | 20 % | À faire | — |
| 5. Interface, performance et accessibilité | 15 % | À faire | — |
| 6. Tests, CI et exploitation | 10 % | À faire | — |
| 7. Certification finale | 5 % | À faire | — |

**Progression terminée : 5 %.**

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

## Étape 1.3b validée sur TEST

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

## Étape actuellement ouverte

### Lot 1 — Étape 1.3c : en-têtes navigateur et contrôle final des secrets

- [ ] inventorier les ressources, API et Workers nécessaires avant de définir la CSP ;
- [ ] ajouter CSP, protection anti-framing, referrer policy et permissions policy dans la configuration Vercel ;
- [ ] préserver explicitement Supabase, les polices, le Worker tableur, PDF et OCR sans assouplissement global inutile ;
- [ ] ajouter un contrôle automatisé des en-têtes et de la politique CSP ;
- [ ] confirmer qu'aucun secret n'apparaît dans le bundle frontend, les sources publiées ou les logs contrôlables ;
- [ ] exécuter `npm run verify` et contrôler les parcours sur TEST avant promotion.

## Règle pour la prochaine étape

L'étape 1.3c reste isolée des migrations Supabase et des refactorings. La CSP doit être dérivée des ressources réellement utilisées et validée sur TEST avant toute promotion afin de ne pas casser Auth, Realtime, les Workers ou les imports.

## Backlog hors pourcentage

Vide au démarrage. Toute idée future non critique est ajoutée ici sans modifier les lots ni l'avancement.
