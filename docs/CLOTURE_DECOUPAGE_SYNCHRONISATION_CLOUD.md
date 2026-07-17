# Clôture du découpage de la synchronisation cloud

## Objectif

Ce document clôt le chantier de sécurisation et de découpage de `useCloudSync`.
Le hook reste le point d'assemblage public de la synchronisation, mais ne possède
plus directement les accès Supabase, les timers, les écouteurs navigateur ou les
règles métier de sauvegarde et de chargement.

## Architecture stabilisée

- `useOrderLineSync` : lignes de commande et compatibilité historique ;
- `useAppStateHydration` : application sûre des valeurs `app_state` ;
- `useAppStatePersistence` : sauvegarde différée des clés `app_state` ;
- `useReliableSaveLifecycle` : statuts, confirmations et reprise de la file locale ;
- `useCloudHydrationCoordinator` : chargement initial et reprise après reconnexion ;
- `useAppStateRealtimeEvents` : filtrage et application des événements `app_state` ;
- `useCloudRealtime` : canal Supabase Realtime et reconnexion ;
- `useCloudSync` : assemblage de ces responsabilités et contrat public historique.

## Garanties conservées

- une réponse cloud vide ou partielle ne vide pas l'application ;
- une valeur cloud ancienne ne remplace pas une saisie locale plus récente ;
- les lignes de commande sont supprimées uniquement sur action ciblée ;
- la file locale est reprise avant le rechargement cloud de reconnexion ;
- Realtime `app_state` reste limité aux deux dates de livraison ;
- les filtres `site_id`, les délais et les messages existants restent inchangés ;
- aucune table, clé, donnée ou règle SQL Supabase n'est modifiée par ce lot.

## Contrôle automatique de clôture

Le test `scripts/test-cloud-sync-orchestrator.mjs`, intégré à `npm run verify`,
empêche de remettre directement dans `useCloudSync` :

- un accès au client ou aux utilitaires Supabase ;
- une sauvegarde fiable directe ;
- un canal Realtime ;
- un timer ou un écouteur navigateur ;
- une suppression de ligne de commande.

Il vérifie également que les sept modules dédiés restent assemblés et que le
contrat public de `useCloudSync` ne change pas accidentellement.

## Validation manuelle finale sur TEST

1. Ouvrir la même commande sur un téléphone et un ordinateur.
2. Modifier une ligne sur un appareil et vérifier sa réception sur l'autre.
3. Couper le réseau du téléphone, effectuer une petite saisie, puis rétablir le réseau.
4. Attendre la confirmation de sauvegarde et actualiser les deux appareils.
5. Vérifier que les valeurs sont identiques et qu'aucune ligne n'a disparu.

Après cette validation, le chantier de découpage peut être considéré comme clos.
Les évolutions suivantes doivent répondre à un besoin métier ou à une anomalie
observée, sans poursuivre un découpage purement mécanique de `useCloudSync`.
