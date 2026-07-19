# Validation de la baseline avant Supabase TEST — 19 juillet 2026

## Verdict du palier

La baseline et la convergence sont exécutables sur la stack Supabase Docker
officielle, et la chaîne migrations/rollbacks est validée sur une base
PostgreSQL 17 jetable. Le préflight distant ne relève aucune donnée qui
bloquerait la convergence sur TEST. Aucune migration distante n'a été
appliquée et aucune donnée TEST ou production n'a été modifiée.

Ce palier a trouvé et corrigé deux défauts avant toute application distante :

1. le rollback complet conservait le helper public recréé par le rollback de
   convergence ; il le supprime désormais après le démontage des tables ;
2. les historiques diffèrent entre TEST et production ; trois ponts sans DDL
   alignent maintenant leurs timestamps avant la baseline canonique.

## Références et environnement

- Supabase CLI inspectée : `2.109.1` ;
- Supabase TEST : PostgreSQL `17.6.1.113` ;
- rejeu jetable : PGlite `0.3.14`, PostgreSQL `17.5` en mémoire ;
- Docker local : indisponible dans l'environnement Codex ;
- Docker officiel : validé par GitHub Actions, run `29686711920`, job
  `88192126433` ;
- procédure de référence : [workflow local Supabase](https://supabase.com/docs/guides/local-development/cli-workflows) et [`db push --dry-run`](https://supabase.com/docs/reference/cli/supabase-db-push).

Le changement Supabase 2026 sur l'exposition Data API a aussi été contrôlé :
les migrations accordent explicitement les privilèges nécessaires à
`authenticated` et `service_role`, révoquent `anon` et forcent RLS.

## Rejeu PostgreSQL 17 jetable

Séquence réellement exécutée sans réseau et sans donnée utilisateur :

1. création des rôles et objets Supabase minimaux (`auth.users`, `auth.uid()`,
   publication `supabase_realtime`) ;
2. exécution des trois ponts historiques ;
3. exécution de la baseline puis de la convergence ;
4. contrôle du trigger de création de profil avec une ligne synthétique,
   immédiatement supprimée ;
5. rollback de convergence puis rollback complet ;
6. reconstruction intégrale.

Résultat après chaque construction : quatre tables présentes, RLS activée et
forcée sur les quatre, 9 politiques, 2 tables dans Realtime et 3 helpers dans
le schéma `private`. Après démontage complet : aucune table, aucune relation
Realtime et aucun helper résiduel. La reconstruction finale produit le même
état.

## Rejeu Supabase Docker officiel

Le workflow permanent `.github/workflows/verify.yml` contient désormais un
job isolé, sans secret ni accès distant, qui utilise Supabase CLI `2.109.1` :

1. démarrage de PostgreSQL Supabase `17.6.1.143` avec `supabase db start` ;
2. reconstruction avec `supabase db reset --local --no-seed` ;
3. contrôle par `supabase migration list --local` ;
4. exécution de `npm run check:supabase-migrations`.

Le run GitHub Actions `29686711920`, job `88192126433`, est entièrement vert.
Les cinq versions locales et appliquées correspondent exactement :
`20260713091142`, `20260713104058`, `20260713104108`, `20260719101200` et
`20260719101210`. La vérification applicative complète exécutée en parallèle
est également verte. Cette preuve est locale au runner GitHub et n'a lu ni
modifié Supabase TEST ou production.

## Préflight Supabase TEST en lecture seule

Le script réutilisable est
`supabase/diagnostics/SUPABASE_BASELINE_PREFLIGHT_READ_ONLY.sql`. Un contrôle
automatisé interdit les verbes d'écriture ou de DDL dans ce fichier.

### Historique et volumes avant migration

| Objet | Valeur |
| --- | ---: |
| Migration distante TEST | `20260713091142_create_order_line_states` |
| `profiles` | 3 lignes |
| `user_site_access` | 1 ligne |
| `app_state` | 21 lignes |
| `order_line_states` | 521 lignes |
| `suivi_gestion_app_state` | 29 lignes |
| `suivi_gestion_user_access` | 2 lignes |

Toutes les préconditions retournent `0` : table manquante, rôle ou portée
invalide, e-mail vide ou dupliqué, site inconnu dans les trois tables
concernées. Les requêtes ne retournent aucune valeur métier ni identité.

### Empreintes structurelles avant migration

| Table | Empreinte MD5 du catalogue |
| --- | --- |
| `app_state` | `b254bf19d676321c0362f21025ac0f92` |
| `order_line_states` | `bfeb1c9d8e4b6af7b8a7a312baada60d` |
| `profiles` | `8d7d0a5bb5c9859d4c68eb146abc4e83` |
| `user_site_access` | `6f356dd7b798c14686205c44f44cb54b` |
| `suivi_gestion_app_state` | `5a699cbef1dce36baeeaf5860d7b0b1b` |
| `suivi_gestion_user_access` | `01ebf86c90d840cda3529d10c6f02e0c` |

Les deux empreintes `suivi_gestion_*` devront rester strictement identiques
après tout essai autorisé. Les deux tables Hippo écoutées sont déjà présentes
dans `supabase_realtime`. Avant migration, les helpers concernés sont encore
dans `public`, ce que la baseline doit précisément corriger.

## Dry-run d'historique TEST

Supabase compare les migrations par timestamp. Après ajout des ponts, le plan
attendu sur TEST est déterministe :

| Version | Action attendue |
| --- | --- |
| `20260713091142` | déjà appliquée, ignorée |
| `20260713104058` | pont sans DDL à enregistrer |
| `20260713104108` | pont sans DDL à enregistrer |
| `20260719101200` | baseline canonique à appliquer ultérieurement |
| `20260719101210` | convergence à appliquer ultérieurement |

La comparaison a été faite à partir de l'historique distant lu via l'API
Supabase et des fichiers locaux, sans écriture. La commande CLI officielle
`supabase db push --dry-run` reste à confirmer depuis un environnement lié
disposant du jeton CLI et du mot de passe de base ; aucun secret ne doit être
ajouté au dépôt ou transmis dans la conversation.

## Limites et prochaine autorisation

- aucun SQL de migration n'a été exécuté sur Supabase TEST ;
- production n'a fait l'objet que d'une lecture de son historique ;
- les advisors `suivi_gestion_*` restent hors périmètre et inchangés ;
- aucune application réelle sur TEST n'est autorisée par ce document ;
- avant toute application persistante, il reste à confirmer la commande CLI
  officielle ou à obtenir une autorisation distincte pour un essai
  transactionnel intégralement annulé sur TEST.
