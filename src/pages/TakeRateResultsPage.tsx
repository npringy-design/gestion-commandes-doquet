import React, { useEffect, useMemo, useState } from 'react';
import { MONTHS_DISPLAY_CONFIG, MONTH_KEY_TO_NAME, STORAGE_PREFIX, View } from '../constants';
import type { TakeRateMappingRow } from './TakeRatePage';

// =============================================================
// TakeRateResultsPage — Vue résultats épurée
//
// Principes de design :
//   - Podium top 3 immédiatement visible
//   - Barre de progression pour lire le taux sans lire le chiffre
//   - Filtres familles colorés, tri simple (3 options)
//   - Chiffres financiers présents mais discrets
//   - Suppression de toutes les colonnes "experts" (CM HT, PV HT...)
// =============================================================

interface TakeRateResultsPageProps {
  setView: (view: View) => void;
  prepImportsByMonth: Record<string, string>;
  covers: Record<string, number>;
}

type SortKey = 'takeRate' | 'sales' | 'marginTotal';

// ------------------------------------------------------------------
// Clés de stockage (identiques à TakeRatePage pour cohérence)
// ------------------------------------------------------------------
const STORAGE_KEYS = [
  `${STORAGE_PREFIX}take_rate_rows_v3`,
  `${STORAGE_PREFIX}take_rate_rows_v2`,
  `${STORAGE_PREFIX}take_rate_rows_v1`,
];

// ------------------------------------------------------------------
// Helpers parsing CSV (identiques à l'original)
// ------------------------------------------------------------------
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const parseCsvLine = (line: string, delimiter: string) => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') { current += '"'; i += 1; }
      else { inQuotes = !inQuotes; }
    } else if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
};

const detectDelimiter = (input: string) => {
  const firstLine = input.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
  const candidates = [';', '\t', ','];
  let best = ';';
  let bestScore = -1;
  candidates.forEach((c) => {
    const score = firstLine.split(c).length;
    if (score > bestScore) { best = c; bestScore = score; }
  });
  return best;
};

const parseNumber = (value: string | number | null | undefined) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? '').replace(/\s/g, '').replace(',', '.');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

// ------------------------------------------------------------------
// Formatters
// ------------------------------------------------------------------
const fmtInt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);

const fmtCurrency = (n: number) =>
  `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)} €`;

const fmtPercent = (n: number) =>
  `${n.toFixed(1).replace('.', ',')} %`;

// ------------------------------------------------------------------
// Couleur par famille (cohérent avec les chips)
// ------------------------------------------------------------------
const FAMILY_COLORS: Record<string, { bar: string; chip: string; text: string }> = {
  'Boeuf':     { bar: '#D85A30', chip: '#FCEEE7', text: '#8D3218' },
  'Food':      { bar: '#1D9E75', chip: '#E1F5EE', text: '#0B5E45' },
  'Dessert':   { bar: '#D4537E', chip: '#FBEAF0', text: '#832E50' },
  'Boissons':  { bar: '#378ADD', chip: '#E6F1FB', text: '#185FA5' },
  'Vins':      { bar: '#7F77DD', chip: '#EEEDFE', text: '#3C3489' },
  'Menus':     { bar: '#BA7517', chip: '#FAEEDA', text: '#6B3E08' },
};

const getFamilyColor = (family: string) =>
  FAMILY_COLORS[family] ?? { bar: '#888780', chip: '#F1EFE8', text: '#444441' };

// ------------------------------------------------------------------
// Parsing du CSV de ventes (identique à l'original)
// ------------------------------------------------------------------
const buildMonthSalesMap = (content: string): Map<string, number> => {
  const result = new Map<string, number>();
  if (!content?.trim()) return result;
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return result;

  const delimiter = detectDelimiter(content);
  const headers = parseCsvLine(lines[0], delimiter).map(normalize);

  const preferredNameHeaders = ['libelle', 'libellé', 'designation', 'désignation', 'produit', 'article', 'nom'];
  const preferredQtyHeaders  = ['nombre', 'nb', 'ventes', 'vente', 'quantite', 'quantité', 'qte', 'qté', 'qty'];

  const findIdx = (preferred: string[]) => {
    for (const name of preferred) {
      const i = headers.findIndex((c) => c === name);
      if (i !== -1) return i;
    }
    for (const name of preferred) {
      const i = headers.findIndex((c) => c.includes(name));
      if (i !== -1) return i;
    }
    return -1;
  };

  const nameIdx = findIdx(preferredNameHeaders);
  const qtyIdx  = findIdx(preferredQtyHeaders);
  if (nameIdx === -1 || qtyIdx === -1) return result;

  for (let i = 1; i < lines.length; i += 1) {
    const cols  = parseCsvLine(lines[i], delimiter);
    const label = (cols[nameIdx] ?? '').trim();
    if (!label) continue;
    const key = normalize(label);
    const qty = parseNumber(cols[qtyIdx] ?? '0');
    if (!key) continue;
    result.set(key, (result.get(key) ?? 0) + qty);
  }
  return result;
};

// ------------------------------------------------------------------
// Médailles podium
// ------------------------------------------------------------------
const MEDALS = [
  { label: '1er', bg: '#FAC775', text: '#412402' },
  { label: '2e',  bg: '#D3D1C7', text: '#2C2C2A' },
  { label: '3e',  bg: '#F0997B', text: '#4A1B0C' },
];

// ==================================================================
// Composant principal
// ==================================================================
const TakeRateResultsPage: React.FC<TakeRateResultsPageProps> = ({
  setView,
  prepImportsByMonth,
  covers,
}) => {
  const [rows, setRows]               = useState<TakeRateMappingRow[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    MONTHS_DISPLAY_CONFIG[new Date().getMonth()]?.key ?? 'jan'
  );
  const [search, setSearch]           = useState('');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [sortBy, setSortBy]           = useState<SortKey>('takeRate');
  const [expertMode, setExpertMode]   = useState(false);

  // -- Chargement des lignes depuis localStorage
  useEffect(() => {
    try {
      for (const key of STORAGE_KEYS) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRows(
            parsed.map((row) => ({
              id:           String(row.id ?? ''),
              label:        String(row.label ?? ''),
              family:       String(row.family ?? ''),
              linkedImports: Array.isArray(row.linkedImports) ? row.linkedImports.map(String) : [],
              costHt:       parseNumber(row.costHt),
              sellPriceHt:  parseNumber(row.sellPriceHt),
              marginEuro:   parseNumber(row.marginEuro),
              marginPercent: parseNumber(row.marginPercent),
            }))
          );
          break;
        }
      }
    } catch (_) {}
  }, []);

  // -- Sales map du mois sélectionné
  const monthSalesMap = useMemo(
    () => buildMonthSalesMap(prepImportsByMonth[selectedMonth] ?? ''),
    [prepImportsByMonth, selectedMonth]
  );
  const monthCovers = Number(covers[selectedMonth] ?? 0);

  // -- Calcul des lignes enrichies
  const computedRows = useMemo(() => {
    const query = normalize(search);

    return rows
      .filter((row) => row.label.trim().length > 0 && row.linkedImports.length > 0)
      .map((row) => {
        const sales          = row.linkedImports.reduce(
          (sum, item) => sum + (monthSalesMap.get(normalize(item)) ?? 0), 0
        );
        const takeRate       = monthCovers > 0 ? (sales / monthCovers) * 100 : 0;
        const marginEuro     = parseNumber((row as any).marginEuro);
        const sellPriceHt    = parseNumber((row as any).sellPriceHt);
        const costHt         = parseNumber((row as any).costHt);
        const marginPercent  = parseNumber((row as any).marginPercent);
        const marginTotal    = sales * marginEuro;
        const theoreticalRevenue = sales * sellPriceHt;
        return { ...row, sales, takeRate, marginEuro, marginTotal, sellPriceHt, costHt, marginPercent, theoreticalRevenue };
      })
      .filter((row) => familyFilter === 'all' || row.family === familyFilter)
      .filter((row) => {
        if (!query) return true;
        return normalize(row.label).includes(query) || normalize(row.family).includes(query);
      })
      .sort((a, b) => {
        if (sortBy === 'sales')       return b.sales - a.sales || a.label.localeCompare(b.label, 'fr');
        if (sortBy === 'marginTotal') return b.marginTotal - a.marginTotal || a.label.localeCompare(b.label, 'fr');
        return b.takeRate - a.takeRate || b.sales - a.sales || a.label.localeCompare(b.label, 'fr');
      })
      .map((row, i) => ({ ...row, rank: i + 1 }));
  }, [rows, monthSalesMap, monthCovers, familyFilter, search, sortBy]);

  // -- Agrégats
  const totalSales       = computedRows.reduce((s, r) => s + r.sales, 0);
  const totalMargin      = computedRows.reduce((s, r) => s + r.marginTotal, 0);
  const globalTakeRate   = monthCovers > 0 ? (totalSales / monthCovers) * 100 : 0;
  const maxTakeRate      = computedRows.length > 0 ? computedRows[0].takeRate : 1;

  // -- Familles disponibles
  const families = useMemo(() => {
    const vals = Array.from(new Set(rows.map((r) => r.family.trim()).filter(Boolean)));
    return vals.sort((a, b) => a.localeCompare(b, 'fr'));
  }, [rows]);

  // -- Vue sections (sidebar synthèse)
  const sectionRows = useMemo(() => {
    const grouped = new Map<string, { family: string; sales: number; marginTotal: number }>();
    computedRows.forEach((row) => {
      const family   = row.family?.trim() || 'Sans famille';
      const existing = grouped.get(family) ?? { family, sales: 0, marginTotal: 0 };
      existing.sales       += row.sales;
      existing.marginTotal += row.marginTotal;
      grouped.set(family, existing);
    });
    return Array.from(grouped.values())
      .map((e) => ({ ...e, takeRate: monthCovers > 0 ? (e.sales / monthCovers) * 100 : 0 }))
      .sort((a, b) => b.marginTotal - a.marginTotal || b.sales - a.sales);
  }, [computedRows, monthCovers]);

  // ==================================================================
  // Rendu
  // ==================================================================
  return (
    <div className="flex h-full min-h-screen bg-[#EDE2D6] text-[#4B2D22]">

      {/* ── Sidebar ── */}
      <aside className="hidden w-[250px] shrink-0 border-r border-[#D2B8A1] bg-[linear-gradient(180deg,#F4E8DC_0%,#E9D8C8_100%)] px-4 py-5 xl:flex xl:flex-col xl:gap-4">

        {/* Header card */}
        <div className="overflow-hidden rounded-[26px] border border-[#B69034] bg-[linear-gradient(180deg,#E5B548_0%,#CC9530_100%)] shadow-[0_10px_20px_rgba(130,88,22,0.18)]">
          <div className="h-1.5 bg-gradient-to-r from-[#FBE9BF] via-[#F1C867] to-[#CC9530]" />
          <div className="p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FFF4D5]">Lecture finale</p>
            <h1 className="mt-2 text-[21px] font-black leading-none text-[#4B2D18] xl:text-[23px]">
              Taux<br />de prise
            </h1>
          </div>
        </div>

        {/* Navigation */}
        <button
          onClick={() => setView('stats')}
          className="rounded-[22px] border border-[#D9A72B] bg-[linear-gradient(180deg,#F3C63D_0%,#E3A91F_100%)] px-4 py-3.5 text-center text-[13px] font-black uppercase tracking-[0.12em] text-[#4D2B18] shadow-[0_4px_0_#B8810F] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#B8810F]"
        >
          Retour paramètres
        </button>
        <button
          onClick={() => setView('take_rate')}
          className="rounded-[22px] border border-[#2E8D63] bg-[linear-gradient(180deg,#39B37D_0%,#239062_100%)] px-4 py-3.5 text-center text-[13px] font-black uppercase tracking-[0.12em] text-white shadow-[0_4px_0_#196A48] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#196A48]"
        >
          Voir paramétrage
        </button>

        {/* KPI synthèse sidebar */}
        <div className="rounded-[22px] border border-[#D7BFAB] bg-[#FFF8F1] px-4 py-4 shadow-[0_8px_18px_rgba(96,56,34,0.08)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#93644D]">Synthèse</p>
          <div className="mt-3 space-y-2 text-[13px] font-semibold text-[#6E4736]">
            <div className="flex items-center justify-between gap-3">
              <span>Mois</span>
              <span>{MONTH_KEY_TO_NAME[selectedMonth]}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Couverts</span>
              <span>{fmtInt(monthCovers)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Ventes suivies</span>
              <span>{fmtInt(totalSales)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Tx prise global</span>
              <span className="text-[#A24E30]">{fmtPercent(globalTakeRate)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Marge générée</span>
              <span>{fmtCurrency(totalMargin)}</span>
            </div>
          </div>
        </div>

        {/* Vue sections par famille */}
        {sectionRows.length > 0 && (
          <div className="rounded-[22px] border border-[#D7BFAB] bg-[#FFF8F1] px-4 py-4 shadow-[0_8px_18px_rgba(96,56,34,0.08)]">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#93644D]">Par famille</p>
            <div className="mt-3 space-y-3">
              {sectionRows.map((s) => {
                const col = getFamilyColor(s.family);
                return (
                  <div key={s.family}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-black text-[#4F2E22]">{s.family}</span>
                      <span className="text-[12px] font-semibold text-[#A24E30]">{fmtPercent(s.takeRate)}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#E8D5C4]">
                      <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (s.takeRate / Math.max(globalTakeRate, 1)) * 100)}%`,
                          background: col.bar,
                        }}
                      />
                    </div>
                    <p className="mt-0.5 text-right text-[11px] text-[#8A604B]">{fmtCurrency(s.marginTotal)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </aside>

      {/* ── Main ── */}
      <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-auto p-4 xl:p-5">

        {/* ── Sélecteur de mois ── */}
        <div className="flex flex-wrap items-center gap-2">
          {MONTHS_DISPLAY_CONFIG.map((m) => (
            <button
              key={m.key}
              onClick={() => setSelectedMonth(m.key)}
              className={`rounded-[18px] px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em] transition-all ${
                selectedMonth === m.key
                  ? 'border border-[#B69034] bg-[linear-gradient(180deg,#E5B548_0%,#CC9530_100%)] text-[#4B2D18] shadow-[0_3px_0_#9A6910]'
                  : 'border border-[#D7BEA9] bg-[#FFF8F1] text-[#8A604B] hover:bg-[#F5EAD8]'
              }`}
            >
              {m.label.slice(0, 4)}
            </button>
          ))}
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Couverts du mois', value: fmtInt(monthCovers) },
            { label: 'Ventes suivies', value: fmtInt(totalSales) },
            { label: 'Marge générée', value: fmtCurrency(totalMargin) },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-[20px] border border-[#D7BEA9] bg-[#FFF8F1] px-4 py-4 shadow-[0_6px_16px_rgba(96,56,34,0.06)]"
            >
              <p className="text-[11px] font-black uppercase tracking-[0.10em] text-[#93644D]">{kpi.label}</p>
              <p className="mt-2 text-[22px] font-black text-[#4B2D18]">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* ── Podium top 3 ── */}
        {computedRows.length >= 1 && (
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#8A604B]">
              Top 3 du mois
            </p>
            <div className="grid grid-cols-3 gap-3">
              {computedRows.slice(0, 3).map((row, i) => {
                const medal = MEDALS[i];
                const col   = getFamilyColor(row.family);
                return (
                  <div
                    key={row.id}
                    className="rounded-[22px] border border-[#D7BEA9] bg-[#FFF8F1] p-4 shadow-[0_8px_20px_rgba(96,56,34,0.08)]"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-black"
                        style={{ background: medal.bg, color: medal.text }}
                      >
                        {medal.label}
                      </span>
                      {row.family && (
                        <span
                          className="rounded-full px-2.5 py-1 text-[10px] font-black"
                          style={{ background: col.chip, color: col.text }}
                        >
                          {row.family}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-[15px] font-black leading-snug text-[#4B2D18]">{row.label}</p>
                    <p className="mt-2 text-[28px] font-black text-[#4B2D18]">
                      {fmtPercent(row.takeRate)}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-[12px] text-[#8A604B]">
                      <span>{fmtInt(row.sales)} ventes</span>
                      <span className="font-semibold">{fmtCurrency(row.marginTotal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Liste complète ── */}
        <div className="rounded-[26px] border border-[#D8BEA8] bg-[#FFF8F1] shadow-[0_18px_40px_rgba(104,63,39,0.08)]">

          {/* Header liste */}
          <div className="border-b border-[#E6D4C4] bg-[linear-gradient(180deg,#FBF4EC_0%,#F5EADD_100%)] px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">

              {/* Filtres familles */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setFamilyFilter('all')}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.06em] transition-all ${
                    familyFilter === 'all'
                      ? 'border border-[#B55A3C] bg-[#F7E8DE] text-[#7A3D25]'
                      : 'border border-[#D7BEA9] bg-transparent text-[#8A604B] hover:bg-[#F5EAD8]'
                  }`}
                >
                  Tous
                </button>
                {families.map((f) => {
                  const col    = getFamilyColor(f);
                  const active = familyFilter === f;
                  return (
                    <button
                      key={f}
                      onClick={() => setFamilyFilter(f)}
                      className="rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.06em] transition-all"
                      style={{
                        border: `1px solid ${active ? col.bar : '#D7BEA9'}`,
                        background: active ? col.chip : 'transparent',
                        color: active ? col.text : '#8A604B',
                      }}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>

              {/* Tri + Mode expert */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 rounded-[14px] border border-[#D7BEA9] bg-[#FFF8F1] p-1">
                  {([
                    { key: 'takeRate',    label: 'Taux' },
                    { key: 'sales',       label: 'Ventes' },
                    { key: 'marginTotal', label: 'Marge' },
                  ] as { key: SortKey; label: string }[]).map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setSortBy(s.key)}
                      className={`rounded-[11px] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.06em] transition-all ${
                        sortBy === s.key
                          ? 'bg-[#4B2D18] text-white'
                          : 'text-[#8A604B] hover:bg-[#F5EAD8]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Toggle mode expert */}
                <button
                  onClick={() => setExpertMode((v) => !v)}
                  className={`rounded-[14px] border px-3 py-2 text-[11px] font-black uppercase tracking-[0.06em] transition-all ${
                    expertMode
                      ? 'border-[#7F77DD] bg-[#EEEDFE] text-[#3C3489]'
                      : 'border-[#D7BEA9] bg-transparent text-[#8A604B] hover:bg-[#F5EAD8]'
                  }`}
                >
                  {expertMode ? '▾ Expert' : '▸ Expert'}
                </button>
              </div>
            </div>

            {/* Recherche */}
            <div className="mt-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un produit..."
                className="w-full rounded-[14px] border border-[#D7BEA9] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#4F2E22] outline-none transition focus:border-[#B55A3C] focus:ring-2 focus:ring-[#E8B59E]"
              />
            </div>

            <p className="mt-2 text-[12px] text-[#8A604B]">
              {computedRows.length} produit{computedRows.length > 1 ? 's' : ''} affichés
            </p>
          </div>

          {/* Lignes produits */}
          <div className="divide-y divide-[#EDE0D4]">
            {computedRows.length === 0 ? (
              <p className="px-6 py-10 text-center text-[14px] font-semibold text-[#8B6650]">
                Aucun résultat — vérifie le mois, les produits liés et l'import production.
              </p>
            ) : (
              computedRows.map((row) => {
                const col    = getFamilyColor(row.family);
                const barPct = maxTakeRate > 0 ? (row.takeRate / maxTakeRate) * 100 : 0;
                return (
                  <div
                    key={row.id}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#FAF0E5]"
                  >
                    {/* Rang */}
                    <span className="w-7 shrink-0 text-right text-[12px] font-black text-[#C4A08A]">
                      {row.rank}
                    </span>

                    {/* Infos produit + barre */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[14px] font-black text-[#4B2D18]">{row.label}</p>
                        {row.family && (
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black"
                            style={{ background: col.chip, color: col.text }}
                          >
                            {row.family}
                          </span>
                        )}
                      </div>
                      {/* Barre de progression */}
                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E8D5C4]">
                          <div
                            className="h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${barPct}%`, background: col.bar }}
                          />
                        </div>
                        <span className="shrink-0 text-[11px] text-[#A07860]">
                          {fmtInt(row.sales)} ventes
                        </span>
                      </div>
                    </div>

                    {/* Taux de prise */}
                    <div className="shrink-0 text-right">
                      <p className="text-[18px] font-black text-[#4B2D18]">
                        {fmtPercent(row.takeRate)}
                      </p>
                    </div>

                    {/* Marge totale */}
                    <div className="w-[90px] shrink-0 text-right">
                      <p className="text-[13px] font-semibold text-[#7A5240]">
                        {row.marginTotal !== 0 ? fmtCurrency(row.marginTotal) : '—'}
                      </p>
                    </div>

                    {/* Colonnes expert (masquées par défaut) */}
                    {expertMode && (
                      <div className="flex shrink-0 gap-4 border-l border-[#E8D5C4] pl-4 text-right text-[12px] text-[#8A604B]">
                        <div className="w-[60px]">
                          <p className="text-[10px] uppercase tracking-wide text-[#B09080]">CM HT</p>
                          <p className="font-semibold">{row.costHt > 0 ? fmtCurrency(row.costHt) : '—'}</p>
                        </div>
                        <div className="w-[60px]">
                          <p className="text-[10px] uppercase tracking-wide text-[#B09080]">PV HT</p>
                          <p className="font-semibold">{row.sellPriceHt > 0 ? fmtCurrency(row.sellPriceHt) : '—'}</p>
                        </div>
                        <div className="w-[55px]">
                          <p className="text-[10px] uppercase tracking-wide text-[#B09080]">Marge %</p>
                          <p className="font-semibold">{row.marginPercent !== 0 ? fmtPercent(row.marginPercent) : '—'}</p>
                        </div>
                        <div className="w-[80px]">
                          <p className="text-[10px] uppercase tracking-wide text-[#B09080]">CA théo.</p>
                          <p className="font-semibold">{row.theoreticalRevenue !== 0 ? fmtCurrency(row.theoreticalRevenue) : '—'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default TakeRateResultsPage;
