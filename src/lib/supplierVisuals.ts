import type { CSSProperties } from 'react';

import softs01 from '../assets/supplier-visuals/softs-cocktails-01.jpg';
import softs02 from '../assets/supplier-visuals/softs-cocktails-02.jpg';
import barAmbre01 from '../assets/supplier-visuals/bar-ambre-01.jpg';
import vins01 from '../assets/supplier-visuals/vins-cave-01.jpg';
import vins02 from '../assets/supplier-visuals/vins-cave-02.jpg';
import premiumSombre01 from '../assets/supplier-visuals/premium-sombre-01.jpg';
import grill01 from '../assets/supplier-visuals/boucherie-grill-01.jpg';
import grill02 from '../assets/supplier-visuals/boucherie-grill-02.jpg';

import grill03 from '../assets/supplier-visuals/grill-braise-03.webp';
import viandes03 from '../assets/supplier-visuals/viandes-rustiques-03.webp';
import vins03 from '../assets/supplier-visuals/vins-cave-03.webp';
import epices01 from '../assets/supplier-visuals/epices-01.webp';
import surgele01 from '../assets/supplier-visuals/surgele-01.webp';
import epiceriePates01 from '../assets/supplier-visuals/epicerie-pates-01.webp';
import legumes01 from '../assets/supplier-visuals/legumes-01.webp';
import fruits01 from '../assets/supplier-visuals/fruits-01.webp';
import legumes02 from '../assets/supplier-visuals/legumes-02.webp';
import legumes03 from '../assets/supplier-visuals/legumes-03.webp';
import fruits02 from '../assets/supplier-visuals/fruits-02.webp';
import marcheFrais01 from '../assets/supplier-visuals/marche-frais-01.webp';
import epices02 from '../assets/supplier-visuals/epices-02.webp';
import grill04 from '../assets/supplier-visuals/grill-braise-04.webp';
import viandes04 from '../assets/supplier-visuals/viandes-rustiques-04.webp';
import grill05 from '../assets/supplier-visuals/grill-braise-05.webp';

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
  photoPreset('softs-cocktails-01', 'Softs & cocktails 01', softs01),
  photoPreset('softs-cocktails-02', 'Softs & cocktails 02', softs02),
  photoPreset('bar-ambre-01', 'Bar ambré 01', barAmbre01),
  photoPreset('vins-cave-01', 'Vins & cave 01', vins01),
  photoPreset('vins-cave-03', 'Vins & cave 03', vins03),
  photoPreset('premium-sombre-01', 'Premium sombre 01', premiumSombre01),
  photoPreset('boucherie-grill-01', 'Boucherie & grill 01', grill01),
  photoPreset('boucherie-grill-02', 'Boucherie & grill 02', grill02),
  photoPreset('grill-braise-03', 'Grill & braise 03', grill03),
  photoPreset('viandes-rustiques-04', 'Viandes rustiques 04', viandes04),
  photoPreset('legumes-01', 'Légumes 01', legumes01),
  photoPreset('legumes-03', 'Légumes 03', legumes03),
  photoPreset('fruits-01', 'Fruits 01', fruits01),
  photoPreset('marche-frais-01', 'Marché frais 01', marcheFrais01),
  photoPreset('epices-01', 'Épices 01', epices01),
  photoPreset('epicerie-pates-01', 'Épicerie & pâtes 01', epiceriePates01),
  photoPreset('surgele-01', 'Surgelé 01', surgele01),
  photoPreset('vins-cave-02', 'Vins & cave 02', vins02),
  photoPreset('viandes-rustiques-03', 'Viandes rustiques 03', viandes03),
  photoPreset('legumes-02', 'Légumes 02', legumes02),
  photoPreset('fruits-02', 'Fruits 02', fruits02),
  photoPreset('epices-02', 'Épices 02', epices02),
  photoPreset('grill-braise-04', 'Grill & braise 04', grill04),
  photoPreset('grill-braise-05', 'Grill & braise 05', grill05),
];

export const DEFAULT_SUPPLIER_VISUAL_KEY: SupplierVisualKey = 'premium-sombre-01';

export const getSupplierVisual = (key?: string | null): SupplierVisualPreset =>
  SUPPLIER_VISUAL_PRESETS.find((preset) => preset.key === key) ??
  SUPPLIER_VISUAL_PRESETS.find((preset) => preset.key === DEFAULT_SUPPLIER_VISUAL_KEY)!;
