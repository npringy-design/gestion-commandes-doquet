import {
  DOQUET_CONFIG,
  DOQUET_PRODUCTS,
  DOMAFRAIS_BOF_CONFIG,
  DOMAFRAIS_BOF_PRODUCTS,
  DOMAFRAIS_CONFIG,
  DOMAFRAIS_PRODUCTS,
  DOMAFRAIS_SURGELE_CONFIG,
  DOMAFRAIS_SURGELE_PRODUCTS,
  POMONA_EPISAVEURS_CONFIG,
  POMONA_EPISAVEURS_PRODUCTS,
  POMONA_TERRE_AZUR_CONFIG,
  POMONA_TERRE_AZUR_PRODUCTS,
  ProductWithHistory,
  VIANDES_CONFIG,
  VIANDES_PRODUCTS,
  VINS_CONFIG,
  VINS_PRODUCTS,
} from '../data';
import { RESERVED_VIEWS, STORAGE_PREFIX, SupplierId } from '../constants';
import { SupplierConfig } from '../types';

export const nowIso = () => new Date().toISOString();

export const loadState = <T>(key: string, defaultVal: T): T => {
  try {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    return saved ? JSON.parse(saved) : defaultVal;
  } catch {
    return defaultVal;
  }
};

export const saveState = (key: string, value: unknown, onError?: (msg: string) => void): void => {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  } catch (err) {
    const msg = 'Sauvegarde impossible : stockage local plein ou désactivé.';
    if (onError) onError(msg);
    else console.error(msg, err);
  }
};

export const DEFAULT_PRODUCTS: ProductWithHistory[] = [
  ...DOQUET_PRODUCTS,
  ...VINS_PRODUCTS,
  ...VIANDES_PRODUCTS,
  ...DOMAFRAIS_PRODUCTS,
  ...DOMAFRAIS_BOF_PRODUCTS,
  ...DOMAFRAIS_SURGELE_PRODUCTS,
  ...POMONA_TERRE_AZUR_PRODUCTS,
  ...POMONA_EPISAVEURS_PRODUCTS,
];

export const DEFAULT_SUPPLIER_CONFIGS: Record<string, SupplierConfig> = {
  doquet: { ...DOQUET_CONFIG, subtitle: 'Softs • Jus • Cocktails', visualKey: 'new-cocktails-01' },
  vins: { ...VINS_CONFIG, subtitle: 'Cave • Alcools', visualKey: 'new-vins-01' },
  viandes: { ...VIANDES_CONFIG, subtitle: 'Boucherie • Grill', visualKey: 'grill-braise-04' },
  domafrais: { ...DOMAFRAIS_CONFIG, subtitle: 'Viandes • Volailles', visualKey: 'viandes-rustiques-04' },
  domafrais_bof: { ...DOMAFRAIS_BOF_CONFIG, subtitle: 'Crémerie • Fromages', visualKey: 'grill-braise-04' },
  domafrais_surgele: { ...DOMAFRAIS_SURGELE_CONFIG, subtitle: 'Surgelés • Glaces', visualKey: 'surgele-01' },
  pomona_terre_azur: { ...POMONA_TERRE_AZUR_CONFIG, subtitle: 'Fruits • Légumes', visualKey: 'legumes-01' },
  pomona_episaveurs: { ...POMONA_EPISAVEURS_CONFIG, subtitle: 'Épicerie • Aides culinaires', visualKey: 'epicerie-pates-01' },
};

export const mergeSupplierConfigsWithDefaults = (
  incoming: Record<string, SupplierConfig> = {},
): Record<string, SupplierConfig> => {
  const merged: Record<string, SupplierConfig> = {};
  const allIds = Array.from(new Set([
    ...Object.keys(DEFAULT_SUPPLIER_CONFIGS),
    ...Object.keys(incoming),
  ]));

  allIds.forEach((id) => {
    const base = DEFAULT_SUPPLIER_CONFIGS[id];
    const value = incoming[id];
    merged[id] = {
      ...(base ?? value),
      ...(value ?? {}),
    };
  });

  return merged;
};

export const mergeAndNormalizeProducts = (incoming: ProductWithHistory[]): ProductWithHistory[] => {
  const existingIds = new Set(incoming.map((p: ProductWithHistory) => p.id));
  const merged = [...incoming];
  DEFAULT_PRODUCTS.forEach((p) => {
    if (!existingIds.has(p.id)) merged.push(p);
  });

  return merged.map((p: ProductWithHistory) => ({
    ...p,
    stock: p.stock == null || p.stock === 0 ? '' : p.stock,
    upcomingDelivery: p.upcomingDelivery == null || p.upcomingDelivery === 0 ? '' : p.upcomingDelivery,
    targetStock: p.targetStock == null || p.targetStock === 0 ? '' : p.targetStock,
    packaging: !p.packaging || p.packaging === 0 ? 1 : p.packaging,
    importDivisor: !p.importDivisor || p.importDivisor === 0 ? '' : p.importDivisor,
    supplierId: p.supplierId || (DOQUET_PRODUCTS.find((dp) => dp.id === p.id) ? 'doquet' : 'vins'),
  }));
};

export const createInitialProducts = (savedProducts: ProductWithHistory[]): ProductWithHistory[] =>
  mergeAndNormalizeProducts(savedProducts);

export const getSupplierIdForView = (view: string, ratioTab: SupplierId): SupplierId => {
  if (view === 'ratios') return ratioTab;
  if (!RESERVED_VIEWS.has(view as any)) return view;
  return 'doquet';
};

export const getSupplierIdForResetView = (view: string): string | null => {
  if (!RESERVED_VIEWS.has(view as any)) return view;
  return null;
};
