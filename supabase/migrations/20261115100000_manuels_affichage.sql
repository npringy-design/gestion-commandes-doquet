-- Manuels opératoires : affichage structuré et découpage plus fin.
--
-- - fiches_reglages.unites : unités reconnues dans les lignes d'ingrédients
--   (par site, modifiable) ;
-- - fiches_operatoires.format_version : 1 = ancien format (extrait seul),
--   2 = lignes typées dans chaque rubrique. Les fiches existantes restent en
--   version 1 jusqu'à leur réindexation ;
-- - rechercher_fiches renvoie aussi format_version.
-- Les données existantes sont conservées.

begin;

alter table public.fiches_reglages
  add column if not exists unites text[] not null
  default array['g', 'kg', 'l', 'cl', 'ml', 'unite', 'unites', 'piece', 'pieces', 'portion', 'tranche'];

alter table public.fiches_operatoires
  add column if not exists format_version smallint not null default 1;

create or replace function private.manuels_inserer_lignes(p_manuel uuid, p_site text, p_poste text, p_lignes jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.fiches_operatoires
    (manuel_id, site, poste, type, titre, titre_normalise, page, ordre, sections, sous_fiches, format_version)
  select
    p_manuel, p_site, p_poste,
    l ->> 'type',
    nullif(l ->> 'titre', ''),
    coalesce(l ->> 'titre_normalise', ''),
    (l ->> 'page')::integer,
    coalesce((l ->> 'ordre')::integer, 0),
    coalesce(l -> 'sections', '[]'::jsonb),
    coalesce(array(select jsonb_array_elements_text(coalesce(l -> 'sous_fiches', '[]'::jsonb))), '{}'),
    coalesce((l ->> 'format_version')::smallint, 2)
  from jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) as l;
$$;

drop function if exists public.rechercher_fiches(text, text);

create function public.rechercher_fiches(p_site text, p_requete text)
returns table (
  id uuid,
  type text,
  titre text,
  poste text,
  page integer,
  manuel_id uuid,
  chemin_stockage text,
  rubriques_ciblees text[],
  sections jsonb,
  sous_fiches text[],
  extrait text,
  score real,
  format_version smallint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_jetons text[];
  v_cibles text[];
  v_restants text[];
  v_query tsquery;
begin
  if not private.manuels_can_read_site(p_site) then
    return;
  end if;

  select coalesce(array_agg(t), '{}') into v_jetons
  from regexp_split_to_table(private.manuels_normaliser(p_requete), '[^a-z0-9]+') as t
  where t <> '';

  select coalesce(array_agg(distinct s.type_rubrique), '{}') into v_cibles
  from public.fiches_synonymes s
  where s.site = p_site and s.mot = any (v_jetons);

  select coalesce(array_agg(t), '{}') into v_restants
  from unnest(v_jetons) as t
  where not exists (select 1 from public.fiches_synonymes s where s.site = p_site and s.mot = t);

  if cardinality(v_restants) = 0 then
    return;
  end if;

  v_query := to_tsquery('pg_catalog.french', (select string_agg(t || ':*', ' & ') from unnest(v_restants) as t));

  return query
  select
    o.id, o.type, o.titre, o.poste, o.page, o.manuel_id, m.chemin_stockage,
    v_cibles,
    o.sections, o.sous_fiches,
    ts_headline(
      'pg_catalog.french',
      coalesce(o.titre || ' — ', '') || (
        select string_agg(coalesce(nullif(x ->> 'libelle', '') || ' : ', '') || (x ->> 'texte'), ' | ')
        from jsonb_array_elements(o.sections) as x
      ),
      v_query,
      'StartSel=⟦, StopSel=⟧, MaxWords=40, MinWords=15, MaxFragments=2, FragmentDelimiter=" … "'
    ) as extrait,
    ts_rank_cd(o.search_vector, v_query)::real as score,
    o.format_version
  from public.fiches_operatoires o
  join public.fiches_manuels m on m.id = o.manuel_id
  where o.site = p_site
    and o.search_vector @@ v_query
    and (o.type = 'fiche' or m.niveau_obtenu = 1)
  order by ts_rank_cd(o.search_vector, v_query) desc, o.titre nulls last, o.page
  limit 10;
end;
$$;

revoke all on function public.rechercher_fiches(text, text) from public;
revoke all on function public.rechercher_fiches(text, text) from anon;
grant execute on function public.rechercher_fiches(text, text) to authenticated;

commit;
