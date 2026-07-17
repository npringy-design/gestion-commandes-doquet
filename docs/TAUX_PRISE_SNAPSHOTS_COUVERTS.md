# Stabilisation des mois figés du taux de prise

## Problème traité

Un mois figé conservait déjà les produits, les liaisons et les ventes importées,
mais le calcul continuait à lire le nombre de couverts courant.

Une correction ultérieure des couverts pouvait donc modifier le taux de prise
d'un mois pourtant figé.

## Correction

Les nouveaux snapshots `takeRateFrozenMonths` enregistrent aussi le nombre de
couverts du mois. Les pages de paramétrage et de résultat utilisent cette valeur
figée avant la valeur courante.

Les anciens snapshots restent compatibles : lorsqu'ils ne possèdent pas encore
la propriété `covers`, l'application conserve le comportement historique et lit
les couverts courants.

## Éléments inchangés

- aucune table ou colonne Supabase ajoutée ;
- aucune requête SQL ;
- aucune activation Realtime supplémentaire ;
- clés `app_state` existantes conservées ;
- imports, liaisons produits, marge et calcul du taux inchangés.

## Test TEST

1. Choisir un mois non figé dans Taux de prise.
2. Noter son nombre de couverts et son taux sur un produit lié.
3. Figer le mois.
4. Modifier temporairement les couverts de ce mois depuis Paramètres / Stats.
5. Revenir sur Taux de prise : le taux du mois figé doit rester identique.
6. Défiger le mois : le calcul doit alors reprendre les couverts courants.

Le test automatique `npm run test:take-rate-snapshots` protège aussi les anciens
snapshots dépourvus de couverts.
