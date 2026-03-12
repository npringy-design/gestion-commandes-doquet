import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  isSupabaseConfigured,
  loadAllFromSupabase,
  loadKeysFromSupabase,
  loadMetaFromSupabase,
  saveToSupabaseDebounced,
} from '../utils/supabase';
import { OrderState, SupplierConfig } from '../types';
import { ProductWithHistory, DAILY_COVERS_INITIAL, MONTHLY_COVERS as INITIAL_COVERS } from '../data';
import { DailyCoversState } from '../utils/dateHelpers';
import {
  createInitialProducts,
  ensureScopedLocalState,
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
    activeSiteId: string | null;
    legacyBaseSiteId: string | null;
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

const emptySnapshot = (): PersistedState => ({
  covers: { ...INITIAL_COVERS },
  dailyCovers: structuredClone(DAILY_COVERS_INITIAL),
  orderStates: {},
  detailedInventory: {},
  salesHtByMonth: { ...INITIAL_COVERS },
  costMatterByMonth: { ...INITIAL_COVERS },
  validatedMonths: {},
  supplierConfigs: mergeSupplierConfigsWithDefaults({}),
  deliveryDateBySupplier: {},
  nextDeliveryDateBySupplier: {},
  products: createInitialProducts([]),
});

const applyStateSnapshot = (
  snapshot: PersistedState,
  setters: StateSetters,
) => {
  setters.setCovers(snapshot.covers);
  setters.setDailyCovers(snapshot.dailyCovers);
  setters.setOrderStates(snapshot.orderStates);
  setters.setDetailedInventory(snapshot.detailedInventory);
  setters.setSalesHtByMonth(snapshot.salesHtByMonth);
  setters.setCostMatterByMonth(snapshot.costMatterByMonth);
  setters.setValidatedMonths(snapshot.validatedMonths);
  setters.setSupplierConfigs(snapshot.supplierConfigs);
  setters.setDeliveryDateBySupplier(snapshot.deliveryDateBySupplier);
  setters.setNextDeliveryDateBySupplier(snapshot.nextDeliveryDateBySupplier);
  setters.setProducts(snapshot.products);
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
  activeSiteId,
  legacyBaseSiteId,
}: UseCloudSyncParams) => {
  const [supabaseLoaded, setSupabaseLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [siteReady, setSiteReady] = useState(false);

  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHydratingFromCloud = useRef(false);
  const lastCloudUpdatedAtByKey = useRef<Record<string, string>>({});
  const pollingInFlightRef = useRef(false);
  const pendingKeysRef = useRef<Set<string>>(new Set());
  const localTsByKey = useRef<Record<string, string>>({});
  const siteLoadTokenRef = useRef(0);

  const setters = useMemo<StateSetters>(() => ({
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
  }), [
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
  ]);

  const applyCloudKey = useCallback((key: string, cloudTs: string, value: unknown) => {
    const localTs = localTsByKey.current[key];
    if (localTs && localTs > cloudTs) return;
    if (!activeSiteId) return;

    isHydratingFromCloud.current = true;
    switch (key) {
      case 'covers':
        setCovers(value as Record<string, number>);
        saveState(key, value, onSaveError, activeSiteId);
        break;
      case 'dailyCovers': {
        const nextDailyCovers = value as DailyCoversState;
        if (hasDailyCoverData(nextDailyCovers)) {
          setDailyCovers(nextDailyCovers);
          saveState(key, value, onSaveError, activeSiteId);
        }
        break;
      }
      case 'orderStates':
        setOrderStates(value as Record<string, OrderState>);
        saveState(key, value, onSaveError, activeSiteId);
        break;
      case 'inventory':
        setDetailedInventory(value as Record<string, string>);
        saveState(key, value, onSaveError, activeSiteId);
        break;
      case 'salesHtByMonth':
        setSalesHtByMonth(value as Record<string, number>);
        saveState(key, value, onSaveError, activeSiteId);
        break;
      case 'costMatterByMonth':
        setCostMatterByMonth(value as Record<string, number>);
        saveState(key, value, onSaveError, activeSiteId);
        break;
      case 'validatedMonths':
        setValidatedMonths(value as Record<string, boolean>);
        saveState(key, value, onSaveError, activeSiteId);
        break;
      case 'supplierConfigs': {
        const nextConfigs = mergeSupplierConfigsWithDefaults(value as Record<string, SupplierConfig>);
        setSupplierConfigs(nextConfigs);
        saveState(key, nextConfigs, onSaveError, activeSiteId);
        break;
      }
      case 'deliveryDateBySupplier':
        setDeliveryDateBySupplier(value as Record<string, string>);
        saveState(key, value, onSaveError, activeSiteId);
        break;
      case 'nextDeliveryDateBySupplier':
        setNextDeliveryDateBySupplier(value as Record<string, string>);
        saveState(key, value, onSaveError, activeSiteId);
        break;
      case 'products': {
        const nextProducts = mergeAndNormalizeProducts(value as ProductWithHistory[]);
        setProducts(nextProducts);
        saveState(key, nextProducts, onSaveError, activeSiteId);
        break;
      }
      default:
        break;
    }

    setTimeout(() => {
      isHydratingFromCloud.current = false;
    }, 300);
  }, [
    activeSiteId,
    onSaveError,
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
      setSiteReady(false);
      setSupabaseLoaded(false);
      lastCloudUpdatedAtByKey.current = {};
      localTsByKey.current = {};
      pendingKeysRef.current.clear();
      siteLoadTokenRef.current += 1;
      const loadToken = siteLoadTokenRef.current;

      if (!activeSiteId) {
        applyStateSnapshot(emptySnapshot(), setters);
        setSupabaseLoaded(true);
        setSiteReady(true);
        return;
      }

      const allowLegacyFallback = activeSiteId === legacyBaseSiteId;
      const snapshot = emptySnapshot();
      snapshot.covers = ensureScopedLocalState('covers', snapshot.covers, activeSiteId, { allowLegacyFallback });
      snapshot.dailyCovers = ensureScopedLocalState('dailyCovers', snapshot.dailyCovers, activeSiteId, { allowLegacyFallback });
      snapshot.orderStates = ensureScopedLocalState('orderStates', snapshot.orderStates, activeSiteId, { allowLegacyFallback });
      snapshot.detailedInventory = ensureScopedLocalState('inventory', snapshot.detailedInventory, activeSiteId, { allowLegacyFallback });
      snapshot.salesHtByMonth = ensureScopedLocalState('salesHtByMonth', snapshot.salesHtByMonth, activeSiteId, { allowLegacyFallback });
      snapshot.costMatterByMonth = ensureScopedLocalState('costMatterByMonth', snapshot.costMatterByMonth, activeSiteId, { allowLegacyFallback });
      snapshot.validatedMonths = ensureScopedLocalState('validatedMonths', snapshot.validatedMonths, activeSiteId, { allowLegacyFallback });
      snapshot.supplierConfigs = mergeSupplierConfigsWithDefaults(
        ensureScopedLocalState('supplierConfigs', {}, activeSiteId, { allowLegacyFallback }) as Record<string, SupplierConfig>
      );
      snapshot.deliveryDateBySupplier = ensureScopedLocalState('deliveryDateBySupplier', snapshot.deliveryDateBySupplier, activeSiteId, { allowLegacyFallback });
      snapshot.nextDeliveryDateBySupplier = ensureScopedLocalState('nextDeliveryDateBySupplier', snapshot.nextDeliveryDateBySupplier, activeSiteId, { allowLegacyFallback });
      snapshot.products = createInitialProducts(
        ensureScopedLocalState('products', [] as ProductWithHistory[], activeSiteId, { allowLegacyFallback })
      );

      isHydratingFromCloud.current = true;
      applyStateSnapshot(snapshot, setters);

      if (!isSupabaseConfigured()) {
        if (!cancelled && siteLoadTokenRef.current === loadToken) {
          setSupabaseLoaded(true);
          setSiteReady(true);
          setTimeout(() => {
            isHydratingFromCloud.current = false;
          }, 300);
        }
        return;
      }

      try {
        const cloud = await loadAllFromSupabase(activeSiteId);
        if (cancelled || siteLoadTokenRef.current !== loadToken) return;

        if (cloud && cloud.length > 0) {
          const cloudMap: Record<string, unknown> = {};
          cloud.forEach(row => {
            lastCloudUpdatedAtByKey.current[row.key] = row.updated_at;
            cloudMap[row.key] = row.value;
          });

          if (cloudMap.covers) snapshot.covers = cloudMap.covers as Record<string, number>;
          if (cloudMap.dailyCovers && hasDailyCoverData(cloudMap.dailyCovers as DailyCoversState)) {
            snapshot.dailyCovers = cloudMap.dailyCovers as DailyCoversState;
          }
          if (cloudMap.orderStates) snapshot.orderStates = cloudMap.orderStates as Record<string, OrderState>;
          if (cloudMap.inventory) snapshot.detailedInventory = cloudMap.inventory as Record<string, string>;
          if (cloudMap.salesHtByMonth) snapshot.salesHtByMonth = cloudMap.salesHtByMonth as Record<string, number>;
          if (cloudMap.costMatterByMonth) snapshot.costMatterByMonth = cloudMap.costMatterByMonth as Record<string, number>;
          if (cloudMap.validatedMonths) snapshot.validatedMonths = cloudMap.validatedMonths as Record<string, boolean>;
          if (cloudMap.supplierConfigs) {
            snapshot.supplierConfigs = mergeSupplierConfigsWithDefaults(cloudMap.supplierConfigs as Record<string, SupplierConfig>);
          }
          if (cloudMap.deliveryDateBySupplier) {
            snapshot.deliveryDateBySupplier = cloudMap.deliveryDateBySupplier as Record<string, string>;
          }
          if (cloudMap.nextDeliveryDateBySupplier) {
            snapshot.nextDeliveryDateBySupplier = cloudMap.nextDeliveryDateBySupplier as Record<string, string>;
          }
          if (cloudMap.products) {
            snapshot.products = mergeAndNormalizeProducts(cloudMap.products as ProductWithHistory[]);
          }

          applyStateSnapshot(snapshot, setters);
          saveState('covers', snapshot.covers, onSaveError, activeSiteId);
          saveState('dailyCovers', snapshot.dailyCovers, onSaveError, activeSiteId);
          saveState('orderStates', snapshot.orderStates, onSaveError, activeSiteId);
          saveState('inventory', snapshot.detailedInventory, onSaveError, activeSiteId);
          saveState('salesHtByMonth', snapshot.salesHtByMonth, onSaveError, activeSiteId);
          saveState('costMatterByMonth', snapshot.costMatterByMonth, onSaveError, activeSiteId);
          saveState('validatedMonths', snapshot.validatedMonths, onSaveError, activeSiteId);
          saveState('supplierConfigs', snapshot.supplierConfigs, onSaveError, activeSiteId);
          saveState('deliveryDateBySupplier', snapshot.deliveryDateBySupplier, onSaveError, activeSiteId);
          saveState('nextDeliveryDateBySupplier', snapshot.nextDeliveryDateBySupplier, onSaveError, activeSiteId);
          saveState('products', snapshot.products, onSaveError, activeSiteId);
        }
      } catch (error) {
        console.error('[Supabase load exception]', error);
      } finally {
        if (!cancelled && siteLoadTokenRef.current === loadToken) {
          setSupabaseLoaded(true);
          setSiteReady(true);
          setTimeout(() => {
            isHydratingFromCloud.current = false;
          }, 300);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [activeSiteId, legacyBaseSiteId, onSaveError, setters]);

  useEffect(() => {
    if (!siteReady || !activeSiteId || !isSupabaseConfigured()) return;

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
        const rows = await loadKeysFromSupabase(activeSiteId, keys);
        if (!rows) return;
        rows.forEach(row => {
          lastCloudUpdatedAtByKey.current[row.key] = row.updated_at;
          applyCloudKey(row.key, row.updated_at, row.value);
        });
      } finally {
        pollingInFlightRef.current = false;
      }
    };

    const tick = async () => {
      if (cancelled || pollingInFlightRef.current || document?.hidden || syncStatus === 'saving') return;
      pollingInFlightRef.current = true;
      try {
        const meta = await loadMetaFromSupabase(activeSiteId);
        if (!meta) return;

        const changedKeys: string[] = [];
        meta.forEach(row => {
          if (!PARAMETER_KEYS.has(row.key)) return;
          const prev = lastCloudUpdatedAtByKey.current[row.key];
          if (!prev) {
            lastCloudUpdatedAtByKey.current[row.key] = row.updated_at;
            return;
          }
          if (prev !== row.updated_at) changedKeys.push(row.key);
        });

        if (changedKeys.length === 0) return;
        if (isUserEditing()) {
          changedKeys.forEach(key => pendingKeysRef.current.add(key));
          return;
        }

        const rows = await loadKeysFromSupabase(activeSiteId, changedKeys);
        if (!rows) return;
        rows.forEach(row => {
          lastCloudUpdatedAtByKey.current[row.key] = row.updated_at;
          applyCloudKey(row.key, row.updated_at, row.value);
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
  }, [activeSiteId, applyCloudKey, siteReady, syncStatus]);

  const persistEverywhere = useCallback((key: string, value: unknown) => {
    if (!activeSiteId || !siteReady) return;
    saveState(key, value, onSaveError, activeSiteId);
    if (isHydratingFromCloud.current || !supabaseLoaded || !isSupabaseConfigured()) return;

    const ts = nowIso();
    localTsByKey.current[key] = ts;
    setSyncStatus('saving');

    saveToSupabaseDebounced(
      activeSiteId,
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
  }, [activeSiteId, onSaveError, siteReady, supabaseLoaded]);

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
    siteReady,
  };
};
