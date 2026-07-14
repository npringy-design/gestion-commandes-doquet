# Synchronisation et sauvegardes fiables

## Contexte du chantier

Le 14 juillet 2026, la branche de test `codex-setup-staging-workflow` a d'abord été replacée exactement sur le commit courant de `main` afin de repartir de la version production validée.

Les corrections décrites dans ce document ont ensuite été appliquées uniquement sur cette branche de test. `main` n'a pas été modifiée.

## Périmètre

Ce chantier concerne uniquement :

- la suppression d'une ancienne injection frontend de `GEMINI_API_KEY` inutilisée ;
- la confirmation réelle des sauvegardes Supabase ;
- l'affichage des états de sauvegarde ;
- la conservation locale temporaire des écritures non confirmées ;
- leur nouvelle tentative automatique au retour de la connexion.

Aucune table Supabase, aucune ligne métier et aucune donnée enregistrée par les restaurants ne sont modifiées ou migrées par ce chantier.

## États affichés

- `Sauvegarde en cours` : une modification attend son envoi ou la réponse de Supabase.
- `Sauvegardé` : Supabase a confirmé l'écriture.
- `Sauvegarde en attente` : Supabase n'a pas confirmé l'écriture ; la modification est conservée temporairement sur l'appareil.
- `Erreur de sauvegarde` : la modification ne peut pas être confirmée ni sécurisée localement. La page doit rester ouverte.

L'ancien délai qui affichait automatiquement `Sauvegardé` sans confirmation Supabase a été supprimé.

## File locale d'attente

Les écritures qui échouent sont conservées dans le navigateur puis renvoyées automatiquement :

- après le chargement de l'application ;
- au retour de la connexion Internet ;
- au retour sur l'onglet ;
- avant la mise en arrière-plan ou la fermeture lorsque le navigateur le permet.

La file est séparée par environnement et par site. Une écriture créée sur l'environnement de test ne doit jamais être rejouée sur la production.

Avant de rejouer une écriture, l'application compare son horodatage à celui du serveur. Si le serveur possède déjà une modification plus récente, la version serveur est conservée afin d'éviter un écrasement tardif.

## Vérifications manuelles obligatoires sur l'environnement test

### Sauvegarde normale

1. Modifier un stock ou une livraison à venir.
2. Vérifier l'affichage de `Sauvegarde en cours`.
3. Vérifier que `Sauvegardé` apparaît uniquement après la réponse Supabase.
4. Recharger la page et confirmer que la valeur est conservée.

### Coupure réseau

1. Ouvrir une commande fournisseur.
2. Couper la connexion réseau.
3. Modifier un stock.
4. Vérifier l'affichage de `Sauvegarde en attente` et du message explicatif.
5. Recharger la page sans réseau et vérifier que la modification reste dans la file locale.
6. Rétablir la connexion.
7. Vérifier que la modification est envoyée puis confirmée.
8. Recharger la page et contrôler la valeur dans Supabase test.

### Mise en arrière-plan mobile

1. Modifier une valeur sur téléphone.
2. Changer immédiatement d'application ou verrouiller l'écran.
3. Revenir dans l'application.
4. Vérifier que la modification est confirmée ou indiquée en attente, mais jamais faussement annoncée comme sauvegardée.

### Deux appareils

1. Ouvrir le même fournisseur sur deux appareils.
2. Modifier deux produits différents.
3. Vérifier que les deux modifications sont conservées.
4. Tester ensuite une modification du même produit sur les deux appareils.
5. Vérifier qu'une écriture ancienne conservée localement n'écrase pas une valeur serveur plus récente.

## Déploiement

- Branche test : `codex-setup-staging-workflow`.
- Projet Vercel test et Supabase test uniquement avant validation.
- Lancer `npm run verify` ou contrôler le workflow équivalent.
- Ne reporter ces corrections sur `main` qu'après validation explicite de la version test.
