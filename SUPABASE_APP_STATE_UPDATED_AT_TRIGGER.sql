-- Exécuter une seule fois dans Supabase SQL Editor
-- Garantit que updated_at est généré côté serveur à chaque INSERT / UPDATE.

create or replace function public.set_app_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_app_state_updated_at on public.app_state;

create trigger trg_app_state_updated_at
before insert or update on public.app_state
for each row
execute function public.set_app_state_updated_at();
