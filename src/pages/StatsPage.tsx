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
    'border-[#D0B08D] bg-[#FFFDF9] text-[#3A2A1F] placeholder:text-[#A88D77] focus:border-[#A93E2A] focus:ring-2 focus:ring-[#A93E2A]/15';

  return (
    <div className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#F6EFE6_0%,#F2E8DD_45%,#EBDDCE_100%)] text-[#34271F]">
      {modalState && canImport && (
        <ImportModal
          monthLabel={MONTHS_DISPLAY_CONFIG.find((m) => m.key === modalState.month)?.label || ''}
          onClose={() => setModalState(null)}
          onFileSelected={handleFile}
          type="detailed"
        />
      )}

      <div className="mx-auto flex min-h-screen max-w-[1920px] flex-col gap-4 p-3 sm:p-4 lg:flex-row lg:gap-5 lg:p-5">
        {/* ACTIONS */}
        <aside className="w-full shrink-0 lg:w-[290px] xl:w-[300px]">
          <div className="flex flex-col gap-4 lg:sticky lg:top-5">
            <div className="overflow-hidden rounded-[26px] border border-[#B46E58] bg-[linear-gradient(135deg,#A93E2A_0%,#922F20_48%,#7A231A_100%)] shadow-[0_12px_26px_rgba(122,35,26,0.16)]">
              <div className="h-1.5 bg-gradient-to-r from-[#F1C15A] via-[#D86A2C] to-[#A93E2A]" />
              <div className="p-4 sm:p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#FFE1B8]">
                  Hippopotamus Thillois
                </p>
                <h1 className="mt-3 text-3xl font-black leading-none text-[#FFF9F3]">
                  Paramètres
                </h1>
              </div>
            </div>

            <button
              onClick={() => setView('home')}
              className="flex items-center justify-center gap-3 rounded-[22px] border border-[#D9A72B] bg-[linear-gradient(180deg,#F3C63D_0%,#E3A91F_100%)] px-5 py-5 text-center text-sm font-black uppercase tracking-[0.16em] text-[#4D2B18] shadow-[0_5px_0_#B8810F] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_3px_0_#B8810F]"
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
                className="rounded-[22px] border border-[#B55A3C] bg-[linear-gradient(180deg,#C9603D_0%,#B0472B_55%,#943320_100%)] px-5 py-6 text-center text-xs font-black uppercase tracking-[0.16em] text-[#FFF8F0] shadow-[0_5px_0_#762719] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_3px_0_#762719]"
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
          <section className="flex h-full min-h-[calc(100vh-40px)] flex-col overflow-hidden rounded-[30px] border border-[#D7B79B] bg-[#FAF5EE] shadow-[0_16px_32px_rgba(145,105,75,0.10)]">
            <div className="border-b border-[#B45439] bg-[linear-gradient(180deg,#A93E2A_0%,#912F20_55%,#782219_100%)] px-6 py-5">
              <h2 className="text-2xl font-black uppercase tracking-[0.08em] text-[#FFF8F1]">
                Suivi mensuel
              </h2>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full table-fixed min-w-[900px]">
                <colgroup>
                  <col className="w-[13%]" />
                  <col className="w-[23%]" />
                  <col className="w-[23%]" />
                  <col className="w-[23%]" />
                  <col className="w-[18%]" />
                </colgroup>

                <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,#C35A35_0%,#A94729_55%,#8C3722_100%)] text-[#FFF9F4] shadow-sm">
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
                            ? 'bg-[#FCF8F2] text-[#34271F]'
                            : 'bg-[#F6EFE5] text-[#34271F]'
                        }
                      >
                        <td className="border-t border-[#E0CCBA] px-5 py-4 align-middle font-black uppercase tracking-[0.05em] text-[#5D3324]">
                          {m.label}
                        </td>

                        <td className="border-t border-[#E0CCBA] px-5 py-3 align-middle">
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

                        <td className="border-t border-[#E0CCBA] px-5 py-3 align-middle">
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

                        <td className="border-t border-[#E0CCBA] px-5 py-3 align-middle">
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

                        <td className="border-t border-[#E0CCBA] px-5 py-4 align-middle">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => canImport && setModalState({ month: m.key })}
                              disabled={!canImport}
                              className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.06em] border transition ${
                                importState === 'imported'
                                  ? 'border-[#9FC9A7] bg-[#E6F3E8] text-[#3F6B4A] hover:bg-[#DDEEE0]'
                                  : importState === 'validated'
                                  ? 'border-[#D0A57A] bg-[#F6E7D6] text-[#A06535] hover:bg-[#F0DDC7]'
                                  : 'border-[#D8C1AB] bg-[#F3E7DA] text-[#8E6A4E] hover:bg-[#ECDECE]'
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
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#D6B293] bg-[#F7EBDD] text-[#A5502F] shadow-sm transition hover:bg-[#F0DECB] disabled:cursor-not-allowed disabled:opacity-40"
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
