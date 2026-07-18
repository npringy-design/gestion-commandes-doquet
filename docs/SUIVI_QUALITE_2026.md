# Suivi qualité 2026

Dernière mise à jour : 18 juillet 2026  
Branche de référence : `codex-setup-staging-workflow`  
Commit initial : `918a7871991021e7e9c185e4c0f2828220c09413`

Ce document est le tableau d'avancement opérationnel de la feuille de route. Un lot commencé mais non entièrement validé ne modifie pas le pourcentage global.

## Avancement

| Lot | Poids | Statut | Preuve |
| --- | ---: | --- | --- |
| 0. Référence et garde-fous | 5 % | En cours | Référence initiale en préparation |
| 1. Sécurité et dépendances | 15 % | À faire | — |
| 2. Supabase et données | 15 % | À faire | — |
| 3. Sauvegarde, hors-ligne et conflits | 15 % | À faire | — |
| 4. Architecture et organisation | 20 % | À faire | — |
| 5. Interface, performance et accessibilité | 15 % | À faire | — |
| 6. Tests, CI et exploitation | 10 % | À faire | — |
| 7. Certification finale | 5 % | À faire | — |

**Progression validée : 0 %.**

## Étape actuellement ouverte

### Lot 0 — Référence et garde-fous

- [x] confirmer la branche officielle et l'alignement initial avec `main` ;
- [x] enregistrer le commit de départ ;
- [x] enregistrer les métriques techniques initiales ;
- [x] lister les parcours métier à préserver ;
- [x] renforcer les instructions `AGENTS.md` ;
- [x] intégrer la feuille de route complète au dépôt ;
- [x] exécuter `npm run verify` depuis l'état documenté ;
- [ ] vérifier que le déploiement TEST correspondant est prêt ;
- [ ] enregistrer le commit et clôturer le lot 0.

Vérification locale du 18 juillet 2026 : `npm run verify` entièrement vert, build Vite réussi en 5,02 secondes. L'avertissement du chunk `vendor` supérieur à 650 Ko est conservé comme mesure initiale et sera traité au lot 5.

## Règle pour la prochaine étape

Après clôture du lot 0, la seule étape autorisée est la sécurisation de `/api/ai-assistant`. Elle doit rester isolée des migrations Supabase, de la mise à jour des dépendances et des changements visuels.

## Backlog hors pourcentage

Vide au démarrage. Toute idée future non critique est ajoutée ici sans modifier les lots ni l'avancement.
