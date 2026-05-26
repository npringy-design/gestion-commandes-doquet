-- =============================================================
-- À exécuter dans Supabase → SQL Editor
-- Crée la table app_state pour la persistance cloud de l'app
-- =============================================================
-- ATTENTION SECURITE : ce script est un script INITIAL de creation.
-- Il ne represente PAS l'etat final securise de production.
-- Il ouvre volontairement l'acces initial a app_state pour permettre
-- l'installation historique, puis doit obligatoirement etre suivi par
-- les scripts de verrouillage RLS/multisite.
--
-- Ordre minimal attendu apres ce script :
-- 1. SUPABASE_PROFILES_SETUP.sql
-- 2. SUPABASE_USER_SITE_ACCESS.sql
-- 3. SUPABASE_APP_STATE_RLS_LOCKDOWN.sql
-- 4. SUPABASE_ENABLE_REALTIME.sql si necessaire
--
-- Ne jamais laisser une base production dans l'etat de ce seul script.
-- SUPABASE_APP_STATE_RLS_LOCKDOWN.sql doit retirer l'acces anon et activer
-- RLS/FORCE RLS sur app_state.
-- =============================================================

-- Table principale
CREATE TABLE IF NOT EXISTS app_state (
  site_id    TEXT        NOT NULL DEFAULT 'hippo_thillois',
  key        TEXT        PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app_state ADD COLUMN IF NOT EXISTS site_id TEXT DEFAULT 'hippo_thillois';
UPDATE app_state SET site_id = 'hippo_thillois' WHERE site_id IS NULL OR site_id = '';
ALTER TABLE app_state ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE app_state DROP CONSTRAINT IF EXISTS app_state_pkey;
ALTER TABLE app_state ADD CONSTRAINT app_state_pkey PRIMARY KEY (site_id, key);

-- Index sur updated_at pour les futures requêtes triées
CREATE INDEX IF NOT EXISTS app_state_updated_at_idx ON app_state (updated_at DESC);
CREATE INDEX IF NOT EXISTS app_state_site_updated_at_idx ON app_state (site_id, updated_at DESC);

-- Désactiver Row Level Security (état initial uniquement, non sécurisé)
-- ATTENTION : ne jamais laisser une base production dans cet état.
-- Exécuter ensuite SUPABASE_APP_STATE_RLS_LOCKDOWN.sql.
ALTER TABLE app_state DISABLE ROW LEVEL SECURITY;

-- Permettre l'accès à la clé anon (état initial uniquement, non sécurisé)
-- ATTENTION : cet accès doit être retiré par SUPABASE_APP_STATE_RLS_LOCKDOWN.sql.
GRANT ALL ON app_state TO anon;
GRANT ALL ON app_state TO authenticated;

-- Commentaire
COMMENT ON TABLE app_state IS 'Persistance cloud de l état application Hippo Commandes';
COMMENT ON COLUMN app_state.site_id IS 'Identifiant restaurant/site (ex: hippo_thillois)';
COMMENT ON COLUMN app_state.key IS 'Clé localStorage (ex: covers, products, inventory...) isolée par site_id';
COMMENT ON COLUMN app_state.value IS 'Valeur JSON de l état';
COMMENT ON COLUMN app_state.updated_at IS 'Dernière mise à jour';