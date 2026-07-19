-- Copie de preuve de la migration enregistrée sur Supabase TEST.
-- Ne pas déplacer ce fichier dans supabase/migrations/ ni le rejouer.

create table if not exists public.order_line_states (
  site_id           text not null,
  product_id        text not null,
  stock             numeric,
  upcoming_delivery numeric,
  target_stock      numeric,
  packaging         numeric,
  margin            numeric,
  updated_at        timestamptz not null default now(),
  primary key (site_id, product_id)
);

comment on table public.order_line_states is
  'Etat operationnel par produit (stock/livraison/marge), une ligne = un produit, sync realtime.';

alter table public.order_line_states enable row level security;

create policy order_line_states_select_authorized_site
  on public.order_line_states
  for select
  to authenticated
  using (can_access_app_state_site(site_id));

create policy order_line_states_insert_authorized_site
  on public.order_line_states
  for insert
  to authenticated
  with check (can_access_app_state_site(site_id));

create policy order_line_states_update_authorized_site
  on public.order_line_states
  for update
  to authenticated
  using (can_access_app_state_site(site_id))
  with check (can_access_app_state_site(site_id));

create policy order_line_states_delete_authorized_site
  on public.order_line_states
  for delete
  to authenticated
  using (can_access_app_state_site(site_id));

alter publication supabase_realtime add table public.order_line_states;
