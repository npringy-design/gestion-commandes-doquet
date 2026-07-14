# Audit sécurité des rôles et politiques Supabase

## Objectif

Les rôles et les accès fonctionnels sont déjà définis dans l'application. Cet audit vérifie que Supabase applique réellement les mêmes limites, même si une requête contourne l'interface.

Ce chantier ne modifie pas les commandes, les stocks, les calculs ou les données métier.

## Contrat applicatif actuel

Rôles :

- `super_admin`
- `global_admin`
- `director`
- `manager_plus`
- `manager`
- `commande`

La hiérarchie de gestion est définie dans `src/lib/permissions.ts` :

- un manager crée et gère uniquement des comptes `commande` ;
- un manager+ gère `manager` et `commande` ;
- un directeur gère `manager_plus`, `manager` et `commande` ;
- un global admin gère tous les rôles inférieurs ;
- les comptes protégés et super-admin sont bloqués pour les rôles non super-admin ;
- les droits sont limités aux sites auxquels l'utilisateur a accès.

## Constat sur les scripts SQL du dépôt

Les scripts SQL de base contiennent bien :

- l'enum complet des rôles ;
- l'activation et le forçage de RLS sur `profiles`, `user_site_access` et `app_state` ;
- la suppression des droits directs de la clé `anon` sur `app_state` dans le script de verrouillage ;
- le filtrage de `app_state` par site.

Ils utilisent cependant encore des fonctions générales comme `is_current_user_admin()` pour certaines modifications de profils et d'accès aux sites. Ces fonctions vérifient le rôle de l'utilisateur connecté, mais pas toujours précisément le rôle, le statut protégé et les sites du compte ciblé.

Cela ne prouve pas que la base actuellement déployée est mal configurée : les politiques réelles peuvent avoir été modifiées après l'exécution de ces fichiers. Il faut donc auditer le projet Supabase test avant de préparer un durcissement.

## Fichier d'audit en lecture seule

`SUPABASE_SECURITY_AUDIT_READ_ONLY.sql` affiche :

- l'état réel de RLS et de `FORCE ROW LEVEL SECURITY` ;
- toutes les politiques installées avec leurs conditions `USING` et `WITH CHECK` ;
- les privilèges accordés à `anon` et `authenticated` ;
- les fonctions de sécurité réellement présentes ;
- les rôles de l'enum SQL ;
- les comptes ayant un périmètre incohérent ;
- les comptes actifs sans site actif ;
- la répartition des accès par site, sans afficher d'adresse e-mail.

Le fichier est strictement en lecture seule : il ne contient aucun `CREATE`, `ALTER`, `DROP`, `INSERT`, `UPDATE` ou `DELETE` applicatif.

## Contrôle automatique du dépôt

La commande suivante vérifie que le contrat de sécurité ne régresse pas dans le code et les scripts SQL :

```text
npm run check:security-contract
```

Elle est intégrée à :

```text
npm run verify
```

Le contrôle vérifie notamment :

- la présence des six rôles côté application et SQL ;
- la hiérarchie manager / manager+ ;
- le blocage des comptes protégés dans l'interface ;
- l'activation et le forçage de RLS ;
- la révocation de `anon` sur `app_state` ;
- la présence des quatre tables critiques dans l'audit.

## Étapes suivantes

1. Exécuter `SUPABASE_SECURITY_AUDIT_READ_ONLY.sql` sur Supabase test.
2. Comparer les politiques réellement actives avec le contrat applicatif.
3. Préparer une migration SQL ciblée uniquement pour les écarts confirmés.
4. Tester avec au moins un compte de chaque rôle sur la base test.
5. Ne toucher à Supabase production qu'après validation explicite de la version test.

## Limite actuelle

L'accès GitHub et Vercel permet de préparer et de vérifier le code, mais aucun connecteur Supabase direct n'est disponible dans cette session. L'audit réel de la base doit donc être exécuté dans le SQL Editor du projet Supabase test avant tout durcissement.
