# Édition des lignes du taux de prise

## Objectif

Les opérations manuelles sur les lignes du taux de prise utilisent désormais un modèle unique et immuable.

## Opérations couvertes

- création d'une ligne vide ;
- modification d'un libellé, d'une famille ou d'une valeur de marge ;
- passage en source `manual` uniquement lorsqu'une valeur de marge est modifiée ;
- suppression d'une ligne ou d'une sélection ;
- ajout, validation multiple et retrait des liaisons de ventes ;
- déduplication des liaisons ;
- sélection individuelle ou de toutes les lignes visibles.

## Garanties

- la vue courante et la base sauvegardée utilisent les mêmes opérations ;
- aucun tableau ou objet source n'est modifié directement ;
- les setters React de la vue et de la base ne sont plus imbriqués ;
- les lignes hors filtre restent sélectionnées lors d'une sélection globale visible ;
- aucun calcul de taux, import ou snapshot n'est modifié.

## Éléments inchangés

- aucune table, clé ou donnée Supabase ;
- aucune écriture SQL ;
- aucun écran ou comportement visible.

## Retour arrière

Le retour arrière replace uniquement les opérations de tableau dans la page. Aucune restauration de données n'est nécessaire.
