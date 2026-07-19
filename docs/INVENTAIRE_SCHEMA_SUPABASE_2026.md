# Inventaire du schéma Supabase — 19 juillet 2026

## Périmètre et méthode

Cet inventaire couvre le dépôt, le projet Supabase production `hzjstrdkiilrudnwdqai` et le projet Supabase TEST `alkzxzvrqhswvuwaohyj`.

Tous les contrôles distants ont été réalisés en lecture seule à partir des catalogues PostgreSQL, de l'historique `supabase_migrations` et des advisors Supabase. Aucune table, ligne, politique, fonction, publication ou configuration Auth n'a été modifiée.

La méthode cible recommandée par la [documentation Supabase sur le développement local](https://supabase.com/docs/guides/local-development/cli-workflows) est de conserver un répertoire `supabase/migrations/` versionné et de vérifier qu'une base vide peut être reconstruite par `supabase db reset`. Le dépôt ne respecte pas encore ce contrat.

## Résumé exécutif

- les quatre tables réellement utilisées par Hippo Commandes sont `profiles`, `user_site_access`, `app_state` et `order_line_states` ;
- leurs politiques RLS et leurs privilèges frontend sont identiques entre TEST et production ;
- `app_state` et `order_line_states` sont publiées dans `supabase_realtime` dans les deux environnements ;
- le schéma des colonnes, fonctions et triggers n'est toutefois pas identique, surtout pour `profiles` ;
- les migrations `order_line_states` existent dans l'historique distant mais pas dans le dépôt ;
- le dépôt contient 11 scripts SQL dispersés, dont deux `SUPABASE_PROFILES_SETUP.sql` différents et un setup initial volontairement non sécurisé ;
- la production contient trois tables historiques inutilisées par le code actuel ;
- TEST contient deux tables préfixées `suivi_gestion_` appartenant manifestement à l'autre application et qui ne doivent pas être intégrées aux migrations Hippo Commandes.

Il n'est donc pas sûr de copier aveuglément le schéma production ou TEST. La future migration de référence doit être construite à partir du contrat applicatif validé, puis testée sur une base vide.

## Tables et propriété fonctionnelle

| Objet | Production | TEST | Utilisé par Hippo Commandes | Décision pour la baseline |
| --- | --- | --- | --- | --- |
| `profiles` | Oui | Oui | Oui, frontend Auth et API utilisateurs | Inclure après arbitrage des divergences |
| `user_site_access` | Oui | Oui | Oui, frontend Auth et API utilisateurs | Inclure |
| `app_state` | Oui | Oui | Oui, persistance principale | Inclure |
| `order_line_states` | Oui | Oui | Oui, synchronisation des lignes | Inclure |
| `sites` | Oui, vide | Non | Non ; le code utilise des identifiants texte constants | Classer comme héritage jusqu'à décision explicite |
| `user_sites` | Oui, vide | Non | Non ; remplacée fonctionnellement par `user_site_access` | Ne pas intégrer sans décision de migration |
| `site_backups` | Oui, vide | Non | Non | Ne pas intégrer sans fonctionnalité propriétaire |
| `suivi_gestion_app_state` | Non | Oui | Non, autre application | Hors périmètre, ne jamais supprimer depuis ce dépôt |
| `suivi_gestion_user_access` | Non | Oui | Non, autre application | Hors périmètre, ne jamais supprimer depuis ce dépôt |

La recherche statique des appels Supabase confirme que le code applicatif nomme directement `profiles` et `user_site_access`, tandis que le module de persistance centralise `app_state` et `order_line_states`. Aucun appel à `sites`, `user_sites`, `site_backups` ou `suivi_gestion_*` n'existe dans ce dépôt.

## Contrat commun déjà sain

Les deux environnements possèdent le même socle de sécurité pour les quatre tables métier :

- RLS activée et forcée ;
- aucun privilège direct pour `anon` ;
- `profiles` et `user_site_access` : `SELECT` uniquement pour `authenticated` ;
- `app_state` : `SELECT`, `INSERT`, `UPDATE` pour `authenticated` ;
- `order_line_states` : `SELECT`, `INSERT`, `UPDATE`, `DELETE` pour `authenticated` ;
- politiques `app_state` et `order_line_states` filtrées par `can_access_app_state_site(site_id)` ;
- politiques `profiles` et `user_site_access` limitées à `auth.uid()` ;
- `app_state` et `order_line_states` présentes dans `supabase_realtime`.

Ce socle doit devenir un contrat automatisé de la future baseline. Il ne justifie cependant pas de considérer les schémas complets comme identiques.

## Dérives des tables métier

### `profiles`

| Élément | Production | TEST |
| --- | --- | --- |
| Type de `role` | `text` + contrainte sur les 6 rôles actuels | enum `app_role` contenant aussi des valeurs historiques |
| Valeur par défaut de `role` | `viewer` malgré la contrainte qui refuse `viewer` | `commande` |
| `email` | nullable et unique | non nullable, sans contrainte unique relevée |
| `must_change_password` | absente | présente |
| `default_site_id` | présente, liée à l'ancienne table UUID `sites` | absente |
| Trigger `updated_at` | absent | présent |
| Trigger à la création `auth.users` | absent | présent |

Le défaut production `viewer` est incohérent avec sa contrainte de rôle. Il ne casse pas les insertions actuelles de l'API, qui fournissent explicitement `commande`, mais il rend une insertion partielle non reproductible.

Le code de fin de changement de mot de passe tente de mettre à jour `profiles.must_change_password`, mais ignore actuellement l'erreur de cette requête. La colonne absente en production doit donc être arbitrée dans la baseline et le comportement API sera traité dans le lot code approprié, sans le mélanger à l'inventaire SQL.

### `user_site_access`

La production possède une contrainte limitant `site_id` à trois anciens identifiants, deux index secondaires et un trigger `updated_at`. TEST ne possède aucun de ces trois éléments. La clé primaire `(user_id, site_id)`, la clé étrangère vers `profiles` et la politique de lecture sont communes.

### `app_state`

Le contrat logique commun est `(site_id, key)` comme clé primaire, `value jsonb` et `updated_at timestamptz`. Les différences portent sur l'ordre physique des colonnes, certains commentaires, le défaut de `site_id`, le défaut de `value`, le nom d'un index et la présence du trigger serveur `updated_at` uniquement en production.

### `order_line_states`

La structure, la clé primaire, les politiques et la publication Realtime sont alignées. C'est l'objet le plus stable, mais sa migration est absente du dépôt.

## Historique de migrations distant

Production :

1. `20260713104058_create_order_line_states` ;
2. `20260713104108_migrate_data_into_order_line_states`.

TEST :

1. `20260713091142_create_order_line_states`.

La migration de création est fonctionnellement équivalente dans les deux environnements. La migration de reprise depuis les blobs `products` et `orderStates` n'existe qu'en production. Aucun de ces fichiers n'est présent sous `supabase/migrations/`, donc un clone neuf ne peut pas reconstruire la table à partir du dépôt.

## État des scripts du dépôt

Le dépôt contient 1 224 lignes SQL réparties dans 11 fichiers : 10 à la racine et un dans `src/`.

| Fichier | Rôle observé | Problème d'organisation |
| --- | --- | --- |
| `SUPABASE_SETUP.sql` | création historique de `app_state` | désactive RLS et accorde `ALL` à `anon` avant durcissement ultérieur |
| `SUPABASE_PROFILES_SETUP.sql` | setup profils sécurisé courant | diverge du fichier homonyme sous `src/` et ne correspond entièrement à aucun environnement |
| `src/SUPABASE_PROFILES_SETUP.sql` | ancienne variante plus permissive | emplacement incorrect, politiques d'écriture frontend divergentes |
| `SUPABASE_USER_SITE_ACCESS.sql` | table et helpers d'accès site | mélange structure, fonctions, droits et commentaires d'exploitation |
| `SUPABASE_APP_STATE_MULTISITE.sql` | évolution historique de clé primaire | devenu une étape intermédiaire |
| `SUPABASE_APP_STATE_RLS_LOCKDOWN.sql` | RLS de `app_state` | recoupe le script global de durcissement |
| `SUPABASE_APP_STATE_UPDATED_AT_TRIGGER.sql` | horodatage serveur | présent seulement en production |
| `SUPABASE_ENABLE_REALTIME.sql` | Realtime de `app_state` | ne couvre pas `order_line_states` |
| `SUPABASE_SECURITY_RLS_HARDENING.sql` | état final de sécurité des 4 tables | suppose `order_line_states` déjà créée hors dépôt |
| `SUPABASE_AU_BUREAU_MONTEVRAIN_INIT.sql` | bootstrap de données/site historique | n'est pas une migration de structure générique |
| `SUPABASE_SECURITY_AUDIT_READ_ONLY.sql` | diagnostic | doit rester un outil, pas une migration |

L'ordre actuellement documenté dans `STAGING_SETUP.md` ne crée pas `order_line_states` et traverse temporairement un état où `app_state` est publique. Il ne doit plus servir à reconstruire une base vide.

## Advisors Supabase

Les advisors ont été lus sans appliquer leurs remédiations.

### Production

- 10 constats sécurité : 9 avertissements et 1 information ;
- 11 constats performance : 3 avertissements et 8 informations ;
- principaux sujets : fonctions au `search_path` mutable, fonctions `SECURITY DEFINER` directement exécutables, protection des mots de passe compromis désactivée, trois clés étrangères historiques non indexées et appels `auth.uid()` non encapsulés dans certaines politiques.

### TEST

- 11 avertissements sécurité ;
- 6 constats performance : 3 avertissements et 3 informations ;
- deux politiques `suivi_gestion_app_state` autorisent des écritures sans filtre à `anon` et `authenticated`. Elles appartiennent à l'autre application et doivent être traitées dans son propre audit, pas supprimées ici ;
- autres sujets : fonctions au `search_path` mutable, fonctions `SECURITY DEFINER` directement exécutables, protection des mots de passe compromis désactivée et appels `auth.uid()` non encapsulés.

Références Supabase : [database linter](https://supabase.com/docs/guides/database/database-linter), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [protection des mots de passe](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Source de vérité proposée pour l'étape suivante

La source de vérité ne doit être ni la production complète, ni TEST complet, ni l'un des scripts historiques isolé. Elle doit être composée de :

1. quatre tables propriétaires : `profiles`, `user_site_access`, `app_state`, `order_line_states` ;
2. leurs contraintes, index réellement justifiés, triggers d'horodatage et fonctions nécessaires ;
3. le contrat RLS et les privilèges minimaux déjà communs aux deux environnements ;
4. les publications Realtime des deux tables synchronisées ;
5. une migration de référence rejouable sur une base vide ;
6. une migration de convergence séparée et réversible pour chaque environnement existant.

Avant d'écrire cette baseline, l'étape 2.1b devra trancher explicitement le modèle `profiles`, classer les trois tables historiques de production et garantir que les objets `suivi_gestion_*` restent hors périmètre.

## Retour arrière

Cette étape n'a aucun retour arrière de base de données : aucune mutation n'a été effectuée. Le seul retour arrière éventuel consiste à retirer ce rapport et les lignes de suivi associées.
