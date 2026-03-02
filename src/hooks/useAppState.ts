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

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  DOQUET_PRODUCTS, VINS_PRODUCTS, VIANDES_PRODUCTS,
  DOMAFRAIS_PRODUCTS, DOMAFRAIS_BOF_PRODUCTS, DOMAFRAIS_SURGELE_PRODUCTS,
  MONTHLY_COVERS as INITIAL_COVERS,
  DOQUET_CONFIG, VINS_CONFIG, VIANDES_CONFIG,
  DOMAFRAIS_CONFIG, DOMAFRAIS_BOF_CONFIG, DOMAFRAIS_SURGELE_CONFIG,
  ProductWithHistory, DAILY_COVERS_INITIAL,
} from '../data';
import { OrderState, SupplierConfig } from '../types';
import { MONTHS_ORDER, STORAGE_PREFIX, View, SupplierId } from '../constants';
import { DailyCoversState } from '../utils/dateHelpers';
import {
  extractAllNamesFromCsvs,
  buildConsoIndexFromCsv,
  getImportedValueFromIndex,
} from '../utils/csvHelpers';
import { loadAllFromSupabase, saveToSupabaseDebounced, isSupabaseConfigured } from '../utils/supabase';

// -----------------------------------------------------------
// Lecture/écriture localStorage avec préfixe commun
// -----------------------------------------------------------
const loadState = <T>(key: string, defaultVal: T): T => {
  try {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    return saved ? JSON.parse(saved) : defaultVal;
  } catch {
    return defaultVal;
  }
};

const saveState = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // localStorage plein ou désactivé → on ignore silencieusement
    // TODO (amélioration) : afficher un toast d'avertissement
  }
};

// -----------------------------------------------------------
// Hook principal
// -----------------------------------------------------------
export const useAppState = () => {
  const supabaseLoadedRef = useRef(false);
  const isHydratingFromCloud = useRef(false);

  // Navigation
  const [view, setView] = useState<View>('home');

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
    useState<Record<string, string>>(() => loadState('deliveryDateBySupplier', {}));

  const [covers, setCovers] =
    useState<Record<string, number>>(() => loadState('covers', INITIAL_COVERS));

  const [dailyCovers, setDailyCovers] =
    useState<DailyCoversState>(() => loadState('dailyCovers', DAILY_COVERS_INITIAL));

  const [orderStates, setOrderStates] =
    useState<Record<string, OrderState>>(() => loadState('orderStates', {}));

  const [detailedInventory, setDetailedInventory] =
    useState<Record<string, string>>(() => loadState('inventory', {}));

  const [salesHtByMonth, setSalesHtByMonth] =
    useState<Record<string, number>>(() => loadState('salesHtByMonth', INITIAL_COVERS));

  const [costMatterByMonth, setCostMatterByMonth] =
    useState<Record<string, number>>(() => loadState('costMatterByMonth', INITIAL_COVERS));

  const [validatedMonths, setValidatedMonths] =
    useState<Record<string, boolean>>(() => loadState('validatedMonths', {}));

  const [supplierConfigs, setSupplierConfigs] =
    useState<Record<string, SupplierConfig>>(() => loadState('supplierConfigs', {
      doquet:        DOQUET_CONFIG,
      vins:          VINS_CONFIG,
      viandes:       VIANDES_CONFIG,
      domafrais:     DOMAFRAIS_CONFIG,
      domafrais_bof: DOMAFRAIS_BOF_CONFIG,
      domafrais_surgele: DOMAFRAIS_SURGELE_CONFIG,
    }));

  const [products, setProducts] = useState<ProductWithHistory[]>(() => {
    const loaded = loadState('products', [
      ...DOQUET_PRODUCTS, ...VINS_PRODUCTS, ...VIANDES_PRODUCTS,
      ...DOMAFRAIS_PRODUCTS, ...DOMAFRAIS_BOF_PRODUCTS, ...DOMAFRAIS_SURGELE_PRODUCTS,
    ]);

    // Fusion : ajouter les nouveaux produits qui n'existaient pas encore
    const existingIds = new Set(loaded.map((p: ProductWithHistory) => p.id));
    const allProducts = [...loaded];
    [...VINS_PRODUCTS, ...VIANDES_PRODUCTS, ...DOMAFRAIS_PRODUCTS, ...DOMAFRAIS_BOF_PRODUCTS, ...DOMAFRAIS_SURGELE_PRODUCTS]
      .forEach(p => { if (!existingIds.has(p.id)) allProducts.push(p); });

    // Normalisation des champs
    return allProducts.map((p: ProductWithHistory) => ({
      ...p,
      stock:           p.stock          == null || p.stock          === 0 ? '' : p.stock,
      upcomingDelivery: p.upcomingDelivery == null || p.upcomingDelivery === 0 ? '' : p.upcomingDelivery,
      targetStock:     p.targetStock     == null || p.targetStock     === 0 ? '' : p.targetStock,
      packaging:       !p.packaging || p.packaging === 0 ? 1 : p.packaging,
      importDivisor:   !p.importDivisor  || p.importDivisor === 0 ? '' : p.importDivisor,
      supplierId:      p.supplierId || (DOQUET_PRODUCTS.find(dp => dp.id === p.id) ? 'doquet' : 'vins'),
    }));
  });

  // Chargement initial depuis Supabase (si configuré)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isSupabaseConfigured()) { supabaseLoadedRef.current = true; return; }
      try {
        const cloud = await loadAllFromSupabase();
        if (cancelled) return;
        if (cloud && Object.keys(cloud).length > 0) {
          isHydratingFromCloud.current = true;
          if (cloud['covers']) setCovers(cloud['covers'] as Record<string, number>);
          if (cloud['dailyCovers']) setDailyCovers(cloud['dailyCovers'] as DailyCoversState);
          if (cloud['orderStates']) setOrderStates(cloud['orderStates'] as Record<string, OrderState>);
          if (cloud['inventory']) setDetailedInventory(cloud['inventory'] as Record<string, string>);
          if (cloud['salesHtByMonth']) setSalesHtByMonth(cloud['salesHtByMonth'] as Record<string, number>);
          if (cloud['costMatterByMonth']) setCostMatterByMonth(cloud['costMatterByMonth'] as Record<string, number>);
          if (cloud['validatedMonths']) setValidatedMonths(cloud['validatedMonths'] as Record<string, boolean>);
          if (cloud['supplierConfigs']) setSupplierConfigs(cloud['supplierConfigs'] as Record<string, SupplierConfig>);
          if (cloud['deliveryDateBySupplier']) setDeliveryDateBySupplier(cloud['deliveryDateBySupplier'] as Record<string, string>);
          if (cloud['products']) setProducts(cloud['products'] as ProductWithHistory[]);
          setTimeout(() => { isHydratingFromCloud.current = false; }, 250);
        }
      } catch (e) {
        console.error('[Supabase load exception]', e);
      } finally {
        supabaseLoadedRef.current = true;
      }
    };
    void run();
    return () => { cancelled = true; };
  }, []);

  // --- Persistance automatique à chaque changement ---
  useEffect(() => { saveState('covers', covers); if (supabaseLoadedRef.current && !isHydratingFromCloud.current) saveToSupabaseDebounced('covers', covers); }, [covers]);
  useEffect(() => { saveState('dailyCovers', dailyCovers); if (supabaseLoadedRef.current && !isHydratingFromCloud.current) saveToSupabaseDebounced('dailyCovers', dailyCovers); }, [dailyCovers]);
  useEffect(() => { saveState('orderStates', orderStates); if (supabaseLoadedRef.current && !isHydratingFromCloud.current) saveToSupabaseDebounced('orderStates', orderStates); }, [orderStates]);
  useEffect(() => { saveState('inventory', detailedInventory); if (supabaseLoadedRef.current && !isHydratingFromCloud.current) saveToSupabaseDebounced('inventory', detailedInventory); }, [detailedInventory]);
  useEffect(() => { saveState('salesHtByMonth', salesHtByMonth); if (supabaseLoadedRef.current && !isHydratingFromCloud.current) saveToSupabaseDebounced('salesHtByMonth', salesHtByMonth); }, [salesHtByMonth]);
  useEffect(() => { saveState('costMatterByMonth', costMatterByMonth); if (supabaseLoadedRef.current && !isHydratingFromCloud.current) saveToSupabaseDebounced('costMatterByMonth', costMatterByMonth); }, [costMatterByMonth]);
  useEffect(() => { saveState('validatedMonths', validatedMonths); if (supabaseLoadedRef.current && !isHydratingFromCloud.current) saveToSupabaseDebounced('validatedMonths', validatedMonths); }, [validatedMonths]);
  useEffect(() => { saveState('supplierConfigs', supplierConfigs); if (supabaseLoadedRef.current && !isHydratingFromCloud.current) saveToSupabaseDebounced('supplierConfigs', supplierConfigs); }, [supplierConfigs]);
  useEffect(() => { saveState('deliveryDateBySupplier', deliveryDateBySupplier); if (supabaseLoadedRef.current && !isHydratingFromCloud.current) saveToSupabaseDebounced('deliveryDateBySupplier', deliveryDateBySupplier); }, [deliveryDateBySupplier]);
  useEffect(() => { saveState('products', products); if (supabaseLoadedRef.current && !isHydratingFromCloud.current) saveToSupabaseDebounced('products', products); }, [products]);

  // --- Valeurs calculées ---

  // Total couverts prévisionnels (toutes périodes confondues)
  const totalForecast = useMemo(() => {
    let sum = 0;
    Object.values(dailyCovers).forEach(m =>
      m.forEach(d => { sum += (Number(d.midi) || 0) + (Number(d.soir) || 0); })
    );
    return sum;
  }, [dailyCovers]);

  // ---------------------------------------------------------
  // ✅ Logique perf : workMonth = 1er mois importé NON figé
  // - Mois figés : jamais de re-parsing CSV (on lit le snapshot salesHistory)
  // - workMonth : seul mois où on parse + matching + alertes
  // - Mois plus récents : pas de parsing tant que workMonth n'est pas figé
  // ---------------------------------------------------------
  const workMonth = useMemo(() => {
    const monthsWithCsv = MONTHS_ORDER.filter(m => !!detailedInventory[m]);
    const firstOpenWithCsv = monthsWithCsv.find(m => !validatedMonths[m]);
    if (firstOpenWithCsv) return firstOpenWithCsv;
    return monthsWithCsv[0] ?? MONTHS_ORDER[0];
  }, [detailedInventory, validatedMonths]);

  // Index CSV du workMonth (parsé 1 seule fois)
  const workMonthIndex = useMemo(() => {
    return buildConsoIndexFromCsv(detailedInventory[workMonth]);
  }, [detailedInventory, workMonth]);

  // Ensemble des noms disponibles dans le CSV du mois cible (pour le mapping et les alertes unmatched)
  const allAvailableImportNames = useMemo(
    () => extractAllNamesFromCsvs(
      detailedInventory[workMonth]
        ? { [workMonth]: detailedInventory[workMonth] }
        : {}
    ),
    [detailedInventory, workMonth]
  );

  // --- Actions sur les produits ---

  // Calcule les stats (ratio moyen, ventes mensuelles) pour un produit
  const getProductStats = useCallback((p: ProductWithHistory) => {
    let totalR = 0, countR = 0;
    const mR: Record<string, number> = {};
    const mS: Record<string, { value: number; isImported: boolean; isValidated: boolean }> = {};

    MONTHS_ORDER.forEach(m => {
      const isValid    = validatedMonths[m] || false;
      // ⚡ Perf + règle :
      // - mois figé => snapshot
      // - workMonth => import brut + matching
      // - autres mois non figés => 0 (ne pas afficher d'anciens snapshots non validés)
      const importedVal = (!isValid && m === workMonth)
        ? getImportedValueFromIndex(workMonthIndex, p.searchName, p.importDivisor)
        : null;

      const val = isValid
        ? Math.round(p.salesHistory[m] || 0)
        : (m === workMonth ? (importedVal ?? 0) : 0);

      const c = covers[m] || 1;
      const r = val / c;

      mS[m] = { value: val, isImported: !isValid && m === workMonth && importedVal !== null, isValidated: isValid };
      mR[m] = r;

      if (val > 0) { totalR += r; countR++; }
    });

    return { avgRatio: countR > 0 ? totalR / countR : 0, mR, mS };
  }, [validatedMonths, covers, workMonth, workMonthIndex]);

  // Valide / dévalide un mois (fige les valeurs importées dans l'historique)
  const toggleValidateMonth = (m: string) => {
    const next = !validatedMonths[m];
    // Garde-fou : on ne permet de figer que le workMonth.
    // Ça force le workflow "on traite 1 mois à la fois" et évite de parser 12 CSV.
    if (next && m !== workMonth) {
      window.alert(`Ce mois n'est pas le mois de travail.\n\nMois de travail actuel : ${m === workMonth ? m : workMonth.toUpperCase()}`);
      return;
    }
    if (next) {
      setProducts(prev => prev.map(p => ({
        ...p,
        salesHistory: { ...p.salesHistory, [m]: Math.round(getProductStats(p).mS[m].value) },
      })));
    }
    setValidatedMonths(prev => ({ ...prev, [m]: next }));
  };

  // Met à jour un champ numérique d'un produit
  const updateProductValue = (
    id:    string,
    field: 'stock' | 'upcomingDelivery' | 'targetStock' | 'packaging',
    value: string
  ) => {
    const val = value === '' ? '' : Number(value);
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
  };

  // RAZ des stocks/livraisons du fournisseur affiché
  const performReset = () => {
    const viewToSupplier: Record<string, string> = {
      doquet: 'doquet', vins: 'vins', viandes: 'viandes',
      domafrais: 'domafrais', domafrais_bof: 'domafrais_bof', domafrais_surgele: 'domafrais_surgele',
    };
    const id = viewToSupplier[view];
    if (!id) return;
    setProducts(prev => prev.map(p =>
      p.supplierId === id ? { ...p, stock: '', upcomingDelivery: '' } : p
    ));
    setShowResetConfirm(false);
  };

  // Ajoute un nouveau produit vierge
  const addNewProduct = () => {
    const viewToSupplier: Record<string, SupplierId> = {
      doquet: 'doquet', vins: 'vins', viandes: 'viandes',
      domafrais: 'domafrais', domafrais_bof: 'domafrais_bof', domafrais_surgele: 'domafrais_surgele', ratios: ratioTab,
    };
    const supplierId = viewToSupplier[view] ?? 'doquet';
    const newProd: ProductWithHistory = {
      id:              `custom-${Date.now()}`,
      supplierId,
      name:            'NOUVEAU PRODUIT',
      searchName:      '',
      packaging:       1,
      defaultMargin:   0,
      salesHistory:    {},
      stock:           0,
      upcomingDelivery: 0,
      targetStock:     0,
    };
    setProducts(prev => [newProd, ...prev]);
    setSelectedProductIds(new Set());
  };

  // Supprime les produits sélectionnés
  const deleteSelectedProducts = useCallback(() => {
    if (selectedProductIds.size === 0) return;
    if (window.confirm(`Confirmer la suppression de ${selectedProductIds.size} produit(s) ?`)) {
      setProducts(prev => prev.filter(p => !selectedProductIds.has(p.id)));
      setSelectedProductIds(new Set());
    }
  }, [selectedProductIds]);

  // Coche/décoche un produit dans la sélection
  const toggleProductSelection = (id: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Déplace un produit d'une position vers le haut ou le bas
  const moveProduct = (id: string, direction: 'up' | 'down') => {
    setProducts(prev => {
      const idx       = prev.findIndex(p => p.id === id);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next      = [...prev];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return next;
    });
  };

  // Déplace un produit vers une position numérotée
  const jumpProductTo = (id: string, pos: number) => {
    setProducts(prev => {
      const idx       = prev.findIndex(p => p.id === id);
      if (idx === -1) return prev;
      const targetIdx = Math.max(0, Math.min(prev.length - 1, pos - 1));
      const next      = [...prev];
      const [moved]   = next.splice(idx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
  };

  // Renomme un produit (et propose de le déplacer si c'est un nouveau)
  const handleNameChange = (id: string, newName: string) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== id) return p;
      const wasNew = p.name === 'NOUVEAU PRODUIT';
      if (wasNew && newName !== 'NOUVEAU PRODUIT' && newName.trim() !== '') {
        setTimeout(() => {
          const pos = window.prompt(
            `À quel numéro de ligne placer "${newName}" ? (1 à ${products.length})`, '1'
          );
          if (pos) {
            const n = parseInt(pos);
            if (!isNaN(n)) jumpProductTo(id, n);
          }
        }, 100);
      }
      return { ...p, name: newName };
    }));
  };

  // Met à jour le searchName (mapping import) d'un produit
  const updateSearchName = (id: string, searchName: string) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, searchName } : p));
  };

  // Met à jour le diviseur d'import d'un produit
  const updateImportDivisor = (id: string, val: string) => {
    setProducts(prev => prev.map(p =>
      p.id === id ? { ...p, importDivisor: val === '' ? '' : Number(val) } : p
    ));
  };

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
    covers, setCovers,
    dailyCovers, setDailyCovers,
    orderStates, setOrderStates,
    detailedInventory, setDetailedInventory,
    salesHtByMonth, setSalesHtByMonth,
    costMatterByMonth, setCostMatterByMonth,
    validatedMonths,
    supplierConfigs, setSupplierConfigs,
    products, setProducts,

    // Valeurs calculées
    totalForecast,
    allAvailableImportNames,

    // Actions
    getProductStats,
    toggleValidateMonth,
    updateProductValue,
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
