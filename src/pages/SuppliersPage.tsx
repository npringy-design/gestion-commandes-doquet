// =============================================================
// pages/SuppliersPage.tsx
// Page de sélection du fournisseur (grille visuelle)
// =============================================================

import React from 'react';
import { View } from '../constants';
import { SupplierConfig } from '../types';
import { getSupplierVisual } from '../lib/supplierVisuals';

interface SuppliersPageProps {
  setView: (v: View) => void;
  supplierConfigs: Record<string, SupplierConfig>;
}

const SuppliersPage: React.FC<SuppliersPageProps> = ({ setView, supplierConfigs }) => {
  const cards = Object.values(supplierConfigs)
    .filter(card => !card.isArchived)
    .map(card => ({
      view: card.id as View,
      name: card.name,
      subtitle: card.subtitle || 'Fournisseur',
      visual: getSupplierVisual(card.visualKey),
    }));

  return (
    <div className="min-h-screen bg-[#1a0f0a] flex flex-col items-center p-4 sm:p-6 lg:p-8 overflow-x-hidden relative">
      <div
        className="absolute inset-0 z-0 opacity-30 pointer-events-none"
        style={{ backgroundImage: `url('https://www.transparenttextures.com/patterns/brick-wall.png')` }}
      />
      <div className="w-full max-w-[1400px] z-10 flex flex-col h-full">
        <div className="flex justify-between items-center mb-6 sm:mb-12 gap-2">
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:p-6 lg:p-8 flex-1 pb-12">
          {cards.map(card => (
            <div
              key={card.view}
              onClick={() => setView(card.view)}
              className="group cursor-pointer transform transition-all hover:-translate-y-3"
            >
              <div
                className="relative h-[240px] sm:h-[340px] lg:h-[420px] w-full rounded-[28px] sm:rounded-[40px] overflow-hidden border-4 border-[#ffd700]/20 group-hover:border-[#ffd700] shadow-2xl"
                style={card.visual.cardStyle}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-black/90 z-10" />
                <div className="absolute inset-x-0 bottom-0 p-3 sm:p-6 lg:p-8 z-20">
                  <h3 className="font-black text-2xl sm:text-4xl uppercase tracking-tighter text-white mb-1 sm:mb-2 leading-[0.92] break-words">
                    {card.name}
                  </h3>
                  <p className="text-[#ffd700] font-black uppercase tracking-widest text-[9px] opacity-90">
                    {card.subtitle}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SuppliersPage;
