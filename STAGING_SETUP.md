# Version test / staging

Objectif : tester les modifications sans toucher a l'application production ni aux donnees Supabase production.

## Regle principale

La version test doit utiliser un projet Supabase test separe.

Ne jamais mettre les cles Supabase production dans l'environnement Preview/Test Vercel.

## Supabase test

Dans le projet Supabase test, executer les scripts SQL de structure dans cet ordre :

1. `SUPABASE_SETUP.sql`
2. `SUPABASE_PROFILES_SETUP.sql`
3. `SUPABASE_APP_STATE_RLS_LOCKDOWN.sql`
4. `SUPABASE_USER_SITE_ACCESS.sql`
5. `SUPABASE_ENABLE_REALTIME.sql`

Ensuite, creer les utilisateurs de test necessaires dans l'application test ou dans Supabase Auth.

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
