# Correction du calendrier mobile

## Problème

Sur la page de commande mobile, le calendrier de livraison pouvait s'afficher derrière le contenu situé plus bas dans la page. Les jours devenaient alors difficiles ou impossibles à sélectionner.

Le calendrier avait déjà une priorité élevée, mais l'effet translucide du bandeau créait son propre contexte d'empilement. Le calendrier ne pouvait donc pas passer devant le tableau situé dans un autre contexte.

## Correction

Le bandeau de commande reçoit une priorité supérieure au tableau uniquement sur les écrans mobiles. À partir du format desktop, cette priorité revient à sa valeur normale.

Le composant calendrier, les dates sélectionnables, les calculs fournisseurs et les sauvegardes ne changent pas.

Le sélecteur mobile est aussi aligné sur le comportement desktop : lorsqu'une première livraison est exceptionnellement déplacée, la livraison suivante revient à la date prévue par le rythme habituel du fournisseur. Par exemple, déplacer la livraison du mercredi 22 au jeudi 23 ne décale pas automatiquement celle du mercredi 29 au jeudi 30.

## Contrôle

Le test `npm run test:mobile-calendar` vérifie :

- que le bandeau mobile reste au-dessus du tableau ;
- que le calendrier conserve sa priorité interne ;
- que la correction n'est pas imposée à la version desktop ;
- qu'une première livraison déplacée sur mobile ne force pas la suivante à `date choisie + 7 jours`.

## Validation TEST

1. Ouvrir une commande sur téléphone.
2. Appuyer sur la date de livraison.
3. Vérifier que le calendrier est entièrement visible au-dessus de la page.
4. Choisir une date et vérifier que le calendrier se ferme avec la nouvelle date affichée.
5. En mode marge, déplacer seulement la première livraison d'un jour et vérifier que la livraison suivante conserve le jour habituel du fournisseur.

Aucune modification Supabase ou SQL n'est nécessaire.
