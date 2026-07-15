// =============================================================
// hooks/useCloudSync.ts
//
// Synchronisation Supabase de l'état global de l'application.
// La synchronisation des lignes de commande est isolée dans useOrderLineSync.
// Le chargement et l'application de app_state sont isolés dans useAppStateHydration.
// La sauvegarde de app_state est isolée dans useAppStatePersistence.
// La connexion Supabase Realtime est isolée dans useCloudRealtime.
// Le cycle commun des sauvegardes fiables est isolé dans useReliableSaveLifecycle.
// =============================================================

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { loadAllFromSupabase } from '../utils/supabase';
import type {
  OrderState,
  SupplierConfig,
  PrepBatch,
  PrepItem,
  PrepImportsByMonth,
  PrepForecastsByDate,
  PrepSheetStocks,
  OrderTemplateRow,
} from '../types';
import type { ProductWithHistory } from '../data';
import type { DailyCoversState } from '../utils/dateHelpers';
import type { AppStateSetterRegistry } from './appStateSyncModel';
import { useAppStateHydration } from './useAppStateHydration';
import {
  useAppStatePersistence,
  type PersistedAppState,
} from './useAppStatePersistence';
import { useCloudRealtime } from './useCloudRealtime';
import { useOrderLineSync } from './useOrderLineSync';
import { useReliableSaveLifecycle } from './useReliableSaveLifecycle';

type StateSetters = {
  setCovers: Dispatch<SetStateAction<Record<string, number>>>;
  setDailyCovers: Dispatch<SetStateAction<DailyCoversState>>;
  setDetailedInventory: Dispatch<SetStateAction<Record<string, string>>>;
  setSalesHtByMonth: Dispatch<SetStateAction<Record<string, number>>>;
  setCostMatterByMonth: Dispatch<SetStateAction<Record<string, number>>>;
  setValidatedMonths: Dispatch<SetStateAction<Record<string, boolean>>>;
  setPrepValidatedMonths: Dispatch<SetStateAction<Record<string, boolean>>>;
  setSupplierConfigs: Dispatch<SetStateAction<Record<string, SupplierConfig>>>;
  setDeliveryDateBySupplier: Dispatch<SetStateAction<Record<string, string>>>;
  setNextDeliveryDateBySupplier: Dispatch<SetStateAction<Record<string, string>>>;
  setProducts: Dispatch<SetStateAction<ProductWithHistory[]>>;
  setPrepItems: Dispatch<SetStateAction<PrepItem[]>>;
  setPrepImportsByMonth: Dispatch<SetStateAction<PrepImportsByMonth>>;
  setPrepSheetStocks: Dispatch<SetStateAction<PrepSheetStocks>>;
  setPrepBatches: Dispatch<SetStateAction<PrepBatch[]>>;
  setPrepForecasts: Dispatch<SetStateAction<PrepForecastsByDate>>;
  setOrderTemplateRows: Dispatch<SetStateAction<OrderTemplateRow[]>>;
};

type UseCloudSyncParams = PersistedAppState & StateSetters & {
  onSaveError: (message: string) => void;
};

const DEFER_WHILE_TYPING = new Set<string>([]);

const REALTIME_KEYS = new Set<string>([
  'deliveryDateBySupplier',
  'nextDeliveryDateBySupplier',
]);

const isUserTyping = (): boolean => {
  const element = document?.activeElement as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return tag === 'INPUT'
    || tag === 'TEXTAREA'
    || tag === 'SELECT'
    || Boolean((element as HTMLElement & { isContentEditable?: boolean }).isContentEditable);
};

export const useCloudSync = ({
  covers,
  dailyCovers,
  detailedInventory,
  salesHtByMonth,
  costMatterByMonth,
  validatedMonths,
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
  setCovers,
  setDailyCovers,
  setDetailedInventory,
  setSalesHtByMonth,
  setCostMatterByMonth,
  setValidatedMonths,
  setPrepValidatedMonths,
  setSupplierConfigs,
  setDeliveryDateBySupplier,
  setNextDeliveryDateBySupplier,
  setProducts,
  setPrepItems,
  setPrepImportsByMonth,
  setPrepSheetStocks,
  setPrepBatches,
  setPrepForecasts,
  setOrderTemplateRows,
  onSaveError,
}: UseCloudSyncParams) => {
  const [supabaseLoaded, setSupabaseLoaded] = useState(false);
  const isHydratingFromCloud = useRef(false);
  const lastCloudUpdatedAtByKey = useRef<Record<string, string>>({});
  const localTsByKey = useRef<Record<string, string>>({});
  const lastPersistedSignatureByKey = useRef<Record<string, string>>({});
  const initialCloudLoadSucceededRef = useRef(false);

  const {
    syncStatus,
    pendingSaveCount,
    markSaveStarted,
    markSaveConfirmed,
    markSavePending,
    markSaveError,
    retryReliableSaves,
  } = useReliableSaveLifecycle({
    onSaveError,
    lastCloudUpdatedAtByKey,
    localTsByKey,
  });

  const appStateSetters = useMemo<AppStateSetterRegistry>(() => ({
    covers: value => setCovers(value as Record<string, number>),
    dailyCovers: value => setDailyCovers(value as DailyCoversState),
    inventory: value => setDetailedInventory(value as Record<string, string>),
    salesHtByMonth: value => setSalesHtByMonth(value as Record<string, number>),
    costMatterByMonth: value => setCostMatterByMonth(value as Record<string, number>),
    validatedMonths: value => setValidatedMonths(value as Record<string, boolean>),
    prepValidatedMonths: value => setPrepValidatedMonths(value as Record<string, boolean>),
    supplierConfigs: value => setSupplierConfigs(value as Record<string, SupplierConfig>),
    deliveryDateBySupplier: value => setDeliveryDateBySupplier(value as Record<string, string>),
    nextDeliveryDateBySupplier: value => setNextDeliveryDateBySupplier(value as Record<string, string>),
    products: value => setProducts(value as ProductWithHistory[]),
    prepItems: value => setPrepItems(value as PrepItem[]),
    prepImportsByMonth: value => setPrepImportsByMonth(value as PrepImportsByMonth),
    prepSheetStocks: value => setPrepSheetStocks(value as PrepSheetStocks),
    prepBatches: value => setPrepBatches(value as PrepBatch[]),
    prepForecasts: value => setPrepForecasts(value as PrepForecastsByDate),
    orderTemplateRows: value => setOrderTemplateRows(value as OrderTemplateRow[]),
  }), [
    setCostMatterByMonth,
    setCovers,
    setDailyCovers,
    setDeliveryDateBySupplier,
    setDetailedInventory,
    setNextDeliveryDateBySupplier,
    setOrderTemplateRows,
    setPrepBatches,
    setPrepForecasts,
    setPrepImportsByMonth,
    setPrepItems,
    setPrepSheetStocks,
    setPrepValidatedMonths,
    setProducts,
    setSalesHtByMonth,
    setSupplierConfigs,
    setValidatedMonths,
  ]);

  const {
    applyCloudAppStateValue,
    hydrateAppStateRows,
  } = useAppStateHydration({
    setters: appStateSetters,
    isHydratingFromCloud,
    lastCloudUpdatedAtByKey,
    localTsByKey,
    lastPersistedSignatureByKey,
  });

  const {
    orderLineStates,
    updateOrderLineField,
    deleteOrderLineForProduct,
    hydrateOrderLineStates,
    confirmRetriedOrderLineSave,
    handleOrderLineRealtimePayload,
  } = useOrderLineSync({
    markSaveStarted,
    markSaveConfirmed,
    markSavePending,
    markSaveError,
  });

  const pendingRealtimeRef = useRef<Map<string, { ts: string; value: unknown }>>(new Map());

  const flushPending = useCallback(() => {
    if (pendingRealtimeRef.current.size === 0) return;
    setTimeout(() => {
      if (isUserTyping()) return;
      pendingRealtimeRef.current.forEach(({ ts, value }, key) => {
        applyCloudAppStateValue(key, ts, value);
      });
      pendingRealtimeRef.current.clear();
    }, 150);
  }, [applyCloudAppStateValue]);

  const handleRealtimeEvent = useCallback((key: string, cloudTs: string, value: unknown) => {
    if (!REALTIME_KEYS.has(key)) return;

    const localTs = localTsByKey.current[key];
    if (localTs && localTs >= cloudTs) return;
    lastCloudUpdatedAtByKey.current[key] = cloudTs;

    if (DEFER_WHILE_TYPING.has(key) && isUserTyping()) {
      const existing = pendingRealtimeRef.current.get(key);
      if (!existing || cloudTs > existing.ts) {
        pendingRealtimeRef.current.set(key, { ts: cloudTs, value });
      }
      return;
    }

    applyCloudAppStateValue(key, cloudTs, value);
  }, [applyCloudAppStateValue]);

  const hydrateFromCloud = useCallback(async (options: { isReconnect?: boolean } = {}) => {
    if (!isSupabaseConfigured()) {
      setSupabaseLoaded(true);
      return;
    }

    try {
      const cloud = await loadAllFromSupabase();
      initialCloudLoadSucceededRef.current = cloud !== null;
      const cloudValues = hydrateAppStateRows(cloud);

      await hydrateOrderLineStates({
        isReconnect: options.isReconnect,
        legacyProducts: cloudValues.products as ProductWithHistory[] | undefined,
        legacyOrderStates: cloudValues.orderStates as Record<string, OrderState> | undefined,
      });
    } catch (error) {
      console.error('[Supabase load exception]', error);
    } finally {
      setSupabaseLoaded(true);
    }
  }, [hydrateAppStateRows, hydrateOrderLineStates]);

  useEffect(() => {
    void hydrateFromCloud();
  }, [hydrateFromCloud]);

  const retryQueuedSaves = useCallback(async () => {
    await retryReliableSaves({
      confirmRetriedOrderLineSave,
      hydrateFromCloud,
    });
  }, [
    confirmRetriedOrderLineSave,
    hydrateFromCloud,
    retryReliableSaves,
  ]);

  useEffect(() => {
    if (!supabaseLoaded || !isSupabaseConfigured()) return;
    void retryQueuedSaves();
    const handleOnline = () => { void retryQueuedSaves(); };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [retryQueuedSaves, supabaseLoaded]);

  useCloudRealtime({
    enabled: supabaseLoaded,
    onAppStateChange: handleRealtimeEvent,
    onOrderLineChange: handleOrderLineRealtimePayload,
    flushPendingAppState: flushPending,
    hydrateFromCloud,
    retryQueuedSaves,
  });

  useAppStatePersistence({
    covers,
    dailyCovers,
    detailedInventory,
    salesHtByMonth,
    costMatterByMonth,
    validatedMonths,
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
  });

  return {
    supabaseLoaded,
    syncStatus,
    pendingSaveCount,
    orderLineStates,
    updateOrderLineField,
    deleteOrderLineForProduct,
  };
};
