# Persistance cloud du taux de prise

## Objectif

Les sauvegardes du taux de prise sont isolées de la page de paramétrage dans un hook dédié.

## Garanties

- les quatre clés cloud restent inchangées ;
- le délai historique reste fixé à 2,5 secondes ;
- le catalogue marge et son nom de fichier partagent toujours le même timestamp ;
- chaque sauvegarde relit le dernier timestamp cloud avant l'envoi ;
- seule une sauvegarde confirmée avance le curseur cloud ;
- l'absence de configuration Supabase ne déclenche aucune écriture.

## Fichiers concernés

- `src/hooks/useTakeRateCloudPersistence.ts`
- `src/utils/takeRateCloudPersistenceModel.ts`
- `src/pages/TakeRatePage.tsx`
- `scripts/test-take-rate-cloud-persistence.mjs`

## Éléments inchangés

- aucune table, colonne, clé ou politique Supabase ;
- aucune écriture SQL ;
- aucune donnée existante ;
- aucun calcul, écran ou interaction utilisateur.

## Retour arrière

Le retour arrière consiste uniquement à replacer la planification des quatre sauvegardes dans la page. Aucune restauration de données n'est nécessaire.
