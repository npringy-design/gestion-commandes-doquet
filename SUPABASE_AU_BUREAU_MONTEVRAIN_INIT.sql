-- =============================================================
-- SUPABASE_AU_BUREAU_MONTEVRAIN_INIT.sql
--
-- A executer sur le Supabase PRODUCTION avant d'ouvrir
-- "Au bureau Montevrain" dans l'application production.
--
-- Objectif :
-- - verifier que app_state est bien isolee par (site_id, key)
-- - verifier que le site au_bureau_montevrain est accepte
-- - creer une premiere ligne de sauvegarde dediee au site Au Bureau
-- - ne jamais modifier les lignes hippo_thillois ou hippo_st_thibault
--
-- Ce script est idempotent : il peut etre relance sans ecraser les donnees.
-- =============================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'app_state'
      AND column_name = 'site_id'
  ) THEN
    RAISE EXCEPTION 'app_state.site_id est absent. Executer SUPABASE_APP_STATE_MULTISITE.sql avant ce script.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'app_state'
      AND c.contype = 'p'
      AND pg_get_constraintdef(c.oid) ILIKE '%site_id%'
      AND pg_get_constraintdef(c.oid) ILIKE '%key%'
  ) THEN
    RAISE EXCEPTION 'app_state doit avoir une cle primaire/unique par (site_id, key). Executer SUPABASE_APP_STATE_MULTISITE.sql avant ce script.';
  END IF;
END $$;

ALTER TABLE public.user_site_access
  DROP CONSTRAINT IF EXISTS user_site_access_site_id_check;

ALTER TABLE public.user_site_access
  ADD CONSTRAINT user_site_access_site_id_check
  CHECK (site_id IN ('hippo_thillois', 'hippo_st_thibault', 'au_bureau_montevrain'));

INSERT INTO public.app_state (site_id, key, value, updated_at)
VALUES (
  'au_bureau_montevrain',
  'siteBootstrap',
  jsonb_build_object(
    'site_id', 'au_bureau_montevrain',
    'name', 'Au bureau Montevrain',
    'purpose', 'Initialisation espace sauvegarde production',
    'created_at', now()
  ),
  now()
)
ON CONFLICT (site_id, key) DO NOTHING;

COMMIT;

-- Verification apres execution :
-- select site_id, key, updated_at
-- from public.app_state
-- where site_id in ('hippo_thillois', 'hippo_st_thibault', 'au_bureau_montevrain')
-- order by site_id, key;
