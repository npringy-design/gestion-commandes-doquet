# Etat projet et pages

Ce document sert de memoire durable pour reprendre le projet sans devoir relire toute l'historique de conversation.

## Regle de reprise

Avant de modifier une page ou une logique metier :

1. lire `AGENTS.md` ;
2. lire `TEST_ENVIRONMENT_CHANGELOG.md` ;
3. lire ce fichier ;
4. lire la documentation metier concernee dans `docs/` ;
5. ne modifier que les fichiers necessaires.

## Workflow actuel valide

- Branche production : `main`.
- Branche test reelle : `codex-setup-staging-workflow`.
- Vercel production : `gestion-commandes-doquet`.
- Vercel test : `gestion-commande-test`.
- La branche test est celle utilisee par l'overview Vercel test.
- Toute correction applicative doit partir sur `codex-setup-staging-workflow`.
- Passage vers `main` uniquement apres validation utilisateur explicite.

## Architecture generale comprise

L'application gere plusieurs modules lies : commandes fournisseurs, imports, ratios de vente, ratios de production, feuille de mise en place, analyse cout matiere, taux de prise et multisite.

Les donnees partagees passent principalement par Supabase `app_state`, isolee par `site_id + key` pour eviter qu'un site ecrase les donnees d'un autre.

Le site existant a proteger en priorite est `hippo_thillois`.

## Securite multisite critique

Incident observe : un utilisateur Thillois a saisi ses stocks sur telephone, puis apres un chargement les pages de commandes Au Bureau sont apparues tout en gardant le theme Hippo. Le PC avait ete utilise avant par un utilisateur multisite ayant switche entre restaurants.

Cause racine : le site actif etait stocke avec une cle navigateur globale `hippo_active_site_id`. Sur un PC partage, un utilisateur pouvait heriter du dernier site choisi par un autre utilisateur.

Correctif durable en cours sur test :

- Le site actif reste synchronise dans `sessionStorage` pour que `CURRENT_SITE_ID` isole Supabase au chargement.
- Mais la preference durable est maintenant stockee par utilisateur : `hippo_active_site_id:user:<userId>`.
- Au chargement du profil, l'application ignore la vieille cle globale si elle ne correspond pas a la preference de l'utilisateur connecte.
- Si l'utilisateur n'a pas encore de preference, le premier site autorise de son profil est utilise.
- En cas de changement de compte, la cle globale est supprimee avant de recalculer le site actif.
- Si le site actif ne correspond pas au site attendu pour l'utilisateur, l'application ecrit le bon site puis recharge avant de rendre les pages metier.

Regle importante : ne jamais reutiliser directement une selection de site globale entre deux utilisateurs differents sur le meme navigateur.

Point de vigilance : ne jamais laisser `App` / `useAppState` charger les donnees metier si le site actif n'est pas autorise ou pas resynchronise pour l'utilisateur connecte.

## Pages et relations principales

### Accueil

Role : page d'entree et navigation vers les modules.

Points valides connus :

- L'accueil doit conserver son visuel existant sauf demande explicite.
- Le bandeau ou badge TEST doit etre visible uniquement sur l'environnement test.
- En test, le nom du site doit permettre d'eviter la confusion avec la production.

Relations :

- Redirige vers commandes, stats, ratios, cout matiere, taux de prise, mise en place et administration.
- Depend de l'environnement courant et du site actif.

### Commandes fournisseurs / Doquet

Role : gerer les commandes et les stocks fournisseurs.

Points valides connus :

- Les stocks et donnees de commande doivent persister apres refresh.
- Les sauvegardes doivent rester isolees par `site_id`.
- Realtime doit rester reserve aux commandes, pas a toute l'application.

Relations :

- Utilise les produits et parametres fournisseurs.
- Depend des previsions, stocks, colisages et jours de commande/livraison.
- Les modifications doivent etre verifiees avec Supabase `updated_at`.

### Parametres fournisseurs

Role : definir fournisseurs, jours de commande, jours de livraison, delais et contraintes.

Relations :

- Alimente les calculs de commande.
- Impacte la couverture de besoin jusqu'a livraison.

Point de vigilance :

- Ne pas casser les fournisseurs existants ni les fournisseurs archives.

### Calcul vente ratio

Role : lire les imports de ventes/inventaire, faire le mapping produits et calculer les ratios de vente par couvert.

Points valides connus :

- Le figer/defiger sert a conserver un snapshot du mois.
- Le figer/defiger sert aussi a conserver le nom et la liaison mapping du mois.
- Un mois fige ne doit pas etre recalcule inutilement a chaque ouverture.
- Ne pas melanger cette logique avec `Calcul prod ratio`.

Relations :

- Fournit les bases de vente utilisees ensuite pour les besoins, commandes et analyses.
- Depend des imports et des mappings produits.

Point de vigilance :

- Ne pas supprimer la selection du mois.
- Ne pas remplacer le mapping manuel par une logique automatique trop agressive.

### Calcul prod ratio

Role : gerer les ratios de production / mise en place.

Points valides connus :

- Page consideree comme verrouillee : visuel et mecanique a preserver.
- Ne modifier que sur demande explicite.
- Les validations de mois doivent rester separees de `Calcul vente ratio`.

Relations :

- Alimente la feuille de mise en place.
- Depend des imports production, bases, sous-bases, poids, unites et DLC.

Point de vigilance :

- Ne pas fusionner `validatedMonths` et `prepValidatedMonths`.
- Ne pas casser les bases/sous-bases.

### Feuille de mise en place

Role : transformer les ratios de production en besoins operationnels par jour/service.

Relations :

- Depend de `Calcul prod ratio`.
- Depend du previsionnel couvert et des DLC.

Point de vigilance :

- Les productions avec DLC secondaire doivent couvrir plusieurs services si necessaire.
- Les unites kg/pieces doivent rester coherentes.

### Analyse cout matiere

Role : exploiter les ecarts d'inventaire et identifier les pertes/gains.

Regles metier connues :

- Signe positif = perte.
- Signe negatif = gain.
- Les secteurs liquides/solides/exclus doivent etre respectes.

Relations :

- Depend de l'import export consolide / inventaire detaille.
- Peut partager certaines sources avec les commandes ou imports.

### Taux de prise / Product mix

Role : analyser les produits carte, familles, marges, volumes et taux de prise.

Regles connues :

- Le fichier marge est la source de verite pour les produits carte.
- Les imports de vente/production servent ensuite a rattacher les volumes.
- Les variantes ne doivent pas etre fusionnees sans logique claire.
- Les lignes fantomes doivent rester supprimables manuellement.

Relations :

- Page parametre/import marge : prepare les donnees.
- Page resultats : affiche KPI, top produits, filtres famille, recherche, tri et mode expert.

Point en cours :

- Continuer a affiner la liaison entre produits carte, familles et imports de ventes.
- Garder une structure dashboard simple, sans colonne laterale.
- Conserver le style orange/jaune valide sur la page resultats si deja present.

### Multisite / Utilisateurs

Role : isoler les restaurants et les droits utilisateurs.

Regles connues :

- `app_state` doit rester isole par `site_id + key`.
- `hippo_thillois` est la base existante a proteger.
- Les roles actuels sont : `super_admin`, `global_admin`, `director`, `manager_plus`, `manager`, `commande`.
- Les anciens roles `admin`, `manager`, `viewer` ne doivent pas etre repris pour les nouveaux projets.

Point de vigilance :

- Ne jamais ecraser les donnees d'un site en changeant de site.
- Tester les acces multi-site d'abord sur Supabase test.
- Bloquer le rendu metier si `activeSiteId` n'est pas autorise pour le profil courant.
- Le site actif ne doit jamais etre une preference globale partagee entre utilisateurs d'un meme navigateur.

## Ce qui est valide a ce stade

- Workflow test/prod separe.
- Branche test reelle : `codex-setup-staging-workflow`.
- Production : `main`.
- Documentation de deploiement corrigee pour ne plus faire croire que la branche `staging` est la reference.
- Regle de documentation continue ajoutee dans `AGENTS.md`.

## Ce qui reste a suivre

- Completer ce fichier a chaque validation fonctionnelle importante.
- Ajouter une documentation metier specifique dans `docs/` quand une page devient trop complexe.
- Garder les changements futurs cibles et reversibles.
- Ne pas considerer une page comme validee uniquement parce que le build passe : la validation utilisateur reste necessaire.
