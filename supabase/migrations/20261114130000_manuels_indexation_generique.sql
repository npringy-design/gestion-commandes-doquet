-- Manuels opératoires, version générique : indexation en trois niveaux
-- (pages, fiches, rubriques), réglages par site, recherche plein texte.
--
-- Remplace les tables créées par 20261114120000_manuels_operatoires.sql, qui
-- n'a été appliquée que sur TEST et dont les tables sont vides : elles sont
-- recréées avec le nouveau modèle. Le bucket, les helpers de droits et les
-- politiques de stockage de la migration précédente sont conservés.

begin;

drop table if exists public.fiches_operatoires;
drop table if exists public.fiches_synonymes;
drop table if exists public.fiches_manuels;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.fiches_manuels (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  poste text not null,
  nom_fichier text not null,
  chemin_stockage text not null,
  nb_pages integer not null default 0,
  nb_fiches integer not null default 0,
  -- 1 = pages seules, 2 = fiches sans rubriques, 3 = fiches découpées en rubriques
  niveau_obtenu smallint not null default 1,
  depose_par uuid references auth.users (id) on delete set null default auth.uid(),
  depose_le timestamptz not null default now(),
  constraint fiches_manuels_site_check check (
    site in ('hippo_thillois', 'hippo_st_thibault', 'au_bureau_montevrain')
  ),
  constraint fiches_manuels_niveau_check check (niveau_obtenu in (1, 2, 3)),
  constraint fiches_manuels_site_poste_key unique (site, poste)
);

create table public.fiches_operatoires (
  id uuid primary key default gen_random_uuid(),
  manuel_id uuid not null references public.fiches_manuels (id) on delete cascade,
  site text not null,
  poste text not null,
  type text not null,
  titre text,
  titre_normalise text not null default '',
  page integer not null,
  ordre integer not null default 0,
  -- [{ "type_rubrique": ingredients|mise_en_place|a_la_commande|dressage|qualite|autre,
  --    "libelle": "...", "texte": "..." }] — au moins un bloc.
  sections jsonb not null default '[]'::jsonb,
  -- Noms normalisés de sous-fiches cités dans les ingrédients.
  sous_fiches text[] not null default '{}',
  search_vector tsvector,
  constraint fiches_operatoires_site_check check (
    site in ('hippo_thillois', 'hippo_st_thibault', 'au_bureau_montevrain')
  ),
  constraint fiches_operatoires_type_check check (type in ('page', 'fiche')),
  constraint fiches_operatoires_sections_check check (jsonb_typeof(sections) = 'array')
);

create index fiches_operatoires_manuel_idx on public.fiches_operatoires (manuel_id);
create index fiches_operatoires_site_titre_idx on public.fiches_operatoires (site, titre_normalise);
create index fiches_operatoires_search_idx on public.fiches_operatoires using gin (search_vector);

create table public.fiches_reglages (
  site text primary key,
  -- [{ "texte": "INGREDIENTS POUR", "type_rubrique": "ingredients" }]
  entetes jsonb not null default '[]'::jsonb,
  lignes_ignorees text[] not null default '{}',
  prefixe_sous_fiche text not null default '',
  updated_at timestamptz not null default now(),
  constraint fiches_reglages_site_check check (
    site in ('hippo_thillois', 'hippo_st_thibault', 'au_bureau_montevrain')
  ),
  constraint fiches_reglages_entetes_check check (jsonb_typeof(entetes) = 'array')
);

create table public.fiches_synonymes (
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
  -- Un mot peut viser plusieurs rubriques (cuisson : mise en place et à la commande).
  constraint fiches_synonymes_site_mot_type_key unique (site, mot, type_rubrique)
);

-- ---------------------------------------------------------------------------
-- Normalisation et vecteur de recherche
-- (déclencheur : unaccent n'est pas immuable)
-- Poids A : titre ; B : rubrique ingrédients ; C : le reste.
-- ---------------------------------------------------------------------------

create or replace function private.manuels_normaliser(valeur text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(valeur, '')));
$$;

revoke all on function private.manuels_normaliser(text) from public;
revoke all on function private.manuels_normaliser(text) from anon;
grant execute on function private.manuels_normaliser(text) to authenticated;

create or replace function private.fiches_operatoires_set_search_vector()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ingredients_text text;
  other_text text;
begin
  select
    coalesce(string_agg(case when s ->> 'type_rubrique' = 'ingredients' then (s ->> 'libelle') || ' ' || (s ->> 'texte') end, ' '), ''),
    coalesce(string_agg(case when s ->> 'type_rubrique' <> 'ingredients' then (s ->> 'libelle') || ' ' || (s ->> 'texte') end, ' '), '')
  into ingredients_text, other_text
  from jsonb_array_elements(new.sections) as s;

  new.search_vector :=
    setweight(to_tsvector('pg_catalog.french', private.manuels_normaliser(coalesce(new.titre, ''))), 'A')
    || setweight(to_tsvector('pg_catalog.french', private.manuels_normaliser(ingredients_text)), 'B')
    || setweight(to_tsvector('pg_catalog.french', private.manuels_normaliser(other_text)), 'C');
  return new;
end;
$$;

revoke all on function private.fiches_operatoires_set_search_vector() from public;
revoke all on function private.fiches_operatoires_set_search_vector() from anon;
revoke all on function private.fiches_operatoires_set_search_vector() from authenticated;

create trigger trg_fiches_operatoires_search_vector
before insert or update of titre, sections on public.fiches_operatoires
for each row execute function private.fiches_operatoires_set_search_vector();

-- ---------------------------------------------------------------------------
-- Valeurs par défaut
-- ---------------------------------------------------------------------------

-- Réglages : en-têtes Hippopotamus uniquement. Au Bureau démarre sans en-têtes.
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

-- Synonymes pour tous les sites (mots normalisés : minuscules, sans accents).
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

-- ---------------------------------------------------------------------------
-- RLS et privilèges
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['fiches_manuels', 'fiches_operatoires', 'fiches_reglages', 'fiches_synonymes'] loop
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

-- ---------------------------------------------------------------------------
-- Remplacement atomique (dépôt, remplacement, réindexation)
-- Security invoker : la RLS s'applique ; le contrôle de rôle est en plus
-- vérifié explicitement pour renvoyer une erreur claire.
-- p_lignes : [{ type, titre, titre_normalise, page, ordre, sections, sous_fiches }]
-- ---------------------------------------------------------------------------

create or replace function private.manuels_inserer_lignes(p_manuel uuid, p_site text, p_poste text, p_lignes jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.fiches_operatoires
    (manuel_id, site, poste, type, titre, titre_normalise, page, ordre, sections, sous_fiches)
  select
    p_manuel, p_site, p_poste,
    l ->> 'type',
    nullif(l ->> 'titre', ''),
    coalesce(l ->> 'titre_normalise', ''),
    (l ->> 'page')::integer,
    coalesce((l ->> 'ordre')::integer, 0),
    coalesce(l -> 'sections', '[]'::jsonb),
    coalesce(array(select jsonb_array_elements_text(coalesce(l -> 'sous_fiches', '[]'::jsonb))), '{}')
  from jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) as l;
$$;

revoke all on function private.manuels_inserer_lignes(uuid, text, text, jsonb) from public;
revoke all on function private.manuels_inserer_lignes(uuid, text, text, jsonb) from anon;
grant execute on function private.manuels_inserer_lignes(uuid, text, text, jsonb) to authenticated;

create or replace function public.remplacer_manuel(
  p_site text,
  p_poste text,
  p_nom_fichier text,
  p_chemin text,
  p_nb_pages integer,
  p_niveau integer,
  p_lignes jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_nb_fiches integer;
begin
  if not private.manuels_can_manage_site(p_site) then
    raise exception 'Droits insuffisants pour déposer un manuel sur ce site' using errcode = '42501';
  end if;

  select count(*) into v_nb_fiches
  from jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) as l
  where l ->> 'type' = 'fiche';

  insert into public.fiches_manuels (site, poste, nom_fichier, chemin_stockage, nb_pages, nb_fiches, niveau_obtenu)
  values (p_site, p_poste, p_nom_fichier, p_chemin, p_nb_pages, v_nb_fiches, p_niveau)
  on conflict (site, poste) do update
    set nom_fichier = excluded.nom_fichier,
        chemin_stockage = excluded.chemin_stockage,
        nb_pages = excluded.nb_pages,
        nb_fiches = excluded.nb_fiches,
        niveau_obtenu = excluded.niveau_obtenu,
        depose_par = auth.uid(),
        depose_le = now()
  returning id into v_id;

  delete from public.fiches_operatoires where manuel_id = v_id;
  perform private.manuels_inserer_lignes(v_id, p_site, p_poste, p_lignes);
  return v_id;
end;
$$;

create or replace function public.reindexer_manuel(p_manuel uuid, p_niveau integer, p_lignes jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_site text;
  v_poste text;
  v_nb_fiches integer;
begin
  select site, poste into v_site, v_poste from public.fiches_manuels where id = p_manuel;
  if v_site is null then
    raise exception 'Manuel introuvable' using errcode = 'P0002';
  end if;
  if not private.manuels_can_manage_site(v_site) then
    raise exception 'Droits insuffisants pour réindexer ce manuel' using errcode = '42501';
  end if;

  select count(*) into v_nb_fiches
  from jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) as l
  where l ->> 'type' = 'fiche';

  delete from public.fiches_operatoires where manuel_id = p_manuel;
  perform private.manuels_inserer_lignes(p_manuel, v_site, v_poste, p_lignes);
  update public.fiches_manuels set nb_fiches = v_nb_fiches, niveau_obtenu = p_niveau where id = p_manuel;
end;
$$;

revoke all on function public.remplacer_manuel(text, text, text, text, integer, integer, jsonb) from public;
revoke all on function public.remplacer_manuel(text, text, text, text, integer, integer, jsonb) from anon;
grant execute on function public.remplacer_manuel(text, text, text, text, integer, integer, jsonb) to authenticated;
revoke all on function public.reindexer_manuel(uuid, integer, jsonb) from public;
revoke all on function public.reindexer_manuel(uuid, integer, jsonb) from anon;
grant execute on function public.reindexer_manuel(uuid, integer, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Recherche
-- ---------------------------------------------------------------------------

create or replace function public.rechercher_fiches(p_site text, p_requete text)
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
  score real
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
    ts_rank_cd(o.search_vector, v_query)::real as score
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
