# Découpage du traitement Realtime `app_state`

## Objectif

Ce septième lot de refactorisation isole hors de `useCloudSync.ts` le filtrage et l’application des événements `app_state` reçus par le canal Supabase Realtime.

La connexion au canal reste dans `useCloudRealtime`. Le nouveau module traite uniquement les événements déjà validés et transmis par ce canal.

## Architecture

### `src/hooks/useAppStateRealtimeEvents.ts`

Le hook centralise maintenant :

- la lecture du timestamp local de la clé reçue ;
- l’application des événements autorisés ;
- la mise à jour du dernier timestamp cloud accepté ;
- la file temporaire historique utilisée lorsqu’un événement doit attendre la fin d’une saisie ;
- la conservation du seul événement le plus récent pour chaque clé ;
- le vidage de cette file après le délai historique de 150 ms.

### `src/hooks/appStateRealtimeEventModel.ts`

Le modèle pur décide si un événement doit être ignoré, différé ou appliqué.

Realtime reste volontairement limité à :

- `deliveryDateBySupplier` ;
- `nextDeliveryDateBySupplier`.

Les autres clés `app_state` continuent d’être chargées par les rechargements sécurisés, mais ne sont pas appliquées instantanément.

### `src/hooks/useCloudSync.ts`

Le hook principal assemble le traitement des événements avec la connexion Realtime. Il ne contient plus la liste des clés autorisées, la comparaison des timestamps ni la file temporaire.

## Garanties conservées

- Une clé non autorisée est ignorée.
- Une valeur cloud plus ancienne ou identique à la saisie locale est ignorée.
- Un événement ignoré n’avance pas le timestamp cloud connu.
- Les deux dates de livraison conservent leur application immédiate historique.
- La file temporaire conserve uniquement l’événement le plus récent par clé.
- Aucune écriture ou suppression Supabase n’est effectuée par ce hook.
- Les filtres `site_id` restent gérés par le canal Realtime existant.

## Éléments Supabase inchangés

Aucune table, colonne, politique RLS, donnée, requête SQL ou configuration Realtime n’est ajoutée ou modifiée.

## Tests

Le test `npm run test:app-state-realtime` vérifie les deux clés autorisées, le rejet des autres clés, la protection LWW, la délégation depuis `useCloudSync`, la file temporaire et l’absence d’écriture Supabase.

Il est intégré à `npm run verify` avec les tests existants de connexion Realtime, synchronisation et reprise réseau.

## Validation TEST

1. Ouvrir la même commande sur deux appareils.
2. Modifier une date de livraison sur le premier appareil.
3. Vérifier que la date apparaît sur le second sans actualisation.
4. Modifier ensuite la date depuis le second appareil et vérifier le retour sur le premier.
5. Actualiser les deux appareils et confirmer que la dernière date reste identique.

## Retour arrière

Le retour arrière consiste uniquement à remettre le filtrage et la file temporaire dans `useCloudSync.ts`. Aucune restauration de données ou opération Supabase n’est nécessaire.
