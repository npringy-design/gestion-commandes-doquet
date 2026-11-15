-- Retour arrière de 20261119100000_allergenes_lignes_ignorees.sql.
-- Restaure remplacer_allergenes de 20261117100000 (sans compteur) et retire la
-- colonne lignes_ignorees. Le code de l'application doit être revenu à la
-- version précédente avant ce retour arrière.

begin;

drop function if exists public.remplacer_allergenes(text, text, text, date, boolean, jsonb, integer);

create function public.remplacer_allergenes(
  p_site text,
  p_nom_fichier text,
  p_chemin text,
  p_date date,
  p_date_trouvee boolean,
  p_plats jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_nb integer;
begin
  if not private.manuels_can_manage_site(p_site) then
    raise exception 'Droits insuffisants pour déposer les allergènes de ce site' using errcode = '42501';
  end if;

  select count(*) into v_nb from jsonb_array_elements(coalesce(p_plats, '[]'::jsonb));
  if v_nb = 0 then
    raise exception 'Aucun plat à enregistrer' using errcode = '22023';
  end if;

  delete from public.allergenes_documents where site = p_site;

  insert into public.allergenes_documents (site, nom_fichier, chemin_stockage, date_mise_a_jour, date_trouvee, nb_plats)
  values (p_site, p_nom_fichier, p_chemin, p_date, coalesce(p_date_trouvee, true), v_nb)
  returning id into v_id;

  insert into public.allergenes_plats (document_id, site, categorie, nom, nom_normalise, allergenes, page)
  select
    v_id, p_site,
    coalesce(l ->> 'categorie', ''),
    l ->> 'nom',
    coalesce(l ->> 'nom_normalise', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(l -> 'allergenes', '[]'::jsonb))), '{}'),
    coalesce((l ->> 'page')::integer, 1)
  from jsonb_array_elements(p_plats) as l;

  return v_id;
end;
$$;

revoke all on function public.remplacer_allergenes(text, text, text, date, boolean, jsonb) from public;
revoke all on function public.remplacer_allergenes(text, text, text, date, boolean, jsonb) from anon;
grant execute on function public.remplacer_allergenes(text, text, text, date, boolean, jsonb) to authenticated;

alter table public.allergenes_documents drop column if exists lignes_ignorees;

commit;
