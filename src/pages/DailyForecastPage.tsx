// =============================================================
// pages/DailyForecastPage.tsx
// Page de saisie des prévisions de couverts journaliers
// Extraite de App.tsx
// =============================================================

import React, { useMemo, useState } from 'react';
import { View, MONTHS_DISPLAY_CONFIG } from '../constants';
import AppNavTile from '../components/AppNavTile';
import { DailyCoversState } from '../utils/dateHelpers';
import { useAuth } from '../auth/AuthProvider';
import { canEditPreviCouverts } from '../lib/permissions';

interface DailyForecastPageProps {
  setView:        (v: View) => void;
  dailyCovers:    DailyCoversState;
  setDailyCovers: React.Dispatch<React.SetStateAction<DailyCoversState>>;
}

const DailyForecastPage: React.FC<DailyForecastPageProps> = ({
  setView, dailyCovers, setDailyCovers,
}) => {
  const [selectedMonth, setSelectedMonth] = useState('jan');
  const { profile } = useAuth();
  const canEdit = canEditPreviCouverts(profile);
  const monthData = dailyCovers[selectedMonth] || [];
  const monthTotal = useMemo(() => monthData.reduce((acc, d) => acc + Number(d?.midi || 0) + Number(d?.soir || 0), 0), [monthData]);

  const updateDay = (idx: number, field: 'midi' | 'soir', val: string) => {
    const newData = [...monthData];
    if (!newData[idx]) newData[idx] = { midi: '', soir: '' };
    newData[idx] = { ...newData[idx], [field]: val === '' ? '' : Number(val) };
    setDailyCovers(prev => ({ ...prev, [selectedMonth]: newData }));
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-3 sm:p-5 lg:p-8">
      <div className="max-w-[1600px] mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-800 uppercase tracking-tighter leading-tight">
            Prévisions <span className="text-emerald-600">Journalières</span>
          </h1>
          <AppNavTile
            onClick={() => setView('admin_dashboard')}
            eyebrow="Retour"
            icon="back"
            size="md"
            className="w-full sm:w-auto"
          >
            Dashboard
          </AppNavTile>
        </div>

        {!canEdit && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Lecture seule pour votre rôle sur les prévisions couverts.
          </div>
        )}

        <div className="mb-4 sm:mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-sm">
            <p className="text-[11px] uppercase font-black text-slate-400">Mois sélectionné</p>
            <p className="text-lg font-black text-slate-800">{MONTHS_DISPLAY_CONFIG.find(m => m.key === selectedMonth)?.label ?? selectedMonth}</p>
          </div>
          <div className="bg-emerald-50 rounded-2xl border border-emerald-200 px-4 py-3 shadow-sm">
            <p className="text-[11px] uppercase font-black text-emerald-700">Total saisi</p>
            <p className="text-xl font-black text-emerald-800">{monthTotal.toLocaleString('fr-FR')}</p>
          </div>
        </div>

        {/* Sélecteur de mois */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 sm:mb-8 custom-scrollbar">
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
        <div className="hidden lg:grid grid-cols-7 gap-3 mb-2">
          {['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'].map(d => (
            <div key={d} className="text-center font-black text-slate-300 text-xs uppercase py-2">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2 sm:gap-3">
          {Array.from({ length: 31 }).map((_, i) => {
            const d = monthData[i] || { midi: '', soir: '' };
            return (
              <div
                key={i}
                className="bg-white p-3 sm:p-4 rounded-2xl border-2 border-slate-100 hover:border-emerald-200 transition-colors"
              >
                <div className="text-[10px] font-black text-slate-400 mb-2 uppercase">Jour {i + 1}</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase w-9">Midi</span>
                    <input
                      type="number" inputMode="numeric"
                      value={d.midi}
                      onChange={e => updateDay(i, 'midi', e.target.value)}
                      disabled={!canEdit}
                      className="w-full bg-slate-50 rounded-lg p-1.5 font-black text-center text-slate-700 text-sm outline-none focus:bg-emerald-50 focus:text-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase w-9">Soir</span>
                    <input
                      type="number" inputMode="numeric"
                      value={d.soir}
                      onChange={e => updateDay(i, 'soir', e.target.value)}
                      disabled={!canEdit}
                      className="w-full bg-slate-50 rounded-lg p-1.5 font-black text-center text-slate-700 text-sm outline-none focus:bg-emerald-50 focus:text-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
