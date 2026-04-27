// =============================================================
// pages/SuppliersPage.tsx
// Page de sélection du fournisseur (grille visuelle)
// =============================================================

import React from 'react';
import { View } from '../constants';
import AppNavTile from '../components/AppNavTile';
import { SupplierConfig } from '../types';
import { getSupplierVisual } from '../lib/supplierVisuals';

interface SuppliersPageProps {
  setView: (v: View) => void;
  supplierConfigs: Record<string, SupplierConfig>;
}

const SuppliersPage: React.FC<SuppliersPageProps> = ({ setView, supplierConfigs }) => {
  const cards = (Object.values(supplierConfigs) as import('../types').SupplierConfig[])
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
      <div className="w-full max-w-[1800px] z-10 flex flex-col h-full">
        <div className="mb-6 flex flex-col items-start gap-4 sm:mb-12">
          <AppNavTile
            onClick={() => setView('home')}
            eyebrow="Retour"
            icon="home"
            tone="dark"
            size="md"
          >
            Accueil
          </AppNavTile>
          <div className="flex flex-col">
            <h2 className="text-[#ffd700] text-3xl sm:text-5xl font-black uppercase tracking-tighter leading-none mb-2">
              Fournisseurs
            </h2>
            <div className="h-1.5 w-32 bg-red-600 rounded-full" />
          </div>
        </div>

        <div
  className="grid gap-4 sm:gap-5 lg:gap-6 sm:p-4 lg:p-6 flex-1 pb-12"
  style={{
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  }}
>
          {cards.map(card => (
            <div
              key={card.view}
              onClick={() => setView(card.view)}
              className="group cursor-pointer transform transition-all duration-300 hover:-translate-y-3"
            >
              <div
                className="relative h-[220px] sm:h-[300px] lg:h-[360px] w-full rounded-[28px] sm:rounded-[36px] overflow-hidden border-4 border-[#ffd700]/20 group-hover:border-[#ffd700] shadow-2xl"
                 >
                <div
                  className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[1.08]"
                  style={card.visual.cardStyle}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/25 to-black/90 z-10" />
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
