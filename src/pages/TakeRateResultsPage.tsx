import React, { useEffect, useMemo, useState } from 'react';
import { MONTHS_DISPLAY_CONFIG, MONTH_KEY_TO_NAME, STORAGE_PREFIX, View } from '../constants';
import type { TakeRateMappingRow } from './TakeRatePage';

interface TakeRateResultsPageProps {
  setView: (view: View) => void;
  prepImportsByMonth: Record<string, string>;
  covers: Record<string, number>;
}

type SortKey = 'label' | 'family' | 'sales' | 'takeRate';

const STORAGE_KEY = `${STORAGE_PREFIX}take_rate_rows_v1`;

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

const parseNumber = (value: string) => {
  const cleaned = value.replace(/\s/g, '').replace(',', '.');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildMonthSalesMap = (content: string) => {
  const result = new Map<string, number>();
  if (!content?.trim()) return result;

  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return result;

  const delimiter = detectDelimiter(content);
  const headers = parseCsvLine(lines[0], delimiter).map(normalize);
  const nameCandidates = ['produit', 'libelle', 'libellé', 'designation', 'désignation', 'article', 'nom', 'item'];
  const qtyCandidates = ['nombre', 'qte', 'qté', 'quantite', 'quantité', 'vente', 'ventes', 'qty', 'nb'];

  let nameIndex = headers.findIndex((cell) => nameCandidates.some((candidate) => cell.includes(candidate)));
  let qtyIndex = headers.findIndex((cell) => qtyCandidates.some((candidate) => cell.includes(candidate)));

  if (nameIndex === -1) nameIndex = 0;
  if (qtyIndex === -1) qtyIndex = headers.length > 1 ? 1 : 0;

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i], delimiter);
    const label = (cols[nameIndex] ?? '').trim();
    if (!label) continue;
    const qty = parseNumber(cols[qtyIndex] ?? '0');
    result.set(label, (result.get(label) ?? 0) + qty);
  }

  return result;
};

const formatNumber = (value: number, decimals = 0) =>
  new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

const formatPercent = (value: number) =>
  `${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} %`;

const TakeRateResultsPage: React.FC<TakeRateResultsPageProps> = ({ setView, prepImportsByMonth, covers }) => {
  const [rows, setRows] = useState<TakeRateMappingRow[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(MONTHS_DISPLAY_CONFIG[new Date().getMonth()]?.key ?? 'jan');
  const [search, setSearch] = useState('');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortKey>('takeRate');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setRows(
          parsed.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.label ?? ''),
            family: String(row.family ?? ''),
            linkedImports: Array.isArray(row.linkedImports) ? row.linkedImports.map(String) : [],
          }))
        );
      }
    } catch (_error) {}
  }, []);

  const monthSalesMap = useMemo(() => buildMonthSalesMap(prepImportsByMonth[selectedMonth] ?? ''), [prepImportsByMonth, selectedMonth]);
  const monthCovers = Number(covers[selectedMonth] ?? 0);

  const computedRows = useMemo(() => {
    const query = normalize(search);
    return rows
      .filter((row) => row.label.trim().length > 0 && row.linkedImports.length > 0)
      .map((row) => {
        const sales = row.linkedImports.reduce((sum, item) => sum + (monthSalesMap.get(item) ?? 0), 0);
        const takeRate = monthCovers > 0 ? (sales / monthCovers) * 100 : 0;
        return {
          ...row,
          sales,
          covers: monthCovers,
          takeRate,
        };
      })
      .filter((row) => (familyFilter === 'all' ? true : row.family === familyFilter))
      .filter((row) => {
        if (!query) return true;
        return normalize(row.label).includes(query) || normalize(row.family).includes(query);
      })
      .sort((a, b) => {
        if (sortBy === 'label') return a.label.localeCompare(b.label, 'fr');
        if (sortBy === 'family') return a.family.localeCompare(b.family, 'fr') || a.label.localeCompare(b.label, 'fr');
        if (sortBy === 'sales') return b.sales - a.sales || a.label.localeCompare(b.label, 'fr');
        return b.takeRate - a.takeRate || b.sales - a.sales || a.label.localeCompare(b.label, 'fr');
      })
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }, [rows, monthSalesMap, monthCovers, familyFilter, search, sortBy]);

  const families = useMemo(() => {
    const values = Array.from(new Set(rows.map((row) => row.family.trim()).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b, 'fr'));
  }, [rows]);

  const totalSales = computedRows.reduce((sum, row) => sum + row.sales, 0);
  const bestRow = computedRows[0] ?? null;

  return (
    <div className="flex h-full min-h-screen bg-[#EDE2D6] text-[#4B2D22]">
      <aside className="hidden w-[250px] shrink-0 border-r border-[#D2B8A1] bg-[linear-gradient(180deg,#F4E8DC_0%,#E9D8C8_100%)] px-4 py-5 xl:flex xl:flex-col xl:gap-4">
        <div className="overflow-hidden rounded-[26px] border border-[#B69034] bg-[linear-gradient(180deg,#E5B548_0%,#CC9530_100%)] shadow-[0_10px_20px_rgba(130,88,22,0.18)]">
          <div className="h-1.5 bg-gradient-to-r from-[#FBE9BF] via-[#F1C867] to-[#CC9530]" />
          <div className="p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FFF4D5]">Lecture finale</p>
            <h1 className="mt-2 text-[21px] font-black leading-none text-[#4B2D18] xl:text-[23px]">
              Feuille
              <br />
              taux de prise
            </h1>
          </div>
        </div>

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

        <div className="rounded-[22px] border border-[#D7BFAB] bg-[#FFF8F1] px-4 py-4 shadow-[0_8px_18px_rgba(96,56,34,0.08)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#93644D]">Synthèse</p>
          <div className="mt-3 space-y-2 text-[13px] font-semibold text-[#6E4736]">
            <div className="flex items-center justify-between gap-3"><span>Mois</span><span>{MONTH_KEY_TO_NAME[selectedMonth]}</span></div>
            <div className="flex items-center justify-between gap-3"><span>Couverts</span><span>{formatNumber(monthCovers)}</span></div>
            <div className="flex items-center justify-between gap-3"><span>Ventes suivies</span><span>{formatNumber(totalSales)}</span></div>
            <div className="flex items-center justify-between gap-3"><span>Produits</span><span>{computedRows.length}</span></div>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden p-4 xl:p-5">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-[#D8BEA8] bg-[#FFF8F1] shadow-[0_18px_40px_rgba(104,63,39,0.10)]">
          <div className="border-b border-[#E6D4C4] bg-[linear-gradient(180deg,#FBF4EC_0%,#F5EADD_100%)] px-5 py-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.20em] text-[#8F624B]">Lecture finale</p>
                <h2 className="mt-1 text-[21px] font-black text-[#582F21]">Feuille taux de prise</h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="rounded-[14px] border border-[#D7BEA9] bg-white px-3 py-2.5 text-[12px] font-black uppercase tracking-[0.06em] text-[#4F2E22] outline-none"
                >
                  {MONTHS_DISPLAY_CONFIG.map((month) => (
                    <option key={month.key} value={month.key}>{month.label}</option>
                  ))}
                </select>

                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Recherche produit..."
                  className="w-[220px] rounded-[14px] border border-[#D7BEA9] bg-white px-3 py-2.5 text-[12px] font-semibold text-[#4F2E22] outline-none"
                />

                <select
                  value={familyFilter}
                  onChange={(e) => setFamilyFilter(e.target.value)}
                  className="rounded-[14px] border border-[#D7BEA9] bg-white px-3 py-2.5 text-[12px] font-semibold text-[#4F2E22] outline-none"
                >
                  <option value="all">Toutes familles</option>
                  {families.map((family) => (
                    <option key={family} value={family}>{family}</option>
                  ))}
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className="rounded-[14px] border border-[#D7BEA9] bg-white px-3 py-2.5 text-[12px] font-semibold text-[#4F2E22] outline-none"
                >
                  <option value="takeRate">Tri taux de prise</option>
                  <option value="sales">Tri ventes</option>
                  <option value="label">Tri produit</option>
                  <option value="family">Tri famille</option>
                </select>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-[18px] border border-[#E1CFBF] bg-[#FFFDF9] px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9A6A52]">Top produit</p>
                <p className="mt-2 text-[16px] font-black text-[#5A3224]">{bestRow?.label || '—'}</p>
                <p className="mt-1 text-[12px] font-semibold text-[#7C5948]">{bestRow ? formatPercent(bestRow.takeRate) : 'Aucune donnée'}</p>
              </div>
              <div className="rounded-[18px] border border-[#E1CFBF] bg-[#FFFDF9] px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9A6A52]">Couverts du mois</p>
                <p className="mt-2 text-[16px] font-black text-[#5A3224]">{formatNumber(monthCovers)}</p>
              </div>
              <div className="rounded-[18px] border border-[#E1CFBF] bg-[#FFFDF9] px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9A6A52]">Ventes suivies</p>
                <p className="mt-2 text-[16px] font-black text-[#5A3224]">{formatNumber(totalSales)}</p>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-[#F7F0E7]">
            <table className="w-full min-w-[980px] table-fixed border-separate border-spacing-0">
              <colgroup>
                <col className="w-[7%]" />
                <col className="w-[31%]" />
                <col className="w-[18%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[16%]" />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#EADACA] text-[#71402D]">
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-center text-[12px] font-black uppercase tracking-[0.07em]">#</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Produit</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">Famille</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-right text-[12px] font-black uppercase tracking-[0.07em]">Ventes</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-right text-[12px] font-black uppercase tracking-[0.07em]">Couverts</th>
                  <th className="border-b border-[#DCC2AB] px-3 py-4 text-right text-[12px] font-black uppercase tracking-[0.07em]">Taux de prise</th>
                </tr>
              </thead>
              <tbody>
                {computedRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-[14px] font-semibold text-[#8B6650]">
                      Aucun résultat. Vérifie le mois choisi, les produits liés dans le paramétrage, ou l’import production du mois.
                    </td>
                  </tr>
                ) : (
                  computedRows.map((row, index) => (
                    <tr key={row.id} className={index % 2 === 0 ? 'bg-[#FFF9F2]' : 'bg-[#FCF4EB]'}>
                      <td className="border-b border-[#E8D8C8] px-3 py-3 text-center text-[12px] font-black text-[#7C5848]">{row.rank}</td>
                      <td className="border-b border-[#E8D8C8] px-3 py-3 text-[13px] font-semibold text-[#4F2E22]">{row.label}</td>
                      <td className="border-b border-[#E8D8C8] px-3 py-3 text-[12px] font-semibold text-[#6A4737]">{row.family || '—'}</td>
                      <td className="border-b border-[#E8D8C8] px-3 py-3 text-right text-[13px] font-black text-[#4F2E22]">{formatNumber(row.sales)}</td>
                      <td className="border-b border-[#E8D8C8] px-3 py-3 text-right text-[13px] font-semibold text-[#6A4737]">{formatNumber(row.covers)}</td>
                      <td className="border-b border-[#E8D8C8] px-3 py-3 text-right text-[13px] font-black text-[#A24E30]">{formatPercent(row.takeRate)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};

export default TakeRateResultsPage;
