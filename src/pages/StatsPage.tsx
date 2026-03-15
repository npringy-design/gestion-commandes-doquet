// =============================================================
// pages/StatsPage.tsx
// Refonte visuelle uniquement - version tableau unique
// Mécanique conservée
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

      setDetailedInventory((prev) => ({
        ...prev,
        [targetMonth]: content,
      }));

      showToast(`Import ${targetMonth.toUpperCase()} réussi ✓`, 'success');
      setModalState(null);
    } catch (err) {
      showToast(
        'Erreur lors de la lecture du fichier : ' + (err as Error).message,
        'error'
      );
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

  const getImportState = (monthKey: string) => {
    const hasImport = !!detailedInventory[monthKey];
    if (hasImport) return 'imported';
    if (validatedMonths[monthKey]) return 'validated';
    return 'empty';
  };

  const inputBase =
    'h-11 w-full rounded-xl border px-3 text-sm font-bold outline-none transition disabled:opacity-50 disabled:cursor-not-allowed';
  const inputTheme =
    'border-[#B79070] bg-[#F4E8DA] text-[#2B2623] placeholder:text-[#8E7767] focus:border-[#A14E3B] focus:ring-2 focus:ring-[#A14E3B]/20';

  return (
    <div className="min-h-screen overflow-x-hidden overflow-y-auto bg-[radial-gradient(circle_at_top,#4b2418_0%,#2a140f_38%,#1c0f0c_100%)] text-[#F6EBDD]">
      {modalState && canImport && (
        <ImportModal
          monthLabel={MONTHS_DISPLAY_CONFIG.find((m) => m.key === modalState.month)?.label || ''}
          onClose={() => setModalState(null)}
          onFileSelected={handleFile}
          type="detailed"
        />
      )}

      <div className="mx-auto flex max-w-[1700px] flex-col gap-5 p-3 sm:p-4 lg:flex-row lg:gap-7 lg:p-6">
        {/* ACTIONS */}
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
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

        {/* TABLEAU UNIQUE */}
        <main className="min-w-0 flex-1">
          <section className="overflow-hidden rounded-[30px] border border-[#7b4f39] bg-[linear-gradient(180deg,#2a1712_0%,#21120f_100%)] shadow-[0_18px_40px_rgba(0,0,0,0.3)]">
            <div className="border-b border-[#5a392d] bg-[linear-gradient(180deg,#2b1712_0%,#1d110e_100%)] px-6 py-5">
              <h2 className="text-2xl font-black uppercase tracking-[0.08em] text-[#fff4e8]">
                Suivi mensuel
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full">
                <thead className="bg-[linear-gradient(180deg,#4b3127_0%,#3b261f_100%)] text-[#fff2e7]">
                  <tr>
                    <th className="px-5 py-4 text-left text-sm font-black uppercase tracking-[0.08em]">
                      Mois
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-black uppercase tracking-[0.08em]">
                      CA HT (€)
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-black uppercase tracking-[0.08em]">
                      CM (%)
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-black uppercase tracking-[0.08em]">
                      Couverts
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-black uppercase tracking-[0.08em]">
                      Inventaire détaillé
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {MONTHS_DISPLAY_CONFIG.map((m, index) => {
                    const importState = getImportState(m.key);
                    const hasImport = importState === 'imported';

                    return (
                      <tr
                        key={m.key}
                        className={
                          index % 2 === 0
                            ? 'bg-[#e6d5c2] text-[#2b2623]'
                            : 'bg-[#ddcab6] text-[#2b2623]'
                        }
                      >
                        <td className="border-t border-[#c4aa91] px-5 py-4 font-black uppercase tracking-[0.05em]">
                          {m.label}
                        </td>

                        <td className="border-t border-[#c4aa91] px-5 py-3">
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
                            className={`${inputBase} ${inputTheme}`}
                            placeholder="-"
                            title="Chiffre d'affaires HT"
                          />
                        </td>

                        <td className="border-t border-[#c4aa91] px-5 py-3">
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
                            className={`${inputBase} ${inputTheme}`}
                            placeholder="-"
                            title="Coût matière (%)"
                          />
                        </td>

                        <td className="border-t border-[#c4aa91] px-5 py-3">
                          <input
                            type="number"
                            value={covers[m.key] || ''}
                            onChange={(e) =>
                              setCovers((p) => ({
                                ...p,
                                [m.key]: Number(e.target.value),
                              }))
                            }
                            disabled={!canEditFields}
                            className={`${inputBase} ${inputTheme}`}
                            placeholder="-"
                          />
                        </td>

                        <td className="border-t border-[#c4aa91] px-5 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => canImport && setModalState({ month: m.key })}
                              disabled={!canImport}
                              className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.06em] border transition ${
                                importState === 'imported'
                                  ? 'border-[#9FC9A7] bg-[#E6F3E8] text-[#3F6B4A] hover:bg-[#DDEEE0]'
                                  : importState === 'validated'
                                  ? 'border-[#A14E3B] bg-[#F4DDD7] text-[#8A3526] hover:bg-[#F0D2CA]'
                                  : 'border-[#B89E85] bg-[#EADBCB] text-[#7A685A] hover:bg-[#E3D2C0]'
                              } ${!canImport ? 'cursor-not-allowed opacity-50' : ''}`}
                            >
                              {importState === 'imported'
                                ? 'Importé'
                                : importState === 'validated'
                                ? 'En attente'
                                : 'Importer'}
                            </button>

                            {hasImport && (
                              <button
                                type="button"
                                onClick={() => removeInventoryForMonth(m.key)}
                                disabled={!canRemoveImport}
                                title={`Supprimer l'import ${m.label}`}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#9f6b45] bg-[#f1d1b2] text-[#6b330f] shadow-sm transition hover:bg-[#ebc39e] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="3"
                                    d="M6 6l12 12M18 6L6 18"
                                  />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default StatsPage;
