# Robustesse de lecture des trames PDF

## Objectif

Le lecteur ne doit pas dépendre d'un fournisseur, d'un produit ou des coordonnées d'un PDF particulier. Le périmètre pris en charge est celui des bons de préparation structurés avec les colonnes `Code`, `Articles`, `Unité de stockage` et `Unité de conditionnement`, en texte natif ou en image OCR.

Un PDF arbitraire sans structure de colonnes identifiable ne peut pas être converti de façon déterministe en trame de commande. Dans ce cas, l'application doit annoncer l'incertitude et laisser le tableau éditable, jamais supprimer silencieusement des articles.

## Stratégie générale

1. La lecture native de pdf.js extrait les fragments avec leurs positions.
2. Chaque code article devient une ancre logique, même si le code, le libellé et les unités ne partagent pas la même baseline PDF.
3. Les fragments voisins sont regroupés dans des bandes verticales calculées à partir de l'espacement réel des codes. Il n'existe plus de seuil vertical fixe propre à une résolution.
4. Les colonnes détectées sur la première page restent applicables aux pages suivantes dépourvues d'en-tête répété.
5. Le moteur mesure le nombre de codes, de lignes restituées, de codes incomplets et de lignes suspectes.
6. Si la lecture native est incomplète ou dégradée, l'application lance automatiquement une lecture OCR puis fusionne les résultats par code article. Un libellé natif existant reste prioritaire ; l'OCR complète seulement une cellule ou un code absent.
7. Pour un PDF-image, Tesseract utilise explicitement la segmentation automatique de page (`PSM.AUTO`) afin d'identifier les blocs et colonnes avant la reconnaissance. Le mode « bloc unique » n'est pas utilisé pour une table complexe.
8. L'appartenance des mots aux lignes fournie par Tesseract est conservée. La proximité verticale, calculée depuis la hauteur réelle des glyphes, ne sert que de repli lorsque cette information n'existe pas.
9. Une unité de stockage vide peut être reconstruite à partir d'une quantité explicite dans l'article (`kg`, `g`, `L`, `cl`, `ml`). Une valeur non ambiguë comme `au Kg` ou `au L`, décalée dans le conditionnement, est replacée dans la colonne stockage.
10. Le bilan reste visible après l'import : mode choisi (`texte`, `OCR` ou `texte + OCR`), codes détectés, lignes restituées et éventuels contrôles manuels.

## Anomalies couvertes

- articles répartis sur deux ou plusieurs lignes physiques ;
- code, article, stockage et conditionnement alignés à des hauteurs différentes ;
- grammages en début de continuation (`250 g`, `300 G`, `400 g`) ;
- nombre et unité d'un même grammage placés sur deux baselines différentes ;
- unités fragmentées ou collées (`au` / `Kg`, `aul`, `aukg`) ;
- coordonnées OCR produites avec une échelle différente des coordonnées pdf.js ;
- pages suivantes sans répétition de l'en-tête ;
- texte natif incomplet, mal encodé ou fortement fragmenté ;
- OCR qui restitue moins de codes que la lecture native.
- OCR qui déforme un nom pourtant lisible dans le texte natif ;
- unité de stockage vide malgré un poids ou un volume explicite ;
- valeur `au Kg` ou `au L` décalée d'une colonne.
- PDF sans calque texte et contenu imprimé avec une rotation interne ;
- tirets et petites lettres dont la boîte OCR est verticalement décalée ;
- mots d'une même ligne distribués dans plusieurs blocs OCR.
- tableau dense que le mode OCR « bloc unique » mélangeait entre colonnes.

## Non-régression

`scripts/test-order-template-parser.mjs` utilise des produits synthétiques génériques pour couvrir les bandes verticales, le multipage, les différentes échelles, les unités, la fusion texte/OCR et la qualité de lecture. `scripts/test-import-processing.mjs` verrouille le repli OCR, la fusion des deux résultats, la conservation du maximum de codes détectés et l'avertissement visible.

La validation finale doit porter sur plusieurs PDF réels différents sur TEST. Aucun libellé de produit réel n'est utilisé par les règles du moteur.
