// =============================================================
// pages/StatsPage.tsx
// Page paramètres mensuels : inventaire détaillé, couverts,
// coût matière (%), CA HT.
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

  const cardClass =
    'flex flex-col rounded-[20px] lg:rounded-[24px] overflow-hidden bg-white border border-slate-200 shadow-[0_10px_30px_rgba(15,23,42,0.08)] min-h-[420px] md:min-h-[480px] xl:min-h-0';

  const rowClass =
    'flex-1 flex items-center justify-between px-4 sm:px-5 lg:px-6 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors gap-3';

  const inputClass =
    'w-24 sm:w-28 h-10 bg-slate-50 border border-slate-300 rounded-lg text-center font-bold text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed';

  const monthLabelClass = 'font-extrabold text-slate-700 uppercase text-sm';
  const monthLabelWideClass = 'font-extrabold text-slate-700 uppercase text-sm w-28 shrink-0';

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-amber-50 to-orange-50 p-3 sm:p-4 lg:p-6 flex flex-col lg:flex-row gap-4 lg:gap-8 font-sans overflow-x-hidden overflow-y-auto">
      {modalState && canImport && (
        <ImportModal
          monthLabel={MONTHS_DISPLAY_CONFIG.find((m) => m.key === modalState.month)?.label || ''}
          onClose={() => setModalState(null)}
          onFileSelected={handleFile}
          type="detailed"
        />
      )}

      <div className="w-full lg:w-72 flex flex-col gap-3 sm:gap-4 shrink-0 lg:h-full py-1 lg:py-2">
        <button
          onClick={() => setView('home')}
          className="bg-amber-400 hover:bg-amber-300 text-stone-900 py-5 rounded-2xl font-black uppercase text-sm tracking-widest border border-amber-500 shadow-[0_8px_24px_rgba(120,53,15,0.12)] transition-all flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Retour Accueil
        </button>

        <div className="hidden lg:block flex-1" />

        <div className="space-y-4">
          {canOpenRatios && (
            <button
              onClick={() => setView('ratios')}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest border border-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.14)] transition-all"
            >
              Calcul
              <br />
              Vente Ratio
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 lg:h-full flex justify-center min-w-0">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5 w-full max-w-[1800px] lg:h-full">
          <div className={cardClass}>
            <div className="bg-amber-50 py-4 px-4 flex items-center justify-center border-b border-amber-100">
              <h2 className="font-extrabold text-amber-900 uppercase text-sm tracking-[0.18em]">
                Inventaire détaillé
              </h2>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
              {MONTHS_DISPLAY_CONFIG.map((m) => (
                <button
                  key={m.key}
                  onClick={() => canImport && setModalState({ month: m.key })}
                  className={`flex-1 flex items-center justify-center w-full border-b border-slate-100 last:border-0 relative group transition-colors ${
                    canImport ? 'hover:bg-amber-50' : 'opacity-70 cursor-not-allowed'
                  }`}
                  title={canImport ? 'Importer un fichier' : 'Import non autorisé pour votre rôle'}
                >
                  <span className="font-extrabold text-slate-700 uppercase text-sm group-hover:text-amber-900 transition-colors">
                    {m.label}
                  </span>

                  {detailedInventory[m.key] ? (
                    <div className="absolute right-4 flex items-center gap-2 z-10">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeInventoryForMonth(m.key);
                        }}
                        disabled={!canRemoveImport}
                        title={`Supprimer l'import ${m.label}`}
                        className="w-8 h-8 rounded-full border border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <div className="absolute right-6 w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center group-hover:border-amber-500 transition-colors">
                      <svg
                        className="w-4 h-4 text-slate-400 group-hover:text-amber-700"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className={cardClass}>
            <div className="bg-yellow-50 py-4 px-4 flex items-center justify-center border-b border-yellow-100">
              <h2 className="font-extrabold text-yellow-900 uppercase text-sm tracking-[0.18em]">
                Couverts réalisés
              </h2>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
              {MONTHS_DISPLAY_CONFIG.map((m) => (
                <div key={m.key} className={rowClass}>
                  <span className={monthLabelClass}>{m.label}</span>
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
          </div>

          <div className={cardClass}>
            <div className="bg-rose-50 py-4 px-4 flex items-center justify-center border-b border-rose-100">
              <h2 className="font-extrabold text-rose-900 uppercase text-sm tracking-[0.18em]">
                CM (%)
              </h2>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
              {MONTHS_DISPLAY_CONFIG.map((m) => (
                <div key={m.key} className={rowClass}>
                  <span className={monthLabelWideClass}>{m.label}</span>
                  <div className="w-auto sm:w-40 flex items-center justify-end">
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
                </div>
              ))}
            </div>
          </div>

          <div className={cardClass}>
            <div className="bg-sky-50 py-4 px-4 flex items-center justify-center border-b border-sky-100">
              <h2 className="font-extrabold text-sky-900 uppercase text-sm tracking-[0.18em]">
                CA HT (€)
              </h2>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
              {MONTHS_DISPLAY_CONFIG.map((m) => (
                <div key={m.key} className={rowClass}>
                  <span className={monthLabelWideClass}>{m.label}</span>
                  <div className="w-auto sm:w-40 flex items-center justify-end">
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
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsPage;
