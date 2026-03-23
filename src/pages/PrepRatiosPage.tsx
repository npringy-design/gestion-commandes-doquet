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

const MAPPING_SEPARATOR = ' || ';

interface PrepRatiosPageProps {
  setView: (v: View) => void;
  covers: Record<string, number>;
  prepValidatedMonths?: Record<string, boolean>;
  togglePrepValidateMonth?: (month: string) => void;
  prepItems: PrepItem[];
  setPrepItems: React.Dispatch<React.SetStateAction<PrepItem[]>>;
  prepImportsByMonth: PrepImportsByMonth;
}

type PrepItemExtended = PrepItem & {
  baseProduction?: string;
  unitWeightGrams?: number | '';
};

type MonthStat = { value: number; ratio: number };
type MonthStatsById = Record<string, Record<string, MonthStat>>;

const uid = () => Math.random().toString(36).slice(2, 10);

const defaultItem = (): PrepItemExtended => ({
  id: `prep-${uid()}`,
  name: 'Nouvelle production',
  searchName: '',
  category: 'poste_chaud',
  isActive: true,
  ratioHistory: {},
  secondaryDlcHours: 24,
  targetBuffer: '',
  notes: '',
  baseProduction: '',
  unitWeightGrams: '',
});

const getBaseProduction = (item: PrepItem) => String((item as PrepItemExtended).baseProduction || '');
const getUnitWeight = (item: PrepItem) => (item as PrepItemExtended).unitWeightGrams ?? '';
const normalizeName = (value?: string) => String(value || '').trim().toLowerCase();

const parseMappingNames = (value?: string) =>
  String(value || '')
    .split(MAPPING_SEPARATOR)
    .map((name) => name.trim())
    .filter(Boolean);

const joinMappingNames = (names: string[]) =>
  Array.from(new Map(names.map((name) => [normalizeName(name), name.trim()])).values()).join(MAPPING_SEPARATOR);

const LocalTextInput = React.memo(function LocalTextInput({
  value,
  onCommit,
  disabled,
  className,
  placeholder,
}: {
  value: string;
  onCommit: (value: string) => void;
  disabled?: boolean;
  className: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = React.useState(value);

  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = React.useCallback(() => {
    if (draft !== value) onCommit(draft);
  }, [draft, value, onCommit]);

  return (
    <input
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
      className={className}
    />
  );
});

const LocalNumberInput = React.memo(function LocalNumberInput({
  value,
  onCommit,
  disabled,
  className,
  placeholder,
}: {
  value: number | '';
  onCommit: (value: number | '') => void;
  disabled?: boolean;
  className: string;
  placeholder?: string;
}) {
  const stringValue = value === '' || value === undefined || value === null ? '' : String(value);
  const [draft, setDraft] = React.useState(stringValue);

  React.useEffect(() => {
    setDraft(stringValue);
  }, [stringValue]);

  const commit = React.useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      if (stringValue !== '') onCommit('');
      return;
    }
    const parsed = Number(trimmed.replace(',', '.'));
    const next: number | '' = Number.isFinite(parsed) ? parsed : '';
    if (String(next) !== stringValue) onCommit(next);
  }, [draft, stringValue, onCommit]);

  return (
    <input
      type="number"
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
      className={className}
    />
  );
});

const PrepRatiosPage: React.FC<PrepRatiosPageProps> = ({
  setView,
  covers,
  prepValidatedMonths = {},
  togglePrepValidateMonth,
  prepItems,
  setPrepItems,
  prepImportsByMonth,
}) => {
  const { profile } = useAuth();
  const canEdit = canEditRatios(profile);
  const [search, setSearch] = React.useState('');
  const deferredSearch = React.useDeferredValue(search);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [activeMappingId, setActiveMappingId] = React.useState<string | null>(null);

  const allAvailableImportNames = React.useMemo(
    () => Array.from(extractAllNamesFromCsvs(prepImportsByMonth)).sort((a, b) => a.localeCompare(b)),
    [prepImportsByMonth]
  );

  const rows = React.useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return prepItems.filter((item) => {
      if (!q) return true;
      return item.name.toLowerCase().includes(q)
        || item.searchName.toLowerCase().includes(q)
        || getBaseProduction(item).toLowerCase().includes(q);
    });
  }, [prepItems, deferredSearch]);

  const updateItem = React.useCallback((id: string, patch: Partial<PrepItemExtended>) => {
    setPrepItems((prev) => prev.map((item) => item.id === id ? ({ ...item, ...patch } as PrepItem) : item));
  }, [setPrepItems]);

  const addMappingName = React.useCallback((item: PrepItem, name: string) => {
    const current = parseMappingNames(item.searchName);
    updateItem(item.id, { searchName: joinMappingNames([...current, name]) });
  }, [updateItem]);

  const removeMappingName = React.useCallback((item: PrepItem, name: string) => {
    const normalizedToRemove = normalizeName(name);
    const current = parseMappingNames(item.searchName);
    updateItem(item.id, {
      searchName: joinMappingNames(current.filter((value) => normalizeName(value) !== normalizedToRemove)),
    });
  }, [updateItem]);

  const toggleSelected = React.useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const moveItem = React.useCallback((id: string, direction: 'up' | 'down') => {
    setPrepItems((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index === -1) return prev;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, [setPrepItems]);

  const addItem = React.useCallback(() => setPrepItems((prev) => [...prev, defaultItem() as PrepItem]), [setPrepItems]);

  const deleteSelected = React.useCallback(() => {
    if (selectedIds.size === 0) return;
    setPrepItems((prev) => prev.filter((item) => !selectedIds.has(item.id)));
    setSelectedIds(new Set());
  }, [selectedIds, setPrepItems]);

  const monthStatsById = React.useMemo<MonthStatsById>(() => {
    const stats: MonthStatsById = {};

    prepItems.forEach((item) => {
      const mappings = parseMappingNames(item.searchName);
      const rowStats: Record<string, MonthStat> = {};

      MONTHS_ORDER.forEach((month) => {
        let value = 0;
        if (mappings.length > 0) {
          value = mappings.reduce((sum, mappingName) => {
            const imported = getImportedValueForProduct(prepImportsByMonth[month], mappingName, '', ['Nombre']);
            return sum + Number(imported || 0);
          }, 0);
        }

        const coversValue = Number(covers[month] || 0);
        const lockedRatio = Number(item.ratioHistory[month] || 0);
        const ratio = prepValidatedMonths[month] && lockedRatio > 0
          ? lockedRatio
          : (coversValue > 0 && value > 0 ? value / coversValue : 0);

        rowStats[month] = { value, ratio };
      });

      stats[item.id] = rowStats;
    });

    return stats;
  }, [prepItems, prepImportsByMonth, covers, prepValidatedMonths]);

  const averageRatioById = React.useMemo<Record<string, number>>(() => {
    const result: Record<string, number> = {};
    prepItems.forEach((item) => {
      const rowStats = monthStatsById[item.id] || {};
      let total = 0;
      let count = 0;
      MONTHS_ORDER.forEach((month) => {
        const ratio = Number(rowStats[month]?.ratio || 0);
        if (ratio > 0) {
          total += ratio;
          count += 1;
        }
      });
      result[item.id] = count > 0 ? total / count : 0;
    });
    return result;
  }, [prepItems, monthStatsById]);

  const mappingUsageCount = React.useMemo(() => {
    const counts = new Map<string, number>();
    prepItems.forEach((item) => {
      parseMappingNames(item.searchName).forEach((name) => {
        const key = normalizeName(name);
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });
    return counts;
  }, [prepItems]);

  const availableNamesByRowId = React.useMemo(() => {
    const result: Record<string, string[]> = {};

    prepItems.forEach((item) => {
      const currentMappings = new Set(parseMappingNames(item.searchName).map(normalizeName));
      result[item.id] = allAvailableImportNames.filter((name) => {
        const key = normalizeName(name);
        const usage = mappingUsageCount.get(key) || 0;
        return currentMappings.has(key) || usage === 0;
      });
    });

    return result;
  }, [prepItems, allAvailableImportNames, mappingUsageCount]);

  return (
    <div className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#F6EFE6_0%,#F2E8DD_45%,#EBDDCE_100%)] text-[#34271F]">
      <div className="mx-auto flex h-screen max-w-[1920px] flex-col gap-3 p-2 sm:p-3 lg:flex-row lg:gap-4 lg:p-3">
        <aside className="w-full shrink-0 lg:w-[250px]">
          <div className="flex flex-col gap-3 lg:sticky lg:top-3">
            <div className="overflow-hidden rounded-[24px] border border-[#B46E58] bg-[linear-gradient(135deg,#A93E2A_0%,#922F20_48%,#7A231A_100%)] shadow-[0_10px_20px_rgba(122,35,26,0.14)]">
              <div className="h-1.5 bg-gradient-to-r from-[#F1C15A] via-[#D86A2C] to-[#A93E2A]" />
              <div className="p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FFE1B8]">Hippopotamus Thillois</p>
                <h1 className="mt-2 text-2xl font-black leading-none text-[#FFF9F3] xl:text-[28px]">Calcul prod ratio</h1>
                <p className="mt-3 text-xs font-semibold text-[#FFE7CF]">1 ligne = 1 nom final affiché. Tu peux ajouter plusieurs références import sur la même ligne.</p>
              </div>
            </div>

            <button onClick={() => setView('stats')} className="flex items-center justify-center gap-3 rounded-[20px] border border-[#D9A72B] bg-[linear-gradient(180deg,#F3C63D_0%,#E3A91F_100%)] px-4 py-4 text-center text-sm font-black uppercase tracking-[0.12em] text-[#4D2B18] shadow-[0_4px_0_#B8810F] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#B8810F]">Retour paramètres</button>
            <button onClick={() => setView('prep_sheet')} className="rounded-[20px] border border-[#2E8D63] bg-[linear-gradient(180deg,#39B37D_0%,#239062_100%)] px-4 py-4 text-center text-xs font-black uppercase tracking-[0.14em] text-white shadow-[0_4px_0_#196A48] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#196A48]">Ouvrir feuille de mise en place</button>
            <button onClick={addItem} disabled={!canEdit} className="rounded-[20px] border border-slate-300 bg-white px-4 py-4 text-sm font-black uppercase tracking-[0.12em] text-slate-700 shadow-sm disabled:opacity-50">Ajouter une production</button>
            <button onClick={deleteSelected} disabled={!canEdit || selectedIds.size === 0} className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-4 text-sm font-black uppercase tracking-[0.12em] text-red-700 shadow-sm disabled:opacity-50">Supprimer la sélection</button>
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1">
          <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[28px] border border-[#D7B79B] bg-[#FAF5EE] shadow-[0_16px_32px_rgba(145,105,75,0.10)]">
            <div className="border-b border-[#B45439] bg-[linear-gradient(180deg,#A93E2A_0%,#912F20_55%,#782219_100%)] px-5 py-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <h2 className="text-lg font-black uppercase tracking-[0.08em] text-[#FFF8F1]">Productions & ratios</h2>
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une production..." className="rounded-2xl border border-white/20 bg-white/95 px-4 py-2 text-sm font-bold text-slate-800 outline-none xl:w-[280px]" />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="min-w-[1660px] w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[#F4E4D2] text-[#6C3C2B]">
                  <tr>
                    <th className="px-3 py-2 text-left font-black uppercase">Sel.</th>
                    <th className="px-2 py-2 text-left font-black uppercase">Produit</th>
                    <th className="px-2 py-2 text-left font-black uppercase">Base</th>
                    <th className="px-2 py-2 text-left font-black uppercase">Poste</th>
                    <th className="px-2 py-2 text-left font-black uppercase">Recherche import</th>
                    <th className="px-2 py-2 text-center font-black uppercase">Poids g</th>
                    {MONTHS_ORDER.map((month) => <th key={month} className="px-2 py-2 text-center font-black uppercase">{MONTH_LABELS[month]}</th>)}
                    <th className="px-3 py-2 text-center font-black uppercase">Ratio moy.</th>
                    <th className="px-2 py-2 text-center font-black uppercase">DLC h</th>
                    <th className="px-2 py-2 text-center font-black uppercase">Buffer</th>
                    <th className="px-2 py-2 text-left font-black uppercase">Notes</th>
                    <th className="px-3 py-2 text-center font-black uppercase">Ordre</th>
                  </tr>
                  <tr className="border-t border-[#E8D6C6] bg-[#F8EBDD]">
                    <th colSpan={6} className="px-2 py-2 text-right text-[10px] font-black uppercase tracking-[0.14em] text-[#8A5A2F]">Figer mois prod</th>
                    {MONTHS_ORDER.map((month) => {
                      const locked = !!prepValidatedMonths[month];
                      return (
                        <th key={`freeze-${month}`} className="px-1 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => togglePrepValidateMonth?.(month)}
                            className={`rounded-xl px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] transition ${
                              locked
                                ? 'border border-emerald-700 bg-emerald-600 text-white'
                                : 'border border-amber-300 bg-white text-[#8A5A2F]'
                            }`}
                          >
                            {locked ? 'Figé' : 'Figer'}
                          </button>
                        </th>
                      );
                    })}
                    <th colSpan={5} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item, idx) => {
                    const currentMappings = parseMappingNames(item.searchName);
                    const rowAvailableNames = availableNamesByRowId[item.id] || [];
                    const canOpenMapping = rowAvailableNames.length > 0;
                    const monthStats = monthStatsById[item.id] || {};
                    const avgRatio = averageRatioById[item.id] || 0;

                    return (
                      <tr key={item.id} className={idx % 2 === 0 ? 'bg-[#FCF8F2]' : 'bg-[#F7EFE5]'}>
                        <td className="border-t border-[#E0CCBA] px-3 py-2 text-center"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelected(item.id)} className="h-4 w-4" /></td>
                        <td className="border-t border-[#E0CCBA] px-2 py-2">
                          <LocalTextInput
                            value={item.name}
                            disabled={!canEdit}
                            onCommit={(value) => updateItem(item.id, { name: value })}
                            className="w-[170px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-3 py-2 font-black outline-none"
                          />
                        </td>
                        <td className="border-t border-[#E0CCBA] px-2 py-2">
                          <LocalTextInput
                            value={getBaseProduction(item)}
                            disabled={!canEdit}
                            placeholder="Base mousse"
                            onCommit={(value) => updateItem(item.id, { baseProduction: value })}
                            className="w-[145px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-3 py-2 font-bold outline-none"
                          />
                        </td>
                        <td className="border-t border-[#E0CCBA] px-2 py-2">
                          <select value={item.category} disabled={!canEdit} onChange={(e) => updateItem(item.id, { category: e.target.value as PrepCategory })} className="w-[130px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2 py-2 font-bold outline-none">
                            {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </td>
                        <td className="border-t border-[#E0CCBA] px-2 py-2">
                          <div className="min-w-[290px] rounded-2xl border border-[#D0B08D] bg-[#FFFDF9] px-3 py-2">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={currentMappings.length === 0}
                                onClick={() => setActiveMappingId(activeMappingId === item.id ? null : item.id)}
                                className="h-8 w-8 rounded-xl border border-[#D0B08D] bg-white text-[#6C3C2B] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                ▶
                              </button>
                              <button
                                type="button"
                                disabled={!canOpenMapping}
                                onClick={() => canOpenMapping && setActiveMappingId(activeMappingId === item.id ? null : item.id)}
                                className="rounded-xl border border-[#D0B08D] bg-white px-5 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#7A3B23] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Ajouter
                              </button>
                              <span className="text-xs font-bold text-slate-500">
                                {currentMappings.length > 0 ? `${currentMappings.length} produit${currentMappings.length > 1 ? 's' : ''}` : 'Aucun produit lié'}
                              </span>
                            </div>
                            {activeMappingId === item.id && (
                              <div className="relative mt-2">
                                {currentMappings.length > 0 ? (
                                  <div className="mb-2 flex flex-wrap gap-1.5 rounded-xl border border-[#E6D5C7] bg-[#FAF5EE] p-2">
                                    {currentMappings.map((mapping) => (
                                      <span key={mapping} className="inline-flex items-center gap-1 rounded-full border border-[#D0B08D] bg-white px-2 py-1 text-[11px] font-bold text-[#5A3928]">
                                        {mapping}
                                        {canEdit ? (
                                          <button type="button" onClick={() => removeMappingName(item, mapping)} className="text-[#A93E2A]">×</button>
                                        ) : null}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                                {canOpenMapping ? (
                                  <MappingPopover
                                    orphanNames={rowAvailableNames}
                                    onSelect={(name) => { addMappingName(item, name); setActiveMappingId(item.id); }}
                                    onClose={() => setActiveMappingId(null)}
                                  />
                                ) : null}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="border-t border-[#E0CCBA] px-2 py-2">
                          <LocalNumberInput
                            value={getUnitWeight(item)}
                            disabled={!canEdit}
                            placeholder="100"
                            onCommit={(value) => updateItem(item.id, { unitWeightGrams: value })}
                            className="w-[68px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2 py-2 text-center font-black outline-none"
                          />
                        </td>
                        {MONTHS_ORDER.map((month) => {
                          const monthValue = Number(monthStats[month]?.value || 0);
                          const monthRatio = Number(monthStats[month]?.ratio || 0);
                          return (
                            <td key={`${item.id}-${month}`} className="border-t border-[#E0CCBA] px-1.5 py-2 text-center">
                              <div className={`rounded-lg p-1 ${prepValidatedMonths[month] ? 'bg-indigo-50 border border-indigo-100' : monthValue > 0 ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                                <div className={`font-black text-[11px] leading-none ${prepValidatedMonths[month] ? 'text-indigo-800' : monthValue > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>{monthValue || '–'}</div>
                                <div className="mt-1 text-[9px] font-mono text-slate-500">{monthRatio.toFixed(3)}</div>
                              </div>
                            </td>
                          );
                        })}
                        <td className="border-t border-[#E0CCBA] px-3 py-2 text-center font-black text-[#A93E2A]">{avgRatio.toFixed(3)}</td>
                        <td className="border-t border-[#E0CCBA] px-2 py-2">
                          <LocalNumberInput
                            value={item.secondaryDlcHours ?? ''}
                            disabled={!canEdit}
                            onCommit={(value) => updateItem(item.id, { secondaryDlcHours: value })}
                            className="w-[58px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2 py-2 text-center font-black outline-none"
                          />
                        </td>
                        <td className="border-t border-[#E0CCBA] px-2 py-2">
                          <LocalNumberInput
                            value={item.targetBuffer as number | ''}
                            disabled={!canEdit}
                            onCommit={(value) => updateItem(item.id, { targetBuffer: value })}
                            className="w-[58px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2 py-2 text-center font-black outline-none"
                          />
                        </td>
                        <td className="border-t border-[#E0CCBA] px-2 py-2">
                          <LocalTextInput
                            value={item.notes || ''}
                            disabled={!canEdit}
                            onCommit={(value) => updateItem(item.id, { notes: value })}
                            className="w-[96px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2.5 py-2 font-semibold outline-none"
                          />
                        </td>
                        <td className="border-t border-[#E0CCBA] px-3 py-2"><div className="flex gap-1.5 justify-center"><button onClick={() => moveItem(item.id, 'up')} disabled={!canEdit || idx === 0} className="h-8 w-8 rounded-xl bg-slate-900 text-[#ffd700] disabled:opacity-20">↑</button><button onClick={() => moveItem(item.id, 'down')} disabled={!canEdit || idx === rows.length - 1} className="h-8 w-8 rounded-xl bg-slate-900 text-[#ffd700] disabled:opacity-20">↓</button></div></td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (<tr><td colSpan={20} className="px-6 py-10 text-center text-sm font-semibold text-slate-500">Aucune production. Ajoute d&apos;abord tes lignes ici, puis importe tes fichiers production dans Paramètres.</td></tr>)}
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
