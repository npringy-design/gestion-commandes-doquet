-- Allergènes : tableau des allergènes par site et recherche par plat.
--
-- - allergenes_documents : un seul document par site (un nouveau dépôt remplace
--   l'ancien, sans historique) ; le PDF est dans le bucket des manuels
--   (manuels-operatoires), sous le dossier du site ;
-- - allergenes_plats : un plat par ligne du tableau, avec la liste des codes
--   d'allergènes signalés ;
-- - remplacer_allergenes : remplacement atomique (document + plats) ;
-- - rechercher_allergenes : recherche par nom de plat dans le site.
-- Même RLS que les manuels : lecture pour tous les rôles du site, écriture pour
-- « manager + » (private.manuels_can_read_site / manuels_can_manage_site).

begin;

create table public.allergenes_documents (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  nom_fichier text not null,
  chemin_stockage text not null,
  date_mise_a_jour date not null,
  -- false : la date de mise à jour n'a pas été trouvée dans le PDF (date de dépôt utilisée).
  date_trouvee boolean not null default true,
  nb_plats integer not null default 0,
  depose_par uuid references auth.users (id) on delete set null default auth.uid(),
  depose_le timestamptz not null default now(),
  constraint allergenes_documents_site_check check (
    site in ('hippo_thillois', 'hippo_st_thibault', 'au_bureau_montevrain')
  ),
  constraint allergenes_documents_site_key unique (site)
);

create table public.allergenes_plats (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.allergenes_documents (id) on delete cascade,
  site text not null,
  categorie text not null default '',
  nom text not null,
  nom_normalise text not null default '',
  -- Codes : gluten, crustaces, oeufs, poissons, arachides, soja, lait,
  -- fruits_a_coques, celeri, moutarde, sesame, sulfites, lupin, mollusques.
  allergenes text[] not null default '{}',
  page integer not null default 1,
  search_vector tsvector,
  constraint allergenes_plats_site_check check (
    site in ('hippo_thillois', 'hippo_st_thibault', 'au_bureau_montevrain')
  ),
  constraint allergenes_plats_codes_check check (
    allergenes <@ array['gluten', 'crustaces', 'oeufs', 'poissons', 'arachides', 'soja', 'lait',
                        'fruits_a_coques', 'celeri', 'moutarde', 'sesame', 'sulfites', 'lupin', 'mollusques']::text[]
  )
);

create index allergenes_plats_document_idx on public.allergenes_plats (document_id);
create index allergenes_plats_site_nom_idx on public.allergenes_plats (site, nom_normalise);
create index allergenes_plats_search_idx on public.allergenes_plats using gin (search_vector);

-- Vecteur de recherche sur le nom (français, sans accents, comme les fiches).
create or replace function private.allergenes_plats_set_search_vector()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.search_vector := to_tsvector('pg_catalog.french', private.manuels_normaliser(coalesce(new.nom, '')));
  return new;
end;
$$;

revoke all on function private.allergenes_plats_set_search_vector() from public;
revoke all on function private.allergenes_plats_set_search_vector() from anon;
revoke all on function private.allergenes_plats_set_search_vector() from authenticated;

create trigger trg_allergenes_plats_search_vector
before insert or update of nom on public.allergenes_plats
for each row execute function private.allergenes_plats_set_search_vector();

do $$
declare
  t text;
begin
  foreach t in array array['allergenes_documents', 'allergenes_plats'] loop
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

-- Remplacement atomique : l'ancien document du site et ses plats sont supprimés,
-- le nouveau est inséré, dans une seule transaction (security invoker : la RLS
-- s'applique ; le contrôle de rôle est aussi explicite pour une erreur claire).
-- p_plats : [{ categorie, nom, nom_normalise, allergenes: [codes], page }]
create or replace function public.remplacer_allergenes(
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

-- Recherche par nom de plat. p_termes : termes déjà nettoyés côté application
-- (sans synonymes ni mots vides). p_mode : 'tous' ou 'un' (au moins un terme,
-- classé par nombre de termes trouvés puis par score). Préfixes : « mayo »
-- trouve « mayonnaise ».
create or replace function public.rechercher_allergenes(p_site text, p_termes text[], p_mode text)
returns table (
  id uuid,
  nom text,
  categorie text,
  allergenes text[],
  page integer,
  document_id uuid,
  nom_fichier text,
  chemin_stockage text,
  date_mise_a_jour date,
  date_trouvee boolean,
  score real
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
    p.id, p.nom, p.categorie, p.allergenes, p.page, d.id, d.nom_fichier, d.chemin_stockage,
    d.date_mise_a_jour, d.date_trouvee,
    ts_rank_cd(p.search_vector, v_query)::real
  from public.allergenes_plats p
  join public.allergenes_documents d on d.id = p.document_id
  where p.site = p_site
    and p.search_vector @@ v_query
  order by
    (select count(*) from unnest(v_termes) as t
       where p.search_vector @@ to_tsquery('pg_catalog.french', t || ':*')) desc,
    ts_rank_cd(p.search_vector, v_query) desc,
    p.nom,
    p.page
  limit 10;
end;
$$;

revoke all on function public.rechercher_allergenes(text, text[], text) from public;
revoke all on function public.rechercher_allergenes(text, text[], text) from anon;
grant execute on function public.rechercher_allergenes(text, text[], text) to authenticated;

commit;
