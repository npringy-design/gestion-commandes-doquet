# Supabase

## Variables necessaires

Frontend :

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SITE_ID=
```

Serveur uniquement :

```env
SUPABASE_SERVICE_ROLE_KEY=
```

## Separation production / test

- La production utilise un projet Supabase production.
- Le staging/test utilise un projet Supabase test separe.
- Le projet Vercel production doit pointer uniquement vers Supabase production.
- Le projet Vercel test doit pointer uniquement vers Supabase test.

## Service role

`SUPABASE_SERVICE_ROLE_KEY` ne doit jamais etre exposee cote frontend.

Ne jamais creer de variable `VITE_SUPABASE_SERVICE_ROLE_KEY`.

## Changements SQL

Tout changement SQL doit etre teste d'abord sur Supabase test.

Ne pas executer un script SQL en production avant validation complete sur staging.
