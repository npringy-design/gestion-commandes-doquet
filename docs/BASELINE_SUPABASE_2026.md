# Baseline Supabase Hippo Commandes — 19 juillet 2026

## Statut

Baseline et migration de convergence préparées dans le dépôt. Aucune migration
n'a encore été exécutée sur Supabase TEST ou production.

La source de vérité active est désormais :

1. trois ponts historiques sans DDL (`select 1;`) pour les versions déjà
   enregistrées différemment sur TEST et production ;
2. `supabase/migrations/20260719101200_hippo_commandes_baseline.sql` ;
3. `supabase/migrations/20260719101210_converge_hippo_commandes_schema.sql`.

Les scripts historiques sont conservés sous `supabase/legacy/`, mais ne font
plus partie du parcours d'installation.

## Décisions de schéma

| Objet | Cible | Motif |
| --- | --- | --- |
| `profiles.role` | `text`, défaut `commande`, contrainte sur 6 rôles | évolution plus simple qu'un enum contenant des rôles obsolètes |
| `profiles.email` | `NOT NULL` + unique | Auth et administration sont basées sur l'e-mail ; les deux bases passent le précontrôle |
| `must_change_password` | booléen obligatoire, défaut `false` | déjà consommé par l'application et absent en production |
| `access_scope` | `all` ou `current_site` | contrat commun frontend/backend |
| `default_site_id` legacy | conservé uniquement en production existante | 2 profils le référencent encore ; aucune suppression sans migration métier dédiée |
| `user_site_access` | clé `(user_id, site_id)` + contrainte sur 3 sites | modèle réellement utilisé par les API |
| index `user_site_access_user_idx` | retiré | redondant avec le préfixe de la clé primaire |
| index `user_site_access_site_idx` | conservé | utile pour les recherches inverses par site |
| `app_state` | clé `(site_id, key)`, JSONB obligatoire | contrat de persistance actuel |
| horodatage `app_state` | trigger serveur | évite que l'horloge du terminal dicte le timestamp stocké |
| `order_line_states` | clé `(site_id, product_id)` | structure déjà identique dans les deux environnements |
| Realtime | `app_state` et `order_line_states` | seules tables écoutées par l'application |

## Sécurité cible

- RLS activée et forcée sur les quatre tables ;
- aucun privilège de table pour `anon` ;
- `profiles` et `user_site_access` en lecture propre uniquement ;
- écritures `app_state` et `order_line_states` filtrées par site ;
- écritures administratives réservées aux routes serveur `service_role` ;
- helper RLS `SECURITY DEFINER` déplacé dans le schéma non exposé `private` ;
- `search_path` vide et références qualifiées dans les fonctions ;
- fonctions historiques publiques supprimées sans `CASCADE`, afin qu'une
  dépendance externe inconnue bloque la migration au lieu d'être supprimée.

## Précontrôles mesurés

| Contrôle | Production | TEST |
| --- | ---: | ---: |
| Profils | 8 | 3 |
| E-mails nuls ou vides | 0 | 0 |
| Doublons exacts d'e-mail | 0 | 0 |
| Rôles hors contrat | 0 | 0 |
| `access_scope` hors contrat | 0 | 0 |
| Sites d'accès inconnus | 0 | 0 |
| Sites inconnus dans `app_state` | 0 | 0 |
| Sites inconnus dans `order_line_states` | 0 | 0 |

La production contient aussi 3 lignes `sites`, 2 lignes `user_sites` et
2 profils utilisant le même `default_site_id`. Ces données legacy sont
préservées. `site_backups` est vide.

## Historique récupéré

Les migrations distantes suivantes ont été recopiées sous
`supabase/legacy/remote_history/` :

- `20260713091142_create_order_line_states_test.sql` (TEST) ;
- `20260713104058_create_order_line_states.sql` ;
- `20260713104108_migrate_data_into_order_line_states.sql`.

La reprise des anciens blobs est volontairement archivée et non active : son
rejeu pourrait écraser des lignes plus récentes de `order_line_states`.

Les trois timestamps possèdent aussi un fichier actif sans DDL sous
`supabase/migrations/`. Supabase compare les historiques par timestamp : ces
marqueurs permettent à chaque environnement de reconnaître ses versions déjà
appliquées, tandis qu'une base neuve attend la baseline canonique pour créer
les objets. Le détail du préflight est dans
`docs/VALIDATION_BASELINE_SUPABASE_TEST_2026.md`.

## Plan d'essai obligatoire

### 1. Base locale jetable

Sur une machine disposant de Docker et de la CLI Supabase 2.109.1 ou compatible :

```bash
supabase start
supabase db reset --local --no-seed
supabase migration list --local
npm run check:supabase-migrations
```

Le conteneur Docker n'est pas disponible dans l'environnement Codex actuel.
Le 19 juillet 2026, la chaîne complète a été exécutée dans une base PostgreSQL
17.5 jetable en mémoire : ponts, baseline, convergence, rollback de
convergence, démontage complet, puis reconstruction. Ce rejeu valide le SQL
réel mais ne remplace pas la confirmation finale `supabase db reset` sur la
stack Docker officielle avant une application distante persistante.

### 2. Supabase TEST

Après réussite locale et nouvelle autorisation explicite :

1. relever les compteurs et définitions avant migration ;
2. exécuter `supabase db push --dry-run` sur le projet TEST lié ;
3. appliquer uniquement sur TEST ;
4. relire schéma, politiques, privilèges, triggers, Realtime et advisors ;
5. tester connexion, changement forcé de mot de passe, liste des sites,
   sauvegarde `app_state` et une ligne `order_line_states` avec données dédiées ;
6. vérifier que `suivi_gestion_*` est strictement inchangé ;
7. utiliser le rollback opérationnel si le helper privé provoque une régression.

### 3. Production

Interdite à cette étape. La production ne pourra être planifiée qu'après les
preuves locales, la validation complète sur Supabase TEST, un nouveau relevé
des données legacy et une validation utilisateur explicite.

## Retours arrière

- le rollback de baseline refuse de fonctionner si une seule ligne métier est
  présente ; il est réservé à une base locale ou TEST vide ;
- le rollback de convergence restaure le helper et les politiques publiques
  historiques sans rouvrir `anon` ni supprimer les nouvelles contraintes ;
- les tables et colonnes legacy de production ne sont pas supprimées par cette
  étape, donc aucune restauration de leurs données n'est nécessaire.
