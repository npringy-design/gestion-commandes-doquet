// =============================================================
// pages/DailyForecastPage.tsx
// Page de saisie des prévisions de couverts journaliers
// Extraite de App.tsx
// =============================================================

import React, { useState } from 'react';
import { View, MONTHS_DISPLAY_CONFIG } from '../constants';
import { DailyCoversState } from '../utils/dateHelpers';

interface DailyForecastPageProps {
  setView:        (v: View) => void;
  dailyCovers:    DailyCoversState;
  setDailyCovers: React.Dispatch<React.SetStateAction<DailyCoversState>>;
}

const DailyForecastPage: React.FC<DailyForecastPageProps> = ({
  setView, dailyCovers, setDailyCovers,
}) => {
  const [selectedMonth, setSelectedMonth] = useState('jan');
  const monthData = dailyCovers[selectedMonth] || [];

  const updateDay = (idx: number, field: 'midi' | 'soir', val: string) => {
    const newData = [...monthData];
    if (!newData[idx]) newData[idx] = { midi: '', soir: '' };
    newData[idx] = { ...newData[idx], [field]: val === '' ? '' : Number(val) };
    setDailyCovers(prev => ({ ...prev, [selectedMonth]: newData }));
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-8">
      <div className="max-w-[1600px] mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-black text-slate-800 uppercase tracking-tighter">
            Prévisions <span className="text-emerald-600">Journalières</span>
          </h1>
          <button
            onClick={() => setView('stats')}
            className="px-8 py-4 bg-white border-2 border-slate-200 text-slate-400 font-black uppercase text-xs rounded-2xl hover:bg-slate-50 transition-all"
          >
            Retour
          </button>
        </div>

        {/* Sélecteur de mois */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-8 custom-scrollbar">
          {MONTHS_DISPLAY_CONFIG.map(m => (
            <button
              key={m.key}
              onClick={() => setSelectedMonth(m.key)}
              className={`px-6 py-3 rounded-xl font-black text-xs uppercase transition-all whitespace-nowrap ${
                selectedMonth === m.key
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                  : 'bg-white text-slate-400 hover:bg-slate-50'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Grille des 31 jours */}
        <div className="grid grid-cols-7 gap-3">
          {['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'].map(d => (
            <div key={d} className="text-center font-black text-slate-300 text-xs uppercase py-2">{d}</div>
          ))}

          {Array.from({ length: 31 }).map((_, i) => {
            const d = monthData[i] || { midi: '', soir: '' };
            return (
              <div
                key={i}
                className="bg-white p-4 rounded-2xl border-2 border-slate-100 hover:border-emerald-200 transition-colors"
              >
                <div className="text-[10px] font-black text-slate-300 mb-3 uppercase">Jour {i + 1}</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase w-8">Midi</span>
                    <input
                      type="number"
                      value={d.midi}
                      onChange={e => updateDay(i, 'midi', e.target.value)}
                      className="w-full bg-slate-50 rounded-lg p-1.5 font-black text-center text-slate-700 text-sm outline-none focus:bg-emerald-50 focus:text-emerald-700 transition-colors"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase w-8">Soir</span>
                    <input
                      type="number"
                      value={d.soir}
                      onChange={e => updateDay(i, 'soir', e.target.value)}
                      className="w-full bg-slate-50 rounded-lg p-1.5 font-black text-center text-slate-700 text-sm outline-none focus:bg-emerald-50 focus:text-emerald-700 transition-colors"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DailyForecastPage;
