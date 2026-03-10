import type { CSSProperties } from 'react';
import softCocktailsImg from '../assets/supplier-visuals/soft-cocktails.png';
import caveVinsImg from '../assets/supplier-visuals/cave-vins.png';
import boucherieGrillImg from '../assets/supplier-visuals/boucherie-grill.png';

export type SupplierVisualKey =
  | 'soft-cocktails'
  | 'soft-amber'
  | 'cave-vins'
  | 'cave-terrasse'
  | 'boucherie-grill'
  | 'viandes-rustiques'
  | 'frais-marche'
  | 'premium-dark';

export interface SupplierVisualPreset {
  key: SupplierVisualKey;
  name: string;
  description: string;
  cardStyle: CSSProperties;
  thumbStyle: CSSProperties;
}

const buildStyle = (
  imageUrl: string,
  overlay: string,
  thumbOverlay: string,
  position = 'center',
  size = 'cover',
): Pick<SupplierVisualPreset, 'cardStyle' | 'thumbStyle'> => ({
  cardStyle: {
    backgroundImage: `${overlay}, url(${imageUrl})`,
    backgroundSize: size,
    backgroundPosition: position,
  },
  thumbStyle: {
    backgroundImage: `${thumbOverlay}, url(${imageUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: position,
  },
});

const photoVisual = (
  key: SupplierVisualKey,
  name: string,
  description: string,
  imageUrl: string,
  overlay: string,
  thumbOverlay: string,
  position = 'center',
): SupplierVisualPreset => ({
  key,
  name,
  description,
  ...buildStyle(imageUrl, overlay, thumbOverlay, position),
});

export const SUPPLIER_VISUAL_PRESETS: SupplierVisualPreset[] = [
  photoVisual(
    'soft-cocktails',
    'Softs & cocktails',
    'Ambiance bar chaude et lumineuse.',
    softCocktailsImg,
    'linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.08) 42%, rgba(0,0,0,0.72) 100%)',
    'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.28) 100%)',
    'center',
  ),
  photoVisual(
    'soft-amber',
    'Bar ambré',
    'Version plus chaude pour boissons et softs.',
    softCocktailsImg,
    'linear-gradient(180deg, rgba(74,28,0,0.02) 0%, rgba(111,55,5,0.10) 28%, rgba(0,0,0,0.68) 100%)',
    'linear-gradient(180deg, rgba(111,55,5,0.10) 0%, rgba(0,0,0,0.34) 100%)',
    'center top',
  ),
  photoVisual(
    'cave-vins',
    'Cave & vins',
    'Visuel cave élégant pour vins et alcools.',
    caveVinsImg,
    'linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(37,8,21,0.10) 40%, rgba(0,0,0,0.72) 100%)',
    'linear-gradient(180deg, rgba(50,12,28,0.10) 0%, rgba(0,0,0,0.30) 100%)',
    'center',
  ),
  photoVisual(
    'cave-terrasse',
    'Verres & terrasse',
    'Plus doux et lumineux pour spiritueux et cave.',
    caveVinsImg,
    'linear-gradient(180deg, rgba(0,0,0,0.00) 0%, rgba(41,17,14,0.10) 38%, rgba(0,0,0,0.70) 100%)',
    'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.28) 100%)',
    'center top',
  ),
  photoVisual(
    'boucherie-grill',
    'Boucherie & grill',
    'Parfait pour viande, grill et découpe.',
    boucherieGrillImg,
    'linear-gradient(180deg, rgba(0,0,0,0.03) 0%, rgba(59,16,6,0.10) 34%, rgba(0,0,0,0.70) 100%)',
    'linear-gradient(180deg, rgba(70,20,7,0.08) 0%, rgba(0,0,0,0.32) 100%)',
    'center',
  ),
  photoVisual(
    'viandes-rustiques',
    'Viandes rustiques',
    'Version plus sombre et premium pour produits carnés.',
    boucherieGrillImg,
    'linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(17,8,5,0.20) 34%, rgba(0,0,0,0.76) 100%)',
    'linear-gradient(180deg, rgba(0,0,0,0.14) 0%, rgba(0,0,0,0.34) 100%)',
    'center top',
  ),
  photoVisual(
    'frais-marche',
    'Frais & marché',
    'Visuel plus naturel pour frais et produits bruts.',
    boucherieGrillImg,
    'linear-gradient(180deg, rgba(0,0,0,0.03) 0%, rgba(10,45,14,0.08) 28%, rgba(0,0,0,0.70) 100%)',
    'linear-gradient(180deg, rgba(10,45,14,0.10) 0%, rgba(0,0,0,0.30) 100%)',
    'left center',
  ),
  photoVisual(
    'premium-dark',
    'Premium sombre',
    'Version neutre et élégante qui garde l’effet photo.',
    caveVinsImg,
    'linear-gradient(180deg, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0.22) 30%, rgba(0,0,0,0.82) 100%)',
    'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.36) 100%)',
    'center',
  ),
];

export const DEFAULT_SUPPLIER_VISUAL_KEY: SupplierVisualKey = 'premium-dark';

export const getSupplierVisual = (key?: string | null): SupplierVisualPreset =>
  SUPPLIER_VISUAL_PRESETS.find((preset) => preset.key === key) ??
  SUPPLIER_VISUAL_PRESETS.find((preset) => preset.key === DEFAULT_SUPPLIER_VISUAL_KEY)!;
