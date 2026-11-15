-- Retour arrière de 20261118100000_normalisation_elisions.sql.
-- Restaure l'ancienne normalisation SQL (minuscules, sans accents). Les titres
-- normalisés et vecteurs déjà recalculés restent valides : l'ancienne
-- normalisation ne les rend pas incohérents, seules les élisions réapparaissent
-- au prochain recalcul.

begin;

create or replace function private.manuels_normaliser(valeur text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(valeur, '')));
$$;

commit;
