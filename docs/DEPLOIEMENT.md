# Deploiement test / production

## Branches

- `main` correspond a la production.
- `codex-setup-staging-workflow` correspond a l'environnement de test reel.
- Toute modification doit etre testee sur `codex-setup-staging-workflow` avant passage sur `main`.
- Ne pas utiliser une branche nommee `staging` comme reference projet, sauf changement volontaire plus tard.

## Environnements Vercel

- Projet Vercel production `gestion-commandes-doquet` :
  - pointe vers Supabase production ;
  - utilise `VITE_APP_ENV=production` ;
  - deploie depuis `main`.
- Projet Vercel test `gestion-commande-test` :
  - pointe vers Supabase test ;
  - utilise `VITE_APP_ENV=staging` ;
  - deploie depuis `codex-setup-staging-workflow`.
- Les variables Vercel de test ne doivent jamais contenir les cles du Supabase production.
- Toute modification doit etre testee sur le projet test avant validation production.

## Ordre scripts Supabase

`SUPABASE_SETUP.sql` est uniquement un script initial de creation. Il ne doit jamais etre considere comme l'etat final securise d'une base production.

Ordre attendu :

1. `SUPABASE_SETUP.sql`
2. `SUPABASE_PROFILES_SETUP.sql`
3. `SUPABASE_USER_SITE_ACCESS.sql`
4. `SUPABASE_APP_STATE_RLS_LOCKDOWN.sql`
5. `SUPABASE_ENABLE_REALTIME.sql` si necessaire

Point critique : `SUPABASE_APP_STATE_RLS_LOCKDOWN.sql` doit etre execute apres le setup initial pour retirer l'acces `anon`, activer RLS/FORCE RLS et limiter `app_state` aux utilisateurs authentifies autorises par site.

Ne jamais laisser Supabase production dans l'etat du seul `SUPABASE_SETUP.sql`.

## Regle de redeploy

Apres chaque modification de variable d'environnement dans Vercel, lancer un redeploy.

Sans redeploy, l'application peut continuer a utiliser les anciennes valeurs.

## Passage d'une modification en production

La validation explicite sur l'environnement test vaut feu vert pour le deploiement production.

1. Travailler d'abord sur la branche test `codex-setup-staging-workflow`.
2. Verifier que le projet Vercel test pointe bien vers Supabase test et utilise `VITE_APP_ENV=staging`.
3. Tester sur l'application test les fonctionnalites concernees.
4. Lancer `npm run verify` en local ou verifier que la GitHub Action est passee.
5. Valider la checklist critique dans `docs/TESTS_MANUELS.md`.
6. Si la version test est validee explicitement par l'utilisateur, reporter la modification vers `main`.
7. Laisser Vercel production `gestion-commandes-doquet` deployer automatiquement.
8. Faire un controle rapide apres deploiement production : connexion, accueil, fonctionnalite modifiee et absence de badge TEST.
9. En cas de probleme, rollback Vercel vers le dernier deploiement stable.

Ne jamais envoyer en production une modification non testee.

## Protection de la branche production main

`main` correspond a la production.

Les modifications doivent d'abord etre faites et testees sur `codex-setup-staging-workflow`. Apres validation explicite sur test, elles peuvent etre reportees sur `main`.

Avant passage vers `main`, `npm run verify` ou la GitHub Action `verify` doit passer. Si `verify` echoue, ne pas deployer en production.

Apres mise a jour de `main`, verifier Vercel production `gestion-commandes-doquet` et garder un rollback possible via le dernier deploiement Vercel stable.

## Garde-fous

- Ne pas toucher a Supabase production pendant les tests.
- Valider sur l'application test avant passage sur `main`.
- Garder les changements cibles et reversibles.
- Realtime reste reserve aux commandes.
- Documenter les validations importantes dans `docs/ETAT_PROJET.md`.
- Ne jamais executer uniquement `SUPABASE_SETUP.sql` sur une base production sans appliquer ensuite le verrouillage RLS.