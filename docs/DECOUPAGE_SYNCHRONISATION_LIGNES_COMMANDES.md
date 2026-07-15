# Découpage de la synchronisation des lignes de commande

## Objectif

Le premier lot de refactorisation extrait de `useCloudSync.ts` toute la gestion spécifique de la table Supabase `order_line_states`.

L'objectif est de réduire le risque lors des futures modifications de synchronisation sans changer le fonctionnement métier de l'application.

## Garantie de conservation des données

Ce lot ne contient :

- aucune migration SQL ;
- aucune modification de table Supabase ;
- aucun changement de `site_id` ;
- aucun changement de nom de clé ou de colonne ;
- aucun transfert de données ;
- aucune remise à zéro ;
- aucune suppression globale.

Les données restent stockées dans la table existante `order_line_states`, avec une ligne par produit et par site.

La suppression en base reste possible uniquement lors de la suppression explicite d'un produit. Elle appelle toujours `deleteOrderLineState(productId)`, qui filtre simultanément sur le site courant et l'identifiant du produit.

## Architecture après découpage

### `src/hooks/useCloudSync.ts`

Conserve :

- le chargement de `app_state` ;
- la sauvegarde des clés globales ;
- la file de sauvegarde fiable ;
- l'état général « sauvegarde en cours / sauvegardé / en attente » ;
- la connexion Realtime commune.

### `src/hooks/useOrderLineSync.ts`

Gère uniquement :

- l'état opérationnel par produit ;
- la saisie du stock, de la livraison, du stock cible, du conditionnement et de la marge ;
- le chargement des lignes du site courant ;
- la réception Realtime ciblée ;
- le dernier-écrit-gagne par produit ;
- la suppression explicite d'une ligne lorsque son produit est supprimé.

### `src/hooks/orderLineSyncModel.ts`

Contient les règles pures et testables :

- correspondance champ d'interface / colonne Supabase ;
- transformation d'une ligne Supabase vers l'état React ;
- fusion ciblée sans remplacer les autres produits ;
- refus d'une ligne cloud plus ancienne qu'une saisie locale ;
- filet de compatibilité avec les anciennes données.

## Protections contre une perte de données

- Une réponse Supabase vide ne remplace jamais l'état présent par un objet vide.
- Lors d'une reconnexion, aucune reconstruction depuis l'ancien format n'est effectuée.
- Une mise à jour Realtime ne remplace que le produit concerné.
- Une ligne cloud plus ancienne que la saisie locale est ignorée.
- Le filet historique est utilisé uniquement au premier chargement si la table dédiée ne contient encore aucune ligne.
- Les événements d'un autre `site_id` sont ignorés.

## Contrôle automatique

Commande dédiée :

```text
npm run test:order-line-sync
```

Elle vérifie notamment :

- qu'une réponse vide conserve toutes les données ;
- qu'une mise à jour d'un produit conserve les autres produits ;
- qu'une ligne cloud ancienne ne remplace pas une saisie locale ;
- que les cinq champs utilisent toujours les mêmes colonnes Supabase ;
- que le filet historique conserve stock, livraison, cible, conditionnement et marge ;
- qu'aucune suppression globale n'est présente dans le hook dédié.

Ce test est inclus dans `npm run verify`.

## Validation fonctionnelle sur TEST

1. Ouvrir une commande existante et noter quelques valeurs déjà présentes.
2. Actualiser la page : les valeurs doivent rester identiques.
3. Modifier un stock, attendre « Sauvegardé », puis actualiser : la nouvelle valeur doit rester présente.
4. Ouvrir la même commande sur un second appareil ou navigateur et vérifier la mise à jour Realtime.
5. Naviguer entre deux fournisseurs : aucune donnée de l'un ne doit apparaître chez l'autre.
6. Ne supprimer aucun produit pendant ce contrôle, afin de vérifier uniquement le chargement et la sauvegarde.
