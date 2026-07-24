# États de liaison — Calcul vente ratio

## Objectif

Distinguer visuellement trois situations dans la page `Calcul vente ratio` :

- **orange** : aucune ligne correspondante n'a été trouvée dans l'import ;
- **violet** : le produit est bien lié à une ligne de l'import, mais la quantité trouvée vaut `0` ;
- **vert** : le produit est lié et la quantité trouvée est différente de `0`.

## Règle technique

La valeur retournée par la recherche dans l'import est interprétée ainsi :

- `null` = produit non lié ;
- `0` = produit lié sans vente ;
- toute autre valeur numérique = produit lié avec vente.

Le statut est partagé par la bordure de la carte, son fond, le champ de recherche et le bouton rond de liaison.

## Filtre et compteurs

Un produit violet est considéré comme **lié** :

- il n'apparaît pas dans le filtre `Produits non liés` ;
- il est comptabilisé dans `OK` ;
- il n'est pas comptabilisé dans `À revoir`.

## Compatibilité

Pour les mois figés, les snapshots existants restent utilisés. Lorsqu'un ancien snapshot à zéro a été enregistré comme non lié par l'ancienne logique, l'import du mois est relu uniquement pour reconnaître une correspondance réelle à zéro.

## Périmètre

- aucun calcul de ratio ou de commande modifié ;
- aucune donnée Supabase migrée ;
- aucun produit renommé ou relié automatiquement ;
- changement limité à l'interprétation et à l'affichage du statut de liaison.

## Vérification TEST

1. Choisir un produit non lié : la carte doit rester orange.
2. Le relier à une ligne dont `Conso Théorique Qté` vaut `0` : la carte et le bouton doivent devenir violets.
3. Activer `Produits non liés` : le produit violet ne doit plus apparaître.
4. Relier un produit à une valeur positive : la carte doit devenir verte.
