# Découpage du chargement `app_state`

## Objectif

Ce deuxième lot de refactorisation isole le chargement et l'application de l'état global Supabase `app_state` hors de `useCloudSync.ts`.

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

Une réponse Supabase vide ou partielle n'est jamais interprétée comme une demande d'effacement. Seules les clés réellement reçues et jugées applicables sont envoyées aux setters React.

## Architecture après découpage

### `src/hooks/useCloudSync.ts`

Conserve :

- l'appel de chargement Supabase ;
- la sauvegarde fiable et la file locale ;
- le statut « sauvegarde en cours / sauvegardé / en attente » ;
- la connexion Realtime commune ;
- l'orchestration avec les lignes de commande.

Il ne contient plus la liste dupliquée des clés à appliquer lors du chargement initial.

### `src/hooks/useAppStateHydration.ts`

Gère :

- l'application d'une valeur `app_state` reçue en Realtime ;
- l'application d'un ensemble de lignes lors du chargement initial ou d'une reconnexion ;
- la mise à jour des curseurs `updated_at` et des signatures locales ;
- la période de protection pendant laquelle une hydratation cloud ne doit pas être renvoyée immédiatement vers Supabase.

### `src/hooks/appStateSyncModel.ts`

Contient les règles pures et testables :

- construction d'un snapshot à partir des lignes Supabase ;
- refus d'une donnée cloud plus ancienne qu'une modification locale ;
- conservation d'une réponse vide sous la forme d'un snapshot vide ;
- application des seules clés présentes ;
- normalisation inchangée des produits ;
- fusion inchangée des paramètres fournisseurs avec leurs valeurs par défaut ;
- protection du calendrier de couverts contre un remplacement par un calendrier vide ;
- conservation temporaire de l'ancienne clé `orderStates` pour le filet de compatibilité des lignes de commande.

## Protections contre une perte de données

- Une liste de lignes vide ne déclenche aucun setter.
- Une réponse partielle ne modifie pas les clés absentes.
- Une ligne cloud antérieure au timestamp local est ignorée.
- Une clé inconnue reste sans effet sur l'interface.
- Les produits et fournisseurs passent toujours par les mêmes fonctions de normalisation qu'avant le découpage.
- Le chargement des lignes `order_line_states` reste séparé et inchangé.
- Aucune fonction de suppression Supabase n'est ajoutée dans ce lot.

## Contrôle automatique

Commande dédiée :

```text
npm run test:app-state-sync
```

Le test vérifie notamment :

- qu'une réponse vide ne produit aucune valeur à appliquer ;
- qu'une réponse partielle ne contient que les clés reçues ;
- qu'une ligne cloud ancienne est refusée ;
- que le filet historique `orderStates` reste disponible en mémoire ;
- que les clés absentes ne déclenchent aucun setter ;
- qu'un calendrier vide ne remplace pas les couverts présents ;
- que les produits et fournisseurs restent normalisés ;
- que `useCloudSync` délègue réellement le chargement au hook dédié.

Ce test est intégré à `npm run verify`.

## Validation fonctionnelle sur TEST

1. Ouvrir l'application TEST et vérifier que les fournisseurs, produits et paramètres existants sont présents.
2. Ouvrir une commande avec des stocks déjà saisis, puis actualiser la page.
3. Vérifier que les stocks, livraisons, conditionnements et marges sont conservés.
4. Modifier une valeur, attendre « Sauvegardé », puis actualiser.
5. Naviguer vers Calcul vente ratio et Paramètres fournisseurs pour vérifier que les données globales sont toujours présentes.
6. Tester une déconnexion puis une reconnexion sans effectuer de remise à zéro.
