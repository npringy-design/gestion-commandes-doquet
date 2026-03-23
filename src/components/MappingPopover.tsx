// =============================================================
// components/MappingPopover.tsx
// Popover de sélection du nom de mapping CSV pour un produit
// =============================================================

import React, { useState, useRef, useEffect, useMemo } from 'react';

interface MappingPopoverProps {
  orphanNames: string[];
  onSelectMany: (names: string[]) => void;
  onRemove?: (name: string) => void;
  onClose: () => void;
}

const MappingPopover: React.FC<MappingPopoverProps> = ({ orphanNames, onSelectMany, onClose }) => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const filtered = useMemo(
    () => orphanNames.filter((n) => n.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })),
    [orphanNames, search]
  );

  const toggleName = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const addSelected = () => {
    if (selected.size === 0) return;
    onSelectMany(Array.from(selected));
    onClose();
  };

  const selectAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((name) => next.add(name));
      return next;
    });
  };

  const clearFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((name) => next.delete(name));
      return next;
    });
  };

  return (
    <div
      ref={popoverRef}
      className="absolute left-0 top-full mt-2 z-[99999] w-[300px] max-w-[78vw] rounded-2xl border border-[#D8C0AA] bg-white p-2 shadow-[0_16px_32px_rgba(80,40,20,0.16)] animate-in slide-in-from-top-2"
    >
      <input
        autoFocus
        type="text"
        placeholder="Rechercher..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-2 w-full rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-3 py-2 text-[11px] font-bold outline-none focus:ring-1 focus:ring-amber-500"
      />

      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">
          {selected.size} sélection{selected.size > 1 ? 's' : ''}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={selectAllFiltered}
            className="rounded-lg border border-[#D0B08D] bg-[#FFFDF9] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#8A5A2F]"
          >
            Tout cocher
          </button>
          <button
            type="button"
            onClick={clearFiltered}
            className="rounded-lg border border-[#D0B08D] bg-[#FFFDF9] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-slate-500"
          >
            Vider
          </button>
        </div>
      </div>

      <div className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
        {filtered.length === 0 ? (
          <p className="py-3 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
            Aucun nom disponible
          </p>
        ) : (
          filtered.map((name) => {
            const checked = selected.has(name);
            return (
              <label
                key={name}
                className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-black ${checked ? 'bg-amber-50 text-[#7A3D1D]' : 'text-slate-700 hover:bg-amber-50'}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleName(name)}
                  className="h-4 w-4 rounded border-[#D0B08D]"
                />
                <span className="truncate">{name}</span>
              </label>
            );
          })
        )}
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-slate-600"
        >
          Fermer
        </button>
        <button
          type="button"
          onClick={addSelected}
          disabled={selected.size === 0}
          className="rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#A05A28] disabled:cursor-not-allowed disabled:opacity-35"
        >
          Ajouter la sélection
        </button>
      </div>
    </div>
  );
};

export default MappingPopover;
