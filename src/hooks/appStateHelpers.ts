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
import { STORAGE_PREFIX, SupplierId } from '../constants';
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
  doquet: DOQUET_CONFIG,
  vins: VINS_CONFIG,
  viandes: VIANDES_CONFIG,
  domafrais: DOMAFRAIS_CONFIG,
  domafrais_bof: DOMAFRAIS_BOF_CONFIG,
  domafrais_surgele: DOMAFRAIS_SURGELE_CONFIG,
  pomona_terre_azur: POMONA_TERRE_AZUR_CONFIG,
  pomona_episaveurs: POMONA_EPISAVEURS_CONFIG,
};

export const mergeSupplierConfigsWithDefaults = (
  incoming: Record<string, SupplierConfig> = {},
): Record<string, SupplierConfig> => {
  const merged: Record<string, SupplierConfig> = {};
  Object.keys(DEFAULT_SUPPLIER_CONFIGS).forEach((id) => {
    merged[id] = {
      ...DEFAULT_SUPPLIER_CONFIGS[id],
      ...incoming[id],
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
  const viewToSupplier: Record<string, SupplierId> = {
    doquet: 'doquet',
    vins: 'vins',
    viandes: 'viandes',
    domafrais: 'domafrais',
    domafrais_bof: 'domafrais_bof',
    domafrais_surgele: 'domafrais_surgele',
    pomona_terre_azur: 'pomona_terre_azur',
    pomona_episaveurs: 'pomona_episaveurs',
    ratios: ratioTab,
  };
  return viewToSupplier[view] ?? 'doquet';
};

export const getSupplierIdForResetView = (view: string): string | null => {
  const viewToSupplier: Record<string, string> = {
    doquet: 'doquet',
    vins: 'vins',
    viandes: 'viandes',
    domafrais: 'domafrais',
    domafrais_bof: 'domafrais_bof',
    domafrais_surgele: 'domafrais_surgele',
    pomona_terre_azur: 'pomona_terre_azur',
    pomona_episaveurs: 'pomona_episaveurs',
  };
  return viewToSupplier[view] ?? null;
};
