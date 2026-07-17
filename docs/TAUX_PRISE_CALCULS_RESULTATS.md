# Sécurisation des calculs du taux de prise

## Objectif

Les calculs de la page résultat sont centralisés dans un modèle pur et testable.
L'affichage et les formules métier restent identiques.

## Garanties

- les variantes proches, notamment `10 pièces` et `20 pièces`, restent distinctes ;
- les ventes liées sont additionnées uniquement au bon produit ;
- le taux reste `ventes / couverts × 100` ;
- la marge totale reste `ventes × marge unitaire` ;
- le chiffre d'affaires théorique reste `ventes × prix de vente HT` ;
- une marge en euros enregistrée reste prioritaire sur le pourcentage ;
- zéro couvert produit un taux à zéro, jamais `Infinity` ou `NaN` ;
- le classement et la largeur maximale des barres restent corrects quel que soit le tri.

## Éléments inchangés

- aucune table, colonne, clé ou donnée Supabase modifiée ;
- aucune nouvelle écriture ou activation Realtime ;
- aucun changement visuel ;
- imports et snapshots existants conservés.

Le test `npm run test:take-rate-results` couvre ces règles et fait partie de
`npm run verify`.
