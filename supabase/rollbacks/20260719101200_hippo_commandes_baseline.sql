-- Retour arrière réservé à une base locale/TEST vide créée par la baseline.
-- Le garde-fou interdit toute suppression si une seule donnée métier existe.

begin;

do $$
declare
  row_total bigint;
begin
  select
    (select count(*) from public.profiles)
    + (select count(*) from public.user_site_access)
    + (select count(*) from public.app_state)
    + (select count(*) from public.order_line_states)
  into row_total;

  if row_total <> 0 then
    raise exception 'Rollback baseline refusé : % lignes métier présentes', row_total;
  end if;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if exists (
      select 1 from pg_publication_rel pr join pg_publication p on p.oid = pr.prpubid
      where p.pubname = 'supabase_realtime'
        and pr.prrelid = 'public.order_line_states'::regclass
    ) then
      alter publication supabase_realtime drop table public.order_line_states;
    end if;
    if exists (
      select 1 from pg_publication_rel pr join pg_publication p on p.oid = pr.prpubid
      where p.pubname = 'supabase_realtime'
        and pr.prrelid = 'public.app_state'::regclass
    ) then
      alter publication supabase_realtime drop table public.app_state;
    end if;
  end if;
end;
$$;

drop table public.order_line_states;
drop table public.app_state;
drop table public.user_site_access;
drop table public.profiles;
-- Le rollback opérationnel de convergence recrée ce helper public. Une base
-- jetable entièrement démontée ne doit pas conserver cette fonction orpheline.
drop function if exists public.can_access_app_state_site(text);
drop function private.handle_new_user_profile();
drop function private.can_access_app_state_site(text);
drop function private.set_updated_at();
drop schema private;

commit;
