# Suppression du proxy Supabase Auth générique

Date : 18 juillet 2026  
Périmètre : lot 1, étape 1.1

## Décision

La route `/api/auth/supabase` a été supprimée.

Elle acceptait plusieurs méthodes HTTP et transmettait un chemin fourni par la requête vers `/auth/v1` de Supabase. Aucun appel à cette route n'existait dans `src/` ou dans les autres fonctions `api/`.

Conserver une liste blanche vide aurait laissé un point d'entrée inutile. La suppression réduit la surface exposée et garantit qu'un chemin Supabase Auth arbitraire ne peut plus être appelé par ce proxy.

## Parcours conservés

- connexion : client Supabase officiel, `signInWithPassword` ;
- mot de passe oublié : client Supabase officiel, `resetPasswordForEmail` ;
- échange du code de récupération : client Supabase officiel, `exchangeCodeForSession` ;
- mise à jour du mot de passe : client Supabase officiel, `updateUser` ;
- confirmation serveur du changement : route dédiée `/api/auth/complete-password-change`.

Le test `npm run test:auth-proxy-surface` vérifie que le proxy ne réapparaît pas, qu'aucun code applicatif ne l'appelle et que les parcours directs restent présents.

## Vérification TEST attendue

1. `/api/auth/supabase?target=/token` répond `404` ;
2. la connexion normale fonctionne ;
3. l'envoi d'un lien « mot de passe oublié » fonctionne ;
4. la route dédiée de confirmation de mot de passe reste protégée.

## Retour arrière

Le retour arrière consiste à restaurer uniquement `api/auth/supabase.ts` depuis le commit précédent. Il ne doit être envisagé que si un consommateur réel, absent du dépôt au moment de l'audit, est identifié. Dans ce cas, ses opérations exactes devront être recensées avant de créer une liste blanche minimale.
