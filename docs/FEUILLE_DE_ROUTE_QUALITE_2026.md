# Feuille de route qualité — Gestion Commandes

Date de référence : 18 juillet 2026  
État de départ : audit corrigé à 7,5/10  
Objectif : obtenir une application interne robuste, maintenable, sécurisée et reproductible, sans réécriture totale ni modification involontaire des règles métier.

## 1. Règles de pilotage

Cette feuille de route constitue le périmètre fermé du chantier d'amélioration. Elle remplace les listes de recommandations mouvantes.

### Progression fixe

| Lot | Poids | Progression cumulée |
| --- | ---: | ---: |
| 0. Référence et garde-fous | 5 points | 5 % |
| 1. Sécurité applicative et dépendances | 15 points | 20 % |
| 2. Supabase et organisation des données | 15 points | 35 % |
| 3. Sauvegarde, hors-ligne et conflits | 15 points | 50 % |
| 4. Architecture et organisation du code | 20 points | 70 % |
| 5. Interface, performance et accessibilité | 15 points | 85 % |
| 6. Tests, CI et exploitation | 10 points | 95 % |
| 7. Certification finale | 5 points | 100 % |

Un lot ne compte dans l'avancement que lorsqu'il remplit entièrement sa définition de terminé. Un lot commencé mais non validé reste au pourcentage précédent.

### Règles immuables

1. La branche de travail officielle est `codex-setup-staging-workflow`.
2. Aucun changement n'arrive sur `main` avant vérification technique, déploiement TEST et validation.
3. `npm run verify` doit rester vert à chaque étape.
4. Les règles métier existantes ne sont pas modifiées pendant les lots purement techniques.
5. Toute migration Supabase est testée sur l'environnement TEST, sauvegardée et réversible avant la production.
6. Chaque lot possède un point de retour arrière identifié.
7. Une nouvelle idée non critique découverte pendant le chantier va dans un backlog séparé. Elle n'allonge pas cette feuille de route.
8. Une faille critique ou un risque de perte de données peut interrompre temporairement le lot en cours, avec justification écrite.

### Hors périmètre

- ajout de nouveaux modules métier ;
- refonte graphique complète de l'identité de l'application ;
- changement de React, Supabase ou Vercel ;
- modification des formules métier validées ;
- transformation en produit commercial public.

Ces sujets pourront faire l'objet d'une feuille de route distincte après la certification finale.

---

## Lot 0 — Référence et garde-fous — 5 points

### Objectif

Créer une référence incontestable avant les changements structurels et empêcher que le chantier devienne une suite de refactorings sans fin.

### Travaux

- enregistrer les métriques actuelles : build, poids des bundles, vulnérabilités, nombre de tests, principaux fichiers volumineux ;
- dresser la liste des parcours métier qui doivent rester identiques ;
- enregistrer des jeux de fichiers d'import représentatifs sans données sensibles ;
- compléter `AGENTS.md` avec le workflow TEST → validation → production ;
- créer un tableau de suivi unique avec statut `À faire`, `En cours`, `Validé TEST`, `Terminé production` ;
- définir les vérifications manuelles demandées à Nicolas uniquement lorsqu'elles sont réellement nécessaires ;
- confirmer que `main` et `codex-setup-staging-workflow` partent du même commit.

### Terminé lorsque

- la référence initiale est documentée ;
- les parcours sensibles disposent d'un test ou d'un scénario écrit ;
- la commande de vérification complète passe ;
- aucune question ne subsiste sur la branche de travail ou le calcul de l'avancement.

---

## Lot 1 — Sécurité applicative et dépendances — 15 points

### Objectif

Fermer les risques d'accès non autorisé, de consommation abusive des services et de traitement dangereux des fichiers importés.

### 1.1 API et authentification

- exiger une session Supabase valide sur `/api/ai-assistant` ;
- vérifier que le profil est actif et possède un rôle autorisé ;
- ajouter une limite de débit par utilisateur ;
- limiter la taille des requêtes et la durée des appels IA ;
- restreindre `/api/auth/supabase` à une liste explicite d'opérations réellement nécessaires ;
- empêcher le proxy d'appeler un chemin Supabase arbitraire ;
- uniformiser les réponses d'erreur sans exposer d'information interne.

### 1.2 Imports utilisateurs

- ajouter une limite de taille pour PDF, XLSX et CSV ;
- vérifier le type réel du fichier, pas seulement son extension ;
- gérer les erreurs, timeouts et fichiers corrompus sans figer la page ;
- isoler les traitements lourds dans un Worker lorsque nécessaire ;
- empêcher les formules dangereuses lors des exports CSV/Excel.

### 1.3 Dépendances et navigateur

- corriger Vite et toutes les dépendances pour lesquelles un correctif compatible existe ;
- retirer ou remplacer la version vulnérable de `xlsx`, ou isoler son usage avec une solution explicitement documentée ;
- supprimer les dépendances inutilisées ;
- ajouter des en-têtes de sécurité adaptés : CSP, anti-framing, referrer policy et permissions policy ;
- confirmer qu'aucun secret ne se retrouve dans le bundle frontend ou les logs.

### Terminé lorsque

- aucun endpoint coûteux n'est appelable anonymement ;
- les contrôles automatisés prouvent que les rôles interdits sont refusés ;
- aucun fichier trop lourd ou invalide ne peut bloquer silencieusement l'application ;
- aucune vulnérabilité élevée exploitable dans le contexte de l'application ne reste sans correction ou justification formelle ;
- le build et tous les imports existants restent fonctionnels.

---

## Lot 2 — Supabase et organisation des données — 15 points

### Objectif

Pouvoir reconstruire une base TEST propre depuis le dépôt, avec les mêmes tables, index, contraintes, publications Realtime et règles RLS que la production.

### 2.1 Migrations reproductibles

- créer un répertoire unique de migrations Supabase ordonnées ;
- établir une migration de référence correspondant au schéma réellement utilisé ;
- intégrer explicitement `sites`, `profiles`, `user_site_access`, `app_state`, `order_line_states` et les éventuelles tables de sauvegarde ;
- inclure les index, clés uniques, clés étrangères et publications Realtime ;
- retirer ou archiver clairement les scripts SQL contradictoires ;
- supprimer tout passage intermédiaire accordant des droits larges à `anon` ;
- documenter l'ordre d'installation et le retour arrière.

### 2.2 RLS et permissions

- tester chaque table pour chaque rôle ;
- confirmer l'isolation stricte par `site_id` ;
- tester les tentatives de lecture ou écriture sur un site non autorisé ;
- vérifier les opérations réalisées par les fonctions serveur ;
- centraliser le contrat des rôles et permissions afin d'éviter les listes frontend/backend divergentes.

### 2.3 Modèle de données

- conserver en JSON uniquement les petites configurations pour lesquelles ce choix est justifié ;
- sortir progressivement des blobs les données volumineuses, concurrentes ou historiques ;
- créer un schéma versionné pour les valeurs qui restent dans `app_state` ;
- valider et migrer les anciennes structures au chargement ;
- définir une politique de conservation et de suppression des imports et snapshots.

### Terminé lorsque

- une base TEST vide peut être recréée par les migrations ;
- l'application démarre et ses parcours principaux fonctionnent sur cette base ;
- les tests RLS couvrent les autorisations et refus attendus ;
- il n'existe plus deux scripts donnant des instructions incompatibles ;
- chaque donnée importante possède un propriétaire, une structure et une stratégie de migration documentés.

---

## Lot 3 — Sauvegarde, hors-ligne et conflits — 15 points

### Objectif

Garantir qu'une saisie confirmée visuellement n'est pas perdue et qu'un appareil ancien ne peut pas écraser silencieusement une donnée plus récente.

### 3.1 File de sauvegarde unique

- faire utiliser le même cycle de sauvegarde fiable aux commandes, paramètres sensibles et Taux de prise ;
- éliminer les anciennes fonctions de sauvegarde différée devenues inutiles ;
- conserver localement les opérations non confirmées ;
- afficher le nombre réel de modifications en attente ;
- proposer une nouvelle tentative explicite après un échec durable ;
- protéger la file contre les limites de quota du stockage navigateur.

### 3.2 Reconnexion

- conserver la saisie en mode avion ;
- renvoyer les écritures locales avant le rechargement cloud ;
- recréer proprement le canal Realtime au retour réseau ;
- vérifier le retour au premier plan sur téléphone ;
- éviter les doubles abonnements et doubles écritures ;
- harmoniser le comportement hors-ligne de toutes les pages qui permettent une saisie.

### 3.3 Conflits

- remplacer progressivement l'horodatage généré par l'appareil par une version ou un timestamp serveur ;
- rejeter explicitement une écriture basée sur une version trop ancienne ;
- prévoir un comportement clair lorsqu'une même ligne est modifiée sur deux appareils ;
- journaliser les conflits sans exposer de données sensibles ;
- tester un appareil dont l'heure est volontairement incorrecte.

### Terminé lorsque

- le scénario PC + téléphone + mode avion passe sur les commandes et le Taux de prise ;
- aucune page n'affiche « sauvegardé » avant confirmation réelle ;
- une fermeture puis réouverture conserve ou renvoie les écritures en attente ;
- un appareil avec une heure incorrecte ne peut pas dominer définitivement les autres ;
- les tests couvrent échec, reconnexion, arrière-plan et concurrence.

---

## Lot 4 — Architecture et organisation du code — 20 points

### Objectif

Obtenir une architecture par domaine métier, où chaque fichier possède une responsabilité claire et où les pages n'orchestrent pas toute l'application.

### 4.1 Organisation cible

Adopter progressivement une structure de ce type :

```text
src/
  app/            démarrage, routeur, providers et layout
  features/
    orders/
    suppliers/
    ratios/
    imports/
    preparation/
    take-rate/
    users/
  shared/         composants, types et utilitaires réellement partagés
  services/       Supabase, API et persistance
```

### 4.2 État applicatif

- transformer `useAppState` en façade légère ou le remplacer par des contrôleurs de domaines ;
- séparer commandes, fournisseurs, ratios, préparation, imports et navigation ;
- éviter qu'une modification d'un domaine provoque le rendu de toutes les pages ;
- utiliser des sélecteurs et mémorisations uniquement lorsqu'ils sont utiles et mesurés ;
- documenter quelles données sont locales, cloud, dérivées ou temporaires.

### 4.3 Pages et composants volumineux

- découper `DashboardApp`, `TakeRatePage`, `StatsPage`, `PrepRatiosPage`, `HomePage`, `SupplierOrderPage` et les pages de réglages ;
- séparer conteneur métier, sections visuelles, formulaires, tableaux et fenêtres ;
- déplacer les calculs purs hors des composants ;
- supprimer le code mort et les anciens chemins de sauvegarde ;
- interdire les nouveaux fichiers très volumineux sans justification.

### 4.4 Routage et contrats partagés

- faire d'`AppRouter` un véritable routeur et non un centre de styles et de permissions ;
- utiliser des URLs stables pour les pages principales ;
- centraliser les gardes de routes ;
- centraliser rôles, sites, permissions, identifiants de stockage et clés `app_state` ;
- typer les réponses des API et les données Supabase ;
- inclure le dossier `api` dans la vérification TypeScript.

### 4.5 Qualité TypeScript

- activer le mode strict progressivement par domaine ;
- supprimer les `any` évitables, en priorité aux frontières API/Supabase/imports ;
- ajouter ESLint et un formatage partagé ;
- empêcher les nouveaux `any`, imports circulaires et dépendances entre domaines non autorisées ;
- conserver les fonctions métier pures et directement testables.

### Terminé lorsque

- `useAppState` n'est plus le propriétaire de tous les domaines ;
- `AppRouter` ne contient plus le gros thème intégré ;
- les principales pages volumineuses sont composées de modules cohérents ;
- le frontend et les API passent ensemble le typecheck ;
- aucune ancienne fonction de persistance inutilisée ne subsiste ;
- les règles de dépendance entre domaines sont documentées et contrôlées ;
- tous les tests métier produisent exactement les mêmes résultats qu'avant le lot.

---

## Lot 5 — Interface, performance et accessibilité — 15 points

### Objectif

Rendre l'application plus rapide au premier chargement, plus homogène visuellement et réellement utilisable au clavier, sur téléphone et avec les outils d'accessibilité.

### 5.1 Système visuel

- compiler Tailwind au moment du build et supprimer le CDN navigateur ;
- créer des variables de thème sémantiques ;
- sortir le thème d'`AppRouter` ;
- unifier boutons, champs, cartes, tableaux, modales, alertes et états vides ;
- réduire les couleurs codées directement dans les pages ;
- conserver l'identité visuelle existante sans refonte métier.

### 5.2 Performance

- ne charger PDF.js, Tesseract, XLSX et les graphiques que lorsque leur fonctionnalité est ouverte ;
- déplacer les traitements PDF/OCR lourds hors du fil principal ;
- convertir et compresser les deux grands visuels d'accueil ;
- utiliser des images adaptées à la taille réelle de l'écran ;
- unifier le chargement des polices et supprimer les imports en double ;
- analyser les re-rendus des pages les plus utilisées ;
- ajouter un budget de poids contrôlé automatiquement au build.

### Cibles mesurables

- aucun Tailwind CDN en production ;
- visuel principal inférieur à 300 Ko lorsque la qualité reste acceptable ;
- JavaScript initial compressé inférieur à 320 Ko, ou écart explicitement justifié par une mesure ;
- aucune bibliothèque d'OCR ou d'import lourd dans le chargement initial ;
- aucune alerte de chunk ignorée uniquement par relèvement artificiel de la limite ;
- score Lighthouse mobile de référence amélioré et absence de régression mesurable.

### 5.3 Accessibilité et responsive

- assurer la navigation clavier et un focus visible ;
- vérifier labels, titres de tableaux, messages d'erreur et modales ;
- respecter les contrastes ;
- ne pas dépendre uniquement de la couleur pour les gains, pertes et alertes ;
- centraliser la détection mobile ;
- revoir les pages bloquées sur téléphone et documenter celles qui doivent réellement le rester ;
- supprimer le faux passage par PIN lorsqu'il ne constitue pas une autorisation réelle.

### Terminé lorsque

- les budgets de performance sont contrôlés ;
- l'accueil et les commandes sont vérifiés sur PC et téléphone ;
- les parcours principaux fonctionnent au clavier ;
- les modales possèdent un comportement de focus correct ;
- le thème n'utilise plus des sélecteurs fragiles basés sur des fragments de classes ;
- aucune régression visuelle ou métier n'est constatée sur TEST.

---

## Lot 6 — Tests, CI et exploitation — 10 points

### Objectif

Prouver automatiquement le fonctionnement réel de l'application et détecter rapidement une panne en production.

### 6.1 Tests

- conserver les tests métier actuels ;
- introduire un framework de tests standard pour les fonctions et composants ;
- ajouter des tests de composants sur les formulaires sensibles ;
- ajouter des parcours navigateur de bout en bout ;
- tester les API avec utilisateur autorisé, rôle interdit et utilisateur anonyme ;
- tester les migrations et policies RLS ;
- utiliser des fichiers d'import de référence avec résultats attendus ;
- éliminer progressivement les tests reposant uniquement sur des expressions régulières lorsque le comportement peut être exécuté réellement.

### Parcours E2E obligatoires

1. connexion et déconnexion ;
2. sélection et conservation du site actif ;
3. ouverture, saisie et rechargement d'une commande ;
4. perte puis retour réseau ;
5. modification concurrente depuis deux sessions ;
6. import CSV/XLSX/PDF valide et rejet d'un fichier invalide ;
7. import, liaison, figer puis recharger un mois de Taux de prise ;
8. refus d'accès selon le rôle ;
9. création/modification d'un utilisateur autorisé ;
10. navigation directe par URL et retour navigateur.

### 6.2 Intégration continue

- exécuter lint, format, TypeScript frontend/API, tests, build, contrôle des secrets et audit de dépendances ;
- annuler les anciens workflows lorsque plusieurs commits se succèdent ;
- rendre les contrôles obligatoires avant promotion sur `main` ;
- publier un résumé lisible des échecs ;
- contrôler la taille du build et les migrations.

### 6.3 Exploitation

- ajouter des logs serveur structurés avec identifiant de requête ;
- mettre en place une remontée des erreurs frontend et API ;
- ne jamais enregistrer de token, fichier importé ou donnée sensible dans les logs ;
- afficher la version déployée dans une zone d'information ;
- documenter la procédure d'incident, de rollback et de restauration ;
- tester réellement une restauration de sauvegarde ;
- prévoir un journal minimal des actions administratives et validations importantes.

### Terminé lorsque

- les dix parcours E2E passent sur TEST ;
- une PR ou promotion ne peut pas ignorer un contrôle rouge ;
- une erreur frontend ou API importante est détectable sans attendre un signalement utilisateur ;
- le commit déployé est identifiable ;
- le rollback et la restauration ont été testés au moins une fois.

---

## Lot 7 — Certification finale — 5 points

### Objectif

Fermer définitivement le chantier et fournir une preuve claire de l'état obtenu.

### Vérifications finales

- installation depuis un clone propre ;
- reconstruction d'une base TEST depuis les migrations ;
- exécution complète de la CI ;
- audit des dépendances et des secrets ;
- mesure finale des bundles et performances ;
- matrice des rôles et permissions ;
- tests PC, téléphone, mode avion et concurrence ;
- imports représentatifs ;
- vérification du déploiement TEST puis production ;
- vérification des documents d'architecture, données, sécurité, synchronisation, imports, déploiement et incident.

### Livrables finaux

- rapport avant/après avec métriques ;
- architecture actuelle représentée clairement ;
- inventaire des tables et migrations ;
- matrice rôles/permissions ;
- guide de déploiement et rollback ;
- guide d'exploitation ;
- liste séparée des améliorations futures non nécessaires à la qualité actuelle ;
- statut final de chaque lot à 100 %.

### Terminé lorsque

- la production correspond exactement au commit certifié ;
- tous les contrôles sont verts ;
- les parcours manuels critiques sont validés ;
- aucun problème critique ou élevé ne reste ouvert ;
- les éventuelles limites restantes sont documentées et classées non bloquantes ;
- la feuille de route est déclarée close, sans nouvelle étape ajoutée rétroactivement.

---

## 2. Résultat attendu

À 100 %, l'application doit présenter les caractéristiques suivantes :

- branche TEST et production maîtrisées ;
- base Supabase reproductible et sécurisée par défaut ;
- sauvegardes fiables sur tous les modules de saisie ;
- conflits multi-appareils contrôlés ;
- code organisé par domaine métier ;
- API et frontend entièrement typés ;
- interface cohérente, rapide et accessible ;
- parcours critiques testés dans un vrai navigateur ;
- erreurs détectables et restauration vérifiée ;
- documentation unique correspondant réellement au code.

L'objectif raisonnable après certification est une note technique comprise entre 8,5 et 9/10 pour une application interne. Les derniers points jusqu'à 10/10 relèveraient d'exigences de produit commercial à grande échelle et ne doivent pas servir à prolonger artificiellement ce chantier.

## 3. Ordre d'exécution

Les lots sont réalisés dans l'ordre. Les seuls chevauchements autorisés sont l'ajout des tests nécessaires avant un refactoring et la correction immédiate d'une faille critique.

Après chaque lot :

1. vérification automatisée ;
2. déploiement TEST ;
3. validation technique ;
4. test utilisateur uniquement si le comportement visible change ;
5. promotion sur `main` ;
6. mise à jour du tableau de progression ;
7. passage au lot suivant.

