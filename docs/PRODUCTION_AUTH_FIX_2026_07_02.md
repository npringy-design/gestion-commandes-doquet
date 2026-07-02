# Correctif auth production - 2026-07-02

## Contexte

La production a affiche deux erreurs successives sur la connexion :

- `Unexpected token '<'`
- `Failed to fetch`

La premiere venait du proxy auth qui renvoyait une page HTML au lieu d'une reponse JSON.
La seconde venait de la connexion Supabase directe indisponible depuis certains postes.

## Correction appliquee

Le client Supabase utilise maintenant une logique ciblee :

- tentative auth directe vers Supabase ;
- repli automatique vers `/api/auth/supabase` si la tentative directe echoue ;
- aucun changement sur les pages metier ou les calculs de commande.

## Controle attendu

1. ouvrir la production ;
2. faire Ctrl + F5 si besoin ;
3. se connecter avec un utilisateur existant ;
4. verifier que la page suivante charge normalement.
