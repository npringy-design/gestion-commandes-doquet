-- Normalisation de recherche unique (manuels et allergènes), côté SQL identique à
-- normalizeText (src/utils/manualIndexer.ts) :
-- minuscules, sans accents, œ -> oe, æ -> ae, élisions retirées devant un mot
-- (l', d', j', m', n', s', t', c', qu' avec apostrophe droite ou courbe),
-- espaces réduites. « l'oeuf » donne « oeuf ».
-- Les titres normalisés et les vecteurs de recherche existants sont recalculés
-- pour appliquer exactement la même normalisation que les requêtes.

begin;

create or replace function private.manuels_normaliser(valeur text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select btrim(regexp_replace(
    regexp_replace(
      replace(replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(valeur, ''))), 'œ', 'oe'), 'æ', 'ae'),
      '(^|[^a-z0-9])(l|d|j|m|n|s|t|c|qu)[''’‘`´]', '\1', 'g'
    ),
    '\s+', ' ', 'g'
  ));
$$;

-- Recalcul (le déclencheur reconstruit search_vector quand titre / sections / nom sont mis à jour).
update public.fiches_operatoires set titre = titre, titre_normalise = private.manuels_normaliser(coalesce(titre, ''))
  where type = 'fiche';
update public.allergenes_plats set nom = nom, nom_normalise = private.manuels_normaliser(nom);

commit;
