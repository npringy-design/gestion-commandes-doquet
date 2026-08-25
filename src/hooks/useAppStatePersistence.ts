import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import {
  scheduleReliableAppStateSave,
  type ReliableSaveCallbacks,
} from '../utils/reliableSaveQueue';
import type {
  OrderTemplateRow,
  OrderTemplatesBySupplier,
  PrepBatch,
  PrepForecastsByDate,
  PrepImportsByMonth,
  PrepItem,
  PrepSheetStocks,
  SupplierConfig,
} from '../types';
import type { ProductWithHistory } from '../data';
import type { DailyCoversState, LimonadeCoversState } from '../utils/dateHelpers';
import type {
  RatioProductMonthUnfreezeMap,
  RatioSupplierMonthFreezeMap,
} from '../utils/ratioFreezeModel';
import { nowIso, removeState } from './appStateHelpers';
import { stableStringify } from './appStateSyncModel';
import {
  APP_STATE_SAVE_DEBOUNCE_MS_BY_KEY,
  CLOUD_ONLY_APP_STATE_KEYS,
  getAppStatePersistenceDecision,
  getAppStateSaveDebounceMs,
} from './appStatePersistenceModel';
import {
  createRatioProductTombstone,
  getRatioProductStateKey,
  RATIO_PRODUCT_ORDER_KEY,
} from './ratioProductPersistenceModel';

export type PersistedAppState = {
  covers: Record<string, number>;
  dailyCovers: DailyCoversState;
  limonadeCovers: LimonadeCoversState;
  detailedInventory: Record<string, string>;
  salesHtByMonth: Record<string, number>;
  costMatterByMonth: Record<string, number>;
  validatedMonths: Record<string, boolean>;
  ratioValidatedMonthsBySupplier: RatioSupplierMonthFreezeMap;
  ratioProductUnfrozenMonths: RatioProductMonthUnfreezeMap;
  prepValidatedMonths: Record<string, boolean>;
  supplierConfigs: Record<string, SupplierConfig>;
  deliveryDateBySupplier: Record<string, string>;
  nextDeliveryDateBySupplier: Record<string, string>;
  products: ProductWithHistory[];
  prepItems: PrepItem[];
  prepImportsByMonth: PrepImportsByMonth;
  prepSheetStocks: PrepSheetStocks;
  prepBatches: PrepBatch[];
  prepForecasts: PrepForecastsByDate;
  orderTemplateRows: OrderTemplateRow[];
  orderTemplatesBySupplier: OrderTemplatesBySupplier;
};

type UseAppStatePersistenceParams = PersistedAppState & {
  supabaseLoaded: boolean;
  isHydratingFromCloud: MutableRefObject<boolean>;
  initialCloudLoadSucceededRef: MutableRefObject<boolean>;
  lastCloudUpdatedAtByKey: MutableRefObject<Record<string, string>>;
  localTsByKey: MutableRefObject<Record<string, string>>;
  lastPersistedSignatureByKey: MutableRefObject<Record<string, string>>;
  markSaveStarted: (id: string, ts: string) => void;
  markSaveConfirmed: NonNullable<ReliableSaveCallbacks['onSaved']>;
  markSavePending: NonNullable<ReliableSaveCallbacks['onPending']>;
  markSaveError: NonNullable<ReliableSaveCallbacks['onError']>;
};

// Sauvegarde exclusivement les clés app_state. Les lignes de commande restent
// gérées séparément par useOrderLineSync afin de conserver leur granularité.
export const useAppStatePersistence = ({
  covers,
  dailyCovers,
  limonadeCovers,
  detailedInventory,
  salesHtByMonth,
  costMatterByMonth,
  validatedMonths,
  ratioValidatedMonthsBySupplier,
  ratioProductUnfrozenMonths,
  prepValidatedMonths,
  supplierConfigs,
  deliveryDateBySupplier,
  nextDeliveryDateBySupplier,
  products,
  prepItems,
  prepImportsByMonth,
  prepSheetStocks,
  prepBatches,
  prepForecasts,
  orderTemplateRows,
  orderTemplatesBySupplier,
  supabaseLoaded,
  isHydratingFromCloud,
  initialCloudLoadSucceededRef,
  lastCloudUpdatedAtByKey,
  localTsByKey,
  lastPersistedSignatureByKey,
  markSaveStarted,
  markSaveConfirmed,
  markSavePending,
  markSaveError,
}: UseAppStatePersistenceParams): void => {
  const observedProductSignaturesRef = useRef<Map<string, string> | null>(null);
  const observedProductOrderRef = useRef<string[] | null>(null);

  useEffect(() => {
    CLOUD_ONLY_APP_STATE_KEYS.forEach(removeState);
  }, []);

  const persistAppState = useCallback((key: string, value: unknown, debounceMs?: number) => {
    const signature = stableStringify(value);
    const decision = getAppStatePersistenceDecision({
      key,
      signature,
      lastPersistedSignature: lastPersistedSignatureByKey.current[key],
      initialCloudLoadSucceeded: initialCloudLoadSucceededRef.current,
      isHydratingFromCloud: isHydratingFromCloud.current,
      supabaseLoaded,
      supabaseConfigured: isSupabaseConfigured(),
    });

    if (decision === 'skip' || decision === 'protect-empty') return;
    if (decision === 'remember') {
      lastPersistedSignatureByKey.current[key] = signature;
      return;
    }

    const ts = nowIso();
    const saveId = `app:${key}`;
    localTsByKey.current[key] = ts;
    markSaveStarted(saveId, ts);

    scheduleReliableAppStateSave(
      key,
      value,
      ts,
      (currentKey: string) => lastCloudUpdatedAtByKey.current[currentKey],
      {
        onSaved: (_id: string, confirmedTs: string) => {
          const currentLocalTs = localTsByKey.current[key];
          if (!currentLocalTs || confirmedTs >= currentLocalTs) {
            lastCloudUpdatedAtByKey.current[key] = confirmedTs;
            localTsByKey.current[key] = confirmedTs;
            lastPersistedSignatureByKey.current[key] = signature;
          }
          markSaveConfirmed(saveId, confirmedTs);
        },
        onPending: markSavePending,
        onError: markSaveError,
      },
      getAppStateSaveDebounceMs(key, debounceMs),
    );
  }, [
    initialCloudLoadSucceededRef,
    isHydratingFromCloud,
    lastCloudUpdatedAtByKey,
    lastPersistedSignatureByKey,
    localTsByKey,
    markSaveConfirmed,
    markSaveError,
    markSavePending,
    markSaveStarted,
    supabaseLoaded,
  ]);

  useEffect(() => { persistAppState('covers', covers); }, [covers, persistAppState]);
  useEffect(() => { persistAppState('dailyCovers', dailyCovers); }, [dailyCovers, persistAppState]);
  useEffect(() => { persistAppState('limonadeCovers', limonadeCovers); }, [limonadeCovers, persistAppState]);
  useEffect(() => {
    persistAppState('inventory', detailedInventory, APP_STATE_SAVE_DEBOUNCE_MS_BY_KEY.inventory);
  }, [detailedInventory, persistAppState]);
  useEffect(() => { persistAppState('salesHtByMonth', salesHtByMonth); }, [persistAppState, salesHtByMonth]);
  useEffect(() => { persistAppState('costMatterByMonth', costMatterByMonth); }, [costMatterByMonth, persistAppState]);
  useEffect(() => { persistAppState('validatedMonths', validatedMonths); }, [persistAppState, validatedMonths]);
  useEffect(() => {
    persistAppState('ratioValidatedMonthsBySupplier', ratioValidatedMonthsBySupplier);
  }, [persistAppState, ratioValidatedMonthsBySupplier]);
  useEffect(() => {
    persistAppState('ratioProductUnfrozenMonths', ratioProductUnfrozenMonths);
  }, [persistAppState, ratioProductUnfrozenMonths]);
  useEffect(() => { persistAppState('prepValidatedMonths', prepValidatedMonths); }, [persistAppState, prepValidatedMonths]);
  useEffect(() => { persistAppState('supplierConfigs', supplierConfigs); }, [persistAppState, supplierConfigs]);
  useEffect(() => {
    persistAppState('deliveryDateBySupplier', deliveryDateBySupplier);
  }, [deliveryDateBySupplier, persistAppState]);
  useEffect(() => {
    persistAppState('nextDeliveryDateBySupplier', nextDeliveryDateBySupplier);
  }, [nextDeliveryDateBySupplier, persistAppState]);
  useEffect(() => {
    const currentSignatures = new Map(
      products.map(product => [product.id, stableStringify(product)]),
    );
    const currentOrder = products.map(product => product.id);
    const previousSignatures = observedProductSignaturesRef.current;
    const previousOrder = observedProductOrderRef.current;

    observedProductSignaturesRef.current = currentSignatures;
    observedProductOrderRef.current = currentOrder;

    // Le premier rendu et chaque hydratation cloud servent uniquement de
    // référence. Ils ne doivent jamais réécrire le catalogue complet.
    if (!previousSignatures || !previousOrder || isHydratingFromCloud.current || !supabaseLoaded) return;

    products.forEach(product => {
      if (previousSignatures.get(product.id) === currentSignatures.get(product.id)) return;
      persistAppState(getRatioProductStateKey(product.id), product, 500);
    });

    previousSignatures.forEach((_signature, productId) => {
      if (currentSignatures.has(productId)) return;
      persistAppState(
        getRatioProductStateKey(productId),
        createRatioProductTombstone(productId),
        0,
      );
    });

    const orderChanged = previousOrder.length !== currentOrder.length
      || previousOrder.some((productId, index) => productId !== currentOrder[index]);
    if (orderChanged) persistAppState(RATIO_PRODUCT_ORDER_KEY, currentOrder, 300);
  }, [isHydratingFromCloud, persistAppState, products, supabaseLoaded]);
  useEffect(() => { persistAppState('prepItems', prepItems); }, [persistAppState, prepItems]);
  useEffect(() => {
    persistAppState('prepImportsByMonth', prepImportsByMonth);
  }, [persistAppState, prepImportsByMonth]);
  useEffect(() => { persistAppState('prepSheetStocks', prepSheetStocks); }, [persistAppState, prepSheetStocks]);
  useEffect(() => { persistAppState('prepBatches', prepBatches); }, [persistAppState, prepBatches]);
  useEffect(() => { persistAppState('prepForecasts', prepForecasts); }, [persistAppState, prepForecasts]);
  useEffect(() => {
    persistAppState('orderTemplateRows', orderTemplateRows);
  }, [orderTemplateRows, persistAppState]);
  useEffect(() => {
    persistAppState('orderTemplatesBySupplier', orderTemplatesBySupplier);
  }, [orderTemplatesBySupplier, persistAppState]);
};
