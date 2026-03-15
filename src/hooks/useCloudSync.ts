import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isSupabaseConfigured,
  loadAllFromSupabase,
  saveToSupabaseDebounced,
} from '../utils/supabase';
import { OrderState, SupplierConfig } from '../types';
import { ProductWithHistory } from '../data';
import { DailyCoversState } from '../utils/dateHelpers';
import {
  mergeAndNormalizeProducts,
  mergeSupplierConfigsWithDefaults,
  saveState,
} from './appStateHelpers';
import { supabase } from '../lib/supabaseClient';

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


const hasDailyCoverData = (state: DailyCoversState): boolean =>
  Object.values(state).some(
    month => Array.isArray(month) && month.some(day => day.midi !== '' && day.midi !== 0)
  );

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
  const pendingKeysRef = useRef<Set<string>>(new Set());
  const pendingRemoteRowsRef = useRef<Record<string, { updated_at: string; value: unknown }>>({});

  const applyCloudKey = useCallback((key: string, cloudTs: string, value: unknown) => {
    const lastCloudTs = lastCloudUpdatedAtByKey.current[key];
    if (lastCloudTs && lastCloudTs >= cloudTs) return;

    lastCloudUpdatedAtByKey.current[key] = cloudTs;
    pendingKeysRef.current.delete(key);

    isHydratingFromCloud.current = true;
    switch (key) {
      case 'covers':
        setCovers(value as Record<string, number>);
        break;
      case 'dailyCovers': {
        const nextDailyCovers = value as DailyCoversState;
        if (hasDailyCoverData(nextDailyCovers)) {
          setDailyCovers(nextDailyCovers);
        }
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

    setTimeout(() => {
      isHydratingFromCloud.current = false;
    }, 600);
  }, [
    setCostMatterByMonth,
    setCovers,
    setDailyCovers,
    setDeliveryDateBySupplier,
    setDetailedInventory,
    setNextDeliveryDateBySupplier,
    setOrderStates,
    setProducts,
    setSalesHtByMonth,
    setSupplierConfigs,
    setValidatedMonths,
  ]);

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
            setSupplierConfigs(
              mergeSupplierConfigsWithDefaults(cloudMap.supplierConfigs as Record<string, SupplierConfig>)
            );
          }
          if (cloudMap.deliveryDateBySupplier) {
            setDeliveryDateBySupplier(cloudMap.deliveryDateBySupplier as Record<string, string>);
          }
          if (cloudMap.nextDeliveryDateBySupplier) {
            setNextDeliveryDateBySupplier(cloudMap.nextDeliveryDateBySupplier as Record<string, string>);
          }
          if (cloudMap.products) {
            setProducts(mergeAndNormalizeProducts(cloudMap.products as ProductWithHistory[]));
          }

          setTimeout(() => {
            isHydratingFromCloud.current = false;
          }, 600);
        }
      } catch (error) {
        console.error('[Supabase load exception]', error);
      } finally {
        if (!cancelled) setSupabaseLoaded(true);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    setCostMatterByMonth,
    setCovers,
    setDailyCovers,
    setDeliveryDateBySupplier,
    setDetailedInventory,
    setNextDeliveryDateBySupplier,
    setOrderStates,
    setProducts,
    setSalesHtByMonth,
    setSupplierConfigs,
    setValidatedMonths,
  ]);


  useEffect(() => {
    if (!supabaseLoaded || !isSupabaseConfigured() || !supabase) return;

    const isEditingElement = (el: HTMLElement | null): boolean => {
      if (!el) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      return Boolean((el as any).isContentEditable);
    };

    const getActiveCloudKey = (): string | null => {
      const el = document?.activeElement as HTMLElement | null;
      if (!isEditingElement(el)) return null;
      const owner = el?.closest?.('[data-cloud-key]') as HTMLElement | null;
      return owner?.dataset?.cloudKey ?? null;
    };

    const flushPendingRowsIfSafe = () => {
      const activeKey = getActiveCloudKey();
      const pendingEntries = Object.entries(pendingRemoteRowsRef.current);
      if (pendingEntries.length === 0) return;

      pendingEntries.forEach(([key, row]) => {
        if (activeKey && activeKey === key) return;
        lastCloudUpdatedAtByKey.current[key] = row.updated_at;
        applyCloudKey(key, row.updated_at, row.value);
        delete pendingRemoteRowsRef.current[key];
      });
    };

    const channel = supabase
      .channel('app-state-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_state' },
        payload => {
          const nextRow = (payload.new ?? payload.record) as { key?: string; updated_at?: string; value?: unknown } | undefined;
          if (!nextRow?.key || !nextRow.updated_at) return;

          const currentCloudTs = lastCloudUpdatedAtByKey.current[nextRow.key];
          if (currentCloudTs && currentCloudTs >= nextRow.updated_at) return;

          const activeKey = getActiveCloudKey();
          if (activeKey && activeKey === nextRow.key) {
            pendingRemoteRowsRef.current[nextRow.key] = {
              updated_at: nextRow.updated_at,
              value: nextRow.value,
            };
            return;
          }

          applyCloudKey(nextRow.key, nextRow.updated_at, nextRow.value);
        }
      )
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[Supabase realtime] channel error on app_state');
        }
      });

    window.addEventListener('focusout', flushPendingRowsIfSafe);
    window.addEventListener('pointerup', flushPendingRowsIfSafe);
    document.addEventListener('visibilitychange', flushPendingRowsIfSafe);

    return () => {
      window.removeEventListener('focusout', flushPendingRowsIfSafe);
      window.removeEventListener('pointerup', flushPendingRowsIfSafe);
      document.removeEventListener('visibilitychange', flushPendingRowsIfSafe);
      pendingRemoteRowsRef.current = {};
      void supabase.removeChannel(channel);
    };
  }, [applyCloudKey, supabaseLoaded]);

  const persistEverywhere = useCallback((key: string, value: unknown) => {
    saveState(key, value, onSaveError);
    if (isHydratingFromCloud.current || !supabaseLoaded || !isSupabaseConfigured()) return;

    setSyncStatus('saving');

    pendingKeysRef.current.add(key);

    saveToSupabaseDebounced(
      key,
      value,
      row => {
        lastCloudUpdatedAtByKey.current[row.key] = row.updated_at;
        pendingKeysRef.current.delete(row.key);
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
