# Avertissement en cas de perte de connexion

## Objectif

Informer immédiatement l'utilisateur lorsque l'appareil perd sa connexion Internet, sans supprimer ni bloquer le mécanisme de saisie hors ligne déjà sécurisé.

## Comportement

Lors d'une perte de connexion :

- un bandeau rouge apparaît en haut de l'application avec le message : `Connexion perdue — les données affichées peuvent ne plus être à jour.` ;
- une fenêtre de confirmation s'ouvre avec deux choix :
  - `Continuer` ferme la fenêtre et laisse l'utilisateur poursuivre sa saisie sur la page actuelle ;
  - `Quitter` ferme la fenêtre et ramène à la page d'accueil, sans déconnecter l'utilisateur.

Le bandeau reste visible tant que la connexion n'est pas revenue, même après le choix `Continuer` ou `Quitter`.

Au retour du réseau :

- le bandeau et la fenêtre disparaissent automatiquement ;
- la resynchronisation sécurisée déjà présente reste responsable du renvoi des saisies locales et du rechargement des données éventuellement manquées.

## Conservation des données

Cette modification ne contient :

- aucune migration SQL ;
- aucune modification de table Supabase ;
- aucun changement de `site_id` ;
- aucune suppression ou remise à zéro ;
- aucune modification des formules de commande ;
- aucun blocage des champs de saisie après le choix `Continuer`.

Le choix `Quitter` signifie uniquement « revenir à l'accueil ». Il ne ferme pas la session et ne supprime pas les modifications conservées dans la file de sauvegarde fiable.

## Fichiers

- `src/components/NetworkConnectionGuard.tsx` : écoute des événements navigateur `offline` et `online`, bandeau et fenêtre de choix ;
- `src/App.tsx` : montage global du garde de connexion et retour vers la vue `home` ;
- `scripts/test-network-connection-guard.mjs` : contrôle automatique du comportement et de l'absence de blocage des champs ;
- `package.json` : intégration du contrôle à `npm run verify`.

## Validation fonctionnelle sur TEST

1. Ouvrir une page de commande sur téléphone ou ordinateur.
2. Couper la connexion ou activer le mode avion.
3. Vérifier l'apparition immédiate du bandeau et de la fenêtre `Connexion perdue`.
4. Choisir `Continuer`, saisir quelques valeurs et vérifier que le bandeau reste visible.
5. Rétablir la connexion et confirmer la disparition du bandeau ainsi que la synchronisation des valeurs.
6. Refaire une coupure puis choisir `Quitter` et vérifier le retour à la page d'accueil sans déconnexion.
7. Rétablir la connexion et confirmer qu'aucune donnée n'a été effacée.

## Mise en production

La version a été validée fonctionnellement sur l'application TEST puis promue sur `main`. Ce paragraphe documentaire sert également à relancer le pipeline Vercel après une limite temporaire de fréquence de builds ; il ne modifie aucun comportement applicatif.
