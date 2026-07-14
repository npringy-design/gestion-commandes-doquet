# Consolidation durable de la sécurité RLS

## Objectif

Après validation du durcissement RLS sur Supabase TEST puis production, les scripts d'installation du dépôt ont été alignés sur le même contrat de sécurité.

Cette consolidation évite qu'une future création ou reconstruction de projet Supabase réintroduise les anciennes politiques trop larges.

## Scripts corrigés

### `SUPABASE_PROFILES_SETUP.sql`

Le script crée désormais directement la configuration validée :

- RLS activée et forcée sur `profiles` ;
- suppression des anciennes policies générales et de `profiles_update_own` ;
- lecture du seul profil correspondant à `auth.uid()` ;
- révocation de tous les privilèges de `anon` ;
- révocation préalable des privilèges de `authenticated` ;
- réattribution du seul droit `SELECT` à `authenticated` ;
- aucune insertion, modification ou suppression directe depuis le navigateur.

La gestion des utilisateurs continue de passer par `/api/admin/users/*`, avec `service_role` côté serveur et les contrôles de hiérarchie, de compte protégé et de sites.

### `SUPABASE_USER_SITE_ACCESS.sql`

Le script crée désormais directement la configuration validée :

- RLS activée et forcée sur `user_site_access` ;
- suppression des policies générales de lecture et d'écriture ;
- lecture limitée aux affectations où `user_id = auth.uid()` ;
- révocation de tous les privilèges de `anon` ;
- réattribution du seul droit `SELECT` à `authenticated` ;
- aucune écriture directe depuis le navigateur.

## Migration de durcissement

`SUPABASE_SECURITY_RLS_HARDENING.sql` est idempotent et inclut maintenant :

- la suppression explicite de `profiles_update_own` ;
- le nettoyage des autres anciennes policies ;
- les privilèges minimaux validés ;
- un contrôle final unique avec trois indicateurs :
  - `rls_ok` ;
  - `aucun_droit_anon` ;
  - `aucune_ecriture_directe_utilisateurs`.

Les trois indicateurs doivent être à `true`.

## Protection contre les régressions

`scripts/check-security-contract.mjs`, lancé par `npm run verify`, vérifie désormais aussi les scripts d'installation eux-mêmes.

Le contrôle échoue notamment si :

- une policy générale d'administration de `profiles` est recréée ;
- `profiles_update_own` est recréée ou n'est plus nettoyée ;
- une policy générale de lecture ou d'écriture de `user_site_access` réapparaît ;
- `authenticated` récupère un droit `INSERT`, `UPDATE` ou `DELETE` sur `profiles` ou `user_site_access` ;
- `anon` n'est plus explicitement révoqué ;
- le contrôle final à trois indicateurs disparaît du script de migration.

## Bases existantes

Supabase TEST et Supabase production ont déjà été corrigés et validés avec les trois indicateurs à `true`.

Aucun nouveau SQL n'est nécessaire sur ces deux bases pour cette consolidation documentaire et préventive.

## Workflow

Toute évolution future reste réalisée sur `codex-setup-staging-workflow`, testée sur l'environnement TEST, puis promue sur `main` uniquement après validation explicite.
