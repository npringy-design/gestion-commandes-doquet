# Hydratation cloud du taux de prise

## Objectif

Les pages de paramétrage et de résultat interprètent désormais les données Supabase du taux de prise avec un modèle unique.

## Clés concernées

- `takeRateBaseRows`
- `takeRateMarginCatalog`
- `takeRateMarginFileName`
- `takeRateFrozenMonths`

## Garanties

- les deux pages lisent les mêmes clés de la même manière ;
- une réponse vide ou partielle conserve les valeurs locales des clés absentes et ne crée aucune donnée artificielle ;
- une valeur mal formée est ignorée au lieu d'être appliquée ;
- un tableau ne peut pas être interprété comme une collection de mois figés ;
- seuls les timestamps des valeurs réellement acceptées sont conservés pour les sauvegardes suivantes ;
- les lignes sans aucune information de marge ne sont pas injectées dans la base active.

## Fichiers concernés

- `src/utils/takeRateCloudModel.ts`
- `src/pages/TakeRatePage.tsx`
- `src/pages/TakeRateResultsPage.tsx`
- `scripts/test-take-rate-cloud-model.mjs`

## Éléments inchangés

- aucune table, colonne, clé ou politique Supabase ;
- aucune écriture SQL ;
- aucun calcul ou écran ;
- aucune donnée existante.

## Retour arrière

Le retour arrière consiste uniquement à replacer l'interprétation des quatre clés dans chaque page. Aucune restauration de données n'est nécessaire.
