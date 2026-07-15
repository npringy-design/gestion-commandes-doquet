# Alertes d'anomalies sur les commandes

## Objectif

Les pages de commande affichent un petit triangle orange sur une ligne lorsqu'une donnée mérite une vérification.

Ces alertes sont uniquement informatives :

- elles ne bloquent pas la saisie ;
- elles ne changent aucune formule ;
- elles ne modifient pas la quantité calculée ;
- elles ne déclenchent aucune sauvegarde supplémentaire.

Un clic sur le triangle ouvre le détail des raisons détectées. Sur ordinateur, le survol affiche aussi un résumé natif.

## Alertes activées

### Conditionnement absent ou invalide

Déclenchée lorsque le conditionnement est vide, égal à zéro ou négatif.

Le calcul de commande retourne volontairement zéro colis lorsque le conditionnement n'est pas valide.

### Stock non saisi avec besoin prévu

Déclenchée lorsque :

- le ratio produit génère un besoin supérieur à zéro ;
- le champ stock est encore vide.

Une valeur explicitement saisie à `0` est considérée comme valide et retire l'alerte.

### Stock cible manquant

Déclenchée uniquement en mode Cible lorsque :

- un besoin est prévu ;
- le stock cible est vide.

Une cible explicitement saisie à `0` est acceptée.

### Valeur négative

Déclenchée pour une valeur négative dans :

- le stock ;
- la livraison à venir ;
- le stock cible.

### Produit potentiellement en doublon

Déclenchée lorsque deux lignes du même fournisseur ont le même nom après normalisation :

- casse ignorée ;
- accents ignorés ;
- ponctuation et espaces multiples ignorés.

Exemple : `Coca Cola` et `coca-cola` sont considérés comme équivalents.

### Stock anormalement élevé

Déclenchée lorsque le stock saisi est très supérieur au besoin de référence.

Le seuil retient la valeur la plus élevée entre :

- quatre fois le besoin ;
- le besoin augmenté de cinq colis ;
- huit colis complets.

En mode Cible, le besoin de référence tient également compte du stock cible.

### Livraison à venir anormalement élevée

Même logique que le stock anormalement élevé, après conversion du nombre de colis livrés en unités.

### Quantité proposée disproportionnée

Déclenchée uniquement lorsque :

- la proposition atteint au moins dix colis ;
- les unités proposées dépassent nettement le besoin de référence.

Le seuil retient la valeur la plus élevée entre :

- deux fois le besoin ;
- le besoin augmenté de huit colis.

Cette règle vise surtout les erreurs de conditionnement ou les zéros ajoutés accidentellement.

## Emplacement technique

- règles pures : `src/utils/orderAnomalies.ts` ;
- affichage et raccord aux lignes : `src/components/OrderAnomalyGuard.tsx` ;
- montage global : `src/App.tsx` ;
- tests : `scripts/test-order-anomalies.mjs`.

Le composant repère le tableau de commande avec la même approche que `OrderFieldNavigationGuard`, puis ajoute le triangle dans la première cellule de chaque ligne sans modifier le tableau métier existant.

## Contrôle automatique

Commande dédiée :

```text
npm run test:order-anomalies
```

Elle est incluse dans :

```text
npm run verify
```

Les tests couvrent les champs manquants, la distinction entre vide et zéro, les doublons, les valeurs négatives et les seuils de quantité inhabituelle.

## Validation fonctionnelle attendue

Sur l'application TEST :

1. ouvrir une page fournisseur ;
2. vérifier qu'un stock vide avec besoin prévu affiche un triangle ;
3. saisir `0` dans le stock et vérifier que cette raison disparaît ;
4. cliquer sur le triangle et vérifier la lisibilité de la fenêtre ;
5. confirmer que la saisie et le calcul continuent de fonctionner normalement.
