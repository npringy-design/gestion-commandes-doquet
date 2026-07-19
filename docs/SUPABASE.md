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

La seule source de vérité exécutable est `supabase/migrations/`. Les scripts
placés dans `supabase/legacy/` sont des archives et ne doivent pas être rejoués.
Chaque migration active doit posséder un rollback sous `supabase/rollbacks/`.

Ne pas executer un script SQL en production avant validation complete sur staging.

## Sauvegarde Supabase avant modification sensible

Avant toute modification sensible, toujours tester le SQL d'abord sur Supabase test.

Avant tout SQL en production, faire une sauvegarde ou un export de la base production.

Ne jamais executer un SQL genere automatiquement sans relecture humaine. Eviter les `DROP` et `DELETE` sans backup verifie. Privilegier les migrations reversibles, avec une procedure de retour arriere claire.

Apres migration, verifier les donnees critiques :

- `app_state`
- `profiles`
- user/site access
- commandes si concerne

En cas de probleme, ne pas continuer a modifier la production. Faire un rollback Vercel si le probleme vient du deploiement, ou restaurer la sauvegarde Supabase si le probleme vient des donnees.

Checklist avant migration production :

- [ ] Backup fait
- [ ] SQL relu
- [ ] SQL teste sur Supabase test
- [ ] Resultat valide
- [ ] Production sauvegardee
- [ ] Migration executee
- [ ] App testee apres migration
