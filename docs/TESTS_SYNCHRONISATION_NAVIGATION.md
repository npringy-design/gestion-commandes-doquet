# Tests automatisés — synchronisation et navigation commande

## Objectif

Ce lot protège les corrections validées en production le 14 juillet 2026 sans modifier les calculs métier, les données Supabase ou l'interface utilisateur.

Les nouveaux contrôles sont exécutés par `npm run verify` et par le workflow GitHub `.github/workflows/verify.yml` à chaque push et pull request.

## Synchronisation fiable

Le script `scripts/test-reliable-sync.mjs` vérifie :

- que le statut `Sauvegardé` ne repose plus sur un simple délai ;
- qu'une écriture confirmée par Supabase est retirée de la file locale ;
- qu'une écriture non confirmée est conservée dans la file locale ;
- que cette écriture est renvoyée puis retirée après le retour de la connexion ;
- qu'une ancienne valeur locale n'écrase pas une valeur serveur plus récente ;
- que deux modifications rapides d'un même produit sont regroupées sans perdre de champ ;
- que les files locales de test et de production utilisent des clés différentes.

Les appels Supabase sont simulés. Le test n'écrit donc aucune donnée dans les bases réelles.

## Navigation des champs commande

Le script `scripts/test-order-navigation.mjs` vérifie :

- un tableau de 150 produits et trois colonnes de saisie ;
- l'absence de doublons dans les `tabIndex` ;
- la progression verticale ligne par ligne ;
- le passage à la colonne suivante uniquement après la dernière ligne ;
- le comportement avec une colonne vide ou masquée ;
- la neutralisation des longueurs invalides.

Le calcul des index est isolé dans `src/utils/orderFieldNavigation.ts` et utilisé par `OrderFieldNavigationGuard`.

## Commandes disponibles

```text
npm run test:sync
npm run test:order-navigation
npm run verify
```

`npm run verify` exécute également les contrôles déjà existants : typecheck, calculs commande, dates fournisseurs, import marge, multisite, build Vite et recherche de secrets.

## Règle de déploiement

- développement et validation sur `codex-setup-staging-workflow` ;
- aucune promotion sur `main` avant validation explicite ;
- les tests automatisés complètent les essais terrain, mais ne remplacent pas le contrôle mobile réel.
