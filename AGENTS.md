# Instructions des agents de code

Avant toute modification :

0. exécuter `git fetch origin` puis vérifier que la branche locale
   `codex-setup-staging-workflow` n'est **pas** en retard ou divergée
   par rapport à `origin/codex-setup-staging-workflow`. Si elle a divergé,
   s'arrêter et resynchroniser avant de commencer tout travail.
1. lire `TEST_ENVIRONMENT_CHANGELOG.md` ;
2. lire `docs/FEUILLE_DE_ROUTE_QUALITE_2026.md` ;
3. lire `docs/SUIVI_QUALITE_2026.md` ;
4. vérifier la branche et l'état du dépôt avec `git status` ;
5. ne travailler que sur la prochaine étape explicitement ouverte dans le suivi.

## Workflow obligatoire

- Branche de travail permanente : `codex-setup-staging-workflow`.
- Ne jamais modifier volontairement `main` avant validation de la version TEST.
- Ne pas créer une nouvelle branche sans nécessité documentée.
- Exécuter `npm run verify` avant chaque déploiement TEST et chaque promotion production.
- Une étape visible doit être validée sur TEST par l'utilisateur avant sa promotion sur `main`.
- Une étape purement technique peut être promue après preuves automatisées suffisantes, seulement si le suivi l'autorise explicitement.
- Documenter le commit TEST, les vérifications et le résultat avant de marquer une étape terminée.

## Protection du périmètre

- Ne pas modifier les formules métier pendant un lot technique.
- Ne pas mélanger migrations Supabase, dépendances, interface et refactoring dans un même changement.
- Toute migration Supabase doit être versionnée, testée sur Supabase TEST et accompagnée d'un retour arrière avant la production.
- Ne jamais exposer de secret ou utiliser la service role key dans le frontend.
- Préserver les données et changements existants qui ne concernent pas l'étape en cours.
- Toute nouvelle recommandation non critique va dans le backlog ; elle ne modifie pas le pourcentage de la feuille de route.
- Seuls une faille critique, un risque de perte de données ou une régression bloquante peuvent interrompre l'ordre prévu.

## Définition de terminé

Une étape n'est terminée que lorsque :

- son périmètre est entièrement réalisé ;
- les tests prévus passent ;
- `npm run verify` est vert ;
- la documentation et le suivi correspondent au code ;
- le déploiement prévu est confirmé ;
- la validation utilisateur est obtenue lorsqu'elle est requise.
