import type { ProductWithHistory } from '../data';
import type { SupplierConfig } from '../types';
import type { DailyCoversState } from '../utils/dateHelpers';
import {
  mergeAndNormalizeProducts,
  mergeSupplierConfigsWithDefaults,
} from './appStateHelpers';
import { materializeGranularRatioProducts } from './ratioProductPersistenceModel';

export type WritableAppStateKey =
  | 'covers'
  | 'dailyCovers'
  | 'inventory'
  | 'salesHtByMonth'
  | 'costMatterByMonth'
  | 'validatedMonths'
  | 'ratioValidatedMonthsBySupplier'
  | 'ratioProductUnfrozenMonths'
  | 'prepValidatedMonths'
  | 'supplierConfigs'
  | 'deliveryDateBySupplier'
  | 'nextDeliveryDateBySupplier'
  | 'products'
  | 'prepItems'
  | 'prepImportsByMonth'
  | 'prepSheetStocks'
  | 'prepBatches'
  | 'prepForecasts'
  | 'orderTemplateRows'
  | 'orderTemplatesBySupplier';

export type AppStateCloudRow = {
  key: string;
  value: unknown;
  updated_at: string;
};

export type AppStateSnapshot = {
  values: Record<string, unknown>;
  updatedAtByKey: Record<string, string>;
  signaturesByKey: Record<string, string>;
};

export type AppStateSetterRegistry = Partial<
  Record<WritableAppStateKey, (value: unknown) => void>
>;

const WRITABLE_APP_STATE_KEYS: readonly WritableAppStateKey[] = [
  'covers',
  'dailyCovers',
  'inventory',
  'salesHtByMonth',
  'costMatterByMonth',
  'validatedMonths',
  'ratioValidatedMonthsBySupplier',
  'ratioProductUnfrozenMonths',
  'prepValidatedMonths',
  'supplierConfigs',
  'deliveryDateBySupplier',
  'nextDeliveryDateBySupplier',
  'products',
  'prepItems',
  'prepImportsByMonth',
  'prepSheetStocks',
  'prepBatches',
  'prepForecasts',
  'orderTemplateRows',
  'orderTemplatesBySupplier',
];

export const stableStringify = (value: unknown): string => {
  const seen = new WeakSet<object>();
  const normalize = (input: unknown): unknown => {
    if (input === null || typeof input !== 'object') return input;
    if (input instanceof Date) return input.toISOString();
    if (Array.isArray(input)) return input.map(normalize);
    if (seen.has(input as object)) return '[Circular]';
    seen.add(input as object);
    return Object.keys(input as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalize((input as Record<string, unknown>)[key]);
        return acc;
      }, {});
  };

  try {
    return JSON.stringify(normalize(value));
  } catch {
    return String(value);
  }
};

export const buildAppStateSnapshot = (
  rows: AppStateCloudRow[] | null | undefined,
  localTsByKey: Record<string, string>,
): AppStateSnapshot => {
  const snapshot: AppStateSnapshot = {
    values: {},
    updatedAtByKey: {},
    signaturesByKey: {},
  };

  if (!rows?.length) return snapshot;

  rows.forEach(row => {
    if (!row?.key || !row.updated_at) return;
    const localTs = localTsByKey[row.key];
    if (localTs && localTs > row.updated_at) return;

    snapshot.values[row.key] = row.value;
    snapshot.updatedAtByKey[row.key] = row.updated_at;
    snapshot.signaturesByKey[row.key] = stableStringify(row.value);
  });

  return snapshot;
};

const hasDailyCoverData = (state: DailyCoversState): boolean =>
  Object.values(state).some(
    month => Array.isArray(month) && month.some(day => day.midi !== '' && day.midi !== 0),
  );

const normalizeAppStateValue = (key: WritableAppStateKey, value: unknown): unknown => {
  if (key === 'products') {
    return mergeAndNormalizeProducts(value as ProductWithHistory[]);
  }
  if (key === 'supplierConfigs') {
    return mergeSupplierConfigsWithDefaults(value as Record<string, SupplierConfig>);
  }
  return value;
};

export const applyAppStateValues = (
  values: Record<string, unknown>,
  setters: AppStateSetterRegistry,
): WritableAppStateKey[] => {
  const applied: WritableAppStateKey[] = [];
  const materializedValues = materializeGranularRatioProducts(values);

  WRITABLE_APP_STATE_KEYS.forEach(key => {
    if (!Object.prototype.hasOwnProperty.call(materializedValues, key)) return;
    if (key === 'dailyCovers' && !hasDailyCoverData(materializedValues[key] as DailyCoversState)) return;

    const setter = setters[key];
    if (!setter) return;

    setter(normalizeAppStateValue(key, materializedValues[key]));
    applied.push(key);
  });

  return applied;
};
