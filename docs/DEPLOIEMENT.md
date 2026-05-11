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

La validation explicite sur l'environnement test vaut feu vert pour le deploiement production.

Une deuxieme confirmation n'est pas obligatoire apres validation test. Une Pull Request n'est pas obligatoire si la protection GitHub du depot autorise le push direct vers `main`.

1. Travailler d'abord sur la version test `gestion-commande-test`.
2. Verifier que le projet Vercel test pointe bien vers Supabase test et utilise `VITE_APP_ENV=staging`.
3. Tester sur staging les fonctionnalites concernees par la modification.
4. Lancer `npm run verify` en local ou verifier que la GitHub Action est passee.
5. Valider manuellement la checklist critique dans `docs/TESTS_MANUELS.md`.
6. Si la version test est validee explicitement, reporter la modification vers la production.
7. Laisser Vercel production `gestion-commandes-doquet` deployer automatiquement.
8. Faire uniquement un controle rapide apres deploiement production : connexion, accueil, fonctionnalite modifiee et absence de badge TEST.
9. En cas de probleme, rollback Vercel vers le dernier deploiement stable.

Ne jamais envoyer en production une modification non testee. Supabase production ne doit jamais etre utilisee pour tester une modification incertaine.

## Protection de la branche production main

`main` correspond a la production.

Les modifications doivent d'abord etre faites et testees sur `staging`. Apres validation explicite sur test, elles peuvent etre reportees sur `main` sans deuxieme confirmation manuelle.

La Pull Request est possible mais non obligatoire. Elle peut rester utile pour les gros changements, mais le workflow courant peut rester : validation test, `npm run verify`, puis push/deploiement production.

Avant passage vers `main`, `npm run verify` ou la GitHub Action `verify` doit passer. Si `verify` echoue, ne pas deployer en production.

Apres mise a jour de `main`, verifier Vercel production `gestion-commandes-doquet` et garder un rollback possible via le dernier deploiement Vercel stable.

Reglages GitHub possibles :

1. Aller dans `Settings > Branches > Branch protection rules`.
2. Creer ou modifier une regle pour proteger `main`.
3. Laisser `Require a pull request before merging` desactive si le passage direct apres validation test est souhaite.
4. Activer `Require status checks to pass` seulement si cela ne bloque pas le workflow direct attendu.
5. Activer `Prevent force pushes`.
6. Activer `Prevent deletion`.

## Garde-fous

- Ne pas toucher a Supabase production pendant les tests staging.
- Valider sur staging avant passage vers `main`.
- La validation test vaut accord pour deploiement production.
- Garder les changements cibles et reversibles.
- Realtime reste reserve aux commandes.
