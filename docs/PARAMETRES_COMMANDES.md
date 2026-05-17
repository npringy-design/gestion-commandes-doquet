# Parametre commandes

## Role de la page

La page `Parametre commandes` sert a preparer les informations de base utilisees pour les commandes fournisseur.

Elle contient une liste de produits parametrables avec :

- le nom du produit ;
- le colisage ;
- la valeur unite ;
- l'unite de comptage.

## Fournisseurs

La page fonctionne maintenant par fournisseur.

Sous l'entete, des boutons permettent de choisir le fournisseur actif. Les lignes affichees sont uniquement celles du fournisseur selectionne.

Regle importante :

- une ligne appartient au fournisseur stocke dans `supplierId` ;
- les anciennes lignes sans `supplierId` sont rattachees automatiquement au fournisseur actif au chargement de la page ;
- l'import Excel remplace uniquement les lignes du fournisseur actif, pas celles des autres fournisseurs.

## Unite de comptage

La colonne `Unite de comptage` est un champ texte libre.

Objectif metier : indiquer comment le produit doit etre compte en stock/inventaire pour eviter les erreurs d'unite.

Exemples :

- `kg` ;
- `sachet` ;
- `piece` ;
- `carton`.

Cette colonne ne modifie pas encore les calculs. Elle sert d'information de parametre et de garde-fou operationnel.

## Affichage dans les pages de commandes

Les pages de commandes fournisseur affichent aussi l'unite de comptage.

La colonne est placee entre :

1. `U. Piece en stock` ;
2. `Colisage`.

Elle reste visible sur mobile et tablette dans le tableau horizontal scrollable.

La valeur affichee vient de `orderParameterRows`, en recherchant le produit du fournisseur actif. Si aucune unite n'est renseignee, la page affiche `-`.

Cette colonne est en lecture seule dans les pages de commandes : la modification se fait depuis `Parametre commandes`.

## Sauvegarde

Les donnees restent sauvegardees dans la cle Supabase existante `orderParameterRows`.

Aucune nouvelle table Supabase n'est necessaire.

## Points de vigilance

- Ne pas melanger les lignes de plusieurs fournisseurs pendant un import.
- Ne pas supprimer les donnees existantes des autres fournisseurs quand on importe un fichier pour un fournisseur precis.
- Si la colonne `Unite de comptage` devient plus tard une base de calcul, ajouter une validation stricte avant de l'utiliser dans les commandes.
