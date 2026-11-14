-- Retour arrière de 20261114130000_manuels_indexation_generique.sql.
-- Supprime les tables, fonctions et RPC du modèle générique (données des
-- manuels comprises). Pour retirer aussi le bucket, les politiques de stockage
-- et les helpers de droits, exécuter ensuite le retour arrière de
-- 20261114120000_manuels_operatoires.sql (après avoir supprimé les fichiers du
-- bucket via l'API Storage). Les PDF ne sont pas touchés par ce script.

begin;

drop function if exists public.rechercher_fiches(text, text);
drop function if exists public.reindexer_manuel(uuid, integer, jsonb);
drop function if exists public.remplacer_manuel(text, text, text, text, integer, integer, jsonb);
drop function if exists private.manuels_inserer_lignes(uuid, text, text, jsonb);

drop table if exists public.fiches_operatoires;
drop table if exists public.fiches_synonymes;
drop table if exists public.fiches_reglages;
drop table if exists public.fiches_manuels;

drop function if exists private.fiches_operatoires_set_search_vector();
drop function if exists private.manuels_normaliser(text);

commit;
