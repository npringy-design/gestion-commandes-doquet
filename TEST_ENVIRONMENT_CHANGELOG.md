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
