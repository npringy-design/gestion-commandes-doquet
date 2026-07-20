# Correction de l'import Domafrais viande multiligne

## Anomalie reproduite

Le PDF Adoria Domafrais viande présente certains articles sur deux lignes physiques. Les continuations commençant par un grammage séparé, par exemple `400 g LA CHAMPENOISE` ou `300 G PUIGRENIER`, étaient interprétées comme de nouveaux articles parce que le premier nombre satisfaisait le format historique d'un code article.

Conséquences visibles après import :

- création de lignes parasites comme `g LA CHAMPENOISE` et `G PUIGRENIER` ;
- séparation du grammage et du fournisseur de l'article principal ;
- concaténation possible de l'unité répétée en `au Kg au Kg`.

## Correction ciblée

- un nombre suivi immédiatement d'une unité de quantité (`g`, `gr`, `kg`, `ml`, `cl` ou `l`) est désormais conservé comme début d'une continuation d'article ;
- les vrais codes articles numériques d'au moins trois chiffres restent acceptés ;
- une unité de stockage ou de conditionnement identique répétée sur plusieurs lignes physiques n'est conservée qu'une fois ;
- aucun calcul de commande, colissage, stock ou fournisseur n'est modifié.

## Non-régression

Le test `scripts/test-order-template-parser.mjs` reconstruit les sept lignes visibles du bon Domafrais viande, y compris les deux cas `400 g` et `300 G`. Il exige exactement sept articles, leurs libellés multilignes complets, une seule unité `au Kg` et les conditionnements attendus. Le test est intégré à `npm run verify`.

La correction doit être contrôlée sur TEST avec le PDF réel avant toute promotion sur `main`.
