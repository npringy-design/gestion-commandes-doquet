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

## Source de verite Doquet

Pour Doquet uniquement pour le moment, `Parametre commandes` devient la source de verite de la liste produits.

Consequences :

- la liste Doquet du `Calcul vente ratio` est creee/alignee depuis les lignes Doquet de `Parametre commandes` ;
- le champ `Produit` de `Parametre commandes` devient le `Nom affiche dans les commandes` ;
- si un produit Doquet n'existe pas encore dans le ratio, il est cree automatiquement ;
- si un produit Doquet existe deja, son nom affiche et son colisage sont alignes sur `Parametre commandes` ;
- le `searchName` sert toujours a chercher dans l'import inventaire et reste modifiable pour le mapping ;
- l'ajout/suppression de produits Doquet doit se faire depuis `Parametre commandes`, pas depuis `Calcul vente ratio`.

Cette regle est limitee a Doquet pour l'instant. Les autres fournisseurs conservent leur fonctionnement actuel.

## Colisage

Le colisage renseigne dans `Parametre commandes` devient la source prioritaire pour les feuilles de commande.

Regle :

- si une ligne de `Parametre commandes` correspond au produit du fournisseur actif et contient un colisage superieur a 0, ce colisage est utilise dans la feuille de commande ;
- sinon la feuille garde le colisage deja present sur le produit ;
- quand le colisage vient de `Parametre commandes`, il est affiche en lecture seule dans la feuille de commande pour eviter deux sources de modification contradictoires.

Impact calcul :

- conversion stock colisage + stock piece vers stock total ;
- conversion livraison a venir en unites ;
- calcul du nombre de colis a commander.

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

Cette colonne ne modifie pas directement les calculs. Elle sert d'information de parametre et de garde-fou operationnel.

## Affichage dans les pages de commandes

Les pages de commandes fournisseur affichent aussi l'unite de comptage et le colisage lie.

Sur PC, la page garde un tableau complet. La colonne `Unite comptage` est placee entre :

1. `U. Piece en stock` ;
2. `Colisage`.

Sur mobile et tablette, il ne faut pas utiliser un tableau horizontal a swiper. L'affichage operationnel est une carte par produit, avec toutes les informations utiles visibles sans glisser horizontalement :

- nom du produit ;
- unite de comptage ;
- colisage ;
- besoin ou conso estimee selon le mode ;
- U. colisage en stock ;
- U. piece en stock ;
- total a commander.

Les valeurs affichees viennent de `orderParameterRows`, en recherchant le produit du fournisseur actif. Si aucune unite n'est renseignee, la page affiche `-`.

## Sauvegarde

Les donnees restent sauvegardees dans la cle Supabase existante `orderParameterRows`.

Aucune nouvelle table Supabase n'est necessaire.

## Points de vigilance

- Ne pas melanger les lignes de plusieurs fournisseurs pendant un import.
- Ne pas supprimer les donnees existantes des autres fournisseurs quand on importe un fichier pour un fournisseur precis.
- Ne pas remettre de scroll horizontal obligatoire sur mobile/tablette pour les commandes : ce n'est pas pratique en operationnel.
- Si la colonne `Unite de comptage` devient plus tard une base de calcul, ajouter une validation stricte avant de l'utiliser dans les commandes.
- Si un colisage est corrige, le faire en priorite dans `Parametre commandes` pour eviter deux sources de verite.
- Pour Doquet, ne pas ajouter/supprimer les produits directement dans `Calcul vente ratio` : modifier la liste dans `Parametre commandes`.
