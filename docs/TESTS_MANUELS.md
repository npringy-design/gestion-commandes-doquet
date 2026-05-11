# Tests manuels avant production

Checklist courte a faire sur staging avant passage en production :

- [ ] Connexion
- [ ] Accueil
- [ ] Commandes
- [ ] Doquet
- [ ] Parametres fournisseurs
- [ ] Imports
- [ ] Figer / defiger mois
- [ ] Calcul vente ratio
- [ ] Calcul prod ratio
- [ ] Taux de prise
- [ ] Changement de site
- [ ] Refresh navigateur
- [ ] Verification Supabase `updated_at`
- [ ] Verification que la production n'a pas bouge apres test staging

## Checklist par page critique

### Accueil

- [ ] Verifier chargement de la page
- [ ] Verifier le bon site affiche
- [ ] Verifier navigation vers les modules
- [ ] Verifier absence de badge TEST en production
- [ ] Verifier badge TEST en staging

### Commandes / Doquet

- [ ] Modifier un stock
- [ ] Verifier sauvegarde apres refresh
- [ ] Verifier calcul des quantites a commander
- [ ] Verifier fournisseurs
- [ ] Verifier dates de livraison
- [ ] Verifier que Supabase `updated_at` change sur la bonne base et le bon `site_id`

### Parametres fournisseurs

- [ ] Modifier un fournisseur
- [ ] Verifier sauvegarde apres refresh
- [ ] Verifier jours de commande/livraison
- [ ] Verifier fournisseur archive si concerne

### Calcul vente ratio

- [ ] Verifier import
- [ ] Verifier mapping produit
- [ ] Verifier mois fige/defige
- [ ] Verifier qu'un mois fige se recharge sans recalcul complet
- [ ] Verifier scroll horizontal

### Calcul prod ratio

- [ ] Verifier imports production
- [ ] Verifier base/sous-base
- [ ] Verifier poids kg/unite
- [ ] Verifier mois fige/defige
- [ ] Ne pas modifier la page si elle est verrouillee sauf demande explicite

### Taux de prise

- [ ] Verifier import marge
- [ ] Verifier base produits marge
- [ ] Verifier variantes non fusionnees
- [ ] Verifier liaison produit import
- [ ] Verifier snapshot apres refresh

### Multisite

- [ ] Verifier `site_id` actif
- [ ] Verifier changement de site si disponible
- [ ] Verifier qu'une modification sur un site ne modifie pas l'autre
- [ ] Verifier Supabase `app_state` avec `site_id + key`

### Imports

- [ ] Tester import Excel/CSV/PDF concerne
- [ ] Verifier colonnes attendues
- [ ] Verifier absence de doublons ou fusion incorrecte
- [ ] Verifier sauvegarde apres refresh
