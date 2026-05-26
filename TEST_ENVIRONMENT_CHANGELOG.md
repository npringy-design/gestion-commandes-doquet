# Suivi version test / staging

Ce fichier sert de memoire durable pour la mise en place de la version test.
Il doit etre conserve dans GitHub pour retrouver le contexte meme dans une nouvelle conversation.

## Objectif

Eviter de modifier directement l'application production.

## Regle de travail obligatoire

A partir de la mise en place de cet environnement, toute modification de l'application doit suivre ce cycle :

1. developper la modification sur la branche de test `codex-setup-staging-workflow` ;
2. verifier la modification sur l'application test connectee au Supabase test ;
3. attendre la validation utilisateur explicite ;
4. seulement apres validation, appliquer/pousser la modification vers la version production.

Ne pas modifier ou deployer volontairement la production en premier, sauf demande explicite et exceptionnelle.

Exception pour l'environnement test : les changements destines uniquement a la version test/staging peuvent etre pousses directement sur GitHub et deployes sur le projet Vercel test, sans attendre une validation supplementaire. Cette autorisation ne concerne jamais la production.

Le workflow choisi :

- application production : projet Vercel classique + Supabase production ;
- application test : projet Vercel separe + Supabase test separe ;
- branche officielle de test : `codex-setup-staging-workflow` ;
- projet Vercel test `gestion-commande-test` : deploie depuis `codex-setup-staging-workflow` ;
- projet Vercel production `gestion-commandes-doquet` : deploie depuis `main` ;
- les modifications sont testees sur l'application test avant d'etre appliquees a la production.

Memo important pour Codex :

- Ne pas creer une branche temporaire pour une modification a tester sans raison explicite.
- Par defaut, appliquer et pousser les modifications de test sur `codex-setup-staging-workflow`.
- N'utiliser `main` que pour la production, apres validation utilisateur explicite.

## Changements code

- Ajout de `VITE_APP_ENV`, `VITE_APP_ENV_LABEL`, `APP_ENV`, `IS_NON_PRODUCTION_ENV` dans `src/constants.ts`.
- Ajout du composant `src/components/EnvironmentBanner.tsx`.
- Affichage d'un bandeau visible en haut de l'application quand `VITE_APP_ENV` vaut `staging`, `test` ou `development`.
- Sur la page d'accueil, en environnement test, le nom du site est remplace par `TEST` pour eviter toute confusion visuelle.
- Les invitations utilisateurs utilisent maintenant `APP_BASE_URL` ou `VERCEL_URL` quand disponible, avec fallback production.
- Ajout du script `scripts/test-calculations.mjs` pour verrouiller les calculs metier purs des commandes sans modifier la mecanique applicative.
- `npm run verify` lance maintenant `test:calculations` avant les autres checks.
- Suppression du script `scripts/ignore-vercel-build.mjs`, devenu inutile car les filtres de branche sont configures directement dans Vercel.
- Renforcement de `scripts/test-margin-parser.mjs` pour couvrir les en-tetes decalees, les noms d'onglets proches de Produits et les erreurs de fichier marge invalide.
- Correction des types TypeScript des routes `api/admin/users/create.ts` et `api/admin/users/update.ts`.

## Tests de non-regression calculs commande

Les tests ajoutés couvrent :

- `toNumber()` : champ vide, `undefined`, `null` et nombre valide ;
- `calculateOrder()` : commande classique avec marge, absence de commande si stock + livraison couvrent le besoin, colisage vide ;
- `calculateTargetOrder()` : stock courant vide, calcul normal vers stock cible, rupture prevue avec bonus maximum cible + 1 colis, forte consommation plafonnee.

Objectif : detecter automatiquement une regression future sur les commandes avant de deployer ou promouvoir vers production.

## Tests de non-regression import marge

Les tests du parser marge couvrent maintenant :

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
- Filtres Vercel `Ignored Build Step` configures manuellement dans les deux projets :
  - production `gestion-commandes-doquet` : `[ "$VERCEL_GIT_COMMIT_REF" != "main" ]` ;
  - test `gestion-commande-test` : `[ "$VERCEL_GIT_COMMIT_REF" != "codex-setup-staging-workflow" ]`.
- Le script `build` lance maintenant `npm run verify`.
- Le vrai build Vite est conserve dans `build:vite`.
- `verify` lance dans l'ordre : typecheck, tests calculs, tests parser marge, check multisite, build Vite, check secrets.

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
- `npm run verify` doit rester vert avant toute promotion vers production.
- Un push sur `codex-setup-staging-workflow` doit etre ignore par le projet production Vercel et construit uniquement par le projet test.
- Le deploiement Vercel test doit afficher `npm run verify` dans les logs, pas seulement `npm run build`.