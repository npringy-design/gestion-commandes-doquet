-- Retour arrière opérationnel de la convergence.
--
-- Il restaure le chemin public historique des helpers et des politiques sans
-- supprimer les colonnes/contraintes compatibles ni réintroduire les droits
-- anonymes. Il est destiné à rétablir rapidement le comportement antérieur si
-- l'appel des fonctions private.* pose problème après un essai sur TEST.

begin;

create or replace function public.can_access_app_state_site(target_site_id text)
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

revoke all on function public.can_access_app_state_site(text) from public;
revoke all on function public.can_access_app_state_site(text) from anon;
grant execute on function public.can_access_app_state_site(text) to authenticated;

drop policy if exists app_state_select_authorized_site on public.app_state;
drop policy if exists app_state_insert_authorized_site on public.app_state;
drop policy if exists app_state_update_authorized_site on public.app_state;
create policy app_state_select_authorized_site
on public.app_state for select to authenticated
using (public.can_access_app_state_site(site_id));
create policy app_state_insert_authorized_site
on public.app_state for insert to authenticated
with check (public.can_access_app_state_site(site_id));
create policy app_state_update_authorized_site
on public.app_state for update to authenticated
using (public.can_access_app_state_site(site_id))
with check (public.can_access_app_state_site(site_id));

drop policy if exists order_line_states_select_authorized_site on public.order_line_states;
drop policy if exists order_line_states_insert_authorized_site on public.order_line_states;
drop policy if exists order_line_states_update_authorized_site on public.order_line_states;
drop policy if exists order_line_states_delete_authorized_site on public.order_line_states;
create policy order_line_states_select_authorized_site
on public.order_line_states for select to authenticated
using (public.can_access_app_state_site(site_id));
create policy order_line_states_insert_authorized_site
on public.order_line_states for insert to authenticated
with check (public.can_access_app_state_site(site_id));
create policy order_line_states_update_authorized_site
on public.order_line_states for update to authenticated
using (public.can_access_app_state_site(site_id))
with check (public.can_access_app_state_site(site_id));
create policy order_line_states_delete_authorized_site
on public.order_line_states for delete to authenticated
using (public.can_access_app_state_site(site_id));

commit;
