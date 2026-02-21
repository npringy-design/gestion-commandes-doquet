
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
    ? 'bg-gradient-to-r from-sky-600 to-teal-600'
    : 'bg-gradient-to-r from-orange-600 to-amber-600';

  return (
    <div className="bg-white/70 backdrop-blur rounded-2xl shadow-sm border border-white/60 overflow-hidden flex flex-col h-full">
      <div className={`${headerColor} px-4 py-3`}>
        <div className="flex items-center gap-2">
          <span className="text-white/90 text-xs">{type === 'liquide' ? '🥤' : '🍽️'}</span>
          <h3 className="text-white font-extrabold tracking-tight text-[12px] uppercase">{title}</h3>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <table className="w-full text-left text-[12px]">
          <thead className="sticky top-0 bg-white/80 backdrop-blur z-10">
            <tr className="border-b border-slate-100 text-slate-500 uppercase">
              <th className="px-3 py-2 font-semibold w-8">#</th>
              <th className="px-3 py-2 font-semibold">Produit</th>
              <th className="px-3 py-2 font-semibold text-right">QTE</th>
              <th className="px-3 py-2 font-semibold text-right">€</th>
              <th className="px-3 py-2 font-semibold text-right">Impact %CA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {items.map((item, idx) => (
              <tr 
                key={item.id ?? idx}
                className={`transition-colors ${onSelectItem ? 'cursor-pointer' : ''} ${selectedId && item.id === selectedId ? 'bg-indigo-50/70 border-l-4 border-indigo-600' : 'hover:bg-white/60 border-l-4 border-transparent'}`}
                onClick={() => onSelectItem?.(item)}
              >
                <td className="px-3 py-2 text-slate-400 tabular-nums">{idx + 1}</td>
                <td className="px-3 py-2 font-medium text-slate-700 truncate max-w-[240px]" title={item.name}>
                  {item.name}
                </td>
                {/* Export: valeur positive = perte, valeur négative = gain */}
                <td className={`px-3 py-2 text-right tabular-nums ${item.quantity > 0 ? 'text-rose-500' : item.quantity < 0 ? 'text-emerald-500' : 'text-slate-500'}`}>
                  {item.quantity.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                </td>
                <td className={`px-3 py-2 text-right font-bold tabular-nums ${item.value > 0 ? 'text-rose-600' : item.value < 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {item.value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </td>
                <td className="px-3 py-2 text-right text-slate-700 tabular-nums font-semibold">
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
