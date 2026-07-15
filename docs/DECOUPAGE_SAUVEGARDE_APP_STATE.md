# Découpage de la sauvegarde `app_state`

## Objectif

Ce quatrième lot de refactorisation isole la sauvegarde de l'état global Supabase `app_state` hors de `useCloudSync.ts`.

Il ne modifie ni le comportement visible, ni les formules de commande, ni les données existantes. La synchronisation des lignes de commande reste séparée dans `useOrderLineSync`.

## Architecture après découpage

### `src/hooks/useCloudSync.ts`

Conserve l'orchestration générale :

- statut de synchronisation ;
- chargement initial ;
- reprise des sauvegardes locales ;
- coordination avec Realtime et les lignes de commande.

Il délègue maintenant l'enregistrement des clés `app_state` à `useAppStatePersistence`.

### `src/hooks/useAppStatePersistence.ts`

Gère :

- la détection d'une valeur réellement modifiée ;
- la création du timestamp local ;
- la planification dans la file de sauvegarde fiable ;
- la confirmation Supabase ;
- la mise à jour des curseurs LWW après confirmation ;
- les délais propres à chaque clé ;
- la protection des données cloud-only pendant le chargement initial.

### `src/hooks/appStatePersistenceModel.ts`

Centralise les règles pures :

- décision de sauvegarder, ignorer, protéger ou seulement mémoriser une signature ;
- liste des clés cloud-only ;
- délais de sauvegarde historiques, conservés à l'identique.

## Garanties de conservation

- Aucun SQL n'est ajouté ou exécuté.
- Aucune table, colonne, clé ou valeur Supabase n'est renommée.
- Les 17 clés `app_state` existantes restent sauvegardées.
- Une valeur déjà confirmée n'est pas renvoyée inutilement.
- Une hydratation cloud n'est jamais réexpédiée comme une saisie locale.
- Un inventaire ou un import de préparation vide ne peut pas écraser le cloud avant un premier chargement réussi.
- Une donnée cloud plus récente continue de gagner sur une sauvegarde locale plus ancienne.
- Les délais de debounce restent inchangés.

## Contrôle automatique

Commande dédiée :

```text
npm run test:app-state-persistence
```

Le test vérifie les décisions de sauvegarde, les protections cloud-only, les délais, les 17 clés, le contrôle LWW et la délégation effective depuis `useCloudSync`.

Ce test est intégré à `npm run verify`.

## Validation sur TEST

1. Ouvrir l'application TEST et vérifier le chargement des produits et paramètres.
2. Modifier une valeur globale, par exemple une date de livraison ou un paramètre fournisseur.
3. Attendre l'état « Sauvegardé », puis actualiser la page.
4. Vérifier que la valeur est conservée.
5. Couper la connexion, modifier une valeur, puis rétablir le réseau.
6. Vérifier que la sauvegarde en attente est reprise et confirmée sans effacement.

## Retour arrière

Le lot peut être annulé en revenant au commit précédent. Aucune migration de données n'est nécessaire.
