-- Manuels opératoires : zéro paramétrage.
--
-- Les réglages par site (en-têtes, lignes ignorées, préfixe de sous-fiche,
-- unités) et les synonymes deviennent des constantes du code
-- (src/utils/manualConstants.ts). Les tables fiches_reglages et
-- fiches_synonymes ne sont plus lues par aucun code : elles sont supprimées.
-- rechercher_fiches reçoit désormais les termes déjà nettoyés, les rubriques
-- visées et un mode de recherche :
--   'tous' = fiches contenant tous les termes ;
--   'un'   = fiches contenant au moins un terme, classées par nombre de termes
--            trouvés puis par score.
-- Les fiches et manuels existants sont conservés ; les fiches de version < 3
-- s'affichent « À réindexer » jusqu'à leur réindexation.

begin;

drop function if exists public.rechercher_fiches(text, text);

create function public.rechercher_fiches(p_site text, p_termes text[], p_cibles text[], p_mode text)
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
  v_termes text[];
  v_query tsquery;
begin
  if not private.manuels_can_read_site(p_site) then
    return;
  end if;

  -- Termes normalisés (sans accents, minuscules), alphanumériques uniquement.
  select coalesce(array_agg(distinct t), '{}') into v_termes
  from (
    select private.manuels_normaliser(x) as t from unnest(coalesce(p_termes, '{}')) as x
  ) as n
  where t ~ '^[a-z0-9]+$';

  if cardinality(v_termes) = 0 then
    return;
  end if;

  v_query := to_tsquery(
    'pg_catalog.french',
    (select string_agg(t || ':*', case when p_mode = 'un' then ' | ' else ' & ' end) from unnest(v_termes) as t)
  );

  return query
  select
    o.id, o.type, o.titre, o.poste, o.page, o.manuel_id, m.chemin_stockage,
    coalesce(p_cibles, '{}'),
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
  order by
    (select count(*) from unnest(v_termes) as t
       where o.search_vector @@ to_tsquery('pg_catalog.french', t || ':*')) desc,
    ts_rank_cd(o.search_vector, v_query) desc,
    o.titre nulls last,
    o.page
  limit 10;
end;
$$;

revoke all on function public.rechercher_fiches(text, text[], text[], text) from public;
revoke all on function public.rechercher_fiches(text, text[], text[], text) from anon;
grant execute on function public.rechercher_fiches(text, text[], text[], text) to authenticated;

-- Les lignes sans numéro de version explicite sont au format courant (3).
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
    coalesce((l ->> 'format_version')::smallint, 3)
  from jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) as l;
$$;

drop table if exists public.fiches_synonymes;
drop table if exists public.fiches_reglages;

commit;
