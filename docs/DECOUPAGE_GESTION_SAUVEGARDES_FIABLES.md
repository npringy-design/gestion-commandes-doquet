# Découpage de la gestion des sauvegardes fiables

## Objectif

Ce cinquième lot de refactorisation isole hors de `useCloudSync.ts` le cycle de vie commun des sauvegardes fiables, utilisé à la fois par `app_state` et par les lignes de commande.

Il ne change ni les données sauvegardées, ni les tables Supabase, ni les délais visibles, ni les messages adressés à l'utilisateur.

## Architecture

### `src/hooks/useReliableSaveLifecycle.ts`

Le hook centralise maintenant :

- les états `idle`, `saving`, `saved`, `pending` et `error` ;
- le nombre de sauvegardes encore présentes dans la file locale ;
- la confirmation des écritures Supabase ;
- les messages de sauvegarde non confirmée, conflit, stockage indisponible et erreur ;
- la limitation des notifications à une toutes les cinq secondes ;
- le retour automatique de `saved` vers `idle` après 1,8 seconde ;
- la reprise de la file locale au retour de la connexion ;
- le vidage des sauvegardes temporisées lorsque la page devient cachée ou se ferme.

### `src/hooks/reliableSaveLifecycleModel.ts`

Le modèle contient les décisions pures de statut et de message. Elles peuvent ainsi être testées sans navigateur ni connexion Supabase.

### `src/hooks/useCloudSync.ts`

Le hook principal reste l'orchestrateur : il relie l'hydratation, les lignes de commande, la persistance `app_state` et Realtime. Il ne maintient plus directement les compteurs, timers, messages et reprises de la file fiable.

## Garanties conservées

- Une écriture n'affiche `Sauvegardé` qu'après confirmation Supabase.
- Une écriture non confirmée reste conservée dans la file locale.
- Une sauvegarde locale plus ancienne que le cloud est écartée comme conflit.
- Les fichiers locaux de TEST et de production restent séparés par environnement et par site.
- Les saisies rapides d'une même ligne de commande restent fusionnées avant l'envoi.
- Le retour réseau renvoie la file locale puis recharge l'état cloud confirmé.
- Realtime reste réservé à la partie commandes et aux deux dates de livraison déjà prévues.

## Éléments Supabase inchangés

Aucune table, colonne, politique RLS, clé `app_state`, donnée ou requête SQL n'est ajoutée ou modifiée par ce lot.

## Tests

Le test `npm run test:save-lifecycle` vérifie les décisions de statut, les messages, les délais, les événements de fermeture et la délégation effective depuis `useCloudSync`.

Le test historique `npm run test:sync` continue de contrôler la confirmation réelle, la file locale, les conflits, la fusion des lignes et la séparation TEST/production.

Les deux tests sont intégrés à `npm run verify`.

## Validation TEST

1. Modifier une valeur de commande et attendre l'indication `Sauvegardé`.
2. Actualiser la page et vérifier que la valeur est conservée.
3. Couper le réseau, modifier une valeur et vérifier l'indication de sauvegarde en attente.
4. Rétablir le réseau et vérifier que la sauvegarde est renvoyée automatiquement.
5. Contrôler depuis un second appareil que la valeur finale est identique.

## Retour arrière

Le retour arrière consiste uniquement à remettre la gestion des statuts et de la reprise dans `useCloudSync.ts`. Aucune restauration de données ou opération Supabase n'est nécessaire.
