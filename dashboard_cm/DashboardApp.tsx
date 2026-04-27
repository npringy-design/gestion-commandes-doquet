
import React, { useEffect, useMemo, useRef, useState } from 'react';
import StatCard from './components/StatCard';
import EcartsList from './components/EcartsList';
import { FoodCostChart, ProductTrendChart } from './components/Charts';
import AppNavTile from '../src/components/AppNavTile';
import { loadJSON, saveJSON } from "./utils/storage";

import { MONTHS } from './constants';
import type { DailyRow, DailySheet, EcartItem, FollowUpItem, FollowUpStatus, MonthKey, PeriodKey, ProductSeriesPoint } from './types';
import { parseEcartCsvText } from './utils/ecartImport';
import {
  DEFAULT_TARGET_PERCENT,
  buildAnnualItems,
  buildCostChartData,
  buildDailyRowsFromTop10,
  buildFollowUpsFromTop10,
  buildTrendData,
  collectProducts,
  createExcludedSectorMatcher,
  ensureDailySheet,
  getSummedMetricForPeriod,
  getTodayKey,
  getUnitPriceForProduct,
  getWeightedCostForPeriod,
  getTopEcartsByType,
  withResolvedType,
} from './utils/dashboardHelpers';

const App: React.FC<{ csvByMonth?: Record<string, string>; coversByMonthFromParams?: Record<string, number | null>; costByMonthFromParams?: Record<string, number | null>; salesByMonthFromParams?: Record<string, number | null>; onBackHome?: () => void; onOpenParams?: () => void; readOnlyAnalyse?: boolean; }> = ({ csvByMonth, coversByMonthFromParams, costByMonthFromParams, salesByMonthFromParams, onBackHome, onOpenParams, readOnlyAnalyse = false }) => {
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
  const FOLLOWUP_STORAGE_KEY = 'rpd_followups_v1';

  const DAILY_STORAGE_KEY = 'rpd_daily_sheets_v1';
  const todayKey = useMemo(() => getTodayKey(), []);
  const [dailyDateKey, setDailyDateKey] = useState<string>(todayKey);
  const [dailySheets, setDailySheets] = useState<DailySheet[]>(() => loadJSON(DAILY_STORAGE_KEY, [] as DailySheet[]));

  useEffect(() => {
    if (readOnlyAnalyse && dailyMode === 'page') setDailyMode(null);
  }, [readOnlyAnalyse, dailyMode]);

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
    return buildAnnualItems(ecartByMonth);
  }, [isAnnual, selectedMonth, ecartByMonth]);

  const targetPercent = DEFAULT_TARGET_PERCENT;
  const costForSelectedMonth = useMemo(
    () => getWeightedCostForPeriod(isAnnual, selectedMonth, costByMonthFromParams, salesByMonthFromParams),
    [isAnnual, selectedMonth, costByMonthFromParams, salesByMonthFromParams]
  );
  const vsObjectivePts = costForSelectedMonth == null ? null : (costForSelectedMonth - targetPercent);
  const salesForSelectedMonth = useMemo(
    () => getSummedMetricForPeriod(isAnnual, selectedMonth, salesByMonthFromParams),
    [isAnnual, selectedMonth, salesByMonthFromParams]
  );

  const coversForSelectedMonth = useMemo(
    () => getSummedMetricForPeriod(isAnnual, selectedMonth, coversByMonthFromParams),
    [isAnnual, selectedMonth, coversByMonthFromParams]
  );

  const isExcluded = useMemo(() => createExcludedSectorMatcher(), []);

  const costChartData = useMemo(
    () => buildCostChartData(costByMonthFromParams, targetPercent),
    [costByMonthFromParams, targetPercent]
  );

  const withType = useMemo(() => withResolvedType(monthItems, isExcluded), [monthItems, isExcluded]);

  const topLiquides = useMemo(() => getTopEcartsByType(withType, 'LIQUIDE'), [withType]);

  const topSolides = useMemo(() => getTopEcartsByType(withType, 'SOLIDE'), [withType]);

  const currentPeriod: PeriodKey = selectedMonth;

  const createFollowUpFromTop10 = () => {
    const next = buildFollowUpsFromTop10(currentPeriod, followUps, topLiquides, topSolides);
    if (next.length === 0) {
      setIsFollowUpOpen(true);
      return;
    }

    setFollowUps((prev) => [...next, ...prev]);
    setIsFollowUpOpen(true);
  };

  const resolveUnitPriceForProduct = (id: string): number | null =>
    getUnitPriceForProduct(id, isAnnual, selectedMonth, ecartByMonth);

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

  const ensureDailySheetExists = () =>
    ensureDailySheet(currentDailySheet, dailyDateKey, currentPeriod, upsertDailySheet);

  const generateDailyFromTop10 = () => {
    const nowIso = new Date().toISOString();
    const base = ensureDailySheetExists();

    const sheet: DailySheet = {
      ...base,
      rows: buildDailyRowsFromTop10(base, topLiquides, topSolides, resolveUnitPriceForProduct),
      updatedAt: nowIso,
    };
    upsertDailySheet(sheet);
    setDailySelectedIds([]);
    setDailyMode('page');
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
    if (readOnlyAnalyse) return;
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
      unitPrice: resolveUnitPriceForProduct(selectedProduct.id),
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
    return monthItems.filter((item) => !isExcluded(item.sector)).reduce((acc, item) => acc + (item.value ?? 0), 0);
  }, [monthItems, isExcluded]);

  const allProducts = useMemo(() => collectProducts(ecartByMonth), [ecartByMonth]);

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

  const trendData: ProductSeriesPoint[] = useMemo(
    () => buildTrendData(selectedProduct?.id, ecartByMonth),
    [selectedProduct, ecartByMonth]
  );

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
    <div className={`min-h-screen lg:h-screen flex flex-col overflow-y-auto lg:overflow-y-auto text-[#2F1D14] bg-[radial-gradient(circle_at_16%_0%,rgba(245,166,58,0.28),transparent_30%),linear-gradient(180deg,#FFF7EA_0%,#F3DDC0_48%,#C97933_100%)]`}>

      {/* ══ HEADER ══════════════════════════════════════════════════════ */}
      <header className="flex-none border-b border-[#A85F2A]/30 bg-[linear-gradient(135deg,#3A2116_0%,#69331F_58%,#A85F2A_100%)] px-3 py-3 shadow-[0_14px_34px_rgba(54,24,12,0.18)] sm:px-5 [&_h1]:text-[#FFF7EA] [&_h1]:text-base [&_h1]:font-black [&_p]:text-[#F1C27B] [&_p]:font-bold">
        <div className="flex items-center justify-between gap-3 flex-wrap">

          {/* Gauche : retour + titre + badge mois */}
          <div className="flex items-center gap-3">
            {onBackHome && (
              <AppNavTile onClick={onBackHome} eyebrow="Retour" icon="home" tone="dark" size="sm">
                Accueil
              </AppNavTile>
            )}
            <div className="hidden h-8 w-px bg-[#F1C27B]/35 sm:block" />
            <div>
              <h1 className="text-sm font-extrabold text-slate-900 leading-none">Coût matière</h1>
              <p className="text-[10px] text-slate-500 mt-0.5">{importedMonthsCount}/12 mois importés</p>
            </div>
          </div>

          {/* Centre : sélecteur de période */}
          <div className="flex items-center gap-2 rounded-[16px] border border-[#F1C27B]/60 bg-[#FFF7EA]/95 px-3 py-2 shadow-[0_8px_18px_rgba(31,14,8,0.12)]">
            <span className="text-[10px] font-black text-[#A85F2A] uppercase tracking-[0.14em]">Période</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value as PeriodKey)}
              className="cursor-pointer bg-transparent text-sm font-black text-[#3A2116] outline-none"
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
                className="rounded-[14px] bg-[#2F1D14] px-3 py-2 text-[11px] font-black text-white transition-colors hover:bg-[#472719]"
              >
                Focus produit
              </button>
            )}
            {!readOnlyAnalyse && (
              <button
                onClick={() => { ensureDailySheetExists(); setDailyMode('page'); }}
                className="rounded-[14px] border border-[#F1C27B]/70 bg-[#F7B24A] px-3 py-2 text-[11px] font-black text-[#3A2116] transition-colors hover:bg-[#FFC266]"
              >
                Journalier
              </button>
            )}

          </div>
        </div>
      </header>

      {/* ══ CONTENU ══════════════════════════════════════════════════════ */}
      <main className={dailyMode === 'page' ? "hidden" : "mx-auto grid w-full max-w-[1760px] flex-1 grid-cols-12 gap-4 overflow-visible p-3 pb-6 sm:p-4 sm:pb-4 lg:min-h-0 lg:overflow-y-auto lg:overflow-x-hidden lg:p-5"}>

        {/* ── Colonne gauche : KPIs + tableaux ──────────────────────────── */}
        <div className="col-span-12 xl:col-span-7 flex flex-col gap-4 min-h-0">

          {/* KPIs */}
          <div className="flex-none rounded-[26px] border border-[#D8AE77] bg-[#FFF7EA]/75 p-3 shadow-[0_14px_30px_rgba(80,38,18,0.10)] backdrop-blur">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A85F2A]">Lecture du mois</p>
                <h2 className="text-lg font-black text-[#2F1D14]">Les repères essentiels</h2>
              </div>
              <p className="text-xs font-bold text-[#8B6B54]">Couverts, marge, CM et écarts au même endroit.</p>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
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
          </div>

          {/* Tableaux Top 10 */}
          <div className="flex-1 min-h-0 flex flex-col gap-3 rounded-[26px] border border-[#D8AE77] bg-[#FFF7EA]/65 p-3 shadow-[0_14px_30px_rgba(80,38,18,0.10)] backdrop-blur">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A85F2A]">Priorités terrain</p>
                <h2 className="text-lg font-black text-[#2F1D14]">Écarts à traiter</h2>
              </div>
              <p className="text-xs font-bold text-[#8B6B54]">Clique un produit pour ouvrir son analyse.</p>
            </div>

            {/* Onglets mobile */}
            <div className="flex gap-2 rounded-2xl border border-[#D8AE77] bg-[#FFF7EA]/85 p-1.5 backdrop-blur md:hidden">
              <button onClick={() => setMobileTopTab('liquides')}
                className={`flex-1 rounded-xl py-2.5 text-sm font-black transition-colors ${mobileTopTab === 'liquides' ? 'bg-[#2F1D14] text-white shadow-sm' : 'text-[#6A432D]'}`}>
                🥤 Liquides
              </button>
              <button onClick={() => setMobileTopTab('solides')}
                className={`flex-1 rounded-xl py-2.5 text-sm font-black transition-colors ${mobileTopTab === 'solides' ? 'bg-[#C86F24] text-white shadow-sm' : 'text-[#6A432D]'}`}>
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
        <div className="hidden xl:flex col-span-5 flex-col gap-3 min-h-0 overflow-hidden">

          {/* Graphique coût matière — hauteur fixe */}
          <div className="h-[160px] flex-none">
            <FoodCostChart data={costChartData} />
          </div>

          {/* Bloc recherche + switch €/Qté — hauteur fixe */}
          <div className="flex-none rounded-[22px] border border-[#D8AE77] bg-[#FFF7EA]/90 p-3 shadow-[0_12px_26px_rgba(80,38,18,0.12)] backdrop-blur">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#A85F2A]">Analyse produit</p>
            <div className="flex gap-2 mb-1.5">
              <input
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setFocusId(null); }}
                placeholder="Chercher un produit…"
                className={`flex-1 rounded-xl border px-3 py-2 text-xs outline-none transition-colors focus:ring-2 focus:ring-[#C86F24]/30 ${selectedProduct ? 'border-[#C86F24] bg-[#FFF1EA]' : 'border-[#E2C39B] bg-[#FFFDF8]'}`}
                list="products-list"
              />
              {selectedProduct && (
                <button onClick={() => { setSearchText(''); setFocusId(null); }}
                  className="rounded-xl border border-[#E2C39B] bg-[#FFFDF8] px-2.5 text-xs font-bold text-[#9A806A] transition-colors hover:bg-white">
                  ✕
                </button>
              )}
            </div>
            {selectedProduct
              ? <p className="text-[10px] text-[#A85F2A] font-black truncate mb-2">↳ {selectedProduct.name}</p>
              : <p className="text-[10px] text-[#8B6B54] mb-2">Clique un produit dans le Top 10 pour l'analyser</p>
            }
            <div className="flex gap-1.5">
              <button onClick={() => setTrendMode('euro')}
                className={`flex-1 rounded-lg border py-1.5 text-[10px] font-black transition-colors ${trendMode === 'euro' ? 'border-[#3A2116] bg-[#3A2116] text-white' : 'border-[#E2C39B] bg-[#FFFDF8] text-[#6A432D] hover:border-[#C86F24]'}`}>
                Valeur €
              </button>
              <button onClick={() => setTrendMode('qty')}
                className={`flex-1 rounded-lg border py-1.5 text-[10px] font-black transition-colors ${trendMode === 'qty' ? 'border-[#416D72] bg-[#416D72] text-white' : 'border-[#E2C39B] bg-[#FFFDF8] text-[#6A432D] hover:border-[#416D72]'}`}>
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
              <div className="rounded-[22px] border border-[#F1C27B]/20 bg-[linear-gradient(135deg,#2F1D14_0%,#5A2B1B_100%)] p-3 text-white shadow-[0_14px_30px_rgba(54,24,12,0.22)] flex-none">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="text-[9px] font-extrabold text-[#F1C27B] uppercase tracking-wider">Focus article</p>
                    <p className="text-xs font-extrabold mt-0.5 truncate">{selectedProduct.name}</p>
                  </div>
                  <div className="shrink-0">
                    {selectedMonthValue > 0
                      ? <span className="bg-rose-500 text-[9px] px-2 py-0.5 rounded-full font-extrabold">PERTE</span>
                      : selectedMonthValue < 0
                      ? <span className="bg-emerald-500 text-[9px] px-2 py-0.5 rounded-full font-extrabold">GAIN</span>
                      : null}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-white/10 rounded-xl p-2 border border-[#F1C27B]/20">
                    <p className="text-[9px] text-[#F1C27B] uppercase mb-0.5">
                      {selectedMonthValue > 0 ? 'Perte' : selectedMonthValue < 0 ? 'Gain' : 'Écart'}
                    </p>
                    <p className={`text-sm font-extrabold ${selectedMonthValue > 0 ? 'text-rose-300' : selectedMonthValue < 0 ? 'text-emerald-300' : 'text-slate-200'}`}>
                      {Math.abs(selectedMonthValue).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-2 border border-[#F1C27B]/20">
                    <p className="text-[9px] text-[#F1C27B] uppercase mb-0.5">Impact CM</p>
                    <p className="text-sm font-extrabold text-slate-200">
                      {impactCmPoints == null
                        ? <span className="text-slate-500 text-[10px] font-medium">Renseigne le CA</span>
                        : `${impactCmPoints >= 0 ? '+' : ''}${impactCmPoints.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pts`}
                    </p>
                  </div>
                </div>
                <div className={`grid gap-2 ${readOnlyAnalyse ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  <button onClick={() => setIsDetailOpen(true)}
                    className="bg-[#FFF7EA] hover:bg-white text-[#3A2116] text-[10px] font-black py-2.5 rounded-xl transition-colors"
                    type="button">
                    Voir le détail
                  </button>
                  {!readOnlyAnalyse && (
                    <button onClick={addSelectedToDaily}
                      className="bg-[#F7B24A] hover:bg-[#FFC266] text-[#3A2116] text-[10px] font-black py-2.5 rounded-xl transition-colors"
                      type="button">
                      Ajouter au journalier
                    </button>
                  )}
                </div>
              </div>
            )}

            {!selectedProduct && (
              <div className="flex-1 rounded-[22px] border border-[#D8AE77] bg-[#FFF7EA]/90 p-4 shadow-[0_12px_26px_rgba(80,38,18,0.12)] backdrop-blur">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#A85F2A]">Mode terrain</p>
                <h3 className="mt-1 text-base font-black text-[#2F1D14]">Choisis un écart pour agir</h3>
                <p className="mt-2 text-xs font-bold leading-5 text-[#8B6B54]">
                  Commence par les listes Liquides ou Solides. Le produit sélectionné ouvrira son historique, son impact et les actions utiles.
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] font-black text-[#6A432D]">
                  <div className="rounded-xl border border-[#E2C39B] bg-white/70 px-2 py-2">1. Repérer</div>
                  <div className="rounded-xl border border-[#E2C39B] bg-white/70 px-2 py-2">2. Analyser</div>
                  <div className="rounded-xl border border-[#E2C39B] bg-white/70 px-2 py-2">3. Suivre</div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── Mobile : actions + graphique ─────────────────────────────── */}
        <div className="col-span-12 xl:hidden flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setIsMobileFocusOpen(true)}
              className="min-h-[46px] rounded-xl bg-[#2F1D14] text-white text-xs font-black shadow-[0_10px_20px_rgba(54,24,12,0.18)]">Focus produit</button>
            {!readOnlyAnalyse && (
              <button onClick={() => { ensureDailySheetExists(); setDailyMode('page'); }}
                className="min-h-[46px] rounded-xl bg-[#F7B24A] text-[#3A2116] text-xs font-black shadow-[0_10px_20px_rgba(54,24,12,0.14)]">Journalier</button>
            )}
</div>
          {!mobileTerrainMode && (
            <div className="h-[180px]"><FoodCostChart data={costChartData} /></div>
          )}
        </div>

      </main>

      {/* ══ BARRE MOBILE BAS ════════════════════════════════════════════ */}
      {/* Mobile Focus Drawer */}
      {isMobileFocusOpen && (
        <div className="xl:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-[#2F1D14]/55" onClick={() => setIsMobileFocusOpen(false)} />
          <div className={`absolute inset-x-0 bottom-0 ${isNarrowMobile ? 'top-2' : 'top-8'} bg-[#FFF7EA] rounded-t-3xl shadow-2xl border-t border-[#D8AE77] flex flex-col overflow-hidden`}>
            <div className="p-3 border-b border-[#E2C39B] bg-[#FFF7EA]">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-black text-[#A85F2A] uppercase tracking-wider">Focus produit</p>
                <button onClick={() => setIsMobileFocusOpen(false)} className="px-3 py-2 rounded-xl bg-[#F3DDC0] text-[#3A2116] text-xs font-black">Fermer</button>
              </div>
              <div className="flex flex-col gap-2">
                <input
                  value={searchText}
                  onChange={(e) => { setSearchText(e.target.value); setFocusId(null); }}
                  placeholder="Rechercher un produit…"
                  className={`w-full text-sm px-3 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-[#C86F24]/30 ${selectedProduct ? 'border-[#C86F24] bg-[#FFF1EA]' : 'border-[#E2C39B] bg-[#FFFDF8]'}`}
                  list="products-list"
                />
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => { setSearchText(''); setFocusId(null); }} className="min-h-[44px] rounded-xl border border-[#E2C39B] bg-[#FFFDF8] text-xs font-black text-[#6A432D]">Effacer</button>
                  <button onClick={() => setTrendMode('euro')} className={`min-h-[44px] rounded-xl border text-xs font-black ${trendMode === 'euro' ? 'bg-[#3A2116] text-white border-[#3A2116]' : 'bg-[#FFFDF8] text-[#6A432D] border-[#E2C39B]'}`}>€</button>
                  <button onClick={() => setTrendMode('qty')} className={`min-h-[44px] rounded-xl border text-xs font-black ${trendMode === 'qty' ? 'bg-[#416D72] text-white border-[#416D72]' : 'bg-[#FFFDF8] text-[#6A432D] border-[#E2C39B]'}`}>Qté</button>
                </div>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-3 space-y-3">
              <div className="h-[220px]"><ProductTrendChart key={`mobile-${trendMode}`} data={trendData} title={focusTitle} mode={trendMode} /></div>
              <div className="bg-[linear-gradient(135deg,#2F1D14_0%,#5A2B1B_100%)] text-white rounded-[22px] p-3 shadow-[0_14px_30px_rgba(54,24,12,0.22)] border border-[#F1C27B]/20">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] font-black text-[#F1C27B] uppercase tracking-wider">Focus Article</h4>
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
                  <button onClick={() => { setIsDetailOpen(true); setIsMobileFocusOpen(false); }} className="min-h-[44px] bg-[#FFF7EA] text-[#3A2116] text-xs font-black rounded-xl">Détail</button>
                  {!readOnlyAnalyse && (
                    <button onClick={addSelectedToDaily} className="min-h-[44px] bg-amber-500/90 text-white text-xs font-extrabold rounded-xl">+ Journalier</button>
                  )}
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
                  {!readOnlyAnalyse && (
                    <button
                      onClick={() => { addSelectedToDaily(); setIsDetailOpen(false); }}
                      className="bg-amber-500/90 hover:bg-amber-400 text-white text-xs font-extrabold py-2 rounded-xl shadow-sm"
                      title="Ajouter ce produit au suivi journalier"
                    >
                      + Journalier
                    </button>
                  )}
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
