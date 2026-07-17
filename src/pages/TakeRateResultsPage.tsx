import React, { useEffect, useMemo, useState } from 'react';
import { MONTHS_DISPLAY_CONFIG, MONTH_KEY_TO_NAME, View } from '../constants';
import AppNavTile from '../components/AppNavTile';
import AiAssistantDrawer from '../components/AiAssistantDrawer';
import type { TakeRateMappingRow } from './TakeRatePage';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { loadAllFromSupabase } from '../utils/supabase';
import { resolveTakeRateMonthCovers } from '../utils/takeRateSnapshot';
import {
  buildTakeRateResultRows,
  getMaxTakeRate,
  normalizeTakeRateKey as normalize,
  parseTakeRateNumber as parseNumber,
  type TakeRateSortKey,
} from '../utils/takeRateResultsModel';

interface TakeRateResultsPageProps {
  setView: (view: View) => void;
  prepImportsByMonth: Record<string, string>;
  covers: Record<string, number>;
}

const TAKE_RATE_FROZEN_CLOUD_KEY = 'takeRateFrozenMonths';
const TAKE_RATE_BASE_ROWS_CLOUD_KEY = 'takeRateBaseRows';

interface TakeRateMonthSnapshot {
  rows?: TakeRateMappingRow[];
  salesByImport?: Record<string, number>;
  covers?: number;
}

const isMarginBaseRow = (row: TakeRateMappingRow) =>
  Boolean(
    (row as any).matchedMarginLabel ||
      (row as any).matchedMarginSheet ||
      (row as any).marginSource ||
      (row as any).costHt ||
      (row as any).sellPriceHt ||
      (row as any).marginEuro ||
      (row as any).marginPercent
  );

const parseCsvLine = (line: string, delimiter: string) => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
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
  const firstLine = input.split(/\r?\n/).find((line) => line.trim().length > 0) ?? '';
  const candidates = [';', '\t', ','];
  let best = ';';
  let bestScore = -1;
  candidates.forEach((candidate) => {
    const score = firstLine.split(candidate).length;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  });
  return best;
};

const buildMonthSalesMap = (content: string) => {
  const result = new Map<string, number>();
  if (!content?.trim()) return result;

  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return result;

  const delimiter = detectDelimiter(content);
  const headers = parseCsvLine(lines[0], delimiter).map(normalize);

  const preferredNameHeaders = ['libelle', 'libellé', 'designation', 'désignation', 'produit', 'article', 'nom'];
  const preferredQtyHeaders = [
    'nombre',
    'nb',
  ];

  const findPreferredIndex = (preferred: string[]) => {
    for (const name of preferred) {
      const exactIndex = headers.findIndex((cell) => cell === name);
      if (exactIndex !== -1) return exactIndex;
    }
    for (const name of preferred) {
      const includesIndex = headers.findIndex((cell) => cell.includes(name));
      if (includesIndex !== -1) return includesIndex;
    }
    return -1;
  };

  const nameIndex = findPreferredIndex(preferredNameHeaders);
  const qtyIndex = findPreferredIndex(preferredQtyHeaders);

  if (nameIndex === -1 || qtyIndex === -1) return result;

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i], delimiter);
    const rawLabel = (cols[nameIndex] ?? '').trim();
    if (!rawLabel) continue;
    const key = normalize(rawLabel);
    const qty = parseNumber(cols[qtyIndex] ?? '0');
    if (!key) continue;
    result.set(key, (result.get(key) ?? 0) + qty);
  }

  return result;
};

const formatInt = (value: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);

const formatPercent = (value: number) =>
  `${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)} %`;

const formatCurrency = (value: number) =>
  `${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value))} €`;

const FAMILY_PALETTE: Record<string, { bar: string; badgeBg: string; badgeText: string }> = {
  'Boeuf': { bar: '#D08A24', badgeBg: '#FBF0D8', badgeText: '#6F4B10' },
  'Burgers': { bar: '#D08A24', badgeBg: '#FBF0D8', badgeText: '#6F4B10' },
  'Belles pièces': { bar: '#D08A24', badgeBg: '#FBF0D8', badgeText: '#6F4B10' },
  'Desserts': { bar: '#BC5B86', badgeBg: '#F6E3EC', badgeText: '#6D3650' },
  'Boules de glaces': { bar: '#BC5B86', badgeBg: '#F6E3EC', badgeText: '#6D3650' },
  'Coupes glacées': { bar: '#BC5B86', badgeBg: '#F6E3EC', badgeText: '#6D3650' },
  'Boissons': { bar: '#3A78BF', badgeBg: '#E5EFFA', badgeText: '#1F4D82' },
  'Boissons chaudes': { bar: '#3A78BF', badgeBg: '#E5EFFA', badgeText: '#1F4D82' },
  'Bières à la pression': { bar: '#3A78BF', badgeBg: '#E5EFFA', badgeText: '#1F4D82' },
  'Softs': { bar: '#3A78BF', badgeBg: '#E5EFFA', badgeText: '#1F4D82' },
  'Vins': { bar: '#7565C6', badgeBg: '#ECE9FB', badgeText: '#463A8C' },
  'Sauces': { bar: '#2D9164', badgeBg: '#E5F3EC', badgeText: '#1A5F41' },
  'Garnitures': { bar: '#2D9164', badgeBg: '#E5F3EC', badgeText: '#1A5F41' },
  'Food': { bar: '#2D9164', badgeBg: '#E5F3EC', badgeText: '#1A5F41' },
  'Poissons': { bar: '#2D9164', badgeBg: '#E5F3EC', badgeText: '#1A5F41' },
  'Plats du jour': { bar: '#2D9164', badgeBg: '#E5F3EC', badgeText: '#1A5F41' },
  'Menus': { bar: '#D9A72B', badgeBg: '#FBF2DC', badgeText: '#6F4B10' },
};

const getFamilyColors = (family: string) =>
  FAMILY_PALETTE[family] ?? { bar: '#8D857C', badgeBg: '#F2EAE2', badgeText: '#554B42' };

const pageBackgroundStyle: React.CSSProperties = {
  backgroundColor: '#F8DEA3',
  backgroundImage: [
    'radial-gradient(circle at top left, rgba(244, 173, 62, 0.32), transparent 34%)',
    'radial-gradient(circle at top right, rgba(222, 121, 35, 0.22), transparent 28%)',
    'radial-gradient(circle at bottom center, rgba(255, 211, 102, 0.20), transparent 34%)',
    'linear-gradient(180deg, #FFF4C9 0%, #F8DEA3 44%, #EDBE73 100%)',
  ].join(', '),
};

const medalStyles = [
  { rank: '1er', bg: '#E9B657', color: '#5A3910' },
  { rank: '2e', bg: '#D9D3CB', color: '#4F4A44' },
  { rank: '3e', bg: '#EAA07E', color: '#6F311E' },
];

const TakeRateResultsPage: React.FC<TakeRateResultsPageProps> = ({ setView, prepImportsByMonth, covers }) => {
  const [rows, setRows] = useState<TakeRateMappingRow[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(MONTHS_DISPLAY_CONFIG[new Date().getMonth()]?.key ?? 'jan');
  const [search, setSearch] = useState('');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [sortBy, setSortBy] = useState<TakeRateSortKey>('takeRate');
  const [expertMode, setExpertMode] = useState(false);
  const [baseRows, setBaseRows] = useState<TakeRateMappingRow[]>([]);
  const [frozenMonths, setFrozenMonths] = useState<Record<string, TakeRateMonthSnapshot>>({});

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        let nextFrozen = {};
        let nextBaseRows: TakeRateMappingRow[] = [];

        if (isSupabaseConfigured()) {
          const cloud = await loadAllFromSupabase();
          if (Array.isArray(cloud)) {
            cloud.forEach((entry: any) => {
              if (entry?.key === TAKE_RATE_FROZEN_CLOUD_KEY && entry.value && typeof entry.value === 'object') nextFrozen = entry.value;
              if (entry?.key === TAKE_RATE_BASE_ROWS_CLOUD_KEY && Array.isArray(entry.value)) nextBaseRows = entry.value.filter(isMarginBaseRow);
            });
          }
        }

        if (cancelled) return;
        setBaseRows(nextBaseRows.map(normalizeResultRow));
        setFrozenMonths(nextFrozen && typeof nextFrozen === 'object' ? nextFrozen : {});
      } catch (_error) {
        if (!cancelled) setRows([]);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  const normalizeResultRow = (row: any) => ({
    id: String(row.id ?? ''),
    label: String(row.label ?? ''),
    family: String(row.family ?? ''),
    linkedImports: Array.isArray(row.linkedImports) ? row.linkedImports.map(String) : [],
    costHt: parseNumber((row as any).costHt),
    sellPriceHt: parseNumber((row as any).sellPriceHt),
    marginEuro: parseNumber((row as any).marginEuro),
    marginPercent: parseNumber((row as any).marginPercent),
  });

  useEffect(() => {
    const snapshot = frozenMonths[selectedMonth];
    if (snapshot?.rows) {
      setRows(snapshot.rows.map(normalizeResultRow));
      return;
    }

    if (baseRows.length > 0) {
      setRows(baseRows.map(normalizeResultRow));
      return;
    }

    setRows([]);
  }, [baseRows, frozenMonths, selectedMonth]);

  const monthSalesMap = useMemo(
    () => {
      const frozenSales = frozenMonths[selectedMonth]?.salesByImport;
      if (frozenSales && Object.keys(frozenSales).length > 0) {
        return new Map(Object.entries(frozenSales));
      }
      return buildMonthSalesMap(prepImportsByMonth[selectedMonth] ?? '');
    },
    [frozenMonths, prepImportsByMonth, selectedMonth]
  );
  const monthCovers = resolveTakeRateMonthCovers(
    frozenMonths[selectedMonth]?.covers,
    covers[selectedMonth],
  );

  const computedRows = useMemo(() => {
    return buildTakeRateResultRows({
      rows,
      salesByImport: monthSalesMap,
      monthCovers,
      familyFilter,
      search,
      sortBy,
    });
  }, [rows, monthSalesMap, monthCovers, familyFilter, search, sortBy]);

  const families = useMemo(() => {
    const values = Array.from(new Set<string>(rows.map((row) => row.family.trim()).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b, 'fr'));
  }, [rows]);

  const totalSales = computedRows.reduce((sum, row) => sum + row.sales, 0);
  const totalMargin = computedRows.reduce((sum, row) => sum + row.marginTotal, 0);
  const maxTakeRate = getMaxTakeRate(computedRows) || 1;
  const getAiContext = React.useCallback(() => {
    const selectedMonthLabel = MONTH_KEY_TO_NAME[selectedMonth] ?? selectedMonth;
    const frozenCount = Object.keys(frozenMonths).length;
    const topRows = computedRows.slice(0, 80).map((row) =>
      `${row.rank}. ${row.label}: famille=${row.family || 'n/a'}, ventes=${row.sales}, taux=${row.takeRate.toFixed(2)}%, marge=${Math.round(row.marginTotal)}, liens=${row.linkedImports.length}`
    );

    return [
      'Page: Feuille Taux de prise.',
      'Source utilisée: base marge paramétrée + import production du mois ouvert; snapshot pour mois figés.',
      `Mois sélectionné: ${selectedMonthLabel}; figé=${frozenMonths[selectedMonth] ? 'oui' : 'non'}.`,
      `Couverts mois: ${monthCovers}; ventes suivies=${totalSales}; marge générée=${Math.round(totalMargin)}.`,
      `Produits affichés=${computedRows.length}; familles=${families.length}; mois figés=${frozenCount}.`,
      `Filtre famille=${familyFilter}; tri=${sortBy}; recherche=${search || 'aucune'}.`,
      'Produits calculés:',
      ...topRows,
    ].join('\n');
  }, [computedRows, families.length, familyFilter, frozenMonths, monthCovers, search, selectedMonth, sortBy, totalMargin, totalSales]);

  return (
    <div className="min-h-screen bg-[#F8DEA3] text-[#2E1B12]" style={pageBackgroundStyle}>
      <main className="mx-auto flex min-h-screen w-full max-w-[1480px] flex-col gap-5 px-6 py-5 xl:px-8">
        <div className="flex flex-col items-start gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <AppNavTile
              onClick={() => setView('home')}
              eyebrow="Retour"
              icon="home"
              size="sm"
            >
              Accueil
            </AppNavTile>
            <AiAssistantDrawer
              placement="inline"
              title="Assistant IA - Taux de prise"
              getContext={getAiContext}
              className="border-[#A7DEE5] bg-[#064D59] text-white shadow-[0_12px_28px_rgba(6,77,89,0.18)] hover:bg-[#083F49]"
            />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.20em] text-[#A97718]">Lecture mensuelle</p>
            <h1 className="mt-2 text-[26px] font-black leading-tight text-[#1D120D]">Taux de prise</h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {MONTHS_DISPLAY_CONFIG.map((month) => {
            const active = selectedMonth === month.key;
            return (
              <button
                key={month.key}
                onClick={() => setSelectedMonth(month.key)}
                className={
                  active
                    ? 'rounded-[14px] bg-[#2C1A10] px-4 py-2.5 text-[12px] font-black uppercase tracking-[0.05em] text-white shadow-[inset_0_-2px_0_rgba(12,7,4,0.22)]'
                    : 'rounded-[14px] border border-[#E2BE7F] bg-[#FFF4D9] px-4 py-2.5 text-[12px] font-black uppercase tracking-[0.05em] text-[#7A5A22] transition hover:bg-[#F7E0AD]'
                }
              >
                {month.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {[
            { label: 'Couverts du mois', value: formatInt(monthCovers) },
            { label: 'Ventes suivies', value: formatInt(totalSales) },
            { label: 'Marge générée', value: formatCurrency(totalMargin) },
          ].map((item) => (
            <div key={item.label} className="rounded-[22px] border border-[#E7C990] bg-[#FFF0CC] px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#A97718]">{item.label}</p>
              <p className="mt-3 text-[22px] font-black text-[#1D120D]">{item.value}</p>
            </div>
          ))}
        </div>

        {computedRows.length > 0 && (
          <div>
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#A97718]">Top 3 du mois</p>
            <div className="grid gap-4 xl:grid-cols-3">
              {computedRows.slice(0, 3).map((row, index) => {
                const medal = medalStyles[index];
                const colors = getFamilyColors(row.family);
                return (
                  <div key={row.id} className="rounded-[22px] border border-[#E7C990] bg-[#FFF7E2] px-5 py-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-black"
                        style={{ background: medal.bg, color: medal.color }}
                      >
                        {medal.rank}
                      </span>
                      {row.family ? (
                        <span
                          className="rounded-full px-2.5 py-1 text-[10px] font-black"
                          style={{ background: colors.badgeBg, color: colors.badgeText }}
                        >
                          {row.family}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[16px] font-black text-[#1D120D]">{row.label}</p>
                    <p className="mt-3 text-[30px] font-black leading-none text-[#1D120D]">{formatPercent(row.takeRate)}</p>
                    <div className="mt-4 flex items-center justify-between gap-3 text-[12px] text-[#8A6418]">
                      <span>{formatInt(row.sales)} ventes</span>
                      <span className="font-semibold">{row.marginTotal > 0 ? formatCurrency(row.marginTotal) : '—'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={familyFilter}
              onChange={(e) => setFamilyFilter(e.target.value)}
              className="rounded-[14px] border border-[#E2BE7F] bg-[#FFF7E2] px-4 py-2.5 text-[13px] font-semibold text-[#2E1B12] outline-none"
            >
              <option value="all">Toutes les familles</option>
              {families.map((family) => (
                <option key={family} value={family}>
                  {family}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-[190px] rounded-[14px] border border-[#E2BE7F] bg-[#FFF7E2] px-4 py-2.5 text-[13px] font-semibold text-[#2E1B12] outline-none"
            />

            <span className="text-[12px] text-[#A97718]">
              {computedRows.length} produit{computedRows.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {([
              { key: 'takeRate', label: 'Taux' },
              { key: 'sales', label: 'Ventes' },
              { key: 'marginTotal', label: 'Marge' },
            ] as { key: TakeRateSortKey; label: string }[]).map((sort) => {
              const active = sortBy === sort.key;
              return (
                <button
                  key={sort.key}
                  onClick={() => setSortBy(sort.key)}
                  className={
                    active
                      ? 'rounded-full bg-[#2C1A10] px-4 py-2 text-[12px] font-black uppercase tracking-[0.06em] text-white shadow-[inset_0_-2px_0_rgba(12,7,4,0.22)]'
                      : 'rounded-full border border-[#E2BE7F] bg-[#FFF4D9] px-4 py-2 text-[12px] font-black uppercase tracking-[0.06em] text-[#7A5A22] transition hover:bg-[#F7E0AD]'
                  }
                >
                  {sort.label}
                </button>
              );
            })}

            <button
              onClick={() => setExpertMode((value) => !value)}
              className={
                expertMode
                  ? 'rounded-full border border-[#6E65C9] bg-[#EEEAFD] px-4 py-2 text-[12px] font-black uppercase tracking-[0.06em] text-[#433A8C]'
                  : 'rounded-full border border-[#E2BE7F] bg-[#FFF7E2] px-4 py-2 text-[12px] font-black uppercase tracking-[0.06em] text-[#7A5A22] transition hover:bg-[#F7E0AD]'
              }
            >
              {expertMode ? 'Expert ▾' : 'Expert ▸'}
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[22px] border border-[#E7C990] bg-[#FFF7E2]">
          {computedRows.length === 0 ? (
            <div className="px-6 py-14 text-center text-[14px] font-semibold text-[#8A6418]">
              Aucun résultat pour ce mois ou ce filtre.
            </div>
          ) : (
            computedRows.map((row, index) => {
              const colors = getFamilyColors(row.family);
              const barWidth = maxTakeRate > 0 ? (row.takeRate / maxTakeRate) * 100 : 0;
              const isLast = index === computedRows.length - 1;

              return (
                <div
                  key={row.id}
                  className={`px-6 py-4 transition-colors hover:bg-[#FFEABF] ${!isLast ? 'border-b border-[#E7C990]' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <span className="w-7 shrink-0 pt-1 text-right text-[12px] font-semibold text-[#C59A44]">
                      {row.rank}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="truncate text-[15px] font-black text-[#1D120D]">{row.label}</span>
                        {row.family ? (
                          <span
                            className="rounded-full px-2.5 py-0.5 text-[10px] font-black"
                            style={{ background: colors.badgeBg, color: colors.badgeText }}
                          >
                            {row.family}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F2D59E]">
                          <div
                            className="h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${barWidth.toFixed(1)}%`, background: colors.bar }}
                          />
                        </div>
                        <span className="shrink-0 text-[12px] text-[#A97718]">{formatInt(row.sales)} ventes</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-start gap-6">
                      <div className="w-[86px] text-right">
                        <p className="text-[11px] uppercase tracking-[0.05em] text-[#B38A3A]">Tx prise</p>
                        <p className="mt-1 text-[18px] font-black text-[#1D120D]">{formatPercent(row.takeRate)}</p>
                      </div>

                      <div className="w-[84px] text-right">
                        <p className="text-[11px] uppercase tracking-[0.05em] text-[#B38A3A]">Marge</p>
                        <p className="mt-1 text-[14px] font-semibold text-[#8A6418]">
                          {row.marginTotal > 0 ? formatCurrency(row.marginTotal) : '—'}
                        </p>
                      </div>

                      {expertMode ? (
                        <div className="flex gap-5 border-l border-[#E7C990] pl-5">
                          {[
                            { label: 'CM HT', value: row.costHt > 0 ? formatCurrency(row.costHt) : '—' },
                            { label: 'PV HT', value: row.sellPriceHt > 0 ? formatCurrency(row.sellPriceHt) : '—' },
                            { label: 'Marge %', value: row.marginPercent !== 0 ? formatPercent(row.marginPercent) : '—' },
                            { label: 'CA théo', value: row.caTheo > 0 ? formatCurrency(row.caTheo) : '—' },
                          ].map((entry) => (
                            <div key={entry.label} className="w-[74px] text-right">
                              <p className="text-[10px] uppercase tracking-[0.06em] text-[#B38A3A]">{entry.label}</p>
                              <p className="mt-1 text-[12px] font-semibold text-[#4A3020]">{entry.value}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
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
