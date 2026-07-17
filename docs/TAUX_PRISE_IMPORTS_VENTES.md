# Sécurisation des imports de ventes du taux de prise

## Objectif

Les pages de paramétrage et de résultat utilisent désormais une seule lecture des fichiers de ventes.
Le comportement visible et les formules métier ne changent pas.

## Garanties

- les fichiers séparés par point-virgule, tabulation ou virgule restent acceptés ;
- les libellés et séparateurs placés entre guillemets sont correctement lus ;
- les champs CSV multilignes sont pris en charge ;
- les colonnes historiques `Libellé`, `Désignation`, `Produit`, `Article` ou `Nom` restent reconnues ;
- les quantités `Nombre` et `Nb` restent reconnues ;
- plusieurs lignes du même produit sont additionnées ;
- les variantes proches, notamment `10 pièces` et `20 pièces`, restent séparées ;
- un fichier vide ou sans les colonnes attendues ne crée aucune vente artificielle.

## Fichiers concernés

- `src/utils/takeRateSalesParser.ts`
- `src/pages/TakeRatePage.tsx`
- `src/pages/TakeRateResultsPage.tsx`
- `scripts/test-take-rate-sales-parser.mjs`

## Éléments inchangés

- aucune table, donnée, clé ou règle Supabase ;
- aucun calcul de taux, marge ou chiffre d'affaires ;
- aucun écran ni parcours utilisateur ;
- aucun mois déjà figé.

## Retour arrière

Le retour arrière consiste uniquement à remettre les deux lectures CSV locales. Aucune restauration de données n'est nécessaire.
