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
    // NOTE: z-index très élevé pour passer au-dessus des colonnes sticky du tableau
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-3 z-[99999] bg-white border border-slate-200 p-3 rounded-xl shadow-2xl w-[38rem] max-w-[90vw] animate-in slide-in-from-top-2"
    >
      <input
        autoFocus
        type="text"
        placeholder="Rechercher..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full p-2 bg-slate-50 border rounded-lg text-[10px] font-bold mb-2 outline-none focus:ring-1 focus:ring-amber-500"
      />
      <div className="max-h-48 overflow-y-auto space-y-0.5 custom-scrollbar">
        {filtered.length === 0 ? (
          <p className="text-center text-[9px] text-slate-400 font-bold uppercase py-4">
            Aucun résultat
          </p>
        ) : (
          filtered.map(name => (
            <button
              key={name}
              onClick={() => { onSelect(name); onClose(); }}
              className="w-full text-left p-1.5 rounded hover:bg-amber-50 text-[9px] font-black uppercase text-slate-700 truncate"
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
