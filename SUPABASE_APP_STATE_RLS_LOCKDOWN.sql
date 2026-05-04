-- =============================================================
-- SUPABASE_APP_STATE_RLS_LOCKDOWN.sql
--
-- Verrouille app_state par site_id au niveau Supabase.
-- A executer APRES SUPABASE_APP_STATE_MULTISITE.sql et
-- SUPABASE_USER_SITE_ACCESS.sql.
--
-- Objectif :
-- - un utilisateur non global ne peut lire/ecrire que ses sites actifs
-- - super_admin et global_admin peuvent lire/ecrire tous les sites
-- - la cle anon seule ne peut plus lire/ecrire app_state
-- =============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.can_access_app_state_site(target_site_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_active = TRUE
      AND (
        p.role IN ('super_admin', 'global_admin')
        OR COALESCE(p.access_scope, 'current_site') = 'all'
        OR EXISTS (
          SELECT 1
          FROM public.user_site_access usa
          WHERE usa.user_id = p.id
            AND usa.site_id = target_site_id
            AND usa.is_active = TRUE
        )
      )
  );
$$;

ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_state FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_state_select_authorized_site" ON public.app_state;
DROP POLICY IF EXISTS "app_state_insert_authorized_site" ON public.app_state;
DROP POLICY IF EXISTS "app_state_update_authorized_site" ON public.app_state;
DROP POLICY IF EXISTS "app_state_delete_authorized_site" ON public.app_state;

CREATE POLICY "app_state_select_authorized_site"
ON public.app_state
FOR SELECT
TO authenticated
USING (public.can_access_app_state_site(site_id));

CREATE POLICY "app_state_insert_authorized_site"
ON public.app_state
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_app_state_site(site_id));

CREATE POLICY "app_state_update_authorized_site"
ON public.app_state
FOR UPDATE
TO authenticated
USING (public.can_access_app_state_site(site_id))
WITH CHECK (public.can_access_app_state_site(site_id));

CREATE POLICY "app_state_delete_authorized_site"
ON public.app_state
FOR DELETE
TO authenticated
USING (public.can_access_app_state_site(site_id));

REVOKE ALL ON public.app_state FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_state TO authenticated;

COMMIT;

-- Verifications lecture seule utiles apres execution :
-- select relrowsecurity, relforcerowsecurity
-- from pg_class
-- where oid = 'public.app_state'::regclass;
--
-- select policyname, cmd, roles
-- from pg_policies
-- where schemaname = 'public' and tablename = 'app_state'
-- order by policyname;
