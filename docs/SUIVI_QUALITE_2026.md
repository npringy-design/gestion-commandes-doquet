# Suivi qualité 2026

Dernière mise à jour : 18 juillet 2026  
Branche de référence : `codex-setup-staging-workflow`  
Commit initial : `918a7871991021e7e9c185e4c0f2828220c09413`

Ce document est le tableau d'avancement opérationnel de la feuille de route. Un lot commencé mais non entièrement validé ne modifie pas le pourcentage global.

## Avancement

| Lot | Poids | Statut | Preuve |
| --- | ---: | --- | --- |
| 0. Référence et garde-fous | 5 % | Terminé production | Validation utilisateur obtenue, promotion `main` autorisée |
| 1. Sécurité et dépendances | 15 % | En cours | Étapes 1.1 et 1.2 terminées ; étape 1.3a ouverte |
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

## Étape actuellement ouverte

### Lot 1 — Étape 1.3a : mesurer et corriger les dépendances avec correctif compatible

- [ ] mesurer `npm audit` sur le lockfile exact, dépendances de production et de développement ;
- [ ] classer chaque avis par dépendance directe ou transitive et par exposition réelle dans l'application ;
- [ ] mettre à jour uniquement les dépendances disposant d'un correctif compatible, par groupe réversible ;
- [ ] conserver `xlsx` dans une décision séparée puisqu'aucun correctif npm n'est annoncé ;
- [ ] comparer le typecheck, les tests, le build et les poids de chunks avant/après ;
- [ ] exécuter `npm run verify` ;
- [ ] déployer et contrôler sur TEST.

## Règle pour la prochaine étape

L'étape 1.3a reste isolée du remplacement de `xlsx`, des en-têtes navigateur et des migrations Supabase. Aucun calcul métier, écran ou schéma de données ne doit être modifié pendant les mises à jour compatibles.

## Backlog hors pourcentage

Vide au démarrage. Toute idée future non critique est ajoutée ici sans modifier les lots ni l'avancement.
