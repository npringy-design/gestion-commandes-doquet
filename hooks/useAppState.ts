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
  loadAllFromSupabase,
  loadMetaFromSupabase,
  loadKeysFromSupabase,
  saveToSupabaseDebounced,
  isSupabaseConfigured,
} from '../utils/supabase';

// Génère un timestamp ISO précis pour le last-write-wins
const nowIso = () => new Date().toISOString();
import { useToast } from '../components/Toast';
import {
  DOQUET_PRODUCTS, VINS_PRODUCTS, VIANDES_PRODUCTS,
  DOMAFRAIS_PRODUCTS, DOMAFRAIS_BOF_PRODUCTS, DOMAFRAIS_SURGELE_PRODUCTS, POMONA_EPISAVEURS_PRODUCTS, POMONA_TERRE_AZUR_PRODUCTS,
  MONTHLY_COVERS as INITIAL_COVERS,
  DOQUET_CONFIG, VINS_CONFIG, VIANDES_CONFIG,
  DOMAFRAIS_CONFIG, DOMAFRAIS_BOF_CONFIG, DOMAFRAIS_SURGELE_CONFIG, POMONA_EPISAVEURS_CONFIG, POMONA_TERRE_AZUR_CONFIG,
  ProductWithHistory, DAILY_COVERS_INITIAL,
} from '../data';
import { OrderState, SupplierConfig } from '../types';
import { MONTHS_ORDER, STORAGE_PREFIX, View, SupplierId } from '../constants';
import { DailyCoversState } from '../utils/dateHelpers';
import { getImportedValueForProduct, extractAllNamesFromCsvs } from '../utils/csvHelpers';

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

// onError est optionnel — fourni par le hook pour afficher un toast
const saveState = (key: string, value: unknown, onError?: (msg: string) => void): void => {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  } catch (err) {
    const msg = 'Sauvegarde impossible : stockage local plein ou désactivé.';
    if (onError) onError(msg);
    else console.error(msg, err);
  }
};



const CODE_DEFAULT_SUPPLIER_CONFIGS: Record<string, SupplierConfig> = {
  doquet: DOQUET_CONFIG,
  vins: VINS_CONFIG,
  viandes: VIANDES_CONFIG,
  domafrais: DOMAFRAIS_CONFIG,
  domafrais_bof: DOMAFRAIS_BOF_CONFIG,
  domafrais_surgele: DOMAFRAIS_SURGELE_CONFIG,
  pomona_episaveurs: POMONA_EPISAVEURS_CONFIG,
  pomona_terre_azur: POMONA_TERRE_AZUR_CONFIG,
};

const DEFAULT_PRODUCTS: ProductWithHistory[] = [
  ...DOQUET_PRODUCTS, ...VINS_PRODUCTS, ...VIANDES_PRODUCTS,
  ...DOMAFRAIS_PRODUCTS, ...DOMAFRAIS_BOF_PRODUCTS, ...DOMAFRAIS_SURGELE_PRODUCTS,
  ...POMONA_EPISAVEURS_PRODUCTS,
  ...POMONA_TERRE_AZUR_PRODUCTS,
];

const mergeAndNormalizeProducts = (incoming: ProductWithHistory[]): ProductWithHistory[] => {
  const existingIds = new Set(incoming.map((p: ProductWithHistory) => p.id));
  const merged = [...incoming];
  DEFAULT_PRODUCTS.forEach(p => { if (!existingIds.has(p.id)) merged.push(p); });

  return merged.map((p: ProductWithHistory) => ({
    ...p,
    stock:            p.stock == null || p.stock === 0 ? '' : p.stock,
    upcomingDelivery: p.upcomingDelivery == null || p.upcomingDelivery === 0 ? '' : p.upcomingDelivery,
    targetStock:      p.targetStock == null || p.targetStock === 0 ? '' : p.targetStock,
    packaging:        !p.packaging || p.packaging === 0 ? 1 : p.packaging,
    importDivisor:    !p.importDivisor || p.importDivisor === 0 ? '' : p.importDivisor,
    supplierId:       p.supplierId || (DOQUET_PRODUCTS.find(dp => dp.id === p.id) ? 'doquet' : 'vins'),
  }));
};

// -----------------------------------------------------------
// Hook principal
// -----------------------------------------------------------
export const useAppState = () => {
  // Toast — affichage des messages d'erreur
  const { showToast } = useToast();

  // ── Supabase : état de synchro ─────────────────────────────
  const [supabaseLoaded, setSupabaseLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHydratingFromCloud = useRef(false);
  const lastCloudUpdatedAtByKey = useRef<Record<string, string>>({});
  const pollingInFlightRef = useRef(false);
  const pendingKeysRef = useRef<Set<string>>(new Set());
  // Timestamp de la dernière modification locale par clé.
  // Stratégie last-write-wins : on compare ce timestamp avec updated_at du cloud.
  // Si local > cloud → notre modif est plus récente → on garde la locale.
  // Si cloud > local → quelqu'un d'autre a écrit après → on applique le cloud.
  const localTsByKey = useRef<Record<string, string>>({});

  // Chargement initial depuis Supabase (si configuré)
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
          // Initialiser les curseurs updated_at depuis le chargement initial
          cloud.forEach((r: any) => {
            lastCloudUpdatedAtByKey.current[r.key] = r.updated_at;
          });
          const cloudMap: Record<string, unknown> = {};
          cloud.forEach((r: any) => { cloudMap[r.key] = r.value; });
          if (cloudMap['covers']) setCovers(cloudMap['covers'] as Record<string, number>);
          // dailyCovers : n'écraser les données locales que si le cloud a de vraies données
          // (évite d'écraser DAILY_COVERS_INITIAL avec un objet vide {})
          if (cloudMap['dailyCovers']) {
            const cloudDC = cloudMap['dailyCovers'] as DailyCoversState;
            const hasData = Object.values(cloudDC).some(
              m => Array.isArray(m) && m.some(d => d.midi !== '' && d.midi !== 0)
            );
            if (hasData) setDailyCovers(cloudDC);
          }
          if (cloudMap['orderStates']) setOrderStates(cloudMap['orderStates'] as Record<string, OrderState>);
          if (cloudMap['inventory']) setDetailedInventory(cloudMap['inventory'] as Record<string, string>);
          if (cloudMap['salesHtByMonth']) setSalesHtByMonth(cloudMap['salesHtByMonth'] as Record<string, number>);
          if (cloudMap['costMatterByMonth']) setCostMatterByMonth(cloudMap['costMatterByMonth'] as Record<string, number>);
          if (cloudMap['validatedMonths']) setValidatedMonths(cloudMap['validatedMonths'] as Record<string, boolean>);
          // supplierConfigs : fusionner cloud (préférences user) + code (structure livraisons)
          // Les champs deliveryDays / flexibleDelivery viennent TOUJOURS du code
          if (cloudMap['supplierConfigs']) {
            const cloudConfigs = cloudMap['supplierConfigs'] as Record<string, SupplierConfig>;
            const merged: Record<string, SupplierConfig> = {};
            Object.keys(CODE_DEFAULT_SUPPLIER_CONFIGS).forEach(id => {
              merged[id] = {
                ...cloudConfigs[id],                  // préférences cloud (cutoffTime, etc.)
                ...CODE_DEFAULT_SUPPLIER_CONFIGS[id], // structure code (deliveryDays, flexibleDelivery)
              };
            });
            setSupplierConfigs(merged);
          }
          if (cloudMap['deliveryDateBySupplier']) setDeliveryDateBySupplier(cloudMap['deliveryDateBySupplier'] as Record<string, string>);
          if (cloudMap['nextDeliveryDateBySupplier']) setNextDeliveryDateBySupplier(cloudMap['nextDeliveryDateBySupplier'] as Record<string, string>);
          if (cloudMap['products']) setProducts(mergeAndNormalizeProducts(cloudMap['products'] as ProductWithHistory[]));
          setTimeout(() => { isHydratingFromCloud.current = false; }, 600);
        }
      } catch (e) {
        console.error('[Supabase load exception]', e);
      } finally {
        if (!cancelled) setSupabaseLoaded(true);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, []);

  // ── Polling cloud léger (5–10s) : applique les changements sans refresh ──
  useEffect(() => {
    if (!supabaseLoaded) return;
    if (!isSupabaseConfigured()) return;

    // Sur mobile/tablette : on ne fait que rafraîchir les paramètres (pour éviter les conflits / clignotements).
    // Sur PC : on laisse le mode "refresh manuel / au chargement".
    const isSmallDevice = () =>
      typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches;

    if (!isSmallDevice()) return;

    const PARAMETER_KEYS = new Set<string>([
      'supplierConfigs',
      'costMatterByMonth',
      'salesHtByMonth',
      'validatedMonths',
      'deliveryDateBySupplier',
      'nextDeliveryDateBySupplier',
    ]);


    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const isUserEditing = (): boolean => {
      const el = document?.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      // contenteditable
      if ((el as any).isContentEditable) return true;
      return false;
    };

    const applyCloudKey = (key: string, cloudTs: string, value: unknown) => {
      // LAST WRITE WINS : comparer le timestamp cloud avec notre dernier write local
      const localTs = localTsByKey.current[key];
      if (localTs && localTs > cloudTs) {
        // Notre modification locale est plus récente → on l'ignore
        // (notre debounce va bientôt l'écrire en base)
        return;
      }
      // Le cloud est plus récent (ou on n'a pas de modif locale) → on applique
      isHydratingFromCloud.current = true;
      switch (key) {
        case 'covers': setCovers(value as Record<string, number>); break;
        case 'dailyCovers': {
          const dc = value as DailyCoversState;
          const hasData = Object.values(dc).some(
            m => Array.isArray(m) && m.some(d => d.midi !== '' && d.midi !== 0)
          );
          if (hasData) setDailyCovers(dc);
          break;
        }
        case 'orderStates': setOrderStates(value as Record<string, OrderState>); break;
        case 'inventory': setDetailedInventory(value as Record<string, string>); break;
        case 'salesHtByMonth': setSalesHtByMonth(value as Record<string, number>); break;
        case 'costMatterByMonth': setCostMatterByMonth(value as Record<string, number>); break;
        case 'validatedMonths': setValidatedMonths(value as Record<string, boolean>); break;
        case 'supplierConfigs': {
          const cloudConfigs = value as Record<string, SupplierConfig>;
          const merged: Record<string, SupplierConfig> = {};
          Object.keys(CODE_DEFAULT_SUPPLIER_CONFIGS).forEach(id => {
            merged[id] = { ...cloudConfigs[id], ...CODE_DEFAULT_SUPPLIER_CONFIGS[id] };
          });
          setSupplierConfigs(merged);
          break;
        }
        case 'deliveryDateBySupplier': setDeliveryDateBySupplier(value as Record<string, string>); break;
        case 'nextDeliveryDateBySupplier': setNextDeliveryDateBySupplier(value as Record<string, string>); break;
        case 'products': setProducts(mergeAndNormalizeProducts(value as ProductWithHistory[])); break;
        default: break;
      }
      // Relâche après un court délai pour laisser React stabiliser les contrôles
      setTimeout(() => { isHydratingFromCloud.current = false; }, 600);
    };

    const flushPendingIfSafe = async () => {
      if (pendingKeysRef.current.size === 0) return;
      if (isUserEditing()) return;
      if (pollingInFlightRef.current) return;
      pollingInFlightRef.current = true;
      try {
        const keys = Array.from(pendingKeysRef.current);
        pendingKeysRef.current.clear();
        const rows = await loadKeysFromSupabase(keys);
        if (!rows) return;
        rows.forEach(r => {
          lastCloudUpdatedAtByKey.current[r.key] = r.updated_at;
          applyCloudKey(r.key, r.updated_at, r.value);
        });
      } finally {
        pollingInFlightRef.current = false;
      }
    };

    const tick = async () => {
      if (cancelled) return;
      if (pollingInFlightRef.current) return;
      if (document?.hidden) return;
      // Si on est en train de sauver, on évite de relire/appliquer au milieu
      if (syncStatus === 'saving') return;

      pollingInFlightRef.current = true;
      try {
        const meta = await loadMetaFromSupabase();
        if (!meta) return;

        const changedKeys: string[] = [];
        meta.forEach(r => {
          if (!PARAMETER_KEYS.has(r.key)) return;
          const prev = lastCloudUpdatedAtByKey.current[r.key];
          if (!prev) {
            // init curseur sans appliquer (sinon clignote au premier tick)
            lastCloudUpdatedAtByKey.current[r.key] = r.updated_at;
            return;
          }
          if (prev !== r.updated_at) {
            changedKeys.push(r.key);
          }
        });

        if (changedKeys.length === 0) return;

        // Si l'utilisateur est en train d'éditer un champ, on diffère pour éviter le clignotement
        if (isUserEditing()) {
          changedKeys.forEach(k => pendingKeysRef.current.add(k));
          return;
        }

        const rows = await loadKeysFromSupabase(changedKeys);
        if (!rows) return;
        rows.forEach(r => {
          lastCloudUpdatedAtByKey.current[r.key] = r.updated_at;
          applyCloudKey(r.key, r.updated_at, r.value);
        });
      } catch (e) {
        console.error('[Cloud polling tick error]', e);
      } finally {
        pollingInFlightRef.current = false;
      }
    };

    // tick immédiat + interval
    void tick();
    timer = setInterval(() => { void tick(); }, 8000);

    // Dès qu'on quitte un champ, on applique ce qui était en attente
    window.addEventListener('focusout', flushPendingIfSafe);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      window.removeEventListener('focusout', flushPendingIfSafe);
    };
  }, [supabaseLoaded, syncStatus]);

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

  const [nextDeliveryDateBySupplier, setNextDeliveryDateBySupplier] =
    useState<Record<string, string>>(() => loadState('nextDeliveryDateBySupplier', {}));

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
    useState<Record<string, SupplierConfig>>(() => {
      // Toujours partir des configs du code comme base,
      // puis appliquer les éventuelles préférences sauvegardées
      const saved = loadState<Record<string, SupplierConfig>>('supplierConfigs', {});
      const merged: Record<string, SupplierConfig> = {};
      Object.keys(CODE_DEFAULT_SUPPLIER_CONFIGS).forEach(id => {
        merged[id] = { ...saved[id], ...CODE_DEFAULT_SUPPLIER_CONFIGS[id] };
      });
      return merged;
    });

  const [products, setProducts] = useState<ProductWithHistory[]>(() => {
    const loaded = loadState('products', DEFAULT_PRODUCTS);
    return mergeAndNormalizeProducts(loaded);
  });

  // --- Persistance automatique à chaque changement ---
  const onSaveError = (msg: string) => showToast(msg, 'error');
  const persistEverywhere = useCallback((key: string, value: unknown) => {
    saveState(key, value, onSaveError);
    if (isHydratingFromCloud.current) return;
    if (!supabaseLoaded) return;
    if (!isSupabaseConfigured()) return;

    // Horodater cette modification locale (last-write-wins)
    // Ce timestamp est conservé pour comparer avec le cloud au moment du save.
    const ts = nowIso();
    localTsByKey.current[key] = ts;

    setSyncStatus('saving');
    saveToSupabaseDebounced(
      key,
      value,
      ts,
      // Getter du curseur cloud (pour comparaison LWW dans supabase.ts)
      (k) => lastCloudUpdatedAtByKey.current[k],
      // Callback après confirmation Supabase
      (confirmedKey, confirmedTs) => {
        // Mettre à jour le curseur cloud avec le timestamp qu'on vient d'écrire.
        // Ainsi le prochain tick de polling verra que c'est notre propre write
        // et ne l'appliquera pas comme un changement externe (pas de ping-pong).
        lastCloudUpdatedAtByKey.current[confirmedKey] = confirmedTs;
        // Nettoyer le timestamp local — la clé est maintenant en sync
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
  useEffect(() => { persistEverywhere('salesHtByMonth', salesHtByMonth); }, [salesHtByMonth, persistEverywhere]);
  useEffect(() => { persistEverywhere('costMatterByMonth', costMatterByMonth); }, [costMatterByMonth, persistEverywhere]);
  useEffect(() => { persistEverywhere('validatedMonths', validatedMonths); }, [validatedMonths, persistEverywhere]);
  useEffect(() => { persistEverywhere('supplierConfigs', supplierConfigs); }, [supplierConfigs, persistEverywhere]);
  useEffect(() => { persistEverywhere('deliveryDateBySupplier', deliveryDateBySupplier); }, [deliveryDateBySupplier, persistEverywhere]);
  useEffect(() => { persistEverywhere('nextDeliveryDateBySupplier', nextDeliveryDateBySupplier); }, [nextDeliveryDateBySupplier, persistEverywhere]);
  useEffect(() => { persistEverywhere('products', products); }, [products, persistEverywhere]);

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

  // Met à jour un champ numérique d'un produit
  // La valeur est number | '' : '' = champ visuellement vide, number = valeur saisie
  const updateProductValue = (
    id:    string,
    field: 'stock' | 'upcomingDelivery' | 'targetStock' | 'packaging',
    value: string
  ) => {
    // On conserve '' si le champ est vide (pour affichage), sinon on convertit en number
    const val: number | '' = value === '' ? '' : Number(value);
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
  };

  // RAZ des stocks/livraisons du fournisseur affiché
  const performReset = () => {
    const viewToSupplier: Record<string, string> = {
      doquet: 'doquet', vins: 'vins', viandes: 'viandes',
      domafrais: 'domafrais', domafrais_bof: 'domafrais_bof', domafrais_surgele: 'domafrais_surgele', pomona_episaveurs: 'pomona_episaveurs', pomona_terre_azur: 'pomona_terre_azur',
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
      domafrais: 'domafrais', domafrais_bof: 'domafrais_bof', domafrais_surgele: 'domafrais_surgele', pomona_episaveurs: 'pomona_episaveurs', pomona_terre_azur: 'pomona_terre_azur', ratios: ratioTab,
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
    const n = selectedProductIds.size;
    if (window.confirm(`Confirmer la suppression de ${n} produit(s) ?`)) {
      setProducts(prev => prev.filter(p => !selectedProductIds.has(p.id)));
      setSelectedProductIds(new Set());
      showToast(`${n} produit${n > 1 ? 's supprimés' : ' supprimé'} ✓`, 'success');
    }
  }, [selectedProductIds, showToast]);

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

  // Met à jour le diviseur d'import d'un produit (number | '')
  const updateImportDivisor = (id: string, val: string) => {
    const normalized: number | '' = val === '' ? '' : Number(val);
    setProducts(prev => prev.map(p =>
      p.id === id ? { ...p, importDivisor: normalized } : p
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
