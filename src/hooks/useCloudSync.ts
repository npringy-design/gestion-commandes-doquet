// =============================================================
// hooks/useCloudSync.ts
//
// Synchronisation Supabase : chargement initial, sauvegardes fiables,
// rattrapage des écritures en attente et Realtime limité aux commandes.
// =============================================================

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import {
  loadAllFromSupabase,
  loadOrderLineStates,
  deleteOrderLineState,
  OrderLineStateFields,
  OrderLineStateRow,
} from '../utils/supabase';
import {
  flushReliablePendingSaves,
  getReliablePendingSaveCount,
  retryReliablePendingSaves,
  scheduleReliableAppStateSave,
  scheduleReliableOrderLineSave,
  type ReliableSaveFailureReason,
} from '../utils/reliableSaveQueue';
import { OrderState, OrderLineState, OrderLineField, SupplierConfig, PrepBatch, PrepItem, PrepImportsByMonth, PrepForecastsByDate, PrepSheetStocks, OrderTemplateRow } from '../types';
import { ProductWithHistory } from '../data';
import { CURRENT_SITE_ID } from '../constants';
import { DailyCoversState } from '../utils/dateHelpers';
import {
  mergeAndNormalizeProducts,
  mergeSupplierConfigsWithDefaults,
  nowIso,
  removeState,
} from './appStateHelpers';

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

type UseCloudSyncParams = PersistedState &
  StateSetters & {
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

const ORDER_LINE_FIELD_TO_COLUMN: Record<OrderLineField, keyof OrderLineStateFields> = {
  stock: 'stock',
  upcomingDelivery: 'upcoming_delivery',
  targetStock: 'target_stock',
  packaging: 'packaging',
  margin: 'margin',
};

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

const stableStringify = (value: unknown): string => {
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

const hasDailyCoverData = (state: DailyCoversState): boolean =>
  Object.values(state).some(
    month => Array.isArray(month) && month.some(day => day.midi !== '' && day.midi !== 0)
  );

const isUserTyping = (): boolean => {
  const el = document?.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean((el as any).isContentEditable);
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

  const markSavePending = useCallback((id: string, localTs: string, pending: number, persistedLocally: boolean) => {
    const latestTs = latestSaveTsByIdRef.current[id];
    if (!latestTs || localTs >= latestTs) activeSaveIdsRef.current.delete(id);
    setPendingSaveCount(pending);
    setSyncStatus(persistedLocally ? 'pending' : 'error');
    notifySaveProblem(
      persistedLocally
        ? 'Sauvegarde non confirmée. La modification est conservée sur cet appareil et sera renvoyée automatiquement.'
        : 'Sauvegarde impossible et stockage local indisponible. Ne fermez pas la page avant le retour de la connexion.'
    );
  }, [notifySaveProblem]);

  const markSaveError = useCallback((id: string, localTs: string, reason: ReliableSaveFailureReason, pending: number) => {
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

  const [orderLineStates, setOrderLineStates] = useState<Record<string, OrderLineState>>({});
  const orderLineLocalTsByProductId = useRef<Record<string, string>>({});
  const orderLineCloudTsByProductId = useRef<Record<string, string>>({});

  const applyOrderLineRows = useCallback((rows: OrderLineStateRow[]) => {
    if (rows.length === 0) return;
    setOrderLineStates(prev => {
      const next = { ...prev };
      rows.forEach(row => {
        const localTs = orderLineLocalTsByProductId.current[row.product_id];
        if (localTs && localTs > row.updated_at) return;
        orderLineCloudTsByProductId.current[row.product_id] = row.updated_at;
        next[row.product_id] = {
          stock: row.stock ?? '',
          upcomingDelivery: row.upcoming_delivery ?? '',
          targetStock: row.target_stock ?? '',
          packaging: row.packaging ?? '',
          margin: row.margin ?? undefined,
          updatedAt: row.updated_at,
        };
      });
      return next;
    });
  }, []);

  const removeOrderLineRowLocally = useCallback((productId: string) => {
    setOrderLineStates(prev => {
      if (!(productId in prev)) return prev;
      const next = { ...prev };
      delete next[productId];
      return next;
    });
    delete orderLineLocalTsByProductId.current[productId];
    delete orderLineCloudTsByProductId.current[productId];
  }, []);

  const updateOrderLineField = useCallback((productId: string, field: OrderLineField, value: number | '') => {
    const ts = nowIso();
    const saveId = `order:${productId}`;
    orderLineLocalTsByProductId.current[productId] = ts;
    setOrderLineStates(prev => ({
      ...prev,
      [productId]: { ...prev[productId], [field]: value, updatedAt: ts },
    }));

    if (!isSupabaseConfigured()) return;
    markSaveStarted(saveId, ts);
    const column = ORDER_LINE_FIELD_TO_COLUMN[field];
    scheduleReliableOrderLineSave(
      productId,
      { [column]: value === '' ? null : Number(value) } as OrderLineStateFields,
      ts,
      {
        onSaved: (_id, confirmedTs) => {
          orderLineCloudTsByProductId.current[productId] = confirmedTs;
          markSaveConfirmed(saveId, confirmedTs);
        },
        onPending: markSavePending,
        onError: markSaveError,
      },
    );
  }, [markSaveConfirmed, markSaveError, markSavePending, markSaveStarted]);

  const deleteOrderLineForProduct = useCallback((productId: string) => {
    removeOrderLineRowLocally(productId);
    if (isSupabaseConfigured()) void deleteOrderLineState(productId);
  }, [removeOrderLineRowLocally]);

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

  const applyCloudKey = useCallback((key: string, cloudTs: string, value: unknown) => {
    const localTs = localTsByKey.current[key];
    if (localTs && localTs > cloudTs) return;

    isHydratingFromCloud.current = true;

    switch (key) {
      case 'covers':
        setCovers(value as Record<string, number>);
        break;
      case 'dailyCovers': {
        const next = value as DailyCoversState;
        if (hasDailyCoverData(next)) setDailyCovers(next);
        break;
      }
      case 'inventory':
        setDetailedInventory(value as Record<string, string>);
        break;
      case 'salesHtByMonth':
        setSalesHtByMonth(value as Record<string, number>);
        break;
      case 'costMatterByMonth':
        setCostMatterByMonth(value as Record<string, number>);
        break;
      case 'validatedMonths':
        setValidatedMonths(value as Record<string, boolean>);
        break;
      case 'prepValidatedMonths':
        setPrepValidatedMonths(value as Record<string, boolean>);
        break;
      case 'supplierConfigs':
        setSupplierConfigs(mergeSupplierConfigsWithDefaults(value as Record<string, SupplierConfig>));
        break;
      case 'deliveryDateBySupplier':
        setDeliveryDateBySupplier(value as Record<string, string>);
        break;
      case 'nextDeliveryDateBySupplier':
        setNextDeliveryDateBySupplier(value as Record<string, string>);
        break;
      case 'products':
        setProducts(mergeAndNormalizeProducts(value as ProductWithHistory[]));
        break;
      case 'prepItems':
        setPrepItems(value as PrepItem[]);
        break;
      case 'prepImportsByMonth':
        setPrepImportsByMonth(value as PrepImportsByMonth);
        break;
      case 'prepSheetStocks':
        setPrepSheetStocks(value as PrepSheetStocks);
        break;
      case 'prepBatches':
        setPrepBatches(value as PrepBatch[]);
        break;
      case 'prepForecasts':
        setPrepForecasts(value as PrepForecastsByDate);
        break;
      case 'orderTemplateRows':
        setOrderTemplateRows(value as OrderTemplateRow[]);
        break;
      default:
        break;
    }

    setTimeout(() => { isHydratingFromCloud.current = false; }, 200);
  }, [
    setCostMatterByMonth, setCovers, setDailyCovers,
    setDeliveryDateBySupplier, setDetailedInventory,
    setNextDeliveryDateBySupplier,
    setProducts, setPrepItems, setPrepImportsByMonth, setPrepSheetStocks, setPrepBatches,
    setPrepForecasts, setOrderTemplateRows, setSalesHtByMonth, setSupplierConfigs,
    setValidatedMonths, setPrepValidatedMonths,
  ]);

  const flushPending = useCallback(() => {
    if (pendingRealtimeRef.current.size === 0) return;
    setTimeout(() => {
      if (isUserTyping()) return;
      pendingRealtimeRef.current.forEach(({ ts, value }, key) => {
        lastCloudUpdatedAtByKey.current[key] = ts;
        applyCloudKey(key, ts, value);
      });
      pendingRealtimeRef.current.clear();
    }, 150);
  }, [applyCloudKey]);

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

    applyCloudKey(key, cloudTs, value);
  }, [applyCloudKey]);

  const hydrateFromCloud = useCallback(async (options: { isReconnect?: boolean } = {}) => {
    if (!isSupabaseConfigured()) {
      setSupabaseLoaded(true);
      return;
    }

    try {
      const cloud = await loadAllFromSupabase();
      initialCloudLoadSucceededRef.current = cloud !== null;

      if (cloud && cloud.length > 0) {
        isHydratingFromCloud.current = true;
        const cloudMap: Record<string, unknown> = {};

        cloud.forEach((row: any) => {
          const localTs = localTsByKey.current[row.key];
          if (localTs && localTs > row.updated_at) return;
          lastCloudUpdatedAtByKey.current[row.key] = row.updated_at;
          lastPersistedSignatureByKey.current[row.key] = stableStringify(row.value);
          cloudMap[row.key] = row.value;
        });

        if (cloudMap.covers) setCovers(cloudMap.covers as Record<string, number>);
        if (cloudMap.dailyCovers && hasDailyCoverData(cloudMap.dailyCovers as DailyCoversState)) {
          setDailyCovers(cloudMap.dailyCovers as DailyCoversState);
        }
        if (cloudMap.inventory) setDetailedInventory(cloudMap.inventory as Record<string, string>);
        if (cloudMap.salesHtByMonth) setSalesHtByMonth(cloudMap.salesHtByMonth as Record<string, number>);
        if (cloudMap.costMatterByMonth) setCostMatterByMonth(cloudMap.costMatterByMonth as Record<string, number>);
        if (cloudMap.validatedMonths) setValidatedMonths(cloudMap.validatedMonths as Record<string, boolean>);
        if (cloudMap.prepValidatedMonths) setPrepValidatedMonths(cloudMap.prepValidatedMonths as Record<string, boolean>);
        if (cloudMap.supplierConfigs) {
          setSupplierConfigs(mergeSupplierConfigsWithDefaults(cloudMap.supplierConfigs as Record<string, SupplierConfig>));
        }
        if (cloudMap.deliveryDateBySupplier) setDeliveryDateBySupplier(cloudMap.deliveryDateBySupplier as Record<string, string>);
        if (cloudMap.nextDeliveryDateBySupplier) setNextDeliveryDateBySupplier(cloudMap.nextDeliveryDateBySupplier as Record<string, string>);
        if (cloudMap.products) setProducts(mergeAndNormalizeProducts(cloudMap.products as ProductWithHistory[]));
        if (cloudMap.prepItems) setPrepItems(cloudMap.prepItems as PrepItem[]);
        if (cloudMap.prepImportsByMonth) setPrepImportsByMonth(cloudMap.prepImportsByMonth as PrepImportsByMonth);
        if (cloudMap.prepSheetStocks) setPrepSheetStocks(cloudMap.prepSheetStocks as PrepSheetStocks);
        if (cloudMap.prepBatches) setPrepBatches(cloudMap.prepBatches as PrepBatch[]);
        if (cloudMap.prepForecasts) setPrepForecasts(cloudMap.prepForecasts as PrepForecastsByDate);
        if (cloudMap.orderTemplateRows) setOrderTemplateRows(cloudMap.orderTemplateRows as OrderTemplateRow[]);

        setTimeout(() => { isHydratingFromCloud.current = false; }, 600);
      }

      const orderLineRows = await loadOrderLineStates();
      if (orderLineRows && orderLineRows.length > 0) {
        applyOrderLineRows(orderLineRows);
      } else if (!options.isReconnect) {
        const legacyProducts = cloud?.find(row => row.key === 'products')?.value as ProductWithHistory[] | undefined;
        const legacyOrderStates = cloud?.find(row => row.key === 'orderStates')?.value as Record<string, OrderState> | undefined;
        if (legacyProducts && legacyProducts.length > 0) {
          const legacyMap: Record<string, OrderLineState> = {};
          legacyProducts.forEach(p => {
            legacyMap[p.id] = {
              stock: p.stock ?? '',
              upcomingDelivery: p.upcomingDelivery ?? '',
              targetStock: p.targetStock ?? '',
              packaging: p.packaging ?? '',
              margin: legacyOrderStates?.[p.id]?.margin,
            };
          });
          setOrderLineStates(legacyMap);
        }
      }
    } catch (error) {
      console.error('[Supabase load exception]', error);
    } finally {
      setSupabaseLoaded(true);
    }
  }, [
    setCostMatterByMonth, setCovers, setDailyCovers,
    setDeliveryDateBySupplier, setDetailedInventory,
    setNextDeliveryDateBySupplier, applyOrderLineRows,
    setProducts, setPrepItems, setPrepImportsByMonth, setPrepSheetStocks, setPrepBatches,
    setPrepForecasts, setOrderTemplateRows, setSalesHtByMonth, setSupplierConfigs,
    setValidatedMonths, setPrepValidatedMonths,
  ]);

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
        onSaved: (id, confirmedTs) => {
          if (id.startsWith('order:')) {
            orderLineCloudTsByProductId.current[id.slice('order:'.length)] = confirmedTs;
          } else if (id.startsWith('app:')) {
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
  }, [clearSyncTimer, hydrateFromCloud, markSaveConfirmed, markSaveError, markSavePending]);

  useEffect(() => {
    if (!supabaseLoaded || !isSupabaseConfigured()) return;
    void retryQueuedSaves();
    const handleOnline = () => { void retryQueuedSaves(); };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [retryQueuedSaves, supabaseLoaded]);

  useEffect(() => {
    if (!supabaseLoaded || !isSupabaseConfigured() || !supabase) return;

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
      const delayMs = REALTIME_RECONNECT_DELAYS_MS[Math.min(attempt, REALTIME_RECONNECT_DELAYS_MS.length - 1)];
      reconnectAttemptRef.current = attempt + 1;
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        if (!disposed) openChannel();
      }, delayMs);
    };

    const openChannel = () => {
      if (disposed) return;
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      channelStatusRef.current = 'idle';
      const channel = supabase
        .channel(`app_state_sync:${CURRENT_SITE_ID}`)
        .on(
          'postgres_changes' as any,
          { event: '*', schema: 'public', table: 'app_state', filter: `site_id=eq.${CURRENT_SITE_ID}` },
          (payload: any) => {
            const row = payload.new as { site_id?: string; key: string; value: unknown; updated_at: string } | null;
            if (row?.site_id && row.site_id !== CURRENT_SITE_ID) return;
            if (!row?.key || !row?.updated_at) return;
            handleRealtimeEvent(row.key, row.updated_at, row.value);
          }
        )
        .on(
          'postgres_changes' as any,
          { event: '*', schema: 'public', table: 'order_line_states', filter: `site_id=eq.${CURRENT_SITE_ID}` },
          (payload: any) => {
            if (payload.eventType === 'DELETE') {
              const oldRow = payload.old as { site_id?: string; product_id?: string } | null;
              if (oldRow?.site_id && oldRow.site_id !== CURRENT_SITE_ID) return;
              if (oldRow?.product_id) removeOrderLineRowLocally(oldRow.product_id);
              return;
            }
            const row = payload.new as OrderLineStateRow & { site_id?: string } | null;
            if (row?.site_id && row.site_id !== CURRENT_SITE_ID) return;
            if (!row?.product_id || !row?.updated_at) return;
            applyOrderLineRows([row]);
          }
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
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      window.removeEventListener('focusout', flushPending);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    supabaseLoaded, handleRealtimeEvent, flushPending, hydrateFromCloud, applyOrderLineRows,
    removeOrderLineRowLocally, retryQueuedSaves,
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
      currentKey => lastCloudUpdatedAtByKey.current[currentKey],
      {
        onSaved: (_id, confirmedTs) => {
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
  useEffect(() => { persistEverywhere('deliveryDateBySupplier', deliveryDateBySupplier); }, [deliveryDateBySupplier, persistEverywhere]);
  useEffect(() => { persistEverywhere('nextDeliveryDateBySupplier', nextDeliveryDateBySupplier); }, [nextDeliveryDateBySupplier, persistEverywhere]);
  useEffect(() => { persistEverywhere('products', products); }, [persistEverywhere, products]);
  useEffect(() => { persistEverywhere('prepItems', prepItems); }, [persistEverywhere, prepItems]);
  useEffect(() => { persistEverywhere('prepImportsByMonth', prepImportsByMonth); }, [persistEverywhere, prepImportsByMonth]);
  useEffect(() => { persistEverywhere('prepSheetStocks', prepSheetStocks); }, [persistEverywhere, prepSheetStocks]);
  useEffect(() => { persistEverywhere('prepBatches', prepBatches); }, [persistEverywhere, prepBatches]);
  useEffect(() => { persistEverywhere('prepForecasts', prepForecasts); }, [persistEverywhere, prepForecasts]);
  useEffect(() => { persistEverywhere('orderTemplateRows', orderTemplateRows); }, [persistEverywhere, orderTemplateRows]);

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
