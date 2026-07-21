# Modifications automatiques des trames de commande

## Règle métier

Une trame enregistrée est le paramétrage vivant des produits du fournisseur. Une modification d'article, d'unité de stockage ou d'unité de conditionnement sur une ligne déjà liée ne demande aucun bouton de validation.

Après une courte pause de saisie :

- la trame fournisseur est persistée ;
- le produit lié conserve le même identifiant ;
- l'unité de stockage est répercutée sur les pages qui affichent le produit ;
- le nombre extrait du conditionnement est répercuté dans la ligne de commande et ses calculs ;
- mappings manuels, historique de ventes, ratios, stocks et livraisons restent attachés au produit.

## Création et suppression

Une ligne sans produit lié n'est jamais créée silencieusement. Le bouton `Créer les produits` ou `Créer les nouveaux produits` reste nécessaire dans ce seul cas.

Retirer une ligne de la trame ne supprime pas automatiquement le produit ni son historique.

## Nouveau produit sur un mois figé

Lorsqu'une ligne de trame crée un nouveau produit alors que le mois de travail du fournisseur est figé :

- seul ce nouveau produit est automatiquement défigé sur ce mois ;
- il apparaît immédiatement dans `Calcul vente ratio` et peut être paramétré ;
- les autres produits et les autres fournisseurs restent figés ;
- il est inséré à sa place alphabétique dans la liste du fournisseur.

## Non-régression

`scripts/test-order-template-catalog.mjs` vérifie qu'une ligne liée produit une mise à jour automatique du produit et du colisage, qu'une ligne inchangée n'entraîne aucune écriture, qu'une ligne nouvelle n'est jamais créée sans action explicite et que les créations sont insérées alphabétiquement. `scripts/test-ratio-freeze-model.mjs` protège l'ouverture isolée d'un nouveau produit sur un mois figé.
