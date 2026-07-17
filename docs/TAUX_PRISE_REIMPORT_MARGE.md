# Conservation des liaisons lors du réimport marge

## Problème protégé

Un nouvel import du fichier de marge reconstruisait toute la base du taux de prise avec des liaisons vides. Les associations de ventes déjà validées pouvaient donc être perdues.

## Comportement actuel

- le nouveau fichier reste la source des produits, familles, prix et marges ;
- une ligne déjà connue conserve son identifiant et ses liaisons de ventes ;
- les variantes proches, notamment `10 pièces` et `20 pièces`, restent séparées ;
- un nouveau produit démarre sans liaison inventée ;
- un produit absent du nouveau catalogue n'est pas recréé ;
- les mois déjà figés ne sont pas modifiés.

La correspondance utilise la clé normalisée exacte du produit. Une ressemblance approximative ne suffit pas à reprendre une ancienne liaison.

## Fichiers concernés

- `src/utils/takeRateMarginRowsModel.ts`
- `src/pages/TakeRatePage.tsx`
- `scripts/test-take-rate-margin-rows.mjs`

## Éléments inchangés

- aucune table, clé ou donnée Supabase n'est modifiée directement ;
- aucun calcul de taux, marge ou chiffre d'affaires ;
- aucun écran ni parcours utilisateur ;
- aucun snapshot déjà figé.

## Retour arrière

Le retour arrière consiste uniquement à rétablir la reconstruction vide lors de l'import. Aucune migration ou restauration Supabase n'est nécessaire.
