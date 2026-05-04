-- =============================================================
-- SUPABASE_USER_SITE_ACCESS.sql
-- Ajoute les accès utilisateurs par site sans recréer les rôles.
--
-- Règle applicative :
-- - super_admin et global_admin gardent access_scope = 'all'
-- - les autres rôles ont access_scope = 'current_site' et au moins une ligne ici
-- =============================================================

BEGIN;

-- Helpers RLS autonomes. Certains projets ont encore l'ancien
-- SUPABASE_PROFILES_SETUP.sql sans ces fonctions.
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
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
      AND p.role IN ('super_admin', 'global_admin', 'director', 'manager_plus')
      AND p.is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_users()
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
      AND p.role IN ('super_admin', 'global_admin', 'director', 'manager_plus', 'manager')
      AND p.is_active = TRUE
  );
$$;

CREATE TABLE IF NOT EXISTS public.user_site_access (
  user_id    UUID        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  site_id    TEXT        NOT NULL,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, site_id)
);

ALTER TABLE public.user_site_access
  ADD CONSTRAINT user_site_access_site_id_check
  CHECK (site_id IN ('hippo_thillois', 'hippo_st_thibault'));

CREATE INDEX IF NOT EXISTS user_site_access_user_idx
  ON public.user_site_access (user_id);

CREATE INDEX IF NOT EXISTS user_site_access_site_idx
  ON public.user_site_access (site_id);

CREATE OR REPLACE FUNCTION public.set_user_site_access_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_site_access_updated_at ON public.user_site_access;
CREATE TRIGGER trg_user_site_access_updated_at
BEFORE UPDATE ON public.user_site_access
FOR EACH ROW
EXECUTE FUNCTION public.set_user_site_access_updated_at();

INSERT INTO public.user_site_access (user_id, site_id, is_active)
SELECT p.id, 'hippo_thillois', TRUE
FROM public.profiles p
WHERE COALESCE(p.access_scope, 'current_site') <> 'all'
  AND p.role NOT IN ('super_admin', 'global_admin')
ON CONFLICT (user_id, site_id) DO NOTHING;

ALTER TABLE public.user_site_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_site_access FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_site_access_select_admin_all" ON public.user_site_access;
DROP POLICY IF EXISTS "user_site_access_select_own" ON public.user_site_access;
DROP POLICY IF EXISTS "user_site_access_write_admin" ON public.user_site_access;

CREATE POLICY "user_site_access_select_admin_all"
ON public.user_site_access
FOR SELECT
TO authenticated
USING (public.can_manage_users());

CREATE POLICY "user_site_access_select_own"
ON public.user_site_access
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "user_site_access_write_admin"
ON public.user_site_access
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_site_access TO authenticated;

COMMENT ON TABLE public.user_site_access IS 'Sites autorisés par utilisateur pour le mode multisite';
COMMENT ON COLUMN public.user_site_access.site_id IS 'Identifiant site : hippo_thillois | hippo_st_thibault';

COMMIT;
