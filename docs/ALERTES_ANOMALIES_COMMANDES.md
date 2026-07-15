# Alertes d'anomalies sur les commandes

## Objectif

Les pages de commande affichent un petit triangle orange sur une ligne lorsqu'une donnée mérite une vérification.

Ces alertes sont uniquement informatives :

- elles ne bloquent pas la saisie ;
- elles ne changent aucune formule ;
- elles ne modifient pas la quantité calculée ;
- elles ne déclenchent aucune sauvegarde supplémentaire.

Un clic sur le triangle ouvre le détail des raisons détectées. Sur ordinateur, le survol affiche aussi un résumé natif.

## Principe opérationnel

L'absence de stock pendant un inventaire normal ne doit pas créer d'alerte.

La personne peut ouvrir une page de commande, aller compter les produits en réserve puis saisir les valeurs progressivement. Un stock vide est donc un état normal de travail et non une anomalie.

Les alertes se concentrent sur :

- le paramétrage des articles ;
- les liaisons avec Calcul vente ratio ;
- les doublons ;
- les valeurs impossibles ;
- les saisies ou propositions manifestement disproportionnées.

## Alertes activées

### Conditionnement absent ou invalide

Déclenchée lorsque le conditionnement est vide, égal à zéro ou négatif.

Le message demande de vérifier le paramétrage de l'article.

### Produit non lié dans Calcul vente ratio

Cette alerte doit reproduire le statut réellement affiché dans la page Calcul vente ratio.

Ordre des sources de vérité :

1. si le mois contrôlé est figé, utiliser exclusivement le statut de liaison enregistré dans le snapshot de ce mois ;
2. si le mois n'est pas figé et qu'un fichier de travail est disponible, utiliser la liaison calculée depuis ce fichier ;
3. en l'absence de fichier courant exploitable, utiliser les snapshots historiques disponibles ;
4. sans aucune preuve exploitable, conserver un statut inconnu et ne pas afficher d'alerte accusatoire.

Un ancien fichier d'import encore stocké ne doit donc jamais transformer en « non lié » un produit vert sur un mois figé.

Lorsque le fichier d'un mois en cours de travail est disponible et que le produit n'est réellement pas reconnu, l'alerte reste affichée.

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

### Stock saisi anormalement élevé

Cette alerte cherche principalement une erreur de frappe ou d'unité.

Elle est déclenchée lorsque le stock saisi atteint au moins :

- quatre fois le besoin estimé, soit au minimum `+300 %` ;
- et un écart minimal de cinq unités ou d'un conditionnement complet.

Le second critère évite de signaler de petites différences normales liées au colisage.

Exemple initial :

- besoin estimé : `1` bouteille ;
- stock saisi : `10` bouteilles ;
- l'alerte est affichée.

Le message indique le stock, le besoin et le pourcentage d'écart calculé.

### Livraison à venir anormalement élevée

Même logique que le stock anormalement élevé, après conversion du nombre de colis livrés en unités.

Le message rappelle le nombre d'unités correspondant à la saisie.

### Quantité proposée disproportionnée

Déclenchée lorsque :

- la proposition atteint au moins cinq colis ;
- les unités proposées dépassent au moins deux fois le besoin ;
- ou dépassent le besoin de quatre conditionnements complets.

Cette règle vise une erreur de ratio, de conditionnement ou une donnée de stock incohérente ayant produit une proposition excessive.

## Alertes volontairement exclues

### Stock simplement vide

Aucune alerte n'est affichée parce que le stock n'est pas encore saisi.

Cet état correspond au déroulement normal d'un inventaire opérationnel.

## Correction du faux positif sur les mois figés

Le premier raccord de l'alerte « produit non lié » donnait la priorité au fichier d'import encore présent, même lorsque le mois avait déjà été figé.

Conséquence observée :

- tous les produits apparaissaient verts et liés dans Calcul vente ratio ;
- la page de commande affichait malgré tout un triangle « produit non lié ».

La correction donne maintenant la priorité au snapshot du mois figé. Le cas exact est couvert par un test automatique.

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

Les tests couvrent :

- l'absence d'alerte sur un stock vide ;
- un produit vert sur un mois figé malgré la présence d'un ancien fichier qui ne le retrouve plus ;
- la priorité inverse : un snapshot figé non lié ne doit pas être remplacé par un nouveau résultat ;
- les produits liés, non liés et non vérifiables sur un mois en cours ;
- le conditionnement manquant ;
- le stock cible manquant ;
- les doublons ;
- les valeurs négatives ;
- une saisie de `10` unités pour un besoin de `1` ;
- les propositions et livraisons disproportionnées.

## Validation fonctionnelle attendue

Sur l'application TEST :

1. ouvrir Calcul vente ratio sur un fournisseur dont le mois est figé et vérifier que les produits liés sont verts ;
2. ouvrir la page de commande du même fournisseur et vérifier que ces produits n'affichent plus l'alerte « non lié » ;
3. vérifier qu'un véritable produit non lié sur un mois non figé continue d'afficher l'alerte ;
4. saisir un stock très supérieur au besoin et vérifier que le triangle apparaît ;
5. confirmer que la saisie et le calcul continuent de fonctionner normalement.