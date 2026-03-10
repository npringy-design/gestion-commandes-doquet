// =============================================================
// pages/SuppliersPage.tsx
// Page de sélection du fournisseur (grille enrichie sans images)
// =============================================================

import React from 'react';
import { DAYS_OF_WEEK, View } from '../constants';
import { DeliveryRule, SupplierConfig } from '../types';

interface SuppliersPageProps {
  setView: (v: View) => void;
  supplierConfigs: Record<string, SupplierConfig>;
}

interface SupplierCard {
  view: View;
  name: string;
  subtitle: string;
  cutoffLabel: string;
  deliveryLabel: string;
  rulesCount: number;
}

const STATIC_SUPPLIER_CARDS: SupplierCard[] = [
  {
    view: 'doquet' as View,
    name: 'DOQUET',
    subtitle: 'Softs • Jus • Cocktails',
    cutoffLabel: 'Mardi 10:00',
    deliveryLabel: 'Mercredi',
    rulesCount: 1,
  },
  {
    view: 'vins' as View,
    name: 'Richard Vins',
    subtitle: 'Cave • Alcools',
    cutoffLabel: 'Mardi 10:00',
    deliveryLabel: 'Vendredi',
    rulesCount: 1,
  },
  {
    view: 'viandes' as View,
    name: 'Plaine Maison',
    subtitle: 'Boucherie • Grill',
    cutoffLabel: 'Veille 10:00',
    deliveryLabel: 'Flexible',
    rulesCount: 1,
  },
  {
    view: 'domafrais' as View,
    name: 'Domafrais Viandes',
    subtitle: 'Viandes • Volailles',
    cutoffLabel: 'Lundi 10:00',
    deliveryLabel: 'Mercredi',
    rulesCount: 2,
  },
  {
    view: 'domafrais_bof' as View,
    name: 'Domafrais B.O.F',
    subtitle: 'Crémerie • Fromages',
    cutoffLabel: 'Lundi 10:00',
    deliveryLabel: 'Mercredi',
    rulesCount: 2,
  },
  {
    view: 'pomona_terre_azur' as View,
    name: 'Pomona Terre Azur',
    subtitle: 'Fruits • Légumes',
    cutoffLabel: 'Veille 10:00',
    deliveryLabel: 'Flexible',
    rulesCount: 1,
  },
  {
    view: 'pomona_episaveurs' as View,
    name: 'Pomona Episaveurs',
    subtitle: 'Épicerie • Aides culinaires',
    cutoffLabel: 'Mardi 10:00',
    deliveryLabel: 'Jeudi',
    rulesCount: 1,
  },
  {
    view: 'domafrais_surgele' as View,
    name: 'Domafrais Surgelé',
    subtitle: 'Surgelés • Glaces',
    cutoffLabel: 'Mardi 10:00',
    deliveryLabel: 'Mercredi',
    rulesCount: 1,
  },
];

const getRules = (config: SupplierConfig): DeliveryRule[] => {
  if (config.deliveryRules && config.deliveryRules.length > 0) return config.deliveryRules;
  return [{ cutoffDay: config.cutoffDay, deliveryDay: config.deliveryDay }];
};

const buildCard = (config: SupplierConfig): SupplierCard => {
  const rules = getRules(config);
  const firstRule = rules[0];

  return {
    view: config.id as View,
    name: config.name,
    subtitle: config.subtitle || 'Fournisseur',
    cutoffLabel: firstRule
      ? `${DAYS_OF_WEEK[firstRule.cutoffDay]} ${config.cutoffTime}`
      : `Non défini ${config.cutoffTime || ''}`.trim(),
    deliveryLabel: config.flexibleDelivery
      ? 'Flexible'
      : firstRule
        ? DAYS_OF_WEEK[firstRule.deliveryDay]
        : 'Non définie',
    rulesCount: rules.length,
  };
};

const SuppliersPage: React.FC<SuppliersPageProps> = ({ setView, supplierConfigs }) => {
  const dynamicCards = Object.values(supplierConfigs)
    .filter((card) => !card.isArchived)
    .map(buildCard);

  const cards = dynamicCards.length > 0 ? dynamicCards : STATIC_SUPPLIER_CARDS;

  return (
    <div className="min-h-screen bg-[#1a0f0a] flex flex-col items-center p-4 sm:p-6 lg:p-8 overflow-x-hidden relative">
      <div
        className="absolute inset-0 z-0 opacity-30 pointer-events-none"
        style={{ backgroundImage: `url('https://www.transparenttextures.com/patterns/brick-wall.png')` }}
      />
      <div className="w-full max-w-[1480px] z-10 flex flex-col h-full">
        <div className="flex justify-between items-center mb-6 sm:mb-10 gap-2">
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:p-4 lg:p-6 flex-1 pb-12">
          {cards.map((card) => (
            <button
              key={card.view}
              onClick={() => setView(card.view)}
              className="group relative text-left rounded-[28px] sm:rounded-[34px] overflow-hidden border-4 border-[#ffd700]/20 hover:border-[#ffd700] shadow-2xl min-h-[300px] sm:min-h-[340px] transition-all duration-300 hover:-translate-y-2"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-[#2a1a14] via-[#1a0f0a] to-black group-hover:brightness-110 transition-all duration-500" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,215,0,0.14),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.05),transparent_30%)]" />
              <div className="absolute top-5 left-5 right-5 z-20 flex items-start justify-between gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 backdrop-blur flex items-center justify-center text-[#ffd700] font-black text-xl shadow-lg">
                  {card.name.charAt(0)}
                </div>
                <div className="rounded-full bg-emerald-500/15 border border-emerald-400/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200">
                  Actif
                </div>
              </div>

              <div className="relative z-20 h-full flex flex-col justify-between p-6 sm:p-7 lg:p-8">
                <div className="pt-16">
                  <h3 className="font-black text-2xl sm:text-4xl uppercase tracking-tighter text-white leading-[0.95] mb-2 break-words">
                    {card.name}
                  </h3>
                  <p className="text-[#ffd700] font-black uppercase tracking-[0.18em] text-[10px] opacity-90">
                    {card.subtitle}
                  </p>
                </div>

                <div className="space-y-3 mt-8">
                  <div className="grid grid-cols-1 gap-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur px-4 py-3">
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/45 mb-1">Cut-off</div>
                      <div className="text-sm font-black text-white">{card.cutoffLabel}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur px-4 py-3">
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/45 mb-1">Livraison</div>
                      <div className="text-sm font-black text-white">{card.deliveryLabel}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/45 mb-1">Règles</div>
                      <div className="text-sm font-black text-white">{card.rulesCount} active{card.rulesCount > 1 ? 's' : ''}</div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-[#ffd700] text-[#1a0f0a] flex items-center justify-center shadow-lg font-black text-lg group-hover:scale-110 transition-transform">
                      →
                    </div>
                  </div>
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
