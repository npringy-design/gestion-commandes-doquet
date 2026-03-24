import React, { useEffect, useMemo, useRef, useState } from 'react';

type MappingPopoverMode = 'selected' | 'picker';

interface MappingPopoverProps {
  mode?: MappingPopoverMode;
  orphanNames: string[];
  selectedNames?: string[];
  onSelectMany?: (names: string[]) => void;
  onRemove?: (name: string) => void;
  onClose: () => void;
}

const normalize = (value: string) => value.trim().toLowerCase();

const MappingPopover: React.FC<MappingPopoverProps> = ({
  mode = 'picker',
  orphanNames,
  selectedNames = [],
  onSelectMany,
  onRemove,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    setChecked(new Set());
  }, [mode]);

  const filteredOrphans = useMemo(
    () => orphanNames.filter((n) => n.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })),
    [orphanNames, search]
  );

  const filteredSelected = useMemo(
    () => selectedNames.filter((n) => n.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })),
    [selectedNames, search]
  );

  const toggleCheck = (name: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      const key = normalize(name);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleSelectAll = () => {
    setChecked(new Set(filteredOrphans.map((name) => normalize(name))));
  };

  const handleClear = () => setChecked(new Set());

  const handleAdd = () => {
    if (!onSelectMany) return;
    const selected = filteredOrphans.filter((name) => checked.has(normalize(name)));
    if (selected.length === 0) return;
    onSelectMany(selected);
  };

  const checkedCount = checked.size;

  return (
    <div
      ref={popoverRef}
      className="w-[300px] max-w-[72vw] rounded-2xl border border-[#D8C0AA] bg-[#FFF9F1] p-3 shadow-[0_16px_32px_rgba(80,40,20,0.16)]"
    >
      <input
        autoFocus
        type="text"
        placeholder={mode === 'picker' ? 'Rechercher...' : 'Filtrer les produits liés...'}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-3 w-full rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-3 py-2 text-[12px] font-bold outline-none focus:ring-1 focus:ring-amber-500"
      />

      {mode === 'selected' ? (
        <>
          <div className="mb-3 text-[12px] font-black uppercase tracking-[0.08em] text-[#6C3C2B]">
            {filteredSelected.length > 0 ? `${filteredSelected.length} produit${filteredSelected.length > 1 ? 's' : ''} lié${filteredSelected.length > 1 ? 's' : ''}` : 'Aucun produit lié'}
          </div>
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {filteredSelected.length === 0 ? (
              <p className="py-4 text-center text-[11px] font-bold text-slate-400">Aucun produit lié</p>
            ) : (
              filteredSelected.map((name) => (
                <div key={name} className="flex items-center justify-between gap-2 rounded-xl bg-[#F4ECDD] px-3 py-2">
                  <span className="text-[12px] font-bold text-[#6C3C2B]">{name}</span>
                  {onRemove ? (
                    <button
                      type="button"
                      onClick={() => onRemove(name)}
                      className="rounded-lg border border-[#D0B08D] bg-white px-2 py-1 text-[11px] font-black text-[#A93E2A]"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={onClose} className="rounded-xl border border-[#D0B08D] bg-white px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em] text-[#6C3C2B]">Fermer</button>
          </div>
        </>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-[12px] font-black uppercase tracking-[0.08em] text-[#6C3C2B]">
              {checkedCount > 0 ? `${checkedCount} sélection${checkedCount > 1 ? 's' : ''}` : `${filteredOrphans.length} disponible${filteredOrphans.length > 1 ? 's' : ''}`}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleSelectAll} className="rounded-xl border border-[#D0B08D] bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#8A5A2F]">Tout cocher</button>
              <button type="button" onClick={handleClear} className="rounded-xl border border-[#D0B08D] bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">Vider</button>
            </div>
          </div>
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {filteredOrphans.length === 0 ? (
              <p className="py-4 text-center text-[11px] font-bold text-slate-400">Aucun nom disponible</p>
            ) : (
              filteredOrphans.map((name) => {
                const key = normalize(name);
                const isChecked = checked.has(key);
                return (
                  <label key={name} className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#F4ECDD] px-3 py-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCheck(name)}
                      className="h-4 w-4"
                    />
                    <span className="text-[12px] font-bold text-[#6C3C2B]">{name}</span>
                  </label>
                );
              })
            )}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-[#D0B08D] bg-white px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em] text-[#6C3C2B]">Fermer</button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={checkedCount === 0}
              className="rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em] text-[#A05A28] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ajouter la sélection
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default MappingPopover;
