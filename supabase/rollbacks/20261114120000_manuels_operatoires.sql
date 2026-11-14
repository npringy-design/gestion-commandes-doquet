-- Retour arrière de 20261114120000_manuels_operatoires.sql.
-- Supprime les données des manuels (fiches, synonymes), les politiques, le
-- bucket et les helpers. Les fichiers PDF du bucket doivent être supprimés
-- avant : Supabase refuse de supprimer un bucket non vide (supprimer les
-- objets via l'API Storage, pas par SQL).
-- L'extension unaccent est conservée (inoffensive, possiblement utilisée ailleurs).

begin;

drop policy if exists manuels_operatoires_select on storage.objects;
drop policy if exists manuels_operatoires_insert on storage.objects;
drop policy if exists manuels_operatoires_update on storage.objects;
drop policy if exists manuels_operatoires_delete on storage.objects;
delete from storage.buckets where id = 'manuels-operatoires';

drop table if exists public.fiches_operatoires;
drop table if exists public.fiches_synonymes;
drop table if exists public.fiches_manuels;

drop function if exists private.fiches_operatoires_set_search_vector();
drop function if exists private.manuels_can_manage_site(text);
drop function if exists private.manuels_can_read_site(text);

commit;
