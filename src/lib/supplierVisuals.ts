import type { CSSProperties } from 'react';

import softs01 from '../assets/supplier-visuals/softs-cocktails-01.jpg';
import softs02 from '../assets/supplier-visuals/softs-cocktails-02.jpg';
import barAmbre01 from '../assets/supplier-visuals/bar-ambre-01.jpg';
import vins01 from '../assets/supplier-visuals/vins-cave-01.jpg';
import vins02 from '../assets/supplier-visuals/vins-cave-02.jpg';
import premiumSombre01 from '../assets/supplier-visuals/premium-sombre-01.jpg';
import grill01 from '../assets/supplier-visuals/boucherie-grill-01.jpg';
import grill02 from '../assets/supplier-visuals/boucherie-grill-02.jpg';

export type SupplierVisualKey =
  | 'softs-cocktails-01'
  | 'softs-cocktails-02'
  | 'bar-ambre-01'
  | 'vins-cave-01'
  | 'vins-cave-02'
  | 'premium-sombre-01'
  | 'boucherie-grill-01'
  | 'boucherie-grill-02';

export interface SupplierVisualPreset {
  key: SupplierVisualKey;
  name: string;
  description: string;
  cardStyle: CSSProperties;
  thumbStyle: CSSProperties;
}

const buildPhotoStyle = (imageUrl: string, position = 'center center') => ({
  cardStyle: {
    backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.12) 42%, rgba(0,0,0,0.78) 100%), url(${imageUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: position,
  } satisfies CSSProperties,
  thumbStyle: {
    backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.28) 100%), url(${imageUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: position,
  } satisfies CSSProperties,
});

const photoPreset = (
  key: SupplierVisualKey,
  name: string,
  description: string,
  imageUrl: string,
  position = 'center center',
): SupplierVisualPreset => ({
  key,
  name,
  description,
  ...buildPhotoStyle(imageUrl, position),
});

export const SUPPLIER_VISUAL_PRESETS: SupplierVisualPreset[] = [
  photoPreset('softs-cocktails-01', 'Softs & cocktails 01', 'Ambiance bar lumineuse.', softs01, 'center center'),
  photoPreset('softs-cocktails-02', 'Softs & cocktails 02', 'Version plus serrée et plus chaude.', softs02, 'center center'),
  photoPreset('bar-ambre-01', 'Bar ambré 01', 'Visuel plus sombre pour bar et cocktails.', barAmbre01, 'center center'),
  photoPreset('vins-cave-01', 'Vins & cave 01', 'Ambiance cave élégante.', vins01, 'center center'),
  photoPreset('vins-cave-02', 'Vins & cave 02', 'Version rapprochée pour vins et alcools.', vins02, 'center center'),
  photoPreset('premium-sombre-01', 'Premium sombre 01', 'Neutre, élégant et plus discret.', premiumSombre01, 'center center'),
  photoPreset('boucherie-grill-01', 'Boucherie & grill 01', 'Viandes et braise, style gourmand.', grill01, 'center center'),
  photoPreset('boucherie-grill-02', 'Boucherie & grill 02', 'Variante plus serrée pour viandes.', grill02, 'center center'),
];

export const DEFAULT_SUPPLIER_VISUAL_KEY: SupplierVisualKey = 'premium-sombre-01';

export const getSupplierVisual = (key?: string | null): SupplierVisualPreset =>
  SUPPLIER_VISUAL_PRESETS.find((preset) => preset.key === key) ??
  SUPPLIER_VISUAL_PRESETS.find((preset) => preset.key === DEFAULT_SUPPLIER_VISUAL_KEY)!;
