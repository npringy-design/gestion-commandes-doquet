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
import { SupplierConfig, PrepBatch, PrepItem, PrepImportsByMonth, PrepForecastsByDate, PrepSheetStocks, OrderTemplateRow, OrderTemplatesBySupplier } from '../types';
import { MONTHS_ORDER, View, SupplierId } from '../constants';
import { DailyCoversState } from '../utils/dateHelpers';
import { getImportedValueForProduct, extractAllNamesFromCsvs, matchesImportedProductName } from '../utils/csvHelpers';
import {
  createInitialProducts,
  loadUiState,
  loadState,
  mergeProductsWithOrderLines,
  mergeSupplierConfigsWithDefaults,
  saveState,
  saveUiState,
} from './appStateHelpers';
import { useProductActions } from './useProductActions';
import { useCloudSync } from './useCloudSync';
import {
  clearRatioProductMonthOverrides,
  isRatioProductMonthFrozen as resolveRatioProductMonthFrozen,
  isRatioSupplierMonthFrozen as resolveRatioSupplierMonthFrozen,
  openNewRatioProductsForMonth,
  setRatioProductMonthUnfrozen,
  setRatioSupplierMonthFreeze,
  type RatioProductMonthUnfreezeMap,
  type RatioSupplierMonthFreezeMap,
} from '../utils/ratioFreezeModel';

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

  // Portée moderne du figement vente : fournisseur + mois, avec une
  // exception persistante possible pour rouvrir un seul produit.
  // Le statut global ci-dessus reste le filet de migration des anciens comptes.
  const [ratioValidatedMonthsBySupplier, setRatioValidatedMonthsBySupplier] =
    useState<RatioSupplierMonthFreezeMap>({});

  const [ratioProductUnfrozenMonths, setRatioProductUnfrozenMonths] =
    useState<RatioProductMonthUnfreezeMap>({});

  // La page Paramètres doit rester modifiable : le figé ratio ne doit pas la verrouiller.
  const validatedMonths = useMemo<Record<string, boolean>>(() => ({}), []);

  const [prepValidatedMonths, setPrepValidatedMonths] =
    useState<Record<string, boolean>>({});

  const [supplierConfigs, setSupplierConfigs] =
useState<Record<string, SupplierConfig>>(() => mergeSupplierConfigsWithDefaults({}));

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

  const [orderTemplateRows, setOrderTemplateRows] =
    useState<OrderTemplateRow[]>([]);

  const [orderTemplatesBySupplier, setOrderTemplatesBySupplier] =
    useState<OrderTemplatesBySupplier>({});

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

  const { supabaseLoaded, syncStatus, orderLineStates, updateOrderLineField, deleteOrderLineForProduct } = useCloudSync({
    covers,
    dailyCovers,
    detailedInventory,
    salesHtByMonth,
    costMatterByMonth,
    validatedMonths: ratioValidatedMonths,
    ratioValidatedMonthsBySupplier,
    ratioProductUnfrozenMonths,
    prepValidatedMonths,
    supplierConfigs,
    deliveryDateBySupplier,
    nextDeliveryDateBySupplier,
    products: visibleProducts,
    prepItems,
    prepImportsByMonth,
    prepSheetStocks,
    prepBatches,
    prepForecasts,
    orderTemplateRows,
    orderTemplatesBySupplier,
    setCovers,
    setDailyCovers,
    setDetailedInventory,
    setSalesHtByMonth,
    setCostMatterByMonth,
    setValidatedMonths: setRatioValidatedMonths,
    setRatioValidatedMonthsBySupplier,
    setRatioProductUnfrozenMonths,
    setPrepValidatedMonths,
    setSupplierConfigs,
    setDeliveryDateBySupplier,
    setNextDeliveryDateBySupplier,
    setProducts: setProductsWithoutDeleted,
    setPrepItems,
    setPrepImportsByMonth,
    setPrepSheetStocks,
    setPrepBatches,
    setPrepForecasts,
    setOrderTemplateRows,
    setOrderTemplatesBySupplier,
    onSaveError,
  });

  // Vue produits fusionnée : les champs opérationnels (stock/upcomingDelivery/
  // targetStock/packaging) viennent de order_line_states (une ligne par
  // produit, synchro temps réel), pas du blob `products`. Sélecteur unique
  // (mergeProductsWithOrderLines) réutilisé partout où les produits sont lus,
  // pour ne jamais lire product.stock/etc. directement.
  const mergedProducts = useMemo(
    () => mergeProductsWithOrderLines(visibleProducts, orderLineStates),
    [visibleProducts, orderLineStates]
  );

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
    const firstOpenWithCsv = MONTHS_ORDER.find(m => (
      !!detailedInventory[m] && products.some(p => !resolveRatioProductMonthFrozen(
        ratioValidatedMonths,
        ratioValidatedMonthsBySupplier,
        ratioProductUnfrozenMonths,
        String(p.supplierId || 'doquet'),
        p.id,
        m,
      ))
    ));
    if (firstOpenWithCsv) return firstOpenWithCsv;
    const firstWithCsv = MONTHS_ORDER.find(m => !!detailedInventory[m]);
    return firstWithCsv ?? MONTHS_ORDER[0];
  }, [detailedInventory, products, ratioProductUnfrozenMonths, ratioValidatedMonths, ratioValidatedMonthsBySupplier]);

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

  const getRatioWorkMonthForSupplier = useCallback((supplierId: string) => {
    const supplierProducts = products.filter(
      p => String(p.supplierId || 'doquet') === supplierId,
    );
    const firstOpenWithCsv = MONTHS_ORDER.find(m => {
      if (!detailedInventory[m]) return false;
      if (supplierProducts.length === 0) {
        return !resolveRatioSupplierMonthFrozen(
          ratioValidatedMonths,
          ratioValidatedMonthsBySupplier,
          supplierId,
          m,
        );
      }
      return supplierProducts.some(p => !resolveRatioProductMonthFrozen(
        ratioValidatedMonths,
        ratioValidatedMonthsBySupplier,
        ratioProductUnfrozenMonths,
        supplierId,
        p.id,
        m,
      ));
    });
    if (firstOpenWithCsv) return firstOpenWithCsv;
    return MONTHS_ORDER.find(m => !!detailedInventory[m]) ?? MONTHS_ORDER[0];
  }, [detailedInventory, products, ratioProductUnfrozenMonths, ratioValidatedMonths, ratioValidatedMonthsBySupplier]);

  const getAvailableImportNamesForSupplier = useCallback((supplierId: string) => {
    const month = getRatioWorkMonthForSupplier(supplierId);
    return extractAllNamesFromCsvs(detailedInventory[month] ? { [month]: detailedInventory[month] } : {});
  }, [detailedInventory, getRatioWorkMonthForSupplier]);

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
    const supplierId = String(p.supplierId || 'doquet');
    const productWorkMonth = getRatioWorkMonthForSupplier(supplierId);
    MONTHS_ORDER.forEach(m => {
      const isValidated = resolveRatioProductMonthFrozen(
        ratioValidatedMonths,
        ratioValidatedMonthsBySupplier,
        ratioProductUnfrozenMonths,
        supplierId,
        p.id,
        m,
      );
      const isWorkMonth = m === productWorkMonth;

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
  }, [covers, detailedInventory, getRatioWorkMonthForSupplier, ratioProductUnfrozenMonths, ratioValidatedMonths, ratioValidatedMonthsBySupplier]);

  const isRatioSupplierMonthFrozen = useCallback((supplierId: string, month: string) => (
    resolveRatioSupplierMonthFrozen(
      ratioValidatedMonths,
      ratioValidatedMonthsBySupplier,
      supplierId,
      month,
    )
  ), [ratioValidatedMonths, ratioValidatedMonthsBySupplier]);

  const isRatioProductMonthFrozen = useCallback((productId: string, supplierId: string, month: string) => (
    resolveRatioProductMonthFrozen(
      ratioValidatedMonths,
      ratioValidatedMonthsBySupplier,
      ratioProductUnfrozenMonths,
      supplierId,
      productId,
      month,
    )
  ), [ratioProductUnfrozenMonths, ratioValidatedMonths, ratioValidatedMonthsBySupplier]);

  // Un produit qui vient d'être créé doit rester paramétrable même lorsque le
  // mois de travail du fournisseur est déjà figé. Seuls ces nouveaux produits
  // sont ouverts ; aucun autre produit ni fournisseur n'est défigé.
  const openNewRatioProducts = useCallback((supplierId: string, productIds: string[]) => {
    if (productIds.length === 0) return;
    const month = getRatioWorkMonthForSupplier(supplierId);
    if (!isRatioSupplierMonthFrozen(supplierId, month)) return;
    setRatioProductUnfrozenMonths(prev => openNewRatioProductsForMonth(prev, productIds, month));
  }, [getRatioWorkMonthForSupplier, isRatioSupplierMonthFrozen]);

  const snapshotRatioProduct = useCallback((
    product: ProductWithHistory,
    month: string,
    importNamesForMonthList: string[],
  ): ProductWithHistory => {
    const importedValue = getImportedValueForProduct(detailedInventory[month], product.searchName, product.importDivisor);
    const previousSnapshot = getRatioSnapshot(product, month);
    const salesValue = roundRatioImportedValue(importedValue)
      ?? previousSnapshot?.salesValue
      ?? Number(product.salesHistory[month] || 0);
    const monthCovers = covers[month] || 1;
    const ratio = salesValue / monthCovers;
    const searchName = String(product.searchName || '');
    const mappingId = normalizeRatioMappingId(searchName);
    const isLinked = mappingId.length > 0
      && importNamesForMonthList.some((name) => matchesImportedProductName(searchName, name))
      && salesValue > 0;
    const previousSnapshots = (product as ProductWithRatioSnapshots).ratioSnapshots || {};

    return {
      ...product,
      salesHistory: { ...product.salesHistory, [month]: salesValue },
      ratioSnapshots: {
        ...previousSnapshots,
        [month]: {
          salesValue,
          ratio,
          productName: product.name,
          searchName,
          mappingId: mappingId || undefined,
          isLinked,
        },
      },
    } as ProductWithRatioSnapshots;
  }, [covers, detailedInventory]);

  // Le bouton général agit uniquement sur le fournisseur affiché.
  const toggleValidateMonth = (m: string, supplierId: string = ratioTab) => {
    const next = !isRatioSupplierMonthFrozen(supplierId, m);
    const supplierProductIds = products
      .filter(p => String(p.supplierId || 'doquet') === supplierId)
      .map(p => p.id);

    if (next) {
      const importNamesForMonth = extractAllNamesFromCsvs(
        detailedInventory[m] ? { [m]: detailedInventory[m] } : {}
      );
      const importNamesForMonthList = Array.from(importNamesForMonth);
      setProducts(prev => prev.map(p => (
        String(p.supplierId || 'doquet') === supplierId
          ? snapshotRatioProduct(p, m, importNamesForMonthList)
          : p
      )));
    }

    setRatioValidatedMonthsBySupplier(prev => setRatioSupplierMonthFreeze(prev, supplierId, m, next));
    setRatioProductUnfrozenMonths(prev => clearRatioProductMonthOverrides(prev, supplierProductIds, m));
  };

  // Sur un mois fournisseur figé, ce bouton ne rouvre ou ne refige que le produit.
  const toggleProductValidateMonth = (productId: string, m: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const supplierId = String(product.supplierId || 'doquet');
    if (!isRatioSupplierMonthFrozen(supplierId, m)) return;

    const currentlyFrozen = isRatioProductMonthFrozen(productId, supplierId, m);
    if (currentlyFrozen) {
      setRatioProductUnfrozenMonths(prev => setRatioProductMonthUnfrozen(prev, productId, m, true));
      return;
    }

    const importNamesForMonth = extractAllNamesFromCsvs(
      detailedInventory[m] ? { [m]: detailedInventory[m] } : {}
    );
    setProducts(prev => prev.map(p => (
      p.id === productId ? snapshotRatioProduct(p, m, Array.from(importNamesForMonth)) : p
    )));
    setRatioProductUnfrozenMonths(prev => setRatioProductMonthUnfrozen(prev, productId, m, false));
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
    products: mergedProducts,
    view,
    ratioTab,
    selectedProductIds,
    setProducts: setProductsWithoutDeleted,
    setSelectedProductIds,
    setShowResetConfirm,
    showToast,
    updateOrderLineField,
    deleteOrderLineForProduct,
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
    orderLineStates,
    detailedInventory, setDetailedInventory,
    salesHtByMonth, setSalesHtByMonth,
    costMatterByMonth, setCostMatterByMonth,
    validatedMonths,
    ratioValidatedMonths,
    ratioValidatedMonthsBySupplier,
    ratioProductUnfrozenMonths,
    prepValidatedMonths,
    importTargetMonth,
    prepImportTargetMonth,
    supplierConfigs, setSupplierConfigs,
    products: mergedProducts, setProducts: setProductsWithoutDeleted,
    prepItems, setPrepItems,
    prepImportsByMonth, setPrepImportsByMonth,
    prepSheetStocks, setPrepSheetStocks,
    prepBatches, setPrepBatches,
    prepForecasts, setPrepForecasts,
    orderTemplateRows, setOrderTemplateRows,
    orderTemplatesBySupplier, setOrderTemplatesBySupplier,

    // Valeurs calculées
    totalForecast,
    allAvailableImportNames,

    // Actions
    getProductStats,
    getRatioWorkMonthForSupplier,
    getAvailableImportNamesForSupplier,
    isRatioSupplierMonthFrozen,
    isRatioProductMonthFrozen,
    toggleValidateMonth,
    toggleProductValidateMonth,
    openNewRatioProducts,
    togglePrepValidateMonth,
    updateProductValue,
    updateOrderLineField,
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
