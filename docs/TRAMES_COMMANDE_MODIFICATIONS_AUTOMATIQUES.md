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

## Non-régression

`scripts/test-order-template-catalog.mjs` vérifie qu'une ligne liée produit une mise à jour automatique du produit et du colisage, qu'une ligne inchangée n'entraîne aucune écriture et qu'une ligne nouvelle n'est jamais créée sans action explicite.
