# Découpage de l’orchestration du chargement cloud

## Objectif

Ce sixième lot de refactorisation isole hors de `useCloudSync.ts` le chargement initial Supabase, le rechargement après reconnexion et le déclenchement de la reprise des sauvegardes locales.

Il ne change ni les données chargées, ni les tables Supabase, ni l’ordre d’application des données.

## Architecture

### `src/hooks/useCloudHydrationCoordinator.ts`

Le coordinateur centralise maintenant :

- la détection de la configuration Supabase ;
- le chargement initial de `app_state` ;
- l’hydratation des lignes de commande après `app_state` ;
- le filet de compatibilité des anciens produits et `orderStates` ;
- le statut indiquant que le premier chargement est terminé ;
- la reprise des sauvegardes locales en attente ;
- l’écoute du retour réseau utilisée pour relancer cette reprise ;
- le même rechargement sécurisé lors d’une reconnexion.

### `src/hooks/useCloudSync.ts`

Le hook principal assemble les modules dédiés. Il ne charge plus directement Supabase et n’installe plus lui-même l’écouteur réseau de reprise.

## Ordre conservé

1. Charger les lignes `app_state` du site courant.
2. Appliquer uniquement les clés présentes et suffisamment récentes.
3. Charger les lignes de commande dédiées.
4. Utiliser l’ancien état en mémoire uniquement lors du premier chargement et uniquement si la table dédiée est vide.
5. Au retour du réseau, reprendre les sauvegardes locales puis recharger l’état cloud final confirmé.

## Garanties de conservation

- Une réponse `null` n’est pas considérée comme un chargement réussi.
- Une réponse vide ou partielle ne remet aucune donnée à zéro.
- Une reconnexion ne remplace pas les lignes de commande par un résultat vide.
- Les timestamps locaux plus récents restent prioritaires.
- Une exception libère l’interface sans supprimer les données déjà présentes.
- Les fichiers locaux restent séparés entre TEST et production et par site.

## Éléments Supabase inchangés

Aucune table, colonne, politique RLS, requête SQL, donnée ou clé `app_state` n’est ajoutée ou modifiée.

## Tests

Le test `npm run test:cloud-hydration` vérifie la délégation depuis `useCloudSync`, l’ordre du chargement, les filets historiques, le statut de fin de chargement, la reprise réseau et l’absence de suppression.

Il est intégré à `npm run verify` avec les tests existants de synchronisation, Realtime et sauvegarde fiable.

## Validation TEST

1. Ouvrir l’application et vérifier que les produits, fournisseurs et anciennes saisies sont présents.
2. Modifier une quantité, attendre `Sauvegardé`, puis actualiser.
3. Couper le réseau, modifier une quantité, puis rétablir le réseau.
4. Vérifier que la sauvegarde est reprise automatiquement et que la valeur finale est conservée.
5. Contrôler la même valeur depuis un second appareil.

## Retour arrière

Le retour arrière consiste uniquement à remettre l’orchestration dans `useCloudSync.ts`. Aucune restauration de données ou opération Supabase n’est nécessaire.
