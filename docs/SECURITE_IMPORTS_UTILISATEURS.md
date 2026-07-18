# Sécurité des fichiers utilisateurs — imports et exports

Date : 18 juillet 2026  
Périmètre : lot 1, étapes 1.2a à 1.2c

## Inventaire confirmé

| Parcours | Formats | Traitement existant | Limite avant cette étape |
| --- | --- | --- | --- |
| Paramètres mensuels — inventaire et production | CSV, TXT, XLS, XLSX | PapaParse ou conversion XLSX vers CSV | Aucune |
| Taux de prise — fichier marge | XLS, XLSX | lecture synchrone avec `xlsx` après chargement mémoire | Aucune |
| Trame commande — bon de préparation | PDF | pdf.js, puis OCR Tesseract si le texte est insuffisant | Aucune |

Les trois traitements sont réalisés dans le navigateur. Aucun autre champ fichier ni appel programmatique d'import n'a été trouvé dans `src/` ou `api/`.

## Contrat ajouté avant parsing

| Format réel | Taille maximale | Vérification |
| --- | ---: | --- |
| CSV / TXT | 8 Mo | extension autorisée, absence d'octets nuls et de contenu binaire de contrôle |
| XLS | 15 Mo | signature binaire OLE historique |
| XLSX | 15 Mo | signature ZIP et présence des marqueurs internes Excel |
| PDF | 20 Mo | en-tête `%PDF-` dans les 1 024 premiers octets |

Le nom et le type MIME déclaratif du navigateur ne suffisent donc plus. Un fichier vide, trop lourd, renommé ou incohérent est refusé avant PapaParse, `xlsx`, pdf.js ou Tesseract.

## Éléments inchangés

- aucun calcul métier ou mapping ;
- aucune donnée Supabase ;
- aucun parser métier ;
- aucune dépendance ;
- aucun Worker ou timeout dans cette sous-étape.

Les Workers, les délais maximaux de traitement, les erreurs détaillées de fichiers réellement corrompus et le remplacement de `xlsx` seront traités dans les sous-étapes suivantes du lot 1.

## Robustesse des traitements — étape 1.2b

Une mesure locale reproductible sur 30 001 lignes montre qu'un XLSX de 5,6 Mo demande environ 1 seconde de lecture synchrone et porte la mémoire du processus autour de 190 Mo. Le CSV de 100 001 lignes et 1,7 Mo est parsé en environ 100 ms. Cette différence justifie l'isolation Excel sans imposer un second Worker personnalisé au CSV.

- XLS/XLSX mensuels et fichier marge : Worker Vite dédié, transfert de l'`ArrayBuffer`, arrêt après succès, erreur, timeout ou annulation ;
- CSV/TXT : Worker intégré de PapaParse ;
- lecture fichier : délai maximal de 15 secondes ;
- traitement Excel : délai maximal de 30 secondes ;
- ouverture PDF : délai maximal de 20 secondes ;
- extraction PDF et OCR : délai maximal global de 2 minutes ;
- PDF et Worker Tesseract détruits dans tous les chemins de sortie ;
- erreurs inattendues remplacées par des messages publics génériques.

Ces changements restent locaux au navigateur et ne déclenchent aucune écriture tant que le traitement n'a pas produit un résultat valide.

## Tests

`npm run test:import-file-validation` couvre les quatre formats acceptés, les fichiers vides, trop lourds, renommés, binaires ou incohérents, ainsi que la présence du contrôle avant chaque parseur.

`npm run test:import-processing` couvre succès, erreur, timeout et annulation du Worker, son arrêt systématique, le nettoyage de timeout, le masquage des erreurs internes et les contrats d'intégration PDF/CSV/Excel.

La validation utilise uniquement des fichiers générés en mémoire. Aucun import manuel n'est requis : cela évite toute modification des saisies ou paramètres présents dans Supabase TEST. Le déploiement du validateur ne lit, ne migre et ne réécrit aucune donnée existante.

## Exports CSV et Excel — étape 1.2c

L'inventaire du code confirme qu'aucune fonctionnalité de l'application ne génère actuellement de fichier CSV ou Excel. Les appels `sheet_to_csv` et `Papa.unparse` existants servent uniquement à normaliser des fichiers importés en mémoire ; aucun `Blob`, téléchargement CSV, classeur ou feuille de sortie n'est créé. Il n'existe donc pas aujourd'hui de cellule exportée provenant d'une saisie utilisateur.

Le garde-fou `spreadsheetExportSecurity.ts` prépare néanmoins le futur chemin sûr :

- les textes commençant par `=`, `+`, `-` ou `@`, y compris après des espaces, sont préfixés par une tabulation afin d'être interprétés comme du texte ;
- les retours ligne initiaux sont également neutralisés ;
- les nombres, booléens, textes ordinaires et données source restent inchangés ;
- le sérialiseur CSV protège chaque champ texte par des guillemets et échappe les guillemets internes ;
- un test d'architecture refuse l'ajout d'un writer CSV/XLSX direct hors du chemin central sécurisé.

Cette stratégie suit la [recommandation OWASP sur les injections CSV](https://owasp.org/www-community/attacks/CSV_Injection). Elle n'altère jamais les valeurs affichées ou stockées : la copie protégée n'est créée qu'au moment d'un futur export.

## Retour arrière

Retirer les trois appels à `validateImportFile`, le module `src/utils/importFileValidation.ts` et son test restaure le comportement précédent. Aucune donnée ni migration ne doit être restaurée.

Pour l'étape 1.2c, retirer `spreadsheetExportSecurity.ts`, son test et sa commande dans `package.json` supprime uniquement le garde-fou préventif. Aucun rollback de donnée, d'import ou de configuration Supabase n'est nécessaire.

## Bibliothèque XLS/XLSX — étape 1.3b

L'inventaire confirme que les deux imports tableur passent désormais par `spreadsheetImport.worker.ts`. Le Worker utilise `read`, `sheet_to_csv` et le parser de marge utilise `sheet_to_json`. L'ancien helper de lecture directe sur le thread principal, sans consommateur, a été retiré.

La version publique npm `xlsx@0.18.5` est remplacée par SheetJS CE `0.20.3`, installée depuis le [tarball officiel recommandé par SheetJS](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/). L'URL ne sert qu'à l'installation : Vite intègre le code dans le Worker et le navigateur ne charge aucun script externe à l'exécution. Le lockfile fixe aussi l'intégrité du paquet.

ExcelJS a été comparé comme alternative maintenue mais n'a pas été retenu : le remplacement aurait changé d'API et son périmètre public est XLSX, sans garantie équivalente pour les anciens fichiers XLS encore acceptés par l'application. Conserver l'API SheetJS évite une réécriture des parsers métier.

`npm run test:spreadsheet-library` couvre des octets réellement sérialisés puis relus : XLS, XLSX, sélection d'un onglet Produits non placé en premier, conversion CSV, archive corrompue et classeur de 10 000 lignes. Les résultats de marge attendus sont comparés champ par champ. Les fichiers sont exclusivement générés en mémoire et ne déclenchent aucune écriture Supabase.

Après migration, `npm audit` et `npm audit --omit=dev` ne rapportent plus aucune vulnérabilité. Le retour arrière consiste uniquement à restaurer la dépendance et son lockfile ; aucune donnée n'est concernée.
