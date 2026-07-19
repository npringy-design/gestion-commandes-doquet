# Archives SQL Supabase

Ce répertoire conserve les scripts antérieurs à la baseline 2026 pour la
traçabilité. Ils ne doivent plus être exécutés pour installer ou mettre à jour
une base.

- `manual_sql/` contient les anciens scripts dispersés à la racine et dans
  `src/`, y compris leurs états intermédiaires contradictoires ;
- `site_bootstrap/` contient un bootstrap historique propre à un site ;
- `remote_history/` conserve les migrations retrouvées dans les historiques
  Supabase TEST et production.

La seule source de vérité exécutable est `supabase/migrations/`. Les retours
arrière contrôlés sont sous `supabase/rollbacks/`.
