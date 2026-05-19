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

La colonne `Unite de comptage` est une liste deroulante.

Objectif metier : indiquer comment le produit doit etre compte en stock/inventaire pour eviter les erreurs d'unite.

Valeurs standards proposees :

- `Piece` ;
- `Bouteille` ;
- `Kg` ;
- `Litre` ;
- `Carton` ;
- `Sachet` ;
- `Barquette` ;
- `Seau` ;
- `Bidon` ;
- `Pack` ;
- `Caisse` ;
- `Boite` ;
- `Bac` ;
- `Fut`.

Regle d'import :

- si l'import contient une unite detectee, elle est conservee ;
- si l'unite importee correspond a une valeur standard avec une orthographe proche, elle est normalisee ;
- si l'unite importee n'est pas dans la liste standard, elle reste affichee dans la liste pour ne pas perdre l'information ;
- si aucune unite n'est detectee, l'utilisateur choisit manuellement dans la liste.

Cette colonne ne modifie pas encore les calculs. Elle sert d'information de parametre et de garde-fou operationnel.

## Affichage dans les pages de commandes

Les pages de commandes fournisseur affichent aussi l'unite de comptage.

Sur PC, la page garde un tableau complet. La colonne `Unite comptage` est placee entre :

1. `U. Piece en stock` ;
2. `Colisage`.

Sur mobile et tablette, il ne faut pas utiliser un tableau horizontal a swiper. L'affichage operationnel est une carte par produit, avec toutes les informations utiles visibles sans glisser horizontalement :

- nom du produit ;
- unite de comptage ;
- besoin ou conso estimee selon le mode ;
- U. colisage en stock ;
- U. piece en stock ;
- total a commander.

La valeur affichee vient de `orderParameterRows`, en recherchant le produit du fournisseur actif. Si aucune unite n'est renseignee, la page affiche `-`.

Cette information est en lecture seule dans les pages de commandes : la modification se fait depuis `Parametre commandes`.

## Sauvegarde

Les donnees restent sauvegardees dans la cle Supabase existante `orderParameterRows`.

Aucune nouvelle table Supabase n'est necessaire.

## Points de vigilance

- Ne pas melanger les lignes de plusieurs fournisseurs pendant un import.
- Ne pas supprimer les donnees existantes des autres fournisseurs quand on importe un fichier pour un fournisseur precis.
- Ne pas remettre de scroll horizontal obligatoire sur mobile/tablette pour les commandes : ce n'est pas pratique en operationnel.
- Si la colonne `Unite de comptage` devient plus tard une base de calcul, ajouter une validation stricte avant de l'utiliser dans les commandes.
