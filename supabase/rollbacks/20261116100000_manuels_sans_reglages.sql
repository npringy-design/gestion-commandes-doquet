-- Retour arrière de 20261116100000_manuels_sans_reglages.sql.
-- Recrée fiches_reglages (avec la colonne unites) et fiches_synonymes avec leurs
-- valeurs par défaut et leur RLS, puis restaure rechercher_fiches(text, text) de
-- 20261115100000. Les réglages personnalisés saisis avant la suppression ne
-- sont pas récupérables : seules les valeurs par défaut sont recréées.
-- Le code de l'application doit être revenu à la version précédente avant ce retour arrière.

begin;

drop function if exists public.rechercher_fiches(text, text[], text[], text);

create table if not exists public.fiches_reglages (
  site text primary key,
  entetes jsonb not null default '[]'::jsonb,
  lignes_ignorees text[] not null default '{}',
  prefixe_sous_fiche text not null default '',
  unites text[] not null
    default array['g', 'kg', 'l', 'cl', 'ml', 'unite', 'unites', 'piece', 'pieces', 'portion', 'tranche'],
  updated_at timestamptz not null default now(),
  constraint fiches_reglages_site_check check (
    site in ('hippo_thillois', 'hippo_st_thibault', 'au_bureau_montevrain')
  ),
  constraint fiches_reglages_entetes_check check (jsonb_typeof(entetes) = 'array')
);

create table if not exists public.fiches_synonymes (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  mot text not null,
  type_rubrique text not null,
  constraint fiches_synonymes_site_check check (
    site in ('hippo_thillois', 'hippo_st_thibault', 'au_bureau_montevrain')
  ),
  constraint fiches_synonymes_type_check check (
    type_rubrique in ('ingredients', 'mise_en_place', 'a_la_commande', 'dressage', 'qualite', 'autre')
  ),
  constraint fiches_synonymes_site_mot_type_key unique (site, mot, type_rubrique)
);

insert into public.fiches_reglages (site, entetes, lignes_ignorees, prefixe_sous_fiche)
values
  ('hippo_thillois',
   '[{"texte":"INGREDIENTS POUR","type_rubrique":"ingredients"},{"texte":"EN MISE EN PLACE","type_rubrique":"mise_en_place"},{"texte":"À LA COMMANDE","type_rubrique":"a_la_commande"},{"texte":"DRESSAGE","type_rubrique":"dressage"},{"texte":"QUALITÉ","type_rubrique":"qualite"}]'::jsonb,
   array['©copyright'], 'SF'),
  ('hippo_st_thibault',
   '[{"texte":"INGREDIENTS POUR","type_rubrique":"ingredients"},{"texte":"EN MISE EN PLACE","type_rubrique":"mise_en_place"},{"texte":"À LA COMMANDE","type_rubrique":"a_la_commande"},{"texte":"DRESSAGE","type_rubrique":"dressage"},{"texte":"QUALITÉ","type_rubrique":"qualite"}]'::jsonb,
   array['©copyright'], 'SF'),
  ('au_bureau_montevrain', '[]'::jsonb, '{}', '')
on conflict (site) do nothing;

insert into public.fiches_synonymes (site, mot, type_rubrique)
select s.site, v.mot, v.type_rubrique
from (values ('hippo_thillois'), ('hippo_st_thibault'), ('au_bureau_montevrain')) as s(site)
cross join (values
  ('poids', 'ingredients'), ('grammage', 'ingredients'), ('quantite', 'ingredients'),
  ('combien', 'ingredients'), ('gramme', 'ingredients'),
  ('cuisson', 'mise_en_place'), ('temperature', 'mise_en_place'), ('temps', 'mise_en_place'),
  ('four', 'mise_en_place'), ('minutes', 'mise_en_place'),
  ('cuisson', 'a_la_commande'), ('temperature', 'a_la_commande'), ('temps', 'a_la_commande'),
  ('four', 'a_la_commande'), ('minutes', 'a_la_commande'),
  ('assiette', 'dressage'), ('vaisselle', 'dressage'), ('dressage', 'dressage'), ('presentation', 'dressage')
) as v(mot, type_rubrique)
on conflict (site, mot, type_rubrique) do nothing;

do $$
declare
  t text;
begin
  foreach t in array array['fiches_reglages', 'fiches_synonymes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from public', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('grant all privileges on table public.%I to service_role', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.manuels_can_read_site(site))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.manuels_can_manage_site(site))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.manuels_can_manage_site(site)) with check (private.manuels_can_manage_site(site))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.manuels_can_manage_site(site))', t || '_delete', t);
  end loop;
end;
$$;

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
