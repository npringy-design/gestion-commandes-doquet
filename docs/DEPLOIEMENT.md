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

## Protection de la branche production main

`main` correspond a la production. Aucune modification ne doit etre poussee directement sur `main`.

Les modifications doivent d'abord etre faites et testees sur `staging`, puis passer en production via Pull Request ou merge valide.

Avant merge vers `main`, la GitHub Action `verify` doit passer. Si `verify` echoue, ne pas merger.

Apres merge sur `main`, verifier Vercel production `gestion-commandes-doquet` et garder un rollback possible via le dernier deploiement Vercel stable.

Reglages GitHub recommandes :

1. Aller dans `Settings > Branches > Branch protection rules`.
2. Creer ou modifier une regle pour proteger `main`.
3. Activer `Require a pull request before merging`.
4. Activer `Require status checks to pass`.
5. Activer `Require branches to be up to date before merging` si disponible.
6. Activer `Prevent force pushes`.
7. Activer `Prevent deletion`.

## Garde-fous

- Ne pas toucher a Supabase production pendant les tests staging.
- Valider sur staging avant merge vers `main`.
- Garder les changements cibles et reversibles.
- Realtime reste reserve aux commandes.
