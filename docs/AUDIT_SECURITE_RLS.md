# Audit sécurité des rôles et politiques Supabase

## Objectif

Les rôles et les accès fonctionnels sont déjà définis dans l'application. Cet audit vérifie que Supabase applique réellement des limites cohérentes, même si une requête contourne l'interface.

Ce chantier ne modifie pas les commandes, les stocks, les calculs ou les données métier.

## Contrat applicatif actuel

Rôles :

- `super_admin`
- `global_admin`
- `director`
- `manager_plus`
- `manager`
- `commande`

La hiérarchie de gestion est définie côté interface dans `src/lib/permissions.ts` et répétée côté serveur dans `api/_lib/permissions.ts` :

- un manager crée et gère uniquement des comptes `commande` ;
- un manager+ gère `manager` et `commande` ;
- un directeur gère `manager_plus`, `manager` et `commande` ;
- un global admin gère tous les rôles inférieurs ;
- les comptes protégés et super-admin sont bloqués pour les rôles non super-admin ;
- les droits sont limités aux sites auxquels l'utilisateur a accès ;
- un utilisateur ne peut pas modifier son propre compte par la page de gestion.

La page `UserManagementPage` appelle exclusivement les routes `/api/admin/users/*`. Les écritures sur `profiles` et `user_site_access` sont donc réalisées côté serveur avec `supabaseAdmin`, après contrôle du rôle, du compte ciblé et des sites.

## Résultat de l'audit réel sur Supabase TEST

Audit effectué le 14 juillet 2026 avec `SUPABASE_SECURITY_AUDIT_READ_ONLY.sql`.

### RLS

- `app_state` : RLS activée et forcée ;
- `profiles` : RLS activée et forcée ;
- `user_site_access` : RLS activée et forcée ;
- `order_line_states` : RLS activée mais non forcée.

### Politiques installées

- `app_state` : politiques `authenticated` filtrées par `can_access_app_state_site(site_id)` ;
- `order_line_states` : politiques `authenticated` filtrées par `can_access_app_state_site(site_id)` ;
- `profiles` : lecture de son propre profil, mais aussi anciennes politiques générales basées sur `is_current_user_admin()` pour lire, modifier, insérer ou supprimer ;
- `user_site_access` : aucune politique installée malgré RLS forcée.

L'absence de politique de lecture sur `user_site_access` peut empêcher les comptes non globaux de charger leurs sites, car `AuthProvider` lit directement leurs propres affectations à la connexion.

### Fonctions installées

Seulement deux fonctions de sécurité ont été trouvées :

- `can_access_app_state_site(text)` ;
- `is_current_user_admin()`.

Les fonctions plus précises envisagées dans les anciens scripts ne sont pas installées.

### Privilèges SQL

Le rôle `anon` possédait encore des privilèges directs très larges sur `profiles`, `user_site_access` et `order_line_states`, notamment `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `TRIGGER` et `REFERENCES`.

La RLS protégeait les lignes, mais ces privilèges sont inutiles et doivent être révoqués. `TRUNCATE` n'est notamment pas filtré par les politiques de lignes.

## Correctif préparé

Le fichier `SUPABASE_SECURITY_RLS_HARDENING.sql` applique un durcissement ciblé :

- force RLS sur les quatre tables critiques ;
- révoque tous les privilèges directs de `anon` ;
- limite `authenticated` au strict nécessaire ;
- autorise le navigateur à lire uniquement son propre profil ;
- autorise le navigateur à lire uniquement ses propres affectations de sites ;
- retire toutes les écritures directes frontend sur `profiles` et `user_site_access` ;
- conserve les lectures/écritures par site nécessaires à `app_state` et `order_line_states` ;
- conserve la gestion des utilisateurs par les routes serveur protégées.

Le script se termine par trois requêtes de contrôle en lecture seule.

## Contrôle automatique du dépôt

La commande suivante vérifie que le contrat de sécurité ne régresse pas :

```text
npm run check:security-contract
```

Elle est intégrée à :

```text
npm run verify
```

Le contrôle vérifie notamment :

- les six rôles côté interface, serveur et SQL ;
- la hiérarchie manager / manager+ ;
- le blocage de son propre compte, des comptes protégés et du super-admin ;
- le passage obligatoire par les routes serveur pour gérer les utilisateurs ;
- RLS forcée sur les quatre tables ;
- la révocation de `anon` ;
- l'absence de droit d'écriture frontend sur `profiles` et `user_site_access` ;
- la lecture limitée au compte connecté sur ces deux tables.

## Procédure de validation

1. Exécuter `SUPABASE_SECURITY_RLS_HARDENING.sql` sur Supabase TEST uniquement.
2. Contrôler les trois tableaux retournés à la fin du script.
3. Tester une connexion avec un compte non global pour vérifier le chargement de son site.
4. Tester la page Utilisateurs avec les rôles disponibles : création, changement de rôle, changement de sites, activation et suppression selon leurs droits.
5. Vérifier une saisie de commande et sa synchronisation.
6. Ne toucher à Supabase production qu'après validation explicite de la version test.

## Limite d'accès

L'accès GitHub et Vercel permet de préparer et vérifier le code. L'exécution SQL reste réalisée manuellement dans le SQL Editor Supabase par le propriétaire du projet.
