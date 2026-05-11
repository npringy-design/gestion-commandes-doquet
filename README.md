# Gestion Commandes Doquet

Application multisite de gestion de commandes restaurant, utilisée pour Hippopotamus / Gestion Commandes Doquet.

Elle permet de gérer les commandes, les imports de fichiers, les ratios, le coût matière, le taux de prise et les données par site avec isolation via `site_id`.

## Stack technique

- React
- TypeScript
- Vite
- Supabase
- Vercel
- XLSX / CSV pour les imports de fichiers
- Recharts pour les graphiques

## Environnements

Le projet utilise deux environnements séparés :

- Production : projet Vercel `gestion-commandes-doquet`
- Test / staging : projet Vercel `gestion-commande-test`
- Supabase production : base réelle utilisée par les restaurants
- Supabase test : base dédiée aux tests et validations

Les deux environnements doivent rester séparés. Le projet test doit pointer vers Supabase test, et le projet production doit pointer vers Supabase production.

## Variables d'environnement principales

Variables attendues, sans vraie valeur dans le dépôt :

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SITE_ID=
VITE_APP_ENV=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```

Les variables `VITE_*` sont visibles côté navigateur.

`SUPABASE_SERVICE_ROLE_KEY` est réservée au serveur uniquement et ne doit jamais être exposée côté frontend.

## Multisite

Le multisite repose sur un identifiant stable par restaurant : `site_id`.

La table `app_state` est isolée par `site_id` + `key`, afin d'éviter qu'une sauvegarde d'un restaurant écrase les données d'un autre.

Exemples de `site_id` :

- `hippo_thillois`
- `hippo_st_thibault`

Une donnée d'un site ne doit jamais être sauvegardée sur un autre site.

## Workflow de développement

1. Travailler d'abord sur l'environnement test / staging.
2. Vérifier que Vercel test pointe bien vers Supabase test.
3. Tester les fonctionnalités concernées avec la checklist.
4. Lancer ou vérifier `npm run verify`.
5. Si la version test est validée explicitement, cela vaut feu vert pour le déploiement production.
6. La Pull Request n'est pas obligatoire si le dépôt autorise le push direct vers `main`.
7. Après déploiement production, vérifier rapidement l'application originale.

`main` correspond à la production. Aucune modification sensible ne doit partir en production sans validation préalable sur l'environnement test.

## Documentation

- [Déploiement](docs/DEPLOIEMENT.md)
- [Supabase](docs/SUPABASE.md)
- [Multisite](docs/MULTISITE.md)
- [Tests manuels](docs/TESTS_MANUELS.md)
