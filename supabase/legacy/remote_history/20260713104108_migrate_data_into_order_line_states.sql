-- ARCHIVE DISTANTE — NE PAS REJOUER.
-- Retrouvée uniquement dans l'historique Supabase production. Son rejeu
-- écraserait potentiellement des lignes courantes avec les anciens blobs.

with prod as (
  select
    a.site_id,
    (elem ->> 'id') as product_id,
    nullif(elem ->> 'stock', '')::numeric as stock,
    nullif(elem ->> 'upcomingDelivery', '')::numeric as upcoming_delivery,
    nullif(elem ->> 'targetStock', '')::numeric as target_stock,
    nullif(elem ->> 'packaging', '')::numeric as packaging
  from public.app_state a,
       jsonb_array_elements(a.value) as elem
  where a.key = 'products'
),
states as (
  select
    a.site_id,
    kv.key as product_id,
    nullif(kv.value ->> 'margin', '')::numeric as margin
  from public.app_state a,
       jsonb_each(a.value) as kv
  where a.key = 'orderStates'
)
insert into public.order_line_states (
  site_id,
  product_id,
  stock,
  upcoming_delivery,
  target_stock,
  packaging,
  margin,
  updated_at
)
select
  coalesce(prod.site_id, states.site_id),
  coalesce(prod.product_id, states.product_id),
  prod.stock,
  prod.upcoming_delivery,
  prod.target_stock,
  prod.packaging,
  states.margin,
  now()
from prod
full outer join states
  on prod.site_id = states.site_id
 and prod.product_id = states.product_id
on conflict (site_id, product_id) do update set
  stock = excluded.stock,
  upcoming_delivery = excluded.upcoming_delivery,
  target_stock = excluded.target_stock,
  packaging = excluded.packaging,
  margin = excluded.margin,
  updated_at = excluded.updated_at;
