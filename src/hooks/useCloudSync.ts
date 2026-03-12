import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildSiteScopedCloudKey,
  isSupabaseConfigured,
  loadSiteKeysFromSupabase,
  loadSiteMetaFromSupabase,
  loadSiteStateFromSupabase,
  saveToSupabaseDebounced,
} from '../utils/supabase';
import { OrderState, SupplierConfig } from '../types';
import { ProductWithHistory } from '../data';
import { DailyCoversState } from '../utils/dateHelpers';
import {
  mergeAndNormalizeProducts,
  mergeSupplierConfigsWithDefaults,
  nowIso,
  saveScopedState,
} from './appStateHelpers';

type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

type PersistedState = {
  activeSiteId: string | null;
  activeSiteName: string | null;
  siteScopeReady: boolean;
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

const BASE_KEYS = [
  'covers',
  'dailyCovers',
  'orderStates',
  'inventory',
  'salesHtByMonth',
  'costMatterByMonth',
  'validatedMonths',
  'supplierConfigs',
  'deliveryDateBySupplier',
  'nextDeliveryDateBySupplier',
  'products',
] as const;

const PARAMETER_KEYS = new Set<string>([
  'supplierConfigs',
  'costMatterByMonth',
  'salesHtByMonth',
  'validatedMonths',
  'deliveryDateBySupplier',
  'nextDeliveryDateBySupplier',
]);

const hasDailyCoverData = (state: DailyCoversState): boolean =>
  Object.values(state).some(
    month => Array.isArray(month) && month.some(day => day.midi !== '' && day.midi !== 0)
  );

const stripSitePrefix = (siteId: string, scopedKey: string): string => {
  const prefix = buildSiteScopedCloudKey(siteId, '');
  return scopedKey.startsWith(prefix) ? scopedKey.slice(prefix.length) : scopedKey;
};

export const useCloudSync = ({
  activeSiteId,
  siteScopeReady,
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
  const pollingInFlightRef = useRef(false);
  const pendingKeysRef = useRef<Set<string>>(new Set());
  const localTsByKey = useRef<Record<string, string>>({});
  const siteScopeVersionRef = useRef(0);

  useEffect(() => {
    siteScopeVersionRef.current += 1;
    isHydratingFromCloud.current = true;
    pendingKeysRef.current.clear();
    localTsByKey.current = {};
    lastCloudUpdatedAtByKey.current = {};
    setSupabaseLoaded(false);
    setSyncStatus('idle');

    const release = window.setTimeout(() => {
      if (siteScopeReady) {
        isHydratingFromCloud.current = false;
      }
    }, 0);

    return () => window.clearTimeout(release);
  }, [activeSiteId, siteScopeReady]);

  const applyCloudKey = useCallback((key: string, cloudTs: string, value: unknown) => {
    const localTs = localTsByKey.current[key];
    if (localTs && localTs > cloudTs) return;

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
      if (siteScopeReady) {
        isHydratingFromCloud.current = false;
      }
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
    siteScopeReady,
  ]);

  useEffect(() => {
    let cancelled = false;
    const runVersion = siteScopeVersionRef.current;

    const run = async () => {
      if (!activeSiteId) {
        setSupabaseLoaded(true);
        return;
      }

      if (!isSupabaseConfigured()) {
        setSupabaseLoaded(true);
        if (siteScopeReady) isHydratingFromCloud.current = false;
        return;
      }

      try {
        const cloud = await loadSiteStateFromSupabase(activeSiteId);
        if (cancelled || runVersion !== siteScopeVersionRef.current) return;

        if (cloud && cloud.length > 0) {
          isHydratingFromCloud.current = true;
          cloud.forEach((row) => {
            const baseKey = stripSitePrefix(activeSiteId, row.key);
            lastCloudUpdatedAtByKey.current[baseKey] = row.updated_at;
            applyCloudKey(baseKey, row.updated_at, row.value);
          });
        }
      } catch (error) {
        console.error('[Supabase scoped load exception]', error);
      } finally {
        if (!cancelled && runVersion === siteScopeVersionRef.current) {
          setSupabaseLoaded(true);
          if (siteScopeReady) {
            window.setTimeout(() => {
              if (runVersion === siteScopeVersionRef.current) {
                isHydratingFromCloud.current = false;
              }
            }, 650);
          }
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [activeSiteId, applyCloudKey, siteScopeReady]);

  useEffect(() => {
    if (!activeSiteId || !supabaseLoaded || !isSupabaseConfigured()) return;

    const isSmallDevice = () =>
      typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches;

    if (!isSmallDevice()) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const runVersion = siteScopeVersionRef.current;

    const isUserEditing = (): boolean => {
      const el = document?.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      return Boolean((el as any).isContentEditable);
    };

    const flushPendingIfSafe = async () => {
      if (!activeSiteId || pendingKeysRef.current.size === 0 || isUserEditing() || pollingInFlightRef.current) return;
      pollingInFlightRef.current = true;
      try {
        const keys = Array.from(pendingKeysRef.current);
        pendingKeysRef.current.clear();
        const rows = await loadSiteKeysFromSupabase(activeSiteId, keys);
        if (!rows || cancelled || runVersion !== siteScopeVersionRef.current) return;
        rows.forEach(row => {
          const baseKey = stripSitePrefix(activeSiteId, row.key);
          lastCloudUpdatedAtByKey.current[baseKey] = row.updated_at;
          applyCloudKey(baseKey, row.updated_at, row.value);
        });
      } finally {
        pollingInFlightRef.current = false;
      }
    };

    const tick = async () => {
      if (!activeSiteId || cancelled || runVersion !== siteScopeVersionRef.current || pollingInFlightRef.current || document?.hidden || syncStatus === 'saving') return;

      pollingInFlightRef.current = true;
      try {
        const meta = await loadSiteMetaFromSupabase(activeSiteId);
        if (!meta || cancelled || runVersion !== siteScopeVersionRef.current) return;

        const changedKeys: string[] = [];
        meta.forEach(row => {
          const baseKey = stripSitePrefix(activeSiteId, row.key);
          if (!PARAMETER_KEYS.has(baseKey)) return;
          const prev = lastCloudUpdatedAtByKey.current[baseKey];
          if (!prev) {
            lastCloudUpdatedAtByKey.current[baseKey] = row.updated_at;
            return;
          }
          if (prev !== row.updated_at) changedKeys.push(baseKey);
        });

        if (changedKeys.length === 0) return;
        if (isUserEditing()) {
          changedKeys.forEach(key => pendingKeysRef.current.add(key));
          return;
        }

        const rows = await loadSiteKeysFromSupabase(activeSiteId, changedKeys);
        if (!rows || cancelled || runVersion !== siteScopeVersionRef.current) return;
        rows.forEach(row => {
          const baseKey = stripSitePrefix(activeSiteId, row.key);
          lastCloudUpdatedAtByKey.current[baseKey] = row.updated_at;
          applyCloudKey(baseKey, row.updated_at, row.value);
        });
      } catch (error) {
        console.error('[Cloud polling tick error]', error);
      } finally {
        pollingInFlightRef.current = false;
      }
    };

    void tick();
    timer = setInterval(() => {
      void tick();
    }, 8000);
    window.addEventListener('focusout', flushPendingIfSafe);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      window.removeEventListener('focusout', flushPendingIfSafe);
    };
  }, [activeSiteId, applyCloudKey, siteScopeReady, supabaseLoaded, syncStatus]);

  const persistEverywhere = useCallback((key: string, value: unknown) => {
    if (!activeSiteId) return;

    saveScopedState(activeSiteId, key, value, onSaveError);

    if (!siteScopeReady || isHydratingFromCloud.current || !supabaseLoaded || !isSupabaseConfigured()) {
      return;
    }

    const ts = nowIso();
    localTsByKey.current[key] = ts;
    setSyncStatus('saving');

    saveToSupabaseDebounced(
      buildSiteScopedCloudKey(activeSiteId, key),
      value,
      ts,
      (currentScopedKey) => {
        const baseKey = stripSitePrefix(activeSiteId, currentScopedKey);
        return lastCloudUpdatedAtByKey.current[baseKey];
      },
      (confirmedScopedKey, confirmedTs) => {
        const baseKey = stripSitePrefix(activeSiteId, confirmedScopedKey);
        lastCloudUpdatedAtByKey.current[baseKey] = confirmedTs;
        delete localTsByKey.current[baseKey];
      }
    );

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => setSyncStatus('saved'), 1700);
  }, [activeSiteId, onSaveError, siteScopeReady, supabaseLoaded]);

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
