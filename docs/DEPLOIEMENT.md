# Deploiement staging / production

## Branches

- `main` correspond a la production.
- `staging` correspond a l'environnement de test.
- Toute modification doit etre testee sur `staging` avant passage sur `main`.

## Environnements Vercel

- Vercel production pointe vers Supabase production.
- Vercel test/staging pointe vers Supabase test.
- Les variables Vercel de test ne doivent jamais contenir les cles du Supabase production.

## Regle de redeploy

Apres chaque modification de variable d'environnement dans Vercel, lancer un redeploy.

Sans redeploy, l'application peut continuer a utiliser les anciennes valeurs.

## Garde-fous

- Ne pas toucher a Supabase production pendant les tests staging.
- Valider sur staging avant merge vers `main`.
- Garder les changements cibles et reversibles.
- Realtime reste reserve aux commandes.
