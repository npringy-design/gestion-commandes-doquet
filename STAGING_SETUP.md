# Version test / staging

Objectif : tester les modifications sans toucher a l'application production ni aux donnees Supabase production.

## Regle principale

La version test doit utiliser un projet Supabase test separe.

Ne jamais mettre les cles Supabase production dans l'environnement Preview/Test Vercel.

## Supabase test

La source de vérité est le répertoire `supabase/migrations/`. Ne plus exécuter
les anciens scripts SQL manuels, désormais archivés dans `supabase/legacy/`.

Avant toute migration distante :

1. reconstruire une base locale vide avec `supabase db reset --local --no-seed` ;
2. exécuter `npm run check:supabase-migrations` puis `npm run verify` ;
3. contrôler la liste avec `supabase migration list --local` ;
4. lancer `supabase db push --dry-run` sur le projet TEST lié ;
5. obtenir l'autorisation explicite avant l'application réelle sur TEST.

Le plan complet, les préconditions et les rollbacks sont décrits dans
`docs/BASELINE_SUPABASE_2026.md`. Supabase production reste interdit pendant
la totalité des essais TEST.

## Variables Vercel

Dans Vercel, configurer les variables pour l'environnement Preview/Test :

```text
VITE_APP_ENV=staging
VITE_APP_ENV_LABEL=TEST
VITE_SUPABASE_URL=<url du projet Supabase test>
VITE_SUPABASE_ANON_KEY=<anon key du projet Supabase test>
SUPABASE_SERVICE_ROLE_KEY=<service role key du projet Supabase test>
APP_BASE_URL=<url de l'application test>
VITE_SITE_ID=hippo_thillois
GEMINI_API_KEY=<si utilise>
```

`SUPABASE_SERVICE_ROLE_KEY` doit rester uniquement cote serveur/Vercel. Ne jamais creer de variable `VITE_SUPABASE_SERVICE_ROLE_KEY`.

## Workflow recommande

1. Faire les modifications sur une branche de test.
2. Laisser Vercel creer une Preview Deployment.
3. Tester sur l'URL Preview/Test avec le bandeau `TEST`.
4. Si tout est valide, fusionner ou recopier la modification sur `main`.
5. La production se met alors a jour.

## Verification avant test

Sur l'application test :

- le bandeau `TEST` doit etre visible en haut de l'application ;
- les donnees creees ne doivent apparaitre que dans le Supabase test ;
- les mails d'invitation doivent rediriger vers `APP_BASE_URL`, pas vers la production ;
- aucune variable Preview/Test ne doit pointer vers le Supabase production.
