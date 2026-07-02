# Correctif auth production - 2026-07-02

## Contexte

La production affichait au moment de la connexion :

`Unexpected token '<', "<!DOCTYPE "... is not valid JSON`

Les logs Vercel production montraient des erreurs `522` sur la route interne :

`/api/auth/supabase`

La version test fonctionnait sans cette erreur.

## Correction appliquee

Le client Supabase production a ete aligne sur le comportement valide en test :

- suppression du routage auth client vers `/api/auth/supabase` ;
- retour a une connexion Supabase directe depuis `src/lib/supabaseClient.ts` ;
- aucune modification des pages metier ni des calculs de commande.

## Controle attendu apres deploiement

1. ouvrir la production ;
2. se connecter avec un utilisateur existant ;
3. verifier que le message `Unexpected token '<'` ne revient pas ;
4. verifier qu'une page metier charge normalement apres connexion.
