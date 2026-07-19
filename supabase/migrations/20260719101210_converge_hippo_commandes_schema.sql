-- Convergence des environnements Supabase historiques vers la baseline.
-- La migration s'arrête avant toute transformation si les données ne
-- respectent pas le contrat applicatif. Elle ne supprime aucune table legacy.

begin;

do $$
declare
  missing_tables text;
begin
  select string_agg(required.table_name, ', ' order by required.table_name)
  into missing_tables
  from (
    values ('profiles'), ('user_site_access'), ('app_state'), ('order_line_states')
  ) as required(table_name)
  where to_regclass('public.' || required.table_name) is null;

  if missing_tables is not null then
    raise exception 'Baseline incomplète, tables absentes : %', missing_tables;
  end if;

  if exists (
    select 1 from public.profiles
    where role::text not in ('super_admin', 'global_admin', 'director', 'manager_plus', 'manager', 'commande')
  ) then
    raise exception 'Convergence refusée : un rôle profiles est hors contrat';
  end if;

  if exists (
    select 1 from public.profiles
    where access_scope not in ('all', 'current_site')
  ) then
    raise exception 'Convergence refusée : un access_scope profiles est hors contrat';
  end if;

  if exists (
    select 1 from public.user_site_access
    where site_id not in ('hippo_thillois', 'hippo_st_thibault', 'au_bureau_montevrain')
  ) then
    raise exception 'Convergence refusée : un site user_site_access est inconnu';
  end if;

  if exists (
    select email from public.profiles
    where email is not null and btrim(email) <> ''
    group by email having count(*) > 1
  ) then
    raise exception 'Convergence refusée : des e-mails profiles sont dupliqués';
  end if;
end;
$$;

alter table public.profiles
  add column if not exists access_scope text not null default 'current_site',
  add column if not exists protected_user boolean not null default false,
  add column if not exists must_change_password boolean not null default false;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and (p.email is null or btrim(p.email) = '')
  and u.email is not null
  and btrim(u.email) <> '';

do $$
begin
  if exists (select 1 from public.profiles where email is null or btrim(email) = '') then
    raise exception 'Convergence refusée : un profil reste sans e-mail Auth réparable';
  end if;
end;
$$;

alter table public.profiles alter column role drop default;

do $$
declare
  role_type text;
begin
  select c.udt_name into role_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'profiles'
    and c.column_name = 'role';

  if role_type <> 'text' then
    alter table public.profiles
      alter column role type text using role::text;
  end if;
end;
$$;

alter table public.profiles
  alter column email set not null,
  alter column role set default 'commande',
  alter column role set not null,
  alter column access_scope set default 'current_site',
  alter column access_scope set not null,
  alter column protected_user set default false,
  alter column protected_user set not null,
  alter column must_change_password set default false,
  alter column must_change_password set not null;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('super_admin', 'global_admin', 'director', 'manager_plus', 'manager', 'commande'))
  not valid;
alter table public.profiles validate constraint profiles_role_check;

alter table public.profiles drop constraint if exists profiles_access_scope_check;
alter table public.profiles
  add constraint profiles_access_scope_check
  check (access_scope in ('all', 'current_site'))
  not valid;
alter table public.profiles validate constraint profiles_access_scope_check;

create unique index if not exists profiles_email_key
  on public.profiles (email);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'u'
      and conname = 'profiles_email_key'
  ) then
    alter table public.profiles
      add constraint profiles_email_key unique using index profiles_email_key;
  end if;
end;
$$;

alter table public.user_site_access
  drop constraint if exists user_site_access_site_id_check;
alter table public.user_site_access
  add constraint user_site_access_site_id_check
  check (site_id in ('hippo_thillois', 'hippo_st_thibault', 'au_bureau_montevrain'))
  not valid;
alter table public.user_site_access validate constraint user_site_access_site_id_check;

drop index if exists public.user_site_access_user_idx;
create index if not exists user_site_access_site_idx
  on public.user_site_access (site_id);

drop index if exists public.profiles_role_idx;
drop index if exists public.profiles_is_active_idx;

alter table public.app_state
  alter column site_id drop default,
  alter column value drop default,
  alter column value set not null,
  alter column updated_at set default now();

drop index if exists public.idx_app_state_updated_at;
drop index if exists public.app_state_updated_at_idx;
create index if not exists app_state_site_updated_at_idx
  on public.app_state (site_id, updated_at desc);

-- Les politiques et triggers ont déjà été repointés vers private.* par la
-- baseline. Sans CASCADE, un consommateur externe inconnu bloquerait la
-- suppression et provoquerait un rollback complet de la transaction.
drop function if exists public.can_access_app_state_site(text);
drop function if exists public.is_current_user_admin();
drop function if exists public.can_manage_users();
drop function if exists public.handle_new_user_profile();
drop function if exists public.set_profiles_updated_at();
drop function if exists public.set_user_site_access_updated_at();
drop function if exists public.set_app_state_updated_at();

-- default_site_id, sites et user_sites sont conservés uniquement en
-- production : 2 profils et 2 affectations legacy existent encore. Le code
-- Hippo Commandes ne les utilise pas, mais leur suppression nécessite une
-- migration de données dédiée et une validation métier séparée.

comment on column public.profiles.role is
  'Rôle applicatif : super_admin | global_admin | director | manager_plus | manager | commande';
comment on column public.profiles.access_scope is
  'Portée globale (all) ou affectations user_site_access (current_site)';
comment on column public.profiles.must_change_password is
  'Force le changement du mot de passe temporaire à la prochaine connexion';

commit;
