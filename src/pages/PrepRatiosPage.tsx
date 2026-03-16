import React from 'react';
import { MONTHS_ORDER, type View } from '../constants';
import type { PrepCategory, PrepImportsByMonth, PrepItem } from '../types';
import { useAuth } from '../auth/AuthProvider';
import { canEditRatios } from '../lib/permissions';
import MappingPopover from '../components/MappingPopover';
import { extractAllNamesFromCsvs, getImportedValueForProduct } from '../utils/csvHelpers';

const CATEGORY_OPTIONS: Array<{ value: PrepCategory; label: string }> = [
  { value: 'poste_chaud', label: 'Poste chaud' },
  { value: 'poste_entree', label: 'Poste entrée' },
  { value: 'poste_dessert', label: 'Poste dessert' },
  { value: 'decongelation', label: 'Décongélation' },
];

const MONTH_LABELS: Record<string, string> = {
  jan: 'Jan', feb: 'Fév', mar: 'Mar', apr: 'Avr', may: 'Mai', jun: 'Jun',
  jul: 'Jul', aug: 'Aoû', sep: 'Sep', oct: 'Oct', nov: 'Nov', dec: 'Déc',
};

interface PrepRatiosPageProps {
  setView: (v: View) => void;
  covers: Record<string, number>;
  validatedMonths: Record<string, boolean>;
  prepItems: PrepItem[];
  setPrepItems: React.Dispatch<React.SetStateAction<PrepItem[]>>;
  prepImportsByMonth: PrepImportsByMonth;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const defaultItem = (): PrepItem => ({
  id: `prep-${uid()}`,
  name: 'Nouvelle production',
  searchName: '',
  importDivisor: '',
  category: 'poste_chaud',
  ratioHistory: {},
  secondaryDlcHours: 24,
  targetBuffer: '',
  notes: '',
});

const PrepRatiosPage: React.FC<PrepRatiosPageProps> = ({
  setView,
  covers,
  validatedMonths,
  prepItems,
  setPrepItems,
  prepImportsByMonth,
}) => {
  const { profile } = useAuth();
  const canEdit = canEditRatios(profile);
  const [search, setSearch] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [activeMappingId, setActiveMappingId] = React.useState<string | null>(null);

  const allAvailableImportNames = React.useMemo(
    () => extractAllNamesFromCsvs(prepImportsByMonth),
    [prepImportsByMonth]
  );

  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return prepItems.filter((item) => {
      if (!q) return true;
      return item.name.toLowerCase().includes(q) || item.searchName.toLowerCase().includes(q);
    });
  }, [prepItems, search]);

  const updateItem = (id: string, patch: Partial<PrepItem>) => {
    setPrepItems((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const moveItem = (id: string, direction: 'up' | 'down') => {
    setPrepItems((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index === -1) return prev;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addItem = () => setPrepItems((prev) => [...prev, defaultItem()]);
  const deleteSelected = () => {
    if (selectedIds.size === 0) return;
    setPrepItems((prev) => prev.filter((item) => !selectedIds.has(item.id)));
    setSelectedIds(new Set());
  };

  const getMonthValue = (item: PrepItem, month: string) => {
    const imported = getImportedValueForProduct(
      prepImportsByMonth[month],
      item.searchName,
      item.importDivisor,
      ['Nombre']
    );
    return imported ?? 0;
  };

  const getMonthRatio = (item: PrepItem, month: string) => {
    const coversValue = Number(covers[month] || 0);
    if (!coversValue) return 0;
    if (validatedMonths[month] && Number(item.ratioHistory[month] || 0) > 0) return Number(item.ratioHistory[month] || 0);
    const imported = getMonthValue(item, month);
    return imported > 0 ? imported / coversValue : 0;
  };

  const getAverageRatio = (item: PrepItem) => {
    let total = 0;
    let count = 0;
    MONTHS_ORDER.forEach((month) => {
      const ratio = getMonthRatio(item, month);
      if (ratio > 0) {
        total += ratio;
        count += 1;
      }
    });
    return count > 0 ? total / count : 0;
  };

  const toggleValidateMonth = (month: string) => {
    setPrepItems((prev) => prev.map((item) => ({
      ...item,
      ratioHistory: {
        ...item.ratioHistory,
        [month]: getMonthRatio(item, month),
      },
    })));
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#F6EFE6_0%,#F2E8DD_45%,#EBDDCE_100%)] text-[#34271F]">
      <div className="mx-auto flex h-screen max-w-[1920px] flex-col gap-3 p-2 sm:p-3 lg:flex-row lg:gap-4 lg:p-3">
        <aside className="w-full shrink-0 lg:w-[280px]">
          <div className="flex flex-col gap-3 lg:sticky lg:top-3">
            <div className="overflow-hidden rounded-[24px] border border-[#B46E58] bg-[linear-gradient(135deg,#A93E2A_0%,#922F20_48%,#7A231A_100%)] shadow-[0_10px_20px_rgba(122,35,26,0.14)]">
              <div className="h-1.5 bg-gradient-to-r from-[#F1C15A] via-[#D86A2C] to-[#A93E2A]" />
              <div className="p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FFE1B8]">Hippopotamus Thillois</p>
                <h1 className="mt-2 text-2xl font-black leading-none text-[#FFF9F3] xl:text-3xl">Calcul prod ratio</h1>
                <p className="mt-3 text-xs font-semibold text-[#FFE7CF]">Crée ici tes productions maison, mappe l'import production, puis la feuille de mise en place reprend automatiquement toutes les lignes créées.</p>
              </div>
            </div>

            <button onClick={() => setView('stats')} className="flex items-center justify-center gap-3 rounded-[20px] border border-[#D9A72B] bg-[linear-gradient(180deg,#F3C63D_0%,#E3A91F_100%)] px-4 py-4 text-center text-sm font-black uppercase tracking-[0.12em] text-[#4D2B18] shadow-[0_4px_0_#B8810F] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#B8810F]">Retour paramètres</button>
            <button onClick={() => setView('prep_sheet')} className="rounded-[20px] border border-[#2E8D63] bg-[linear-gradient(180deg,#39B37D_0%,#239062_100%)] px-4 py-5 text-center text-xs font-black uppercase tracking-[0.14em] text-white shadow-[0_4px_0_#196A48] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#196A48]">Ouvrir feuille de mise en place</button>
            <button onClick={addItem} disabled={!canEdit} className="rounded-[20px] border border-slate-300 bg-white px-4 py-4 text-sm font-black uppercase tracking-[0.12em] text-slate-700 shadow-sm disabled:opacity-50">Ajouter une production</button>
            <button onClick={deleteSelected} disabled={!canEdit || selectedIds.size === 0} className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-4 text-sm font-black uppercase tracking-[0.12em] text-red-700 shadow-sm disabled:opacity-50">Supprimer la sélection</button>
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1">
          <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[28px] border border-[#D7B79B] bg-[#FAF5EE] shadow-[0_16px_32px_rgba(145,105,75,0.10)]">
            <div className="border-b border-[#B45439] bg-[linear-gradient(180deg,#A93E2A_0%,#912F20_55%,#782219_100%)] px-5 py-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <h2 className="text-xl font-black uppercase tracking-[0.08em] text-[#FFF8F1]">Productions & ratios</h2>
                <div className="flex flex-wrap gap-2">
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une production..." className="rounded-2xl border border-white/20 bg-white/95 px-4 py-2 text-sm font-bold text-slate-800 outline-none" />
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="min-w-[1480px] w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[#F4E4D2] text-[#6C3C2B]">
                  <tr>
                    <th className="px-4 py-3 text-left font-black uppercase">Sel.</th>
                    <th className="px-2 py-3 text-left font-black uppercase">Production</th>
                    <th className="px-2 py-3 text-left font-black uppercase">Poste</th>
                    <th className="px-2 py-3 text-left font-black uppercase">Mapping import</th>
                    <th className="px-4 py-3 text-center font-black uppercase">÷</th>
                    {MONTHS_ORDER.map((month) => <th key={month} className="px-3 py-3 text-center font-black uppercase">{MONTH_LABELS[month]}</th>)}
                    <th className="px-4 py-3 text-center font-black uppercase">Ratio moy.</th>
                    <th className="px-3 py-3 text-center font-black uppercase">DLC</th>
                    <th className="px-3 py-3 text-center font-black uppercase">Buffer</th>
                    <th className="px-2 py-3 text-left font-black uppercase">Notes</th>
                    <th className="px-4 py-3 text-center font-black uppercase">Ordre</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item, idx) => {
                    const avgRatio = getAverageRatio(item);
                    const alert = !item.searchName.trim() || !Array.from(allAvailableImportNames).map((n) => n.trim().toLowerCase()).includes(item.searchName.trim().toLowerCase());
                    return (
                      <tr key={item.id} className={idx % 2 === 0 ? 'bg-[#FCF8F2]' : 'bg-[#F7EFE5]'}>
                        <td className="border-t border-[#E0CCBA] px-4 py-3 text-center"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelected(item.id)} className="h-5 w-5" /></td>
                        <td className="border-t border-[#E0CCBA] px-2 py-3"><input value={item.name} disabled={!canEdit} onChange={(e) => updateItem(item.id, { name: e.target.value })} className="w-[170px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-3 py-2 font-black outline-none" /></td>
                        <td className="border-t border-[#E0CCBA] px-2 py-3">
                          <select value={item.category} disabled={!canEdit} onChange={(e) => updateItem(item.id, { category: e.target.value as PrepCategory })} className="w-[132px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2 py-2 font-bold outline-none">
                            {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </td>
                        <td className="border-t border-[#E0CCBA] px-2 py-3">
                          <div className="relative flex items-center gap-1 min-w-[180px]">
                            <input value={item.searchName} disabled={!canEdit} onChange={(e) => updateItem(item.id, { searchName: e.target.value })} placeholder="nom dans le fichier import" className={`flex-1 rounded-xl border px-2 py-2 text-xs font-bold outline-none ${alert ? 'border-amber-300 text-amber-700 bg-amber-50' : 'border-[#D0B08D] bg-[#FFFDF9]'}`} />
                            <button onClick={() => setActiveMappingId(activeMappingId === item.id ? null : item.id)} className="h-10 w-10 rounded-xl bg-slate-100 text-slate-600">⌄</button>
                            {activeMappingId === item.id && (
                              <div className="absolute left-0 top-full z-[999] mt-1">
                                <MappingPopover
                                  orphanNames={Array.from(allAvailableImportNames).filter((name) => {
                                    const normalized = name.trim().toLowerCase();
                                    return !prepItems.some((other) => other.id !== item.id && other.searchName.trim().toLowerCase() === normalized);
                                  })}
                                  onSelect={(name) => { updateItem(item.id, { searchName: name }); setActiveMappingId(null); }}
                                  onClose={() => setActiveMappingId(null)}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="border-t border-[#E0CCBA] px-4 py-3"><input type="number" value={item.importDivisor ?? ''} disabled={!canEdit} onChange={(e) => updateItem(item.id, { importDivisor: e.target.value === '' ? '' : Number(e.target.value) || '' })} className="w-[62px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2 py-2 text-center font-black outline-none" /></td>
                        {MONTHS_ORDER.map((month) => {
                          const monthValue = getMonthValue(item, month);
                          const monthRatio = getMonthRatio(item, month);
                          return (
                            <td key={`${item.id}-${month}`} className="border-t border-[#E0CCBA] px-2 py-3 text-center">
                              <div className={`rounded-lg p-1.5 ${validatedMonths[month] ? 'bg-indigo-50 border border-indigo-100' : monthValue > 0 ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                                <div className={`font-black text-xs leading-none ${validatedMonths[month] ? 'text-indigo-800' : monthValue > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>{monthValue || '–'}</div>
                                <div className="mt-1 text-[10px] font-mono text-slate-500">{monthRatio.toFixed(3)}</div>
                              </div>
                            </td>
                          );
                        })}
                        <td className="border-t border-[#E0CCBA] px-4 py-3 text-center font-black text-[#A93E2A]">{avgRatio.toFixed(3)}</td>
                        <td className="border-t border-[#E0CCBA] px-4 py-3"><input type="number" value={item.secondaryDlcHours} disabled={!canEdit} onChange={(e) => updateItem(item.id, { secondaryDlcHours: e.target.value === '' ? '' : Number(e.target.value) || '' })} className="w-[68px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2 py-2 text-center font-black outline-none" /></td>
                        <td className="border-t border-[#E0CCBA] px-4 py-3"><input type="number" value={item.targetBuffer} disabled={!canEdit} onChange={(e) => updateItem(item.id, { targetBuffer: e.target.value === '' ? '' : Number(e.target.value) || '' })} className="w-[68px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2 py-2 text-center font-black outline-none" /></td>
                        <td className="border-t border-[#E0CCBA] px-4 py-3"><input value={item.notes || ''} disabled={!canEdit} onChange={(e) => updateItem(item.id, { notes: e.target.value })} className="w-[120px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-3 py-2 font-semibold outline-none" /></td>
                        <td className="border-t border-[#E0CCBA] px-4 py-3">
                          <div className="flex gap-2 justify-center">
                            <button onClick={() => moveItem(item.id, 'up')} disabled={!canEdit || idx === 0} className="h-9 w-9 rounded-xl bg-slate-900 text-[#ffd700] disabled:opacity-20">↑</button>
                            <button onClick={() => moveItem(item.id, 'down')} disabled={!canEdit || idx === rows.length - 1} className="h-9 w-9 rounded-xl bg-slate-900 text-[#ffd700] disabled:opacity-20">↓</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr><td colSpan={18} className="px-6 py-10 text-center text-sm font-semibold text-slate-500">Aucune production. Ajoute d'abord tes lignes ici, puis importe tes fichiers production dans Paramètres.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default PrepRatiosPage;
