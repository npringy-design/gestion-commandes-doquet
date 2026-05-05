-- =============================================================
-- À exécuter dans Supabase → SQL Editor
-- Module de base : Gestion des utilisateurs (profiles + RLS)
-- =============================================================

-- 1) Enum des rôles applicatifs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
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

-- Compatibilite avec les projets crees avec l'ancien enum admin/manager/viewer.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.app_role'::regtype AND enumlabel = 'super_admin') THEN
    ALTER TYPE public.app_role ADD VALUE 'super_admin';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.app_role'::regtype AND enumlabel = 'global_admin') THEN
    ALTER TYPE public.app_role ADD VALUE 'global_admin';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.app_role'::regtype AND enumlabel = 'director') THEN
    ALTER TYPE public.app_role ADD VALUE 'director';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.app_role'::regtype AND enumlabel = 'manager_plus') THEN
    ALTER TYPE public.app_role ADD VALUE 'manager_plus';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.app_role'::regtype AND enumlabel = 'manager') THEN
    ALTER TYPE public.app_role ADD VALUE 'manager';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.app_role'::regtype AND enumlabel = 'commande') THEN
    ALTER TYPE public.app_role ADD VALUE 'commande';
  END IF;
END
$$;

-- 2) Table profils liée à auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  full_name  TEXT,
  role       public.app_role NOT NULL DEFAULT 'commande',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  access_scope TEXT NOT NULL DEFAULT 'current_site',
  protected_user BOOLEAN NOT NULL DEFAULT FALSE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_scope TEXT NOT NULL DEFAULT 'current_site',
  ADD COLUMN IF NOT EXISTS protected_user BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'commande';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_access_scope_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_access_scope_check
      CHECK (access_scope IN ('all', 'current_site'));
  END IF;
END;
$$;

-- Index utiles
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles (role);
CREATE INDEX IF NOT EXISTS profiles_is_active_idx ON public.profiles (is_active);

-- 3) Trigger updated_at
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

-- 4) Trigger de création auto du profil à l'inscription auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      ''
    )
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();

-- 5) Backfill pour les utilisateurs déjà existants
INSERT INTO public.profiles (id, email, full_name)
SELECT
  u.id,
  COALESCE(u.email, ''),
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    ''
  )
FROM auth.users u
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      updated_at = now();

-- 6) RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- helper: vérifier si l'utilisateur courant est admin actif
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

-- Nettoyage policies (idempotent)
DROP POLICY IF EXISTS "profiles_select_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin_only" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin_only" ON public.profiles;

-- Lecture: admin lit tout
CREATE POLICY "profiles_select_admin_all"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_current_user_admin());

-- Lecture: utilisateur lit son propre profil
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Modification: admin uniquement
CREATE POLICY "profiles_update_admin_all"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

-- Insertion: admin uniquement (hors trigger SECURITY DEFINER)
CREATE POLICY "profiles_insert_admin_only"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (public.is_current_user_admin());

-- Suppression: admin uniquement
CREATE POLICY "profiles_delete_admin_only"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.is_current_user_admin());

-- Permissions SQL minimales (RLS filtre ensuite)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

COMMENT ON TABLE public.profiles IS 'Profils applicatifs liés à auth.users pour la gestion des rôles et statuts';
COMMENT ON COLUMN public.profiles.role IS 'Rôle applicatif: super_admin | global_admin | director | manager_plus | manager | commande';
COMMENT ON COLUMN public.profiles.is_active IS 'Compte actif/inactif côté application';
