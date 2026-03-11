import type { CSSProperties } from 'react';

// Grillades & viandes
import grill04 from '../assets/supplier-visuals/grill-braise-04.webp';
import viandes04 from '../assets/supplier-visuals/viandes-rustiques-04.webp';
import newGrill01 from '../assets/supplier-visuals/new-grill-01.jpg';
import newGrill02 from '../assets/supplier-visuals/new-grill-02.jpg';
import newViande01 from '../assets/supplier-visuals/new-viande-01.jpg';
import newViande02 from '../assets/supplier-visuals/new-viande-02.jpg';
import newViande03 from '../assets/supplier-visuals/new-viande-03.jpg';
import newViande05 from '../assets/supplier-visuals/new-viande-05.jpg';

// Vins, softs & cocktails
import newVins01 from '../assets/supplier-visuals/new-vins-01.jpg';
import newVins02 from '../assets/supplier-visuals/new-vins-02.jpg';
import newVins03 from '../assets/supplier-visuals/new-vins-03.jpg';
import newCocktails01 from '../assets/supplier-visuals/new-cocktails-01.jpg';
import newSofts01 from '../assets/supplier-visuals/new-softs-01.jpg';
import newSofts02 from '../assets/supplier-visuals/new-softs-02.jpg';
import newSofts03 from '../assets/supplier-visuals/new-softs-03.jpg';

// Légumes & fruits
import legumes01 from '../assets/supplier-visuals/legumes-01.webp';
import legumes02 from '../assets/supplier-visuals/legumes-02.webp';
import newLegumes01 from '../assets/supplier-visuals/new-legumes-01.jpg';
import newLegumes02 from '../assets/supplier-visuals/new-legumes-02.jpg';
import fruits01 from '../assets/supplier-visuals/fruits-01.webp';
import newFruits02 from '../assets/supplier-visuals/new-fruits-02.jpg';
import marcheFrais01 from '../assets/supplier-visuals/marche-frais-01.webp';

// Épices, épicerie & fromage
import epices01 from '../assets/supplier-visuals/epices-01.webp';
import newEpices02 from '../assets/supplier-visuals/new-epices-02.jpg';
import newEpices03 from '../assets/supplier-visuals/new-epices-03.jpg';
import epiceriePates01 from '../assets/supplier-visuals/epicerie-pates-01.webp';
import newEpicerie01 from '../assets/supplier-visuals/new-epicerie-01.jpg';
import newFromage01 from '../assets/supplier-visuals/new-fromage-01.jpg';

// Surgelés
import surgele01 from '../assets/supplier-visuals/surgele-01.webp';
import newSurgele01 from '../assets/supplier-visuals/new-surgele-01.jpg';

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
  // Grillades & viandes
  photoPreset('grill-braise-04',      'Grill brochettes',      grill04),
  photoPreset('new-grill-01',         'Grill kebab',           newGrill01),
  photoPreset('new-grill-02',         'Grill brochette',       newGrill02),
  photoPreset('viandes-rustiques-04', 'Viandes rustiques',     viandes04),
  photoPreset('new-viande-01',        'Viande 01',             newViande01),
  photoPreset('new-viande-02',        'Viande 02',             newViande02),
  photoPreset('new-viande-03',        'Viande 03',             newViande03),
  photoPreset('new-viande-05',        'Viande 05',             newViande05),
  // Vins, softs & cocktails
  photoPreset('new-vins-01',          'Vins 01',               newVins01),
  photoPreset('new-vins-02',          'Vins 02',               newVins02),
  photoPreset('new-vins-03',          'Vins 03',               newVins03),
  photoPreset('new-cocktails-01',     'Cocktails',             newCocktails01),
  photoPreset('new-softs-01',         'Softs 01',              newSofts01),
  photoPreset('new-softs-02',         'Softs 02',              newSofts02),
  photoPreset('new-softs-03',         'Softs 03',              newSofts03),
  // Légumes & fruits
  photoPreset('legumes-01',           'Légumes',               legumes01),
  photoPreset('legumes-02',           'Légumes 02',            legumes02),
  photoPreset('new-legumes-01',       'Légumes 03',            newLegumes01),
  photoPreset('new-legumes-02',       'Légumes 04',            newLegumes02),
  photoPreset('fruits-01',            'Fruits',                fruits01),
  photoPreset('new-fruits-02',        'Fruits 02',             newFruits02),
  photoPreset('marche-frais-01',      'Marché frais',          marcheFrais01),
  // Épices, épicerie & fromage
  photoPreset('epices-01',            'Épices',                epices01),
  photoPreset('new-epices-02',        'Épices 02',             newEpices02),
  photoPreset('new-epices-03',        'Épices 03',             newEpices03),
  photoPreset('epicerie-pates-01',    'Épicerie & pâtes',      epiceriePates01),
  photoPreset('new-epicerie-01',      'Épicerie',              newEpicerie01),
  photoPreset('new-fromage-01',       'Fromage',               newFromage01),
  // Surgelés
  photoPreset('surgele-01',           'Surgelé',               surgele01),
  photoPreset('new-surgele-01',       'Surgelé 02',            newSurgele01),
];

export const DEFAULT_SUPPLIER_VISUAL_KEY: SupplierVisualKey = 'grill-braise-04';

export const getSupplierVisual = (key?: string | null): SupplierVisualPreset =>
  SUPPLIER_VISUAL_PRESETS.find((preset) => preset.key === key) ??
  SUPPLIER_VISUAL_PRESETS.find((preset) => preset.key === DEFAULT_SUPPLIER_VISUAL_KEY)!;
