// =============================================================
// hooks/useAppState.ts
// Hook personnalisé qui centralise TOUT l'état de l'application.
// Extrait du composant App principal pour le décharger.
//
// Pourquoi un hook ?
// - App.tsx n'a plus besoin de contenir 200 lignes de useState/useEffect
// - La logique métier est testable indépendamment
// - Les pages reçoivent exactement ce dont elles ont besoin
// =============================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
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
  loadSiteScopedState,
  loadState,
  mergeSupplierConfigsWithDefaults,
  saveState,
} from './appStateHelpers';
import { useProductActions } from './useProductActions';
import { useCloudSync } from './useCloudSync';

// -----------------------------------------------------------
// Hook principal
// -----------------------------------------------------------
export const useAppState = () => {
  // Toast — affichage des messages d'erreur
  const { showToast } = useToast();
  const { activeSiteId, allowedSites } = useAuth();

  const activeSite = useMemo(
    () => allowedSites.find((site) => site.id === activeSiteId) ?? null,
    [allowedSites, activeSiteId]
  );

  const useLegacySiteStorage = /thillois/i.test(activeSite?.name ?? '');
  const [siteStateReady, setSiteStateReady] = useState(false);

  // Navigation
  const [view, setView] = useState<View>(() => loadState<View>('currentView', 'home'));

  // Mode de calcul commandes (marge de sécurité ou stock cible)
  const [calculationMode, setCalculationMode] = useState<'margin' | 'target'>('margin');

  // Onglet actif sur la page Ratios
  const [ratioTab, setRatioTab] = useState<SupplierId>('doquet');

  // Modale de confirmation RAZ
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Calendrier de livraison affiché (id fournisseur ou null)
  const [activeCalendarSupplier, setActiveCalendarSupplier] = useState<string | null>(null);
  const [calendarAnchorRectBySupplier, setCalendarAnchorRectBySupplier] =
    useState<Record<string, DOMRect | null>>({});

  // Produit dont le popover de mapping est ouvert
  const [activeMappingId, setActiveMappingId] = useState<string | null>(null);

  // Sélection multi-produits (page Ratios)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  // --- États persistés (localStorage) ---
  const [deliveryDateBySupplier, setDeliveryDateBySupplier] =
    useState<Record<string, string>>(() => loadSiteScopedState('deliveryDateBySupplier', {}, activeSiteId, useLegacySiteStorage));

  const [nextDeliveryDateBySupplier, setNextDeliveryDateBySupplier] =
    useState<Record<string, string>>(() => loadSiteScopedState('nextDeliveryDateBySupplier', {}, activeSiteId, useLegacySiteStorage));

  const [covers, setCovers] =
    useState<Record<string, number>>(() => loadSiteScopedState('covers', INITIAL_COVERS, activeSiteId, useLegacySiteStorage));

  const [dailyCovers, setDailyCovers] =
    useState<DailyCoversState>(() => loadSiteScopedState('dailyCovers', DAILY_COVERS_INITIAL, activeSiteId, useLegacySiteStorage));

  const [orderStates, setOrderStates] =
    useState<Record<string, OrderState>>(() => loadSiteScopedState('orderStates', {}, activeSiteId, useLegacySiteStorage));

  const [detailedInventory, setDetailedInventory] =
    useState<Record<string, string>>(() => loadSiteScopedState('inventory', {}, activeSiteId, useLegacySiteStorage));

  const [salesHtByMonth, setSalesHtByMonth] =
    useState<Record<string, number>>(() => loadSiteScopedState('salesHtByMonth', INITIAL_COVERS, activeSiteId, useLegacySiteStorage));

  const [costMatterByMonth, setCostMatterByMonth] =
    useState<Record<string, number>>(() => loadSiteScopedState('costMatterByMonth', INITIAL_COVERS, activeSiteId, useLegacySiteStorage));

  const [validatedMonths, setValidatedMonths] =
    useState<Record<string, boolean>>(() => loadSiteScopedState('validatedMonths', {}, activeSiteId, useLegacySiteStorage));

  const [supplierConfigs, setSupplierConfigs] =
useState<Record<string, SupplierConfig>>(() => mergeSupplierConfigsWithDefaults(loadSiteScopedState<Record<string, SupplierConfig>>('supplierConfigs', {}, activeSiteId, useLegacySiteStorage)));

  const [products, setProducts] = useState<ProductWithHistory[]>(() =>
    createInitialProducts(loadSiteScopedState('products', [] as ProductWithHistory[], activeSiteId, useLegacySiteStorage))
  );

  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    } catch (_e) {
      window.scrollTo(0, 0);
    }
    saveState('currentView', view, onSaveError);
  }, [view]);


  useEffect(() => {
    setSiteStateReady(false);

    setDeliveryDateBySupplier(
      loadSiteScopedState('deliveryDateBySupplier', {}, activeSiteId, useLegacySiteStorage)
    );
    setNextDeliveryDateBySupplier(
      loadSiteScopedState('nextDeliveryDateBySupplier', {}, activeSiteId, useLegacySiteStorage)
    );
    setCovers(loadSiteScopedState('covers', INITIAL_COVERS, activeSiteId, useLegacySiteStorage));
    setDailyCovers(
      loadSiteScopedState('dailyCovers', DAILY_COVERS_INITIAL, activeSiteId, useLegacySiteStorage)
    );
    setOrderStates(loadSiteScopedState('orderStates', {}, activeSiteId, useLegacySiteStorage));
    setDetailedInventory(loadSiteScopedState('inventory', {}, activeSiteId, useLegacySiteStorage));
    setSalesHtByMonth(
      loadSiteScopedState('salesHtByMonth', INITIAL_COVERS, activeSiteId, useLegacySiteStorage)
    );
    setCostMatterByMonth(
      loadSiteScopedState('costMatterByMonth', INITIAL_COVERS, activeSiteId, useLegacySiteStorage)
    );
    setValidatedMonths(
      loadSiteScopedState('validatedMonths', {}, activeSiteId, useLegacySiteStorage)
    );
    setSupplierConfigs(
      mergeSupplierConfigsWithDefaults(
        loadSiteScopedState<Record<string, SupplierConfig>>(
          'supplierConfigs',
          {},
          activeSiteId,
          useLegacySiteStorage
        )
      )
    );
    setProducts(
      createInitialProducts(
        loadSiteScopedState('products', [] as ProductWithHistory[], activeSiteId, useLegacySiteStorage)
      )
    );

    const timer = window.setTimeout(() => setSiteStateReady(true), 0);
    return () => window.clearTimeout(timer);
  }, [activeSiteId, useLegacySiteStorage]);


  // --- Persistance automatique à chaque changement ---
  const onSaveError = (msg: string) => showToast(msg, 'error');
  const { supabaseLoaded, syncStatus } = useCloudSync({
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
  });

  // --- Valeurs calculées ---

  // Total couverts prévisionnels (toutes périodes confondues)
  const totalForecast = useMemo(() => {
    let sum = 0;
    Object.values(dailyCovers).forEach(m =>
      m.forEach(d => { sum += (Number(d.midi) || 0) + (Number(d.soir) || 0); })
    );
    return sum;
  }, [dailyCovers]);

  // Mois cible d'import: premier mois non figé disposant d'un CSV, sinon fallback sur le premier mois importé
  const importTargetMonth = useMemo(() => {
    const firstOpenWithCsv = MONTHS_ORDER.find(m => !validatedMonths[m] && !!detailedInventory[m]);
    if (firstOpenWithCsv) return firstOpenWithCsv;
    const firstWithCsv = MONTHS_ORDER.find(m => !!detailedInventory[m]);
    return firstWithCsv ?? MONTHS_ORDER[0];
  }, [detailedInventory, validatedMonths]);

  // Ensemble des noms disponibles dans le CSV du mois cible (pour le mapping et les alertes unmatched)
  const allAvailableImportNames = useMemo(
    () => extractAllNamesFromCsvs(
      detailedInventory[importTargetMonth]
        ? { [importTargetMonth]: detailedInventory[importTargetMonth] }
        : {}
    ),
    [detailedInventory, importTargetMonth]
  );

  // --- Actions sur les produits ---

  // Calcule les stats (ratio moyen, ventes mensuelles) pour un produit
  const getProductStats = useCallback((p: ProductWithHistory) => {
    let totalR = 0, countR = 0;
    const mR: Record<string, number> = {};
    const mS: Record<string, { value: number; isImported: boolean; isValidated: boolean }> = {};

    // RÈGLE PERF (workMonth) :
    // - Mois figés (validated) : on affiche uniquement le snapshot (salesHistory) -> jamais de lecture CSV
    // - Mois de travail (importTargetMonth) : seul mois autorisé à lire/parsing CSV + matching/alertes
    // - Autres mois non figés : 0 (pas de parsing, pas de fallback salesHistory)
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

  // Valide / dévalide un mois (fige les valeurs importées dans l'historique)
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
    // Navigation
    view, setView,
    calculationMode, setCalculationMode,
    ratioTab, setRatioTab,

    // Modales / UI
    showResetConfirm, setShowResetConfirm,
    activeCalendarSupplier, setActiveCalendarSupplier,
    calendarAnchorRectBySupplier, setCalendarAnchorRectBySupplier,
    activeMappingId, setActiveMappingId,
    selectedProductIds, setSelectedProductIds,

    // Données persistées
    deliveryDateBySupplier, setDeliveryDateBySupplier,
    nextDeliveryDateBySupplier, setNextDeliveryDateBySupplier,
    covers, setCovers,
    dailyCovers, setDailyCovers,
    orderStates, setOrderStates,
    detailedInventory, setDetailedInventory,
    salesHtByMonth, setSalesHtByMonth,
    costMatterByMonth, setCostMatterByMonth,
    validatedMonths,
    importTargetMonth,
    supplierConfigs, setSupplierConfigs,
    products, setProducts,

    // Valeurs calculées
    totalForecast,
    allAvailableImportNames,

    // Actions
    getProductStats,
    toggleValidateMonth,
    updateProductValue,
    syncStatus,
    supabaseLoaded,
    updateSearchName,
    updateImportDivisor,
    performReset,
    addNewProduct,
    deleteSelectedProducts,
    toggleProductSelection,
    moveProduct,
    handleNameChange,
  };
};


export type AppState = ReturnType<typeof useAppState>;
