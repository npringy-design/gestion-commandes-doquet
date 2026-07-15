// =============================================================
// hooks/useCloudSync.ts
//
// Synchronisation Supabase de l'état global de l'application.
// La synchronisation des lignes de commande est isolée dans useOrderLineSync.
// Le chargement et l'application de app_state sont isolés dans useAppStateHydration.
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
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { loadAllFromSupabase } from '../utils/supabase';
import {
  flushReliablePendingSaves,
  getReliablePendingSaveCount,
  retryReliablePendingSaves,
  scheduleReliableAppStateSave,
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
import { CURRENT_SITE_ID } from '../constants';
import type { DailyCoversState } from '../utils/dateHelpers';
import { nowIso, removeState } from './appStateHelpers';
import {
  stableStringify,
  type AppStateSetterRegistry,
} from './appStateSyncModel';
import { useAppStateHydration } from './useAppStateHydration';
import { useOrderLineSync } from './useOrderLineSync';

type SyncStatus = 'idle' | 'saving' | 'saved' | 'pending' | 'error';

type PersistedState = {
  covers: Record<string, number>;
  dailyCovers: DailyCoversState;
  detailedInventory: Record<string, string>;
  salesHtByMonth: Record<string, number>;
  costMatterByMonth: Record<string, number>;
  validatedMonths: Record<string, boolean>;
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
};

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

type UseCloudSyncParams = PersistedState & StateSetters & {
  onSaveError: (message: string) => void;
};

const DEFER_WHILE_TYPING = new Set<string>([]);

const REALTIME_KEYS = new Set<string>([
  'deliveryDateBySupplier',
  'nextDeliveryDateBySupplier',
]);

const CLOUD_ONLY_KEYS = new Set<string>([
  'inventory',
  'prepImportsByMonth',
]);

const SAVE_DEBOUNCE_MS_BY_KEY: Record<string, number> = {
  products: 0,
  deliveryDateBySupplier: 1200,
  nextDeliveryDateBySupplier: 1200,
  covers: 2000,
  dailyCovers: 2500,
  salesHtByMonth: 2500,
  costMatterByMonth: 2500,
  validatedMonths: 2000,
  prepValidatedMonths: 2000,
  supplierConfigs: 2500,
  prepItems: 3000,
  prepForecasts: 3000,
  prepSheetStocks: 1200,
  prepBatches: 3500,
  prepImportsByMonth: 5000,
  inventory: 8000,
  orderTemplateRows: 1500,
};

const isUserTyping = (): boolean => {
  const element = document?.activeElement as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return tag === 'INPUT'
    || tag === 'TEXTAREA'
    || tag === 'SELECT'
    || Boolean((element as HTMLElement & { isContentEditable?: boolean }).isContentEditable);
};

const REALTIME_RECONNECT_DELAYS_MS = [2000, 5000, 10000];

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
  const channelRef = useRef<any>(null);
  const channelStatusRef = useRef<'idle' | 'joined' | 'errored'>('idle');
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    CLOUD_ONLY_KEYS.forEach(removeState);
  }, []);

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

  useEffect(() => {
    const client = supabase;
    if (!supabaseLoaded || !isSupabaseConfigured() || !client) return;

    let disposed = false;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (disposed || reconnectTimerRef.current) return;
      const attempt = reconnectAttemptRef.current;
      const delayMs = REALTIME_RECONNECT_DELAYS_MS[
        Math.min(attempt, REALTIME_RECONNECT_DELAYS_MS.length - 1)
      ];
      reconnectAttemptRef.current = attempt + 1;
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        if (!disposed) openChannel();
      }, delayMs);
    };

    const openChannel = () => {
      if (disposed) return;
      if (channelRef.current) {
        void client.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      channelStatusRef.current = 'idle';
      const channel = client
        .channel(`app_state_sync:${CURRENT_SITE_ID}`)
        .on(
          'postgres_changes' as any,
          { event: '*', schema: 'public', table: 'app_state', filter: `site_id=eq.${CURRENT_SITE_ID}` },
          (payload: any) => {
            const row = payload.new as {
              site_id?: string;
              key: string;
              value: unknown;
              updated_at: string;
            } | null;
            if (row?.site_id && row.site_id !== CURRENT_SITE_ID) return;
            if (!row?.key || !row?.updated_at) return;
            handleRealtimeEvent(row.key, row.updated_at, row.value);
          },
        )
        .on(
          'postgres_changes' as any,
          {
            event: '*',
            schema: 'public',
            table: 'order_line_states',
            filter: `site_id=eq.${CURRENT_SITE_ID}`,
          },
          (payload: any) => handleOrderLineRealtimePayload(payload),
        )
        .subscribe((status: string) => {
          if (disposed) return;
          if (status === 'SUBSCRIBED') {
            channelStatusRef.current = 'joined';
            reconnectAttemptRef.current = 0;
            clearReconnectTimer();
            console.log('[Realtime] ✅ Connecté — sync instantanée active');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            channelStatusRef.current = 'errored';
            console.warn(`[Realtime] ⚠️ ${status}, reconnexion programmée...`);
            scheduleReconnect();
          } else if (status === 'CLOSED') {
            channelStatusRef.current = 'idle';
          }
        });

      channelRef.current = channel;
    };

    openChannel();
    window.addEventListener('focusout', flushPending);

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || disposed) return;
      if (channelStatusRef.current !== 'joined') {
        reconnectAttemptRef.current = 0;
        clearReconnectTimer();
        openChannel();
        void hydrateFromCloud({ isReconnect: true });
      }
      if (getReliablePendingSaveCount() > 0) void retryQueuedSaves();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      clearReconnectTimer();
      if (channelRef.current) {
        void client.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      window.removeEventListener('focusout', flushPending);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    supabaseLoaded,
    handleRealtimeEvent,
    handleOrderLineRealtimePayload,
    flushPending,
    hydrateFromCloud,
    retryQueuedSaves,
  ]);

  const persistEverywhere = useCallback((key: string, value: unknown, debounceMs?: number) => {
    const signature = stableStringify(value);
    if (lastPersistedSignatureByKey.current[key] === signature) return;
    if (CLOUD_ONLY_KEYS.has(key) && !initialCloudLoadSucceededRef.current && signature === '{}') return;

    if (isHydratingFromCloud.current || !supabaseLoaded || !isSupabaseConfigured()) {
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
      debounceMs ?? SAVE_DEBOUNCE_MS_BY_KEY[key] ?? 1500,
    );
  }, [markSaveConfirmed, markSaveError, markSavePending, markSaveStarted, supabaseLoaded]);

  useEffect(() => { persistEverywhere('covers', covers); }, [covers, persistEverywhere]);
  useEffect(() => { persistEverywhere('dailyCovers', dailyCovers); }, [dailyCovers, persistEverywhere]);
  useEffect(() => {
    persistEverywhere('inventory', detailedInventory, SAVE_DEBOUNCE_MS_BY_KEY.inventory);
  }, [detailedInventory, persistEverywhere]);
  useEffect(() => { persistEverywhere('salesHtByMonth', salesHtByMonth); }, [persistEverywhere, salesHtByMonth]);
  useEffect(() => { persistEverywhere('costMatterByMonth', costMatterByMonth); }, [costMatterByMonth, persistEverywhere]);
  useEffect(() => { persistEverywhere('validatedMonths', validatedMonths); }, [persistEverywhere, validatedMonths]);
  useEffect(() => { persistEverywhere('prepValidatedMonths', prepValidatedMonths); }, [persistEverywhere, prepValidatedMonths]);
  useEffect(() => { persistEverywhere('supplierConfigs', supplierConfigs); }, [persistEverywhere, supplierConfigs]);
  useEffect(() => {
    persistEverywhere('deliveryDateBySupplier', deliveryDateBySupplier);
  }, [deliveryDateBySupplier, persistEverywhere]);
  useEffect(() => {
    persistEverywhere('nextDeliveryDateBySupplier', nextDeliveryDateBySupplier);
  }, [nextDeliveryDateBySupplier, persistEverywhere]);
  useEffect(() => { persistEverywhere('products', products); }, [persistEverywhere, products]);
  useEffect(() => { persistEverywhere('prepItems', prepItems); }, [persistEverywhere, prepItems]);
  useEffect(() => {
    persistEverywhere('prepImportsByMonth', prepImportsByMonth);
  }, [persistEverywhere, prepImportsByMonth]);
  useEffect(() => { persistEverywhere('prepSheetStocks', prepSheetStocks); }, [persistEverywhere, prepSheetStocks]);
  useEffect(() => { persistEverywhere('prepBatches', prepBatches); }, [persistEverywhere, prepBatches]);
  useEffect(() => { persistEverywhere('prepForecasts', prepForecasts); }, [persistEverywhere, prepForecasts]);
  useEffect(() => {
    persistEverywhere('orderTemplateRows', orderTemplateRows);
  }, [persistEverywhere, orderTemplateRows]);

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
