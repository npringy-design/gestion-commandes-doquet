# Import Domafrais viande : articles multilignes

Les articles du bon Domafrais viande répartis sur deux lignes physiques (continuations commençant par un grammage séparé, par exemple `400 g LA CHAMPENOISE`) étaient pris pour de nouveaux articles par l'ancien parseur positionnel, qui est supprimé.

Ils sont désormais traités par la lecture par quadrillage d'image (`rasterTable.ts`, `cellReading.ts`, `columnMapping.ts`, `orderTemplateRasterScan.ts`) : une ligne du tableau est une bande de la grille, donc un libellé multiligne reste un seul produit.

Contrôle de non-régression : l'import de `Domafrais_viande_et_bof` doit donner 33 lignes, avec peu de lignes à contrôler.
