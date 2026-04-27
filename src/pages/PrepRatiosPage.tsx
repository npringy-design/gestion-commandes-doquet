import React from 'react';
import { MONTHS_ORDER, type View } from '../constants';
import type { PrepCategory, PrepImportsByMonth, PrepItem } from '../types';
import { useAuth } from '../auth/AuthProvider';
import { canEditRatios } from '../lib/permissions';
import MappingPopover from '../components/MappingPopover';
import AppNavTile from '../components/AppNavTile';
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

type UnitType = 'piece' | 'kg';
type MappingPopoverMode = 'selected' | 'picker';

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
  unitType?: UnitType;
  baseUnitType?: UnitType;
};

const uid = () => Math.random().toString(36).slice(2, 10);

const defaultItem = (): PrepItemExtended => ({
  id: `prep-${uid()}`,
  name: '',
  searchName: '',
  category: 'poste_chaud',
  isActive: true,
  ratioHistory: {},
  secondaryDlcHours: 24,
  targetBuffer: '',
  notes: '',
  baseProduction: '',
  unitWeightGrams: '',
  unitType: 'piece',
  baseUnitType: 'kg',
});

const getBaseProduction = (item: PrepItem) => String((item as PrepItemExtended).baseProduction || '');
const getUnitWeight = (item: PrepItem) => (item as PrepItemExtended).unitWeightGrams ?? '';
const getUnitType = (item: PrepItem): UnitType => ((item as PrepItemExtended).unitType === 'kg' ? 'kg' : 'piece');
const getBaseUnitType = (item: PrepItem): UnitType => ((item as PrepItemExtended).baseUnitType === 'piece' ? 'piece' : 'kg');

const normalizeMappingName = (value?: string) => String(value || '').trim().toLowerCase();

const parseMappingNames = (value?: string) =>
  String(value || '')
    .split(MAPPING_SEPARATOR)
    .map((name) => name.trim())
    .filter(Boolean);

const joinMappingNames = (names: string[]) =>
  Array.from(new Map(names.map((name) => [normalizeMappingName(name), name.trim()])).values()).join(MAPPING_SEPARATOR);

const onEnterBlur: React.KeyboardEventHandler<HTMLInputElement | HTMLTextAreaElement> = (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    event.currentTarget.blur();
  }
};

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
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [activePopover, setActivePopover] = React.useState<{ id: string; mode: MappingPopoverMode } | null>(null);

  const allAvailableImportNames = React.useMemo(
    () => extractAllNamesFromCsvs(prepImportsByMonth),
    [prepImportsByMonth]
  );

  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return prepItems.filter((item) => {
      if (!q) return true;
      return [item.name, item.searchName, getBaseProduction(item)]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [prepItems, search]);

  const updateItem = React.useCallback((id: string, patch: Partial<PrepItemExtended>) => {
    setPrepItems((prev) => prev.map((item) => item.id === id ? ({ ...item, ...patch } as PrepItem) : item));
  }, [setPrepItems]);

  const addMappingNames = React.useCallback((item: PrepItem, names: string[]) => {
    if (names.length === 0) return;
    const current = parseMappingNames(item.searchName);
    updateItem(item.id, { searchName: joinMappingNames([...current, ...names]) });
  }, [updateItem]);

  const removeMappingName = React.useCallback((item: PrepItem, name: string) => {
    const normalizedToRemove = normalizeMappingName(name);
    const current = parseMappingNames(item.searchName);
    updateItem(item.id, { searchName: joinMappingNames(current.filter((value) => normalizeMappingName(value) !== normalizedToRemove)) });
  }, [updateItem]);

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

  const addItem = () => setPrepItems((prev) => [...prev, defaultItem() as PrepItem]);

  const deleteSelected = () => {
    if (selectedIds.size === 0) return;
    setPrepItems((prev) => prev.filter((item) => !selectedIds.has(item.id)));
    setSelectedIds(new Set());
  };

  const getMonthValue = (item: PrepItem, month: string) => {
    const mappingNames = parseMappingNames(item.searchName);
    if (mappingNames.length === 0) return 0;

    return mappingNames.reduce((sum, mappingName) => {
      const imported = getImportedValueForProduct(
        prepImportsByMonth[month],
        mappingName,
        '',
        ['Nombre']
      );
      return sum + Number(imported || 0);
    }, 0);
  };

  const getMonthRatio = (item: PrepItem, month: string) => {
    const coversValue = Number(covers[month] || 0);
    if (!coversValue) return 0;
    if (prepValidatedMonths[month] && Number(item.ratioHistory[month] || 0) > 0) return Number(item.ratioHistory[month] || 0);
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

  return (
    <div className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#F6EFE6_0%,#F2E8DD_45%,#EBDDCE_100%)] text-[#34271F]">
      <div className="mx-auto flex h-screen max-w-[1920px] flex-col gap-3 p-2 sm:p-3 lg:flex-row lg:gap-4 lg:p-3">
        <aside className="w-full shrink-0 lg:w-[250px]">
          <div className="flex flex-col gap-3 lg:sticky lg:top-3">
            <AppNavTile onClick={() => setView('home')} eyebrow="Retour" icon="home" size="lg" className="w-full">Accueil</AppNavTile>
            <AppNavTile onClick={() => setView('stats')} eyebrow="Retour" icon="settings" size="lg" tone="gold" className="w-full">Paramètres</AppNavTile>
            <AppNavTile onClick={() => setView('prep_sheet')} eyebrow="Ouvrir" icon="sheet" size="lg" className="w-full">Feuille de mise en place</AppNavTile>

            <div className="overflow-hidden rounded-[24px] border border-[#B46E58] bg-[linear-gradient(135deg,#A93E2A_0%,#922F20_48%,#7A231A_100%)] shadow-[0_10px_20px_rgba(122,35,26,0.14)]">
              <div className="h-1.5 bg-gradient-to-r from-[#F1C15A] via-[#D86A2C] to-[#A93E2A]" />
              <div className="p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FFE1B8]">Hippopotamus Thillois</p>
                <h1 className="mt-2 text-2xl font-black leading-none text-[#FFF9F3] xl:text-[28px]">Calcul prod ratio</h1>
              </div>
            </div>

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
              <table className="min-w-[1760px] w-full text-sm">
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
                    const avgRatio = getAverageRatio(item);
                    const currentMappings = parseMappingNames(item.searchName);
                    const usedElsewhere = new Set(
                      prepItems
                        .filter((other) => other.id !== item.id)
                        .flatMap((other) => parseMappingNames(other.searchName))
                        .map((name) => normalizeMappingName(name))
                    );
                    const selectedOnRow = new Set(currentMappings.map((name) => normalizeMappingName(name)));
                    const rowOrphanNames = Array.from(allAvailableImportNames)
                      .filter((name) => {
                        const normalized = normalizeMappingName(name);
                        return !selectedOnRow.has(normalized) && !usedElsewhere.has(normalized);
                      })
                      .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
                    const canOpenPicker = rowOrphanNames.length > 0;
                    const unitType = getUnitType(item);
                    const baseUnitType = getBaseUnitType(item);
                    const isSelectedPopoverOpen = activePopover?.id === item.id && activePopover.mode === 'selected';
                    const isPickerPopoverOpen = activePopover?.id === item.id && activePopover.mode === 'picker';

                    return (
                      <tr key={item.id} className={idx % 2 === 0 ? 'bg-[#FCF8F2]' : 'bg-[#F7EFE5]'}>
                        <td className="border-t border-[#E0CCBA] px-3 py-2 text-center"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelected(item.id)} className="h-4 w-4" /></td>
                        <td className="border-t border-[#E0CCBA] px-2 py-2">
                          <div className="flex items-center gap-2">
                            <input
                              key={`${item.id}-name-${item.name}`}
                              defaultValue={item.name}
                              disabled={!canEdit}
                              onBlur={(e) => updateItem(item.id, { name: e.target.value })}
                              onKeyDown={onEnterBlur}
                              className="w-[160px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-3 py-2 font-black outline-none"
                            />
                            <select value={unitType} disabled={!canEdit} onChange={(e) => updateItem(item.id, { unitType: e.target.value as UnitType })} className="w-[92px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2 py-2 font-bold outline-none">
                              <option value="piece">Pièce</option>
                              <option value="kg">Kg</option>
                            </select>
                          </div>
                        </td>
                        <td className="border-t border-[#E0CCBA] px-2 py-2">
                          <div className="flex items-center gap-2">
                            <input
                              key={`${item.id}-base-${getBaseProduction(item)}`}
                              defaultValue={getBaseProduction(item)}
                              disabled={!canEdit}
                              onBlur={(e) => updateItem(item.id, { baseProduction: e.target.value })}
                              onKeyDown={onEnterBlur}
                              placeholder=""
                              className="w-[145px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2.5 py-2 text-sm font-bold outline-none"
                            />
                            <select value={baseUnitType} disabled={!canEdit} onChange={(e) => updateItem(item.id, { baseUnitType: e.target.value as UnitType })} className="w-[92px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2 py-2 font-bold outline-none">
                              <option value="kg">Kg</option>
                              <option value="piece">Pièce</option>
                            </select>
                          </div>
                        </td>
                        <td className="border-t border-[#E0CCBA] px-2 py-2">
                          <select value={item.category} disabled={!canEdit} onChange={(e) => updateItem(item.id, { category: e.target.value as PrepCategory })} className="w-[118px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2 py-2 font-bold outline-none">
                            {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </td>
                        <td className="border-t border-[#E0CCBA] px-2 py-2">
                          <div className="relative w-[290px] rounded-2xl border border-[#D0B08D] bg-[#FFFDF9] px-3 py-2 shadow-sm">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={currentMappings.length === 0}
                                onClick={() => setActivePopover(isSelectedPopoverOpen ? null : { id: item.id, mode: 'selected' })}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D0B08D] bg-[#FFFDF9] text-[#6C3C2B] disabled:cursor-not-allowed disabled:opacity-35"
                                title={currentMappings.length > 0 ? 'Voir les produits liés' : 'Aucun produit lié'}
                              >
                                ▶
                              </button>
                              <button
                                type="button"
                                disabled={!canOpenPicker}
                                onClick={() => setActivePopover(isPickerPopoverOpen ? null : { id: item.id, mode: 'picker' })}
                                className="h-9 min-w-[110px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-3 font-black uppercase tracking-[0.12em] text-[#A05A28] disabled:cursor-not-allowed disabled:opacity-35"
                              >
                                Ajouter
                              </button>
                              <div className="text-xs font-bold text-slate-500">
                                {currentMappings.length > 0 ? `${currentMappings.length} produit${currentMappings.length > 1 ? 's' : ''}` : 'Aucun produit lié'}
                              </div>
                            </div>
                            {(isSelectedPopoverOpen || isPickerPopoverOpen) && (
                              <div className="absolute left-0 top-[calc(100%+8px)] z-[999]">
                                <MappingPopover
                                  mode={isSelectedPopoverOpen ? 'selected' : 'picker'}
                                  orphanNames={rowOrphanNames}
                                  selectedNames={currentMappings}
                                  onSelectMany={(names) => {
                                    addMappingNames(item, names);
                                    setActivePopover(null);
                                  }}
                                  onRemove={(name) => removeMappingName(item, name)}
                                  onClose={() => setActivePopover(null)}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="border-t border-[#E0CCBA] px-2 py-2">
                          <input
                            key={`${item.id}-weight-${getUnitWeight(item)}`}
                            type="number"
                            defaultValue={getUnitWeight(item) === '' ? '' : String(getUnitWeight(item))}
                            disabled={!canEdit}
                            onBlur={(e) => updateItem(item.id, { unitWeightGrams: e.target.value === '' ? '' : Number(e.target.value) || '' })}
                            onKeyDown={onEnterBlur}
                            placeholder="100"
                            className="w-[68px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2 py-2 text-center font-black outline-none"
                          />
                        </td>
                        {MONTHS_ORDER.map((month) => {
                          const monthValue = getMonthValue(item, month);
                          const monthRatio = getMonthRatio(item, month);
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
                          <input
                            key={`${item.id}-dlc-${item.secondaryDlcHours}`}
                            type="number"
                            defaultValue={item.secondaryDlcHours}
                            disabled={!canEdit}
                            onBlur={(e) => updateItem(item.id, { secondaryDlcHours: e.target.value === '' ? '' : Number(e.target.value) || '' })}
                            onKeyDown={onEnterBlur}
                            className="w-[58px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2 py-2 text-center font-black outline-none"
                          />
                        </td>
                        <td className="border-t border-[#E0CCBA] px-2 py-2">
                          <input
                            key={`${item.id}-buffer-${item.targetBuffer}`}
                            type="number"
                            defaultValue={item.targetBuffer === '' ? '' : String(item.targetBuffer)}
                            disabled={!canEdit}
                            onBlur={(e) => updateItem(item.id, { targetBuffer: e.target.value === '' ? '' : Number(e.target.value) || '' })}
                            onKeyDown={onEnterBlur}
                            className="w-[58px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2 py-2 text-center font-black outline-none"
                          />
                        </td>
                        <td className="border-t border-[#E0CCBA] px-2 py-2">
                          <input
                            key={`${item.id}-notes-${item.notes || ''}`}
                            defaultValue={item.notes || ''}
                            disabled={!canEdit}
                            onBlur={(e) => updateItem(item.id, { notes: e.target.value })}
                            onKeyDown={onEnterBlur}
                            placeholder="Optionnel"
                            className="w-[118px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2.5 py-2 font-semibold outline-none"
                          />
                        </td>
                        <td className="border-t border-[#E0CCBA] px-3 py-2"><div className="flex gap-1.5 justify-center"><button onClick={() => moveItem(item.id, 'up')} disabled={!canEdit || idx === 0} className="h-8 w-8 rounded-xl bg-slate-900 text-[#ffd700] disabled:opacity-20">↑</button><button onClick={() => moveItem(item.id, 'down')} disabled={!canEdit || idx === rows.length - 1} className="h-8 w-8 rounded-xl bg-slate-900 text-[#ffd700] disabled:opacity-20">↓</button></div></td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (<tr><td colSpan={22} className="px-6 py-10 text-center text-sm font-semibold text-slate-500">Aucune production. Ajoute d&apos;abord tes lignes ici, puis importe tes fichiers production dans Paramètres.</td></tr>)}
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
