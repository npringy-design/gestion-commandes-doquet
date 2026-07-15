// =============================================================
// hooks/useCloudSync.ts
//
// Synchronisation Supabase de l'état global de l'application.
// La synchronisation des lignes de commande est isolée dans useOrderLineSync.
// Le chargement et l'application de app_state sont isolés dans useAppStateHydration.
// La sauvegarde de app_state est isolée dans useAppStatePersistence.
// La connexion Supabase Realtime est isolée dans useCloudRealtime.
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
import {
  flushReliablePendingSaves,
  getReliablePendingSaveCount,
  retryReliablePendingSaves,
  type ReliableSaveFailureReason,
} from '../utils/reliableSaveQueue';
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

type SyncStatus = 'idle' | 'saving' | 'saved' | 'pending' | 'error';

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
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pendingSaveCount, setPendingSaveCount] = useState(() => getReliablePendingSaveCount());

  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHydratingFromCloud = useRef(false);
  const lastCloudUpdatedAtByKey = useRef<Record<string, string>>({});
  const localTsByKey = useRef<Record<string, string>>({});
  const lastPersistedSignatureByKey = useRef<Record<string, string>>({});
  const initialCloudLoadSucceededRef = useRef(false);
  const activeSaveIdsRef = useRef<Set<string>>(new Set());
  const latestSaveTsByIdRef = useRef<Record<string, string>>({});
  const lastSaveToastAtRef = useRef(0);
  const retryInFlightRef = useRef(false);

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

  const clearSyncTimer = useCallback(() => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
  }, []);

  const notifySaveProblem = useCallback((message: string) => {
    const now = Date.now();
    if (now - lastSaveToastAtRef.current < 5000) return;
    lastSaveToastAtRef.current = now;
    onSaveError(message);
  }, [onSaveError]);

  const markSaveStarted = useCallback((id: string, ts: string) => {
    latestSaveTsByIdRef.current[id] = ts;
    activeSaveIdsRef.current.add(id);
    clearSyncTimer();
    setSyncStatus('saving');
  }, [clearSyncTimer]);

  const markSaveConfirmed = useCallback((id: string, confirmedTs: string) => {
    const latestTs = latestSaveTsByIdRef.current[id];
    if (latestTs && confirmedTs < latestTs) return;

    activeSaveIdsRef.current.delete(id);
    const pending = getReliablePendingSaveCount();
    setPendingSaveCount(pending);

    if (pending > 0) {
      setSyncStatus('pending');
      return;
    }
    if (activeSaveIdsRef.current.size > 0) {
      setSyncStatus('saving');
      return;
    }

    setSyncStatus('saved');
    clearSyncTimer();
    syncTimerRef.current = setTimeout(() => {
      syncTimerRef.current = null;
      setSyncStatus('idle');
    }, 1800);
  }, [clearSyncTimer]);

  const markSavePending = useCallback((
    id: string,
    localTs: string,
    pending: number,
    persistedLocally: boolean,
  ) => {
    const latestTs = latestSaveTsByIdRef.current[id];
    if (!latestTs || localTs >= latestTs) activeSaveIdsRef.current.delete(id);
    setPendingSaveCount(pending);
    setSyncStatus(persistedLocally ? 'pending' : 'error');
    notifySaveProblem(
      persistedLocally
        ? 'Sauvegarde non confirmée. La modification est conservée sur cet appareil et sera renvoyée automatiquement.'
        : 'Sauvegarde impossible et stockage local indisponible. Ne fermez pas la page avant le retour de la connexion.',
    );
  }, [notifySaveProblem]);

  const markSaveError = useCallback((
    id: string,
    localTs: string,
    reason: ReliableSaveFailureReason,
    pending: number,
  ) => {
    const latestTs = latestSaveTsByIdRef.current[id];
    if (!latestTs || localTs >= latestTs) activeSaveIdsRef.current.delete(id);
    setPendingSaveCount(pending);
    setSyncStatus(pending > 0 ? 'pending' : 'error');

    if (reason === 'conflict') {
      notifySaveProblem('Une modification plus récente existe déjà. Les données du serveur ont été conservées.');
    } else if (reason === 'storage') {
      notifySaveProblem('La modification ne peut pas être sécurisée localement. Gardez cette page ouverte.');
    } else {
      notifySaveProblem('Erreur de sauvegarde. Une nouvelle tentative sera effectuée automatiquement.');
    }
  }, [notifySaveProblem]);

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

  useEffect(() => {
    const handleHidden = () => {
      if (document.visibilityState === 'hidden') flushReliablePendingSaves();
    };
    document.addEventListener('visibilitychange', handleHidden);
    window.addEventListener('pagehide', flushReliablePendingSaves);
    return () => {
      document.removeEventListener('visibilitychange', handleHidden);
      window.removeEventListener('pagehide', flushReliablePendingSaves);
    };
  }, []);

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
    if (retryInFlightRef.current || !isSupabaseConfigured()) return;
    const queuedBeforeRetry = getReliablePendingSaveCount();
    setPendingSaveCount(queuedBeforeRetry);
    if (queuedBeforeRetry === 0) return;

    retryInFlightRef.current = true;
    clearSyncTimer();
    setSyncStatus('saving');

    try {
      const result = await retryReliablePendingSaves({
        onSaved: (id: string, confirmedTs: string) => {
          if (!confirmRetriedOrderLineSave(id, confirmedTs) && id.startsWith('app:')) {
            const key = id.slice('app:'.length);
            lastCloudUpdatedAtByKey.current[key] = confirmedTs;
            localTsByKey.current[key] = confirmedTs;
          }
          markSaveConfirmed(id, confirmedTs);
        },
        onPending: markSavePending,
        onError: markSaveError,
      });

      setPendingSaveCount(result.pending);
      if (result.saved > 0 || result.discarded > 0) {
        await hydrateFromCloud({ isReconnect: true });
      }
      if (result.pending > 0) setSyncStatus('pending');
    } finally {
      retryInFlightRef.current = false;
    }
  }, [
    clearSyncTimer,
    confirmRetriedOrderLineSave,
    hydrateFromCloud,
    markSaveConfirmed,
    markSaveError,
    markSavePending,
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

  useEffect(() => () => clearSyncTimer(), [clearSyncTimer]);

  return {
    supabaseLoaded,
    syncStatus,
    pendingSaveCount,
    orderLineStates,
    updateOrderLineField,
    deleteOrderLineForProduct,
  };
};
