// =============================================================
// hooks/useCloudSync.ts
//
// Sync temps réel via Supabase Realtime (WebSocket).
// Remplace l'ancien polling par un channel postgres_changes.
//
// ANTI-CLIGNOTEMENT :
//   Quand une update externe arrive sur une clé "saisie active"
//   (orderStates, products, covers, dailyCovers), on vérifie si
//   l'utilisateur a un input en focus. Si oui → on met l'update
//   en file d'attente (pendingRealtimeRef). Dès que l'utilisateur
//   quitte le champ (focusout global), on applique la file.
//
// LAST-WRITE-WINS :
//   Basé sur updated_at ISO. Si notre timestamp local est plus
//   récent que celui reçu, on ignore l'update entrante.
// =============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import {
  loadAllFromSupabase,
  saveToSupabaseDebounced,
} from '../utils/supabase';
import { OrderState, SupplierConfig } from '../types';
import { ProductWithHistory } from '../data';
import { DailyCoversState } from '../utils/dateHelpers';
import {
  mergeAndNormalizeProducts,
  mergeSupplierConfigsWithDefaults,
  nowIso,
  saveState,
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
  supplierConfigs: Record<string, SupplierConfig>;
  deliveryDateBySupplier: Record<string, string>;
  nextDeliveryDateBySupplier: Record<string, string>;
  products: ProductWithHistory[];
};

type StateSetters = {
  setCovers: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setDailyCovers: React.Dispatch<React.SetStateAction<DailyCoversState>>;
  setOrderStates: React.Dispatch<React.SetStateAction<Record<string, OrderState>>>;
  setDetailedInventory: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setSalesHtByMonth: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setCostMatterByMonth: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setValidatedMonths: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setSupplierConfigs: React.Dispatch<React.SetStateAction<Record<string, SupplierConfig>>>;
  setDeliveryDateBySupplier: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setNextDeliveryDateBySupplier: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setProducts: React.Dispatch<React.SetStateAction<ProductWithHistory[]>>;
};

type UseCloudSyncParams = PersistedState &
  StateSetters & {
    onSaveError: (message: string) => void;
  };

// Clés dont les updates doivent attendre que l'utilisateur
// ait fini de saisir avant d'être appliquées (anti-clignotement)
const DEFER_WHILE_TYPING = new Set<string>([
  'orderStates',
  'products',
  'covers',
  'dailyCovers',
]);

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
  supplierConfigs,
  deliveryDateBySupplier,
  nextDeliveryDateBySupplier,
  products,
  setCovers,
  setDailyCovers,
  setOrderStates,
  setDetailedInventory,
  setSalesHtByMonth,
  setCostMatterByMonth,
  setValidatedMonths,
  setSupplierConfigs,
  setDeliveryDateBySupplier,
  setNextDeliveryDateBySupplier,
  setProducts,
  onSaveError,
}: UseCloudSyncParams) => {
  const [supabaseLoaded, setSupabaseLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHydratingFromCloud = useRef(false);
  const lastCloudUpdatedAtByKey = useRef<Record<string, string>>({});
  const localTsByKey = useRef<Record<string, string>>({});

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
      default:
        break;
    }

    setTimeout(() => { isHydratingFromCloud.current = false; }, 200);
  }, [
    setCostMatterByMonth, setCovers, setDailyCovers,
    setDeliveryDateBySupplier, setDetailedInventory,
    setNextDeliveryDateBySupplier, setOrderStates,
    setProducts, setSalesHtByMonth, setSupplierConfigs, setValidatedMonths,
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

        if (cloud && cloud.length > 0) {
          isHydratingFromCloud.current = true;
          const cloudMap: Record<string, unknown> = {};

          cloud.forEach((row: any) => {
            lastCloudUpdatedAtByKey.current[row.key] = row.updated_at;
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
          if (cloudMap.supplierConfigs) {
            setSupplierConfigs(mergeSupplierConfigsWithDefaults(cloudMap.supplierConfigs as Record<string, SupplierConfig>));
          }
          if (cloudMap.deliveryDateBySupplier) setDeliveryDateBySupplier(cloudMap.deliveryDateBySupplier as Record<string, string>);
          if (cloudMap.nextDeliveryDateBySupplier) setNextDeliveryDateBySupplier(cloudMap.nextDeliveryDateBySupplier as Record<string, string>);
          if (cloudMap.products) setProducts(mergeAndNormalizeProducts(cloudMap.products as ProductWithHistory[]));

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
    setProducts, setSalesHtByMonth, setSupplierConfigs, setValidatedMonths,
  ]);

  // ─── Supabase Realtime — écoute les INSERT/UPDATE sur app_state ───────────
  useEffect(() => {
    if (!supabaseLoaded || !isSupabaseConfigured() || !supabase) return;

    const channel = supabase
      .channel('app_state_sync')
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'app_state' },
        (payload: any) => {
          const row = payload.new as { key: string; value: unknown; updated_at: string } | null;
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

  // ─── Sauvegarde locale + cloud (debounced 1.5s) ───────────────────────────
  const persistEverywhere = useCallback((key: string, value: unknown) => {
    saveState(key, value, onSaveError);
    if (isHydratingFromCloud.current || !supabaseLoaded || !isSupabaseConfigured()) return;

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
      }
    );

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => setSyncStatus('saved'), 1700);
  }, [onSaveError, supabaseLoaded]);

  useEffect(() => { persistEverywhere('covers', covers); }, [covers, persistEverywhere]);
  useEffect(() => { persistEverywhere('dailyCovers', dailyCovers); }, [dailyCovers, persistEverywhere]);
  useEffect(() => { persistEverywhere('orderStates', orderStates); }, [orderStates, persistEverywhere]);
  useEffect(() => { persistEverywhere('inventory', detailedInventory); }, [detailedInventory, persistEverywhere]);
  useEffect(() => { persistEverywhere('salesHtByMonth', salesHtByMonth); }, [persistEverywhere, salesHtByMonth]);
  useEffect(() => { persistEverywhere('costMatterByMonth', costMatterByMonth); }, [costMatterByMonth, persistEverywhere]);
  useEffect(() => { persistEverywhere('validatedMonths', validatedMonths); }, [persistEverywhere, validatedMonths]);
  useEffect(() => { persistEverywhere('supplierConfigs', supplierConfigs); }, [persistEverywhere, supplierConfigs]);
  useEffect(() => { persistEverywhere('deliveryDateBySupplier', deliveryDateBySupplier); }, [deliveryDateBySupplier, persistEverywhere]);
  useEffect(() => { persistEverywhere('nextDeliveryDateBySupplier', nextDeliveryDateBySupplier); }, [nextDeliveryDateBySupplier, persistEverywhere]);
  useEffect(() => { persistEverywhere('products', products); }, [persistEverywhere, products]);

  return {
    supabaseLoaded,
    syncStatus,
  };
};
