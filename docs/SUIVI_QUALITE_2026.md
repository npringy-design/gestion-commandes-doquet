# Suivi qualité 2026

Dernière mise à jour : 18 juillet 2026  
Branche de référence : `codex-setup-staging-workflow`  
Commit initial : `918a7871991021e7e9c185e4c0f2828220c09413`

Ce document est le tableau d'avancement opérationnel de la feuille de route. Un lot commencé mais non entièrement validé ne modifie pas le pourcentage global.

## Avancement

| Lot | Poids | Statut | Preuve |
| --- | ---: | --- | --- |
| 0. Référence et garde-fous | 5 % | Terminé production | Validation utilisateur obtenue, promotion `main` autorisée |
| 1. Sécurité et dépendances | 15 % | En cours | Étape 1.1 : sécurisation de l'API IA |
| 2. Supabase et données | 15 % | À faire | — |
| 3. Sauvegarde, hors-ligne et conflits | 15 % | À faire | — |
| 4. Architecture et organisation | 20 % | À faire | — |
| 5. Interface, performance et accessibilité | 15 % | À faire | — |
| 6. Tests, CI et exploitation | 10 % | À faire | — |
| 7. Certification finale | 5 % | À faire | — |

**Progression terminée : 5 %.**

## Lot 0 terminé

- [x] confirmer la branche officielle et l'alignement initial avec `main` ;
- [x] enregistrer le commit de départ ;
- [x] enregistrer les métriques techniques initiales ;
- [x] lister les parcours métier à préserver ;
- [x] renforcer les instructions `AGENTS.md` ;
- [x] intégrer la feuille de route complète au dépôt ;
- [x] exécuter `npm run verify` depuis l'état documenté ;
- [x] vérifier que le déploiement TEST correspondant est prêt ;
- [x] promouvoir le lot documentaire sur `main` après validation utilisateur ;
- [x] clôturer le lot 0 et porter la progression fixe à 5 %.

Vérification locale du 18 juillet 2026 : `npm run verify` entièrement vert, build Vite réussi en 5,02 secondes. L'avertissement du chunk `vendor` supérieur à 650 Ko est conservé comme mesure initiale et sera traité au lot 5.

Publication TEST du 18 juillet 2026 : commits distants `defec495` puis `ee98a17`, builds Vercel `gestion-commande-test` et preview `gestion-commandes-doquet` réussis. Aucun comportement applicatif n'a été modifié. Validation utilisateur reçue pour la promotion documentaire sur `main`.

## Étape actuellement ouverte

### Lot 1 — Étape 1.1 : sécuriser `/api/ai-assistant`

- [ ] exiger une session Supabase valide ;
- [ ] refuser les sessions absentes ou invalides ;
- [ ] vérifier que le profil est actif ;
- [ ] appliquer une limite de débit simple par utilisateur ;
- [ ] conserver les limites de taille existantes et borner la durée de l'appel OpenAI ;
- [ ] ajouter des tests autorisé, anonyme, session invalide et limite dépassée ;
- [ ] intégrer les tests à `npm run verify` ;
- [ ] déployer et vérifier sur TEST ;
- [ ] documenter le retour arrière avant toute promotion production.

Cette étape reste isolée des migrations Supabase, de la mise à jour des dépendances et des changements visuels.

## Règle pour la prochaine étape

Tant que l'étape 1.1 n'est pas validée sur TEST, aucune autre action du lot sécurité ne doit commencer.

## Backlog hors pourcentage

Vide au démarrage. Toute idée future non critique est ajoutée ici sans modifier les lots ni l'avancement.
