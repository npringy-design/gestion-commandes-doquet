// =============================================================
// pages/StatsPage.tsx
// Version essai 2 : pilotage compact
// =============================================================

import React, { useState } from 'react';
import { readFileAsCSV } from '../utils/csvHelpers';
import { useToast } from '../components/Toast';
import { View, MONTHS_DISPLAY_CONFIG } from '../constants';
import { ImportModal } from '../components/Modals';
import { useAuth } from '../auth/AuthProvider';
import {
  canAccessRatiosPage,
  canDeleteImport,
  canEditSettingsFields,
  canImportData,
} from '../lib/permissions';

interface StatsPageProps {
  setView: (v: View) => void;
  covers: Record<string, number>;
  setCovers: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  salesHtByMonth: Record<string, number>;
  setSalesHtByMonth: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  costMatterByMonth: Record<string, number>;
  setCostMatterByMonth: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  detailedInventory: Record<string, string>;
  setDetailedInventory: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  validatedMonths: Record<string, boolean>;
}

const StatsPage: React.FC<StatsPageProps> = ({
  setView,
  covers,
  setCovers,
  salesHtByMonth,
  setSalesHtByMonth,
  costMatterByMonth,
  setCostMatterByMonth,
  detailedInventory,
  setDetailedInventory,
  validatedMonths,
}) => {
  const { profile } = useAuth();
  const canImport = canImportData(profile);
  const canRemoveImport = canDeleteImport(profile);
  const canEditFields = canEditSettingsFields(profile);
  const canOpenRatios = canAccessRatiosPage(profile);
  const [modalState, setModalState] = useState<{ month: string } | null>(null);
  const { showToast } = useToast();

  const resolveImportTargetMonth = (requestedMonth: string) => {
    if (!validatedMonths[requestedMonth]) return requestedMonth;
    const startIndex = MONTHS_DISPLAY_CONFIG.findIndex((m) => m.key === requestedMonth);
    if (startIndex === -1) return requestedMonth;
    for (let i = startIndex + 1; i < MONTHS_DISPLAY_CONFIG.length; i++) {
      const key = MONTHS_DISPLAY_CONFIG[i].key;
      if (!validatedMonths[key]) return key;
    }
    return requestedMonth;
  };

  const handleFile = async (file: File) => {
    if (!modalState || !canImport) return;
    try {
      const content = await readFileAsCSV(file);
      const targetMonth = resolveImportTargetMonth(modalState.month);
      setDetailedInventory((prev) => ({ ...prev, [targetMonth]: content }));
      showToast(`Import ${targetMonth.toUpperCase()} réussi ✓`, 'success');
      setModalState(null);
    } catch (err) {
      showToast('Erreur lors de la lecture du fichier : ' + (err as Error).message, 'error');
    }
  };

  const removeInventoryForMonth = (monthKey: string) => {
    if (!canRemoveImport) return;
    setDetailedInventory((prev) => {
      if (!prev?.[monthKey]) return prev;
      const next = { ...prev };
      delete next[monthKey];
      return next;
    });
  };

  const shellCard =
    'rounded-[22px] border border-white/70 bg-white/94 backdrop-blur-sm shadow-[0_12px_30px_rgba(90,52,24,0.10)] overflow-hidden';

  const rowBase =
    'grid grid-cols-[1fr_auto] items-center gap-3 px-4 sm:px-5 py-2.5 border-b border-stone-200/70 last:border-b-0 hover:bg-stone-50/70 transition-colors';

  const inputClass =
    'w-24 sm:w-28 h-10 rounded-xl border border-stone-300 bg-white text-center text-stone-800 font-bold text-lg outline-none shadow-sm transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-200 disabled:opacity-50 disabled:cursor-not-allowed';

  const monthText = 'font-extrabold text-stone-700 uppercase tracking-wide text-sm';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#fff8f1_0%,_#f5e7d8_42%,_#ead8c7_100%)] p-3 sm:p-4 lg:p-5 overflow-x-hidden overflow-y-auto">
      {modalState && canImport && (
        <ImportModal
          monthLabel={MONTHS_DISPLAY_CONFIG.find((m) => m.key === modalState.month)?.label || ''}
          onClose={() => setModalState(null)}
          onFileSelected={handleFile}
          type="detailed"
        />
      )}

      <div className="max-w-[1850px] mx-auto space-y-5">
        {/* Bandeau haut */}
        <div className={`${shellCard} p-4 sm:p-5`}>
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-stone-500 font-bold mb-1">
                Paramètres mensuels
              </p>
              <h1 className="text-2xl sm:text-3xl font-black text-stone-800 tracking-tight leading-none">
                Pilotage activité
              </h1>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 xl:justify-end">
              <button
                onClick={() => setView('home')}
                className="rounded-2xl bg-gradient-to-r from-amber-400 to-orange-300 hover:from-amber-300 hover:to-orange-200 text-stone-900 py-3.5 px-5 font-black uppercase text-sm tracking-wider border border-amber-500 shadow-[0_8px_20px_rgba(120,53,15,0.14)] transition-all flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Retour accueil
              </button>

              {canOpenRatios && (
                <button
                  onClick={() => setView('ratios')}
                  className="rounded-2xl bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-white py-3.5 px-5 font-black uppercase text-xs tracking-[0.18em] border border-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.16)] transition-all"
                >
                  Calcul vente ratio
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Grille principale */}
        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4 lg:gap-5">
          {/* Inventaire */}
          <section className={shellCard}>
            <div className="px-5 sm:px-6 py-4 border-b border-amber-100 bg-gradient-to-r from-amber-100 via-orange-50 to-amber-50">
              <p className="text-[11px] uppercase tracking-[0.25em] text-amber-700 font-bold mb-1">
                Import
              </p>
              <h2 className="text-lg sm:text-xl font-black text-stone-800 tracking-tight">
                Inventaire détaillé
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2">
              {MONTHS_DISPLAY_CONFIG.map((m) => (
                <button
                  key={m.key}
                  onClick={() => canImport && setModalState({ month: m.key })}
                  className={`relative flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-stone-200/70 sm:[&:nth-last-child(-n+2)]:border-b-0 hover:bg-amber-50/60 transition-colors ${
                    canImport ? '' : 'opacity-70 cursor-not-allowed'
                  }`}
                  title={canImport ? 'Importer un fichier' : 'Import non autorisé pour votre rôle'}
                >
                  <span className={monthText}>{m.label}</span>

                  {detailedInventory[m.key] ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeInventoryForMonth(m.key);
                        }}
                        disabled={!canRemoveImport}
                        title={`Supprimer l'import ${m.label}`}
                        className="w-8 h-8 rounded-full border border-stone-300 bg-white hover:bg-stone-50 flex items-center justify-center shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>

                      <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center shadow-sm">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full border border-stone-300 bg-white flex items-center justify-center shadow-sm">
                      <svg className="w-4 h-4 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Couverts */}
          <section className={shellCard}>
            <div className="px-5 sm:px-6 py-4 border-b border-yellow-100 bg-gradient-to-r from-yellow-100 via-amber-50 to-yellow-50">
              <p className="text-[11px] uppercase tracking-[0.25em] text-yellow-700 font-bold mb-1">
                Exploitation
              </p>
              <h2 className="text-lg sm:text-xl font-black text-stone-800 tracking-tight">
                Couverts réalisés
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2">
              {MONTHS_DISPLAY_CONFIG.map((m) => (
                <div key={m.key} className={`${rowBase} sm:[&:nth-last-child(-n+2)]:border-b-0`}>
                  <span className={monthText}>{m.label}</span>
                  <input
                    type="number"
                    value={covers[m.key] || ''}
                    onChange={(e) => setCovers((p) => ({ ...p, [m.key]: Number(e.target.value) }))}
                    disabled={!canEditFields}
                    className={inputClass}
                    placeholder="-"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* CM */}
          <section className={shellCard}>
            <div className="px-5 sm:px-6 py-4 border-b border-stone-200 bg-gradient-to-r from-stone-200 via-stone-100 to-amber-50">
              <p className="text-[11px] uppercase tracking-[0.25em] text-stone-600 font-bold mb-1">
                Performance
              </p>
              <h2 className="text-lg sm:text-xl font-black text-stone-800 tracking-tight">
                Coût matière (%)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2">
              {MONTHS_DISPLAY_CONFIG.map((m) => (
                <div key={m.key} className={`${rowBase} sm:[&:nth-last-child(-n+2)]:border-b-0`}>
                  <span className={monthText}>{m.label}</span>
                  <input
                    type="number"
                    step="0.01"
                    value={costMatterByMonth[m.key] || ''}
                    onChange={(e) =>
                      setCostMatterByMonth((p) => ({
                        ...p,
                        [m.key]: e.target.value === '' ? 0 : Number(e.target.value),
                      }))
                    }
                    disabled={!canEditFields}
                    className={inputClass}
                    placeholder="-"
                    title="Coût matière (%)"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* CA */}
          <section className={shellCard}>
            <div className="px-5 sm:px-6 py-4 border-b border-sky-100 bg-gradient-to-r from-sky-100 via-blue-50 to-sky-50">
              <p className="text-[11px] uppercase tracking-[0.25em] text-sky-700 font-bold mb-1">
                Chiffre d'affaires
              </p>
              <h2 className="text-lg sm:text-xl font-black text-stone-800 tracking-tight">
                CA HT (€)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2">
              {MONTHS_DISPLAY_CONFIG.map((m) => (
                <div key={m.key} className={`${rowBase} sm:[&:nth-last-child(-n+2)]:border-b-0`}>
                  <span className={monthText}>{m.label}</span>
                  <input
                    type="number"
                    step="0.01"
                    value={salesHtByMonth[m.key] || ''}
                    onChange={(e) =>
                      setSalesHtByMonth((p) => ({
                        ...p,
                        [m.key]: e.target.value === '' ? 0 : Number(e.target.value),
                      }))
                    }
                    disabled={!canEditFields}
                    className={inputClass}
                    placeholder="-"
                    title="Chiffre d'affaires HT"
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default StatsPage;
