-- =============================================================
-- SUPABASE_SETUP.sql
-- Durcissement multi-site Hippo Commandes
--
-- Objectifs :
-- 1) Isoler toute la persistance cloud par site_id
-- 2) Activer une vraie RLS par sites autorisés
-- 3) Préparer les sauvegardes manuelles / automatiques par site
--
-- IMPORTANT : exécuter ce script AVANT de déployer la version front
-- qui utilise app_state(site_id, key).
-- =============================================================

begin;

-- -------------------------------------------------------------
-- 0) Pré-requis utiles
-- -------------------------------------------------------------
create extension if not exists pgcrypto;

-- -------------------------------------------------------------
-- 1) Table app_state durcie pour le multi-site
-- -------------------------------------------------------------
create table if not exists app_state (
  site_id    uuid        not null references sites(id) on delete cascade,
  key        text        not null,
  value      jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (site_id, key)
);

-- Cas d'une ancienne table legacy : ajouter site_id si manquant.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'app_state'
      and column_name = 'key'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'app_state'
      and column_name = 'site_id'
  ) then
    alter table public.app_state add column site_id uuid references public.sites(id) on delete cascade;
  end if;
exception when duplicate_column then
  null;
end $$;

-- Migration des éventuelles données legacy vers Hippo Thillois.
do $$
declare
  thillois_site uuid;
begin
  select id into thillois_site
  from public.sites
  where lower(name) = lower('Hippo Thillois')
  limit 1;

  if thillois_site is not null then
    update public.app_state
    set site_id = thillois_site
    where site_id is null;
  end if;
end $$;

alter table public.app_state
  alter column site_id set not null;

create unique index if not exists app_state_site_key_uidx on public.app_state(site_id, key);
create index if not exists app_state_site_updated_idx on public.app_state(site_id, updated_at desc);

comment on table public.app_state is 'Persistance cloud de l état application Hippo Commandes, isolée par site.';
comment on column public.app_state.site_id is 'Site propriétaire de la donnée.';
comment on column public.app_state.key is 'Clé métier (covers, products, supplierConfigs...).';
comment on column public.app_state.value is 'Valeur JSON de l état.';
comment on column public.app_state.updated_at is 'Dernière mise à jour.';

-- -------------------------------------------------------------
-- 2) Table de sauvegardes par site
-- -------------------------------------------------------------
create table if not exists public.site_backups (
  id          uuid primary key default gen_random_uuid(),
  site_id      uuid        not null references public.sites(id) on delete cascade,
  snapshot     jsonb       not null,
  backup_type  text        not null default 'manual' check (backup_type in ('manual', 'auto')),
  label        text,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);

create index if not exists site_backups_site_created_idx on public.site_backups(site_id, created_at desc);

comment on table public.site_backups is 'Snapshots complets par site pour restauration ciblée.';

-- -------------------------------------------------------------
-- 3) Fonctions d autorisation RLS
-- -------------------------------------------------------------
create or replace function public.is_super_or_global_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('super_admin', 'global_admin')
  );
$$;

create or replace function public.user_can_access_site(target_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_or_global_admin()
    or exists (
      select 1
      from public.user_sites us
      join public.profiles p on p.id = us.user_id
      where us.user_id = auth.uid()
        and us.site_id = target_site_id
        and p.is_active = true
    );
$$;

-- -------------------------------------------------------------
-- 4) RLS stricte
-- -------------------------------------------------------------
alter table public.app_state enable row level security;
alter table public.site_backups enable row level security;

-- Nettoyage d anciennes policies si besoin.
drop policy if exists app_state_select on public.app_state;
drop policy if exists app_state_insert on public.app_state;
drop policy if exists app_state_update on public.app_state;
drop policy if exists app_state_delete on public.app_state;
drop policy if exists site_backups_select on public.site_backups;
drop policy if exists site_backups_insert on public.site_backups;
drop policy if exists site_backups_update on public.site_backups;
drop policy if exists site_backups_delete on public.site_backups;

create policy app_state_select on public.app_state
for select
using (public.user_can_access_site(site_id));

create policy app_state_insert on public.app_state
for insert
with check (public.user_can_access_site(site_id));

create policy app_state_update on public.app_state
for update
using (public.user_can_access_site(site_id))
with check (public.user_can_access_site(site_id));

create policy app_state_delete on public.app_state
for delete
using (public.user_can_access_site(site_id));

create policy site_backups_select on public.site_backups
for select
using (public.user_can_access_site(site_id));

create policy site_backups_insert on public.site_backups
for insert
with check (public.user_can_access_site(site_id));

create policy site_backups_update on public.site_backups
for update
using (public.user_can_access_site(site_id))
with check (public.user_can_access_site(site_id));

create policy site_backups_delete on public.site_backups
for delete
using (public.is_super_or_global_admin());

-- -------------------------------------------------------------
-- 5) Droits minimums nécessaires côté front authentifié
-- -------------------------------------------------------------
revoke all on public.app_state from anon;
revoke all on public.site_backups from anon;
grant select, insert, update, delete on public.app_state to authenticated;
grant select, insert, update, delete on public.site_backups to authenticated;

-- -------------------------------------------------------------
-- 6) Base d automatisation quotidienne (optionnelle)
-- -------------------------------------------------------------
-- La sauvegarde auto 00h01 n est pas pilotable depuis le front de façon fiable.
-- Recommandation : créer un cron Supabase / pg_cron ou une Edge Function
-- qui construit chaque nuit un snapshot par site dans public.site_backups.
--
-- Exemple de principe (à adapter selon ton projet si pg_cron est activé) :
--   select cron.schedule(
--     'hippo-site-backups-daily',
--     '1 0 * * *',
--     $$
--     insert into public.site_backups(site_id, snapshot, backup_type, label)
--     select
--       s.id,
--       jsonb_object_agg(a.key, a.value),
--       'auto',
--       to_char(now(), 'YYYY-MM-DD')
--     from public.sites s
--     left join public.app_state a on a.site_id = s.id
--     group by s.id;
--     $$
--   );

commit;
