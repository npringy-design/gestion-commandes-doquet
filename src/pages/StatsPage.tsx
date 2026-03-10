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
import { canAccessRatiosPage, canDeleteImport, canEditSettingsFields, canImportData } from '../lib/permissions';

interface StatsPageProps {
  setView:               (v: View) => void;
  covers:                Record<string, number>;
  setCovers:             React.Dispatch<React.SetStateAction<Record<string, number>>>;
  salesHtByMonth:        Record<string, number>;
  setSalesHtByMonth:     React.Dispatch<React.SetStateAction<Record<string, number>>>;
  costMatterByMonth:     Record<string, number>;
  setCostMatterByMonth:  React.Dispatch<React.SetStateAction<Record<string, number>>>;
  detailedInventory:     Record<string, string>;
  setDetailedInventory:  React.Dispatch<React.SetStateAction<Record<string, string>>>;
  validatedMonths:       Record<string, boolean>;
}

const StatsPage: React.FC<StatsPageProps> = ({
  setView,
  covers, setCovers,
  salesHtByMonth, setSalesHtByMonth,
  costMatterByMonth, setCostMatterByMonth,
  detailedInventory, setDetailedInventory,
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

  return (
    <div className="min-h-screen bg-[#2c1810] p-3 sm:p-4 lg:p-6 flex flex-col lg:flex-row gap-4 lg:gap-8 font-sans overflow-x-hidden overflow-y-auto">
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
          className="bg-[#ffd700] hover:bg-[#ffed4a] text-[#2c1810] py-6 rounded-2xl font-black uppercase text-sm tracking-widest shadow-[0_4px_0_#b39700] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
          Retour Accueil
        </button>

        <div className="hidden lg:block flex-1" />

        <div className="space-y-4">
          {canOpenRatios && (
            <button
              onClick={() => setView('ratios')}
              className="w-full bg-[#3d85c6] hover:bg-[#2b6ca8] text-white py-6 rounded-2xl font-black uppercase text-xs tracking-widest shadow-[0_4px_0_#073763] active:translate-y-1 active:shadow-none transition-all"
            >
              Calcul<br/>Vente Ratio
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 lg:h-full flex justify-center min-w-0">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6 w-full max-w-[1800px] lg:h-full">
          <div className="flex flex-col rounded-[24px] lg:rounded-[30px] overflow-hidden shadow-2xl border-4 border-[#f6b26b] bg-[#f9cb9c] min-h-[420px] md:min-h-[480px] xl:min-h-0">
            <div className="bg-[#f6b26b] py-5 flex items-center justify-center shadow-md z-10">
              <h2 className="font-black text-[#783f04] uppercase text-lg tracking-widest">Inventaire Détaillé</h2>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
              {MONTHS_DISPLAY_CONFIG.map((m) => (
                <button
                  key={m.key}
                  onClick={() => canImport && setModalState({ month: m.key })}
                  className={`flex-1 flex items-center justify-center w-full border-b border-[#f6b26b]/50 last:border-0 relative group transition-all ${canImport ? 'hover:bg-[#ff9900]' : 'opacity-70 cursor-not-allowed'}`}
                  title={canImport ? 'Importer un fichier' : 'Import non autorisé pour votre rôle'}
                >
                  <span className="font-black text-[#783f04] uppercase text-sm group-hover:scale-110 transition-transform">
                    {m.label}
                  </span>

                  {detailedInventory[m.key] ? (
                    <div className="absolute right-4 flex items-center gap-2 z-10">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeInventoryForMonth(m.key); }}
                        disabled={!canRemoveImport}
                        title={`Supprimer l'import ${m.label}`}
                        className="w-8 h-8 rounded-full border-2 border-[#c27d39] bg-[#f9cb9c] hover:bg-[#f6b26b] flex items-center justify-center shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4 text-[#783f04]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 6l12 12M18 6L6 18"/>
                        </svg>
                      </button>
                      <div className="w-8 h-8 bg-[#38761d] rounded-full flex items-center justify-center shadow-sm">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"/>
                        </svg>
                      </div>
                    </div>
                  ) : (
                    <div className="absolute right-6 w-8 h-8 rounded-full border-2 border-[#783f04]/30 flex items-center justify-center group-hover:border-[#783f04]">
                      <svg className="w-4 h-4 text-[#783f04]/50 group-hover:text-[#783f04]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/>
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col rounded-[24px] lg:rounded-[30px] overflow-hidden shadow-2xl border-4 border-[#ffd966] bg-[#fff2cc] min-h-[420px] md:min-h-[480px] xl:min-h-0">
            <div className="bg-[#ffd966] py-5 flex items-center justify-center shadow-md z-10">
              <h2 className="font-black text-[#7f6000] uppercase text-lg tracking-widest">Couverts Réalisés</h2>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
              {MONTHS_DISPLAY_CONFIG.map((m) => (
                <div key={m.key} className="flex-1 flex items-center justify-between px-4 sm:px-6 lg:px-8 border-b border-[#ffd966]/50 last:border-0 hover:bg-[#ffe599] transition-colors gap-3">
                  <span className="font-black text-[#7f6000] uppercase text-sm">{m.label}</span>
                  <input
                    type="number"
                    value={covers[m.key] || ''}
                    onChange={(e) => setCovers((p) => ({ ...p, [m.key]: Number(e.target.value) }))}
                    disabled={!canEditFields}
                    className="w-24 sm:w-28 bg-white border-2 border-[#bf9000] rounded-xl text-center font-black text-[#7f6000] outline-none focus:scale-105 focus:shadow-lg transition-all h-10 text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="-"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col rounded-[24px] lg:rounded-[30px] overflow-hidden shadow-2xl border-4 border-[#f4cccc] bg-[#fff1f1] min-h-[420px] md:min-h-[480px] xl:min-h-0">
            <div className="bg-[#ea9999] py-5 flex items-center justify-center shadow-md z-10">
              <h2 className="font-black text-[#7a1f1f] uppercase text-lg tracking-widest">CM (%)</h2>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
              {MONTHS_DISPLAY_CONFIG.map((m) => (
                <div key={m.key} className="flex-1 flex items-center justify-between px-4 sm:px-6 lg:px-8 border-b border-[#ea9999]/35 last:border-0 hover:bg-[#ffe5e5] transition-colors gap-3">
                  <span className="font-black text-[#7a1f1f] uppercase text-sm w-28 shrink-0">{m.label}</span>
                  <div className="w-auto sm:w-40 flex items-center justify-end">
                    <input
                      type="number"
                      step="0.01"
                      value={costMatterByMonth[m.key] || ''}
                      onChange={(e) => setCostMatterByMonth((p) => ({
                        ...p,
                        [m.key]: e.target.value === '' ? 0 : Number(e.target.value),
                      }))}
                      disabled={!canEditFields}
                      className="w-24 sm:w-28 h-10 bg-white border-2 border-[#e06666] rounded-xl text-center font-black text-[#7a1f1f] outline-none focus:scale-105 focus:shadow-lg transition-all text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="-"
                      title="Coût matière (%)"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col rounded-[24px] lg:rounded-[30px] overflow-hidden shadow-2xl border-4 border-[#a4c2f4] bg-[#d9eaff] min-h-[420px] md:min-h-[480px] xl:min-h-0">
            <div className="bg-[#9fc5f8] py-5 flex items-center justify-center shadow-md z-10">
              <h2 className="font-black text-[#073763] uppercase text-lg tracking-widest">CA HT (€)</h2>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
              {MONTHS_DISPLAY_CONFIG.map((m) => (
                <div key={m.key} className="flex-1 flex items-center justify-between px-4 sm:px-6 lg:px-8 border-b border-[#9fc5f8]/40 last:border-0 hover:bg-[#cfe2ff] transition-colors gap-3">
                  <span className="font-black text-[#073763] uppercase text-sm w-28 shrink-0">{m.label}</span>
                  <div className="w-auto sm:w-40 flex items-center justify-end">
                    <input
                      type="number"
                      step="0.01"
                      value={salesHtByMonth[m.key] || ''}
                      onChange={(e) => setSalesHtByMonth((p) => ({
                        ...p,
                        [m.key]: e.target.value === '' ? 0 : Number(e.target.value),
                      }))}
                      disabled={!canEditFields}
                      className="w-24 sm:w-28 h-10 bg-white border-2 border-[#6fa8dc] rounded-xl text-center font-black text-[#073763] outline-none focus:scale-105 focus:shadow-lg transition-all text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
