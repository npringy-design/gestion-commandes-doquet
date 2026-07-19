-- =============================================================
-- SUPABASE_SECURITY_AUDIT_READ_ONLY.sql
--
-- Audit strictement en lecture seule des rôles, droits et politiques RLS.
-- Ce fichier ne crée, ne modifie et ne supprime aucune donnée ni politique.
-- À exécuter d'abord sur le projet Supabase TEST.
-- =============================================================

-- 1) Tables attendues et état RLS réel.
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('profiles', 'user_site_access', 'app_state', 'order_line_states')
ORDER BY c.relname;

-- 2) Politiques réellement installées, avec leurs conditions complètes.
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'user_site_access', 'app_state', 'order_line_states')
ORDER BY tablename, policyname;

-- 3) Privilèges SQL accordés aux rôles frontend.
SELECT
  table_schema,
  table_name,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'user_site_access', 'app_state', 'order_line_states')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- 4) Fonctions de sécurité réellement déployées.
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  p.prosecdef AS security_definer,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'is_current_user_admin',
    'can_manage_users',
    'can_access_app_state_site',
    'can_access_order_line_site',
    'can_manage_profile',
    'can_manage_user_site_access'
  )
ORDER BY p.proname;

-- 5) Valeurs de l'enum des rôles réellement présentes.
SELECT
  e.enumsortorder,
  e.enumlabel AS role
FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
  AND t.typname = 'app_role'
ORDER BY e.enumsortorder;

-- 6) Répartition des profils, sans afficher d'adresse e-mail.
SELECT
  role::text AS role,
  access_scope,
  is_active,
  protected_user,
  COUNT(*) AS profile_count
FROM public.profiles
GROUP BY role, access_scope, is_active, protected_user
ORDER BY role, access_scope, is_active DESC, protected_user DESC;

-- 7) Anomalies de périmètre : seuls super_admin/global_admin devraient
-- normalement avoir access_scope = all.
SELECT
  id,
  role::text AS role,
  access_scope,
  is_active,
  protected_user
FROM public.profiles
WHERE access_scope = 'all'
  AND role::text NOT IN ('super_admin', 'global_admin')
ORDER BY role, id;

-- 8) Comptes actifs limités à un site mais sans aucun site actif associé.
SELECT
  p.id,
  p.role::text AS role,
  p.access_scope,
  p.protected_user
FROM public.profiles p
WHERE p.is_active = TRUE
  AND COALESCE(p.access_scope, 'current_site') = 'current_site'
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_site_access usa
    WHERE usa.user_id = p.id
      AND usa.is_active = TRUE
  )
ORDER BY p.role, p.id;

-- 9) Accès par site, regroupés sans données personnelles.
SELECT
  p.role::text AS role,
  usa.site_id,
  usa.is_active,
  COUNT(*) AS access_count
FROM public.user_site_access usa
JOIN public.profiles p ON p.id = usa.user_id
GROUP BY p.role, usa.site_id, usa.is_active
ORDER BY usa.site_id, p.role, usa.is_active DESC;

-- 10) Contrôle final rapide : aucun privilège direct ne devrait rester à anon
-- sur les tables métier sensibles.
SELECT
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'user_site_access', 'app_state', 'order_line_states')
  AND grantee = 'anon'
ORDER BY table_name, privilege_type;
