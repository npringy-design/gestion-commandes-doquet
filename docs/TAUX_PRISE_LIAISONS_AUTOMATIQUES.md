# Sécurisation des liaisons automatiques du taux de prise

## Objectif

La décision qui relie automatiquement un produit de la base marge à une ligne de ventes est isolée dans un modèle pur et testé.
L'écran et le seuil historique de correspondance restent inchangés.

## Garanties

- une correspondance exacte reste toujours prioritaire ;
- les mots génériques comme `menu` ou `formule` ne bloquent pas une liaison sûre ;
- tous les mots métier du produit doivent être présents dans la ligne de ventes ;
- les variantes proches, notamment `10 pièces` et `20 pièces`, ne sont jamais fusionnées ;
- une liaison manuelle ou déjà existante n'est jamais remplacée automatiquement ;
- une ligne sans correspondance assez fiable reste marquée `À vérifier` ;
- le statut `OK` exige toujours un produit, une famille, une liaison et des ventes positives.

## Fichiers concernés

- `src/utils/takeRateMappingModel.ts`
- `src/pages/TakeRatePage.tsx`
- `scripts/test-take-rate-mapping.mjs`

## Éléments inchangés

- seuil de liaison automatique : `155` ;
- calculs de taux, marge et chiffre d'affaires ;
- mois figés et liaisons déjà enregistrées ;
- tables, clés et données Supabase ;
- interface utilisateur.

## Retour arrière

Le retour arrière consiste uniquement à replacer le score et le calcul de statut dans la page. Aucune restauration de données n'est nécessaire.
