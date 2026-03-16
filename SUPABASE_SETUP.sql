-- =============================================================
-- À exécuter dans Supabase → SQL Editor
-- Crée la table app_state pour la persistance cloud de l'app
-- =============================================================

-- Table principale
CREATE TABLE IF NOT EXISTS app_state (
  key        TEXT        PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index sur updated_at pour les futures requêtes triées
CREATE INDEX IF NOT EXISTS app_state_updated_at_idx ON app_state (updated_at DESC);

-- Désactiver Row Level Security (données non-sensibles, app interne)
-- Si tu veux sécuriser plus tard, active RLS et ajoute une policy.
ALTER TABLE app_state DISABLE ROW LEVEL SECURITY;

-- Permettre l'accès à la clé anon (nécessaire depuis le frontend)
GRANT ALL ON app_state TO anon;
GRANT ALL ON app_state TO authenticated;

-- Commentaire
COMMENT ON TABLE app_state IS 'Persistance cloud de l état application Hippo Commandes';
COMMENT ON COLUMN app_state.key IS 'Clé localStorage (ex: covers, products, inventory...)';
COMMENT ON COLUMN app_state.value IS 'Valeur JSON de l état';
COMMENT ON COLUMN app_state.updated_at IS 'Dernière mise à jour';
