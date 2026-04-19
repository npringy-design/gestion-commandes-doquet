import React, { useEffect, useMemo, useState } from 'react';
import { MONTHS_DISPLAY_CONFIG, MONTH_KEY_TO_NAME, STORAGE_PREFIX, View } from '../constants';
import type { TakeRateMappingRow } from './TakeRatePage';

// =============================================================
// TakeRateResultsPage v3
//
// Fond blanc neutre, couleurs portées par les familles uniquement.
// Filtre famille = dropdown (pas de chips qui envahissent la page).
// Layout : mois → KPIs → podium top3 → liste produits épurée.
// Logique de calcul inchangée par rapport à l'original.
// =============================================================

interface TakeRateResultsPageProps {
  setView: (view: View) => void;
  prepImportsByMonth: Record<string, string>;
  covers: Record<string, number>;
}

type SortKey = 'takeRate' | 'sales' | 'marginTotal';

const STORAGE_KEYS = [
  `${STORAGE_PREFIX}take_rate_rows_v3`,
  `${STORAGE_PREFIX}take_rate_rows_v2`,
  `${STORAGE_PREFIX}take_rate_rows_v1`,
];

// ------------------------------------------------------------------
// Couleurs par famille — portent toute la dimension visuelle
// ------------------------------------------------------------------
const FAMILY_PALETTE: Record<string, { bar: string; badge: string; text: string }> = {
  'Boeuf':                { bar: '#C55A35', badge: '#FDF0EB', text: '#7A3620' },
  'Burgers':              { bar: '#C55A35', badge: '#FDF0EB', text: '#7A3620' },
  'Hachés gourmands':     { bar: '#C55A35', badge: '#FDF0EB', text: '#7A3620' },
  'Belles pièces':        { bar: '#C55A35', badge: '#FDF0EB', text: '#7A3620' },
  'Le bœuf autrement':    { bar: '#C55A35', badge: '#FDF0EB', text: '#7A3620' },
  'L\'emblématique / ou viandes d\'exception': { bar: '#C55A35', badge: '#FDF0EB', text: '#7A3620' },
  'Entrées solos':        { bar: '#2A8C5F', badge: '#E8F5EF', text: '#165C3C' },
  'Food':                 { bar: '#2A8C5F', badge: '#E8F5EF', text: '#165C3C' },
  'Salades':              { bar: '#2A8C5F', badge: '#E8F5EF', text: '#165C3C' },
  'Plats du jour':        { bar: '#2A8C5F', badge: '#E8F5EF', text: '#165C3C' },
  'Poissons':             { bar: '#2A8C5F', badge: '#E8F5EF', text: '#165C3C' },
  'Poulet, ribs & co':    { bar: '#2A8C5F', badge: '#E8F5EF', text: '#165C3C' },
  'Cocottes veggie':      { bar: '#2A8C5F', badge: '#E8F5EF', text: '#165C3C' },
  'Tartine':              { bar: '#2A8C5F', badge: '#E8F5EF', text: '#165C3C' },
  'Garnitures':           { bar: '#2A8C5F', badge: '#E8F5EF', text: '#165C3C' },
  'Sauces':               { bar: '#2A8C5F', badge: '#E8F5EF', text: '#165C3C' },
  'Le cru':               { bar: '#2A8C5F', badge: '#E8F5EF', text: '#165C3C' },
  'Desserts':             { bar: '#B04B78', badge: '#FAE8F0', text: '#6D2E4C' },
  'Boules de glaces':     { bar: '#B04B78', badge: '#FAE8F0', text: '#6D2E4C' },
  'Coupes glacées':       { bar: '#B04B78', badge: '#FAE8F0', text: '#6D2E4C' },
  'Vins':                 { bar: '#6B5CC4', badge: '#EEECFD', text: '#3C3489' },
  'Vins • Notre vin d\'exception': { bar: '#6B5CC4', badge: '#EEECFD', text: '#3C3489' },
  'Vins • Puissants et épicés': { bar: '#6B5CC4', badge: '#EEECFD', text: '#3C3489' },
  'Vins • Ronds et gourmands': { bar: '#6B5CC4', badge: '#EEECFD', text: '#3C3489' },
  'Vins blancs • Amples et frais': { bar: '#6B5CC4', badge: '#EEECFD', text: '#3C3489' },
  'Vins blancs • Sec et fruités': { bar: '#6B5CC4', badge: '#EEECFD', text: '#3C3489' },
  'Vins rosés':           { bar: '#6B5CC4', badge: '#EEECFD', text: '#3C3489' },
  'Champagne':            { bar: '#6B5CC4', badge: '#EEECFD', text: '#3C3489' },
  'Whisky, rhum & cie':   { bar: '#6B5CC4', badge: '#EEECFD', text: '#3C3489' },
  'Boissons':             { bar: '#2472B8', badge: '#E5F0FA', text: '#14487A' },
  'Boissons chaudes':     { bar: '#2472B8', badge: '#E5F0FA', text: '#14487A' },
  'Softs':                { bar: '#2472B8', badge: '#E5F0FA', text: '#14487A' },
  'Bières à la pression': { bar: '#2472B8', badge: '#E5F0FA', text: '#14487A' },
  'Eaux minérales':       { bar: '#2472B8', badge: '#E5F0FA', text: '#14487A' },
  'Cocktails coup de cœur': { bar: '#2472B8', badge: '#E5F0FA', text: '#14487A' },
  'Cocktails sans alcool': { bar: '#2472B8', badge: '#E5F0FA', text: '#14487A' },
  'Les apérifits':        { bar: '#2472B8', badge: '#E5F0FA', text: '#14487A' },
  'Digestifs':            { bar: '#2472B8', badge: '#E5F0FA', text: '#14487A' },
  'Menus':                { bar: '#A0721A', badge: '#FAF0DE', text: '#634408' },
  'Menu coup de cœur':    { bar: '#A0721A', badge: '#FAF0DE', text: '#634408' },
  'Menu coup de cœur • Boissons': { bar: '#A0721A', badge: '#FAF0DE', text: '#634408' },
  'Menu coup de cœur • Plats': { bar: '#A0721A', badge: '#FAF0DE', text: '#634408' },
  'Menu dejeuner':        { bar: '#A0721A', badge: '#FAF0DE', text: '#634408' },
  'Menu enfant':          { bar: '#A0721A', badge: '#FAF0DE', text: '#634408' },
  'Menu enfant • Boissons': { bar: '#A0721A', badge: '#FAF0DE', text: '#634408' },
  'Menu enfant • Desserts': { bar: '#A0721A', badge: '#FAF0DE', text: '#634408' },
  'Menu enfant • Plats':  { bar: '#A0721A', badge: '#FAF0DE', text: '#634408' },
  'Menus • Boissons':     { bar: '#A0721A', badge: '#FAF0DE', text: '#634408' },
  'Menus • Desserts':     { bar: '#A0721A', badge: '#FAF0DE', text: '#634408' },
  'Menus • Plats':        { bar: '#A0721A', badge: '#FAF0DE', text: '#634408' },
  'Café gourmand':        { bar: '#A0721A', badge: '#FAF0DE', text: '#634408' },
};

const getFP = (family: string) =>
  FAMILY_PALETTE[family] ?? { bar: '#888780', badge: '#F1EFE8', text: '#444441' };

// ------------------------------------------------------------------
// CSV helpers (identiques à l'original)
// ------------------------------------------------------------------
const normalizeStr = (v: string) =>
  v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const parseCsvLine = (line: string, sep: string) => {
  const cells: string[] = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i], n = line[i + 1];
    if (c === '"') { if (inQ && n === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (c === sep && !inQ) { cells.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  cells.push(cur.trim());
  return cells;
};

const detectSep = (input: string) => {
  const first = input.split(/\r?\n/).find(l => l.trim()) ?? '';
  return [';', '\t', ','].reduce((best, c) =>
    first.split(c).length > first.split(best).length ? c : best, ';');
};

const parseNum = (v: string | number | null | undefined) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const c = String(v ?? '').replace(/\s/g, '').replace(',', '.');
  const n = Number(c);
  return Number.isFinite(n) ? n : 0;
};

// ------------------------------------------------------------------
// Formatters
// ------------------------------------------------------------------
const fInt  = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
const fCur  = (n: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n))} €`;
const fPct  = (n: number) => `${n.toFixed(1).replace('.', ',')} %`;

// ------------------------------------------------------------------
// Sales map depuis CSV mensuel
// ------------------------------------------------------------------
const buildSalesMap = (content: string): Map<string, number> => {
  const map = new Map<string, number>();
  if (!content?.trim()) return map;
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return map;
  const sep = detectSep(content);
  const headers = parseCsvLine(lines[0], sep).map(normalizeStr);
  const nameP = ['libelle','libellé','designation','désignation','produit','article','nom'];
  const qtyP  = ['nombre','nb','ventes','vente','quantite','quantité','qte','qté','qty'];
  const findIdx = (preferred: string[]) => {
    for (const p of preferred) { const i = headers.findIndex(h => h === p); if (i !== -1) return i; }
    for (const p of preferred) { const i = headers.findIndex(h => h.includes(p)); if (i !== -1) return i; }
    return -1;
  };
  const ni = findIdx(nameP), qi = findIdx(qtyP);
  if (ni === -1 || qi === -1) return map;
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], sep);
    const label = (cols[ni] ?? '').trim();
    if (!label) continue;
    const key = normalizeStr(label);
    const qty = parseNum(cols[qi] ?? '0');
    if (key) map.set(key, (map.get(key) ?? 0) + qty);
  }
  return map;
};

// ------------------------------------------------------------------
// Médailles
// ------------------------------------------------------------------
const MEDALS = [
  { rank: '1er', color: '#A0721A' },
  { rank: '2e',  color: '#6B7280' },
  { rank: '3e',  color: '#7A3620' },
];

// ==================================================================
// Composant
// ==================================================================
const TakeRateResultsPage: React.FC<TakeRateResultsPageProps> = ({
  setView,
  prepImportsByMonth,
  covers,
}) => {
  const [rows, setRows]             = useState<TakeRateMappingRow[]>([]);
  const [selectedMonth, setMonth]   = useState<string>(
    MONTHS_DISPLAY_CONFIG[new Date().getMonth()]?.key ?? 'jan'
  );
  const [familyFilter, setFamily]   = useState('all');
  const [search, setSearch]         = useState('');
  const [sortBy, setSort]           = useState<SortKey>('takeRate');
  const [expertMode, setExpert]     = useState(false);

  useEffect(() => {
    try {
      for (const key of STORAGE_KEYS) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRows(parsed.map(r => ({
            id:            String(r.id ?? ''),
            label:         String(r.label ?? ''),
            family:        String(r.family ?? ''),
            linkedImports: Array.isArray(r.linkedImports) ? r.linkedImports.map(String) : [],
            costHt:        parseNum(r.costHt),
            sellPriceHt:   parseNum(r.sellPriceHt),
            marginEuro:    parseNum(r.marginEuro),
            marginPercent: parseNum(r.marginPercent),
          })));
          break;
        }
      }
    } catch (_) {}
  }, []);

  const salesMap    = useMemo(() => buildSalesMap(prepImportsByMonth[selectedMonth] ?? ''), [prepImportsByMonth, selectedMonth]);
  const monthCovers = Number(covers[selectedMonth] ?? 0);

  const computed = useMemo(() => {
    const q = normalizeStr(search);
    return rows
      .filter(r => r.label.trim() && r.linkedImports.length > 0)
      .map(r => {
        const sales       = r.linkedImports.reduce((s, i) => s + (salesMap.get(normalizeStr(i)) ?? 0), 0);
        const takeRate    = monthCovers > 0 ? (sales / monthCovers) * 100 : 0;
        const marginEuro  = parseNum((r as any).marginEuro);
        const sellPriceHt = parseNum((r as any).sellPriceHt);
        const costHt      = parseNum((r as any).costHt);
        const marginPct   = parseNum((r as any).marginPercent);
        const marginTotal = sales * marginEuro;
        const caTheo      = sales * sellPriceHt;
        return { ...r, sales, takeRate, marginEuro, marginTotal, sellPriceHt, costHt, marginPct, caTheo };
      })
      .filter(r => familyFilter === 'all' || r.family === familyFilter)
      .filter(r => !q || normalizeStr(r.label).includes(q) || normalizeStr(r.family).includes(q))
      .sort((a, b) => {
        if (sortBy === 'sales')       return b.sales - a.sales || a.label.localeCompare(b.label, 'fr');
        if (sortBy === 'marginTotal') return b.marginTotal - a.marginTotal || a.label.localeCompare(b.label, 'fr');
        return b.takeRate - a.takeRate || b.sales - a.sales || a.label.localeCompare(b.label, 'fr');
      })
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [rows, salesMap, monthCovers, familyFilter, search, sortBy]);

  const totalSales     = computed.reduce((s, r) => s + r.sales, 0);
  const totalMargin    = computed.reduce((s, r) => s + r.marginTotal, 0);
  const globalTakeRate = monthCovers > 0 ? (totalSales / monthCovers) * 100 : 0;
  const maxTakeRate    = computed.length > 0 ? computed[0].takeRate : 1;

  const families = useMemo(() =>
    [...new Set(rows.map(r => r.family.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')),
    [rows]
  );

  // ------------------------------------------------------------------
  // Styles partagés (Tailwind classes de l'appli)
  // ------------------------------------------------------------------
  const monthActive   = 'rounded-full bg-[#2C1A10] px-4 py-2 text-[12px] font-black uppercase tracking-[0.06em] text-white';
  const monthInactive = 'rounded-full border border-[#D5C5B8] bg-white px-4 py-2 text-[12px] font-black uppercase tracking-[0.06em] text-[#7A5C4A] transition hover:bg-[#F5EDE5]';
  const sortActive    = 'rounded-full bg-[#2C1A10] px-4 py-2 text-[12px] font-black uppercase tracking-[0.06em] text-white';
  const sortInactive  = 'rounded-full border border-[#D5C5B8] bg-white px-4 py-2 text-[12px] font-black uppercase tracking-[0.06em] text-[#7A5C4A] transition hover:bg-[#F5EDE5]';

  return (
    <div className="flex h-full min-h-screen bg-white text-[#1A0F0A]">

      {/* ── Sidebar ── */}
      <aside className="hidden w-[220px] shrink-0 flex-col gap-4 border-r border-[#E3D0BE] bg-[#FAFAF8] px-4 py-5 xl:flex">

        {/* Badge page */}
        <div className="rounded-[18px] border border-[#E8D5C0] bg-white px-4 py-4">
          <p className="text-[10px] font-black uppercase tracking-[0.20em] text-[#A07860]">Lecture finale</p>
          <h1 className="mt-2 text-[20px] font-black leading-tight text-[#1A0F0A]">Taux<br/>de prise</h1>
          <p className="mt-1 text-[12px] font-semibold text-[#8A6A55]">{MONTH_KEY_TO_NAME[selectedMonth]}</p>
        </div>

        {/* Navigation */}
        <button
          onClick={() => setView('stats')}
          className="rounded-[14px] border border-[#E8D5C0] bg-white px-4 py-3 text-[12px] font-black uppercase tracking-[0.08em] text-[#7A5C4A] transition hover:bg-[#F5EDE5]"
        >
          ← Retour paramètres
        </button>
        <button
          onClick={() => setView('take_rate')}
          className="rounded-[14px] border border-[#2C1A10] bg-[#2C1A10] px-4 py-3 text-[12px] font-black uppercase tracking-[0.08em] text-white transition hover:bg-[#3D2518]"
        >
          Voir paramétrage
        </button>

        {/* Synthèse chiffrée */}
        <div className="rounded-[18px] border border-[#E3D0BE] bg-white px-4 py-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#A07860]">Synthèse</p>
          {[
            { label: 'Couverts',        val: fInt(monthCovers) },
            { label: 'Ventes suivies',  val: fInt(totalSales) },
            { label: 'Tx prise global', val: fPct(globalTakeRate) },
            { label: 'Marge générée',   val: fCur(totalMargin) },
          ].map(k => (
            <div key={k.label} className="flex items-baseline justify-between gap-2 py-1.5">
              <span className="text-[12px] text-[#8A6A55]">{k.label}</span>
              <span className="text-[13px] font-black text-[#1A0F0A]">{k.val}</span>
            </div>
          ))}
        </div>

        {/* Top par famille */}
        {families.length > 0 && (
          <div className="rounded-[18px] border border-[#E3D0BE] bg-white px-4 py-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#A07860]">Par famille</p>
            {(() => {
              const grouped = new Map<string, number>();
              computed.forEach(r => {
                const f = r.family || 'Autre';
                grouped.set(f, (grouped.get(f) ?? 0) + r.sales);
              });
              const sorted = [...grouped.entries()]
                .map(([f, s]) => ({ family: f, takeRate: monthCovers > 0 ? s / monthCovers * 100 : 0 }))
                .sort((a, b) => b.takeRate - a.takeRate)
                .slice(0, 8);
              const maxTR = sorted[0]?.takeRate ?? 1;
              return sorted.map(s => {
                const col = getFP(s.family);
                return (
                  <div key={s.family} className="mb-3">
                    <div className="flex items-baseline justify-between gap-1 mb-1">
                      <span className="truncate text-[11px] font-semibold text-[#4A3020]">{s.family}</span>
                      <span className="shrink-0 text-[11px] font-black text-[#1A0F0A]">{fPct(s.takeRate)}</span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-[#EDE0D4]">
                      <div className="h-1 rounded-full" style={{ width: `${(s.takeRate / maxTR * 100).toFixed(1)}%`, background: col.bar }} />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </aside>

      {/* ── Main ── */}
      <main className="flex min-w-0 flex-1 flex-col gap-5 overflow-auto px-6 py-5 xl:px-8">

        {/* Sélecteur mois */}
        <div className="flex flex-wrap gap-2">
          {MONTHS_DISPLAY_CONFIG.map(m => (
            <button
              key={m.key}
              onClick={() => setMonth(m.key)}
              className={selectedMonth === m.key ? monthActive : monthInactive}
            >
              {m.label.slice(0, 4)}
            </button>
          ))}
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Couverts du mois', val: fInt(monthCovers) },
            { label: 'Ventes suivies',   val: fInt(totalSales) },
            { label: 'Marge générée',    val: fCur(totalMargin) },
          ].map(k => (
            <div key={k.label} className="rounded-[16px] border border-[#E3D0BE] bg-[#FAFAF8] px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A07860]">{k.label}</p>
              <p className="mt-2 text-[24px] font-black text-[#1A0F0A]">{k.val}</p>
            </div>
          ))}
        </div>

        {/* Podium top 3 */}
        {computed.length >= 1 && (
          <div>
            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.12em] text-[#A07860]">Top 3 du mois</p>
            <div className="grid grid-cols-3 gap-3">
              {computed.slice(0, 3).map((row, i) => {
                const medal = MEDALS[i];
                const col   = getFP(row.family);
                return (
                  <div key={row.id} className="rounded-[18px] border border-[#E3D0BE] bg-white px-5 py-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[11px] font-black" style={{ color: medal.color }}>{medal.rank}</span>
                      {row.family && (
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[10px] font-black"
                          style={{ background: col.badge, color: col.text }}
                        >
                          {row.family}
                        </span>
                      )}
                    </div>
                    <p className="mb-2 text-[15px] font-black leading-snug text-[#1A0F0A]">{row.label}</p>
                    <p className="mb-3 text-[30px] font-black leading-none text-[#1A0F0A]">{fPct(row.takeRate)}</p>
                    <div className="flex items-center justify-between text-[12px] text-[#8A6A55]">
                      <span>{fInt(row.sales)} ventes</span>
                      {row.marginTotal > 0 && <span className="font-semibold">{fCur(row.marginTotal)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Contrôles liste */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Filtre famille dropdown */}
            <select
              value={familyFilter}
              onChange={e => setFamily(e.target.value)}
              className="rounded-[14px] border border-[#D5C5B8] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#2C1A10] outline-none transition focus:border-[#2C1A10]"
            >
              <option value="all">Toutes les familles</option>
              {families.map(f => <option key={f} value={f}>{f}</option>)}
            </select>

            {/* Recherche */}
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="rounded-[14px] border border-[#D5C5B8] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#2C1A10] outline-none transition focus:border-[#2C1A10]"
              style={{ width: '180px' }}
            />

            <span className="text-[12px] text-[#A07860]">
              {computed.length} produit{computed.length > 1 ? 's' : ''}
            </span>
          </div>

          {/* Tri */}
          <div className="flex items-center gap-2">
            {([
              { key: 'takeRate',    label: 'Taux' },
              { key: 'sales',       label: 'Ventes' },
              { key: 'marginTotal', label: 'Marge' },
            ] as { key: SortKey; label: string }[]).map(s => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={sortBy === s.key ? sortActive : sortInactive}
              >
                {s.label}
              </button>
            ))}

            <button
              onClick={() => setExpert(v => !v)}
              className={`rounded-full px-4 py-2 text-[12px] font-black uppercase tracking-[0.06em] transition ${
                expertMode
                  ? 'border border-[#6B5CC4] bg-[#EEECFD] text-[#3C3489]'
                  : 'border border-[#D5C5B8] bg-white text-[#7A5C4A] hover:bg-[#F5EDE5]'
              }`}
            >
              {expertMode ? 'Expert ▾' : 'Expert ▸'}
            </button>
          </div>
        </div>

        {/* Liste produits */}
        <div className="overflow-hidden rounded-[20px] border border-[#E3D0BE] bg-white">
          {computed.length === 0 ? (
            <p className="px-6 py-12 text-center text-[14px] text-[#A07860]">
              Aucun résultat — vérifie le mois, les produits liés et l'import production.
            </p>
          ) : (
            computed.map((row, i) => {
              const col    = getFP(row.family);
              const barPct = maxTakeRate > 0 ? (row.takeRate / maxTakeRate * 100) : 0;
              const isLast = i === computed.length - 1;
              return (
                <div
                  key={row.id}
                  className={`flex items-center gap-4 px-6 py-4 transition-colors hover:bg-[#FAFAF8] ${!isLast ? 'border-b border-[#E3D0BE]' : ''}`}
                >
                  {/* Rang */}
                  <span className="w-7 shrink-0 text-right text-[12px] font-semibold text-[#C4A898]">
                    {row.rank}
                  </span>

                  {/* Produit + barre */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="truncate text-[14px] font-black text-[#1A0F0A]">{row.label}</span>
                      {row.family && (
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black"
                          style={{ background: col.badge, color: col.text }}
                        >
                          {row.family}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#EDE0D4]">
                        <div
                          className="h-1 rounded-full transition-all duration-500"
                          style={{ width: `${barPct.toFixed(1)}%`, background: col.bar }}
                        />
                      </div>
                      <span className="shrink-0 text-[11px] text-[#A07860]">{fInt(row.sales)} ventes</span>
                    </div>
                  </div>

                  {/* Taux */}
                  <span className="w-[80px] shrink-0 text-right text-[18px] font-black text-[#1A0F0A]">
                    {fPct(row.takeRate)}
                  </span>

                  {/* Marge totale */}
                  <span className="w-[80px] shrink-0 text-right text-[13px] font-semibold text-[#8A6A55]">
                    {row.marginTotal > 0 ? fCur(row.marginTotal) : '—'}
                  </span>

                  {/* Mode expert */}
                  {expertMode && (
                    <div className="flex shrink-0 gap-5 border-l border-[#E3D0BE] pl-5">
                      {[
                        { label: 'CM HT',   val: row.costHt > 0      ? fCur(row.costHt)      : '—' },
                        { label: 'PV HT',   val: row.sellPriceHt > 0 ? fCur(row.sellPriceHt) : '—' },
                        { label: 'Marge %', val: row.marginPct !== 0  ? fPct(row.marginPct)   : '—' },
                        { label: 'CA théo', val: row.caTheo > 0       ? fCur(row.caTheo)      : '—' },
                      ].map(e => (
                        <div key={e.label} className="text-right">
                          <p className="text-[10px] uppercase tracking-wide text-[#C4A898]">{e.label}</p>
                          <p className="text-[12px] font-semibold text-[#4A3020]">{e.val}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
};

export default TakeRateResultsPage;
