import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useToast } from '../components/Toast';
import {
  MONTHLY_COVERS as INITIAL_COVERS,
  ProductWithHistory,
  DAILY_COVERS_INITIAL,
} from '../data';
import { OrderState, SupplierConfig } from '../types';
import { MONTHS_ORDER, View, SupplierId } from '../constants';
import { DailyCoversState } from '../utils/dateHelpers';
import { getImportedValueForProduct, extractAllNamesFromCsvs } from '../utils/csvHelpers';
import {
  createInitialProducts,
  loadState,
  loadScopedState,
  mergeSupplierConfigsWithDefaults,
  migrateLegacyStateToSite,
  saveState,
} from './appStateHelpers';
import { useProductActions } from './useProductActions';
import { useCloudSync } from './useCloudSync';
import { useAuth } from '../auth/AuthProvider';

const normalizeName = (value: string | null | undefined): string =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const isLegacyThilloisSite = (siteName: string | null): boolean => normalizeName(siteName).includes('thillois');

const getSiteBundle = (siteId: string | null, siteName: string | null) => {
  const loadForSite = <T,>(key: string, defaultValue: T): T => {
    if (!siteId) return defaultValue;
    if (isLegacyThilloisSite(siteName)) {
      return migrateLegacyStateToSite(siteId, key, defaultValue);
    }
    return loadScopedState(siteId, key, defaultValue);
  };

  return {
    deliveryDateBySupplier: loadForSite<Record<string, string>>('deliveryDateBySupplier', {}),
    nextDeliveryDateBySupplier: loadForSite<Record<string, string>>('nextDeliveryDateBySupplier', {}),
    covers: loadForSite<Record<string, number>>('covers', INITIAL_COVERS),
    dailyCovers: loadForSite<DailyCoversState>('dailyCovers', DAILY_COVERS_INITIAL),
    orderStates: loadForSite<Record<string, OrderState>>('orderStates', {}),
    detailedInventory: loadForSite<Record<string, string>>('inventory', {}),
    salesHtByMonth: loadForSite<Record<string, number>>('salesHtByMonth', INITIAL_COVERS),
    costMatterByMonth: loadForSite<Record<string, number>>('costMatterByMonth', INITIAL_COVERS),
    validatedMonths: loadForSite<Record<string, boolean>>('validatedMonths', {}),
    supplierConfigs: mergeSupplierConfigsWithDefaults(loadForSite<Record<string, SupplierConfig>>('supplierConfigs', {})),
    products: createInitialProducts(loadForSite('products', [] as ProductWithHistory[])),
  };
};

export const useAppState = () => {
  const { showToast } = useToast();
  const { activeSiteId, allowedSites } = useAuth();
  const activeSiteName = useMemo(
    () => allowedSites.find((site) => site.id === activeSiteId)?.name ?? null,
    [allowedSites, activeSiteId],
  );

  const [view, setView] = useState<View>(() => loadState<View>('currentView', 'home'));
  const [calculationMode, setCalculationMode] = useState<'margin' | 'target'>('margin');
  const [ratioTab, setRatioTab] = useState<SupplierId>('doquet');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [activeCalendarSupplier, setActiveCalendarSupplier] = useState<string | null>(null);
  const [calendarAnchorRectBySupplier, setCalendarAnchorRectBySupplier] = useState<Record<string, DOMRect | null>>({});
  const [activeMappingId, setActiveMappingId] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [siteScopeReady, setSiteScopeReady] = useState(false);
  const lastLoadedSiteIdRef = useRef<string | null>(null);

  const [deliveryDateBySupplier, setDeliveryDateBySupplier] = useState<Record<string, string>>({});
  const [nextDeliveryDateBySupplier, setNextDeliveryDateBySupplier] = useState<Record<string, string>>({});
  const [covers, setCovers] = useState<Record<string, number>>(INITIAL_COVERS);
  const [dailyCovers, setDailyCovers] = useState<DailyCoversState>(DAILY_COVERS_INITIAL);
  const [orderStates, setOrderStates] = useState<Record<string, OrderState>>({});
  const [detailedInventory, setDetailedInventory] = useState<Record<string, string>>({});
  const [salesHtByMonth, setSalesHtByMonth] = useState<Record<string, number>>(INITIAL_COVERS);
  const [costMatterByMonth, setCostMatterByMonth] = useState<Record<string, number>>(INITIAL_COVERS);
  const [validatedMonths, setValidatedMonths] = useState<Record<string, boolean>>({});
  const [supplierConfigs, setSupplierConfigs] = useState<Record<string, SupplierConfig>>(mergeSupplierConfigsWithDefaults({}));
  const [products, setProducts] = useState<ProductWithHistory[]>(createInitialProducts([]));

  useEffect(() => {
    if (!activeSiteId) {
      lastLoadedSiteIdRef.current = null;
      setSiteScopeReady(false);
      return;
    }

    setSiteScopeReady(false);
    const bundle = getSiteBundle(activeSiteId, activeSiteName);

    setDeliveryDateBySupplier(bundle.deliveryDateBySupplier);
    setNextDeliveryDateBySupplier(bundle.nextDeliveryDateBySupplier);
    setCovers(bundle.covers);
    setDailyCovers(bundle.dailyCovers);
    setOrderStates(bundle.orderStates);
    setDetailedInventory(bundle.detailedInventory);
    setSalesHtByMonth(bundle.salesHtByMonth);
    setCostMatterByMonth(bundle.costMatterByMonth);
    setValidatedMonths(bundle.validatedMonths);
    setSupplierConfigs(bundle.supplierConfigs);
    setProducts(bundle.products);

    lastLoadedSiteIdRef.current = activeSiteId;
    const timer = window.setTimeout(() => setSiteScopeReady(true), 0);
    return () => window.clearTimeout(timer);
  }, [activeSiteId, activeSiteName]);

  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    } catch (_e) {
      window.scrollTo(0, 0);
    }
    saveState('currentView', view, (msg: string) => showToast(msg, 'error'));
  }, [view, showToast]);

  const onSaveError = (msg: string) => showToast(msg, 'error');
  const { supabaseLoaded, syncStatus } = useCloudSync({
    activeSiteId,
    activeSiteName,
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
  });

  const totalForecast = useMemo(() => {
    let sum = 0;
    Object.values(dailyCovers).forEach(m =>
      m.forEach(d => { sum += (Number(d.midi) || 0) + (Number(d.soir) || 0); })
    );
    return sum;
  }, [dailyCovers]);

  const importTargetMonth = useMemo(() => {
    const firstOpenWithCsv = MONTHS_ORDER.find(m => !validatedMonths[m] && !!detailedInventory[m]);
    if (firstOpenWithCsv) return firstOpenWithCsv;
    const firstWithCsv = MONTHS_ORDER.find(m => !!detailedInventory[m]);
    return firstWithCsv ?? MONTHS_ORDER[0];
  }, [detailedInventory, validatedMonths]);

  const allAvailableImportNames = useMemo(
    () => extractAllNamesFromCsvs(
      detailedInventory[importTargetMonth]
        ? { [importTargetMonth]: detailedInventory[importTargetMonth] }
        : {}
    ),
    [detailedInventory, importTargetMonth]
  );

  const getProductStats = useCallback((p: ProductWithHistory) => {
    let totalR = 0, countR = 0;
    const mR: Record<string, number> = {};
    const mS: Record<string, { value: number; isImported: boolean; isValidated: boolean }> = {};

    MONTHS_ORDER.forEach(m => {
      const isValidated = validatedMonths[m] || false;
      const isWorkMonth = m === importTargetMonth;

      let importedVal: number | null = null;
      let val = 0;

      if (isValidated) {
        val = Math.round(p.salesHistory[m] || 0);
      } else if (isWorkMonth) {
        importedVal = getImportedValueForProduct(detailedInventory[m], p.searchName, p.importDivisor);
        val = importedVal ?? 0;
      } else {
        val = 0;
      }

      const c = covers[m] || 1;
      const r = val / c;

      mS[m] = { value: val, isImported: !isValidated && isWorkMonth && importedVal !== null, isValidated };
      mR[m] = r;

      if (val > 0) { totalR += r; countR++; }
    });

    return { avgRatio: countR > 0 ? totalR / countR : 0, mR, mS };
  }, [detailedInventory, validatedMonths, covers, importTargetMonth]);

  const toggleValidateMonth = (m: string) => {
    const next = !validatedMonths[m];
    if (next) {
      setProducts(prev => prev.map(p => ({
        ...p,
        salesHistory: { ...p.salesHistory, [m]: Math.round(getProductStats(p).mS[m].value) },
      })));
    }
    setValidatedMonths(prev => ({ ...prev, [m]: next }));
  };

  const {
    updateProductValue,
    performReset,
    addNewProduct,
    deleteSelectedProducts,
    toggleProductSelection,
    moveProduct,
    handleNameChange,
    updateSearchName,
    updateImportDivisor,
  } = useProductActions({
    products,
    view,
    ratioTab,
    selectedProductIds,
    setProducts,
    setSelectedProductIds,
    setShowResetConfirm,
    showToast,
  });

  return {
    view, setView,
    calculationMode, setCalculationMode,
    ratioTab, setRatioTab,
    showResetConfirm, setShowResetConfirm,
    activeCalendarSupplier, setActiveCalendarSupplier,
    calendarAnchorRectBySupplier, setCalendarAnchorRectBySupplier,
    activeMappingId, setActiveMappingId,
    selectedProductIds, setSelectedProductIds,

    deliveryDateBySupplier, setDeliveryDateBySupplier,
    nextDeliveryDateBySupplier, setNextDeliveryDateBySupplier,
    covers, setCovers,
    dailyCovers, setDailyCovers,
    orderStates, setOrderStates,
    detailedInventory, setDetailedInventory,
    salesHtByMonth, setSalesHtByMonth,
    costMatterByMonth, setCostMatterByMonth,
    validatedMonths, setValidatedMonths,
    supplierConfigs, setSupplierConfigs,
    products, setProducts,

    supabaseLoaded,
    syncStatus,
    siteScopeReady,
    activeSiteId,
    activeSiteName,

    totalForecast,
    importTargetMonth,
    allAvailableImportNames,
    getProductStats,
    toggleValidateMonth,

    updateProductValue,
    performReset,
    addNewProduct,
    deleteSelectedProducts,
    toggleProductSelection,
    moveProduct,
    handleNameChange,
    updateSearchName,
    updateImportDivisor,
  };
};

export type AppState = ReturnType<typeof useAppState>;
