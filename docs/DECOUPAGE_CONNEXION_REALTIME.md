# Découpage de la connexion Supabase Realtime

## Objectif

Ce troisième lot de refactorisation isole la connexion Supabase Realtime hors de `useCloudSync.ts`.

Le fonctionnement métier, les formules de commande, les tables Supabase et les données existantes ne changent pas.

## Garantie de conservation des données

Ce lot ne contient :

- aucune migration SQL ;
- aucune modification de table Supabase ;
- aucun changement de `site_id` ;
- aucun changement de nom de clé ou de colonne ;
- aucun transfert de données ;
- aucune remise à zéro ;
- aucune suppression.

Le hook Realtime transmet uniquement les événements reçus aux gestionnaires déjà existants. Il ne possède aucun setter métier et n'appelle aucune fonction d'écriture ou de suppression Supabase.

## Architecture après découpage

### `src/hooks/useCloudSync.ts`

Conserve :

- le chargement initial et les rechargements de sécurité ;
- la sauvegarde fiable et la file locale ;
- le statut « sauvegarde en cours / sauvegardé / en attente » ;
- le filtrage des clés globales autorisées en Realtime ;
- l'orchestration avec les lignes de commande.

Il ne crée plus directement de canal Supabase et ne contient plus les délais de reconnexion.

### `src/hooks/useCloudRealtime.ts`

Gère uniquement :

- l'ouverture du canal Realtime du site courant ;
- les souscriptions aux tables `app_state` et `order_line_states` ;
- la fermeture de l'ancien canal avant toute nouvelle souscription ;
- la reconnexion après `CHANNEL_ERROR` ou `TIMED_OUT` ;
- la reprise au retour sur l'application ;
- la détection du retour réseau avec l'événement navigateur `online` ;
- le rechargement de sécurité après reconnexion ;
- le renvoi des sauvegardes restées en attente.

### `src/hooks/cloudRealtimeModel.ts`

Contient les règles pures et testables :

- délais de reconnexion de 2 secondes, 5 secondes puis 10 secondes ;
- plafonnement des tentatives suivantes à 10 secondes ;
- refus de programmer plusieurs timers de reconnexion ;
- décision de reprise lorsque l'application redevient visible ;
- validation des événements `app_state` ;
- rejet des événements provenant d'un autre `site_id`.

## Protections contre une perte de données

- Les deux souscriptions Supabase restent filtrées par `CURRENT_SITE_ID`.
- Un événement `app_state` portant explicitement un autre `site_id` est ignoré.
- L'ancien canal est retiré avant la création du suivant, ce qui évite plusieurs souscriptions concurrentes.
- Un seul timer de reconnexion peut être actif à la fois.
- La destruction du hook annule le timer et ferme le canal.
- Le retour sur l'application déclenche un rechargement avec `{ isReconnect: true }`, qui conserve les protections des lots précédents contre les réponses vides ou partielles.
- Une perte temporaire de Realtime ne supprime aucune donnée et ne déclenche aucune remise à zéro.
- Les sauvegardes locales en attente sont renvoyées automatiquement lorsque l'application redevient visible.
- Le retour du réseau recrée volontairement le canal puis recharge l'état final du site, même si le navigateur croyait encore l'ancien canal connecté.
- Les saisies effectuées hors connexion sont renvoyées avant ce rechargement final afin de conserver le mécanisme de sauvegarde fiable et de conflit existant.

## Correction du retour réseau sur mobile

Un test réel a montré le cas suivant :

1. le téléphone reste ouvert sur une commande ;
2. le mode avion est activé ;
3. des valeurs sont modifiées depuis un autre appareil ;
4. le mode avion est désactivé sans mettre l'application en arrière-plan ;
5. le téléphone ne recevait pas automatiquement les événements manqués.

La cause était l'absence d'écoute de l'événement navigateur `online`. Le canal pouvait rester marqué `joined` en mémoire alors que la connexion avait été interrompue.

Le correctif ajoute deux filets de sécurité :

- au retour du réseau, l'ancien canal est fermé, un canal neuf est ouvert et un rechargement sécurisé est effectué ;
- à chaque retour au premier plan, un rechargement sécurisé est effectué même si le canal indique encore `joined`.

Ces rechargements utilisent les protections déjà validées : une réponse vide, partielle ou plus ancienne qu'une saisie locale ne peut pas remettre les données à zéro.

## Contrôle automatique

Commande dédiée :

```text
npm run test:cloud-realtime
```

Le test vérifie notamment :

- les délais de reconnexion 2/5/10 secondes ;
- l'absence de second timer de reconnexion ;
- l'absence de reconnexion après destruction du hook ;
- le rejet d'un événement provenant d'un autre site ;
- la présence des filtres par site sur les deux tables ;
- la fermeture de l'ancien canal avant une nouvelle souscription ;
- le rechargement de sécurité au retour sur l'application ;
- la détection du retour réseau lorsque la page reste visible ;
- la recréation du canal et la récupération des données manquées ;
- le renvoi des saisies locales avant le rechargement final ;
- la reprise des sauvegardes en attente ;
- l'absence de fonction de suppression ou de remise à zéro dans le hook Realtime ;
- la délégation effective depuis `useCloudSync`.

Ce test est intégré à `npm run verify`.

## Validation fonctionnelle sur TEST

1. Ouvrir une commande sur l'application TEST avec des valeurs déjà présentes.
2. Ouvrir la même commande dans un second navigateur ou sur un second appareil.
3. Activer le mode avion sur le téléphone en laissant la commande affichée.
4. Modifier plusieurs stocks depuis le PC.
5. Désactiver le mode avion sans actualiser ni changer de page sur le téléphone.
6. Vérifier que les nouvelles valeurs apparaissent automatiquement sur le téléphone.
7. Faire ensuite le test inverse : saisir hors connexion sur le téléphone, rétablir le réseau et vérifier la mise à jour du PC.
8. Actualiser les deux appareils et confirmer que les mêmes valeurs restent présentes.
9. Naviguer entre plusieurs fournisseurs pour confirmer qu'aucune donnée ne disparaît ou ne se mélange.
