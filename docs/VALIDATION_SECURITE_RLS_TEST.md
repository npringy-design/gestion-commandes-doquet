# Validation du durcissement RLS sur Supabase TEST

Date : 14 juillet 2026

Le script `SUPABASE_SECURITY_RLS_HARDENING.sql` a été exécuté manuellement dans le SQL Editor du projet Supabase TEST.

## Résultat des contrôles SQL

La requête de synthèse a retourné `true` pour les trois contrôles :

- RLS activée et forcée sur `profiles`, `user_site_access`, `app_state` et `order_line_states` ;
- aucun privilège direct restant pour le rôle `anon` ;
- aucune politique d'écriture directe sur `profiles` et `user_site_access`.

## Privilèges finaux constatés

- `app_state` : `SELECT`, `INSERT`, `UPDATE` pour `authenticated` ;
- `order_line_states` : `SELECT`, `INSERT`, `UPDATE`, `DELETE` pour `authenticated` ;
- `profiles` : `SELECT` uniquement pour `authenticated` ;
- `user_site_access` : `SELECT` uniquement pour `authenticated` ;
- aucun privilège pour `anon`.

## Tests fonctionnels restant à effectuer sur l'application TEST

1. Connexion avec un compte non global et chargement de son site autorisé.
2. Saisie d'une valeur dans une commande, rechargement de la page et contrôle de sa conservation.
3. Modification autorisée d'un compte de test depuis la page Utilisateurs.

Aucune modification ne doit être appliquée à Supabase production ou à la branche `main` avant validation explicite de la version test.
