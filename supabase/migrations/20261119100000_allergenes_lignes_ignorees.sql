-- Allergènes : nombre de lignes de la première colonne ignorées à la lecture.
-- Le dépôt compte les lignes de texte du tableau qui ne sont devenues ni plat ni
-- catégorie ; le compteur est conservé avec le document et affiché dans
-- Paramètres. remplacer_allergenes reçoit ce compteur (valeur par défaut 0).

begin;

alter table public.allergenes_documents
  add column if not exists lignes_ignorees integer not null default 0;

drop function if exists public.remplacer_allergenes(text, text, text, date, boolean, jsonb);

create function public.remplacer_allergenes(
  p_site text,
  p_nom_fichier text,
  p_chemin text,
  p_date date,
  p_date_trouvee boolean,
  p_plats jsonb,
  p_lignes_ignorees integer default 0
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

  insert into public.allergenes_documents
    (site, nom_fichier, chemin_stockage, date_mise_a_jour, date_trouvee, nb_plats, lignes_ignorees)
  values (p_site, p_nom_fichier, p_chemin, p_date, coalesce(p_date_trouvee, true), v_nb, greatest(coalesce(p_lignes_ignorees, 0), 0))
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

revoke all on function public.remplacer_allergenes(text, text, text, date, boolean, jsonb, integer) from public;
revoke all on function public.remplacer_allergenes(text, text, text, date, boolean, jsonb, integer) from anon;
grant execute on function public.remplacer_allergenes(text, text, text, date, boolean, jsonb, integer) to authenticated;

commit;
