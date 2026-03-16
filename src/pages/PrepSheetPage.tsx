import React from 'react';
import { MONTHS_ORDER, type View } from '../constants';
import type { PrepCategory, PrepImportsByMonth, PrepItem } from '../types';
import { getImportedValueForProduct } from '../utils/csvHelpers';

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

interface PrepSheetPageProps {
  setView: (v: View) => void;
  prepItems: PrepItem[];
  dailyCovers: Record<string, number>;
  covers: Record<string, number>;
  prepImportsByMonth: PrepImportsByMonth;
}

const dateKey = (date: string) => {
  if (!date) return '';
  const [y, m, d] = date.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
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

    const imported = getImportedValueForProduct(
      prepImportsByMonth[month],
      item.searchName,
      item.importDivisor,
      ['Nombre']
    );

    if (Number(imported) > 0) {
      total += Number(imported) / coversValue;
      count += 1;
    }
  });

  return count > 0 ? total / count : 0;
};

const PrepSheetPage: React.FC<PrepSheetPageProps> = ({ setView, prepItems, dailyCovers, covers, prepImportsByMonth }) => {
  const [selectedDate, setSelectedDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [activeCategory, setActiveCategory] = React.useState<PrepCategory | 'all'>('all');

  const coversForDay = Number(dailyCovers[dateKey(selectedDate)] || 0);

  const groupedRows = React.useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      rows: prepItems
        .filter((item) => item.category === category)
        .map((item) => {
          const averageRatio = getAverageRatio(item, covers, prepImportsByMonth);
          const need = averageRatio * coversForDay;
          const buffer = Number(item.targetBuffer || 0);
          const toProduce = Math.max(0, Math.ceil(need + buffer));
          return { item, need, toProduce };
        }),
    })).filter((group) => group.rows.length > 0);
  }, [covers, coversForDay, prepImportsByMonth, prepItems]);

  const visibleGroups = React.useMemo(() => {
    if (activeCategory === 'all') return groupedRows;
    return groupedRows.filter((group) => group.category === activeCategory);
  }, [activeCategory, groupedRows]);

  return (
    <div className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#F6EFE6_0%,#F2E8DD_45%,#EBDDCE_100%)] text-[#34271F]">
      <div className="mx-auto flex h-screen max-w-[1760px] flex-col gap-3 p-2 lg:flex-row lg:gap-3 lg:p-3">
        <aside className="w-full shrink-0 lg:w-[230px] xl:w-[240px]">
          <div className="flex h-full flex-col gap-3">
            <div className="overflow-hidden rounded-[22px] border border-[#B46E58] bg-[linear-gradient(135deg,#A93E2A_0%,#922F20_48%,#7A231A_100%)] shadow-[0_10px_20px_rgba(122,35,26,0.14)]">
              <div className="h-1.5 bg-gradient-to-r from-[#F1C15A] via-[#D86A2C] to-[#A93E2A]" />
              <div className="p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FFE1B8]">Hippopotamus Thillois</p>
                <h1 className="mt-2 text-[20px] font-black leading-none text-[#FFF9F3] xl:text-[22px]">Feuille de mise en place</h1>
                <p className="mt-3 text-[12px] font-semibold leading-5 text-[#FFE7CF]">Vue terrain simple par poste, centrée sur le besoin de production du jour.</p>
              </div>
            </div>

            <button onClick={() => setView('home')} className="flex items-center justify-center gap-3 rounded-[18px] border border-[#D9A72B] bg-[linear-gradient(180deg,#F3C63D_0%,#E3A91F_100%)] px-4 py-4 text-center text-sm font-black uppercase tracking-[0.12em] text-[#4D2B18] shadow-[0_4px_0_#B8810F] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#B8810F]">Retour accueil</button>

            <div className="rounded-[20px] border border-[#D7B79B] bg-[#FBF7F1] p-2 shadow-sm">
              <div className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Postes</div>
              <div className="flex gap-2 overflow-x-auto lg:flex-col">
                <button onClick={() => setActiveCategory('all')} className={`min-w-[126px] rounded-xl px-3 py-2.5 text-left text-xs font-black uppercase tracking-[0.06em] transition ${activeCategory === 'all' ? 'bg-[#091433] text-white shadow-lg' : 'border border-[#D7B79B] bg-white text-[#4D2B18]'}`}>Tous</button>
                {CATEGORY_ORDER.filter((category) => groupedRows.some((group) => group.category === category)).map((category) => (
                  <button key={category} onClick={() => setActiveCategory(category)} className={`min-w-[126px] rounded-xl px-3 py-2.5 text-left text-xs font-black uppercase tracking-[0.06em] transition ${activeCategory === category ? 'bg-[#091433] text-white shadow-lg' : 'border border-[#D7B79B] bg-white text-[#4D2B18]'}`}>
                    {CATEGORY_LABELS[category]}
                  </button>
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
                  <label className="rounded-2xl border border-white/15 bg-white/92 px-3 py-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Date</div>
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="mt-1 w-full bg-transparent text-[15px] font-black text-[#34271F] outline-none" />
                  </label>
                  <div className="rounded-2xl border border-white/15 bg-white/92 px-3 py-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Prévi couverts</div>
                    <div className="mt-1 text-[18px] leading-none font-black text-[#0E1B42]">{coversForDay}</div>
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
                        <table className="w-full min-w-[460px] text-sm">
                          <thead className="bg-[#F4E4D2] text-[#6C3C2B]">
                            <tr>
                              <th className="px-3 py-2 text-left text-[11px] font-black uppercase">Production</th>
                              <th className="w-[160px] px-3 py-2 text-center text-[11px] font-black uppercase">Besoin théo</th>
                              <th className="w-[170px] px-3 py-2 text-center text-[11px] font-black uppercase">À produire</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.rows.map((row, idx) => (
                              <tr key={row.item.id} className={idx % 2 === 0 ? 'bg-[#FCF8F2]' : 'bg-[#F7EFE5]'}>
                                <td className="border-t border-[#E0CCBA] px-3 py-3 align-middle">
                                  <div className="font-black uppercase text-[#4D2B18]">{row.item.name}</div>
                                  {row.item.notes ? <div className="mt-0.5 text-[10px] font-semibold text-slate-500">{row.item.notes}</div> : null}
                                </td>
                                <td className="border-t border-[#E0CCBA] px-3 py-3 text-center text-[22px] font-black text-[#4D2B18]">{row.need.toFixed(1)}</td>
                                <td className="border-t border-[#E0CCBA] px-3 py-3 text-center">
                                  <span className="inline-flex min-w-[66px] items-center justify-center rounded-xl bg-[#A93E2A] px-3 py-1.5 text-[22px] leading-none font-black text-white">{row.toProduce}</span>
                                </td>
                              </tr>
                            ))}
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
