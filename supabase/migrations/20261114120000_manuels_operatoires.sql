-- Manuels opératoires : fiches techniques et process, recherche plein texte.
--
-- Cloisonnement strict par site (clé de site = app_state.site_id) et droits :
--   - lecture : tout utilisateur actif ayant accès au site ;
--   - dépôt / remplacement / suppression : rôle manager_plus et au-dessus
--     (super_admin, global_admin, director, manager_plus), sur un site accessible.
--
-- Les helpers délèguent à can_access_app_state_site() existant, qu'il soit
-- encore dans public (TEST avant convergence) ou déjà dans private (baseline).

begin;

create extension if not exists unaccent with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers de droits
-- ---------------------------------------------------------------------------

create or replace function private.manuels_can_read_site(target_site_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if to_regprocedure('private.can_access_app_state_site(text)') is not null then
    return private.can_access_app_state_site(target_site_id);
  end if;
  return public.can_access_app_state_site(target_site_id);
end;
$$;

create or replace function private.manuels_can_manage_site(target_site_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.manuels_can_read_site(target_site_id) then
    return false;
  end if;
  return exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and p.role::text in ('super_admin', 'global_admin', 'director', 'manager_plus')
  );
end;
$$;

revoke all on function private.manuels_can_read_site(text) from public;
revoke all on function private.manuels_can_read_site(text) from anon;
grant execute on function private.manuels_can_read_site(text) to authenticated;
revoke all on function private.manuels_can_manage_site(text) from public;
revoke all on function private.manuels_can_manage_site(text) from anon;
grant execute on function private.manuels_can_manage_site(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.fiches_manuels (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  poste text not null,
  nom_fichier text not null,
  chemin_stockage text not null,
  nb_pages integer not null default 0,
  nb_fiches integer not null default 0,
  depose_par uuid references auth.users (id) on delete set null default auth.uid(),
  depose_le timestamptz not null default now(),
  constraint fiches_manuels_site_check check (
    site in ('hippo_thillois', 'hippo_st_thibault', 'au_bureau_montevrain')
  ),
  constraint fiches_manuels_site_poste_key unique (site, poste)
);

create table if not exists public.fiches_operatoires (
  id uuid primary key default gen_random_uuid(),
  manuel_id uuid not null references public.fiches_manuels (id) on delete cascade,
  site text not null,
  poste text not null,
  titre text not null,
  titre_normalise text not null,
  page integer not null,
  ordre integer not null default 0,
  -- [{ "type": ingredients|mise_en_place|a_la_commande|dressage|qualite|autre,
  --    "libelle": "...", "texte": "..." }]
  sections jsonb not null default '[]'::jsonb,
  -- Noms normalisés trouvés après le préfixe « SF » dans les ingrédients.
  sous_fiches text[] not null default '{}',
  search_vector tsvector,
  constraint fiches_operatoires_site_check check (
    site in ('hippo_thillois', 'hippo_st_thibault', 'au_bureau_montevrain')
  ),
  constraint fiches_operatoires_sections_check check (jsonb_typeof(sections) = 'array')
);

create index if not exists fiches_operatoires_manuel_idx on public.fiches_operatoires (manuel_id);
create index if not exists fiches_operatoires_site_titre_idx on public.fiches_operatoires (site, titre_normalise);
create index if not exists fiches_operatoires_search_idx on public.fiches_operatoires using gin (search_vector);

create table if not exists public.fiches_synonymes (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  mot text not null,
  type_section text not null,
  constraint fiches_synonymes_site_check check (
    site in ('hippo_thillois', 'hippo_st_thibault', 'au_bureau_montevrain')
  ),
  constraint fiches_synonymes_type_check check (
    type_section in ('ingredients', 'mise_en_place', 'a_la_commande', 'dressage', 'qualite', 'autre')
  ),
  -- Un mot peut viser plusieurs sections (cuisson : mise en place et à la commande).
  constraint fiches_synonymes_site_mot_type_key unique (site, mot, type_section)
);

-- ---------------------------------------------------------------------------
-- Vecteur de recherche (déclencheur : unaccent n'est pas immuable)
-- Poids A : titre ; B : ingrédients ; C : le reste.
-- ---------------------------------------------------------------------------

create or replace function private.fiches_operatoires_set_search_vector()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ingredients_text text;
  other_text text;
begin
  select
    coalesce(string_agg(case when s ->> 'type' = 'ingredients' then (s ->> 'libelle') || ' ' || (s ->> 'texte') end, ' '), ''),
    coalesce(string_agg(case when s ->> 'type' <> 'ingredients' then (s ->> 'libelle') || ' ' || (s ->> 'texte') end, ' '), '')
  into ingredients_text, other_text
  from jsonb_array_elements(new.sections) as s;

  new.search_vector :=
    setweight(to_tsvector('pg_catalog.french', extensions.unaccent('extensions.unaccent'::regdictionary, new.titre)), 'A')
    || setweight(to_tsvector('pg_catalog.french', extensions.unaccent('extensions.unaccent'::regdictionary, ingredients_text)), 'B')
    || setweight(to_tsvector('pg_catalog.french', extensions.unaccent('extensions.unaccent'::regdictionary, other_text)), 'C');
  return new;
end;
$$;

revoke all on function private.fiches_operatoires_set_search_vector() from public;
revoke all on function private.fiches_operatoires_set_search_vector() from anon;
revoke all on function private.fiches_operatoires_set_search_vector() from authenticated;

drop trigger if exists trg_fiches_operatoires_search_vector on public.fiches_operatoires;
create trigger trg_fiches_operatoires_search_vector
before insert or update of titre, sections on public.fiches_operatoires
for each row execute function private.fiches_operatoires_set_search_vector();

-- ---------------------------------------------------------------------------
-- Synonymes par défaut (mots normalisés : minuscules, sans accents)
-- ---------------------------------------------------------------------------

insert into public.fiches_synonymes (site, mot, type_section)
select s.site, v.mot, v.type_section
from (values ('hippo_thillois'), ('hippo_st_thibault'), ('au_bureau_montevrain')) as s(site)
cross join (values
  ('poids', 'ingredients'), ('grammage', 'ingredients'), ('quantite', 'ingredients'),
  ('combien', 'ingredients'), ('gramme', 'ingredients'),
  ('cuisson', 'mise_en_place'), ('temperature', 'mise_en_place'), ('temps', 'mise_en_place'),
  ('four', 'mise_en_place'), ('minutes', 'mise_en_place'),
  ('cuisson', 'a_la_commande'), ('temperature', 'a_la_commande'), ('temps', 'a_la_commande'),
  ('four', 'a_la_commande'), ('minutes', 'a_la_commande'),
  ('assiette', 'dressage'), ('vaisselle', 'dressage'), ('dressage', 'dressage'), ('presentation', 'dressage')
) as v(mot, type_section)
on conflict (site, mot, type_section) do nothing;

-- ---------------------------------------------------------------------------
-- RLS et privilèges
-- ---------------------------------------------------------------------------

alter table public.fiches_manuels enable row level security;
alter table public.fiches_manuels force row level security;
alter table public.fiches_operatoires enable row level security;
alter table public.fiches_operatoires force row level security;
alter table public.fiches_synonymes enable row level security;
alter table public.fiches_synonymes force row level security;

revoke all on table public.fiches_manuels from public;
revoke all on table public.fiches_manuels from anon;
revoke all on table public.fiches_operatoires from public;
revoke all on table public.fiches_operatoires from anon;
revoke all on table public.fiches_synonymes from public;
revoke all on table public.fiches_synonymes from anon;
grant select, insert, update, delete on table public.fiches_manuels to authenticated;
grant select, insert, update, delete on table public.fiches_operatoires to authenticated;
grant select, insert, update, delete on table public.fiches_synonymes to authenticated;
grant all privileges on table public.fiches_manuels to service_role;
grant all privileges on table public.fiches_operatoires to service_role;
grant all privileges on table public.fiches_synonymes to service_role;

do $$
declare
  t text;
begin
  foreach t in array array['fiches_manuels', 'fiches_operatoires', 'fiches_synonymes'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.manuels_can_read_site(site))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.manuels_can_manage_site(site))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.manuels_can_manage_site(site)) with check (private.manuels_can_manage_site(site))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.manuels_can_manage_site(site))', t || '_delete', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Stockage privé : manuels-operatoires/{site}/{poste}.pdf
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('manuels-operatoires', 'manuels-operatoires', false, 52428800, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists manuels_operatoires_select on storage.objects;
drop policy if exists manuels_operatoires_insert on storage.objects;
drop policy if exists manuels_operatoires_update on storage.objects;
drop policy if exists manuels_operatoires_delete on storage.objects;

create policy manuels_operatoires_select on storage.objects
  for select to authenticated
  using (bucket_id = 'manuels-operatoires' and private.manuels_can_read_site((storage.foldername(name))[1]));
create policy manuels_operatoires_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'manuels-operatoires' and private.manuels_can_manage_site((storage.foldername(name))[1]));
create policy manuels_operatoires_update on storage.objects
  for update to authenticated
  using (bucket_id = 'manuels-operatoires' and private.manuels_can_manage_site((storage.foldername(name))[1]))
  with check (bucket_id = 'manuels-operatoires' and private.manuels_can_manage_site((storage.foldername(name))[1]));
create policy manuels_operatoires_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'manuels-operatoires' and private.manuels_can_manage_site((storage.foldername(name))[1]));

commit;
