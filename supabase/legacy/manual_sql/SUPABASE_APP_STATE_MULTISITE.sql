-- =============================================================
-- SUPABASE_APP_STATE_MULTISITE.sql
-- A executer dans Supabase SQL Editor avant d'ajouter un 2e site.
--
-- Objectif :
-- - conserver toutes les donnees existantes sous hippo_thillois
-- - remplacer la cle globale app_state.key par une isolation (site_id, key)
-- - permettre les upserts frontend avec on_conflict=site_id,key
-- =============================================================

BEGIN;

ALTER TABLE public.app_state
  ADD COLUMN IF NOT EXISTS site_id TEXT;

UPDATE public.app_state
SET site_id = 'hippo_thillois'
WHERE site_id IS NULL OR site_id = '';

ALTER TABLE public.app_state
  ALTER COLUMN site_id SET NOT NULL;

ALTER TABLE public.app_state
  DROP CONSTRAINT IF EXISTS app_state_pkey;

ALTER TABLE public.app_state
  ADD CONSTRAINT app_state_pkey PRIMARY KEY (site_id, key);

CREATE INDEX IF NOT EXISTS app_state_site_updated_at_idx
  ON public.app_state (site_id, updated_at DESC);

COMMENT ON COLUMN public.app_state.site_id
  IS 'Identifiant restaurant/site. hippo_thillois contient les donnees historiques.';

COMMIT;

-- Verification utile :
-- select site_id, key, updated_at from public.app_state order by site_id, key;
