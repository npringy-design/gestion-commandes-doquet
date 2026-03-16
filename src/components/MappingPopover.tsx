// =============================================================
// components/MappingPopover.tsx
// Popover de sélection du nom de mapping CSV pour un produit
// Extrait de App.tsx
// =============================================================

import React, { useState, useRef, useEffect, useMemo } from 'react';

interface MappingPopoverProps {
  orphanNames: string[];
  onSelect:    (name: string) => void;
  onClose:     () => void;
}

const MappingPopover: React.FC<MappingPopoverProps> = ({ orphanNames, onSelect, onClose }) => {
  const [search,     setSearch]     = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Fermer en cliquant en dehors
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const filtered = useMemo(
    () => orphanNames.filter(n => n.toLowerCase().includes(search.toLowerCase())).sort(),
    [orphanNames, search]
  );

  return (
    <div
      ref={popoverRef}
      className="absolute left-0 top-full mt-2 z-[99999] w-[260px] max-w-[72vw] rounded-2xl border border-[#D8C0AA] bg-white p-2 shadow-[0_16px_32px_rgba(80,40,20,0.16)] animate-in slide-in-from-top-2"
    >
      <input
        autoFocus
        type="text"
        placeholder="Rechercher..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="mb-2 w-full rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-3 py-2 text-[11px] font-bold outline-none focus:ring-1 focus:ring-amber-500"
      />
      <div className="max-h-44 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
        {filtered.length === 0 ? (
          <p className="py-3 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
            Aucun nom disponible
          </p>
        ) : (
          filtered.map(name => (
            <button
              key={name}
              onClick={() => { onSelect(name); onClose(); }}
              className="w-full truncate rounded-xl px-3 py-2 text-left text-[11px] font-black text-slate-700 hover:bg-amber-50"
            >
              {name}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default MappingPopover;
