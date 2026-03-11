import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  isSupabaseConfigured,
  loadAllFromSupabase,
  loadKeysFromSupabase,
  loadMetaFromSupabase,
  saveToSupabaseDebounced,
} from '../utils/supabase';
import { OrderState, SupplierConfig } from '../types';
import { ProductWithHistory } from '../data';
import { DailyCoversState } from '../utils/dateHelpers';
import {
  mergeAndNormalizeProducts,
  mergeSupplierConfigsWithDefaults,
  nowIso,
  saveSiteScopedState,
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
    activeSiteId: string | null;
    useLegacySiteStorage: boolean;
    siteStateReady: boolean;
  };

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
  activeSiteId,
  useLegacySiteStorage,
  siteStateReady,
}: UseCloudSyncParams) => {
  const [supabaseLoaded, setSupabaseLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHydratingFromCloud = useRef(false);
  const lastCloudUpdatedAtByKey = useRef<Record<string, string>>({});
  const pollingInFlightRef = useRef(false);
  const pendingKeysRef = useRef<Set<string>>(new Set());
  const localTsByKey = useRef<Record<string, string>>({});

  const scopeToken = useMemo(() => {
    if (!activeSiteId || useLegacySiteStorage) return 'legacy';
    return `site:${activeSiteId}`;
  }, [activeSiteId, useLegacySiteStorage]);

  const getRemoteKey = useCallback((key: string) => {
    if (!activeSiteId || useLegacySiteStorage) return key;
    return `${key}__site__${activeSiteId}`;
  }, [activeSiteId, useLegacySiteStorage]);

  const getLogicalKeyFromRemoteKey = useCallback((remoteKey: string): string | null => {
    if (!activeSiteId || useLegacySiteStorage) return remoteKey;
    const suffix = `__site__${activeSiteId}`;
    if (!remoteKey.endsWith(suffix)) return null;
    return remoteKey.slice(0, -suffix.length);
  }, [activeSiteId, useLegacySiteStorage]);



  useEffect(() => {
    lastCloudUpdatedAtByKey.current = {};
    pendingKeysRef.current.clear();
    localTsByKey.current = {};
    setSupabaseLoaded(false);
    setSyncStatus('idle');
  }, [scopeToken]);

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
      isHydratingFromCloud.current = false;
    }, 600);
  }, [
    getLogicalKeyFromRemoteKey,
    scopeToken,
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
    siteStateReady,
  ]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!siteStateReady) return;

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
            const logicalKey = getLogicalKeyFromRemoteKey(row.key);
            if (!logicalKey) return;
            lastCloudUpdatedAtByKey.current[logicalKey] = row.updated_at;
            cloudMap[logicalKey] = row.value;
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
    getLogicalKeyFromRemoteKey,
    scopeToken,
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
    siteStateReady,
  ]);

  useEffect(() => {
    if (!supabaseLoaded || !isSupabaseConfigured()) return;

    const isSmallDevice = () =>
      typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches;

    if (!isSmallDevice()) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const isUserEditing = (): boolean => {
      const el = document?.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      return Boolean((el as any).isContentEditable);
    };

    const flushPendingIfSafe = async () => {
      if (pendingKeysRef.current.size === 0 || isUserEditing() || pollingInFlightRef.current) return;
      pollingInFlightRef.current = true;
      try {
        const keys = Array.from(pendingKeysRef.current);
        pendingKeysRef.current.clear();
        const rows = await loadKeysFromSupabase(keys.map(getRemoteKey));
        if (!rows) return;
        rows.forEach(row => {
          const logicalKey = getLogicalKeyFromRemoteKey(row.key);
          if (!logicalKey) return;
          lastCloudUpdatedAtByKey.current[logicalKey] = row.updated_at;
          applyCloudKey(logicalKey, row.updated_at, row.value);
        });
      } finally {
        pollingInFlightRef.current = false;
      }
    };

    const tick = async () => {
      if (cancelled || pollingInFlightRef.current || document?.hidden || syncStatus === 'saving') return;

      pollingInFlightRef.current = true;
      try {
        const meta = await loadMetaFromSupabase();
        if (!meta) return;

        const changedKeys: string[] = [];
        meta.forEach(row => {
          const logicalKey = getLogicalKeyFromRemoteKey(row.key);
          if (!logicalKey || !PARAMETER_KEYS.has(logicalKey)) return;
          const prev = lastCloudUpdatedAtByKey.current[logicalKey];
          if (!prev) {
            lastCloudUpdatedAtByKey.current[logicalKey] = row.updated_at;
            return;
          }
          if (prev !== row.updated_at) changedKeys.push(logicalKey);
        });

        if (changedKeys.length === 0) return;
        if (isUserEditing()) {
          changedKeys.forEach(key => pendingKeysRef.current.add(key));
          return;
        }

        const rows = await loadKeysFromSupabase(changedKeys.map(getRemoteKey));
        if (!rows) return;
        rows.forEach(row => {
          const logicalKey = getLogicalKeyFromRemoteKey(row.key);
          if (!logicalKey) return;
          lastCloudUpdatedAtByKey.current[logicalKey] = row.updated_at;
          applyCloudKey(logicalKey, row.updated_at, row.value);
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
  }, [applyCloudKey, getLogicalKeyFromRemoteKey, getRemoteKey, scopeToken, supabaseLoaded, syncStatus]);

  const persistEverywhere = useCallback((key: string, value: unknown) => {
    if (!siteStateReady || isHydratingFromCloud.current) return;

    saveSiteScopedState(key, value, activeSiteId, useLegacySiteStorage, onSaveError);
    if (!supabaseLoaded || !isSupabaseConfigured()) return;

    const ts = nowIso();
    localTsByKey.current[key] = ts;
    setSyncStatus('saving');

    const remoteKey = getRemoteKey(key);

    saveToSupabaseDebounced(
      remoteKey,
      value,
      ts,
      () => lastCloudUpdatedAtByKey.current[key],
      (_confirmedRemoteKey, confirmedTs) => {
        lastCloudUpdatedAtByKey.current[key] = confirmedTs;
        delete localTsByKey.current[key];
      }
    );

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => setSyncStatus('saved'), 1700);
  }, [activeSiteId, getRemoteKey, onSaveError, siteStateReady, supabaseLoaded, useLegacySiteStorage]);

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
