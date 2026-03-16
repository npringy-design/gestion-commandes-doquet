import React from 'react';
import { type View } from '../constants';
import type { PrepCategory, PrepItem } from '../types';

const CATEGORY_ORDER: PrepCategory[] = ['poste_chaud', 'poste_entree', 'poste_dessert', 'decongelation'];
const CATEGORY_LABELS: Record<PrepCategory, string> = {
  poste_chaud: 'Poste chaud',
  poste_entree: 'Poste entrée',
  poste_dessert: 'Poste dessert',
  decongelation: 'Décongélation',
};

const CATEGORY_ACCENTS: Record<PrepCategory, string> = {
  poste_chaud: 'from-[#A93E2A] to-[#7E261A]',
  poste_entree: 'from-[#8A5A2F] to-[#6E421E]',
  poste_dessert: 'from-[#9B3F7A] to-[#6E2455]',
  decongelation: 'from-[#2F6F8A] to-[#1E4E68]',
};

interface PrepSheetPageProps {
  setView: (v: View) => void;
  prepItems: PrepItem[];
  dailyCovers: Record<string, number>;
}

const dateKey = (date: string) => {
  if (!date) return '';
  const [y, m, d] = date.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
};

const PrepSheetPage: React.FC<PrepSheetPageProps> = ({ setView, prepItems, dailyCovers }) => {
  const [selectedDate, setSelectedDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [activeCategory, setActiveCategory] = React.useState<PrepCategory | 'all'>('all');
  const coversForDay = Number(dailyCovers[dateKey(selectedDate)] || 0);

  const groupedRows = React.useMemo(() => {
    const activeItems = prepItems;

    return CATEGORY_ORDER.map((category) => ({
      category,
      rows: activeItems
        .filter((item) => item.category === category)
        .map((item) => {
          const ratios = Object.values(item.ratioHistory || {}).filter((value) => Number(value) > 0);
          const ratio = ratios.length ? ratios.reduce((sum, value) => sum + Number(value), 0) / ratios.length : 0;
          const need = ratio * coversForDay;
          const toProduce = Math.max(0, Math.ceil(need));
          return { item, ratio, need, toProduce };
        }),
    })).filter((group) => group.rows.length > 0);
  }, [coversForDay, prepItems]);

  const visibleGroups = React.useMemo(() => {
    if (activeCategory === 'all') return groupedRows;
    return groupedRows.filter((group) => group.category === activeCategory);
  }, [activeCategory, groupedRows]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#F6EFE6_0%,#F2E8DD_45%,#EBDDCE_100%)] text-[#34271F]">
      <div className="mx-auto max-w-[1800px] p-3 md:p-4 xl:p-5">
        <div className="mb-4 rounded-[30px] border border-[#D7B79B] bg-white p-5 shadow-[0_16px_30px_rgba(145,105,75,0.08)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.32em] text-[#15A06B]">Production terrain</div>
              <h1 className="mt-2 text-4xl font-black uppercase tracking-tight text-[#0E1B42]">Feuille de mise en place</h1>
              <p className="mt-3 text-sm font-semibold text-slate-500">Page opérationnelle simplifiée : uniquement les productions actives et le besoin du jour.</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button onClick={() => setView('home')} className="rounded-2xl bg-[#091433] px-6 py-4 text-sm font-black uppercase tracking-[0.08em] text-white shadow-lg">Accueil</button>
            </div>
          </div>
        </div>

        <div className="mb-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-[26px] border border-[#D7B79B] bg-white p-4 shadow-sm">
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Date</div>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xl font-black outline-none" />
          </div>

          <div className="rounded-[26px] border border-[#D7B79B] bg-white p-4 shadow-sm">
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Prévi du jour</div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-3xl font-black text-[#0E1B42]">{coversForDay}</div>
            <div className="mt-3 text-xs font-semibold text-slate-500">Valeur récupérée automatiquement depuis le journalier.</div>
          </div>

        </div>
        </div>

        {groupedRows.length === 0 ? (
          <div className="rounded-[26px] border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 font-semibold">Aucune production enregistrée. Va dans <span className="font-black text-slate-800">Calcul prod ratio</span> pour créer tes lignes.</div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="rounded-[28px] border border-[#D7B79B] bg-white p-3 shadow-sm">
              <div className="mb-3 px-2 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Sections</div>
              <div className="flex gap-2 overflow-x-auto xl:flex-col">
                <button onClick={() => setActiveCategory('all')} className={`min-w-[140px] rounded-2xl px-4 py-3 text-left text-sm font-black uppercase tracking-[0.08em] transition ${activeCategory === 'all' ? 'bg-[#091433] text-white shadow-lg' : 'border border-[#D7B79B] bg-[#FCF8F2] text-[#4D2B18]'}`}>Tous les postes</button>
                {CATEGORY_ORDER.filter((category) => groupedRows.some((group) => group.category === category)).map((category) => (
                  <button key={category} onClick={() => setActiveCategory(category)} className={`min-w-[140px] rounded-2xl px-4 py-3 text-left text-sm font-black uppercase tracking-[0.08em] transition ${activeCategory === category ? 'bg-[#091433] text-white shadow-lg' : 'border border-[#D7B79B] bg-[#FCF8F2] text-[#4D2B18]'}`}>
                    {CATEGORY_LABELS[category]}
                  </button>
                ))}
              </div>
            </aside>

            <div>
              {visibleGroups.map((group) => (
          <section key={group.category} className="mb-5 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className={`bg-gradient-to-r ${CATEGORY_ACCENTS[group.category]} px-5 py-4 text-white`}>
              <div className="text-[10px] uppercase tracking-[0.24em] font-black text-white/80">Mise en place</div>
              <h2 className="text-2xl font-black uppercase tracking-tight">{CATEGORY_LABELS[group.category]}</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="bg-[#F4E4D2] text-[#6C3C2B]">
                  <tr>
                    <th className="px-4 py-3 text-left font-black uppercase">Production</th>
                    <th className="px-4 py-3 text-center font-black uppercase">Ratio</th>
                    <th className="px-4 py-3 text-center font-black uppercase">Besoin théo</th>
                    <th className="px-4 py-3 text-center font-black uppercase">À produire</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row, idx) => (
                    <tr key={row.item.id} className={idx % 2 === 0 ? 'bg-[#FCF8F2]' : 'bg-[#F7EFE5]'}>
                      <td className="border-t border-[#E0CCBA] px-4 py-4 align-top">
                        <div className="font-black uppercase text-[#4D2B18]">{row.item.name}</div>
                        {row.item.notes ? <div className="mt-1 text-[11px] font-semibold text-slate-500">{row.item.notes}</div> : null}
                      </td>
                      <td className="border-t border-[#E0CCBA] px-4 py-4 text-center font-black">{row.ratio.toFixed(3)}</td>
                      <td className="border-t border-[#E0CCBA] px-4 py-4 text-center font-black">{row.need.toFixed(1)}</td>
                      <td className="border-t border-[#E0CCBA] px-4 py-4 text-center">
                        <span className="inline-flex min-w-[120px] items-center justify-center rounded-2xl bg-[#A93E2A] px-5 py-2 text-lg font-black text-white">{row.toProduce}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrepSheetPage;
