-- Retour arrière de 20261117100000_allergenes.sql.
-- Supprime les fonctions, le déclencheur et les tables d'allergènes (les plats
-- sont supprimés avec le document). Les PDF déjà déposés dans le bucket
-- manuels-operatoires (dossier du site) ne sont pas supprimés par cette
-- migration : à retirer depuis le stockage si besoin. Le code de l'application
-- doit être revenu à la version précédente avant ce retour arrière.

begin;

drop function if exists public.rechercher_allergenes(text, text[], text);
drop function if exists public.remplacer_allergenes(text, text, text, date, boolean, jsonb);
drop table if exists public.allergenes_plats;
drop table if exists public.allergenes_documents;
drop function if exists private.allergenes_plats_set_search_vector();

commit;
