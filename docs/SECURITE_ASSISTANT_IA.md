# Sécurité de l'assistant IA

## Objectif

Empêcher un appel anonyme de consommer les crédits OpenAI et borner l'usage de l'assistant par un utilisateur authentifié.

## Protections

- méthode `POST` uniquement ;
- taille déclarée de requête limitée à 32 000 octets ;
- jeton Supabase obligatoire dans l'en-tête `Authorization` ;
- validation serveur du jeton avec `supabaseAdmin.auth.getUser` ;
- profil `profiles` obligatoire et actif ;
- quota de 12 demandes par utilisateur et par fenêtre de 5 minutes ;
- réponse HTTP `429` avec `Retry-After` lorsque le quota est dépassé ;
- question limitée à 1 200 caractères et contexte limité à 12 000 caractères ;
- réponse OpenAI limitée à 700 tokens ;
- interruption de l'appel fournisseur après 30 secondes ;
- erreurs fournisseur masquées derrière un message générique.

Le frontend récupère la session Supabase active au moment de la demande et transmet son jeton. Une session absente ou expirée bloque l'appel avant l'envoi du contexte.

## Portée du quota

Le quota simple est conservé en mémoire dans chaque instance Vercel. Il protège immédiatement les instances chaudes et complète l'authentification, qui ferme le risque principal d'appel public anonyme.

Une limite strictement distribuée entre toutes les instances nécessitera un stockage partagé ou une règle de plateforme. Cette évolution sera décidée avec les migrations du lot Supabase, sans mélanger cette première fermeture de sécurité avec un changement de schéma.

## Tests

`scripts/test-ai-assistant-security.mjs` couvre réellement :

- absence de jeton ;
- jeton invalide ;
- profil introuvable ;
- profil inactif ;
- profil actif autorisé ;
- quota isolé par utilisateur ;
- dépassement de quota ;
- réouverture après la fenêtre ;
- lecture de la taille de requête ;
- présence du jeton frontend, du timeout et des appels de sécurité dans l'endpoint.

Le test est inclus dans `npm run verify`.

## Éléments inchangés

- aucune table, policy ou donnée Supabase ;
- aucune clé ou configuration OpenAI ;
- modèle `gpt-4.1-mini` et plafond de réponse inchangés ;
- contenu du prompt métier inchangé ;
- aucune permission ou formule métier modifiée.

## Retour arrière

Le retour arrière restaure uniquement `api/ai-assistant.ts`, `api/_lib/auth.ts`, `src/components/AiAssistantDrawer.tsx`, le module de quota et son test. Aucune restauration de données ou opération SQL n'est nécessaire.
