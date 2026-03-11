import type { CSSProperties } from 'react';

import softs01 from '../assets/supplier-visuals/softs-cocktails-01.jpg';
import barAmbre01 from '../assets/supplier-visuals/bar-ambre-01.jpg';
import vins01 from '../assets/supplier-visuals/vins-cave-01.jpg';
import vins02 from '../assets/supplier-visuals/vins-cave-02.jpg';
import premiumSombre01 from '../assets/supplier-visuals/premium-sombre-01.jpg';
import grill01 from '../assets/supplier-visuals/boucherie-grill-01.jpg';

import grill03 from '../assets/supplier-visuals/grill-braise-03.webp';
import viandes03 from '../assets/supplier-visuals/viandes-rustiques-03.webp';
import vins03 from '../assets/supplier-visuals/vins-cave-03.webp';
import epices01 from '../assets/supplier-visuals/epices-01.webp';
import surgele01 from '../assets/supplier-visuals/surgele-01.webp';
import epiceriePates01 from '../assets/supplier-visuals/epicerie-pates-01.webp';
import legumes01 from '../assets/supplier-visuals/legumes-01.webp';
import fruits01 from '../assets/supplier-visuals/fruits-01.webp';
import legumes02 from '../assets/supplier-visuals/legumes-02.webp';
import marcheFrais01 from '../assets/supplier-visuals/marche-frais-01.webp';
import grill04 from '../assets/supplier-visuals/grill-braise-04.webp';
import viandes04 from '../assets/supplier-visuals/viandes-rustiques-04.webp';

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
  photoPreset('softs-cocktails-01', 'Softs & cocktails', softs01),
  photoPreset('bar-ambre-01', 'Bar ambré', barAmbre01),
  photoPreset('vins-cave-01', 'Vins & cave', vins01),
  photoPreset('vins-cave-02', 'Vins & cave 02', vins02),
  photoPreset('vins-cave-03', 'Vins & cave 03', vins03),
  photoPreset('premium-sombre-01', 'Premium sombre', premiumSombre01),
  photoPreset('boucherie-grill-01', 'Boucherie & grill', grill01),
  photoPreset('grill-braise-03', 'Grill & braise', grill03),
  photoPreset('grill-braise-04', 'Grill & braise 04', grill04),
  photoPreset('viandes-rustiques-03', 'Viandes rustiques', viandes03),
  photoPreset('viandes-rustiques-04', 'Viandes rustiques 04', viandes04),
  photoPreset('legumes-01', 'Légumes', legumes01),
  photoPreset('legumes-02', 'Légumes 02', legumes02),
  photoPreset('fruits-01', 'Fruits', fruits01),
  photoPreset('marche-frais-01', 'Marché frais', marcheFrais01),
  photoPreset('epices-01', 'Épices', epices01),
  photoPreset('epicerie-pates-01', 'Épicerie & pâtes', epiceriePates01),
  photoPreset('surgele-01', 'Surgelé', surgele01),
];

export const DEFAULT_SUPPLIER_VISUAL_KEY: SupplierVisualKey = 'premium-sombre-01';

export const getSupplierVisual = (key?: string | null): SupplierVisualPreset =>
  SUPPLIER_VISUAL_PRESETS.find((preset) => preset.key === key) ??
  SUPPLIER_VISUAL_PRESETS.find((preset) => preset.key === DEFAULT_SUPPLIER_VISUAL_KEY)!;
