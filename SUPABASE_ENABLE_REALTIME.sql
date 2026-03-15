-- Active le temps réel sur la table app_state pour la synchro multi-utilisateur sans refresh.
-- À exécuter UNE FOIS dans l'éditeur SQL Supabase.

alter publication supabase_realtime add table public.app_state;

-- Vérification utile :
-- select * from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_state';
