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
const INPUT_DEBOUNCE_MS = 180;

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

type DraftFields = {
  name: string;
  baseProduction: string;
  unitWeightGrams: number | '';
  secondaryDlcHours: number | '';
  targetBuffer: number | '';
  notes: string;
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
});

const getBaseProduction = (item: PrepItem) => String((item as PrepItemExtended).baseProduction || '');
const getUnitWeight = (item: PrepItem) => (item as PrepItemExtended).unitWeightGrams ?? '';
const normalizeMappingName = (value?: string) => String(value || '').trim().toLowerCase();

const parseMappingNames = (value?: string) =>
  String(value || '')
    .split(MAPPING_SEPARATOR)
    .map((name) => name.trim())
    .filter(Boolean);

const joinMappingNames = (names: string[]) =>
  Array.from(new Map(names.map((name) => [normalizeMappingName(name), name.trim()])).values()).join(MAPPING_SEPARATOR);

const buildDraftFromItem = (item: PrepItem): DraftFields => ({
  name: item.name || '',
  baseProduction: getBaseProduction(item),
  unitWeightGrams: getUnitWeight(item),
  secondaryDlcHours: item.secondaryDlcHours ?? '',
  targetBuffer: item.targetBuffer ?? '',
  notes: item.notes || '',
});

const areDraftsEqual = (a: DraftFields, b: DraftFields) => (
  a.name === b.name &&
  a.baseProduction === b.baseProduction &&
  a.unitWeightGrams === b.unitWeightGrams &&
  a.secondaryDlcHours === b.secondaryDlcHours &&
  a.targetBuffer === b.targetBuffer &&
  a.notes === b.notes
);

interface PrepRowProps {
  item: PrepItem;
  idx: number;
  rowCount: number;
  canEdit: boolean;
  isSelected: boolean;
  toggleSelected: (id: string) => void;
  moveItem: (id: string, direction: 'up' | 'down') => void;
  updateItem: (id: string, patch: Partial<PrepItemExtended>) => void;
  prepValidatedMonths: Record<string, boolean>;
  togglePrepValidateMonth?: (month: string) => void;
  covers: Record<string, number>;
  prepImportsByMonth: PrepImportsByMonth;
  allAvailableImportNames: string[];
  usedMappingNamesElsewhere: Set<string>;
  activeMappingId: string | null;
  setActiveMappingId: React.Dispatch<React.SetStateAction<string | null>>;
  mappingSearchValue: string;
  setMappingSearchValue: (id: string, value: string) => void;
  expanded: boolean;
  toggleExpandedMappings: (id: string) => void;
}

const PrepRow = React.memo(function PrepRow({
  item,
  idx,
  rowCount,
  canEdit,
  isSelected,
  toggleSelected,
  moveItem,
  updateItem,
  prepValidatedMonths,
  covers,
  prepImportsByMonth,
  allAvailableImportNames,
  usedMappingNamesElsewhere,
  activeMappingId,
  setActiveMappingId,
  mappingSearchValue,
  setMappingSearchValue,
  expanded,
  toggleExpandedMappings,
}: PrepRowProps) {
  const [draft, setDraft] = React.useState<DraftFields>(() => buildDraftFromItem(item));
  const debounceRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const nextDraft = buildDraftFromItem(item);
    setDraft((prev) => (areDraftsEqual(prev, nextDraft) ? prev : nextDraft));
  }, [item]);

  React.useEffect(() => () => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
  }, []);

  const commitDraftPatch = React.useCallback((patch: Partial<DraftFields>) => {
    const nextDraft = { ...draft, ...patch };
    const payload: Partial<PrepItemExtended> = {};

    if ('name' in patch) payload.name = nextDraft.name;
    if ('baseProduction' in patch) {
      payload.baseProduction = nextDraft.baseProduction;
      if (!nextDraft.name.trim()) payload.name = nextDraft.baseProduction;
    }
    if ('unitWeightGrams' in patch) payload.unitWeightGrams = nextDraft.unitWeightGrams;
    if ('secondaryDlcHours' in patch) payload.secondaryDlcHours = nextDraft.secondaryDlcHours;
    if ('targetBuffer' in patch) payload.targetBuffer = nextDraft.targetBuffer;
    if ('notes' in patch) payload.notes = nextDraft.notes;

    updateItem(item.id, payload);
  }, [draft, item.id, updateItem]);

  const scheduleCommit = React.useCallback((patch: Partial<DraftFields>) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => commitDraftPatch(patch), INPUT_DEBOUNCE_MS);
  }, [commitDraftPatch]);

  const updateDraftField = React.useCallback(<K extends keyof DraftFields>(key: K, value: DraftFields[K]) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      return next;
    });
    scheduleCommit({ [key]: value } as Partial<DraftFields>);
  }, [scheduleCommit]);

  const flushField = React.useCallback((key: keyof DraftFields) => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    commitDraftPatch({ [key]: draft[key] } as Partial<DraftFields>);
  }, [commitDraftPatch, draft]);

  const currentMappings = React.useMemo(() => parseMappingNames(item.searchName), [item.searchName]);
  const selectedOnRow = React.useMemo(() => new Set(currentMappings.map((name) => normalizeMappingName(name))), [currentMappings]);
  const query = mappingSearchValue.trim().toLowerCase();

  const rowOrphanNames = React.useMemo(
    () => allAvailableImportNames
      .filter((name) => {
        const normalized = normalizeMappingName(name);
        if (selectedOnRow.has(normalized) || usedMappingNamesElsewhere.has(normalized)) return false;
        if (!query) return true;
        return name.toLowerCase().includes(query);
      })
      .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })),
    [allAvailableImportNames, query, selectedOnRow, usedMappingNamesElsewhere]
  );

  const getMonthValue = React.useCallback((month: string) => {
    if (currentMappings.length === 0) return 0;
    return currentMappings.reduce((sum, mappingName) => {
      const imported = getImportedValueForProduct(prepImportsByMonth[month], mappingName, '', ['Nombre']);
      return sum + Number(imported || 0);
    }, 0);
  }, [currentMappings, prepImportsByMonth]);

  const getMonthRatio = React.useCallback((month: string) => {
    const coversValue = Number(covers[month] || 0);
    if (!coversValue) return 0;
    if (prepValidatedMonths[month] && Number(item.ratioHistory[month] || 0) > 0) return Number(item.ratioHistory[month] || 0);
    const imported = getMonthValue(month);
    return imported > 0 ? imported / coversValue : 0;
  }, [covers, getMonthValue, item.ratioHistory, prepValidatedMonths]);

  const monthCells = React.useMemo(() => {
    return MONTHS_ORDER.map((month) => {
      const monthValue = getMonthValue(month);
      const monthRatio = getMonthRatio(month);
      return { month, monthValue, monthRatio };
    });
  }, [getMonthRatio, getMonthValue]);

  const avgRatio = React.useMemo(() => {
    let total = 0;
    let count = 0;
    monthCells.forEach(({ monthRatio }) => {
      if (monthRatio > 0) {
        total += monthRatio;
        count += 1;
      }
    });
    return count > 0 ? total / count : 0;
  }, [monthCells]);

  const alert = currentMappings.length === 0;

  const addMappingName = React.useCallback((name: string) => {
    updateItem(item.id, { searchName: joinMappingNames([...currentMappings, name]) });
  }, [currentMappings, item.id, updateItem]);

  const removeMappingName = React.useCallback((name: string) => {
    const normalizedToRemove = normalizeMappingName(name);
    updateItem(item.id, {
      searchName: joinMappingNames(currentMappings.filter((value) => normalizeMappingName(value) !== normalizedToRemove)),
    });
  }, [currentMappings, item.id, updateItem]);

  return (
    <tr className={idx % 2 === 0 ? 'bg-[#FCF8F2]' : 'bg-[#F7EFE5]'}>
      <td className="border-t border-[#E0CCBA] px-3 py-3 text-center align-middle">
        <input type="checkbox" checked={isSelected} onChange={() => toggleSelected(item.id)} className="h-4 w-4" />
      </td>

      <td className="border-t border-[#E0CCBA] px-2 py-3 align-middle">
        <input
          value={draft.name}
          disabled={!canEdit}
          onChange={(e) => updateDraftField('name', e.target.value)}
          onBlur={() => flushField('name')}
          placeholder={draft.baseProduction || 'Nom produit'}
          className="w-[180px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-3 py-2 font-black outline-none"
        />
      </td>

      <td className="border-t border-[#E0CCBA] px-2 py-3 align-middle">
        <input
          value={draft.baseProduction}
          disabled={!canEdit}
          onChange={(e) => updateDraftField('baseProduction', e.target.value)}
          onBlur={() => flushField('baseProduction')}
          placeholder="Base"
          className="w-[140px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-3 py-2 font-bold outline-none"
        />
      </td>

      <td className="border-t border-[#E0CCBA] px-2 py-3 align-middle">
        <select
          value={item.category}
          disabled={!canEdit}
          onChange={(e) => updateItem(item.id, { category: e.target.value as PrepCategory })}
          className="w-[140px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2 py-2 font-bold outline-none"
        >
          {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </td>

      <td className="border-t border-[#E0CCBA] px-2 py-3 align-middle">
        <div className={`relative min-w-[330px] rounded-2xl border px-3 py-3 shadow-sm ${alert ? 'border-amber-300 bg-amber-50/70' : 'border-[#D0B08D] bg-[#FFFDF9]'}`}>
          <div className="flex items-start gap-2">
            <input
              type="text"
              value={mappingSearchValue}
              disabled={!canEdit}
              onChange={(e) => {
                setMappingSearchValue(item.id, e.target.value);
                setActiveMappingId(item.id);
              }}
              onFocus={() => setActiveMappingId(item.id)}
              placeholder="Rechercher produit import"
              className="flex-1 rounded-xl border border-[#D0B08D] bg-white px-3 py-2 font-semibold outline-none"
            />
            <button
              type="button"
              onClick={() => toggleExpandedMappings(item.id)}
              className="h-10 w-10 shrink-0 rounded-xl border border-[#D0B08D] bg-[#F1ECF8] text-[#7A53A3]"
              title="Voir les produits liés"
            >
              {expanded ? '⌃' : '⌄'}
            </button>
          </div>

          {expanded && (
            <div className="mt-2 max-h-[104px] overflow-y-auto pr-1">
              <div className="flex flex-wrap gap-1.5">
                {currentMappings.map((mapping) => (
                  <span key={mapping} className="inline-flex items-center gap-1 rounded-full border border-[#D0B08D] bg-white px-2 py-1 text-[11px] font-bold text-[#5A3928]">
                    {mapping}
                    {canEdit ? (
                      <button type="button" onClick={() => removeMappingName(mapping)} className="text-[#A93E2A]">×</button>
                    ) : null}
                  </span>
                ))}
                {currentMappings.length === 0 ? (
                  <span className="text-[11px] font-bold text-amber-700">Aucun produit lié</span>
                ) : null}
              </div>
            </div>
          )}

          {activeMappingId === item.id && canEdit && (
            <div className="absolute left-0 top-[calc(100%+6px)] z-[999]">
              <MappingPopover
                orphanNames={rowOrphanNames}
                onSelect={(name) => {
                  addMappingName(name);
                  setMappingSearchValue(item.id, '');
                  setActiveMappingId(item.id);
                }}
                onClose={() => setActiveMappingId(null)}
              />
            </div>
          )}
        </div>
      </td>

      <td className="border-t border-[#E0CCBA] px-2 py-3 align-middle">
        <input
          type="number"
          value={draft.unitWeightGrams}
          disabled={!canEdit}
          onChange={(e) => updateDraftField('unitWeightGrams', e.target.value === '' ? '' : Number(e.target.value) || '')}
          onBlur={() => flushField('unitWeightGrams')}
          placeholder="100"
          className="w-[74px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2 py-2 text-center font-black outline-none"
        />
      </td>

      {monthCells.map(({ month, monthValue, monthRatio }) => (
        <td key={`${item.id}-${month}`} className="border-t border-[#E0CCBA] px-1.5 py-3 text-center align-middle">
          <div className={`rounded-lg p-1 ${prepValidatedMonths[month] ? 'border border-indigo-100 bg-indigo-50' : monthValue > 0 ? 'bg-emerald-50' : 'bg-slate-50'}`}>
            <div className={`font-black text-[11px] leading-none ${prepValidatedMonths[month] ? 'text-indigo-800' : monthValue > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>{monthValue || '–'}</div>
            <div className="mt-1 text-[9px] font-mono text-slate-500">{monthRatio.toFixed(3)}</div>
          </div>
        </td>
      ))}

      <td className="border-t border-[#E0CCBA] px-3 py-3 text-center align-middle font-black text-[#A93E2A]">{avgRatio.toFixed(3)}</td>
      <td className="border-t border-[#E0CCBA] px-2 py-3 align-middle">
        <input
          type="number"
          value={draft.secondaryDlcHours}
          disabled={!canEdit}
          onChange={(e) => updateDraftField('secondaryDlcHours', e.target.value === '' ? '' : Number(e.target.value) || '')}
          onBlur={() => flushField('secondaryDlcHours')}
          className="w-[58px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2 py-2 text-center font-black outline-none"
        />
      </td>
      <td className="border-t border-[#E0CCBA] px-2 py-3 align-middle">
        <input
          type="number"
          value={draft.targetBuffer}
          disabled={!canEdit}
          onChange={(e) => updateDraftField('targetBuffer', e.target.value === '' ? '' : Number(e.target.value) || '')}
          onBlur={() => flushField('targetBuffer')}
          className="w-[58px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2 py-2 text-center font-black outline-none"
        />
      </td>
      <td className="border-t border-[#E0CCBA] px-2 py-3 align-middle">
        <input
          value={draft.notes}
          disabled={!canEdit}
          onChange={(e) => updateDraftField('notes', e.target.value)}
          onBlur={() => flushField('notes')}
          placeholder="Notes"
          className="w-[118px] rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-2.5 py-2 font-semibold outline-none"
        />
      </td>
      <td className="border-t border-[#E0CCBA] px-3 py-3 align-middle">
        <div className="flex justify-center gap-1.5">
          <button onClick={() => moveItem(item.id, 'up')} disabled={!canEdit || idx === 0} className="h-8 w-8 rounded-xl bg-slate-900 text-[#ffd700] disabled:opacity-20">↑</button>
          <button onClick={() => moveItem(item.id, 'down')} disabled={!canEdit || idx === rowCount - 1} className="h-8 w-8 rounded-xl bg-slate-900 text-[#ffd700] disabled:opacity-20">↓</button>
        </div>
      </td>
    </tr>
  );
}, (prev, next) => (
  prev.item === next.item &&
  prev.idx === next.idx &&
  prev.rowCount === next.rowCount &&
  prev.canEdit === next.canEdit &&
  prev.isSelected === next.isSelected &&
  prev.prepValidatedMonths === next.prepValidatedMonths &&
  prev.activeMappingId === next.activeMappingId &&
  prev.mappingSearchValue === next.mappingSearchValue &&
  prev.expanded === next.expanded &&
  prev.usedMappingNamesElsewhere === next.usedMappingNamesElsewhere &&
  prev.allAvailableImportNames === next.allAvailableImportNames
));

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
  const [activeMappingId, setActiveMappingId] = React.useState<string | null>(null);
  const [mappingSearchById, setMappingSearchById] = React.useState<Record<string, string>>({});
  const [expandedMappings, setExpandedMappings] = React.useState<Set<string>>(new Set());

  const allAvailableImportNames = React.useMemo(
    () => extractAllNamesFromCsvs(prepImportsByMonth),
    [prepImportsByMonth]
  );

  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return prepItems.filter((item) => {
      if (!q) return true;
      const base = getBaseProduction(item).toLowerCase();
      const mappings = parseMappingNames(item.searchName).join(' ').toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.searchName.toLowerCase().includes(q) ||
        base.includes(q) ||
        mappings.includes(q)
      );
    });
  }, [prepItems, search]);

  const usedMappingNamesById = React.useMemo(() => {
    const map = new Map<string, Set<string>>();
    const normalizedByItem = prepItems.map((item) => ({
      id: item.id,
      names: parseMappingNames(item.searchName).map((name) => normalizeMappingName(name)),
    }));
    const allNames = normalizedByItem.flatMap((entry) => entry.names);

    normalizedByItem.forEach((entry) => {
      const own = new Set(entry.names);
      map.set(
        entry.id,
        new Set(allNames.filter((name) => !own.has(name)))
      );
    });

    return map;
  }, [prepItems]);

  const updateItem = React.useCallback((id: string, patch: Partial<PrepItemExtended>) => {
    setPrepItems((prev) => prev.map((item) => item.id === id ? ({ ...item, ...patch } as PrepItem) : item));
  }, [setPrepItems]);

  const toggleSelected = React.useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const setMappingSearchValue = React.useCallback((id: string, value: string) => {
    setMappingSearchById((prev) => (prev[id] === value ? prev : { ...prev, [id]: value }));
  }, []);

  const toggleExpandedMappings = React.useCallback((id: string) => {
    setExpandedMappings((prev) => {
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
                <p className="mt-3 text-xs font-semibold text-[#FFE7CF]">Une ligne = une production. Les références import sont exclusives à une seule ligne.</p>
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
                <div>
                  <h2 className="text-lg font-black uppercase tracking-[0.08em] text-[#FFF8F1]">Productions & ratios</h2>
                </div>
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une production..." className="rounded-2xl border border-white/20 bg-white/95 px-4 py-2 text-sm font-bold text-slate-800 outline-none xl:w-[280px]" />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="min-w-[1750px] w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[#F4E4D2] text-[#6C3C2B] shadow-[0_1px_0_#E8D6C6]">
                  <tr>
                    <th className="px-3 py-3 text-left font-black uppercase">Sel.</th>
                    <th className="px-2 py-3 text-left font-black uppercase">Produit</th>
                    <th className="px-2 py-3 text-left font-black uppercase">Base</th>
                    <th className="px-2 py-3 text-left font-black uppercase">Poste</th>
                    <th className="px-2 py-3 text-left font-black uppercase">Mapping import</th>
                    <th className="px-2 py-3 text-center font-black uppercase">Poids g</th>
                    {MONTHS_ORDER.map((month) => <th key={month} className="px-2 py-3 text-center font-black uppercase">{MONTH_LABELS[month]}</th>)}
                    <th className="px-3 py-3 text-center font-black uppercase">Ratio moy.</th>
                    <th className="px-2 py-3 text-center font-black uppercase">DLC h</th>
                    <th className="px-2 py-3 text-center font-black uppercase">Buffer</th>
                    <th className="px-2 py-3 text-left font-black uppercase">Notes</th>
                    <th className="px-3 py-3 text-center font-black uppercase">Ordre</th>
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
                  {rows.map((item, idx) => (
                    <PrepRow
                      key={item.id}
                      item={item}
                      idx={idx}
                      rowCount={rows.length}
                      canEdit={canEdit}
                      isSelected={selectedIds.has(item.id)}
                      toggleSelected={toggleSelected}
                      moveItem={moveItem}
                      updateItem={updateItem}
                      prepValidatedMonths={prepValidatedMonths}
                      togglePrepValidateMonth={togglePrepValidateMonth}
                      covers={covers}
                      prepImportsByMonth={prepImportsByMonth}
                      allAvailableImportNames={allAvailableImportNames}
                      usedMappingNamesElsewhere={usedMappingNamesById.get(item.id) || new Set()}
                      activeMappingId={activeMappingId}
                      setActiveMappingId={setActiveMappingId}
                      mappingSearchValue={mappingSearchById[item.id] || ''}
                      setMappingSearchValue={setMappingSearchValue}
                      expanded={expandedMappings.has(item.id)}
                      toggleExpandedMappings={toggleExpandedMappings}
                    />
                  ))}
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
