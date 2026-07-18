# Suivi version test / staging

Ce fichier sert de memoire durable pour la mise en place de la version test.
Il doit etre conserve dans GitHub pour retrouver le contexte meme dans une nouvelle conversation.

## Objectif

Eviter de modifier directement l'application production.

## Regle de travail obligatoire

A partir de la mise en place de cet environnement, toute modification de l'application doit suivre ce cycle :

1. developper la modification sur une branche ou un deploiement de test ;
2. verifier la modification sur l'application test connectee au Supabase test ;
3. attendre la validation utilisateur explicite ;
4. seulement apres validation, appliquer/pousser la modification vers la version production.

Ne pas modifier ou deployer volontairement la production en premier, sauf demande explicite et exceptionnelle.

Exception pour l'environnement test : les changements destines uniquement a la version test/staging peuvent etre pousses directement sur GitHub et deployes sur le projet Vercel test, sans attendre une validation supplementaire. Cette autorisation ne concerne jamais la production.

Le workflow choisi :

- application production : projet Vercel classique + Supabase production ;
- application test : projet Vercel separe + Supabase test separe ;
- les modifications sont testees sur l'application test avant d'etre appliquees a la production.

## Changements code

- Démarrage du chantier qualité 2026 sans changement applicatif : ajout de la feuille de route fixe à 8 lots, d'une référence initiale chiffrée et d'un tableau de suivi. `AGENTS.md` impose désormais la branche `codex-setup-staging-workflow`, la lecture du suivi, le périmètre fermé, les vérifications et la définition de terminé. Le lot 0 documente le commit de départ `918a787`, 24 scripts de tests, 3 checks, 438 assertions, les poids du build et les risques ouverts. `npm run verify` reste entièrement vert.
- Validation technique du lot 0 qualité sur TEST : commit documentaire `defec495` et builds Vercel verts. La clôture à 5 % attend la promotion documentaire sur `main`. L'étape suivante sera la sécurisation isolée de `/api/ai-assistant`.
- Validation utilisateur du lot 0 qualité et promotion documentaire autorisée sur `main`. La progression fixe passe à 5 % et l'étape 1.1 de sécurisation de `/api/ai-assistant` devient le seul chantier ouvert.
- Sécurisation de l'assistant IA préparée pour TEST : jeton Supabase désormais envoyé par le frontend, session et profil actif vérifiés côté serveur, requête limitée à 32 Ko, quota simple de 12 demandes par utilisateur sur 5 minutes, délai OpenAI de 30 secondes et erreurs fournisseur masquées. Un test exécutable couvre utilisateur autorisé, absence ou invalidité de session, profil inactif, quota et limites. Aucun SQL, rôle ou calcul métier n'est modifié.
- Sécurisation de l'assistant IA promue en production après validation de ses contrôles sur TEST. Le parcours connecté atteint bien la fonction protégée ; la génération d'une réponse reste volontairement non validable tant qu'aucun crédit API OpenAI n'est activé.
- Suppression préparée du proxy générique `/api/auth/supabase`, qui n'avait aucun consommateur dans le dépôt et pouvait transmettre un chemin Auth arbitraire. Les parcours de connexion et de récupération continuent d'utiliser directement le client Supabase officiel ; un test d'architecture empêche la réintroduction silencieuse du proxy.
- Validation utilisateur reçue sur TEST pour la suppression du proxy Supabase Auth : connexion et récupération de mot de passe conservées. La promotion production de l'étape 1.1 est autorisée ; l'étape suivante devient l'inventaire et le bornage des imports utilisateurs.
- Sécurisation préparée des trois entrées de fichiers : CSV/TXT limités à 8 Mo, XLS/XLSX à 15 Mo et PDF à 20 Mo. Un validateur commun contrôle extension, contenu textuel et signatures PDF/Excel avant PapaParse, `xlsx`, pdf.js ou Tesseract. Les parsers et calculs métier restent inchangés ; un test dédié couvre les fichiers vides, trop lourds, renommés, binaires et incohérents.
- Validation non destructive de l'étape 1.2a : aucun import manuel n'est demandé, car il modifierait les données métier de TEST. Les preuves automatisées utilisent des fichiers générés en mémoire, sans Supabase ni persistance, et confirment que les refus interviennent avant les parseurs. La promotion production est autorisée sans impact sur les saisies existantes.
- Robustesse des imports préparée : parsing XLS/XLSX déplacé dans un Worker dédié avec transfert mémoire et arrêt systématique, CSV confié au Worker PapaParse, lecture/Excel/PDF/OCR bornés dans le temps, ressources PDF et Tesseract nettoyées, erreurs internes masquées. La mesure locale confirme qu'un XLSX de 5,6 Mo peut bloquer environ 1 seconde et mobiliser près de 190 Mo, ce qui justifie l'isolation.
- Robustesse des imports validée sur TEST au commit `9484b8d` : build Vercel `READY`, accueil `200`, suite complète verte et validation utilisateur reçue. La promotion sur `main` est autorisée sans import réel ni modification des données existantes ; la prochaine étape isolée porte sur la neutralisation des formules dans les exports.
- Sécurité des exports tableurs préparée : l'inventaire confirme qu'aucun export CSV/XLSX n'existe actuellement, donc aucune saisie n'est exposée aujourd'hui. Une fonction pure neutralise les préfixes de formule, un sérialiseur CSV sûr protège les futurs exports et un test d'architecture interdit les writers directs non sécurisés. Aucun écran, import, calcul ou accès Supabase n'est modifié.
- Sécurité des futurs exports tableurs validée sur TEST au commit `9af47d2` : build Vercel `READY`, accueil `200`, suite complète verte et validation utilisateur reçue. La promotion sur `main` est autorisée ; l'étape suivante mesurera puis corrigera séparément les dépendances disposant d'un correctif compatible, hors décision `xlsx`.
- Dépendances compatibles corrigées dans le lockfile : audit complet réduit de 16 entrées à 1 et audit production de 6 à 1, sans `--force` ni changement majeur déclaré. Vite, Babel, PostCSS, Picomatch, `ws`, Lodash et leurs transitives sont actualisés ; seule la dépendance directe `xlsx`, sans correctif npm, reste isolée pour la prochaine décision. Réinstallation propre, suite complète et build verts, tailles de bundles inchangées.
- Mise à jour compatible validée sur TEST au commit `dc2583c` : déploiement Vercel `READY`, accueil `200`, audit réduit à la seule alerte `xlsx` et validation utilisateur reçue. La promotion sur `main` est autorisée ; le remplacement de `xlsx` devient le prochain chantier isolé.
- Remplacement isolé de `xlsx@0.18.5` par la distribution officielle SheetJS CE 0.20.3, sans CDN au chargement navigateur et sans changement des parsers métier. Les audits complet et production passent de 1 alerte élevée à 0. Un test dédié relit de vrais octets XLS/XLSX synthétiques, un classeur multi-feuilles, un fichier corrompu et 10 000 lignes ; aucune saisie ou donnée Supabase n'est utilisée.
- Remplacement SheetJS publié sur TEST au commit `93dc143` : déploiement Vercel `READY`, accueil `200`, suite complète verte et audits npm à 0. La validation utilisateur reste nécessaire avant toute promotion sur `main`.
- Validation utilisateur reçue pour SheetJS 0.20.3 et les imports XLS/XLSX synthétiques. La promotion sur `main` est autorisée ; l'étape suivante traitera séparément les en-têtes de sécurité du navigateur et le contrôle final des secrets.
- SheetJS 0.20.3 promu en production : commit de déploiement `bd4933f`, Vercel `READY`, alias public actif et accueil `200`. L'étape 1.3b est terminée en production ; l'étape 1.3c est désormais la seule étape ouverte.
- Sécurité navigateur 1.3c préparée en observation : inventaire des origines Supabase, polices, textures et OCR, ajout des en-têtes CSP Report-Only, anti-framing, MIME, referrer et permissions dans `vercel.json`. Un test de contrat CSP et un scan du bundle final empêchent les jokers dangereux, secrets serveur, JWT `service_role` et source maps publiées.
- Phase CSP Report-Only contrôlée sur TEST : la première règle ne couvrait pas la racine, défaut détecté par le contrôle HTTP puis corrigé avec `/(.*)`. Le commit `78222e3` est `READY`, l'accueil répond `200` avec les cinq en-têtes. La CSP est ensuite passée en mode bloquant pour la validation finale TEST.
- CSP bloquante publiée sur TEST au commit `d491219` : déploiement `dpl_6ytFo7wVayHBgupuAnYuEXJXYZKF` `READY`, accueil `200` et cinq en-têtes confirmés. La suite locale et le scan du bundle sont verts. Les erreurs TypeScript préexistantes de `api/admin/users/*`, visibles mais non bloquantes dans le journal Vercel, restent isolées dans le lot architecture/typecheck API ; la promotion attend encore le contrôle visuel utilisateur sous CSP.
- Validation utilisateur reçue pour la CSP bloquante : connexion, accueil, paramètres et trame de commande s'affichent normalement sur TEST, sans écran blanc et sans modifier les données. La promotion de l'étape 1.3c sur `main` est autorisée.
- Sécurité navigateur promue en production au commit `2e74757` : déploiement Vercel `dpl_39pBzznk6au9NBahvS4MJ6hNFuc7` `READY`, accueil et feuille de styles `200`, CSP bloquante et quatre autres en-têtes confirmés sur l'alias public. Le lot 1 est terminé en production, la progression passe à 20 % et la prochaine étape est l'inventaire en lecture seule du schéma Supabase et des scripts SQL.
- Ajout de `VITE_APP_ENV`, `VITE_APP_ENV_LABEL`, `APP_ENV`, `IS_NON_PRODUCTION_ENV` dans `src/constants.ts`.
- Ajout du composant `src/components/EnvironmentBanner.tsx`.
- Affichage d'un bandeau visible en haut de l'application quand `VITE_APP_ENV` vaut `staging`, `test` ou `development`.
- Sur la page d'accueil, en environnement test, le nom du site est remplace par `TEST` pour eviter toute confusion visuelle.
- Les invitations utilisateurs utilisent maintenant `APP_BASE_URL` ou `VERCEL_URL` quand disponible, avec fallback production.
- Promotion production des garde-fous de regression commandes : tests calculs purs, dates fournisseurs/prevision couverts, parser marge renforce.
- Correction ciblee de `src/utils/dateHelpers.ts` : la livraison suivante de couverture suit la prochaine livraison physique du fournisseur, sans resimuler un cut-off apres la premiere livraison.
- `src/utils/dateHelpers.ts` accepte une date `now` optionnelle pour permettre des tests stables sans changer l'appel applicatif existant.
- Le test des dates fournisseurs compare maintenant les jours calendaires locaux sans conversion UTC, afin d'eviter un faux echec la veille pour les livraisons calculees a minuit.
- La sauvegarde des cles `app_state` est extraite de `useCloudSync` vers `useAppStatePersistence`, avec ses delais, signatures, protections cloud-only et controle LWW conserves a l'identique.
- Sur mobile, le bandeau de commande passe maintenant devant le tableau lorsque le calendrier de livraison est ouvert ; la version desktop conserve son empilement precedent.
- Sur mobile, le changement exceptionnel de la premiere livraison ne decale plus automatiquement la livraison suivante de sept jours ; celle-ci conserve le rythme habituel du fournisseur, comme sur desktop.
- Le cycle commun des sauvegardes fiables est extrait de `useCloudSync` vers `useReliableSaveLifecycle` : statuts, messages, compteurs, reprise de file et delais sont conserves et testes sans changement Supabase.
- Le chargement initial, le rechargement apres reconnexion et le declenchement de la reprise locale sont extraits de `useCloudSync` vers `useCloudHydrationCoordinator`, avec l'ordre `app_state` puis lignes de commande et les filets historiques conserves.
- Le filtrage et l'application des evenements Realtime `app_state` sont extraits de `useCloudSync` vers `useAppStateRealtimeEvents`, en restant limites aux deux dates de livraison et en conservant la protection des timestamps locaux.
- Le chantier de decoupage de la synchronisation cloud est cloture : `useCloudSync` reste un orchestrateur sans acces Supabase, timer ou ecouteur navigateur direct. Un test d'architecture integre a `npm run verify` protege cette separation et le contrat public historique.
- Les nouveaux mois figes du Taux de prise conservent aussi leur nombre de couverts, afin qu'une correction ulterieure des couverts ne modifie pas retroactivement le taux. Les anciens snapshots sans cette valeur restent compatibles.
- Les calculs de la page resultat Taux de prise sont centralises et testes : variantes proches distinctes, ventes liees, taux, marge, chiffre d'affaires theorique, classement et barres restent coherents quel que soit le tri.
- La lecture des imports de ventes du Taux de prise est centralisee avec PapaParse : separateurs, guillemets, champs multilignes, cumuls et variantes proches sont proteges par un test commun aux deux pages.
- Les liaisons automatiques du Taux de prise sont isolees et testees : meilleure correspondance, seuil historique, variantes proches, conservation des liens existants et statut de controle restent proteges.
- Le reimport du fichier marge du Taux de prise conserve maintenant les liaisons de ventes et identifiants des produits reconnus exactement, tout en appliquant les nouvelles familles, prix et marges.
- La creation et le defigeage des mois Taux de prise sont centralises : chaque snapshot conserve des copies isolees des lignes, liaisons, ventes, couverts et donnees marge.
- L'hydratation cloud du Taux de prise est centralisee pour les deux pages : cles, reponses partielles, formats invalides et timestamps acceptes sont interpretes par un seul modele teste.
- La persistance cloud du Taux de prise est isolee de la page : les quatre cles, le delai de 2,5 secondes, le controle LWW et les timestamps confirmes sont centralises et testes.
- Les editions manuelles du Taux de prise sont centralisees : ajout, suppression, valeurs de marge, selections et liaisons utilisent des operations immuables communes et testees.
- Relance documentaire du deploiement production apres blocage Vercel `build-rate-limit`, sans changement applicatif.
- Stabilisation session commande en test : la deconnexion automatique pour inactivite est supprimee cote application. `AuthGate` ne rend plus `InactivityTimeout` et `src/auth/InactivityTimeout.tsx` est neutralise. La session reste donc geree par Supabase/navigateur, sans timer applicatif qui force la deconnexion pendant une saisie.
- Promotion production du correctif `Connexion non confirmée` valide sur test : timeout profil porte a 12 s, retry automatique du profil apres timeout, purge de toutes les cles `sb-*` local/session storage a la deconnexion forcee, deconnexion Supabase locale, retour propre vers `/` et `autoRefreshToken` desactive.

## Tests de non-regression calculs commande

Les tests couvrent :

- `toNumber()` : champ vide, `undefined`, `null` et nombre valide ;
- `calculateOrder()` : commande classique avec marge, absence de commande si stock + livraison couvrent le besoin, colisage vide ;
- `calculateTargetOrder()` : stock courant vide, calcul normal vers stock cible, rupture prevue avec bonus maximum cible + 1 colis, forte consommation plafonnee.

Objectif : detecter automatiquement une regression future sur les commandes avant promotion production.

## Tests de non-regression dates fournisseurs / prevision couverts

Les tests couvrent :

- Doquet mardi avant 10h : livraison mercredi de la meme semaine ;
- Doquet mardi apres 10h : bascule sur mercredi suivant ;
- Doquet : couverture jusqu'au mardi soir avant la livraison physique suivante ;
- Domafrais lundi avant 10h : livraison mercredi puis prochaine livraison physique vendredi ;
- Domafrais mercredi avant 10h : livraison vendredi puis prochaine livraison physique mercredi suivant ;
- prevision couverts a cheval sur deux mois avec exclusion du midi du jour apres 15h.

Objectif : eviter qu'une regression de cut-off ou de livraison suivante fausse les quantites a commander.

## Tests de non-regression import marge

Les tests du parser marge couvrent :

- conservation des variantes proches sans fusion automatique ;
- lecture des colonnes essentielles Produit / Famille / CR / prix / marge ;
- valeurs avec virgules, euros et pourcentages ;
- en-tete decalee dans le fichier ;
- onglet proche de `Produits` comme `Produits 2026` ;
- erreurs claires si l'onglet ou la colonne produit est introuvable.

Objectif : proteger la source de verite du taux de prise avant les prochaines evolutions.

## Changements configuration

- Ajout de `.env.example` avec les variables attendues.
- Ajout de `STAGING_SETUP.md` pour la procedure Supabase/Vercel test.
- Correction de l'ordre conseille des scripts Supabase :
  1. `SUPABASE_SETUP.sql`
  2. `SUPABASE_PROFILES_SETUP.sql`
  3. `SUPABASE_USER_SITE_ACCESS.sql`
  4. `SUPABASE_APP_STATE_RLS_LOCKDOWN.sql`
  5. `SUPABASE_ENABLE_REALTIME.sql`
- `npm run verify` lance maintenant : typecheck, tests calculs, tests dates fournisseurs, tests parser marge, check multisite, build Vite, check secrets.
- En production, `npm run build` reste un build Vite classique pour eviter une recursion ou un changement de comportement Vercel non souhaite.

## Changements Supabase SQL

- `SUPABASE_PROFILES_SETUP.sql` aligne les roles avec l'application actuelle :
  - `super_admin`
  - `global_admin`
  - `director`
  - `manager_plus`
  - `manager`
  - `commande`
- Ajout/prise en compte des colonnes profil necessaires :
  - `access_scope`
  - `protected_user`
  - `must_change_password`
- Les anciens roles `admin / manager / viewer` ne doivent plus etre utilises pour les nouveaux projets.

## Variables du projet Vercel test

Dans le projet Vercel test separe, utiliser les variables du Supabase test :

```text
VITE_APP_ENV=staging
VITE_APP_ENV_LABEL=TEST
VITE_SUPABASE_URL=https://<projet-test>.supabase.co
SUPABASE_URL=https://<projet-test>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable key test>
SUPABASE_SERVICE_ROLE_KEY=<secret key test>
VITE_SITE_ID=hippo_thillois
APP_BASE_URL=<url application test>
```

Ne jamais mettre la `SUPABASE_SERVICE_ROLE_KEY` dans une variable commencant par `VITE_`.

## Points de controle

- La version test affiche `TEST` visiblement sur la page d'accueil.
- La version test utilise uniquement le Supabase test.
- La production ne doit pas avoir `VITE_APP_ENV=staging`.
- Les donnees de test ne doivent jamais apparaitre dans Supabase production.
- `npm run verify` doit rester vert avant toute promotion production.
- Les modifications du chantier Parametres commande ne doivent pas etre promues avec ce lot de securisation.
- Sur la stabilisation session commande, tester une commande ouverte plus de 20 minutes avec saisie continue : elle ne doit plus etre deconnectee par le timer applicatif.
- Sur le correctif `Connexion non confirmée`, tester la deconnexion forcee : elle doit revenir sur la page connexion sans reconstruire automatiquement l'ancienne session.
