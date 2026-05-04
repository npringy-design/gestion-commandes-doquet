import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface RatiosMappingPopoverProps {
  orphanNames: string[];
  onSelect: (name: string) => void;
  onClose: () => void;
  anchorRect?: DOMRect | null;
}

const RatiosMappingPopover: React.FC<RatiosMappingPopoverProps> = ({ orphanNames, onSelect, onClose, anchorRect }) => {
  const [search, setSearch] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const filteredOrphans = useMemo(
    () => orphanNames
      .filter((n) => n.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })),
    [orphanNames, search]
  );

  const popoverWidth = 320;
  const fixedStyle = anchorRect
    ? {
        position: 'fixed' as const,
        top: Math.min(anchorRect.bottom + 10, window.innerHeight - 380),
        left: Math.max(12, Math.min(anchorRect.right - popoverWidth, window.innerWidth - popoverWidth - 12)),
        zIndex: 99999,
      }
    : undefined;

  const content = (
    <div
      ref={popoverRef}
      className="w-[320px] max-w-[72vw] rounded-2xl border border-[#D8C0AA] bg-[#FFF9F1] p-3 shadow-[0_16px_32px_rgba(80,40,20,0.16)]"
      style={fixedStyle}
    >
      <input
        autoFocus
        type="text"
        placeholder="Rechercher un produit import..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-3 w-full rounded-xl border border-[#D0B08D] bg-[#FFFDF9] px-3 py-2 text-[12px] font-bold outline-none focus:ring-1 focus:ring-amber-500"
      />

      <div className="mb-2 text-[12px] font-black uppercase tracking-[0.08em] text-[#6C3C2B]">
        {filteredOrphans.length > 0 ? `${filteredOrphans.length} disponible${filteredOrphans.length > 1 ? 's' : ''}` : 'Aucun nom disponible'}
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {filteredOrphans.length === 0 ? (
          <p className="py-4 text-center text-[11px] font-bold text-slate-400">Aucun nom disponible</p>
        ) : (
          filteredOrphans.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onSelect(name)}
              className="flex w-full items-center justify-between rounded-xl bg-[#F4ECDD] px-3 py-2 text-left transition hover:bg-[#EFE2CC]"
            >
              <span className="text-[12px] font-bold text-[#6C3C2B]">{name}</span>
              <span className="text-[11px] font-black uppercase tracking-[0.08em] text-[#A05A28]">Choisir</span>
            </button>
          ))
        )}
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-[#D0B08D] bg-white px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em] text-[#6C3C2B]"
        >
          Fermer
        </button>
      </div>
    </div>
  );

  return anchorRect ? createPortal(content, document.body) : content;
};

export default RatiosMappingPopover;
