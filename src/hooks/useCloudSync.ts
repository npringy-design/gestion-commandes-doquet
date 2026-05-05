// =============================================================
// hooks/useCloudSync.ts
//
// Sync temps réel via Supabase Realtime (WebSocket).
// Remplace l'ancien polling par un channel postgres_changes.
//
// ANTI-CLIGNOTEMENT :
//   Quand une update externe arrive sur une clé de commande en saisie active
//   (orderStates), on vérifie si
//   l'utilisateur a un input en focus. Si oui → on met l'update
//   en file d'attente (pendingRealtimeRef). Dès que l'utilisateur
//   quitte le champ (focusout global), on applique la file.
//
// LAST-WRITE-WINS :
//   Basé sur updated_at ISO. Si notre timestamp local est plus
//   récent que celui reçu, on ignore l'update entrante.
// =============================================================

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import {
  loadAllFromSupabase,
  saveToSupabaseDebounced,
} from '../utils/supabase';
import { OrderState, SupplierConfig, PrepBatch, PrepItem, PrepImportsByMonth, PrepForecastsByDate, PrepSheetStocks } from '../types';
import { ProductWithHistory } from '../data';
import { CURRENT_SITE_ID } from '../constants';
import { DailyCoversState } from '../utils/dateHelpers';
import {
  mergeAndNormalizeProducts,
  mergeSupplierConfigsWithDefaults,
  nowIso,
  removeState,
} from './appStateHelpers';

type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

type PersistedState = {
  covers: Record<string, number>;
  dailyCovers: DailyCoversState;
  orderStates: Record<string, OrderState>;
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
};

type StateSetters = {
  setCovers: Dispatch<SetStateAction<Record<string, number>>>;
  setDailyCovers: Dispatch<SetStateAction<DailyCoversState>>;
  setOrderStates: Dispatch<SetStateAction<Record<string, OrderState>>>;
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
};

type UseCloudSyncParams = PersistedState &
  StateSetters & {
    onSaveError: (message: string) => void;
  };

// Clés dont les updates doivent attendre que l'utilisateur
// ait fini de saisir avant d'être appliquées (anti-clignotement)
const DEFER_WHILE_TYPING = new Set<string>([
  'orderStates',
]);

// Le Realtime reste volontairement limité au flux commande.
// Tout le reste reste sauvegardé dans Supabase, mais n'est relu
// qu'au chargement de l'application pour éviter du trafic WebSocket
// inutile et des re-renders sur des écrans non opérationnels.
const REALTIME_KEYS = new Set<string>([
  'orderStates',
  'deliveryDateBySupplier',
  'nextDeliveryDateBySupplier',
]);

const CLOUD_ONLY_KEYS = new Set<string>([
  'inventory',
  'prepImportsByMonth',
]);

const SAVE_DEBOUNCE_MS_BY_KEY: Record<string, number> = {
  orderStates: 1200,
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

export const useCloudSync = ({
  covers,
  dailyCovers,
  orderStates,
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
  setCovers,
  setDailyCovers,
  setOrderStates,
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
  onSaveError,
}: UseCloudSyncParams) => {
  const [supabaseLoaded, setSupabaseLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHydratingFromCloud = useRef(false);
  const lastCloudUpdatedAtByKey = useRef<Record<string, string>>({});
  const localTsByKey = useRef<Record<string, string>>({});
  const lastPersistedSignatureByKey = useRef<Record<string, string>>({});
  const initialCloudLoadSucceededRef = useRef(false);

  useEffect(() => {
    CLOUD_ONLY_KEYS.forEach(removeState);
  }, []);

  // File d'attente des updates Realtime reçues pendant une saisie active
  const pendingRealtimeRef = useRef<Map<string, { ts: string; value: unknown }>>(new Map());

  // ─── Application d'une clé reçue du cloud ─────────────────────────────────
  const applyCloudKey = useCallback((key: string, cloudTs: string, value: unknown) => {
    // Last-write-wins : si notre saisie locale est plus récente, on ignore
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
      case 'orderStates':
        setOrderStates(value as Record<string, OrderState>);
        break;
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
      default:
        break;
    }

    setTimeout(() => { isHydratingFromCloud.current = false; }, 200);
  }, [
    setCostMatterByMonth, setCovers, setDailyCovers,
    setDeliveryDateBySupplier, setDetailedInventory,
    setNextDeliveryDateBySupplier, setOrderStates,
    setProducts, setPrepItems, setPrepImportsByMonth, setPrepSheetStocks, setPrepBatches, setPrepForecasts, setSalesHtByMonth, setSupplierConfigs, setValidatedMonths, setPrepValidatedMonths,
  ]);

  // ─── Vide la file d'attente (appelé au focusout global) ───────────────────
  const flushPending = useCallback(() => {
    if (pendingRealtimeRef.current.size === 0) return;
    // Petit délai pour laisser le focus se déplacer vers le prochain champ
    setTimeout(() => {
      if (isUserTyping()) return; // l'utilisateur a changé de champ, on attend encore
      pendingRealtimeRef.current.forEach(({ ts, value }, key) => {
        lastCloudUpdatedAtByKey.current[key] = ts;
        applyCloudKey(key, ts, value);
      });
      pendingRealtimeRef.current.clear();
    }, 150);
  }, [applyCloudKey]);

  // ─── Réception d'un event Realtime ────────────────────────────────────────
  const handleRealtimeEvent = useCallback((key: string, cloudTs: string, value: unknown) => {
    // Realtime strictement limité au flux commande
    if (!REALTIME_KEYS.has(key)) return;

    // Ignorer nos propres écritures (timestamp local >= cloud)
    const localTs = localTsByKey.current[key];
    if (localTs && localTs >= cloudTs) return;

    // Mettre à jour le curseur cloud
    lastCloudUpdatedAtByKey.current[key] = cloudTs;

    // Si l'utilisateur est en train de taper ET que la clé est sensible → différer
    if (DEFER_WHILE_TYPING.has(key) && isUserTyping()) {
      const existing = pendingRealtimeRef.current.get(key);
      if (!existing || cloudTs > existing.ts) {
        pendingRealtimeRef.current.set(key, { ts: cloudTs, value });
      }
      return;
    }

    applyCloudKey(key, cloudTs, value);
  }, [applyCloudKey]);

  // ─── Chargement initial depuis Supabase ───────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!isSupabaseConfigured()) {
        setSupabaseLoaded(true);
        return;
      }

      try {
        const cloud = await loadAllFromSupabase();
        if (cancelled) return;
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
          if (cloudMap.orderStates) setOrderStates(cloudMap.orderStates as Record<string, OrderState>);
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

          setTimeout(() => { isHydratingFromCloud.current = false; }, 600);
        }
      } catch (error) {
        console.error('[Supabase load exception]', error);
      } finally {
        if (!cancelled) setSupabaseLoaded(true);
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [
    setCostMatterByMonth, setCovers, setDailyCovers,
    setDeliveryDateBySupplier, setDetailedInventory,
    setNextDeliveryDateBySupplier, setOrderStates,
    setProducts, setPrepItems, setPrepImportsByMonth, setPrepSheetStocks, setPrepBatches, setPrepForecasts, setSalesHtByMonth, setSupplierConfigs, setValidatedMonths, setPrepValidatedMonths,
  ]);

  // ─── Supabase Realtime — écoute les INSERT/UPDATE sur app_state ───────────
  useEffect(() => {
    if (!supabaseLoaded || !isSupabaseConfigured() || !supabase) return;

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
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] ✅ Connecté — sync instantanée active');
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime] ⚠️ Erreur de canal, reconnexion automatique...');
        }
      });

    // Flush la file d'attente quand l'utilisateur quitte un champ
    window.addEventListener('focusout', flushPending);

    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener('focusout', flushPending);
    };
  }, [supabaseLoaded, handleRealtimeEvent, flushPending]);

  // ─── Sauvegarde locale + cloud (debounced + anti-écriture inutile) ────────
  const persistEverywhere = useCallback((key: string, value: unknown, debounceMs?: number) => {
    const signature = stableStringify(value);
    if (lastPersistedSignatureByKey.current[key] === signature) return;
    if (CLOUD_ONLY_KEYS.has(key) && !initialCloudLoadSucceededRef.current && signature === '{}') return;

    if (isHydratingFromCloud.current || !supabaseLoaded || !isSupabaseConfigured()) {
      lastPersistedSignatureByKey.current[key] = signature;
      return;
    }

    const ts = nowIso();
    localTsByKey.current[key] = ts;
    setSyncStatus('saving');

    saveToSupabaseDebounced(
      key,
      value,
      ts,
      currentKey => lastCloudUpdatedAtByKey.current[currentKey],
      (confirmedKey, confirmedTs) => {
        lastCloudUpdatedAtByKey.current[confirmedKey] = confirmedTs;
        delete localTsByKey.current[confirmedKey];
        lastPersistedSignatureByKey.current[confirmedKey] = signature;
      },
      debounceMs ?? SAVE_DEBOUNCE_MS_BY_KEY[key] ?? 1500,
    );

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => setSyncStatus('saved'), Math.max(1700, (debounceMs ?? SAVE_DEBOUNCE_MS_BY_KEY[key] ?? 1500) + 250));
  }, [onSaveError, supabaseLoaded]);

  useEffect(() => { persistEverywhere('covers', covers); }, [covers, persistEverywhere]);
  useEffect(() => { persistEverywhere('dailyCovers', dailyCovers); }, [dailyCovers, persistEverywhere]);
  useEffect(() => { persistEverywhere('orderStates', orderStates); }, [orderStates, persistEverywhere]);
  // inventory = CSV bruts → debounce très long pour limiter la bande passante
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

  return {
    supabaseLoaded,
    syncStatus,
  };
};
