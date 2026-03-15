// =============================================================
// pages/StatsPage.tsx
// Refonte visuelle uniquement - mécanique conservée
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

  const renderMonthLabel = (label: string, tone: string) => (
    <span className={`font-black uppercase tracking-[0.08em] text-[12px] sm:text-[13px] ${tone}`}>
      {label}
    </span>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#4a2318_0%,#2b140f_35%,#1c0f0c_100%)] text-[#F6EBDD] overflow-x-hidden overflow-y-auto">
      {modalState && canImport && (
        <ImportModal
          monthLabel={MONTHS_DISPLAY_CONFIG.find((m) => m.key === modalState.month)?.label || ''}
          onClose={() => setModalState(null)}
          onFileSelected={handleFile}
          type="detailed"
        />
      )}

      <div className="mx-auto flex max-w-[1800px] flex-col gap-5 p-3 sm:p-4 lg:flex-row lg:gap-7 lg:p-6">
        {/* COLONNE ACTIONS */}
        <aside className="w-full shrink-0 lg:w-72">
          <div className="flex flex-col gap-4 lg:sticky lg:top-6">
            <div className="overflow-hidden rounded-[26px] border border-[#7a4a33] bg-[linear-gradient(180deg,#2c1712_0%,#23120e_100%)] shadow-[0_14px_32px_rgba(0,0,0,0.28)]">
              <div className="h-1.5 bg-gradient-to-r from-[#a56a3b] via-[#8f3f32] to-[#6e2f3a]" />
              <div className="p-4 sm:p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#d7b89b]">
                  Hippopotamus Thillois
                </p>
                <h1 className="mt-3 text-3xl font-black leading-none text-[#fff4e8]">
                  Paramètres
                </h1>
              </div>
            </div>

            <button
              onClick={() => setView('home')}
              className="flex items-center justify-center gap-3 rounded-[22px] border border-[#c3953f] bg-[linear-gradient(180deg,#e1b62b_0%,#c99612_100%)] px-5 py-5 text-center text-sm font-black uppercase tracking-[0.16em] text-[#2b140f] shadow-[0_5px_0_#8f6904] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_3px_0_#8f6904]"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Retour accueil
            </button>

            {canOpenRatios && (
              <button
                onClick={() => setView('ratios')}
                className="rounded-[22px] border border-[#4e6980] bg-[linear-gradient(180deg,#5d7c96_0%,#3f5d74_100%)] px-5 py-6 text-center text-xs font-black uppercase tracking-[0.16em] text-[#f3ede7] shadow-[0_5px_0_#243847] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_3px_0_#243847]"
              >
                Calcul
                <br />
                Vente ratio
              </button>
            )}
          </div>
        </aside>

        {/* 4 BLOCS */}
        <main className="min-w-0 flex-1">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4 xl:items-stretch">
            {/* INVENTAIRE */}
            <section className="flex min-h-[500px] flex-col overflow-hidden rounded-[28px] border border-[#8b5a3d] bg-[linear-gradient(180deg,#e1b17c_0%,#d29a63_100%)] shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
              <div className="border-b border-[#9c6b48] bg-[linear-gradient(180deg,#c48750_0%,#b3713c_100%)] px-5 py-5 text-center">
                <h2 className="text-[18px] font-black uppercase tracking-[0.12em] text-[#4e250d]">
                  Inventaire détaillé
                </h2>
              </div>

              <div className="flex flex-1 flex-col">
                {MONTHS_DISPLAY_CONFIG.map((m, index) => {
                  const hasImport = !!detailedInventory[m.key];
                  return (
                    <button
                      key={m.key}
                      onClick={() => canImport && setModalState({ month: m.key })}
                      className={`group relative flex flex-1 items-center justify-between gap-3 border-b border-[#b98458]/50 px-4 py-3 text-left transition-all last:border-b-0 ${
                        canImport ? 'hover:bg-[#e0a469]' : 'cursor-not-allowed opacity-70'
                      } ${index % 2 === 0 ? 'bg-[#e8be94]' : 'bg-[#e2b587]'}`}
                      title={canImport ? 'Importer un fichier' : 'Import non autorisé pour votre rôle'}
                    >
                      {renderMonthLabel(m.label, 'text-[#6b330f]')}

                      <div className="ml-auto flex items-center gap-2">
                        {hasImport && (
                          <div className="flex items-center gap-2">
                            <div className="rounded-full border border-[#5c7c39] bg-[#6f9b43] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white shadow-sm">
                              Importé
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeInventoryForMonth(m.key);
                              }}
                              disabled={!canRemoveImport}
                              title={`Supprimer l'import ${m.label}`}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#9f6b45] bg-[#f1d1b2] text-[#6b330f] shadow-sm transition hover:bg-[#ebc39e] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 6l12 12M18 6L6 18" />
                              </svg>
                            </button>
                          </div>
                        )}

                        {!hasImport && (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#8f5d37] bg-[#f0cfad] text-[#7a431a] transition group-hover:bg-[#f3d5b6]">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* COUVERTS */}
            <section className="flex min-h-[500px] flex-col overflow-hidden rounded-[28px] border border-[#b79a35] bg-[linear-gradient(180deg,#efe0a1_0%,#e5d28b_100%)] shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
              <div className="border-b border-[#ccb152] bg-[linear-gradient(180deg,#d9bf57_0%,#caa838_100%)] px-5 py-5 text-center">
                <h2 className="text-[18px] font-black uppercase tracking-[0.12em] text-[#5d4700]">
                  Couverts réalisés
                </h2>
              </div>

              <div className="flex flex-1 flex-col">
                {MONTHS_DISPLAY_CONFIG.map((m, index) => (
                  <div
                    key={m.key}
                    className={`flex flex-1 items-center justify-between gap-3 border-b border-[#ccb152]/45 px-4 py-3 last:border-b-0 ${
                      index % 2 === 0 ? 'bg-[#f1e4ad]' : 'bg-[#ebdda0]'
                    }`}
                  >
                    {renderMonthLabel(m.label, 'text-[#6d5500]')}
                    <input
                      type="number"
                      value={covers[m.key] || ''}
                      onChange={(e) => setCovers((p) => ({ ...p, [m.key]: Number(e.target.value) }))}
                      disabled={!canEditFields}
                      className="h-11 w-28 rounded-[14px] border-2 border-[#b08a12] bg-[#fff9ec] text-center text-base font-black text-[#6d5500] outline-none transition-all placeholder:text-[#a18c54] focus:scale-[1.03] focus:shadow-[0_0_0_3px_rgba(176,138,18,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="-"
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* CM */}
            <section className="flex min-h-[500px] flex-col overflow-hidden rounded-[28px] border border-[#b97b79] bg-[linear-gradient(180deg,#ead0cf_0%,#e0c0bf_100%)] shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
              <div className="border-b border-[#ca9794] bg-[linear-gradient(180deg,#b86a68_0%,#974846_100%)] px-5 py-5 text-center">
                <h2 className="text-[18px] font-black uppercase tracking-[0.12em] text-[#fff1f1]">
                  CM (%)
                </h2>
              </div>

              <div className="flex flex-1 flex-col">
                {MONTHS_DISPLAY_CONFIG.map((m, index) => (
                  <div
                    key={m.key}
                    className={`flex flex-1 items-center justify-between gap-3 border-b border-[#ca9794]/40 px-4 py-3 last:border-b-0 ${
                      index % 2 === 0 ? 'bg-[#eed9d8]' : 'bg-[#e7cfce]'
                    }`}
                  >
                    {renderMonthLabel(m.label, 'text-[#7a2422]')}
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
                      className="h-11 w-28 rounded-[14px] border-2 border-[#d06c69] bg-[#fff7f6] text-center text-base font-black text-[#7a2422] outline-none transition-all placeholder:text-[#b48a88] focus:scale-[1.03] focus:shadow-[0_0_0_3px_rgba(208,108,105,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="-"
                      title="Coût matière (%)"
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* CA */}
            <section className="flex min-h-[500px] flex-col overflow-hidden rounded-[28px] border border-[#8da0af] bg-[linear-gradient(180deg,#d6dfe7_0%,#c5d0d9_100%)] shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
              <div className="border-b border-[#a8bac8] bg-[linear-gradient(180deg,#7d92a3_0%,#607483_100%)] px-5 py-5 text-center">
                <h2 className="text-[18px] font-black uppercase tracking-[0.12em] text-[#f5f8fb]">
                  CA HT (€)
                </h2>
              </div>

              <div className="flex flex-1 flex-col">
                {MONTHS_DISPLAY_CONFIG.map((m, index) => (
                  <div
                    key={m.key}
                    className={`flex flex-1 items-center justify-between gap-3 border-b border-[#9fb0bc]/40 px-4 py-3 last:border-b-0 ${
                      index % 2 === 0 ? 'bg-[#dde5eb]' : 'bg-[#d4dde4]'
                    }`}
                  >
                    {renderMonthLabel(m.label, 'text-[#244255]')}
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
                      className="h-11 w-28 rounded-[14px] border-2 border-[#6e8aa1] bg-[#f8fbfd] text-center text-base font-black text-[#244255] outline-none transition-all placeholder:text-[#92a2ae] focus:scale-[1.03] focus:shadow-[0_0_0_3px_rgba(110,138,161,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="-"
                      title="Chiffre d'affaires HT"
                    />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default StatsPage;
