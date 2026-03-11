import type { CSSProperties } from 'react';

// Existing kept images
import grill03 from '../assets/supplier-visuals/grill-braise-03.webp';
import grill04 from '../assets/supplier-visuals/grill-braise-04.webp';
import viandes04 from '../assets/supplier-visuals/viandes-rustiques-04.webp';
import legumes01 from '../assets/supplier-visuals/legumes-01.webp';
import legumes02 from '../assets/supplier-visuals/legumes-02.webp';
import fruits01 from '../assets/supplier-visuals/fruits-01.webp';
import marcheFrais01 from '../assets/supplier-visuals/marche-frais-01.webp';
import epices01 from '../assets/supplier-visuals/epices-01.webp';
import epiceriePates01 from '../assets/supplier-visuals/epicerie-pates-01.webp';
import surgele01 from '../assets/supplier-visuals/surgele-01.webp';

// New images
import newGrilling01 from '../assets/supplier-visuals/new-grilling-01.jpg';
import newViande01 from '../assets/supplier-visuals/new-viande-01.jpg';
import newViande02 from '../assets/supplier-visuals/new-viande-02.jpg';
import newViande03 from '../assets/supplier-visuals/new-viande-03.jpg';
import newViande04 from '../assets/supplier-visuals/new-viande-04.jpg';
import newViande05 from '../assets/supplier-visuals/new-viande-05.jpg';
import newVins01 from '../assets/supplier-visuals/new-vins-01.jpg';
import newVins02 from '../assets/supplier-visuals/new-vins-02.jpg';
import newVins03 from '../assets/supplier-visuals/new-vins-03.jpg';
import newEpices01 from '../assets/supplier-visuals/new-epices-01.jpg';
import newEpices02 from '../assets/supplier-visuals/new-epices-02.jpg';
import newEpices03 from '../assets/supplier-visuals/new-epices-03.jpg';
import newSurgele01 from '../assets/supplier-visuals/new-surgele-01.jpg';
import newEpicerie01 from '../assets/supplier-visuals/new-epicerie-01.jpg';
import newLegumes01 from '../assets/supplier-visuals/new-legumes-01.jpg';
import newLegumes02 from '../assets/supplier-visuals/new-legumes-02.jpg';
import newLegumes03 from '../assets/supplier-visuals/new-legumes-03.jpg';
import newFruits01 from '../assets/supplier-visuals/new-fruits-01.jpg';
import newFruits02 from '../assets/supplier-visuals/new-fruits-02.jpg';
import newMarche01 from '../assets/supplier-visuals/new-marche-01.jpg';
import newCocktails01 from '../assets/supplier-visuals/new-cocktails-01.jpg';
import newGrill01 from '../assets/supplier-visuals/new-grill-01.jpg';
import newGrill02 from '../assets/supplier-visuals/new-grill-02.jpg';

export type SupplierVisualKey = string;

export interface SupplierVisualPreset {
  key: SupplierVisualKey;
  name: string;
  cardStyle: CSSProperties;
  thumbStyle: CSSProperties;
}

const buildPhotoStyle = (imageUrl: string, position = 'center center') => ({
  cardStyle: {
    backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.12) 42%, rgba(0,0,0,0.82) 100%), url(${imageUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: position,
  } satisfies CSSProperties,
  thumbStyle: {
    backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.24) 100%), url(${imageUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: position,
  } satisfies CSSProperties,
});

const photoPreset = (
  key: SupplierVisualKey,
  name: string,
  imageUrl: string,
  position = 'center center',
): SupplierVisualPreset => ({
  key,
  name,
  ...buildPhotoStyle(imageUrl, position),
});

export const SUPPLIER_VISUAL_PRESETS: SupplierVisualPreset[] = [
  // Grill & viandes
  photoPreset('grill-braise-03',      'Grill & braise',         grill03),
  photoPreset('grill-braise-04',      'Grill & braise 04',      grill04),
  photoPreset('new-grilling-01',      'Grillades',              newGrilling01),
  photoPreset('new-grill-01',         'Grill kebab',            newGrill01),
  photoPreset('new-grill-02',         'Grill brochette',        newGrill02),
  photoPreset('viandes-rustiques-04', 'Viandes rustiques',      viandes04),
  photoPreset('new-viande-01',        'Viande 01',              newViande01),
  photoPreset('new-viande-02',        'Viande 02',              newViande02),
  photoPreset('new-viande-03',        'Viande 03',              newViande03),
  photoPreset('new-viande-04',        'Viande 04',              newViande04),
  photoPreset('new-viande-05',        'Viande 05',              newViande05),
  // Vins & cocktails
  photoPreset('new-vins-01',          'Vins 01',                newVins01),
  photoPreset('new-vins-02',          'Vins 02',                newVins02),
  photoPreset('new-vins-03',          'Vins 03',                newVins03),
  photoPreset('new-cocktails-01',     'Cocktails',              newCocktails01),
  // Légumes & fruits
  photoPreset('legumes-01',           'Légumes',                legumes01),
  photoPreset('legumes-02',           'Légumes 02',             legumes02),
  photoPreset('new-legumes-01',       'Légumes 03',             newLegumes01),
  photoPreset('new-legumes-02',       'Légumes 04',             newLegumes02),
  photoPreset('new-legumes-03',       'Légumes 05',             newLegumes03),
  photoPreset('fruits-01',            'Fruits',                 fruits01),
  photoPreset('new-fruits-01',        'Fruits 02',              newFruits01),
  photoPreset('new-fruits-02',        'Fruits 03',              newFruits02),
  photoPreset('marche-frais-01',      'Marché frais',           marcheFrais01),
  photoPreset('new-marche-01',        'Marché 02',              newMarche01),
  // Épices & épicerie
  photoPreset('epices-01',            'Épices',                 epices01),
  photoPreset('new-epices-01',        'Épices 02',              newEpices01),
  photoPreset('new-epices-02',        'Épices 03',              newEpices02),
  photoPreset('new-epices-03',        'Épices 04',              newEpices03),
  photoPreset('epicerie-pates-01',    'Épicerie & pâtes',       epiceriePates01),
  photoPreset('new-epicerie-01',      'Épicerie',               newEpicerie01),
  // Surgelés
  photoPreset('surgele-01',           'Surgelé',                surgele01),
  photoPreset('new-surgele-01',       'Surgelé 02',             newSurgele01),
];

export const DEFAULT_SUPPLIER_VISUAL_KEY: SupplierVisualKey = 'grill-braise-03';

export const getSupplierVisual = (key?: string | null): SupplierVisualPreset =>
  SUPPLIER_VISUAL_PRESETS.find((preset) => preset.key === key) ??
  SUPPLIER_VISUAL_PRESETS.find((preset) => preset.key === DEFAULT_SUPPLIER_VISUAL_KEY)!;
