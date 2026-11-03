# Robustesse de lecture des trames PDF

> L'ancienne lecture positionnelle (ancres de code, bandes verticales, fusion texte natif/OCR) est supprimée : elle est remplacée par la lecture par quadrillage d'image (`rasterTable.ts`, `cellReading.ts`, `columnMapping.ts`, `orderTemplateRasterScan.ts`).

## Objectif

La lecture ne dépend ni d'un fournisseur, ni d'un produit, ni des coordonnées d'un PDF particulier : les colonnes sont identifiées par leur sens (article, unité de stockage, conditionnement, code), proposées puis confirmées par l'utilisateur quand l'application hésite, et le choix est mémorisé par fournisseur.

Un PDF sans structure de colonnes identifiable ne peut pas être converti de façon déterministe en trame. L'application l'annonce et laisse le tableau éditable, sans jamais supprimer silencieusement un article.

## Deux voies, sans IA ni API externe

1. **PDF avec texte natif** (au moins 20 caractères) : orientation du texte, grille tracée dans le PDF ou colonnes détectées par les espaces (`pdfTableLayout.ts`), rôles de colonnes (`orderTemplateColumnRoles.ts`), extraction des lignes (`orderTemplateRowExtraction.ts`).
2. **PDF sans texte natif** (scanné, ou texte converti en tracés, comme les exports Adoria) : la page est remise à l'endroit (`ocrOrientation.ts`), les traits du quadrillage sont détectés sur l'image (`rasterTable.ts`), puis chaque cellule est lue séparément par Tesseract avec lectures multiples et vote (`cellOcr.ts`, `cellReading.ts`). Les colonnes des pages suivantes sont associées à celles de la page 1 par rang ou recouvrement (`columnMapping.ts`). La page 1 est lue avant la confirmation des colonnes, les autres pages après (`orderTemplateRasterScan.ts`). Sans quadrillage détecté, repli sur la lecture visuelle par colonnes avec confirmation obligatoire.

## Garanties

- Les valeurs sont recopiées telles quelles (espaces compactés). Seule transformation de texte : la réparation de mesures certaines après un nombre (« 700 mi » en « 700 ml »).
- Aucune unité n'est corrigée : une valeur douteuse (cellule vide, unité inattendue, lectures divergentes, symbole illisible) est surlignée avec sa raison.
- Un PDF scanné impose toujours la confirmation des colonnes.
- Aucune perte silencieuse : une page dont une colonne à rôle n'est pas reconnue est signalée dans le rapport.

## Non-régression

`scripts/test-pdf-table-layout.mjs`, `test-raster-table.mjs`, `test-cell-reading.mjs`, `test-cell-ocr.mjs` et `test-column-mapping.mjs` utilisent des jeux synthétiques génériques (grille, pivot à 90°, colonnes sans grille, en-tête répété, synonymes, vote entre lectures, largeurs de colonnes variables d'une page à l'autre). `scripts/test-import-processing.mjs` verrouille les délais, l'annulation et la libération des workers.

La validation finale porte sur des PDF réels de fournisseurs différents sur TEST. Aucun libellé de produit réel n'est utilisé par les règles du moteur.
