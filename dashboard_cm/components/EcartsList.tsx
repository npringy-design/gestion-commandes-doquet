
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
    <div className="bg-[#FFF7EA]/90 backdrop-blur rounded-[22px] shadow-[0_12px_26px_rgba(80,38,18,0.12)] border border-[#D8AE77] overflow-hidden flex flex-col h-full min-h-0">
      <div className={`${headerColor} px-3 sm:px-4 py-2.5 sm:py-3`}>
        <div className="flex items-center gap-2">
          <span className="text-white/90 text-xs">{type === 'liquide' ? '🥤' : '🍽️'}</span>
          <h3 className="text-white font-extrabold tracking-tight text-[12px] uppercase">{title}</h3>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <table className="w-full table-fixed text-left text-[10px] sm:text-[11px]">
          <thead className="sticky top-0 bg-[#FFF7EA]/95 backdrop-blur z-10">
            <tr className="border-b border-[#E2C39B] text-[#8B5A35] uppercase">
              <th className="px-2 sm:px-3 py-2 font-semibold w-8">#</th>
              <th className="px-2 sm:px-3 py-2 font-semibold w-[48%]">Produit</th>
              <th className="hidden sm:table-cell px-2 sm:px-3 py-2 font-semibold text-right w-[16%]">QTE</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-right w-[18%]">€</th>
              <th className="hidden lg:table-cell px-2 sm:px-3 py-2 font-semibold text-right w-[18%]">Impact %CA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EED7B8]">
            {items.map((item, idx) => (
              <tr 
                key={item.id ?? idx}
                className={`transition-colors ${onSelectItem ? 'cursor-pointer' : ''} ${selectedId && item.id === selectedId ? 'bg-[#F6DEB1]/70 border-l-4 border-[#A85F2A]' : 'hover:bg-white/70 border-l-4 border-transparent'}`}
                onClick={() => onSelectItem?.(item)}
              >
                <td className="px-2 sm:px-3 py-2 text-[#A98A6E] tabular-nums">{idx + 1}</td>
                <td className="px-2 sm:px-3 py-2 font-bold text-[#3A2116] whitespace-normal break-words leading-tight" title={item.name}>
                  {item.name}
                </td>
                {/* Export: valeur positive = perte, valeur négative = gain */}
                <td className={`hidden sm:table-cell px-3 py-2 text-right tabular-nums ${item.quantity > 0 ? 'text-[#B5412D]' : item.quantity < 0 ? 'text-[#2F7A42]' : 'text-[#8B6B54]'}`}>
                  {item.quantity.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                </td>
                <td className={`px-2 sm:px-3 py-2 text-right font-black tabular-nums ${item.value > 0 ? 'text-[#B5412D]' : item.value < 0 ? 'text-[#2F7A42]' : 'text-[#2F1D14]'}`}>
                  {item.value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </td>
                <td className="hidden lg:table-cell px-3 py-2 text-right text-[#6A432D] tabular-nums font-semibold">
                  {periodSales && periodSales > 0
                    ? `${((item.value / periodSales) * 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EcartsList;
