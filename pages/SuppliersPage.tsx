// =============================================================
// pages/SuppliersPage.tsx
// Page de sélection du fournisseur (grille avec photos)
// Extraite de App.tsx
// =============================================================

import React from 'react';
import { View } from '../constants';

interface SuppliersPageProps {
  setView: (v: View) => void;
}

// Données visuelles de chaque fournisseur
const SUPPLIER_CARDS = [
  {
    view:     'doquet'        as View,
    name:     'DOQUET',
    subtitle: 'Softs • Jus • Cocktails',
  },
  {
    view:     'vins'          as View,
    name:     'Richard Vins',
    subtitle: 'Cave • Alcools',
  },
  {
    view:     'viandes'       as View,
    name:     'Plaine Maison',
    subtitle: 'Boucherie • Grill',
  },
  {
    view:     'domafrais'     as View,
    name:     'Domafrais Viandes',
    subtitle: 'Viandes • Volailles',
  },
  {
    view:     'domafrais_bof' as View,
    name:     'Domafrais B.O.F',
    subtitle: 'Crémerie • Fromages',
  },

  {
    view:     'pomona_episaveurs' as View,
    name:     'Pomona Episaveurs',
    subtitle: 'Épicerie • Aides culinaires',
  },
  // Sans image externe pour éviter les conflits de merge GitHub
  {
    view:     'domafrais_surgele' as View,
    name:     'Domafrais Surgelé',
    subtitle: 'Surgelés • Glaces',
  },
];

const SuppliersPage: React.FC<SuppliersPageProps> = ({ setView }) => (
  <div className="min-h-screen bg-[#1a0f0a] flex flex-col items-center p-4 sm:p-6 lg:p-8 overflow-x-hidden relative">
    <div
      className="absolute inset-0 z-0 opacity-30 pointer-events-none"
      style={{ backgroundImage: `url('https://www.transparenttextures.com/patterns/brick-wall.png')` }}
    />
    <div className="w-full max-w-[1400px] z-10 flex flex-col h-full">

      {/* Header */}
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

      {/* Grille de cartes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:p-6 lg:p-8 flex-1 pb-12">
        {SUPPLIER_CARDS.map(card => (
          <div
            key={card.view}
            onClick={() => setView(card.view)}
            className="group cursor-pointer transform transition-all hover:-translate-y-3"
          >
            <div className="relative h-[240px] sm:h-[340px] lg:h-[420px] w-full bg-[#1a0f0a] rounded-[28px] sm:rounded-[40px] overflow-hidden border-4 border-[#ffd700]/20 group-hover:border-[#ffd700] shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/95 z-10" />
              <div className="w-full h-full bg-gradient-to-b from-[#2a1a14] via-[#1a0f0a] to-black group-hover:brightness-110 transition-all duration-500" />
              <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-6 lg:p-8 z-20">
                <h3 className="font-black text-2xl sm:text-4xl uppercase tracking-tighter text-white mb-1 sm:mb-2">{card.name}</h3>
                <p className="text-[#ffd700] font-black uppercase tracking-widest text-[9px] opacity-80">{card.subtitle}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default SuppliersPage;