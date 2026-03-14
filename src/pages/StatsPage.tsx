// =============================================================
// pages/StatsPage.tsx
// Version repensée : inventaire large en haut + 3 modules compacts dessous
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
    'rounded-[22px] border border-stone-200 bg-white shadow-[0_8px_24px_rgba(28,25,23,0.06)] overflow-hidden';

  const compactRow =
    'grid grid-cols-[1fr_auto] items-center gap-3 px-4 sm:px-5 py-3 border-b border-stone-200/80 last:border-b-0';

  const inputClass =
    'w-24 sm:w-28 h-10 rounded-xl border border-stone-300 bg-stone-50 text-center text-stone-800 font-bold text-base sm:text-lg outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed';

  const monthText = 'font-bold text-stone-700 uppercase tracking-wide text-sm';

  return (
    <div className="min-h-screen bg-[#f6f1eb] p-3 sm:p-4 lg:p-6 overflow-x-hidden overflow-y-auto">
      {modalState && canImport && (
        <ImportModal
          monthLabel={MONTHS_DISPLAY_CONFIG.find((m) => m.key === modalState.month)?.label || ''}
          onClose={() => setModalState(null)}
          onFileSelected={handleFile}
          type="detailed"
        />
      )}

      <div className="max-w-[1700px] mx-auto space-y-5">
        {/* Bandeau haut */}
        <div className={`${shellCard} px-4 sm:px-5 lg:px-6 py-4`}>
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500 font-bold mb-1">
                Paramètres mensuels
              </p>
              <h1 className="text-2xl sm:text-3xl font-black text-stone-800 tracking-tight">
                Pilotage activité
              </h1>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setView('home')}
                className="rounded-2xl bg-stone-800 hover:bg-stone-700 text-white py-3.5 px-5 font-black uppercase text-sm tracking-wider border border-stone-700 transition-all flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Retour accueil
              </button>

              {canOpenRatios && (
                <button
                  onClick={() => setView('ratios')}
                  className="rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-900 py-3.5 px-5 font-black uppercase text-xs tracking-[0.18em] border border-amber-600 transition-all"
                >
                  Calcul vente ratio
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Inventaire large */}
        <section className={shellCard}>
          <div className="px-5 sm:px-6 py-4 border-b border-stone-200 bg-stone-50">
            <p className="text-[11px] uppercase tracking-[0.24em] text-amber-700 font-bold mb-1">
              Import
            </p>
            <h2 className="text-xl sm:text-2xl font-black text-stone-800 tracking-tight">
              Inventaire détaillé
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            {MONTHS_DISPLAY_CONFIG.map((m) => (
              <button
                key={m.key}
                onClick={() => canImport && setModalState({ month: m.key })}
                className={`relative flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-r-0 sm:border-r sm:[&:nth-child(2n)]:border-r-0 xl:border-r xl:[&:nth-child(2n)]:border-r xl:[&:nth-child(4n)]:border-r-0 border-stone-200/80 hover:bg-amber-50/70 transition-colors ${
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
                      className="w-8 h-8 rounded-full border border-stone-300 bg-white hover:bg-stone-50 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>

                    <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full border border-stone-300 bg-white flex items-center justify-center">
                    <svg className="w-4 h-4 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* 3 blocs compacts */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <section className={shellCard}>
            <div className="px-5 py-4 border-b border-stone-200 bg-stone-50">
              <p className="text-[11px] uppercase tracking-[0.24em] text-yellow-700 font-bold mb-1">
                Exploitation
              </p>
              <h2 className="text-lg sm:text-xl font-black text-stone-800 tracking-tight">
                Couverts réalisés
              </h2>
            </div>

            <div>
              {MONTHS_DISPLAY_CONFIG.map((m) => (
                <div key={m.key} className={compactRow}>
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

          <section className={shellCard}>
            <div className="px-5 py-4 border-b border-stone-200 bg-stone-50">
              <p className="text-[11px] uppercase tracking-[0.24em] text-stone-600 font-bold mb-1">
                Performance
              </p>
              <h2 className="text-lg sm:text-xl font-black text-stone-800 tracking-tight">
                Coût matière (%)
              </h2>
            </div>

            <div>
              {MONTHS_DISPLAY_CONFIG.map((m) => (
                <div key={m.key} className={compactRow}>
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

          <section className={shellCard}>
            <div className="px-5 py-4 border-b border-stone-200 bg-stone-50">
              <p className="text-[11px] uppercase tracking-[0.24em] text-sky-700 font-bold mb-1">
                Chiffre d'affaires
              </p>
              <h2 className="text-lg sm:text-xl font-black text-stone-800 tracking-tight">
                CA HT (€)
              </h2>
            </div>

            <div>
              {MONTHS_DISPLAY_CONFIG.map((m) => (
                <div key={m.key} className={compactRow}>
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
