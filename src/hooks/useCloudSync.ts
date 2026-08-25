// =============================================================
// hooks/useCloudSync.ts
//
// Synchronisation Supabase de l'état global de l'application.
// La synchronisation des lignes de commande est isolée dans useOrderLineSync.
// Le chargement et l'application de app_state sont isolés dans useAppStateHydration.
// La sauvegarde de app_state est isolée dans useAppStatePersistence.
// La connexion Supabase Realtime est isolée dans useCloudRealtime.
// Le cycle commun des sauvegardes fiables est isolé dans useReliableSaveLifecycle.
// Le chargement initial et les reprises cloud sont isolés dans useCloudHydrationCoordinator.
// Les événements Realtime app_state sont isolés dans useAppStateRealtimeEvents.
// =============================================================

import {
  useMemo,
  useRef,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type {
  SupplierConfig,
  PrepBatch,
  PrepItem,
  PrepImportsByMonth,
  PrepForecastsByDate,
  PrepSheetStocks,
  OrderTemplateRow,
  OrderTemplatesBySupplier,
} from '../types';
import type { ProductWithHistory } from '../data';
import type { DailyCoversState, LimonadeCoversState } from '../utils/dateHelpers';
import type { AppStateSetterRegistry } from './appStateSyncModel';
import type {
  RatioProductMonthUnfreezeMap,
  RatioSupplierMonthFreezeMap,
} from '../utils/ratioFreezeModel';
import { useAppStateHydration } from './useAppStateHydration';
import { useAppStateRealtimeEvents } from './useAppStateRealtimeEvents';
import {
  useAppStatePersistence,
  type PersistedAppState,
} from './useAppStatePersistence';
import { useCloudHydrationCoordinator } from './useCloudHydrationCoordinator';
import { useCloudRealtime } from './useCloudRealtime';
import { useOrderLineSync } from './useOrderLineSync';
import { useReliableSaveLifecycle } from './useReliableSaveLifecycle';

type StateSetters = {
  setCovers: Dispatch<SetStateAction<Record<string, number>>>;
  setDailyCovers: Dispatch<SetStateAction<DailyCoversState>>;
  setLimonadeCovers: Dispatch<SetStateAction<LimonadeCoversState>>;
  setDetailedInventory: Dispatch<SetStateAction<Record<string, string>>>;
  setSalesHtByMonth: Dispatch<SetStateAction<Record<string, number>>>;
  setCostMatterByMonth: Dispatch<SetStateAction<Record<string, number>>>;
  setValidatedMonths: Dispatch<SetStateAction<Record<string, boolean>>>;
  setRatioValidatedMonthsBySupplier: Dispatch<SetStateAction<RatioSupplierMonthFreezeMap>>;
  setRatioProductUnfrozenMonths: Dispatch<SetStateAction<RatioProductMonthUnfreezeMap>>;
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
  setOrderTemplatesBySupplier: Dispatch<SetStateAction<OrderTemplatesBySupplier>>;
};

type UseCloudSyncParams = PersistedAppState & StateSetters & {
  onSaveError: (message: string) => void;
};

export const useCloudSync = ({
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
  setCovers,
  setDailyCovers,
  setLimonadeCovers,
  setDetailedInventory,
  setSalesHtByMonth,
  setCostMatterByMonth,
  setValidatedMonths,
  setRatioValidatedMonthsBySupplier,
  setRatioProductUnfrozenMonths,
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
  setOrderTemplatesBySupplier,
  onSaveError,
}: UseCloudSyncParams) => {
  const isHydratingFromCloud = useRef(false);
  const lastCloudUpdatedAtByKey = useRef<Record<string, string>>({});
  const localTsByKey = useRef<Record<string, string>>({});
  const lastPersistedSignatureByKey = useRef<Record<string, string>>({});

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
    limonadeCovers: value => setLimonadeCovers(value as LimonadeCoversState),
    inventory: value => setDetailedInventory(value as Record<string, string>),
    salesHtByMonth: value => setSalesHtByMonth(value as Record<string, number>),
    costMatterByMonth: value => setCostMatterByMonth(value as Record<string, number>),
    validatedMonths: value => setValidatedMonths(value as Record<string, boolean>),
    ratioValidatedMonthsBySupplier: value => setRatioValidatedMonthsBySupplier(value as RatioSupplierMonthFreezeMap),
    ratioProductUnfrozenMonths: value => setRatioProductUnfrozenMonths(value as RatioProductMonthUnfreezeMap),
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
    orderTemplatesBySupplier: value => setOrderTemplatesBySupplier(value as OrderTemplatesBySupplier),
  }), [
    setCostMatterByMonth,
    setCovers,
    setDailyCovers,
    setLimonadeCovers,
    setDeliveryDateBySupplier,
    setDetailedInventory,
    setNextDeliveryDateBySupplier,
    setOrderTemplateRows,
    setOrderTemplatesBySupplier,
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
    setRatioValidatedMonthsBySupplier,
    setRatioProductUnfrozenMonths,
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

  const {
    flushPendingAppState,
    handleAppStateRealtimeEvent,
  } = useAppStateRealtimeEvents({
    applyCloudAppStateValue,
    lastCloudUpdatedAtByKey,
    localTsByKey,
  });

  const {
    supabaseLoaded,
    initialCloudLoadSucceededRef,
    hydrateFromCloud,
    retryQueuedSaves,
  } = useCloudHydrationCoordinator({
    hydrateAppStateRows,
    hydrateOrderLineStates,
    confirmRetriedOrderLineSave,
    retryReliableSaves,
  });

  useCloudRealtime({
    enabled: supabaseLoaded,
    onAppStateChange: handleAppStateRealtimeEvent,
    onOrderLineChange: handleOrderLineRealtimePayload,
    flushPendingAppState,
    hydrateFromCloud,
    retryQueuedSaves,
  });

  useAppStatePersistence({
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
