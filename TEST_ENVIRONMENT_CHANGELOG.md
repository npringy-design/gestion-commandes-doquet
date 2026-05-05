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

Le workflow choisi :

- application production : projet Vercel classique + Supabase production ;
- application test : projet Vercel separe + Supabase test separe ;
- les modifications sont testees sur l'application test avant d'etre appliquees a la production.

## Changements code

- Ajout de `VITE_APP_ENV`, `VITE_APP_ENV_LABEL`, `APP_ENV`, `IS_NON_PRODUCTION_ENV` dans `src/constants.ts`.
- Ajout du composant `src/components/EnvironmentBanner.tsx`.
- Affichage d'un bandeau visible en haut de l'application quand `VITE_APP_ENV` vaut `staging`, `test` ou `development`.
- Sur la page d'accueil, en environnement test, le nom du site est remplace par `TEST` pour eviter toute confusion visuelle.
- Les invitations utilisateurs utilisent maintenant `APP_BASE_URL` ou `VERCEL_URL` quand disponible, avec fallback production.

## Changements configuration

- Ajout de `.env.example` avec les variables attendues.
- Ajout de `STAGING_SETUP.md` pour la procedure Supabase/Vercel test.
- Correction de l'ordre conseille des scripts Supabase :
  1. `SUPABASE_SETUP.sql`
  2. `SUPABASE_PROFILES_SETUP.sql`
  3. `SUPABASE_USER_SITE_ACCESS.sql`
  4. `SUPABASE_APP_STATE_RLS_LOCKDOWN.sql`
  5. `SUPABASE_ENABLE_REALTIME.sql`

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
