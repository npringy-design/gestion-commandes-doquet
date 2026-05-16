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
import { useToast } from '../components/Toast';
import {
  MONTHLY_COVERS as INITIAL_COVERS,
  ProductWithHistory,
  DAILY_COVERS_INITIAL,
} from '../data';
import { OrderState, SupplierConfig, PrepBatch, PrepItem, PrepImportsByMonth, PrepForecastsByDate, PrepSheetStocks, OrderParameterRow } from '../types';
import { MONTHS_ORDER, View, SupplierId } from '../constants';
import { DailyCoversState } from '../utils/dateHelpers';
import { getImportedValueForProduct, extractAllNamesFromCsvs } from '../utils/csvHelpers';
import {
  createInitialProducts,
  loadUiState,
  loadState,
  mergeSupplierConfigsWithDefaults,
  saveState,
  saveUiState,
} from './appStateHelpers';
import { useProductActions } from './useProductActions';
import { useCloudSync } from './useCloudSync';

type RatioProductMonthSnapshot = {
  salesValue: number;
  ratio: number;
  productName: string;
  searchName: string;
  mappingId?: string;
  isLinked: boolean;
};

type ProductWithRatioSnapshots = ProductWithHistory & {
  ratioSnapshots?: Record<string, RatioProductMonthSnapshot>;
};

type PrepItemWithSnapshots = PrepItem & {
  ratioSnapshots?: Record<string, {
    value: number;
    ratio: number;
    itemName: string;
    searchName: string;
    mappings: string[];
    isLinked: boolean;
  }>;
};

const normalizeRatioMappingId = (value?: string) => String(value || '').trim().toLowerCase();

const getRatioSnapshot = (product: ProductWithHistory, month: string) =>
  (product as ProductWithRatioSnapshots).ratioSnapshots?.[month];

const roundRatioImportedValue = (value: number | null) =>
  value == null ? null : Math.ceil(value);

// -----------------------------------------------------------
// Hook principal
// -----------------------------------------------------------
export const useAppState = () => {
  // Toast — affichage des messages d'erreur
  const { showToast } = useToast();

  // Navigation
  const [view, setView] = useState<View>(() => loadUiState<View>('currentView', 'home'));

  // Mode de calcul commandes (marge de sécurité ou stock cible)
  const [calculationMode, setCalculationMode] = useState<'margin' | 'target'>('margin');

  // Onglet actif sur la page Ratios
  const [ratioTab, setRatioTab] = useState<SupplierId>(() => loadState<SupplierId>('ratioTab', 'doquet'));

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

  // --- Etats metier persistés dans Supabase ---
  const [deliveryDateBySupplier, setDeliveryDateBySupplier] =
    useState<Record<string, string>>({});

  const [nextDeliveryDateBySupplier, setNextDeliveryDateBySupplier] =
    useState<Record<string, string>>({});

  const [covers, setCovers] =
    useState<Record<string, number>>(INITIAL_COVERS);

  const [dailyCovers, setDailyCovers] =
    useState<DailyCoversState>(DAILY_COVERS_INITIAL);

  const [orderStates, setOrderStates] =
    useState<Record<string, OrderState>>({});

  const [detailedInventory, setDetailedInventory] =
    useState<Record<string, string>>({});

  const [salesHtByMonth, setSalesHtByMonth] =
    useState<Record<string, number>>(INITIAL_COVERS);

  const [costMatterByMonth, setCostMatterByMonth] =
    useState<Record<string, number>>(INITIAL_COVERS);

  // Figeage propre à la page Calcul vente ratio.
  // On garde la clé cloud existante `validatedMonths` pour ne pas casser la synchro Supabase,
  // mais on n'expose plus ce verrou à la page Paramètres.
  const [ratioValidatedMonths, setRatioValidatedMonths] =
    useState<Record<string, boolean>>({});

  // La page Paramètres doit rester modifiable : le figé ratio ne doit pas la verrouiller.
  const validatedMonths = useMemo<Record<string, boolean>>(() => ({}), []);

  const [prepValidatedMonths, setPrepValidatedMonths] =
    useState<Record<string, boolean>>({});

  const [supplierConfigs, setSupplierConfigs] =
useState<Record<string, SupplierConfig>>(() => mergeSupplierConfigsWithDefaults({}));

  const [orderParameterRows, setOrderParameterRows] =
    useState<OrderParameterRow[]>([]);

  const [products, setProducts] = useState<ProductWithHistory[]>(() =>
    createInitialProducts([])
  );

  // Produits supprimés volontairement dans Calcul vente ratio.
  // Garde-fou contre un rechargement cloud/import qui réinjecte les produits quelques secondes après.
  const [deletedRatioProductIds, setDeletedRatioProductIds] =
    useState<string[]>([]);

  const deletedRatioProductIdSet = useMemo(
    () => new Set(deletedRatioProductIds),
    [deletedRatioProductIds]
  );

  const visibleProducts = useMemo(
    () => products.filter(p => !deletedRatioProductIdSet.has(p.id)),
    [products, deletedRatioProductIdSet]
  );

  const setProductsWithoutDeleted = useCallback((updater: ProductWithHistory[] | ((prev: ProductWithHistory[]) => ProductWithHistory[])) => {
    setProducts(prev => {
      const next = typeof updater === 'function'
        ? (updater as (prev: ProductWithHistory[]) => ProductWithHistory[])(prev)
        : updater;

      if (!deletedRatioProductIdSet.size) return next;
      return next.filter(p => !deletedRatioProductIdSet.has(p.id));
    });
  }, [deletedRatioProductIdSet]);

  const [prepItems, setPrepItems] =
    useState<PrepItem[]>([]);

  const [prepImportsByMonth, setPrepImportsByMonth] =
    useState<PrepImportsByMonth>({});

  const [prepSheetStocks, setPrepSheetStocks] =
    useState<PrepSheetStocks>({});

  const [prepBatches, setPrepBatches] =
    useState<PrepBatch[]>([]);

  const [prepForecasts, setPrepForecasts] =
    useState<PrepForecastsByDate>({});

  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    } catch (_e) {
      window.scrollTo(0, 0);
    }
    saveUiState('currentView', view);
  }, [view]);

  // --- Persistance automatique à chaque changement ---
  const onSaveError = (msg: string) => showToast(msg, 'error');

  useEffect(() => {
    saveState('ratioTab', ratioTab, onSaveError);
  }, [ratioTab]);

  const { supabaseLoaded, syncStatus } = useCloudSync({
    covers,
    dailyCovers,
    orderStates,
    detailedInventory,
    salesHtByMonth,
    costMatterByMonth,
    validatedMonths: ratioValidatedMonths,
    prepValidatedMonths,
    supplierConfigs,
    orderParameterRows,
    deliveryDateBySupplier,
    nextDeliveryDateBySupplier,
    products: visibleProducts,
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
    setValidatedMonths: setRatioValidatedMonths,
    setPrepValidatedMonths,
    setSupplierConfigs,
    setOrderParameterRows,
    setDeliveryDateBySupplier,
    setNextDeliveryDateBySupplier,
    setProducts: setProductsWithoutDeleted,
    setPrepItems,
    setPrepImportsByMonth,
    setPrepSheetStocks,
    setPrepBatches,
    setPrepForecasts,
    onSaveError,
  });

  useEffect(() => {
    if (!deletedRatioProductIdSet.size) return;

    setProducts(prev => {
      const filtered = prev.filter(p => !deletedRatioProductIdSet.has(p.id));
      return filtered.length === prev.length ? prev : filtered;
    });

    setSelectedProductIds(prev => {
      let changed = false;
      const next = new Set<string>();

      prev.forEach(id => {
        if (deletedRatioProductIdSet.has(id)) {
          changed = true;
        } else {
          next.add(id);
        }
      });

      return changed ? next : prev;
    });
  }, [deletedRatioProductIdSet]);

  // --- Valeurs calculées ---

  // Total couverts prévisionnels (toutes périodes confondues)
  const totalForecast = useMemo(() => {
    let sum = 0;
    (Object.values(dailyCovers) as DailyCoversState[string][]).forEach(m =>
      m.forEach(d => { sum += (Number(d.midi) || 0) + (Number(d.soir) || 0); })
    );
    return sum;
  }, [dailyCovers]);

  // Mois cible d'import inventaire: premier mois non figé disposant d'un CSV, sinon fallback sur le premier mois importé
  const importTargetMonth = useMemo(() => {
    const firstOpenWithCsv = MONTHS_ORDER.find(m => !ratioValidatedMonths[m] && !!detailedInventory[m]);
    if (firstOpenWithCsv) return firstOpenWithCsv;
    const firstWithCsv = MONTHS_ORDER.find(m => !!detailedInventory[m]);
    return firstWithCsv ?? MONTHS_ORDER[0];
  }, [detailedInventory, ratioValidatedMonths]);

  // Mois cible d'import production: indépendant du figé ventes
  const prepImportTargetMonth = useMemo(() => {
    const firstOpenWithCsv = MONTHS_ORDER.find(m => !prepValidatedMonths[m] && !!prepImportsByMonth[m]);
    if (firstOpenWithCsv) return firstOpenWithCsv;
    const firstWithCsv = MONTHS_ORDER.find(m => !!prepImportsByMonth[m]);
    return firstWithCsv ?? MONTHS_ORDER[0];
  }, [prepImportsByMonth, prepValidatedMonths]);

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
    // - Mois figés (validated) : on affiche uniquement le snapshot figé -> jamais de lecture CSV
    // - Mois de travail (importTargetMonth) : seul mois autorisé à lire/parsing CSV + matching/alertes
    // - Autres mois non figés : 0 (pas de parsing, pas de fallback salesHistory)
    MONTHS_ORDER.forEach(m => {
      const isValidated = ratioValidatedMonths[m] || false;
      const isWorkMonth = m === importTargetMonth;

      let importedVal: number | null = null;
      let val = 0;
      let r = 0;
      const snapshot = getRatioSnapshot(p, m);

      if (isValidated) {
        val = snapshot?.salesValue ?? p.salesHistory[m] ?? 0;
      } else if (isWorkMonth) {
        importedVal = getImportedValueForProduct(detailedInventory[m], p.searchName, p.importDivisor);
        val = roundRatioImportedValue(importedVal) ?? 0;
      } else {
        val = 0;
      }

      const c = covers[m] || 1;
      r = isValidated && snapshot ? Number(snapshot.ratio || 0) : val / c;

      mS[m] = { value: val, isImported: !isValidated && isWorkMonth && importedVal !== null, isValidated };
      mR[m] = r;

      if (val > 0) { totalR += r; countR++; }
    });

    return { avgRatio: countR > 0 ? totalR / countR : 0, mR, mS };
  }, [detailedInventory, ratioValidatedMonths, covers, importTargetMonth]);

  // Valide / dévalide un mois (fige les valeurs importées dans l'historique)
  const toggleValidateMonth = (m: string) => {
    const next = !ratioValidatedMonths[m];
    if (next) {
      const importNamesForMonth = extractAllNamesFromCsvs(
        detailedInventory[m] ? { [m]: detailedInventory[m] } : {}
      );
      const normalizedImportNamesForMonth = new Set(
        Array.from(importNamesForMonth).map(normalizeRatioMappingId)
      );

      setProducts(prev => prev.map(p => {
        const importedValue = getImportedValueForProduct(detailedInventory[m], p.searchName, p.importDivisor);
        const salesValue = roundRatioImportedValue(importedValue) ?? getProductStats(p).mS[m].value;
        const monthCovers = covers[m] || 1;
        const ratio = salesValue / monthCovers;
        const searchName = String(p.searchName || '');
        const mappingId = normalizeRatioMappingId(searchName);
        const isLinked = mappingId.length > 0 && normalizedImportNamesForMonth.has(mappingId) && salesValue > 0;
        const previousSnapshots = (p as ProductWithRatioSnapshots).ratioSnapshots || {};

        return {
          ...p,
          salesHistory: { ...p.salesHistory, [m]: salesValue },
          ratioSnapshots: {
            ...previousSnapshots,
            [m]: {
              salesValue,
              ratio,
              productName: p.name,
              searchName,
              mappingId: mappingId || undefined,
            isLinked,
            },
          },
        };
      }));
    }
    setRatioValidatedMonths(prev => ({ ...prev, [m]: next }));
  };

  // Valide / dévalide un mois production (fige les valeurs importées dans ratioHistory des prepItems)
  const togglePrepValidateMonth = (m: string) => {
    const next = !prepValidatedMonths[m];
    if (next) {
      setPrepItems(prev => prev.map(item => {
        let importedVal = 0;
        const mappingNames = String(item.searchName || '')
          .split(' || ')
          .map(name => name.trim())
          .filter(Boolean);

        mappingNames.forEach(mappingName => {
          importedVal += Number(getImportedValueForProduct(prepImportsByMonth[m], mappingName, item.importDivisor, ['Nombre']) || 0);
        });

        const monthCovers = Number(covers[m] || 0);
        const ratio = monthCovers > 0 ? importedVal / monthCovers : 0;
        const previousSnapshots = (item as PrepItemWithSnapshots).ratioSnapshots || {};

        return {
          ...item,
          ratioHistory: { ...item.ratioHistory, [m]: ratio },
          ratioSnapshots: {
            ...previousSnapshots,
            [m]: {
              value: importedVal,
              ratio,
              itemName: item.name,
              searchName: item.searchName,
              mappings: mappingNames,
              isLinked: mappingNames.length > 0 && importedVal > 0,
            },
          },
        };
      }));
    }
    setPrepValidatedMonths(prev => ({ ...prev, [m]: next }));
  };

  const {
    updateProductValue,
    performReset,
    addNewProduct,
    deleteSelectedProducts: deleteSelectedProductsBase,
    toggleProductSelection,
    moveProduct,
    handleNameChange,
    updateSearchName,
    updateImportDivisor,
  } = useProductActions({
    products: visibleProducts,
    view,
    ratioTab,
    selectedProductIds,
    setProducts: setProductsWithoutDeleted,
    setSelectedProductIds,
    setShowResetConfirm,
    showToast,
  });

  const deleteSelectedProducts = useCallback(() => {
    const idsToDelete = Array.from(selectedProductIds);
    if (idsToDelete.length > 0) {
      setDeletedRatioProductIds(prev => Array.from(new Set([...prev, ...idsToDelete])));
    }
    deleteSelectedProductsBase();
  }, [deleteSelectedProductsBase, selectedProductIds]);


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
    ratioValidatedMonths,
    prepValidatedMonths,
    importTargetMonth,
    prepImportTargetMonth,
    supplierConfigs, setSupplierConfigs,
    orderParameterRows, setOrderParameterRows,
    products: visibleProducts, setProducts: setProductsWithoutDeleted,
    prepItems, setPrepItems,
    prepImportsByMonth, setPrepImportsByMonth,
    prepSheetStocks, setPrepSheetStocks,
    prepBatches, setPrepBatches,
    prepForecasts, setPrepForecasts,

    // Valeurs calculées
    totalForecast,
    allAvailableImportNames,

    // Actions
    getProductStats,
    toggleValidateMonth,
    togglePrepValidateMonth,
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
