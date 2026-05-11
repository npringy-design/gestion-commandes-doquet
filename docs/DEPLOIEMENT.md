# Deploiement staging / production

## Branches

- `main` correspond a la production.
- `staging` correspond a l'environnement de test.
- Toute modification doit etre testee sur `staging` avant passage sur `main`.

## Environnements Vercel

- Projet Vercel production `gestion-commandes-doquet` :
  - pointe vers Supabase production ;
  - utilise `VITE_APP_ENV=production`.
- Projet Vercel test `gestion-commande-test` :
  - pointe vers Supabase test ;
  - utilise `VITE_APP_ENV=staging`.
- Les variables Vercel de test ne doivent jamais contenir les cles du Supabase production.
- Toute modification doit etre testee sur le projet test avant validation production.

## Regle de redeploy

Apres chaque modification de variable d'environnement dans Vercel, lancer un redeploy.

Sans redeploy, l'application peut continuer a utiliser les anciennes valeurs.

## Passage d'une modification en production

1. Travailler d'abord sur la version test `gestion-commande-test`.
2. Verifier que le projet Vercel test pointe bien vers Supabase test et utilise `VITE_APP_ENV=staging`.
3. Tester sur staging les fonctionnalites concernees par la modification.
4. Lancer `npm run verify` en local ou verifier que la GitHub Action est passee.
5. Valider manuellement la checklist critique dans `docs/TESTS_MANUELS.md`.
6. Merger ou reporter la modification validee vers la branche/projet production.
7. Redeployer la production `gestion-commandes-doquet`.
8. Verifier rapidement la production apres deploiement : connexion, accueil, fonctionnalite modifiee et absence de badge TEST.
9. En cas de probleme, rollback Vercel vers le dernier deploiement stable.

## Garde-fous

- Ne pas toucher a Supabase production pendant les tests staging.
- Valider sur staging avant merge vers `main`.
- Garder les changements cibles et reversibles.
- Realtime reste reserve aux commandes.
