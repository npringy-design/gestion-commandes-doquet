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

## Passage d'une modification en production

1. Travailler d'abord sur la branche test `codex-setup-staging-workflow`.
2. Verifier que le projet Vercel test pointe bien vers Supabase test.
3. Tester sur l'application test les fonctionnalites concernees.
4. Lancer `npm run verify` en local ou verifier que la GitHub Action est passee.
5. Valider la checklist critique dans `docs/TESTS_MANUELS.md`.
6. Si la version test est validee explicitement par l'utilisateur, reporter la modification vers `main`.
7. Laisser Vercel production deployer automatiquement.
8. Controler rapidement la production apres deploiement.

Ne jamais envoyer en production une modification non testee.

## Garde-fous

- Ne pas toucher a Supabase production pendant les tests.
- Garder les changements cibles et reversibles.
- Realtime reste reserve aux commandes.
- Documenter les validations importantes dans `docs/ETAT_PROJET.md`.
