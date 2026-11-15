// Constantes du module des manuels opératoires. Aucun réglage par site : tout
// ce qui pilote l'indexation et la recherche est défini ici, une seule fois.
// Les mots sont comparés sans accents ni majuscules.

export type SectionType =
  | 'ingredients'
  | 'mise_en_place'
  | 'a_la_commande'
  | 'dressage'
  | 'qualite'
  | 'autre';

export const SECTION_TYPES: readonly SectionType[] = [
  'ingredients',
  'mise_en_place',
  'a_la_commande',
  'dressage',
  'qualite',
  'autre',
];

export const SECTION_TYPE_LABELS: Readonly<Record<SectionType, string>> = {
  ingredients: 'Ingrédients',
  mise_en_place: 'Mise en place',
  a_la_commande: 'À la commande',
  dressage: 'Dressage',
  qualite: 'Qualité',
  autre: 'Autre',
};

// Version du format d'indexation : 3 = détection automatique des rubriques,
// accents recollés, lignes typées. Les fiches d'une version plus ancienne
// s'affichent avec « À réindexer ».
export const MANUAL_FORMAT_VERSION = 3;

// Mots d'un en-tête de rubrique (ligne en majuscules terminée par « : ») qui en
// déterminent le type. Le premier type dont un mot est contenu l'emporte ; un
// en-tête sans correspondance est de type « autre » (libellé conservé).
export const HEADER_KEYWORDS: readonly { readonly type: SectionType; readonly words: readonly string[] }[] = [
  { type: 'ingredients', words: ['ingredient'] },
  { type: 'mise_en_place', words: ['mise en place'] },
  { type: 'a_la_commande', words: ['commande'] },
  { type: 'dressage', words: ['dressage'] },
  { type: 'qualite', words: ['qualite', 'memo'] },
];

// Préfixes de sous-fiche (mot isolé uniquement) : « SF MOUSSE CHOCOLAT ».
export const SUB_FICHE_PREFIXES: readonly string[] = ['SF'];

// Unités reconnues dans une ligne d'ingrédient.
export const UNITS: readonly string[] = [
  'g', 'kg', 'l', 'cl', 'ml', 'unite', 'unites', 'piece', 'pieces', 'portion', 'portions', 'tranche', 'tranches',
];

// Un mot de la requête qui figure ici n'est pas cherché : il désigne la ou les
// rubriques à mettre en avant. Il n'est jamais surligné.
export const SYNONYMS: Readonly<Record<Exclude<SectionType, 'autre'>, readonly string[]>> = {
  ingredients: [
    'poids', 'grammage', 'quantite', 'combien', 'gramme', 'grammes', 'dose', 'portion', 'portions',
    'composition', 'ingredient', 'ingredients', 'contenu',
  ],
  mise_en_place: [
    'recette', 'preparation', 'preparer', 'fabrication', 'fabriquer', 'realiser', 'comment', 'process',
    'etapes', 'etape', 'cuisson', 'cuire', 'temperature', 'temps', 'duree', 'four', 'decongelation',
    'refroidissement', 'conservation',
  ],
  a_la_commande: [
    'recette', 'preparation', 'preparer', 'fabrication', 'fabriquer', 'realiser', 'comment', 'process',
    'etapes', 'etape', 'cuisson', 'cuire', 'temperature', 'temps', 'duree', 'four', 'decongelation',
    'refroidissement', 'conservation',
  ],
  dressage: ['assiette', 'vaisselle', 'dressage', 'dresser', 'presentation', 'contenant', 'ramequin', 'verre'],
  qualite: ['qualite', 'attention', 'important', 'memo'],
};

// Mots vides : ignorés dans la recherche, le surlignage et le rapprochement des sous-fiches.
export const STOP_WORDS: readonly string[] = [
  'le', 'la', 'les', 'l', 'un', 'une', 'des', 'de', 'du', 'd', 'au', 'aux', 'a', 'et', 'ou', 'en',
  'pour', 'par', 'sur', 'avec', 'sans', 'dans',
  // Questions en français (« quelles sont les allergènes pour… », « dis moi si y'a… »).
// « y'a », « y a » et « qu'est-ce » sont découpés en « y », « a », « qu », « est », « ce ».
  'quel', 'quels', 'quelle', 'quelles', 'sont', 'est', 'dis', 'moi', 'si', 'y', 'ya', 'il', 'ce', 'que',
  'qui', 'qu', 'contient', 'contenir', 'avoir', 'peux', 'tu',
];

// ---------------------------------------------------------------------------
// Allergènes
// ---------------------------------------------------------------------------

export type AllergenCode =
  | 'gluten'
  | 'crustaces'
  | 'oeufs'
  | 'poissons'
  | 'arachides'
  | 'soja'
  | 'lait'
  | 'fruits_a_coques'
  | 'celeri'
  | 'moutarde'
  | 'sesame'
  | 'sulfites'
  | 'lupin'
  | 'mollusques';

// Les 14 allergènes réglementaires, dans l'ordre d'affichage.
export const ALLERGEN_CODES: readonly AllergenCode[] = [
  'gluten', 'crustaces', 'oeufs', 'poissons', 'arachides', 'soja', 'lait',
  'fruits_a_coques', 'celeri', 'moutarde', 'sesame', 'sulfites', 'lupin', 'mollusques',
];

export const ALLERGEN_LABELS: Readonly<Record<AllergenCode, string>> = {
  gluten: 'Gluten',
  crustaces: 'Crustacés',
  oeufs: 'Œufs',
  poissons: 'Poissons',
  arachides: 'Arachides',
  soja: 'Soja',
  lait: 'Lait',
  fruits_a_coques: 'Fruits à coques',
  celeri: 'Céleri',
  moutarde: 'Moutarde',
  sesame: 'Sésame',
  sulfites: 'Sulfites',
  lupin: 'Lupin',
  mollusques: 'Mollusques',
};

// Libellés acceptés dans l'en-tête du tableau (comparés sans accents ni majuscules).
export const ALLERGEN_HEADER_LABELS: Readonly<Record<AllergenCode, readonly string[]>> = {
  gluten: ['gluten'],
  crustaces: ['crustaces'],
  oeufs: ['oeufs', 'œufs'],
  poissons: ['poissons'],
  arachides: ['arachides'],
  soja: ['soja'],
  lait: ['lait'],
  fruits_a_coques: ['fruits a coques', 'fruits à coques', 'fruits a coque', 'fruits à coque'],
  celeri: ['celeri'],
  moutarde: ['moutarde'],
  sesame: ['sesame'],
  sulfites: ['sulfites'],
  lupin: ['lupin'],
  mollusques: ['mollusques'],
};

// Un de ces mots dans la requête active la recherche d'allergènes. Comme les
// autres synonymes, il est retiré des termes et jamais surligné.
export const ALLERGEN_SYNONYMS: readonly string[] = ['allergene', 'allergenes', 'allergie', 'allergies', 'allergique'];

export const ALLERGEN_DISCLAIMER =
  'Ne tient pas compte des éventuelles contaminations croisées. En cas de doute, consulter le document officiel.';

// Plat sans case colorée : jamais « sans allergène ». Le texte est complété par la date du document.
export const ALLERGEN_NONE_FLAGGED = 'Aucun des 14 allergènes signalé dans le document du';
