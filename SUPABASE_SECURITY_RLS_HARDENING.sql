-- =============================================================
-- SUPABASE_SECURITY_RLS_HARDENING.sql
--
-- Durcissement ciblé après audit Supabase.
-- À exécuter d'abord sur Supabase TEST, puis en production uniquement
-- après validation explicite de la version test.
--
-- Principes :
-- - le navigateur lit uniquement son propre profil et ses propres sites ;
-- - aucune écriture directe navigateur sur profiles/user_site_access ;
-- - la gestion des utilisateurs reste assurée par /api/admin/users/* avec
--   le client serveur service_role et ses contrôles de rôles/sites ;
-- - app_state et order_line_states restent accessibles par site aux
--   utilisateurs authentifiés ;
-- - anon ne conserve aucun privilège direct sur ces tables sensibles.
-- =============================================================

BEGIN;

-- 1) RLS activée et forcée sur les quatre tables critiques.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_site_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_site_access FORCE ROW LEVEL SECURITY;

ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_state FORCE ROW LEVEL SECURITY;

ALTER TABLE public.order_line_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_line_states FORCE ROW LEVEL SECURITY;

-- 2) Suppression des politiques trop larges de gestion directe des profils.
DROP POLICY IF EXISTS "profiles_select_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin_only" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin_only" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

-- Le frontend authentifié ne lit que son propre profil.
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- 3) user_site_access : lecture de ses propres affectations uniquement.
DROP POLICY IF EXISTS "user_site_access_select_admin_all" ON public.user_site_access;
DROP POLICY IF EXISTS "user_site_access_select_own" ON public.user_site_access;
DROP POLICY IF EXISTS "user_site_access_write_admin" ON public.user_site_access;

CREATE POLICY "user_site_access_select_own"
ON public.user_site_access
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 4) Garantir les politiques par site sur app_state.
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

-- 5) Garantir les politiques par site sur order_line_states.
DROP POLICY IF EXISTS "order_line_states_select_authorized_site" ON public.order_line_states;
DROP POLICY IF EXISTS "order_line_states_insert_authorized_site" ON public.order_line_states;
DROP POLICY IF EXISTS "order_line_states_update_authorized_site" ON public.order_line_states;
DROP POLICY IF EXISTS "order_line_states_delete_authorized_site" ON public.order_line_states;

CREATE POLICY "order_line_states_select_authorized_site"
ON public.order_line_states
FOR SELECT
TO authenticated
USING (public.can_access_app_state_site(site_id));

CREATE POLICY "order_line_states_insert_authorized_site"
ON public.order_line_states
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_app_state_site(site_id));

CREATE POLICY "order_line_states_update_authorized_site"
ON public.order_line_states
FOR UPDATE
TO authenticated
USING (public.can_access_app_state_site(site_id))
WITH CHECK (public.can_access_app_state_site(site_id));

CREATE POLICY "order_line_states_delete_authorized_site"
ON public.order_line_states
FOR DELETE
TO authenticated
USING (public.can_access_app_state_site(site_id));

-- 6) Suppression de tous les privilèges directs excessifs.
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.user_site_access FROM anon;
REVOKE ALL ON TABLE public.app_state FROM anon;
REVOKE ALL ON TABLE public.order_line_states FROM anon;

REVOKE ALL ON TABLE public.profiles FROM authenticated;
REVOKE ALL ON TABLE public.user_site_access FROM authenticated;
REVOKE ALL ON TABLE public.app_state FROM authenticated;
REVOKE ALL ON TABLE public.order_line_states FROM authenticated;

-- 7) Réattribution du strict minimum nécessaire au frontend connecté.
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.user_site_access TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.app_state TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.order_line_states TO authenticated;

-- 8) Les fonctions utilisées par les politiques ne sont pas exécutables par anon.
REVOKE ALL ON FUNCTION public.can_access_app_state_site(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_app_state_site(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_app_state_site(text) TO authenticated;

-- La fonction historique peut être utilisée par d'autres scripts du projet,
-- mais elle ne doit jamais être exposée à anon.
REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;

COMMIT;

-- =============================================================
-- Vérifications en lecture seule après exécution.
-- Résultat attendu :
-- - 4 tables avec rls_enabled = true et rls_forced = true ;
-- - aucune ligne anon dans les privilèges ;
-- - profiles/user_site_access : SELECT uniquement pour authenticated ;
-- - aucune politique INSERT/UPDATE/DELETE sur profiles/user_site_access ;
-- - le dernier tableau affiche trois colonnes à true.
-- =============================================================

SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('profiles', 'user_site_access', 'app_state', 'order_line_states')
ORDER BY c.relname;

SELECT
  tablename,
  policyname,
  roles,
  cmd,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'user_site_access', 'app_state', 'order_line_states')
ORDER BY tablename, policyname;

SELECT
  table_name,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'user_site_access', 'app_state', 'order_line_states')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

WITH rls_status AS (
  SELECT
    c.relname,
    c.relrowsecurity,
    c.relforcerowsecurity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('profiles', 'user_site_access', 'app_state', 'order_line_states')
),
anon_privileges AS (
  SELECT 1
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN ('profiles', 'user_site_access', 'app_state', 'order_line_states')
    AND grantee = 'anon'
),
forbidden_write_policies AS (
  SELECT 1
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('profiles', 'user_site_access')
    AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
)
SELECT
  (
    SELECT COUNT(*) = 4
       AND BOOL_AND(relrowsecurity)
       AND BOOL_AND(relforcerowsecurity)
    FROM rls_status
  ) AS rls_ok,
  NOT EXISTS (SELECT 1 FROM anon_privileges) AS aucun_droit_anon,
  NOT EXISTS (SELECT 1 FROM forbidden_write_policies) AS aucune_ecriture_directe_utilisateurs;
