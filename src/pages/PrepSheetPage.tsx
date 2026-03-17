import React from 'react';
import { MONTHS_DISPLAY_CONFIG, MONTHS_ORDER, type View } from '../constants';
import type { PrepCategory, PrepImportsByMonth, PrepItem } from '../types';
import { getImportedValueForProduct } from '../utils/csvHelpers';
import type { DailyCoversState } from '../utils/dateHelpers';

const CATEGORY_ORDER: PrepCategory[] = ['poste_chaud', 'poste_entree', 'poste_dessert', 'decongelation'];
const CATEGORY_LABELS: Record<PrepCategory, string> = {
  poste_chaud: 'Poste chaud',
  poste_entree: 'Poste entrée',
  poste_dessert: 'Poste dessert',
  decongelation: 'Décongélation',
};

const CATEGORY_BANNERS: Record<PrepCategory, string> = {
  poste_chaud: 'from-[#A93E2A] via-[#91301F] to-[#7A231A]',
  poste_entree: 'from-[#8A5A2F] via-[#784825] to-[#6A3B1D]',
  poste_dessert: 'from-[#9B3F7A] via-[#833065] to-[#6E2455]',
  decongelation: 'from-[#2F6F8A] via-[#245F78] to-[#1E4E68]',
};

const MAPPING_SEPARATOR = ' || ';

interface PrepSheetPageProps {
  setView: (v: View) => void;
  prepItems: PrepItem[];
  dailyCovers: DailyCoversState;
  covers: Record<string, number>;
  prepImportsByMonth: PrepImportsByMonth;
}

type PrepItemExtended = PrepItem & {
  baseProduction?: string;
  unitWeightGrams?: number | '';
};

type ChildCalcRow = {
  label: string;
  need: number;
  stock: number;
  toProduce: number;
  weightGrams: number;
  notes?: string;
  stockKey: string;
  maxDlcHours: number;
};

type BaseParentRow = {
  kind: 'base';
  baseProduction: string;
  theoreticalKg: number;
  toProduceKg: number;
  children: ChildCalcRow[];
};

type StandaloneRow = {
  kind: 'item';
  label: string;
  need: number;
  stock: number;
  toProduce: number;
  stockKey: string;
  notes?: string;
  maxDlcHours: number;
};

type DisplayRow = BaseParentRow | StandaloneRow;
type StockState = Record<string, number>;

const STOCK_STORAGE_KEY = 'prep-sheet-stocks-v3';

const getBaseProduction = (item: PrepItem) => String((item as PrepItemExtended).baseProduction || '').trim();
const getUnitWeight = (item: PrepItem) => Number((item as PrepItemExtended).unitWeightGrams || 0);

const parseMappingNames = (value?: string) =>
  String(value || '')
    .split(MAPPING_SEPARATOR)
    .map((name) => name.trim())
    .filter(Boolean);

const getMonthKeyFromDate = (date: string) => {
  if (!date) return 'jan';
  const monthIndex = new Date(`${date}T12:00:00`).getMonth();
  return MONTHS_ORDER[monthIndex] ?? 'jan';
};

const getDatePlusDays = (date: string, days: number) => {
  const base = new Date(`${date}T12:00:00`);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
};

const getCoversForDate = (date: string, dailyCovers: DailyCoversState) => {
  const monthKey = getMonthKeyFromDate(date);
  const dayIndex = new Date(`${date}T12:00:00`).getDate() - 1;
  const dayData = dailyCovers?.[monthKey]?.[dayIndex];
  return Number(dayData?.midi || 0) + Number(dayData?.soir || 0);
};

const getCoveredDaysCount = (dlcHours: number) => {
  const safeHours = Number(dlcHours || 24);
  if (safeHours <= 24) return 1;
  return Math.max(1, Math.ceil(safeHours / 24));
};

const getFutureCoversForWindow = (date: string, dailyCovers: DailyCoversState, dlcHours: number) => {
  const dayCount = getCoveredDaysCount(dlcHours);
  let total = 0;
  for (let i = 0; i < dayCount; i += 1) {
    total += getCoversForDate(getDatePlusDays(date, i), dailyCovers);
  }
  return total;
};

const getAverageRatio = (item: PrepItem, covers: Record<string, number>, prepImportsByMonth: PrepImportsByMonth) => {
  let total = 0;
  let count = 0;

  MONTHS_ORDER.forEach((month) => {
    const coversValue = Number(covers[month] || 0);
    if (!coversValue) return;

    const manualRatio = Number(item.ratioHistory?.[month] || 0);
    if (manualRatio > 0) {
      total += manualRatio;
      count += 1;
      return;
    }

    const imported = parseMappingNames(item.searchName).reduce((sum, mappingName) => {
      return sum + Number(
        getImportedValueForProduct(prepImportsByMonth[month], mappingName, item.importDivisor, ['Nombre']) || 0
      );
    }, 0);

    if (imported > 0) {
      total += imported / coversValue;
      count += 1;
    }
  });

  return count > 0 ? total / count : 0;
};

const roundUpToHalfKg = (valueKg: number) => {
  if (!Number.isFinite(valueKg) || valueKg <= 0) return 0;
  return Math.ceil(valueKg * 2) / 2;
};

const formatKg = (value: number) => `${value.toFixed(1).replace('.', ',')} kg`;
const buildStockKey = (date: string, category: PrepCategory, rowKey: string) => `${date}__${category}__${rowKey}`;

const PrepSheetPage: React.FC<PrepSheetPageProps> = ({ setView, prepItems, dailyCovers, covers, prepImportsByMonth }) => {
  const [selectedDate, setSelectedDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [activeCategory, setActiveCategory] = React.useState<PrepCategory | 'all'>('all');
  const [stocks, setStocks] = React.useState<StockState>({});

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STOCK_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') setStocks(parsed);
    } catch {}
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem(STOCK_STORAGE_KEY, JSON.stringify(stocks));
    } catch {}
  }, [stocks]);

  const coversForDay = React.useMemo(() => getCoversForDate(selectedDate, dailyCovers), [selectedDate, dailyCovers]);
  const monthLabel = React.useMemo(() => MONTHS_DISPLAY_CONFIG.find((m) => m.key === getMonthKeyFromDate(selectedDate))?.label ?? '', [selectedDate]);

  const setStockValue = (key: string, value: number) => {
    setStocks((prev) => ({ ...prev, [key]: Math.max(0, value) }));
  };

  const groupedRows = React.useMemo(() => {
    return CATEGORY_ORDER.map((category) => {
      const itemsForCategory = prepItems.filter((item) => item.category === category);

      const calcRows = itemsForCategory.map((item) => {
        const averageRatio = getAverageRatio(item, covers, prepImportsByMonth);
        const dlcHours = Number(item.secondaryDlcHours || 24);
        const coversWindow = getFutureCoversForWindow(selectedDate, dailyCovers, dlcHours);
        const need = averageRatio * coversWindow;
        return {
          item,
          need,
          averageRatio,
          dlcHours,
          baseProduction: getBaseProduction(item),
          weightGrams: getUnitWeight(item),
        };
      });

      const baseGroups = new Map<string, typeof calcRows>();
      const standaloneMap = new Map<string, StandaloneRow>();

      calcRows.forEach((row) => {
        if (row.baseProduction && row.weightGrams > 0) {
          const current = baseGroups.get(row.baseProduction) ?? [];
          current.push(row);
          baseGroups.set(row.baseProduction, current);
        } else {
          const rowKey = `itemname::${row.item.name.trim().toLowerCase()}`;
          const stockKey = buildStockKey(selectedDate, category, rowKey);
          const existing = standaloneMap.get(rowKey);
          if (!existing) {
            standaloneMap.set(rowKey, {
              kind: 'item',
              label: row.item.name,
              need: row.need,
              stock: Number(stocks[stockKey] || 0),
              toProduce: 0,
              stockKey,
              notes: row.item.notes || '',
              maxDlcHours: row.dlcHours,
            });
          } else {
            existing.need += row.need;
            existing.notes = [existing.notes, row.item.notes || ''].filter(Boolean).join(' • ');
            existing.maxDlcHours = Math.max(existing.maxDlcHours, row.dlcHours);
          }
        }
      });

      const displayRows: DisplayRow[] = [];

      baseGroups.forEach((children, baseProduction) => {
        const merged = new Map<string, ChildCalcRow>();

        children.forEach((child) => {
          const labelKey = child.item.name.trim().toLowerCase();
          const stockKey = buildStockKey(selectedDate, category, `base::${baseProduction}::${labelKey}`);
          const existing = merged.get(labelKey);

          if (!existing) {
            merged.set(labelKey, {
              label: child.item.name,
              need: child.need,
              stock: Number(stocks[stockKey] || 0),
              toProduce: 0,
              weightGrams: child.weightGrams,
              notes: child.item.notes || '',
              stockKey,
              maxDlcHours: child.dlcHours,
            });
            return;
          }

          existing.need += child.need;
          existing.weightGrams = Math.max(existing.weightGrams, child.weightGrams);
          existing.notes = [existing.notes, child.item.notes || ''].filter(Boolean).join(' • ');
          existing.maxDlcHours = Math.max(existing.maxDlcHours, child.dlcHours);
        });

        const childrenRows = Array.from(merged.values()).map((child) => ({
          ...child,
          toProduce: Math.max(0, Math.ceil(child.need - child.stock)),
        }));

        const theoreticalKg = childrenRows.reduce((sum, child) => sum + (child.need * child.weightGrams), 0) / 1000;
        const netKg = childrenRows.reduce((sum, child) => sum + (child.toProduce * child.weightGrams), 0) / 1000;

        displayRows.push({
          kind: 'base',
          baseProduction,
          theoreticalKg,
          toProduceKg: roundUpToHalfKg(netKg),
          children: childrenRows,
        });
      });

      standaloneMap.forEach((row) => {
        row.toProduce = Math.max(0, Math.ceil(row.need - row.stock));
        displayRows.push(row);
      });

      return { category, rows: displayRows };
    }).filter((group) => group.rows.length > 0);
  }, [covers, dailyCovers, prepImportsByMonth, prepItems, selectedDate, stocks]);

  const visibleGroups = React.useMemo(() => {
    if (activeCategory === 'all') return groupedRows;
    return groupedRows.filter((group) => group.category === activeCategory);
  }, [activeCategory, groupedRows]);

  const getWindowLabel = (hours: number) => {
    const days = getCoveredDaysCount(hours);
    return `${hours} h • ${days * 2} services`;
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#F6EFE6_0%,#F2E8DD_45%,#EBDDCE_100%)] text-[#34271F]">
      <div className="mx-auto flex min-h-screen max-w-[1760px] flex-col gap-3 p-2 lg:flex-row lg:gap-3 lg:p-3">
        <aside className="w-full shrink-0 lg:w-[230px] xl:w-[240px]">
          <div className="flex h-full flex-col gap-3">
            <div className="overflow-hidden rounded-[22px] border border-[#B46E58] bg-[linear-gradient(135deg,#A93E2A_0%,#922F20_48%,#7A231A_100%)] shadow-[0_10px_20px_rgba(122,35,26,0.14)]">
              <div className="h-1.5 bg-gradient-to-r from-[#F1C15A] via-[#D86A2C] to-[#A93E2A]" />
              <div className="p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FFE1B8]">Hippopotamus Thillois</p>
                <h1 className="mt-2 text-[20px] font-black leading-none text-[#FFF9F3] xl:text-[22px]">Feuille de mise en place</h1>
                <p className="mt-3 text-[12px] font-semibold leading-5 text-[#FFE7CF]">Vue terrain simple par poste, centrée uniquement sur ce qu&apos;il faut produire.</p>
              </div>
            </div>

            <button onClick={() => setView('home')} className="flex items-center justify-center gap-3 rounded-[18px] border border-[#D9A72B] bg-[linear-gradient(180deg,#F3C63D_0%,#E3A91F_100%)] px-4 py-4 text-center text-sm font-black uppercase tracking-[0.12em] text-[#4D2B18] shadow-[0_4px_0_#B8810F] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#B8810F]">Retour accueil</button>

            <div className="rounded-[20px] border border-[#D7B79B] bg-[#FBF7F1] p-2 shadow-sm">
              <div className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Postes</div>
              <div className="flex gap-2 overflow-x-auto lg:flex-col">
                <button onClick={() => setActiveCategory('all')} className={`min-w-[126px] rounded-xl px-3 py-2.5 text-left text-xs font-black uppercase tracking-[0.06em] transition ${activeCategory === 'all' ? 'bg-[#091433] text-white shadow-lg' : 'border border-[#D7B79B] bg-white text-[#4D2B18]'}`}>Tous</button>
                {CATEGORY_ORDER.filter((category) => groupedRows.some((group) => group.category === category)).map((category) => (
                  <button key={category} onClick={() => setActiveCategory(category)} className={`min-w-[126px] rounded-xl px-3 py-2.5 text-left text-xs font-black uppercase tracking-[0.06em] transition ${activeCategory === category ? 'bg-[#091433] text-white shadow-lg' : 'border border-[#D7B79B] bg-white text-[#4D2B18]'}`}>{CATEGORY_LABELS[category]}</button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1">
          <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[24px] border border-[#D7B79B] bg-[#FAF5EE] shadow-[0_16px_32px_rgba(145,105,75,0.10)]">
            <div className="border-b border-[#B45439] bg-[linear-gradient(180deg,#A93E2A_0%,#912F20_55%,#782219_100%)] px-4 py-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FFE1B8]">Production du jour</div>
                  <h2 className="mt-1 text-[18px] font-black uppercase tracking-[0.08em] text-[#FFF8F1]">Pilotage terrain</h2>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 sm:min-w-[430px] xl:min-w-[460px]">
                  <label className="rounded-2xl border border-[#D9C7B7] bg-[#F8EEE5] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9A8C84]">Date</div>
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="mt-1 w-full bg-transparent text-[15px] font-black text-[#34271F] outline-none" />
                  </label>
                  <div className="rounded-2xl border border-[#D9C7B7] bg-[#F8EEE5] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9A8C84]">Prévi couverts</div>
                    <div className="mt-1 text-[18px] leading-none font-black text-[#0E1B42]">{coversForDay}</div>
                    <div className="mt-1 text-[10px] font-semibold text-[#8A7769]">{monthLabel ? `${monthLabel} • midi + soir` : 'Prévi journalière'}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-3">
              {groupedRows.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-semibold text-slate-500">
                  Aucune production enregistrée. Va dans <span className="font-black text-slate-800">Calcul prod ratio</span> pour créer tes lignes.
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleGroups.map((group) => (
                    <section key={group.category} className="overflow-hidden rounded-[20px] border border-[#D7B79B] bg-white shadow-sm">
                      <div className={`bg-gradient-to-r ${CATEGORY_BANNERS[group.category]} px-4 py-2.5 text-white`}>
                        <div className="text-[10px] uppercase tracking-[0.22em] font-black text-white/80">Mise en place</div>
                        <h3 className="text-[15px] font-black uppercase tracking-tight">{CATEGORY_LABELS[group.category]}</h3>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-sm">
                          <thead className="bg-[#F4E4D2] text-[#6C3C2B]">
                            <tr>
                              <th className="px-3 py-2 text-left text-[11px] font-black uppercase">Production</th>
                              <th className="w-[150px] px-3 py-2 text-center text-[11px] font-black uppercase">Besoin théo</th>
                              <th className="w-[120px] px-3 py-2 text-center text-[11px] font-black uppercase">Stock</th>
                              <th className="w-[150px] px-3 py-2 text-center text-[11px] font-black uppercase">À produire</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.rows.map((row, idx) => {
                              if (row.kind === 'base') {
                                return (
                                  <React.Fragment key={`${group.category}-${row.baseProduction}`}>
                                    <tr className={idx % 2 === 0 ? 'bg-[#FCF8F2]' : 'bg-[#F7EFE5]'}>
                                      <td className="border-t border-[#E0CCBA] px-3 py-2.5 align-middle">
                                        <div className="font-black uppercase text-[#4D2B18]">{row.baseProduction}</div>
                                        <div className="mt-0.5 text-[10px] font-semibold text-slate-500">Base recalculée selon les stocks portions • pas de stock base</div>
                                      </td>
                                      <td className="border-t border-[#E0CCBA] px-3 py-2.5 text-center text-[18px] font-black text-[#4D2B18]">{formatKg(row.theoreticalKg)}</td>
                                      <td className="border-t border-[#E0CCBA] px-3 py-2.5 text-center text-[11px] font-bold text-slate-400">—</td>
                                      <td className="border-t border-[#E0CCBA] px-3 py-2.5 text-center">
                                        <span className="inline-flex min-w-[86px] items-center justify-center rounded-xl bg-[#A93E2A] px-3 py-1.5 text-[18px] leading-none font-black text-white">{formatKg(row.toProduceKg)}</span>
                                      </td>
                                    </tr>

                                    {row.children.map((child, childIdx) => (
                                      <tr key={`${row.baseProduction}-${child.label}-${childIdx}`} className={childIdx % 2 === 0 ? 'bg-[#FFF9F3]' : 'bg-[#FBF2E8]'}>
                                        <td className="border-t border-[#EAD9C9] px-3 py-2.5 align-middle">
                                          <div className="pl-4 font-black uppercase text-[#6A4A37]">— {child.label}</div>
                                          <div className="mt-0.5 pl-4 text-[10px] font-semibold text-slate-500">{getWindowLabel(child.maxDlcHours)}</div>
                                          {child.notes ? <div className="mt-0.5 pl-4 text-[10px] font-semibold text-slate-500">{child.notes}</div> : null}
                                        </td>
                                        <td className="border-t border-[#EAD9C9] px-3 py-2.5 text-center text-[18px] font-black text-[#6A4A37]">{child.need.toFixed(1)}</td>
                                        <td className="border-t border-[#EAD9C9] px-3 py-2.5 text-center">
                                          <input type="number" min={0} value={child.stock} onChange={(e) => setStockValue(child.stockKey, Number(e.target.value || 0))} className="w-[72px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2 py-1.5 text-center font-black outline-none" />
                                        </td>
                                        <td className="border-t border-[#EAD9C9] px-3 py-2.5 text-center">
                                          <span className="inline-flex min-w-[60px] items-center justify-center rounded-xl bg-[#C98C57] px-3 py-1.5 text-[18px] leading-none font-black text-white">{child.toProduce}</span>
                                        </td>
                                      </tr>
                                    ))}
                                  </React.Fragment>
                                );
                              }

                              return (
                                <tr key={`${row.label}-${idx}`} className={idx % 2 === 0 ? 'bg-[#FCF8F2]' : 'bg-[#F7EFE5]'}>
                                  <td className="border-t border-[#E0CCBA] px-3 py-2.5 align-middle">
                                    <div className="font-black uppercase text-[#4D2B18]">{row.label}</div>
                                    <div className="mt-0.5 text-[10px] font-semibold text-slate-500">{getWindowLabel(row.maxDlcHours)}</div>
                                    {row.notes ? <div className="mt-0.5 text-[10px] font-semibold text-slate-500">{row.notes}</div> : null}
                                  </td>
                                  <td className="border-t border-[#E0CCBA] px-3 py-2.5 text-center text-[20px] font-black text-[#4D2B18]">{row.need.toFixed(1)}</td>
                                  <td className="border-t border-[#E0CCBA] px-3 py-2.5 text-center">
                                    <input type="number" min={0} value={row.stock} onChange={(e) => setStockValue(row.stockKey, Number(e.target.value || 0))} className="w-[72px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2 py-1.5 text-center font-black outline-none" />
                                  </td>
                                  <td className="border-t border-[#E0CCBA] px-3 py-2.5 text-center">
                                    <span className="inline-flex min-w-[60px] items-center justify-center rounded-xl bg-[#A93E2A] px-3 py-1.5 text-[20px] leading-none font-black text-white">{row.toProduce}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default PrepSheetPage;
