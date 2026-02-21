
import React, { useEffect, useMemo, useRef, useState } from 'react';
import StatCard from './components/StatCard';
import EcartsList from './components/EcartsList';
import { FoodCostChart, ProductTrendChart, ProductSeriesPoint } from './components/Charts';
import CostSettingsModal, { CostByMonth, SalesByMonth } from "./components/CostSettingsModal";
import { loadJSON, saveJSON } from "./utils/storage";

import { 
  COST_DATA, 
  MONTHS 
} from './constants';
import { EcartItem } from './types';
import { cleanLabel, determineType, parseEcartCsvText } from './utils/ecartImport';

type MonthKey = string;
type PeriodKey = MonthKey | 'Annuel';
const COST_STORAGE_KEY = "rpdb_cost_settings_v2";
const DEFAULT_TARGET_PERCENT = 25;
const DEFAULT_COST_BY_MONTH: CostByMonth = Object.fromEntries(
  MONTHS.map((m, idx) => [m, (COST_DATA[idx]?.actual ?? null)])
) as CostByMonth;

const DEFAULT_SALES_BY_MONTH: SalesByMonth = Object.fromEntries(
  MONTHS.map((m) => [m, null])
) as SalesByMonth;

type CostSettings = { costByMonth: CostByMonth; salesByMonth: SalesByMonth; targetPercent: number };
const DEFAULT_COST_SETTINGS: CostSettings = {
  costByMonth: DEFAULT_COST_BY_MONTH,
  salesByMonth: DEFAULT_SALES_BY_MONTH,
  targetPercent: DEFAULT_TARGET_PERCENT,
};


const MONTH_KEY_TO_LABEL: Record<string, string> = {
  jan: 'Janvier', feb: 'Février', mar: 'Mars', apr: 'Avril', may: 'Mai', jun: 'Juin',
  jul: 'Juillet', aug: 'Août', sep: 'Septembre', oct: 'Octobre', nov: 'Novembre', dec: 'Décembre',
};

function normalizeCsvSource(input?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input) return out;
  for (const [k, v] of Object.entries(input)) {
    if (!v) continue;
    const label = MONTH_KEY_TO_LABEL[k] ?? k;
    out[label] = v;
  }
  return out;
}

function loadCsvSourceFromLocalStorage(): Record<string, string> {
  const keys = ['hippo_v7_inventory', 'hippo_inventory', 'inventory'];
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return normalizeCsvSource(parsed);
    } catch {}
  }
  return {};
}

const App: React.FC<{ csvByMonth?: Record<string, string> }> = ({ csvByMonth }) => {
  const [selectedMonth, setSelectedMonth] = useState<PeriodKey>('Janvier');
  const [ecartByMonth, setEcartByMonth] = useState<Record<MonthKey, EcartItem[]>>({});
  const [focusId, setFocusId] = useState<string | null>(null);
  const [trendMode, setTrendMode] = useState<'euro' | 'qty'>('euro');
  const [searchText, setSearchText] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
  const [isDailyOpen, setIsDailyOpen] = useState(false);
  const [dailySelectedIds, setDailySelectedIds] = useState<string[]>([]);
  const [costSettings, setCostSettings] = useState<CostSettings>(() => loadJSON(COST_STORAGE_KEY, DEFAULT_COST_SETTINGS));

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

  // Suivi journalier (stock veille / ventes veille / stock jour / perso / perte)
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
    saveJSON(COST_STORAGE_KEY, costSettings);
  }, [costSettings]);

  // Source unique: imports faits dans Paramètres (Inventaire détaillé / Export consolidé)
  // + fallback localStorage pour éviter les cas où la prop n'arrive pas (build/caching Vercel / version mixte).
  useEffect(() => {
    const source = Object.keys(csvByMonth || {}).length > 0 ? normalizeCsvSource(csvByMonth) : loadCsvSourceFromLocalStorage();
    const next: Record<MonthKey, EcartItem[]> = {};
    for (const m of MONTHS) {
      const csv = source[m];
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

  const costForSelectedMonth = isAnnual ? null : costSettings.costByMonth[selectedMonth as MonthKey];
  const vsObjectivePts = costForSelectedMonth == null ? null : (costForSelectedMonth - costSettings.targetPercent);
  const salesForSelectedMonth = useMemo(() => {
    if (!isAnnual) return costSettings.salesByMonth[selectedMonth as MonthKey];
    // Annuel = somme des CA mensuels saisis
    return MONTHS.reduce((acc, m) => acc + (costSettings.salesByMonth[m] ?? 0), 0) || null;
  }, [isAnnual, selectedMonth, costSettings]);

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
    return MONTHS.map((m) => ({
      month: m.slice(0, 3),
      actual: costSettings.costByMonth[m] ?? 0,
      target: costSettings.targetPercent,
    }));
  }, [costSettings]);


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
    <div className="h-screen flex flex-col overflow-hidden text-slate-900 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.22),transparent_55%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.14),transparent_55%)]">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur border-b border-white/60 flex-none z-10 shadow-sm">
        <div className="max-w-full mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="p-1.5 rounded-xl text-slate-600 hover:bg-white/70 border border-white/60 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
                <path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path>
              </svg>
            </button>
            <div className="leading-tight">
              <h1 className="text-base font-extrabold tracking-tight">Dashboard Performance</h1>
              <p className="text-[10px] text-slate-500">Une vue claire, actionnable, et agréable au quotidien.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase">Période :</span>
                <select 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value as PeriodKey)}
                    className="bg-slate-100 border-none text-xs font-bold rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                    <option value="Annuel">Annuel</option>
                </select>
             </div>
             <div className="h-4 w-px bg-slate-200"></div>
             <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-white/70 border border-white/60 shadow-sm">
               <div className="w-2 h-2 rounded-full bg-slate-500"></div>
               <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wide">Données : inventaire importé</span>
             </div>
<button
                onClick={() => setIsSettingsOpen(true)}
                className="bg-white/60 hover:bg-white/80 text-slate-600 text-[10px] font-extrabold px-3 py-1.5 rounded-full border border-white/60 shadow-sm uppercase tracking-wide"
                title="Paramètres : coût matière mensuel"
             >
               Paramètres
             </button>

             <button
                onClick={() => setIsFollowUpOpen(true)}
                className="bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 text-[10px] font-extrabold px-3 py-1.5 rounded-full border border-indigo-200/70 shadow-sm uppercase tracking-wide"
                title="Ouvrir la feuille de suivi journalière (plan d'action)"
             >
               Suivi
             </button>

              <button
                onClick={() => { setIsDailyOpen(true); ensureDailySheetExists(); }}
                className="bg-amber-50/80 hover:bg-amber-100 text-amber-900 text-[10px] font-extrabold px-3 py-1.5 rounded-full border border-amber-200/70 shadow-sm uppercase tracking-wide"
                title="Suivi journalier (stocks / ventes / écarts)"
              >
                Journalier
              </button>

             <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-emerald-50/80 border border-emerald-200/70 shadow-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-[10px] font-extrabold text-emerald-900">À jour</span>
             </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-0 p-4 grid grid-cols-12 gap-4 overflow-hidden">
        
        {/* Left Column: KPIs and Tables */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-3 min-h-0">

          {/* Friendly banner */}
          <div className="bg-white/70 backdrop-blur rounded-2xl border border-white/60 shadow-sm px-4 py-3 flex items-center justify-between gap-3 flex-none">
            <div className="min-w-0">
              <p className="text-sm font-extrabold tracking-tight">👋 On fait le point sur {selectedMonth === 'Annuel' ? 'l’année' : selectedMonth.toLowerCase()}.</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Les données viennent de l’import Inventaire détaillé (Paramètres). Repère les plus gros écarts et lance ton plan d’action.</p>
            </div>
            <div className="flex items-center gap-2 flex-none">
              <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-900 text-[10px] font-extrabold">{importedMonthsCount}/12 mois importés</span>
              <span className="px-2 py-1 rounded-full bg-sky-100 text-sky-900 text-[10px] font-extrabold">Lisible • Simple • Action</span>
              <button
                onClick={createFollowUpFromTop10}
                className="ml-1 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-extrabold shadow-sm"
                title="Préparer une feuille de suivi journalière à partir des Top10"
              >
                Préparer suivi Top10
              </button>
            </div>
          </div>
          
          {/* Top KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-none">
            <StatCard label="Couverts" value={3956} suffix="Pax" color="indigo" />
            <StatCard label="Marge Brute" value={73.37} suffix="%" color="emerald" />
            <StatCard
              label="Coût Mat."
              value={costForSelectedMonth == null ? '—' : costForSelectedMonth}
              suffix="%"
              color="rose"
              subLabel="vs objectif"
              subValue={vsObjectivePts == null ? '—' : `${vsObjectivePts >= 0 ? '+' : ''}${vsObjectivePts.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pts`}
            />
            <StatCard label="Ecart Total" value={ecartTotal} suffix="€" color="orange" />
          </div>

          {/* Discrepancy Tables Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch flex-1 min-h-0">
            <EcartsList 
              title="Top Ecarts Liquides" 
              items={topLiquides} 
              type="liquide" 
              onSelectItem={(it) => { setFocusId(it.id ?? null); setSearchText(it.name); }}
              selectedId={selectedProduct?.id ?? focusId}
              periodSales={salesForSelectedMonth}
            />
            <EcartsList 
              title="Top Ecarts Solides" 
              items={topSolides} 
              type="solide" 
              onSelectItem={(it) => { setFocusId(it.id ?? null); setSearchText(it.name); }}
              selectedId={selectedProduct?.id ?? focusId}
              periodSales={salesForSelectedMonth}
            />
          </div>
        </div>

        {/* Right Column: Charts and Focus */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 min-h-0 overflow-hidden">
          {/* Keep everything on one screen: no page scroll and no inner scroll */}
          <div className="flex flex-col gap-3 flex-1 min-h-0">
             <div className="h-[180px] flex-none">
                <FoodCostChart data={costChartData} />
             </div>
             <div className="flex flex-col gap-2 flex-none">
               <div className="bg-white/70 backdrop-blur p-3 rounded-2xl shadow-sm border border-white/60 flex-none">
                 <div className="flex items-center gap-2">
                   <div className="flex-1 min-w-0">
                     <input
                       value={searchText}
                       onChange={(e) => { setSearchText(e.target.value); setFocusId(null); }}
                       placeholder="Rechercher un produit (même hors Top10)…"
                     className={`w-full text-xs px-3 py-2 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500 ${selectedProduct ? 'border-indigo-300 bg-white' : 'border-white/70 bg-white/70'}`}
                       list="products-list"
                     />
                     {selectedProduct ? (
                       <p className="mt-1 text-[10px] text-indigo-700 font-semibold truncate" title={selectedProduct.name}>
                         Produit sélectionné : {selectedProduct.name}
                       </p>
                     ) : (
                       <p className="mt-1 text-[10px] text-slate-500">Astuce : clique un produit dans les Top 10 pour préremplir.</p>
                     )}
                   </div>
                   <button
                     onClick={() => { setSearchText(''); setFocusId(null); }}
                     className="flex-none text-[10px] font-extrabold px-3 py-2 rounded-xl border border-white/70 bg-white/70 hover:bg-white"
                     title="Effacer la sélection"
                   >
                     Effacer
                   </button>
                   <div className="flex items-center gap-1 flex-none">
                     <button
                       onClick={() => setTrendMode('euro')}
                       className={`text-[10px] font-extrabold px-3 py-2 rounded-xl border ${trendMode === 'euro' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white/70 text-slate-700 border-white/70'}`}
                     >
                       €
                     </button>
                     <button
                       onClick={() => setTrendMode('qty')}
                       className={`text-[10px] font-extrabold px-3 py-2 rounded-xl border ${trendMode === 'qty' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white/70 text-slate-700 border-white/70'}`}
                     >
                       Qté
                     </button>
                   </div>
                 </div>
                 <datalist id="products-list">
                   {allProducts.map(p => (
                     <option key={p.id} value={p.name} />
                   ))}
                 </datalist>
               </div>
             </div>

             {/* Trend chart expands to fill remaining height */}
             <div className="flex-1 min-h-0">
               <ProductTrendChart data={trendData} title={focusTitle} mode={trendMode} />
             </div>
          </div>

          {/* Bottom Focus Panel (extra compact: we keep only what helps action) */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-900/70 text-white rounded-2xl p-2 flex-none shadow-lg border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-extrabold text-slate-200/80 uppercase tracking-wider">Focus Article</h4>
              <span className="bg-rose-500/90 text-[10px] px-2 py-1 rounded-full font-extrabold">ALERTE</span>
            </div>
            <p className="text-xs font-bold truncate mb-2">{focusTitle}</p>
            
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="bg-white/5 p-2 rounded border border-white/10">
                {(() => {
                  const isLoss = selectedMonthValue > 0;
                  const isGain = selectedMonthValue < 0;
                  const label = isLoss ? 'Perte' : isGain ? 'Gain' : 'Écart';
                  const cls = isLoss ? 'text-rose-300' : isGain ? 'text-emerald-300' : 'text-slate-200';
                  return (
                    <>
                      <p className="text-[9px] text-slate-400 uppercase">{label}</p>
                      <p className={`text-sm font-bold ${cls}`}>
                        {Math.abs(selectedMonthValue).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </p>
                    </>
                  );
                })()}
              </div>
              <div className="bg-white/5 p-2 rounded border border-white/10">
                <p className="text-[9px] text-slate-400 uppercase">Impact CM</p>
                <p className="text-sm font-bold text-slate-200">
                  {impactCmPoints == null ? (
                    <span className="text-slate-400">— (renseigne le CA)</span>
                  ) : (
                    `${impactCmPoints >= 0 ? '+' : ''}${impactCmPoints.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pts`
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setIsDetailOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-extrabold py-2 rounded-xl transition-colors uppercase tracking-wide"
              >
                Détail produit
              </button>
              <button
                onClick={addSelectedToDaily}
                className="bg-amber-500/90 hover:bg-amber-400 text-white text-[10px] font-extrabold py-2 rounded-xl transition-colors uppercase tracking-wide shadow-sm"
                title="Ajouter ce produit au suivi journalier (stocks/ventes)"
              >
                + Journalier
              </button>
            </div>
          </div>

        </div>
      </main>
      <CostSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        costByMonth={costSettings.costByMonth}
        salesByMonth={costSettings.salesByMonth}
        targetPercent={costSettings.targetPercent}
        onSave={(next) => setCostSettings(next)}
      />

      {/* Product Detail Drawer */}
      {isDetailOpen && (
        (() => {
          const meta = selectedProduct?.id ? withType.find(i => i.id === selectedProduct.id) : null;
          const period = selectedMonth;
          return (
            <div className="fixed inset-0 z-50">
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
      {isFollowUpOpen && (
        <div className="fixed inset-0 z-50">
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
      {isDailyOpen && (
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
            <div className="fixed inset-0 z-50">
              <div className="absolute inset-0 bg-slate-900/40 no-print" onClick={() => setIsDailyOpen(false)} />
              <div className="absolute inset-x-0 top-8 bottom-8 mx-auto w-[96vw] max-w-6xl bg-white shadow-2xl rounded-3xl border border-slate-200 flex flex-col overflow-hidden daily-print-area">
                <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Suivi journalier</p>
                    <h3 className="text-lg font-extrabold text-slate-900">Stocks • Ventes • Écarts (Top10)</h3>
                    <p className="text-xs text-slate-600 mt-1">Période : <span className="font-semibold">{currentPeriod}</span></p>
                  </div>
                  <div className="flex items-center gap-2 flex-none no-print">
                    <div className="flex items-center gap-2 bg-white/70 border border-white/80 rounded-2xl px-3 py-2 shadow-sm">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase">Date</label>
                      <input
                        type="date"
                        value={dailyDateKey}
                        onChange={(e) => setDailyDateKey(e.target.value)}
                        className="text-xs font-bold bg-transparent outline-none"
                      />
                    </div>
                    <button
                      onClick={generateDailyFromTop10}
                      className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold shadow-sm"
                      title="Générer / mettre à jour la feuille avec les produits du Top10"
                    >
                      Générer Top10
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="px-4 py-2 rounded-2xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-extrabold"
                      title="Imprimer cette feuille"
                    >
                      Imprimer
                    </button>
                    <button
                      onClick={() => setIsDailyOpen(false)}
                      className="px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold"
                    >
                      Fermer
                    </button>
                  </div>
                </div>

                <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between gap-4 no-print">
                  <div className="text-xs text-slate-600">
                    Remplis <span className="font-semibold">Stock veille</span>, <span className="font-semibold">Ventes veille</span>, <span className="font-semibold">Stock jour</span> (+ Perso / Perte si besoin). L’écart et l’impact € se calculent automatiquement.
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-800 font-extrabold">Pertes : {fmtNum(totals.loss)} €</span>
                    <span className="px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-extrabold">Gains : {fmtNum(totals.gain)} €</span>
                    <span className="px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-800 font-extrabold">Net : {fmtNum(totals.net)} €</span>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-auto">
                  {rows.length === 0 ? (
                    <div className="p-10 text-slate-600">
                      Aucun produit dans la feuille. Clique sur <span className="font-semibold">Générer Top10</span>.
                    </div>
                  ) : (
                    <div className="p-4">
                      {([
                        { key: 'LIQUIDE' as const, title: '🥤 Liquides', data: liquidRows },
                        { key: 'SOLIDE' as const, title: '🍽️ Solides', data: solidRows },
                      ]).map((section) => (
                        <div key={section.key} className="mb-6 last:mb-0">
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
                                    className="text-[11px] px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 font-extrabold text-slate-700"
                                  >
                                    {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                                  </button>
                                  <button
                                    onClick={() => removeRows(selectedInSection.map(r => r.id))}
                                    disabled={selectedInSection.length === 0}
                                    className={`text-[11px] px-3 py-1.5 rounded-full font-extrabold ${selectedInSection.length ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
                                  >
                                    Supprimer sélection
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                          <div className="rounded-3xl border border-slate-200 shadow-sm bg-white">
                            <div className="overflow-x-auto">
                              <table className="min-w-[980px] w-full text-xs">
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
                                        <div className="font-extrabold text-slate-900 truncate" title={r.name}>{(r.type === 'LIQUIDE' ? '🥤 ' : '🍽️ ') + r.name}</div>
                                        <div className="text-[10px] text-slate-500 truncate" title={`${r.sector ?? ''} • ${r.supplier ?? ''}`}>{r.sector ?? '—'} • {r.supplier ?? '—'}</div>
                                      </td>

                                      {(['stockPrev','salesPrev','stockToday','perso','loss'] as const).map((k) => (
                                        <td key={k} className="px-3 py-2 text-right tabular-nums">
                                          <input
                                            defaultValue={fmtMaybe((r as any)[k] ?? null, 2)}
                                            onBlur={(e) => updateRow(r.id, { [k]: parseFrInput(e.target.value) } as any)}
                                            className="w-24 text-right text-xs px-2 py-1 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="—"
                                          />
                                        </td>
                                      ))}

                                      <td className={`px-3 py-2 text-right tabular-nums font-extrabold ${varCls}`}>{c.variance.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>

                                      <td className="px-3 py-2 text-right tabular-nums">
                                        <input
                                          defaultValue={r.unitPrice == null ? '' : fmtMaybe(r.unitPrice, 2)}
                                          onBlur={(e) => updateRow(r.id, { unitPrice: parseFrInput(e.target.value) } as any)}
                                          className="w-20 text-right text-xs px-2 py-1 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
