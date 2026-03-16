-- =============================================================
-- SUPABASE_PROFILES_SETUP.sql
-- À exécuter dans Supabase → SQL Editor
--
-- ⚠️  VERSION MISE À JOUR — alignée avec les rôles réels de l'app
--
-- Rôles applicatifs réels (src/auth/AuthProvider.tsx) :
--   super_admin > global_admin > director > manager_plus > manager > commande
--
-- Ancienne version obsolète utilisait : admin | manager | viewer
-- → NE PLUS utiliser l'ancienne version
-- =============================================================


-- ─── 1. Enum des rôles applicatifs ────────────────────────────
-- On recrée l'enum avec les vrais rôles.
-- Si l'ancien enum 'app_role' existe encore avec admin/manager/viewer,
-- on le supprime et on le recrée proprement.

DO $$
BEGIN
  -- Supprimer l'ancien enum s'il existe avec les mauvaises valeurs
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'app_role' AND n.nspname = 'public'
  ) THEN
    -- Vérifier si c'est l'ancien modèle (contient 'viewer')
    IF EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'app_role' AND e.enumlabel = 'viewer'
    ) THEN
      -- Migrer la colonne vers TEXT d'abord pour pouvoir supprimer l'enum
      ALTER TABLE IF EXISTS public.profiles ALTER COLUMN role TYPE TEXT;
      DROP TYPE public.app_role;
    END IF;
  END IF;

  -- Créer l'enum avec les vrais rôles si pas encore fait
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'app_role' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.app_role AS ENUM (
      'super_admin',
      'global_admin',
      'director',
      'manager_plus',
      'manager',
      'commande'
    );
  END IF;
END
$$;


-- ─── 2. Table profiles ────────────────────────────────────────
-- Crée la table si elle n'existe pas.
-- Si elle existe déjà, les ALTER TABLE ci-dessous ajoutent les
-- colonnes manquantes sans rien casser.

CREATE TABLE IF NOT EXISTS public.profiles (
  id             UUID        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email          TEXT        NOT NULL,
  full_name      TEXT,
  role           TEXT        NOT NULL DEFAULT 'commande',
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  access_scope   TEXT        DEFAULT 'current_site',  -- 'all' | 'current_site'
  protected_user BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ajouter les colonnes si elles n'existent pas (migration safe)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS access_scope   TEXT    DEFAULT 'current_site';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS protected_user BOOLEAN NOT NULL DEFAULT FALSE;

-- Reconvertir role en TEXT typé si c'était un ancien enum
-- (idempotent : ne fait rien si déjà TEXT)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'role'
      AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE public.profiles ALTER COLUMN role TYPE TEXT;
  END IF;
END
$$;

-- Contrainte CHECK sur les valeurs autorisées
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'global_admin', 'director', 'manager_plus', 'manager', 'commande'));

-- Contrainte CHECK sur access_scope
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_access_scope_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_access_scope_check
  CHECK (access_scope IS NULL OR access_scope IN ('all', 'current_site'));

-- Index
CREATE INDEX IF NOT EXISTS profiles_role_idx      ON public.profiles (role);
CREATE INDEX IF NOT EXISTS profiles_is_active_idx ON public.profiles (is_active);


-- ─── 3. Trigger updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_profiles_updated_at();


-- ─── 4. Trigger création auto du profil à l'inscription ───────
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      ''
    ),
    'commande'  -- rôle par défaut le plus restrictif
  )
  ON CONFLICT (id) DO UPDATE
    SET email      = EXCLUDED.email,
        updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();


-- ─── 5. Backfill utilisateurs existants ───────────────────────
INSERT INTO public.profiles (id, email, full_name, role)
SELECT
  u.id,
  COALESCE(u.email, ''),
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    ''
  ),
  'commande'
FROM auth.users u
ON CONFLICT (id) DO UPDATE
  SET email      = EXCLUDED.email,
      updated_at = now();
-- NOTE : on ne touche PAS au role existant pour ne pas rétrograder
-- les comptes déjà configurés.


-- ─── 6. RLS ───────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;


-- ─── 7. Fonction helper : rôles avec accès admin ──────────────
-- Alignée avec canAccessAdminDashboard() dans src/lib/permissions.ts
-- Rôles admin = super_admin | global_admin | director | manager_plus
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

-- Fonction helper : peut gérer les utilisateurs
-- Alignée avec canAccessUserManagement() dans src/lib/permissions.ts
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


-- ─── 8. Policies RLS ──────────────────────────────────────────

-- Nettoyage (idempotent)
DROP POLICY IF EXISTS "profiles_select_admin_all"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own"         ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin_all"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin_only"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin_only"  ON public.profiles;

-- Lecture : les admins/managers voient tous les profils
CREATE POLICY "profiles_select_admin_all"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.can_manage_users());

-- Lecture : chaque utilisateur voit son propre profil
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Modification : admin uniquement
CREATE POLICY "profiles_update_admin_all"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

-- Insertion : admin uniquement (hors trigger SECURITY DEFINER)
CREATE POLICY "profiles_insert_admin_only"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (public.is_current_user_admin());

-- Suppression : admin uniquement
CREATE POLICY "profiles_delete_admin_only"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.is_current_user_admin());

-- Permissions SQL minimales (RLS filtre ensuite)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;


-- ─── 9. Commentaires ──────────────────────────────────────────
COMMENT ON TABLE  public.profiles                IS 'Profils applicatifs liés à auth.users — gestion rôles et statuts Hippo Commandes';
COMMENT ON COLUMN public.profiles.role           IS 'Rôle applicatif : super_admin | global_admin | director | manager_plus | manager | commande';
COMMENT ON COLUMN public.profiles.is_active      IS 'Compte actif/inactif côté application';
COMMENT ON COLUMN public.profiles.access_scope   IS 'Périmètre d accès : all | current_site';
COMMENT ON COLUMN public.profiles.protected_user IS 'Compte protégé contre la suppression/rétrogradation';
