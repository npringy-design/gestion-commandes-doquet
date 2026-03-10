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
  description: string;
  category: string;
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
  description: string,
  category: string,
  imageUrl: string,
  position = 'center center',
): SupplierVisualPreset => ({
  key,
  name,
  description,
  category,
  ...buildPhotoStyle(imageUrl, position),
});

export const SUPPLIER_VISUAL_PRESETS: SupplierVisualPreset[] = [
  photoPreset('softs-cocktails-01', 'Softs & cocktails 01', 'Ambiance bar lumineuse.', 'Boissons', softs01),
  photoPreset('softs-cocktails-02', 'Softs & cocktails 02', 'Version plus serrée et plus chaude.', 'Boissons', softs02),
  photoPreset('bar-ambre-01', 'Bar ambré 01', 'Visuel plus sombre pour bar et cocktails.', 'Boissons', barAmbre01),
  photoPreset('vins-cave-01', 'Vins & cave 01', 'Ambiance cave élégante.', 'Vins & alcools', vins01),
  photoPreset('vins-cave-02', 'Vins & cave 02', 'Version rapprochée pour vins et alcools.', 'Vins & alcools', vins02),
  photoPreset('vins-cave-03', 'Vins & cave 03', 'Verres rouges en ambiance repas.', 'Vins & alcools', vins03),
  photoPreset('premium-sombre-01', 'Premium sombre 01', 'Neutre, élégant et plus discret.', 'Neutre', premiumSombre01),
  photoPreset('boucherie-grill-01', 'Boucherie & grill 01', 'Viandes et braise, style gourmand.', 'Viandes & grill', grill01),
  photoPreset('boucherie-grill-02', 'Boucherie & grill 02', 'Variante plus serrée pour viandes.', 'Viandes & grill', grill02),
  photoPreset('grill-braise-03', 'Grill & braise 03', 'Assortiment grillé chaleureux.', 'Viandes & grill', grill03),
  photoPreset('grill-braise-04', 'Grill & braise 04', 'Brochettes et grillades.', 'Viandes & grill', grill04),
  photoPreset('grill-braise-05', 'Grill & braise 05', 'Visuel braise gourmand.', 'Viandes & grill', grill05),
  photoPreset('viandes-rustiques-03', 'Viandes rustiques 03', 'Belle sélection de viandes rouges.', 'Viandes & grill', viandes03),
  photoPreset('viandes-rustiques-04', 'Viandes rustiques 04', 'Pièces de boeuf au rendu brut.', 'Viandes & grill', viandes04),
  photoPreset('legumes-01', 'Légumes 01', 'Légumes frais sur fond naturel.', 'Fruits & légumes', legumes01),
  photoPreset('legumes-02', 'Légumes 02', 'Composition colorée et lumineuse.', 'Fruits & légumes', legumes02),
  photoPreset('legumes-03', 'Légumes 03', 'Rendu plus premium et varié.', 'Fruits & légumes', legumes03),
  photoPreset('fruits-01', 'Fruits 01', 'Composition verticale fruitée.', 'Fruits & légumes', fruits01),
  photoPreset('fruits-02', 'Fruits 02', 'Couleurs vives et ambiance marché.', 'Fruits & légumes', fruits02),
  photoPreset('marche-frais-01', 'Marché frais 01', 'Étal généreux et chaleureux.', 'Fruits & légumes', marcheFrais01),
  photoPreset('epices-01', 'Épices 01', 'Matières brutes et condiments.', 'Épicerie & épices', epices01),
  photoPreset('epices-02', 'Épices 02', 'Version plus dense et texturée.', 'Épicerie & épices', epices02),
  photoPreset('epicerie-pates-01', 'Épicerie & pâtes 01', 'Univers cuisine et ingrédients secs.', 'Épicerie & épices', epiceriePates01),
  photoPreset('surgele-01', 'Surgelé 01', 'Univers froid et produits surgelés.', 'Surgelés', surgele01),
];

export const DEFAULT_SUPPLIER_VISUAL_KEY: SupplierVisualKey = 'premium-sombre-01';

export const getSupplierVisual = (key?: string | null): SupplierVisualPreset =>
  SUPPLIER_VISUAL_PRESETS.find((preset) => preset.key === key) ??
  SUPPLIER_VISUAL_PRESETS.find((preset) => preset.key === DEFAULT_SUPPLIER_VISUAL_KEY)!;
