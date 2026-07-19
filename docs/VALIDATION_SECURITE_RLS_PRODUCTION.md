# Validation sécurité RLS production

> Preuve historique. Le script mentionné est désormais archivé et ne doit pas
> être rejoué ; voir `docs/BASELINE_SUPABASE_2026.md`.

Date : 14 juillet 2026

## Déploiement GitHub / Vercel

- La version validée sur `codex-setup-staging-workflow` a été promue sur `main`.
- Commit promu : `bd1fbea2e4d8824368d76a148b8f9b89c1c4181e`.
- Le déploiement Vercel production correspondant est passé à l'état `READY`.

## Application du correctif Supabase production

Le script `SUPABASE_SECURITY_RLS_HARDENING.sql` a été exécuté manuellement dans le SQL Editor du projet Supabase production.

Une ancienne politique résiduelle a ensuite été supprimée :

```sql
DROP POLICY IF EXISTS "profiles_update_own"
ON public.profiles;
```

## Résultat final

Les trois contrôles de sécurité retournent `true` :

- `rls_ok = true` ;
- `aucun_droit_anon = true` ;
- `aucune_ecriture_directe_utilisateurs = true`.

Les privilèges finaux sont :

- `profiles` : `SELECT` uniquement pour `authenticated` ;
- `user_site_access` : `SELECT` uniquement pour `authenticated` ;
- `app_state` : `SELECT`, `INSERT`, `UPDATE` pour `authenticated` ;
- `order_line_states` : `SELECT`, `INSERT`, `UPDATE`, `DELETE` pour `authenticated` ;
- aucun privilège direct pour `anon` sur ces quatre tables.

## Statut

La sécurisation RLS est validée sur les environnements TEST et production. Aucun changement de données métier n'a été effectué.
