// =============================================================
// pages/SupplierSettingsPage.tsx
// Page paramètres des rotations fournisseurs (admin)
// Extraite de App.tsx
// =============================================================

import React from 'react';
import { View, DAYS_OF_WEEK } from '../constants';
import { SupplierConfig } from '../types';

interface SupplierSettingsPageProps {
  setView:    (v: View) => void;
  configs:    Record<string, SupplierConfig>;
  setConfigs: React.Dispatch<React.SetStateAction<Record<string, SupplierConfig>>>;
}

const SupplierSettingsPage: React.FC<SupplierSettingsPageProps> = ({
  setView, configs, setConfigs,
}) => (
  <div className="min-h-screen bg-[#1a0f0a] p-4 sm:p-8 lg:p-12 relative overflow-hidden">
    <div
      className="absolute inset-0 z-0 opacity-20 pointer-events-none"
      style={{ backgroundImage: `url('https://www.transparenttextures.com/patterns/brick-wall.png')` }}
    />
    <div className="max-w-4xl mx-auto relative z-10">

      {/* Header */}
      <div className="flex justify-between items-center mb-12">
        <h1 className="text-[#ffd700] text-4xl font-black uppercase">Rotation Fournisseurs</h1>
        <div className="flex gap-4">
          <button
            onClick={() => setView('admin_dashboard')}
            className="px-6 py-3 bg-white/5 text-white border border-white/10 rounded-2xl hover:bg-white/10 font-black uppercase text-xs tracking-widest transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            Retour
          </button>
          <button
            onClick={() => setView('home')}
            className="px-6 py-3 bg-[#ffd700] text-[#1a0f0a] border border-[#ffd700] rounded-2xl hover:bg-[#ffed4a] font-black uppercase text-xs tracking-widest transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
            </svg>
            Accueil
          </button>
        </div>
      </div>

      {/* Liste des fournisseurs */}
      <div className="space-y-6">
        {Object.values(configs).map((config: SupplierConfig) => (
          <div
            key={config.id}
            className="bg-white/5 border border-white/10 p-4 sm:p-6 lg:p-8 rounded-[40px] flex items-center justify-between"
          >
            <span className="text-[#ffd700] font-black uppercase text-2xl">{config.name}</span>
            <div className="flex gap-4">
              <select
                value={config.deliveryDay}
                onChange={e => setConfigs({ ...configs, [config.id]: { ...config, deliveryDay: Number(e.target.value) } })}
                className="bg-white/10 text-white p-3 rounded-xl border border-white/10 outline-none focus:border-[#ffd700] font-bold uppercase text-sm cursor-pointer hover:bg-white/20 transition-colors"
              >
                {DAYS_OF_WEEK.map((d, i) => (
                  <option key={i} value={i} className="text-black">{d}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default SupplierSettingsPage;
