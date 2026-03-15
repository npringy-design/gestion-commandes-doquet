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
    'border-[#C79B73] bg-[#FFF8F0] text-[#2E2723] placeholder:text-[#9A7E68] focus:border-[#B4522E] focus:ring-2 focus:ring-[#B4522E]/20';

  return (
    <div className="min-h-screen overflow-x-hidden overflow-y-auto bg-[linear-gradient(180deg,#F5EBDD_0%,#EFD9BF_48%,#E4C7A4_100%)] text-[#2E2723]">
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
            <div className="overflow-hidden rounded-[26px] border border-[#A66B42] bg-[linear-gradient(135deg,#6A3324_0%,#8B4330_58%,#A54F34_100%)] shadow-[0_14px_32px_rgba(140,67,48,0.18)]">
              <div className="h-1.5 bg-gradient-to-r from-[#E0A13A] via-[#C65A2E] to-[#8E2E2A]" />
              <div className="p-4 sm:p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#F6D7A8]">
                  Hippopotamus Thillois
                </p>
                <h1 className="mt-3 text-3xl font-black leading-none text-[#FFF8F0]">
                  Paramètres
                </h1>
              </div>
            </div>

            <button
              onClick={() => setView('home')}
              className="flex items-center justify-center gap-3 rounded-[22px] border border-[#D9A72B] bg-[linear-gradient(180deg,#F3C63D_0%,#E0A21E_100%)] px-5 py-5 text-center text-sm font-black uppercase tracking-[0.16em] text-[#4A2417] shadow-[0_5px_0_#B27D0E] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_3px_0_#B27D0E]"
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
                className="rounded-[22px] border border-[#B56A3E] bg-[linear-gradient(180deg,#D97A3D_0%,#B95A2E_100%)] px-5 py-6 text-center text-xs font-black uppercase tracking-[0.16em] text-[#FFF7EF] shadow-[0_5px_0_#8E4323] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_3px_0_#8E4323]"
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
          <section className="overflow-hidden rounded-[30px] border border-[#C79265] bg-[#FBF2E7] shadow-[0_18px_40px_rgba(165,111,62,0.14)]">
            <div className="border-b border-[#B87446] bg-[linear-gradient(180deg,#A54F34_0%,#7F3A28_100%)] px-6 py-5">
              <h2 className="text-2xl font-black uppercase tracking-[0.08em] text-[#FFF7EF]">
                Suivi mensuel
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full">
                <thead className="bg-[linear-gradient(180deg,#D4843E_0%,#B85F2F_100%)] text-[#FFF8F1]">
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
                            ? 'bg-[#FFF7EE] text-[#2E2723]'
                            : 'bg-[#F8EAD9] text-[#2E2723]'
                        }
                      >
                        <td className="border-t border-[#DFC0A3] px-5 py-4 font-black uppercase tracking-[0.05em] text-[#5A2E1F]">
                          {m.label}
                        </td>

                        <td className="border-t border-[#DFC0A3] px-5 py-3">
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

                        <td className="border-t border-[#DFC0A3] px-5 py-3">
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

                        <td className="border-t border-[#DFC0A3] px-5 py-3">
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

                        <td className="border-t border-[#DFC0A3] px-5 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => canImport && setModalState({ month: m.key })}
                              disabled={!canImport}
                              className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.06em] border transition ${
                                importState === 'imported'
                                  ? 'border-[#9FC9A7] bg-[#E6F3E8] text-[#3F6B4A] hover:bg-[#DDEEE0]'
                                  : importState === 'validated'
                                  ? 'border-[#D28A52] bg-[#F8E0C8] text-[#9A4F22] hover:bg-[#F2D4B6]'
                                  : 'border-[#D3B08F] bg-[#F3E3D0] text-[#8B654A] hover:bg-[#EEDBC4]'
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
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#D2A077] bg-[#F8E5D2] text-[#A14E2F] shadow-sm transition hover:bg-[#F2D8BE] disabled:cursor-not-allowed disabled:opacity-40"
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
