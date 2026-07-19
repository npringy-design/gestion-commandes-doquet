-- =============================================================
-- SUPABASE_BASELINE_PREFLIGHT_READ_ONLY.sql
--
-- Photographie strictement en lecture seule avant la baseline Hippo
-- Commandes. Ce fichier ne contient ni DDL ni écriture métier.
-- À exécuter sur Supabase TEST avant le dry-run puis à nouveau après toute
-- migration autorisée, afin de comparer les empreintes des objets exclus.
-- =============================================================

-- 1) Historique distant réellement enregistré.
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- 2) Volumes uniquement, sans lire ni exposer le contenu métier.
SELECT 'profiles' AS table_name, COUNT(*) AS row_count FROM public.profiles
UNION ALL SELECT 'user_site_access', COUNT(*) FROM public.user_site_access
UNION ALL SELECT 'app_state', COUNT(*) FROM public.app_state
UNION ALL SELECT 'order_line_states', COUNT(*) FROM public.order_line_states
UNION ALL SELECT 'suivi_gestion_app_state', COUNT(*) FROM public.suivi_gestion_app_state
UNION ALL SELECT 'suivi_gestion_user_access', COUNT(*) FROM public.suivi_gestion_user_access
ORDER BY table_name;

-- 3) Préconditions exactes de la migration de convergence.
SELECT 'required_table_missing' AS check_name, COUNT(*) AS anomaly_count
FROM (VALUES ('profiles'), ('user_site_access'), ('app_state'), ('order_line_states')) required(table_name)
WHERE to_regclass('public.' || required.table_name) IS NULL
UNION ALL
SELECT 'profiles_invalid_role', COUNT(*)
FROM public.profiles
WHERE role::text NOT IN ('super_admin', 'global_admin', 'director', 'manager_plus', 'manager', 'commande')
UNION ALL
SELECT 'profiles_invalid_access_scope', COUNT(*)
FROM public.profiles
WHERE access_scope NOT IN ('all', 'current_site')
UNION ALL
SELECT 'profiles_blank_email', COUNT(*)
FROM public.profiles
WHERE email IS NULL OR btrim(email) = ''
UNION ALL
SELECT 'profiles_duplicate_email', COUNT(*)
FROM (
  SELECT email
  FROM public.profiles
  WHERE email IS NOT NULL AND btrim(email) <> ''
  GROUP BY email
  HAVING COUNT(*) > 1
) duplicate_emails
UNION ALL
SELECT 'user_site_access_invalid_site', COUNT(*)
FROM public.user_site_access
WHERE site_id NOT IN ('hippo_thillois', 'hippo_st_thibault', 'au_bureau_montevrain')
UNION ALL
SELECT 'app_state_invalid_site', COUNT(*)
FROM public.app_state
WHERE site_id NOT IN ('hippo_thillois', 'hippo_st_thibault', 'au_bureau_montevrain')
UNION ALL
SELECT 'order_line_states_invalid_site', COUNT(*)
FROM public.order_line_states
WHERE site_id NOT IN ('hippo_thillois', 'hippo_st_thibault', 'au_bureau_montevrain')
ORDER BY check_name;

-- 4) Empreinte structurelle stable des quatre tables Hippo Commandes et des
-- deux tables suivi_gestion_* explicitement exclues de la migration.
WITH tracked_tables(table_name) AS (
  VALUES
    ('profiles'),
    ('user_site_access'),
    ('app_state'),
    ('order_line_states'),
    ('suivi_gestion_app_state'),
    ('suivi_gestion_user_access')
), object_parts AS (
  SELECT
    c.table_name,
    'column:' || c.ordinal_position || ':' || c.column_name || ':' || c.data_type || ':' ||
      COALESCE(c.udt_name, '') || ':' || c.is_nullable || ':' || COALESCE(c.column_default, '') AS definition
  FROM information_schema.columns c
  JOIN tracked_tables t USING (table_name)
  WHERE c.table_schema = 'public'

  UNION ALL

  SELECT
    rel.relname,
    'table:' || rel.relrowsecurity || ':' || rel.relforcerowsecurity
  FROM pg_class rel
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  JOIN tracked_tables t ON t.table_name = rel.relname
  WHERE n.nspname = 'public'

  UNION ALL

  SELECT
    rel.relname,
    'constraint:' || con.conname || ':' || pg_get_constraintdef(con.oid, true)
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  JOIN tracked_tables t ON t.table_name = rel.relname
  WHERE n.nspname = 'public'

  UNION ALL

  SELECT
    tablename,
    'index:' || indexname || ':' || indexdef
  FROM pg_indexes i
  JOIN tracked_tables t ON t.table_name = i.tablename
  WHERE schemaname = 'public'

  UNION ALL

  SELECT
    tablename,
    'policy:' || policyname || ':' || cmd || ':' || COALESCE(qual, '') || ':' || COALESCE(with_check, '')
  FROM pg_policies p
  JOIN tracked_tables t ON t.table_name = p.tablename
  WHERE schemaname = 'public'

  UNION ALL

  SELECT
    rel.relname,
    'trigger:' || trg.tgname || ':' || pg_get_triggerdef(trg.oid, true)
  FROM pg_trigger trg
  JOIN pg_class rel ON rel.oid = trg.tgrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  JOIN tracked_tables t ON t.table_name = rel.relname
  WHERE n.nspname = 'public' AND NOT trg.tgisinternal

  UNION ALL

  SELECT
    g.table_name,
    'grant:' || g.grantee || ':' || g.privilege_type || ':' || g.is_grantable
  FROM information_schema.role_table_grants g
  JOIN tracked_tables t USING (table_name)
  WHERE g.table_schema = 'public'
    AND g.grantee IN ('anon', 'authenticated', 'service_role')
)
SELECT
  t.table_name,
  md5(COALESCE(string_agg(p.definition, E'\n' ORDER BY p.definition), '')) AS structure_fingerprint
FROM tracked_tables t
LEFT JOIN object_parts p USING (table_name)
GROUP BY t.table_name
ORDER BY t.table_name;

-- 5) Publication Realtime, helpers et triggers Auth concernés.
SELECT p.pubname, n.nspname AS schema_name, c.relname AS table_name
FROM pg_publication_rel pr
JOIN pg_publication p ON p.oid = pr.prpubid
JOIN pg_class c ON c.oid = pr.prrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE p.pubname = 'supabase_realtime'
  AND n.nspname = 'public'
  AND c.relname IN ('app_state', 'order_line_states', 'suivi_gestion_app_state', 'suivi_gestion_user_access')
ORDER BY c.relname;

SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  p.prosecdef AS security_definer,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  md5(pg_get_functiondef(p.oid)) AS definition_fingerprint
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'private')
  AND p.proname IN ('set_updated_at', 'can_access_app_state_site', 'handle_new_user_profile')
ORDER BY n.nspname, p.proname;

SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  t.tgname AS trigger_name,
  md5(pg_get_triggerdef(t.oid, true)) AS definition_fingerprint
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal
  AND ((n.nspname = 'public' AND c.relname IN ('profiles', 'user_site_access', 'app_state'))
    OR (n.nspname = 'auth' AND c.relname = 'users'))
ORDER BY n.nspname, c.relname, t.tgname;
