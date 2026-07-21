# Déplacement des cartes dans Calcul vente ratio

## Comportement

Les flèches haut/bas sont remplacées par un glisser-déposer direct des cartes.
Avec un rôle autorisé, l'utilisateur maintient le clic gauche sur une zone libre
d'une carte, la déplace sur la carte correspondant à la position souhaitée, puis
relâche le clic.

- les champs, cases et boutons restent cliquables et ne déclenchent pas un déplacement ;
- la carte et la position visée sont signalées visuellement pendant le geste ;
- le déplacement fonctionne dans la grille à une ou deux colonnes ;
- les produits masqués par un filtre et ceux des autres fournisseurs ne bougent pas ;
- l'ordre obtenu réutilise la sauvegarde automatique existante de la clé `products`.

## Persistance et périmètre

Aucune table, migration ou nouvelle clé Supabase n'est ajoutée. Le changement
porte uniquement sur l'interface et la manière de modifier l'ordre déjà
persisté. Les ratios, mois figés, mappings, historiques, unités et stocks ne
sont pas modifiés.

## Non-régression

`scripts/test-ratio-card-order.mjs` vérifie les déplacements vers le haut et le
bas, l'isolation des autres fournisseurs, la conservation des produits masqués
et le retrait des anciennes flèches.
