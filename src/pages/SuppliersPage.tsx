// =============================================================
// pages/SuppliersPage.tsx
// Page de sélection du fournisseur
// =============================================================

import React from 'react';
import { View } from '../constants';
import { SupplierConfig } from '../types';
import { getSupplierVisual } from '../lib/supplierVisuals';

interface SuppliersPageProps {
  setView: (v: View) => void;
  configs?: Record<string, SupplierConfig>;
}

const SUPPLIER_VIEW_ORDER: View[] = [
  'doquet',
  'vins',
  'viandes',
  'domafrais',
  'domafrais_bof',
  'pomona_terre_azur',
  'pomona_episaveurs',
  'domafrais_surgele',
];

const FALLBACK_LABELS: Record<string, { name: string; subtitle: string }> = {
  doquet: { name: 'DOQUET', subtitle: 'Softs • Jus • Cocktails' },
  vins: { name: 'RICHARD VINS', subtitle: 'Cave • Alcools' },
  viandes: { name: 'PLAINE MAISON', subtitle: 'Boucherie • Grill' },
  domafrais: { name: 'DOMAFRAIS VIANDES', subtitle: 'Viandes • Volailles' },
  domafrais_bof: { name: 'DOMAFRAIS B.O.F', subtitle: 'Crémerie • Fromages' },
  pomona_terre_azur: { name: 'POMONA TERRE AZUR', subtitle: 'Fruits • Légumes' },
  pomona_episaveurs: { name: 'POMONA EPISAVEURS', subtitle: 'Épicerie • Aides culinaires' },
  domafrais_surgele: { name: 'DOMAFRAIS SURGELÉ', subtitle: 'Surgelés • Glaces' },
};

const SuppliersPage: React.FC<SuppliersPageProps> = ({ setView, configs = {} }) => {
  const cards = SUPPLIER_VIEW_ORDER.map((view) => {
    const config = configs[view];
    const fallback = FALLBACK_LABELS[view];
    return {
      view,
      name: (config?.name || fallback?.name || String(view)).toUpperCase(),
      subtitle: config?.subtitle || fallback?.subtitle || '',
      visual: getSupplierVisual(config?.visualKey),
    };
  });

  return (
    <div className="min-h-screen bg-[#1a0f0a] flex flex-col items-center p-4 sm:p-6 lg:p-8 overflow-x-hidden relative">
      <div
        className="absolute inset-0 z-0 opacity-30 pointer-events-none"
        style={{ backgroundImage: `url('https://www.transparenttextures.com/patterns/brick-wall.png')` }}
      />
      <div className="w-full max-w-[1440px] z-10 flex flex-col h-full">
        <div className="flex justify-between items-center mb-6 sm:mb-10 gap-3">
          <div className="flex flex-col">
            <h2 className="text-[#ffd700] text-3xl sm:text-5xl font-black uppercase tracking-tighter leading-none mb-2">
              Fournisseurs
            </h2>
            <div className="h-1.5 w-32 bg-red-600 rounded-full" />
          </div>
          <button
            onClick={() => setView('home')}
            className="px-4 sm:px-8 py-3 sm:py-4 bg-gradient-to-b from-[#e5e5e5] to-[#a3a3a3] rounded-2xl shadow-[0_4px_0_#525252] sm:shadow-[0_8px_0_#525252] active:translate-y-1 transition-all shrink-0"
          >
            <span className="font-black text-slate-800 uppercase text-sm sm:text-lg tracking-tight">Accueil</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 lg:gap-7 flex-1 pb-12">
          {cards.map((card) => (
            <button
              key={card.view}
              onClick={() => setView(card.view)}
              className="group text-left focus:outline-none"
            >
              <div
                className="relative h-[260px] sm:h-[360px] lg:h-[430px] w-full rounded-[30px] sm:rounded-[42px] overflow-hidden border border-white/10 shadow-[0_18px_45px_rgba(0,0,0,0.35)] transition-all duration-300 group-hover:-translate-y-2 group-hover:shadow-[0_28px_65px_rgba(0,0,0,0.45)] group-hover:border-[#ffd700]/60"
                style={card.visual.cardStyle}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/15 to-black/80" />
                <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${card.visual.accentClassName}`} />

                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 lg:p-7 z-10">
                  <div className="inline-flex items-center rounded-full bg-black/30 border border-white/15 px-3 py-1 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.22em] text-white/85 mb-3 backdrop-blur-sm">
                    {card.subtitle || 'Fournisseur'}
                  </div>
                  <h3 className="font-black text-[30px] sm:text-[38px] lg:text-[44px] leading-[0.92] uppercase tracking-[-0.04em] text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)] max-w-[85%]">
                    {card.name}
                  </h3>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SuppliersPage;
