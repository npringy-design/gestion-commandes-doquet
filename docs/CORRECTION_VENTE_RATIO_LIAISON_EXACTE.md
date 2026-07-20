# Correction des liaisons exactes dans Calcul vente ratio

## Problème corrigé

Après une sélection manuelle dans l'import inventaire, le libellé choisi était
encore soumis à la recherche approchée. Plusieurs variantes proches pouvaient
donc être additionnées malgré une liaison exacte, par exemple des steaks de
grammages différents.

## Règle appliquée

- si le libellé sélectionné correspond exactement à une ou plusieurs lignes
  normalisées de la colonne produit, seules ces lignes sont additionnées ;
- le calcul continue de lire `Conso Théorique Qté` ;
- le diviseur KG vers unités reste appliqué après la lecture ;
- la recherche automatique par mots forts reste utilisée uniquement lorsqu'il
  n'existe aucune correspondance exacte.

Les doublons portant exactement le même libellé restent additionnés, car ils
représentent le même produit dans l'import.

## Non-régression

Le test `scripts/test-ratio-import-mapping.mjs` reproduit le cas observé : la
liaison manuelle du steak 15 % VBF 100 g renvoie `30,2` et n'ajoute plus les
variantes 140 g et 210 g. Il protège aussi le diviseur et le repli automatique.

## Périmètre

- aucun changement de formule de commande ;
- aucune donnée ou table Supabase modifiée ;
- aucun mois figé recalculé automatiquement ;
- correction limitée à la lecture en direct des imports inventaire et aux
  prochains figements.
