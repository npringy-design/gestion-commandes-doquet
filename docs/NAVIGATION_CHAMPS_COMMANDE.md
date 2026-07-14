# Navigation clavier des champs de commande

## Contexte

Sur certains fournisseurs comportant beaucoup de lignes, le bouton `Suivant` du clavier mobile ou la touche `Tabulation` pouvait passer plusieurs produits au lieu d'aller à la ligne suivante.

## Cause

Les champs utilisaient des plages fixes de `tabIndex` :

- livraison à venir : base 100 ;
- unités de colisage en stock : base 200 ;
- unités pièce en stock : base 300.

Quand une liste dépassait environ 100 lignes, les plages se chevauchaient. Plusieurs champs pouvaient alors recevoir le même `tabIndex`, ce qui rendait l'ordre de navigation imprévisible pour le navigateur.

## Correction

La branche de test recalcule désormais un ordre unique à partir du nombre réel de produits affichés :

1. livraison à venir, ligne par ligne ;
2. unités de colisage en stock, ligne par ligne ;
3. unités pièce en stock, ligne par ligne.

Le correctif intercepte aussi la touche `Entrée` envoyée par le bouton `Suivant` des claviers mobiles afin de déplacer le focus vers le champ visible suivant dans le même ordre.

Aucun calcul de commande, aucune quantité et aucune donnée Supabase ne sont modifiés.

## Vérifications manuelles sur staging

- Ouvrir un fournisseur avec une longue liste de produits.
- Placer le curseur dans la colonne `U. Colisage en stock`.
- Utiliser `Suivant` sur mobile : le focus doit descendre d'une seule ligne à chaque fois.
- Utiliser `Tabulation` sur PC : le focus doit suivre les lignes sans saut.
- Vérifier notamment le passage depuis la ligne Angostura vers la ligne suivante, sans saut direct vers Fanta.
- Vérifier qu'une saisie reste sauvegardée après actualisation.
