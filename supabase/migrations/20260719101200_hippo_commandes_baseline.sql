-- Baseline canonique Hippo Commandes.
--
-- Cette migration est rejouable sur une base Supabase vide et reste sûre sur
-- les environnements historiques : CREATE TABLE IF NOT EXISTS ne transforme
-- pas les colonnes existantes. La normalisation est volontairement isolée dans
-- la migration de convergence suivante.

begin;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
grant usage on schema private to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'commande',
  is_active boolean not null default true,
  access_scope text not null default 'current_site',
  protected_user boolean not null default false,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_key unique (email),
  constraint profiles_role_check check (
    role in ('super_admin', 'global_admin', 'director', 'manager_plus', 'manager', 'commande')
  ),
  constraint profiles_access_scope_check check (access_scope in ('all', 'current_site'))
);

create table if not exists public.user_site_access (
  user_id uuid not null references public.profiles (id) on delete cascade,
  site_id text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, site_id),
  constraint user_site_access_site_id_check check (
    site_id in ('hippo_thillois', 'hippo_st_thibault', 'au_bureau_montevrain')
  )
);

create table if not exists public.app_state (
  site_id text not null,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (site_id, key)
);

create table if not exists public.order_line_states (
  site_id text not null,
  product_id text not null,
  stock numeric,
  upcoming_delivery numeric,
  target_stock numeric,
  packaging numeric,
  margin numeric,
  updated_at timestamptz not null default now(),
  primary key (site_id, product_id)
);

create index if not exists user_site_access_site_idx
  on public.user_site_access (site_id);

create index if not exists app_state_site_updated_at_idx
  on public.app_state (site_id, updated_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.can_access_app_state_site(target_site_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and (
        p.role::text in ('super_admin', 'global_admin')
        or coalesce(p.access_scope, 'current_site') = 'all'
        or exists (
          select 1
          from public.user_site_access usa
          where usa.user_id = p.id
            and usa.site_id = target_site_id
            and usa.is_active = true
        )
      )
  );
$$;

create or replace function private.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Hippo Commandes est une application sur invitation par e-mail. Un compte
  -- Auth sans e-mail ne reçoit pas de profil applicatif ni d'autorisation.
  if new.email is null or btrim(new.email) = '' then
    return new;
  end if;

  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    )
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;
revoke all on function private.set_updated_at() from anon;
revoke all on function private.set_updated_at() from authenticated;

revoke all on function private.can_access_app_state_site(text) from public;
revoke all on function private.can_access_app_state_site(text) from anon;
revoke all on function private.can_access_app_state_site(text) from authenticated;
grant execute on function private.can_access_app_state_site(text) to authenticated;

revoke all on function private.handle_new_user_profile() from public;
revoke all on function private.handle_new_user_profile() from anon;
revoke all on function private.handle_new_user_profile() from authenticated;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

drop trigger if exists trg_user_site_access_updated_at on public.user_site_access;
create trigger trg_user_site_access_updated_at
before update on public.user_site_access
for each row execute function private.set_updated_at();

drop trigger if exists trg_app_state_updated_at on public.app_state;
create trigger trg_app_state_updated_at
before insert or update on public.app_state
for each row execute function private.set_updated_at();

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function private.handle_new_user_profile();

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.user_site_access enable row level security;
alter table public.user_site_access force row level security;
alter table public.app_state enable row level security;
alter table public.app_state force row level security;
alter table public.order_line_states enable row level security;
alter table public.order_line_states force row level security;

drop policy if exists profiles_select_admin_all on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_update_admin_all on public.profiles;
drop policy if exists profiles_insert_admin_only on public.profiles;
drop policy if exists profiles_delete_admin_only on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles for select to authenticated
using (id = (select auth.uid()));

drop policy if exists user_site_access_select_admin_all on public.user_site_access;
drop policy if exists user_site_access_write_admin on public.user_site_access;
drop policy if exists user_site_access_select_own on public.user_site_access;
create policy user_site_access_select_own
on public.user_site_access for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists app_state_select_authorized_site on public.app_state;
drop policy if exists app_state_insert_authorized_site on public.app_state;
drop policy if exists app_state_update_authorized_site on public.app_state;
drop policy if exists app_state_delete_authorized_site on public.app_state;
create policy app_state_select_authorized_site
on public.app_state for select to authenticated
using (private.can_access_app_state_site(site_id));
create policy app_state_insert_authorized_site
on public.app_state for insert to authenticated
with check (private.can_access_app_state_site(site_id));
create policy app_state_update_authorized_site
on public.app_state for update to authenticated
using (private.can_access_app_state_site(site_id))
with check (private.can_access_app_state_site(site_id));

drop policy if exists order_line_states_select_authorized_site on public.order_line_states;
drop policy if exists order_line_states_insert_authorized_site on public.order_line_states;
drop policy if exists order_line_states_update_authorized_site on public.order_line_states;
drop policy if exists order_line_states_delete_authorized_site on public.order_line_states;
create policy order_line_states_select_authorized_site
on public.order_line_states for select to authenticated
using (private.can_access_app_state_site(site_id));
create policy order_line_states_insert_authorized_site
on public.order_line_states for insert to authenticated
with check (private.can_access_app_state_site(site_id));
create policy order_line_states_update_authorized_site
on public.order_line_states for update to authenticated
using (private.can_access_app_state_site(site_id))
with check (private.can_access_app_state_site(site_id));
create policy order_line_states_delete_authorized_site
on public.order_line_states for delete to authenticated
using (private.can_access_app_state_site(site_id));

revoke all on table public.profiles from anon;
revoke all on table public.user_site_access from anon;
revoke all on table public.app_state from anon;
revoke all on table public.order_line_states from anon;

revoke all on table public.profiles from authenticated;
revoke all on table public.user_site_access from authenticated;
revoke all on table public.app_state from authenticated;
revoke all on table public.order_line_states from authenticated;

grant select on table public.profiles to authenticated;
grant select on table public.user_site_access to authenticated;
grant select, insert, update on table public.app_state to authenticated;
grant select, insert, update, delete on table public.order_line_states to authenticated;

grant all privileges on table public.profiles to service_role;
grant all privileges on table public.user_site_access to service_role;
grant all privileges on table public.app_state to service_role;
grant all privileges on table public.order_line_states to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      where p.pubname = 'supabase_realtime'
        and pr.prrelid = 'public.app_state'::regclass
    ) then
      alter publication supabase_realtime add table public.app_state;
    end if;

    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      where p.pubname = 'supabase_realtime'
        and pr.prrelid = 'public.order_line_states'::regclass
    ) then
      alter publication supabase_realtime add table public.order_line_states;
    end if;
  end if;
end;
$$;

comment on table public.profiles is 'Profils applicatifs Hippo Commandes liés à auth.users';
comment on table public.user_site_access is 'Accès actifs par utilisateur et identifiant de site texte';
comment on table public.app_state is 'État applicatif JSON versionné par site et clé';
comment on table public.order_line_states is 'État opérationnel par produit, synchronisé indépendamment';

commit;
