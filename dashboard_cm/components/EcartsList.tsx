import React from 'react';
import { EcartItem } from '../types';

interface EcartsListProps {
  title: string;
  items: EcartItem[];
  type: 'liquide' | 'solide';
  onSelectItem?: (item: EcartItem) => void;
  selectedId?: string | null;
  /** Chiffre d'affaires de la période (mois ou annuel) pour calculer l'impact en % CA */
  periodSales?: number | null;
}

const EcartsList: React.FC<EcartsListProps> = ({ title, items, type, onSelectItem, selectedId, periodSales }) => {
  const headerColor = type === 'liquide'
    ? 'bg-[linear-gradient(135deg,#284B5A_0%,#416D72_100%)]'
    : 'bg-[linear-gradient(135deg,#7B3A1E_0%,#C86F24_100%)]';

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] border border-[#D8AE77] bg-[#FFF7EA]/90 shadow-[0_12px_26px_rgba(80,38,18,0.12)] backdrop-blur">
      <div className={`${headerColor} px-3 py-3 sm:px-4`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-[11px] font-black text-white">
              {type === 'liquide' ? 'L' : 'S'}
            </span>
            <h3 className="text-[12px] font-extrabold uppercase tracking-tight text-white">{title}</h3>
          </div>
          <span className="rounded-full border border-white/25 bg-white/15 px-2 py-1 text-[10px] font-black text-white/90">
            {items.length}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D8AE77] bg-[#FFFDF8]/70 px-4 py-8 text-center text-xs font-bold text-[#8B6B54]">
            Aucun écart à afficher pour cette période.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => {
              const impact = periodSales && periodSales > 0
                ? `${((item.value / periodSales) * 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% CA`
                : 'Impact —';
              const isSelected = !!selectedId && item.id === selectedId;
              const valueTone = item.value > 0 ? 'text-[#B5412D]' : item.value < 0 ? 'text-[#2F7A42]' : 'text-[#2F1D14]';
              const quantityTone = item.quantity > 0 ? 'text-[#B5412D]' : item.quantity < 0 ? 'text-[#2F7A42]' : 'text-[#8B6B54]';
              const meta = item.sector || item.supplier
                ? `${item.sector ?? 'Secteur'} - ${item.supplier ?? 'Fournisseur'}`
                : 'Produit importé';

              return (
                <button
                  key={item.id ?? idx}
                  type="button"
                  disabled={!onSelectItem}
                  onClick={() => onSelectItem?.(item)}
                  className={`w-full rounded-[18px] border p-3 text-left transition-all ${isSelected ? 'border-[#A85F2A] bg-[#F6DEB1]/85 shadow-[0_10px_20px_rgba(80,38,18,0.14)]' : 'border-[#E2C39B] bg-[#FFFDF8]/85 hover:border-[#C86F24] hover:bg-white'} ${onSelectItem ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2F1D14] text-[11px] font-black text-[#F1C27B]">
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black leading-tight text-[#2F1D14]" title={item.name}>{item.name}</p>
                      <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.08em] text-[#8B6B54]" title={meta}>
                        {meta}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-[#E2C39B] bg-white/70 px-2 py-1.5">
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#A85F2A]">Écart</p>
                      <p className={`mt-0.5 text-xs font-black tabular-nums ${valueTone}`}>
                        {item.value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E2C39B] bg-white/70 px-2 py-1.5">
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#A85F2A]">Qté</p>
                      <p className={`mt-0.5 text-xs font-black tabular-nums ${quantityTone}`}>
                        {item.quantity.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E2C39B] bg-white/70 px-2 py-1.5">
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#A85F2A]">CA</p>
                      <p className="mt-0.5 text-xs font-black tabular-nums text-[#6A432D]">{impact}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default EcartsList;
