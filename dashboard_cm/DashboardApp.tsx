
import React, { useEffect, useMemo, useRef, useState } from 'react';
import StatCard from './components/StatCard';
import EcartsList from './components/EcartsList';
import { FoodCostChart, ProductTrendChart, ProductSeriesPoint } from './components/Charts';
import { loadJSON, saveJSON } from "./utils/storage";

import { MONTHS } from './constants';
import { EcartItem } from './types';
import { cleanLabel, determineType, parseEcartCsvText } from './utils/ecartImport';

type MonthKey = string;
type PeriodKey = MonthKey | 'Annuel';
const DEFAULT_TARGET_PERCENT = 25.5;

const App: React.FC<{ csvByMonth?: Record<string, string>; coversByMonthFromParams?: Record<string, number | null>; costByMonthFromParams?: Record<string, number | null>; salesByMonthFromParams?: Record<string, number | null>; onBackHome?: () => void; onOpenParams?: () => void; }> = ({ csvByMonth, coversByMonthFromParams, costByMonthFromParams, salesByMonthFromParams, onBackHome, onOpenParams }) => {
  const [selectedMonth, setSelectedMonth] = useState<PeriodKey>('Janvier');
  const [mobileTopTab, setMobileTopTab] = useState<'liquides' | 'solides'>('liquides');
  const [mobileTerrainMode, setMobileTerrainMode] = useState(true);
  const [isMobileFocusOpen, setIsMobileFocusOpen] = useState(false);
  const [isNarrowMobile, setIsNarrowMobile] = useState(false);
  const [ecartByMonth, setEcartByMonth] = useState<Record<MonthKey, EcartItem[]>>({});
  const [focusId, setFocusId] = useState<string | null>(null);
  const [trendMode, setTrendMode] = useState<'euro' | 'qty'>('euro');
  const [searchText, setSearchText] = useState('');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
  const [dailyMode, setDailyMode] = useState<null | 'modal' | 'page'>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [dailySelectedIds, setDailySelectedIds] = useState<string[]>([]);
  const [dailyPrintScope, setDailyPrintScope] = useState<'ALL' | 'LIQUIDE' | 'SOLIDE'>('ALL');

  const FOLLOW_UP_ENABLED = false;
  const DAILY_PRINT_ENABLED = false;

  type FollowUpStatus = 'À faire' | 'En cours' | 'Fait';
  type FollowUpItem = {
    id: string;
    name: string;
    type: 'LIQUIDE' | 'SOLIDE';
    sector?: string | null;
    supplier?: string | null;
    status: FollowUpStatus;
    notes?: string;
    createdAt: string; // ISO
    period: PeriodKey; // mois ou Annuel
  };

  const FOLLOWUP_STORAGE_KEY = 'rpd_followups_v1';

  // Journalier (stock veille / ventes veille / stock jour / perso / perte)
  type DailyRow = {
    id: string;
    name: string;
    type: 'LIQUIDE' | 'SOLIDE';
    sector?: string | null;
    supplier?: string | null;
    unitPrice?: number | null; // PU (€/u, €/kg, €/L)
    stockPrev?: number | null;
    salesPrev?: number | null;
    stockToday?: number | null;
    perso?: number | null;
    loss?: number | null;
  };

  type DailySheet = {
    dateKey: string; // YYYY-MM-DD
    period: PeriodKey;
    rows: DailyRow[];
    createdAt: string; // ISO
    updatedAt: string; // ISO
  };

  const DAILY_STORAGE_KEY = 'rpd_daily_sheets_v1';
  const todayKey = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);
  const [dailyDateKey, setDailyDateKey] = useState<string>(todayKey);
  const [dailySheets, setDailySheets] = useState<DailySheet[]>(() => loadJSON(DAILY_STORAGE_KEY, [] as DailySheet[]));

  const [followUps, setFollowUps] = useState<FollowUpItem[]>(() => loadJSON(FOLLOWUP_STORAGE_KEY, [] as FollowUpItem[]));

  useEffect(() => {
    try {
      localStorage.setItem(FOLLOWUP_STORAGE_KEY, JSON.stringify(followUps));
    } catch {
      // ignore
    }
  }, [followUps]);

  useEffect(() => {
    saveJSON(DAILY_STORAGE_KEY, dailySheets);
  }, [dailySheets]);

  useEffect(() => {
    const update = () => {
      if (typeof window === 'undefined') return;
      setIsNarrowMobile(window.innerWidth < 430);
      setIsDesktop(window.innerWidth >= 1280);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Source unique: on consomme les imports déjà faits dans l'app (Inventaire détaillé / Export consolidé)
  useEffect(() => {
    if (!csvByMonth) return;
    const next: Record<MonthKey, EcartItem[]> = {};
    for (const m of MONTHS) {
      const csv = csvByMonth[m];
      if (!csv) continue;
      try {
        const rows = parseEcartCsvText(csv);
        next[m] = rows.map(r => ({
          id: r.id,
          name: r.name,
          quantity: r.quantity,
          value: r.value,
          unitPrice: r.unitPrice,
          sector: r.sector || undefined,
          supplier: r.supplier || undefined,
          type: r.type,
        }));
      } catch {
        // ignore parsing errors for this month
      }
    }
    setEcartByMonth(next);
  }, [csvByMonth]);

  const isAnnual = selectedMonth === 'Annuel';

  const monthItems = useMemo(() => {
    if (!isAnnual) return ecartByMonth[selectedMonth as MonthKey] ?? [];

    // Annuel = agrégation sur les mois importés (somme par produit)
    const agg = new Map<string, EcartItem>();
    for (const m of MONTHS) {
      const items = ecartByMonth[m] ?? [];
      for (const it of items) {
        if (!it.id) continue;
        const prev = agg.get(it.id);
        if (!prev) {
          agg.set(it.id, { ...it });
        } else {
          agg.set(it.id, {
            ...prev,
            quantity: (prev.quantity ?? 0) + (it.quantity ?? 0),
            value: (prev.value ?? 0) + (it.value ?? 0),
            // on conserve secteur/fournisseur/type du premier match (suffisant pour top10)
          });
        }
      }
    }
    return Array.from(agg.values());
  }, [isAnnual, selectedMonth, ecartByMonth]);

  const targetPercent = DEFAULT_TARGET_PERCENT;
  const costForSelectedMonth = useMemo(() => {
    const cmMap = costByMonthFromParams ?? {};
    if (!isAnnual) return cmMap[selectedMonth as MonthKey] ?? null;
    const rows = MONTHS.map((m) => ({ cm: cmMap[m] ?? null, ca: (salesByMonthFromParams ?? {})[m] ?? null }))
      .filter((r) => r.cm != null);
    if (!rows.length) return null;
    const weighted = rows.filter((r) => (r.ca ?? 0) > 0);
    if (weighted.length) {
      const sumCa = weighted.reduce((a, r) => a + (r.ca as number), 0);
      const sumWeighted = weighted.reduce((a, r) => a + ((r.cm as number) * (r.ca as number)), 0);
      return sumCa > 0 ? sumWeighted / sumCa : null;
    }
    return rows.reduce((a, r) => a + (r.cm as number), 0) / rows.length;
  }, [isAnnual, selectedMonth, costByMonthFromParams, salesByMonthFromParams]);
  const vsObjectivePts = costForSelectedMonth == null ? null : (costForSelectedMonth - targetPercent);
  const salesForSelectedMonth = useMemo(() => {
    const salesMap = salesByMonthFromParams ?? {};
    if (!isAnnual) return salesMap[selectedMonth as MonthKey] ?? null;
    return MONTHS.reduce((acc, m) => acc + (salesMap[m] ?? 0), 0) || null;
  }, [isAnnual, selectedMonth, salesByMonthFromParams]);

  const coversForSelectedMonth = useMemo(() => {
    const sourceMap = coversByMonthFromParams ?? {};
    if (!isAnnual) return sourceMap[selectedMonth as MonthKey] ?? null;
    return MONTHS.reduce((acc, m) => acc + (sourceMap[m] ?? 0), 0) || null;
  }, [isAnnual, selectedMonth, coversByMonthFromParams]);

  // Exclusions demandées : ces secteurs ne doivent jamais remonter dans les Top10.
  // On utilise la même normalisation que l'import (accents retirés, espaces normalisés)
  // et on accepte des variantes (suffixes, pluriels, etc.) via un test "startsWith".
  const excludedSectorPrefixes = useMemo(() => {
    return [
      cleanLabel('Réserve consommable vente'),
      cleanLabel('Réserve Bar'),
      cleanLabel('Réserve Libre'),
    ];
  }, []);

  const isExcluded = (sector?: string | null) => {
    if (!sector) return false;
    const s = cleanLabel(sector);
    return excludedSectorPrefixes.some((p) => s === p || s.startsWith(p));
  };

  const costChartData = useMemo(() => {
    const cmMap = costByMonthFromParams ?? {};
    return MONTHS.map((m) => ({
      month: m.slice(0, 3),
      actual: cmMap[m] ?? 0,
      target: targetPercent,
    }));
  }, [costByMonthFromParams, targetPercent]);


  const withType = useMemo(() => {
    return monthItems
      .filter(i => !isExcluded(i.sector))
      .map(i => {
      const id = (i.id ?? '').toString();
      // IMPORTANT:
      // - Do NOT re-guess the type from the product label here.
      // - The import already determines LIQUIDE/SOLIDE based on SECTEUR then FOURNISSEUR.
      //   (and only falls back to heuristics if neither exists).
      const t = (i.type ?? determineType({ sector: i.sector, supplier: i.supplier, cleanName: id }).type);
      return { ...i, id, _type: t } as (EcartItem & { _type: 'LIQUIDE' | 'SOLIDE' });
    });
  }, [monthItems, excludedSectorPrefixes]);

  const topLiquides = useMemo(() => {
    return withType
      .filter(i => i._type === 'LIQUIDE')
      .slice()
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 10);
  }, [withType]);

  const topSolides = useMemo(() => {
    return withType
      .filter(i => i._type === 'SOLIDE')
      .slice()
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 10);
  }, [withType]);

  const currentPeriod: PeriodKey = selectedMonth;

  const createFollowUpFromTop10 = () => {
    // Prépare une feuille de suivi journalière à partir des Top10 (liquides + solides)
    const now = new Date().toISOString();
    const existingIds = new Set(
      followUps.filter(f => f.period === currentPeriod).map(f => f.id)
    );
    const merged = [...topLiquides, ...topSolides]
      .filter(it => !!it.id)
      .filter(it => !existingIds.has(it.id));

    if (merged.length === 0) {
      setIsFollowUpOpen(true);
      return;
    }

    const next: FollowUpItem[] = merged.map(it => ({
      id: it.id,
      name: it.name,
      type: it._type,
      sector: it.sector,
      supplier: it.supplier,
      status: 'À faire',
      notes: '',
      createdAt: now,
      period: currentPeriod,
    }));

    setFollowUps(prev => [...next, ...prev]);
    setIsFollowUpOpen(true);
  };

  const getUnitPriceForProduct = (id: string): number | null => {
    // Priorité : la période sélectionnée, sinon n'importe quel mois importé.
    if (!id) return null;
    const candidates: (EcartItem | undefined)[] = [];
    if (!isAnnual) {
      candidates.push((ecartByMonth[selectedMonth as MonthKey] ?? []).find(x => x.id === id));
    }
    for (const m of MONTHS) {
      candidates.push((ecartByMonth[m] ?? []).find(x => x.id === id));
    }
    for (const c of candidates) {
      const pu = c?.unitPrice;
      if (pu != null && Number.isFinite(pu) && pu !== 0) return pu;
    }
    return null;
  };

  const currentDailySheet = useMemo(() => {
    return dailySheets.find(s => s.dateKey === dailyDateKey && s.period === currentPeriod) ?? null;
  }, [dailySheets, dailyDateKey, currentPeriod]);

  const upsertDailySheet = (sheet: DailySheet) => {
    setDailySheets(prev => {
      const idx = prev.findIndex(s => s.dateKey === sheet.dateKey && s.period === sheet.period);
      if (idx === -1) return [sheet, ...prev];
      const next = prev.slice();
      next[idx] = sheet;
      return next;
    });
  };

  const ensureDailySheetExists = () => {
    if (currentDailySheet) return currentDailySheet;
    const now = new Date().toISOString();
    const sheet: DailySheet = {
      dateKey: dailyDateKey,
      period: currentPeriod,
      rows: [],
      createdAt: now,
      updatedAt: now,
    };
    upsertDailySheet(sheet);
    return sheet;
  };

  const generateDailyFromTop10 = () => {
    const nowIso = new Date().toISOString();
    const base = ensureDailySheetExists();
    const existing = new Map(base.rows.map(r => [r.id, r]));
    const merged = [...topLiquides, ...topSolides].filter(it => !!it.id);

    const nextRows: DailyRow[] = merged.map(it => {
      const prev = existing.get(it.id);
      return {
        id: it.id,
        name: it.name,
        type: it._type,
        sector: it.sector,
        supplier: it.supplier,
        unitPrice: prev?.unitPrice ?? getUnitPriceForProduct(it.id),
        stockPrev: prev?.stockPrev ?? null,
        salesPrev: prev?.salesPrev ?? null,
        stockToday: prev?.stockToday ?? null,
        perso: prev?.perso ?? null,
        loss: prev?.loss ?? null,
      };
    });

    const sheet: DailySheet = {
      ...base,
      rows: nextRows,
      updatedAt: nowIso,
    };
    upsertDailySheet(sheet);
    setDailySelectedIds([]);
    setIsDailyOpen(true);
  };

  const addSelectedToFollowUp = () => {
    if (!selectedProduct?.id) return;
    const exists = followUps.some(f => f.period === currentPeriod && f.id === selectedProduct.id);
    if (exists) {
      setIsFollowUpOpen(true);
      return;
    }
    const hit = withType.find(i => i.id === selectedProduct.id);
    const now = new Date().toISOString();
    const item: FollowUpItem = {
      id: selectedProduct.id,
      name: selectedProduct.name,
      type: (hit?._type ?? 'SOLIDE'),
      sector: hit?.sector,
      supplier: hit?.supplier,
      status: 'À faire',
      notes: '',
      createdAt: now,
      period: currentPeriod,
    };
    setFollowUps(prev => [item, ...prev]);
    setIsFollowUpOpen(true);
  };

  const addSelectedToDaily = () => {
    if (!selectedProduct?.id) return;
    const base = ensureDailySheetExists();
    const exists = base.rows.some(r => r.id === selectedProduct.id);
    if (exists) {
      return;
    }
    const hit = withType.find(i => i.id === selectedProduct.id);
    const nowIso = new Date().toISOString();
    const row: DailyRow = {
      id: selectedProduct.id,
      name: selectedProduct.name,
      type: (hit?._type ?? 'SOLIDE'),
      sector: hit?.sector,
      supplier: hit?.supplier,
      unitPrice: getUnitPriceForProduct(selectedProduct.id),
      stockPrev: null,
      salesPrev: null,
      stockToday: null,
      perso: null,
      loss: null,
    };
    const next: DailySheet = {
      ...base,
      rows: [...base.rows, row],
      updatedAt: nowIso,
    };
    upsertDailySheet(next);
  };

  const ecartTotal = useMemo(() => {
    return monthItems.filter(i => !isExcluded(i.sector)).reduce((acc, it) => acc + (it.value ?? 0), 0);
  }, [monthItems, excludedSectorPrefixes]);

  const allProducts = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of MONTHS) {
      const items = ecartByMonth[m] ?? [];
      for (const it of items) {
        if (!it.id) continue;
        if (!map.has(it.id)) map.set(it.id, it.name);
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [ecartByMonth]);

  const importedMonthsCount = useMemo(() => {
    return MONTHS.filter((m) => (ecartByMonth[m]?.length ?? 0) > 0).length;
  }, [ecartByMonth]);

  const selectedProduct = useMemo(() => {
    if (focusId) {
      const found = allProducts.find(p => p.id === focusId);
      if (found) return found;
    }
    // If user types exact label, try match
    const cleaned = searchText.trim().toLowerCase();
    if (!cleaned) return null;
    const exact = allProducts.find(p => p.name.toLowerCase() === cleaned);
    return exact ?? null;
  }, [focusId, allProducts, searchText]);

  const trendData: ProductSeriesPoint[] = useMemo(() => {
    const id = selectedProduct?.id;
    if (!id) {
      return MONTHS.map(m => ({ month: m.slice(0, 3), euro: 0, qty: 0 }));
    }
    return MONTHS.map(m => {
      const items = ecartByMonth[m] ?? [];
      const hit = items.find(x => x.id === id);
      return {
        month: m.slice(0, 3),
        euro: hit?.value ?? 0,
        qty: hit?.quantity ?? 0,
      };
    });
  }, [selectedProduct, ecartByMonth]);

  const focusTitle = selectedProduct?.name ?? (searchText.trim() ? searchText.trim() : 'Sélectionne un produit');

  const selectedMonthValue = useMemo(() => {
    if (!selectedProduct?.id) return 0;
    return monthItems.find(i => i.id === selectedProduct.id)?.value ?? 0;
  }, [selectedProduct, monthItems]);

  const impactCmPoints = useMemo(() => {
    // Variation de coût matière en points si on considère que l'écart € se répercute sur le coût matière.
    // IMPORTANT (métier): dans l'export, le signe est inversé :
    //   - valeur NEGATIVE = gain (meilleur CM)
    //   - valeur POSITIVE = perte (pire CM)
    // Donc l'impact CM (en points) suit le signe de l'écart :
    // Delta points = (écart€ / CA) * 100
    if (!selectedProduct?.id) return null;
    if (!salesForSelectedMonth || salesForSelectedMonth <= 0) return null;
    return (selectedMonthValue / salesForSelectedMonth) * 100;
  }, [selectedProduct, selectedMonthValue, salesForSelectedMonth]);

  return (
    <div className={`min-h-screen lg:h-screen flex flex-col overflow-y-auto ${dailyMode === 'page' ? 'lg:overflow-y-auto' : 'lg:overflow-hidden'} text-slate-900 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50`}>

      {/* ══ HEADER ══════════════════════════════════════════════════════ */}
      <header className="flex-none bg-white/90 backdrop-blur border-b border-slate-200 px-3 sm:px-5 py-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">

          {/* Gauche : retour + titre + badge mois */}
          <div className="flex items-center gap-3">
            {onBackHome && (
              <button onClick={onBackHome}
                className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 font-bold text-xs transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                </svg>
                <span className="hidden sm:inline">Accueil</span>
              </button>
            )}
            <div className="hidden sm:block w-px h-5 bg-slate-200" />
            <div>
              <h1 className="text-sm font-extrabold text-slate-900 leading-none">Analyse Coût Matière</h1>
              <p className="text-[10px] text-slate-500 mt-0.5">{importedMonthsCount}/12 mois importés</p>
            </div>
          </div>

          {/* Centre : sélecteur de période */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">Période</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value as PeriodKey)}
              className="bg-transparent text-sm font-bold text-slate-800 outline-none cursor-pointer"
            >
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              <option value="Annuel">Annuel</option>
            </select>
          </div>

          {/* Droite : actions secondaires */}
          <div className="flex items-center gap-2">

            
{!isDesktop && (
              <button
                onClick={() => setIsMobileFocusOpen(true)}
                className="text-[11px] font-extrabold text-white bg-slate-900 hover:bg-slate-800 rounded-xl px-3 py-1.5 transition-colors"
              >
                Focus produit
              </button>
            )}
            <button
              onClick={() => { ensureDailySheetExists(); setDailyMode('page'); }}
              className="text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl px-3 py-1.5 transition-colors"
            >
              Journalier
            </button>

          </div>
        </div>
      </header>

      {/* ══ CONTENU ══════════════════════════════════════════════════════ */}
      <main className={dailyMode === 'page' ? "hidden" : "flex-1 min-h-0 p-3 pb-6 sm:p-4 sm:pb-4 lg:p-5 grid grid-cols-12 gap-4 overflow-visible lg:overflow-hidden"}>

        {/* ── Colonne gauche : KPIs + tableaux ──────────────────────────── */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-4 min-h-0">

          {/* KPIs */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 flex-none">
            <StatCard label="Couverts" value={coversForSelectedMonth == null ? "—" : Math.round(coversForSelectedMonth)} suffix="Pax" color="indigo" />
            <StatCard label="Marge Brute" value={costForSelectedMonth == null ? "—" : (100 - costForSelectedMonth)} suffix="%" color="emerald" />
            <StatCard
              label="Coût Matière"
              value={costForSelectedMonth == null ? '—' : costForSelectedMonth}
              suffix="%"
              color="rose"
              subLabel="vs objectif 25.5%"
              subValue={vsObjectivePts == null ? '—' : `${vsObjectivePts >= 0 ? '+' : ''}${vsObjectivePts.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pts`}
            />
            <StatCard label="Écart Total" value={ecartTotal} suffix="€" color="orange" />
          </div>

          {/* Tableaux Top 10 */}
          <div className="flex-1 min-h-0 flex flex-col gap-3">

            {/* Onglets mobile */}
            <div className="md:hidden flex gap-2 bg-white/70 backdrop-blur rounded-2xl border border-white/60 p-1.5">
              <button onClick={() => setMobileTopTab('liquides')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-extrabold transition-colors ${mobileTopTab === 'liquides' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600'}`}>
                🥤 Liquides
              </button>
              <button onClick={() => setMobileTopTab('solides')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-extrabold transition-colors ${mobileTopTab === 'solides' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-600'}`}>
                🍽️ Solides
              </button>
            </div>

            {/* Desktop : côte à côte */}
            <div className="hidden md:grid grid-cols-2 gap-4 flex-1 min-h-0">
              <EcartsList title="Top Écarts Liquides" items={topLiquides} type="liquide"
                onSelectItem={(it) => { setFocusId(it.id ?? null); setSearchText(it.name); }}
                selectedId={selectedProduct?.id ?? focusId} periodSales={salesForSelectedMonth} />
              <EcartsList title="Top Écarts Solides" items={topSolides} type="solide"
                onSelectItem={(it) => { setFocusId(it.id ?? null); setSearchText(it.name); }}
                selectedId={selectedProduct?.id ?? focusId} periodSales={salesForSelectedMonth} />
            </div>

            {/* Mobile : un tableau à la fois */}
            <div className="md:hidden flex-1 min-h-[320px]">
              {mobileTopTab === 'liquides'
                ? <EcartsList title="Top Écarts Liquides" items={topLiquides} type="liquide"
                    onSelectItem={(it) => { setFocusId(it.id ?? null); setSearchText(it.name); }}
                    selectedId={selectedProduct?.id ?? focusId} periodSales={salesForSelectedMonth} />
                : <EcartsList title="Top Écarts Solides" items={topSolides} type="solide"
                    onSelectItem={(it) => { setFocusId(it.id ?? null); setSearchText(it.name); }}
                    selectedId={selectedProduct?.id ?? focusId} periodSales={salesForSelectedMonth} />
              }
            </div>
          </div>
        </div>

        {/* ── Colonne droite : graphiques + focus produit ──────────────── */}
        <div className="hidden lg:flex col-span-4 flex-col gap-3 min-h-0 overflow-hidden">

          {/* Graphique coût matière — hauteur fixe */}
          <div className="h-[160px] flex-none">
            <FoodCostChart data={costChartData} />
          </div>

          {/* Bloc recherche + switch €/Qté — hauteur fixe */}
          <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200/70 shadow-sm p-3 flex-none">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Analyse produit</p>
            <div className="flex gap-2 mb-1.5">
              <input
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setFocusId(null); }}
                placeholder="Chercher un produit…"
                className={`flex-1 text-xs px-3 py-2 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-400 transition-colors ${selectedProduct ? 'border-indigo-300 bg-indigo-50/30' : 'border-slate-200 bg-white'}`}
                list="products-list"
              />
              {selectedProduct && (
                <button onClick={() => { setSearchText(''); setFocusId(null); }}
                  className="px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-400 text-xs font-bold transition-colors">
                  ✕
                </button>
              )}
            </div>
            {selectedProduct
              ? <p className="text-[10px] text-indigo-700 font-semibold truncate mb-2">↳ {selectedProduct.name}</p>
              : <p className="text-[10px] text-slate-400 mb-2">Clique un produit dans le Top 10 pour l'analyser</p>
            }
            <div className="flex gap-1.5">
              <button onClick={() => setTrendMode('euro')}
                className={`flex-1 text-[10px] font-extrabold py-1.5 rounded-lg border transition-colors ${trendMode === 'euro' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                Valeur €
              </button>
              <button onClick={() => setTrendMode('qty')}
                className={`flex-1 text-[10px] font-extrabold py-1.5 rounded-lg border transition-colors ${trendMode === 'qty' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                Quantité
              </button>
            </div>
            <datalist id="products-list">
              {allProducts.map(p => <option key={p.id} value={p.name} />)}
            </datalist>
          </div>

          {/* Graphique tendance — hauteur fixe, TOUJOURS visible */}
          <div className="h-[180px] flex-none">
            <ProductTrendChart key={trendMode} data={trendData} title={focusTitle} mode={trendMode} />
          </div>

          {/* Panel focus — sans scroll interne (le scroll doit rester celui de la page) */}
          <div className="flex-1 min-h-0 flex flex-col gap-3">
            {/* Panel focus — visible seulement si un produit est sélectionné */}
            {selectedProduct && (
              <div className="bg-slate-900 text-white rounded-2xl p-3 flex-none border border-white/10 shadow-lg">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Focus article</p>
                    <p className="text-xs font-extrabold mt-0.5 truncate">{selectedProduct.name}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
  {selectedMonthValue > 0
    ? <span className="bg-rose-500 text-[9px] px-2 py-0.5 rounded-full font-extrabold">PERTE</span>
    : selectedMonthValue < 0
    ? <span className="bg-emerald-500 text-[9px] px-2 py-0.5 rounded-full font-extrabold">GAIN</span>
    : null}

  {/* Actions toujours visibles (même si la page est courte) */}
  <div className="flex items-center gap-1">
    <button
      onClick={() => setIsDetailOpen(true)}
      className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-extrabold"
      title="Ouvrir le détail produit"
      type="button"
    >
      Détail
    </button>
    <button
      onClick={addSelectedToDaily}
      className="px-2 py-1 rounded-lg bg-amber-500/90 hover:bg-amber-400 text-white text-[10px] font-extrabold"
      title="Ajouter ce produit au suivi journalier"
      type="button"
    >
      + Jour
    </button>
  </div>
</div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-white/5 rounded-xl p-2 border border-white/10">
                    <p className="text-[9px] text-slate-400 uppercase mb-0.5">
                      {selectedMonthValue > 0 ? 'Perte' : selectedMonthValue < 0 ? 'Gain' : 'Écart'}
                    </p>
                    <p className={`text-sm font-extrabold ${selectedMonthValue > 0 ? 'text-rose-300' : selectedMonthValue < 0 ? 'text-emerald-300' : 'text-slate-200'}`}>
                      {Math.abs(selectedMonthValue).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-2 border border-white/10">
                    <p className="text-[9px] text-slate-400 uppercase mb-0.5">Impact CM</p>
                    <p className="text-sm font-extrabold text-slate-200">
                      {impactCmPoints == null
                        ? <span className="text-slate-500 text-[10px] font-medium">Renseigne le CA</span>
                        : `${impactCmPoints >= 0 ? '+' : ''}${impactCmPoints.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pts`}
                    </p>
                  </div>
                </div>
                {/* (On garde aussi les libellés complets en dessous sur grands écrans) */}
<div className="hidden md:grid grid-cols-2 gap-2">
  <button onClick={() => setIsDetailOpen(true)}
    className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-extrabold py-2 rounded-xl transition-colors"
    type="button">
    Détail produit
  </button>
  <button onClick={addSelectedToDaily}
    className="bg-amber-500/80 hover:bg-amber-400 text-white text-[10px] font-extrabold py-2 rounded-xl transition-colors"
    type="button">
    + Journalier
  </button>
</div>
              </div>
            )}

          </div>
        </div>

        {/* ── Mobile : actions + graphique ─────────────────────────────── */}
        <div className="col-span-12 lg:hidden flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setIsMobileFocusOpen(true)}
              className="min-h-[46px] rounded-xl bg-slate-900 text-white text-xs font-extrabold">Focus produit</button>
            <button onClick={() => { ensureDailySheetExists(); setDailyMode('page'); }}
              className="min-h-[46px] rounded-xl bg-amber-500 text-white text-xs font-extrabold">Journalier</button>
</div>
          {!mobileTerrainMode && (
            <div className="h-[180px]"><FoodCostChart data={costChartData} /></div>
          )}
        </div>

      </main>

      {/* ══ BARRE MOBILE BAS ════════════════════════════════════════════ */}
      {/* Mobile Focus Drawer */}
      {isMobileFocusOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/45" onClick={() => setIsMobileFocusOpen(false)} />
          <div className={`absolute inset-x-0 bottom-0 ${isNarrowMobile ? 'top-2' : 'top-8'} bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 flex flex-col overflow-hidden`}>
            <div className="p-3 border-b border-slate-200 bg-white">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Focus produit</p>
                <button onClick={() => setIsMobileFocusOpen(false)} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-extrabold">Fermer</button>
              </div>
              <div className="flex flex-col gap-2">
                <input
                  value={searchText}
                  onChange={(e) => { setSearchText(e.target.value); setFocusId(null); }}
                  placeholder="Rechercher un produit…"
                  className={`w-full text-sm px-3 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500 ${selectedProduct ? 'border-indigo-300 bg-white' : 'border-slate-200 bg-white'}`}
                  list="products-list"
                />
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => { setSearchText(''); setFocusId(null); }} className="min-h-[44px] rounded-xl border border-slate-200 bg-white text-xs font-extrabold">Effacer</button>
                  <button onClick={() => setTrendMode('euro')} className={`min-h-[44px] rounded-xl border text-xs font-extrabold ${trendMode === 'euro' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200'}`}>€</button>
                  <button onClick={() => setTrendMode('qty')} className={`min-h-[44px] rounded-xl border text-xs font-extrabold ${trendMode === 'qty' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200'}`}>Qté</button>
                </div>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-3 space-y-3">
              <div className="h-[220px]"><ProductTrendChart key={`mobile-${trendMode}`} data={trendData} title={focusTitle} mode={trendMode} /></div>
              <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-900/70 text-white rounded-2xl p-3 shadow-lg border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] font-extrabold text-slate-200/80 uppercase tracking-wider">Focus Article</h4>
                  <span className="bg-rose-500/90 text-[10px] px-2 py-1 rounded-full font-extrabold">ALERTE</span>
                </div>
                <p className="text-sm font-bold mb-2">{focusTitle}</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="bg-white/5 p-2 rounded border border-white/10">
                    <p className="text-[9px] text-slate-400 uppercase">Écart €</p>
                    <p className={`text-sm font-bold ${selectedMonthValue > 0 ? 'text-rose-300' : selectedMonthValue < 0 ? 'text-emerald-300' : 'text-slate-200'}`}>{Math.abs(selectedMonthValue).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</p>
                  </div>
                  <div className="bg-white/5 p-2 rounded border border-white/10">
                    <p className="text-[9px] text-slate-400 uppercase">Impact CM</p>
                    <p className="text-sm font-bold text-slate-200">{impactCmPoints == null ? '—' : `${impactCmPoints >= 0 ? '+' : ''}${impactCmPoints.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pts`}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { setIsDetailOpen(true); setIsMobileFocusOpen(false); }} className="min-h-[44px] bg-indigo-600 text-white text-xs font-extrabold rounded-xl">Détail</button>
                  <button onClick={addSelectedToDaily} className="min-h-[44px] bg-amber-500/90 text-white text-xs font-extrabold rounded-xl">+ Journalier</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Detail Drawer */}
      {isDetailOpen && (
        (() => {
          const meta = selectedProduct?.id ? withType.find(i => i.id === selectedProduct.id) : null;
          const period = selectedMonth;
          return (
            <div className={dailyMode === 'modal' ? "fixed inset-0 z-50" : "flex-1 min-h-0 p-3 pb-6 sm:p-4 sm:pb-4 lg:p-5"}>
              <div className="absolute inset-0 bg-slate-900/40" onClick={() => setIsDetailOpen(false)} />
              <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl border-l border-slate-200 flex flex-col">
                <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Détail produit</p>
                    <h3 className="text-base font-extrabold text-slate-900 truncate" title={focusTitle}>{focusTitle}</h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Période : <span className="font-semibold">{period}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setIsDetailOpen(false)}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold"
                  >
                    Fermer
                  </button>
                </div>

                <div className="p-4 flex-1 min-h-0 overflow-auto">
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="rounded-2xl border border-slate-200 p-3">
                      <p className="text-[10px] text-slate-500 uppercase">Secteur</p>
                      <p className="text-sm font-bold text-slate-900 truncate" title={meta?.sector ?? ''}>{meta?.sector ?? '—'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-3">
                      <p className="text-[10px] text-slate-500 uppercase">Fournisseur</p>
                      <p className="text-sm font-bold text-slate-900 truncate" title={meta?.supplier ?? ''}>{meta?.supplier ?? '—'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-3">
                      <p className="text-[10px] text-slate-500 uppercase">Écart € (mois)</p>
                      <p className={`text-sm font-extrabold ${selectedMonthValue > 0 ? 'text-rose-600' : selectedMonthValue < 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {Math.abs(selectedMonthValue).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedMonthValue > 0 ? '€ (perte)' : selectedMonthValue < 0 ? '€ (gain)' : '€'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-3">
                      <p className="text-[10px] text-slate-500 uppercase">Impact CM</p>
                      <p className="text-sm font-extrabold text-slate-900">
                        {impactCmPoints == null ? '—' : `${impactCmPoints >= 0 ? '+' : ''}${impactCmPoints.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pts`}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 flex items-center justify-between">
                      <p className="text-xs font-extrabold text-slate-800">Historique mensuel</p>
                      <div className="text-[10px] text-slate-500">(€ et Qté)</div>
                    </div>
                    <table className="w-full text-xs">
                      <thead className="bg-white">
                        <tr className="text-[10px] text-slate-500">
                          <th className="text-left px-4 py-2">Mois</th>
                          <th className="text-right px-4 py-2">€</th>
                          <th className="text-right px-4 py-2">Qté</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {trendData.map((p) => (
                          <tr key={p.month}>
                            <td className="px-4 py-2 font-semibold text-slate-700">{p.month}</td>
                            <td className={`px-4 py-2 text-right tabular-nums font-bold ${p.euro > 0 ? 'text-rose-600' : p.euro < 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                              {p.euro.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                            </td>
                            <td className={`px-4 py-2 text-right tabular-nums ${p.qty > 0 ? 'text-rose-600' : p.qty < 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                              {p.qty.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-200 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { addSelectedToDaily(); setIsDetailOpen(false); }}
                    className="bg-amber-500/90 hover:bg-amber-400 text-white text-xs font-extrabold py-2 rounded-xl shadow-sm"
                    title="Ajouter ce produit au suivi journalier"
                  >
                    + Journalier
                  </button>
                  <button
                    onClick={() => setIsDetailOpen(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold py-2 rounded-xl"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* Follow-up Drawer */}
      {FOLLOW_UP_ENABLED && isFollowUpOpen && (
        <div className={dailyMode === 'modal' ? "fixed inset-0 z-50" : "flex-1 min-h-0 p-3 pb-6 sm:p-4 sm:pb-4 lg:p-5"}>
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setIsFollowUpOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl border-l border-slate-200 flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Feuille de suivi</p>
                <h3 className="text-base font-extrabold text-slate-900">Plan d’action</h3>
                <p className="text-xs text-slate-600 mt-1">Période : <span className="font-semibold">{currentPeriod}</span></p>
              </div>
              <button
                onClick={() => setIsFollowUpOpen(false)}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold"
              >
                Fermer
              </button>
            </div>

            <div className="p-4 border-b border-slate-200">
              <button
                onClick={createFollowUpFromTop10}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold py-2 rounded-xl"
              >
                Préparer depuis Top10
              </button>
              <p className="text-[11px] text-slate-500 mt-2">Objectif : transformer les plus gros écarts en actions simples à suivre au quotidien.</p>
            </div>

            <div className="flex-1 min-h-0 overflow-auto p-4">
              {followUps.filter(f => f.period === currentPeriod).length === 0 ? (
                <div className="text-sm text-slate-600">
                  Aucun élément pour cette période. Clique sur <span className="font-semibold">Préparer depuis Top10</span>.
                </div>
              ) : (
                <div className="space-y-3">
                  {followUps
                    .filter(f => f.period === currentPeriod)
                    .map((f) => (
                      <div key={`${f.period}-${f.id}`} className="rounded-2xl border border-slate-200 p-3 bg-white">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-slate-900 truncate" title={f.name}>{f.name}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 truncate" title={`${f.sector ?? ''} • ${f.supplier ?? ''}`}>
                              {(f.type === 'LIQUIDE' ? '🥤' : '🍽️')} {f.sector ?? '—'} • {f.supplier ?? '—'}
                            </p>
                          </div>
                          <button
                            onClick={() => setFollowUps(prev => prev.filter(x => !(x.period === f.period && x.id === f.id)))}
                            className="text-slate-400 hover:text-slate-700 text-xs font-extrabold"
                            title="Retirer du suivi"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <select
                            value={f.status}
                            onChange={(e) => {
                              const v = e.target.value as FollowUpStatus;
                              setFollowUps(prev => prev.map(x => (x.period === f.period && x.id === f.id) ? { ...x, status: v } : x));
                            }}
                            className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                          >
                            <option value="À faire">À faire</option>
                            <option value="En cours">En cours</option>
                            <option value="Fait">Fait</option>
                          </select>
                          <button
                            onClick={() => { setFocusId(f.id); setSearchText(f.name); setIsFollowUpOpen(false); }}
                            className="w-full text-xs px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-extrabold border border-indigo-200"
                          >
                            Voir
                          </button>
                        </div>

                        <textarea
                          value={f.notes ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setFollowUps(prev => prev.map(x => (x.period === f.period && x.id === f.id) ? { ...x, notes: v } : x));
                          }}
                          placeholder="Cause / Action / Responsable / Notes…"
                          className="mt-2 w-full text-xs p-3 rounded-xl border border-slate-200 bg-white min-h-[72px]"
                        />
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Daily Sheet (Stocks/Ventes) */}
      {dailyMode && (
        (() => {
          const sheet = currentDailySheet ?? ensureDailySheetExists();
          const rows = sheet.rows;
          const liquidRows = rows.filter(r => r.type === 'LIQUIDE');
          const solidRows = rows.filter(r => r.type === 'SOLIDE');
          const fmtNum = (n: number | null | undefined, digits = 2) => {
            const v = (n ?? 0);
            return v.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
          };
          const fmtMaybe = (n: number | null | undefined, digits = 2) => {
            if (n == null || !Number.isFinite(n)) return '';
            return n.toLocaleString('fr-FR', { maximumFractionDigits: digits });
          };
          const parseFrInput = (s: string): number | null => {
            const t = (s ?? '').trim();
            if (!t) return null;
            const n = Number(t.replace(/\s+/g, '').replace(',', '.'));
            return Number.isFinite(n) ? n : null;
          };

          const compute = (r: DailyRow) => {
            const sp = r.stockPrev ?? 0;
            const vp = r.salesPrev ?? 0;
            const st = r.stockToday ?? 0;
            const perso = r.perso ?? 0;
            const loss = r.loss ?? 0;
            const theoEnd = sp - vp - perso - loss;
            const variance = st - theoEnd;
            const pu = r.unitPrice ?? 0;
            const impact = variance * pu;
            const lossEuro = Math.max(0, -variance) * pu;
            return { theoEnd, variance, impact, lossEuro };
          };

          const totals = rows.reduce(
            (acc, r) => {
              const c = compute(r);
              acc.net += c.impact;
              acc.loss += c.lossEuro;
              acc.gain += Math.max(0, c.impact);
              return acc;
            },
            { net: 0, loss: 0, gain: 0 }
          );

          const updateRow = (id: string, patch: Partial<DailyRow>) => {
            const now = new Date().toISOString();
            const next: DailySheet = {
              ...sheet,
              rows: sheet.rows.map(r => (r.id === id ? { ...r, ...patch } : r)),
              updatedAt: now,
            };
            upsertDailySheet(next);
          };

          const removeRow = (id: string) => {
            const now = new Date().toISOString();
            const next: DailySheet = {
              ...sheet,
              rows: sheet.rows.filter(r => r.id !== id),
              updatedAt: now,
            };
            upsertDailySheet(next);
            setDailySelectedIds(prev => prev.filter(x => x !== id));
          };

          const removeRows = (ids: string[]) => {
            if (!ids.length) return;
            const now = new Date().toISOString();
            const toRemove = new Set(ids);
            const next: DailySheet = {
              ...sheet,
              rows: sheet.rows.filter(r => !toRemove.has(r.id)),
              updatedAt: now,
            };
            upsertDailySheet(next);
            setDailySelectedIds(prev => prev.filter(x => !toRemove.has(x)));
          };

          const toggleSelectDaily = (id: string) => {
            setDailySelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
          };


          return (
            <div className={dailyMode === 'modal' ? "fixed inset-0 z-50" : "flex-1 min-h-0 p-3 pb-6 sm:p-4 sm:pb-4 lg:p-5"}>
              {dailyMode === 'modal' && (<div className="absolute inset-0 bg-slate-900/40 no-print" onClick={() => setDailyMode(null)} />)}
              <div className={dailyMode === 'modal' ? "absolute inset-x-0 top-3 sm:top-6 lg:top-8 bottom-3 sm:bottom-6 lg:bottom-8 mx-auto w-[98vw] sm:w-[96vw] max-w-6xl bg-white shadow-2xl rounded-2xl sm:rounded-3xl border border-slate-200 flex flex-col overflow-hidden daily-print-area" : "w-full mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col daily-print-area"}>
                <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-slate-200 bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 flex flex-col gap-2">
                  {/* Ligne 1 : titre + bouton Fermer */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Journalier</p>
                      <h3 className="text-sm sm:text-lg font-extrabold text-slate-900 leading-tight">Stocks • Ventes • Écarts</h3>
                      <p className="text-[10px] sm:text-xs text-slate-600 mt-0.5">Période : <span className="font-semibold">{currentPeriod}</span></p>
                    </div>
                    <button
                      onClick={() => setDailyMode(null)}
                      className={dailyMode === 'page'
                        ? "shrink-0 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold"
                        : "shrink-0 w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold flex items-center justify-center text-lg leading-none"}
                    >
                      {dailyMode === 'page' ? 'Retour' : '×'}
                    </button>
                  </div>
                  {/* Ligne 2 : date + boutons action (scrollable sur mobile) */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-print [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="flex items-center gap-1.5 bg-white/70 border border-white/80 rounded-xl px-2.5 py-1.5 shadow-sm shrink-0">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase">Date</label>
                      <input
                        type="date"
                        value={dailyDateKey}
                        onChange={(e) => setDailyDateKey(e.target.value)}
                        className="text-xs font-bold bg-transparent outline-none w-28"
                      />
                    </div>
                    <button
                      onClick={generateDailyFromTop10}
                      className="shrink-0 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] sm:text-xs font-extrabold shadow-sm whitespace-nowrap"
                      title="Générer / mettre à jour la feuille avec les produits du Top10"
                    >
                      Générer Top10
                    </button>

                    {/* Choix impression : Liquides / Solides / Tout */}
                    <div className="shrink-0 flex items-center gap-1.5 bg-white/70 border border-white/80 rounded-xl px-2 py-1.5 shadow-sm">
                      {([
                        { k: 'LIQUIDE' as const, label: 'Liquides' },
                        { k: 'SOLIDE' as const, label: 'Solides' },
                        { k: 'ALL' as const, label: 'Tout' },
                      ]).map((b) => (
                        <button
                          key={b.k}
                          onClick={() => setDailyPrintScope(b.k)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-extrabold border transition-colors ${dailyPrintScope === b.k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                          title="Choisir ce qui sera imprimé"
                          type="button"
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>

                    {DAILY_PRINT_ENABLED && !isDesktop && (


                    <button
                      onClick={() => {
                        document.body.classList.add('printing-daily');
                        document.body.setAttribute('data-print-scope', dailyPrintScope);

                        const cleanup = () => {
                          document.body.classList.remove('printing-daily');
                          document.body.removeAttribute('data-print-scope');
                          window.removeEventListener('afterprint', cleanup);
                        };

                        window.addEventListener('afterprint', cleanup);
                        window.print();}}
                      className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] sm:text-xs font-extrabold whitespace-nowrap"
                      title="Imprimer cette feuille"
                    >
                      🖨️ Imprimer
                    </button>


                    )}
                  </div>
                </div>

                <div className="px-3 sm:px-6 py-2 sm:py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 no-print">
                  <div className="flex items-center gap-2 text-xs overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <span className="shrink-0 px-2.5 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-800 font-extrabold whitespace-nowrap">Pertes : {fmtNum(totals.loss)} €</span>
                    <span className="shrink-0 px-2.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-extrabold whitespace-nowrap">Gains : {fmtNum(totals.gain)} €</span>
                    <span className="shrink-0 px-2.5 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-800 font-extrabold whitespace-nowrap">Net : {fmtNum(totals.net)} €</span>
                  </div>
                  <div className="hidden sm:block text-xs text-slate-600">
                    Remplis <span className="font-semibold">Stock veille</span>, <span className="font-semibold">Ventes veille</span>, <span className="font-semibold">Stock jour</span>. L'écart se calcule automatiquement.
                  </div>
                </div>

                {/*
                  Zone contenu : on évite les scrollbars horizontales (surtout pour l'impression)
                  et on affiche une seule section si l'utilisateur a choisi Liquides/Solides.
                */}
                <div className="flex-1 min-h-0 overflow-auto">
                  {rows.length === 0 ? (
                    <div className="p-10 text-slate-600">
                      Aucun produit dans la feuille. Clique sur <span className="font-semibold">Générer Top10</span>.
                    </div>
                  ) : (
                    <div className="p-4">
                      {(
                        dailyPrintScope === 'LIQUIDE'
                          ? [{ key: 'LIQUIDE' as const, title: '🥤 Liquides', data: liquidRows }]
                          : dailyPrintScope === 'SOLIDE'
                            ? [{ key: 'SOLIDE' as const, title: '🍽️ Solides', data: solidRows }]
                            : [
                                { key: 'LIQUIDE' as const, title: '🥤 Liquides', data: liquidRows },
                                { key: 'SOLIDE' as const, title: '🍽️ Solides', data: solidRows },
                              ]
                      ).map((section) => (
                        <div
                          key={section.key}
                          className={`mb-6 last:mb-0 ${section.key === 'LIQUIDE' ? 'daily-section-liquide' : 'daily-section-solide'}`}
                        >
                          {(() => {
                            const selectedInSection = section.data.filter(r => dailySelectedIds.includes(r.id));
                            const allSelected = section.data.length > 0 && selectedInSection.length === section.data.length;
                            return (
                              <div className="flex items-center justify-between mb-2 gap-2">
                                <div className="min-w-0">
                                  <h4 className="text-xs font-extrabold text-slate-800">{section.title}</h4>
                                  <span className="text-[10px] font-bold text-slate-500">{section.data.length} produit(s){selectedInSection.length ? ` • ${selectedInSection.length} sélectionné(s)` : ''}</span>
                                </div>
                                <div className="flex items-center gap-2 no-print">
                                  <button
                                    onClick={() => {
                                      if (allSelected) {
                                        setDailySelectedIds(prev => prev.filter(id => !section.data.some(r => r.id === id)));
                                      } else {
                                        setDailySelectedIds(prev => {
                                          const set = new Set(prev);
                                          section.data.forEach(r => set.add(r.id));
                                          return Array.from(set);
                                        });
                                      }
                                    }}
                                    className="text-[11px] px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 font-extrabold text-slate-700 no-print"
                                  >
                                    {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                                  </button>
                                  <button
                                    onClick={() => removeRows(selectedInSection.map(r => r.id))}
                                    disabled={selectedInSection.length === 0}
                                    className={`text-[11px] px-3 py-1.5 rounded-full font-extrabold ${selectedInSection.length ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed'} no-print`}
                                  >
                                    Supprimer sélection
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                          <div className="rounded-3xl border border-slate-200 shadow-sm bg-white">
                            {/*
                              Mobile/Tablet: autoriser le scroll horizontal pour accéder aux colonnes.
                              Desktop: garder un rendu sans scroll horizontal.
                            */}
                            <div
                              className="overflow-x-auto overflow-y-hidden lg:overflow-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                              style={{ WebkitOverflowScrolling: 'touch' }}
                            >
                              <table className="w-full min-w-[920px] lg:min-w-0 text-xs table-auto">
                              <thead className="bg-slate-50">
                                <tr className="text-[10px] text-slate-600">
                                  <th className="text-center px-2 py-2 w-10 no-print"> </th>
                                  <th className="text-left px-3 py-2">Produit</th>
                                  <th className="text-right px-3 py-2">Stock veille</th>
                                  <th className="text-right px-3 py-2">Ventes veille</th>
                                  <th className="text-right px-3 py-2">Stock jour</th>
                                  <th className="text-right px-3 py-2">Perso</th>
                                  <th className="text-right px-3 py-2">Perte</th>
                                  <th className="text-right px-3 py-2">Écart</th>
                                  <th className="text-right px-3 py-2">PU</th>
                                  <th className="text-right px-3 py-2">Impact €</th>
                                  <th className="text-right px-3 py-2 no-print"> </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {section.data.map((r) => {
                                  const c = compute(r);
                                  const varCls = c.variance < 0 ? 'text-rose-700' : c.variance > 0 ? 'text-emerald-700' : 'text-slate-700';
                                  const impCls = c.impact < 0 ? 'text-rose-700' : c.impact > 0 ? 'text-emerald-700' : 'text-slate-700';
                                  return (
                                    <tr key={r.id} className={`hover:bg-amber-50/40 ${dailySelectedIds.includes(r.id) ? 'bg-amber-50/60' : ''}`}> 
                                      <td className="px-2 py-2 text-center no-print">
                                        <input
                                          type="checkbox"
                                          checked={dailySelectedIds.includes(r.id)}
                                          onChange={() => toggleSelectDaily(r.id)}
                                          className="h-4 w-4 accent-indigo-600"
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <div className="font-extrabold text-slate-900 whitespace-normal break-words leading-tight" title={r.name}>{(r.type === 'LIQUIDE' ? '🥤 ' : '🍽️ ') + r.name}</div>
                                        <div className="text-[10px] text-slate-500 whitespace-normal break-words leading-tight" title={`${r.sector ?? ''} • ${r.supplier ?? ''}`}>{r.sector ?? '—'} • {r.supplier ?? '—'}</div>
                                      </td>

                                      {(['stockPrev','salesPrev','stockToday','perso','loss'] as const).map((k) => (
                                        <td key={k} className="px-3 py-2 text-right tabular-nums">
                                          <input
                                            defaultValue={fmtMaybe((r as any)[k] ?? null, 2)}
                                            onBlur={(e) => updateRow(r.id, { [k]: parseFrInput(e.target.value) } as any)}
                                            className="w-16 sm:w-20 text-right text-xs px-2 py-1 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="—"
                                          />
                                        </td>
                                      ))}

                                      <td className={`px-3 py-2 text-right tabular-nums font-extrabold ${varCls}`}>{c.variance.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>

                                      <td className="px-3 py-2 text-right tabular-nums">
                                        <input
                                          defaultValue={r.unitPrice == null ? '' : fmtMaybe(r.unitPrice, 2)}
                                          onBlur={(e) => updateRow(r.id, { unitPrice: parseFrInput(e.target.value) } as any)}
                                          className="w-14 sm:w-16 text-right text-xs px-2 py-1 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                          placeholder="PU"
                                        />
                                      </td>

                                      <td className={`px-3 py-2 text-right tabular-nums font-extrabold ${impCls}`}>{c.impact.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>

                                      <td className="px-2 py-2 text-right no-print">
                                        <button
                                          onClick={() => removeRow(r.id)}
                                          className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold"
                                          title="Retirer ce produit du suivi journalier"
                                        >
                                          ✕
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()
      )}

    </div>
  );
};

export default App;