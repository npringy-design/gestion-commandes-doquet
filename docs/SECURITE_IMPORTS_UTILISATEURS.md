# Sécurité des imports utilisateurs

Date : 18 juillet 2026  
Périmètre : lot 1, étape 1.2a

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

## Tests

`npm run test:import-file-validation` couvre les quatre formats acceptés, les fichiers vides, trop lourds, renommés, binaires ou incohérents, ainsi que la présence du contrôle avant chaque parseur.

## Retour arrière

Retirer les trois appels à `validateImportFile`, le module `src/utils/importFileValidation.ts` et son test restaure le comportement précédent. Aucune donnée ni migration ne doit être restaurée.
