import React from 'react';
import { MONTHS_ORDER, type View } from '../constants';
import type { PrepCategory, PrepImportsByMonth, PrepItem } from '../types';
import { useAuth } from '../auth/AuthProvider';
import { canEditRatios } from '../lib/permissions';
import MappingPopover from '../components/MappingPopover';
import AppNavTile from '../components/AppNavTile';
import { buildImportedValueLookup, extractAllNamesFromCsvs } from '../utils/csvHelpers';

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
  prepImportTargetMonth?: string;
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
  prepImportTargetMonth,
}) => {
  const { profile } = useAuth();
  const canEdit = canEditRatios(profile);
  const [search, setSearch] = React.useState('');
  const [showOnlyUnlinked, setShowOnlyUnlinked] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [activePopover, setActivePopover] = React.useState<{ id: string; mode: MappingPopoverMode } | null>(null);
  const workMonth = prepImportTargetMonth || MONTHS_ORDER[0];

  const allAvailableImportNames = React.useMemo(
    () => extractAllNamesFromCsvs(prepImportsByMonth[workMonth] ? { [workMonth]: prepImportsByMonth[workMonth] } : {}),
    [prepImportsByMonth, workMonth]
  );
  const sortedAvailableImportNames = React.useMemo(
    () => Array.from(allAvailableImportNames as Set<string>).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })),
    [allAvailableImportNames]
  );
  const workMonthImportValues = React.useMemo(
    () => buildImportedValueLookup(prepImportsByMonth[workMonth], ['Nombre']),
    [prepImportsByMonth, workMonth]
  );

  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return prepItems.filter((item) => {
      if (showOnlyUnlinked && parseMappingNames(item.searchName).length > 0) return false;
      if (!q) return true;
      return [item.name, item.searchName, getBaseProduction(item)]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [prepItems, search, showOnlyUnlinked]);

  const pageStats = React.useMemo(() => {
    const linkedItems = prepItems.filter((item) => parseMappingNames(item.searchName).length > 0).length;
    const lockedMonths = MONTHS_ORDER.filter((month) => prepValidatedMonths[month]).length;
    return {
      linkedItems,
      unlinkedItems: prepItems.length - linkedItems,
      visibleItems: rows.length,
      importLines: allAvailableImportNames.size,
      lockedMonths,
    };
  }, [allAvailableImportNames.size, prepItems, prepValidatedMonths, rows.length]);

  const selectedVisibleCount = React.useMemo(
    () => rows.filter((item) => selectedIds.has(item.id)).length,
    [rows, selectedIds]
  );

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

  const getImportedMonthValue = (item: PrepItem, month: string) => {
    const mappingNames = parseMappingNames(item.searchName);
    if (mappingNames.length === 0) return 0;

    if (month === workMonth) {
      return mappingNames.reduce((sum, mappingName) => (
        sum + Number(workMonthImportValues.get(normalizeMappingName(mappingName)) || 0)
      ), 0);
    }

    return mappingNames.reduce((sum, mappingName) => {
      const imported = buildImportedValueLookup(prepImportsByMonth[month], ['Nombre']).get(normalizeMappingName(mappingName));
      return sum + Number(imported || 0);
    }, 0);
  };

  const getMonthValue = (item: PrepItem, month: string) => {
    const coversValue = Number(covers[month] || 0);
    const isValidated = !!prepValidatedMonths[month];
    const isWorkMonth = month === workMonth;

    if (isValidated) {
      const frozenRatio = Number(item.ratioHistory[month] || 0);
      return coversValue > 0 && frozenRatio > 0 ? Math.round(frozenRatio * coversValue) : 0;
    }

    // Same performance rule as vente ratio: only the active work month can read imports live.
    if (!isWorkMonth) return 0;

    return getImportedMonthValue(item, month);
  };

  const getMonthRatio = (item: PrepItem, month: string) => {
    const coversValue = Number(covers[month] || 0);
    if (!coversValue) return 0;
    if (prepValidatedMonths[month]) return Number(item.ratioHistory[month] || 0);
    if (month !== workMonth) return 0;
    const imported = getImportedMonthValue(item, month);
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
    <div className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#FFF1D9_0%,#E9BF8D_58%,#D99B58_100%)] text-[#34271F]">
      <div className="mx-auto flex h-screen max-w-[1920px] flex-col gap-3 p-2 sm:p-3">
        <aside className="hidden">
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

            <div className="rounded-[22px] border border-[#D7B79B] bg-[#FFF9F1] p-3 shadow-[0_8px_18px_rgba(145,105,75,0.08)]">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A85F2A]">Mois de travail</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="text-3xl font-black uppercase leading-none text-[#2F1D14]">{MONTH_LABELS[workMonth]}</div>
                <div className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${prepValidatedMonths[workMonth] ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-[#8A5A2F]'}`}>
                  {prepValidatedMonths[workMonth] ? 'Fige' : 'Ouvert'}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-2xl bg-white px-2 py-2">
                  <div className="text-lg font-black text-[#2F1D14]">{pageStats.linkedItems}</div>
                  <div className="text-[9px] font-black uppercase tracking-[0.08em] text-[#8A604B]">Liees</div>
                </div>
                <div className="rounded-2xl bg-white px-2 py-2">
                  <div className="text-lg font-black text-[#A93E2A]">{pageStats.unlinkedItems}</div>
                  <div className="text-[9px] font-black uppercase tracking-[0.08em] text-[#8A604B]">A traiter</div>
                </div>
              </div>
            </div>

            <button onClick={addItem} disabled={!canEdit} className="rounded-[20px] border border-slate-300 bg-white px-4 py-4 text-sm font-black uppercase tracking-[0.12em] text-slate-700 shadow-sm disabled:opacity-50">Ajouter une production</button>
            <button onClick={deleteSelected} disabled={!canEdit || selectedIds.size === 0} className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-4 text-sm font-black uppercase tracking-[0.12em] text-red-700 shadow-sm disabled:opacity-50">Supprimer la sélection</button>
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1">
          <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[28px] border border-[#D8A96E] bg-[#FFF7EA]/96 shadow-[0_18px_38px_rgba(72,35,19,0.18)]">
            <div className="border-b border-[#7B3A1E] bg-[linear-gradient(90deg,#4A2217_0%,#6F321D_48%,#9D541E_100%)] px-4 py-3 shadow-[0_14px_28px_rgba(72,35,19,0.22)] sm:px-5">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-3">
                  <AppNavTile onClick={() => setView('home')} eyebrow="Retour" icon="home" size="sm" tone="cream">Accueil</AppNavTile>
                  <AppNavTile onClick={() => setView('stats')} eyebrow="Retour" icon="settings" size="sm" tone="cream">Parametres</AppNavTile>
                  <div className="hidden h-12 w-px bg-[#E9B25D]/35 xl:block" />
                  <h2 className="text-3xl font-black leading-none text-[#FFF7EA]">Calcul prod ratio</h2>
                  <p className="hidden text-[10px] font-black uppercase tracking-[0.22em] text-[#F7C05B] xl:block">Hippopotamus Thillois</p>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-[#B8793F]/65 bg-[#FFF7EA]/10 p-2 xl:flex-row xl:items-center xl:justify-between">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher une production, une base ou un import..."
                  className="min-h-[42px] w-full rounded-2xl border border-[#EBC28A] bg-[#FFF7EA] px-4 py-2 text-sm font-bold text-[#2F1D14] outline-none placeholder:text-[#9B7A67] xl:w-[520px] xl:flex-none"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowOnlyUnlinked((value) => !value)}
                    className={`min-h-[42px] rounded-2xl border px-4 py-2 text-[11px] font-black uppercase tracking-[0.10em] shadow-sm transition ${showOnlyUnlinked ? 'border-[#F7B24A] bg-[#F7B24A] text-[#2F1D14]' : 'border-[#EBC28A] bg-[#FFF7EA] text-[#2F1D14] hover:bg-white'}`}
                  >
                    {showOnlyUnlinked ? 'Tout afficher' : 'Non liees'}
                  </button>
                  <button
                    type="button"
                    onClick={addItem}
                    disabled={!canEdit}
                    className="min-h-[42px] rounded-2xl border border-[#EBC28A] bg-[#FFF7EA] px-4 py-2 text-[11px] font-black uppercase tracking-[0.10em] text-[#2F1D14] shadow-sm transition hover:bg-white disabled:opacity-50"
                  >
                    Ajouter
                  </button>
                  <button
                    type="button"
                    onClick={deleteSelected}
                    disabled={!canEdit || selectedIds.size === 0}
                    className="min-h-[42px] rounded-2xl border border-[#EBC28A] bg-[#FFF7EA] px-4 py-2 text-[11px] font-black uppercase tracking-[0.10em] text-[#7A2E1E] shadow-sm transition hover:bg-white disabled:opacity-50"
                  >
                    Supprimer
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(
                      selectedVisibleCount === rows.length && rows.length > 0
                        ? new Set()
                        : new Set(rows.map((item) => item.id))
                    )}
                    disabled={!canEdit || rows.length === 0}
                    className="min-h-[42px] rounded-2xl border border-[#EBC28A] bg-[#FFF7EA] px-4 py-2 text-[11px] font-black uppercase tracking-[0.10em] text-[#2F1D14] shadow-sm transition hover:bg-white disabled:opacity-50"
                  >
                    {selectedVisibleCount === rows.length && rows.length > 0 ? 'Deselectionner' : 'Tout selectionner'}
                  </button>
                </div>
              </div>
            </div>

            <div className="border-b border-[#D7B79B] bg-[#FFF8EF] px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8A5A2F]">Figer les mois de production</p>
                <p className="text-[11px] font-bold text-[#8B6650]">{pageStats.lockedMonths} mois figes</p>
              </div>
              <div className="grid grid-cols-6 gap-1.5 xl:grid-cols-12">
                {MONTHS_ORDER.map((month) => {
                  const locked = !!prepValidatedMonths[month];
                  return (
                    <button
                      key={`freeze-${month}`}
                      type="button"
                      onClick={() => togglePrepValidateMonth?.(month)}
                      className={`min-h-[42px] rounded-xl border px-2 py-1 text-[10px] font-black uppercase tracking-[0.07em] transition ${
                        locked
                          ? 'border-emerald-700 bg-emerald-600 text-white shadow-sm'
                          : month === workMonth
                            ? 'border-[#D8A640] bg-[#FFE8A8] text-[#5B321E]'
                            : 'border-[#E0CCBA] bg-white text-[#8A5A2F] hover:border-[#B46E58]'
                      }`}
                    >
                      <span className="block text-xs">{MONTH_LABELS[month]}</span>
                      <span className="block text-[8px]">{locked ? 'Fige' : 'Ouvert'}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4">
              {rows.length === 0 ? (
                <div className="flex h-full min-h-[280px] items-center justify-center rounded-[22px] border border-dashed border-[#D7B79B] bg-[#FFF9F1] px-6 text-center">
                  <p className="max-w-xl text-sm font-semibold text-[#8B6650]">
                    Aucune production. Ajoute d&apos;abord tes lignes ici, puis importe tes fichiers production dans Parametres.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {rows.map((item, idx) => {
                          const avgRatio = getAverageRatio(item);
                          const currentMappings = parseMappingNames(item.searchName);
                          const selectedOnRow = new Set(currentMappings.map((name) => normalizeMappingName(name)));
                          const unitType = getUnitType(item);
                          const baseUnitType = getBaseUnitType(item);
                          const isSelectedPopoverOpen = activePopover?.id === item.id && activePopover.mode === 'selected';
                          const isPickerPopoverOpen = activePopover?.id === item.id && activePopover.mode === 'picker';
                          const rowOrphanNames = isPickerPopoverOpen
                            ? sortedAvailableImportNames.filter((name) => !selectedOnRow.has(normalizeMappingName(name)))
                            : [];
                          const canOpenPicker = sortedAvailableImportNames.length > selectedOnRow.size;

                          return (
                            <article key={item.id} className={`rounded-[18px] border bg-white px-3 py-3 transition ${selectedIds.has(item.id) ? 'border-[#B45439] shadow-[0_8px_20px_rgba(180,84,57,0.12)]' : 'border-[#E0CCBA]'}`}>
                              <div className="grid min-w-0 items-end gap-2 xl:grid-cols-[28px_minmax(160px,1.35fr)_minmax(120px,0.95fr)_78px_minmax(120px,0.95fr)_76px_76px_minmax(210px,1.35fr)_82px_70px]">
                                <label className="flex h-11 items-center justify-center">
                                  <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelected(item.id)} disabled={!canEdit} className="h-4 w-4 accent-[#A93E2A]" />
                                </label>

                                <label className="min-w-0">
                                  <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.10em] text-[#A85F2A]">Produit</span>
                                  <input
                                    key={`${item.id}-name-${item.name}`}
                                    defaultValue={item.name}
                                    disabled={!canEdit}
                                    onBlur={(e) => updateItem(item.id, { name: e.target.value })}
                                    onKeyDown={onEnterBlur}
                                    className="h-10 w-full rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-3 text-sm font-black outline-none"
                                  />
                                </label>

                                <label className="min-w-0">
                                  <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.10em] text-[#A85F2A]">Base</span>
                                  <input
                                    key={`${item.id}-base-${getBaseProduction(item)}`}
                                    defaultValue={getBaseProduction(item)}
                                    disabled={!canEdit}
                                    onBlur={(e) => updateItem(item.id, { baseProduction: e.target.value })}
                                    onKeyDown={onEnterBlur}
                                    className="h-10 w-full rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-3 text-sm font-bold outline-none"
                                  />
                                </label>

                                <label>
                                  <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.10em] text-[#A85F2A]">Unite</span>
                                  <select value={unitType} disabled={!canEdit} onChange={(e) => updateItem(item.id, { unitType: e.target.value as UnitType })} className="h-10 w-full rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2 text-sm font-bold outline-none">
                                    <option value="piece">Piece</option>
                                    <option value="kg">Kg</option>
                                  </select>
                                </label>

                                <label className="min-w-0">
                                  <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.10em] text-[#A85F2A]">Poste</span>
                                  <select value={item.category} disabled={!canEdit} onChange={(e) => updateItem(item.id, { category: e.target.value as PrepCategory })} className="h-10 w-full rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2 text-sm font-bold outline-none">
                                    {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                  </select>
                                </label>

                                <label>
                                  <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.10em] text-[#A85F2A]">Poids</span>
                                  <input
                                    key={`${item.id}-weight-${getUnitWeight(item)}`}
                                    type="number"
                                    defaultValue={getUnitWeight(item) === '' ? '' : String(getUnitWeight(item))}
                                    disabled={!canEdit}
                                    onBlur={(e) => updateItem(item.id, { unitWeightGrams: e.target.value === '' ? '' : Number(e.target.value) || '' })}
                                    onKeyDown={onEnterBlur}
                                    placeholder="100"
                                    className="h-10 w-full rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2 text-center text-sm font-black outline-none"
                                  />
                                </label>

                                <label>
                                  <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.10em] text-[#A85F2A]">DLC</span>
                                  <input
                                    key={`${item.id}-dlc-${item.secondaryDlcHours}`}
                                    type="number"
                                    defaultValue={item.secondaryDlcHours}
                                    disabled={!canEdit}
                                    onBlur={(e) => updateItem(item.id, { secondaryDlcHours: e.target.value === '' ? '' : Number(e.target.value) || '' })}
                                    onKeyDown={onEnterBlur}
                                    className="h-10 w-full rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2 text-center text-sm font-black outline-none"
                                  />
                                </label>

                                <div className="relative min-w-0">
                                  <div className="mb-1 flex items-center justify-between gap-2">
                                    <span className="block text-[9px] font-black uppercase tracking-[0.10em] text-[#A85F2A]">Recherche produit</span>
                                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${currentMappings.length > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                      {currentMappings.length}
                                    </span>
                                  </div>
                                  <div className="flex h-10 min-w-0 items-center gap-1.5 rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-1.5">
                                    <button
                                      type="button"
                                      disabled={!canOpenPicker}
                                      onClick={() => setActivePopover(isPickerPopoverOpen ? null : { id: item.id, mode: 'picker' })}
                                      className="h-8 rounded-lg border border-[#D0B08D] bg-white px-2 text-[10px] font-black uppercase tracking-[0.10em] text-[#A05A28] disabled:cursor-not-allowed disabled:opacity-35"
                                    >
                                      Ajouter
                                    </button>
                                    <button
                                      type="button"
                                      disabled={currentMappings.length === 0}
                                      onClick={() => setActivePopover(isSelectedPopoverOpen ? null : { id: item.id, mode: 'selected' })}
                                      className="min-w-0 truncate rounded-lg px-1.5 py-1 text-left text-[11px] font-bold text-slate-500 transition hover:bg-[#F4ECDD] hover:text-[#6C3C2B] disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-slate-500"
                                    >
                                      {currentMappings.length > 0 ? `${currentMappings.length} produits` : 'Aucun lien'}
                                    </button>
                                  </div>
                                  {(isSelectedPopoverOpen || isPickerPopoverOpen) && (
                                    <div className="absolute right-0 top-[calc(100%+8px)] z-[999]">
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

                                <div className="rounded-lg bg-[#A93E2A] px-2 py-2 text-center">
                                  <div className="text-[7px] font-black uppercase tracking-[0.08em] text-[#FFE1B8]">Ratio moy.</div>
                                  <div className="text-xs font-black leading-none text-white">{avgRatio.toFixed(3)}</div>
                                </div>

                                <div className="flex items-end justify-end gap-1">
                                  <button onClick={() => moveItem(item.id, 'up')} disabled={!canEdit || idx === 0} className="h-9 w-8 rounded-xl bg-[#2F1D14] text-xs font-black text-[#F6C35B] disabled:opacity-20" title="Monter">↑</button>
                                  <button onClick={() => moveItem(item.id, 'down')} disabled={!canEdit || idx === rows.length - 1} className="h-9 w-8 rounded-xl bg-[#2F1D14] text-xs font-black text-[#F6C35B] disabled:opacity-20" title="Descendre">↓</button>
                                </div>
                              </div>

                              <div className="mt-2 grid grid-cols-6 gap-1.5 xl:grid-cols-12">
                                {MONTHS_ORDER.map((month) => {
                                  const monthValue = getMonthValue(item, month);
                                  const monthRatio = getMonthRatio(item, month);
                                  return (
                                    <div key={`${item.id}-${month}`} className={`rounded-lg border px-2 py-1.5 text-center ${prepValidatedMonths[month] ? 'border-indigo-200 bg-indigo-50' : month === workMonth ? 'border-[#D8A640] bg-[#FFF1C9]' : monthValue > 0 ? 'border-emerald-100 bg-emerald-50' : 'border-slate-100 bg-slate-50'}`}>
                                      <div className="text-[8px] font-black uppercase tracking-[0.08em] text-[#8A5A2F]">{MONTH_LABELS[month]}</div>
                                      <div className={`mt-0.5 text-xs font-black leading-none ${prepValidatedMonths[month] ? 'text-indigo-800' : monthValue > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>{monthValue || '-'}</div>
                                      <div className="mt-0.5 text-[8px] font-mono text-slate-500">{monthRatio.toFixed(3)}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </article>
                          );
                  })}
                </div>
              )}
            </div>          </section>
        </main>
      </div>
    </div>
  );
};

export default PrepRatiosPage;
