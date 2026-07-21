# Sauvegarde granulaire de Calcul vente ratio

## Problème traité

La page `Calcul vente ratio` persistait jusque-là toutes les fiches dans une
seule valeur `app_state.products`. Une modification minime, un mois figé ou un
déplacement de carte renvoyait donc le catalogue complet. Une écriture lente ou
concurrente pouvait échouer ou remplacer des changements sans rapport.

## Nouveau fonctionnement

La table `app_state` existante est conservée, sans migration SQL :

- `ratioProduct:<id>` contient uniquement la fiche du produit concerné ;
- `ratioProductOrder` contient uniquement l'ordre des identifiants ;
- une suppression écrit un marqueur ciblé sur la clé du produit ;
- le glisser-déposer ne réécrit que la petite liste d'ordre ;
- les champs opérationnels des commandes restent dans `order_line_states`.

Chaque clé conserve la file locale fiable, la confirmation Supabase et le
contrôle `last-write-wins` déjà utilisés par l'application. Deux produits
modifiés séparément disposent donc de sauvegardes et de délais indépendants.

## Compatibilité et retour arrière

L'ancien bloc `products` reste lu comme filet de migration mais n'est plus
réécrit par cette version. Une ligne granulaire remplace uniquement sa copie
historique. Les produits non encore modifiés continuent à venir de l'ancien
bloc, ce qui évite une migration massive au premier chargement.

En cas de retour à l'ancienne version, le bloc historique reste intact. Les
nouvelles lignes granulaires ne sont pas supprimées et redeviendront lisibles
au rétablissement de la nouvelle version.

## Non-régression

`scripts/test-ratio-product-granular-persistence.mjs` vérifie :

- la priorité d'une fiche granulaire sur sa copie historique ;
- l'ajout et l'ordre d'un nouveau produit ;
- la suppression sans résurrection depuis l'ancien bloc ;
- la récupération d'une fiche même si sa liste d'ordre manque temporairement ;
- la conservation d'identifiants contenant des caractères spéciaux ;
- l'absence de nouvelle sauvegarde globale de `products`.

Le changement est limité à `Calcul vente ratio`. Les autres blocs `app_state`
seront évalués et migrés séparément après validation sur TEST.
