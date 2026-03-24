// =============================================================
// pages/StatsPage.tsx
// Refonte visuelle uniquement - alignée sur Calcul prod ratio
// Mécanique conservée
// =============================================================

import React, { useMemo, useRef, useState } from 'react';
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
  prepImportsByMonth: Record<string, string>;
  setPrepImportsByMonth: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  validatedMonths: Record<string, boolean>;
  prepValidatedMonths?: Record<string, boolean>;
}

type EditableField = 'sales' | 'cm' | 'covers';
type CellKey = `${string}-${EditableField}`;

const formatNumber = (value: number, maxDecimals = 2) => {
  if (!Number.isFinite(value)) return '';
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(value);
};

const formatDisplayValue = (field: EditableField, value: number) => {
  if (!Number.isFinite(value) || value === 0) return '';
  if (field === 'sales') return `${formatNumber(value)} €`;
  if (field === 'cm') return `${formatNumber(value)} %`;
  return formatNumber(value, 0);
};

const getRawValue = (value: number, allowDecimals = true) => {
  if (!Number.isFinite(value) || value === 0) return '';
  return allowDecimals ? String(value).replace('.', ',') : String(Math.trunc(value));
};

const parseInputValue = (raw: string, allowDecimals = true) => {
  const cleaned = raw.replace(/\s/g, '').replace('€', '').replace('%', '').replace(',', '.');
  if (cleaned === '' || cleaned === '-' || cleaned === '.' || cleaned === '-.') return 0;
  const parsed = allowDecimals ? Number(cleaned) : parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

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
  prepImportsByMonth,
  setPrepImportsByMonth,
  validatedMonths,
  prepValidatedMonths = {},
}) => {
  const { profile } = useAuth();
  const canImport = canImportData(profile);
  const canRemoveImport = canDeleteImport(profile);
  const canEditFields = canEditSettingsFields(profile);
  const canOpenRatios = canAccessRatiosPage(profile);
  const [modalState, setModalState] = useState<{ month: string; target: 'inventory' | 'production' } | null>(null);
  const { showToast } = useToast();
  const [activeCell, setActiveCell] = useState<CellKey | null>(null);
  const [drafts, setDrafts] = useState<Record<CellKey, string>>({});
  const cellRefs = useRef<Record<CellKey, HTMLInputElement | null>>({});

  const editableColumns = useMemo<EditableField[]>(() => ['sales', 'cm', 'covers'], []);

  const resolveImportTargetMonth = (requestedMonth: string, target: 'inventory' | 'production') => {
    const lockMap = target === 'production' ? prepValidatedMonths : validatedMonths;
    if (!lockMap[requestedMonth]) return requestedMonth;
    const startIndex = MONTHS_DISPLAY_CONFIG.findIndex((m) => m.key === requestedMonth);
    if (startIndex === -1) return requestedMonth;

    for (let i = startIndex + 1; i < MONTHS_DISPLAY_CONFIG.length; i++) {
      const key = MONTHS_DISPLAY_CONFIG[i].key;
      if (!lockMap[key]) return key;
    }

    return requestedMonth;
  };

  const handleFile = async (file: File) => {
    if (!modalState || !canImport) return;

    try {
      const content = await readFileAsCSV(file);
      const targetMonth = resolveImportTargetMonth(modalState.month, modalState.target);

      if (modalState.target === 'inventory') {
        setDetailedInventory((prev) => ({ ...prev, [targetMonth]: content }));
        showToast(`Import inventaire ${targetMonth.toUpperCase()} réussi ✓`, 'success');
      } else {
        setPrepImportsByMonth((prev) => ({ ...prev, [targetMonth]: content }));
        showToast(`Import production ${targetMonth.toUpperCase()} réussi ✓`, 'success');
      }
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

  const removeProductionImportForMonth = (monthKey: string) => {
    if (!canRemoveImport) return;

    setPrepImportsByMonth((prev) => {
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

  const getValue = (monthKey: string, field: EditableField) => {
    if (field === 'sales') return salesHtByMonth[monthKey] || 0;
    if (field === 'cm') return costMatterByMonth[monthKey] || 0;
    return covers[monthKey] || 0;
  };

  const setValue = (monthKey: string, field: EditableField, value: number) => {
    if (field === 'sales') {
      setSalesHtByMonth((prev) => ({ ...prev, [monthKey]: value }));
      return;
    }
    if (field === 'cm') {
      setCostMatterByMonth((prev) => ({ ...prev, [monthKey]: value }));
      return;
    }
    setCovers((prev) => ({ ...prev, [monthKey]: value }));
  };

  const getCellKey = (monthKey: string, field: EditableField): CellKey => `${monthKey}-${field}`;

  const commitDraft = (monthKey: string, field: EditableField) => {
    const cellKey = getCellKey(monthKey, field);
    const draftValue = drafts[cellKey];
    if (draftValue === undefined) {
      setActiveCell((prev) => (prev === cellKey ? null : prev));
      return;
    }

    const parsed = parseInputValue(draftValue, field !== 'covers');
    setValue(monthKey, field, parsed);

    setDrafts((prev) => {
      const next = { ...prev };
      delete next[cellKey];
      return next;
    });
    setActiveCell((prev) => (prev === cellKey ? null : prev));
  };

  const moveToCell = (rowIndex: number, columnIndex: number) => {
    const month = MONTHS_DISPLAY_CONFIG[rowIndex];
    const field = editableColumns[columnIndex];
    if (!month || !field) return;
    const nextCellKey = getCellKey(month.key, field);
    const nextInput = cellRefs.current[nextCellKey];
    if (nextInput) {
      nextInput.focus();
      nextInput.select();
    }
  };

  const inputBase =
    'h-10 w-full rounded-[14px] border px-3 text-center text-[13px] font-bold outline-none transition disabled:opacity-50 disabled:cursor-not-allowed';
  const inputTheme =
    'border-[#D4B08C] bg-[#FFFDF9] text-[#3A2A1F] placeholder:text-[#A88D77] focus:border-[#A93E2A] focus:ring-2 focus:ring-[#A93E2A]/15';

  return (
    <div className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#F6EFE6_0%,#F1E7DA_42%,#E9DDCE_100%)] text-[#34271F]">
      {modalState && canImport && (
        <ImportModal
          monthLabel={MONTHS_DISPLAY_CONFIG.find((m) => m.key === modalState.month)?.label || ''}
          onClose={() => setModalState(null)}
          onFileSelected={handleFile}
          type="detailed"
        />
      )}

      <div className="mx-auto flex h-screen max-w-[1720px] flex-col gap-3 p-3 lg:flex-row lg:gap-4 lg:p-3.5">
        <aside className="w-full shrink-0 lg:w-[255px] xl:w-[270px]">
          <div className="flex flex-col gap-3 lg:sticky lg:top-3.5">
            <div className="overflow-hidden rounded-[26px] border border-[#B46E58] bg-[linear-gradient(135deg,#A93E2A_0%,#922F20_48%,#7A231A_100%)] shadow-[0_10px_20px_rgba(122,35,26,0.14)]">
              <div className="h-1.5 bg-gradient-to-r from-[#F1C15A] via-[#D86A2C] to-[#A93E2A]" />
              <div className="p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FFE1B8]">
                  Hippopotamus Thillois
                </p>
                <h1 className="mt-2 text-[21px] font-black leading-none text-[#FFF9F3] xl:text-[23px]">
                  Paramètres
                </h1>
              </div>
            </div>

            <button
              onClick={() => setView('home')}
              className="rounded-[22px] border border-[#D9A72B] bg-[linear-gradient(180deg,#F3C63D_0%,#E3A91F_100%)] px-4 py-3.5 text-center text-[13px] font-black uppercase tracking-[0.12em] text-[#4D2B18] shadow-[0_4px_0_#B8810F] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#B8810F]"
            >
              Retour accueil
            </button>

            {canOpenRatios && (
              <>
                <button
                  onClick={() => setView('ratios')}
                  className="rounded-[22px] border border-[#B55A3C] bg-[linear-gradient(180deg,#C9603D_0%,#B0472B_55%,#943320_100%)] px-4 py-4 text-center text-[11px] font-black uppercase tracking-[0.14em] text-[#FFF8F0] shadow-[0_4px_0_#762719] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#762719]"
                >
                  Calcul
                  <br />
                  Vente ratio
                </button>

                <button
                  onClick={() => setView('prep_ratios')}
                  className="rounded-[22px] border border-[#2E8D63] bg-[linear-gradient(180deg,#39B37D_0%,#239062_100%)] px-4 py-4 text-center text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-[0_4px_0_#196A48] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#196A48]"
                >
                  Calcul
                  <br />
                  Prod ratio
                </button>
              </>
            )}
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1">
          <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[26px] border border-[#D7B79B] bg-[#FAF5EE] shadow-[0_16px_32px_rgba(145,105,75,0.10)]">
            <div className="border-b border-[#B45439] bg-[linear-gradient(180deg,#A93E2A_0%,#912F20_55%,#782219_100%)] px-4 py-3">
              <h2 className="text-[18px] font-black uppercase tracking-[0.08em] text-[#FFF8F1]">
                Suivi mensuel
              </h2>
            </div>

            <div className="min-h-0 flex-1 overflow-auto bg-[#F7F0E7]">
              <table className="w-full min-w-[1080px] table-fixed border-separate border-spacing-0">
                <colgroup>
                  <col className="w-[11%]" />
                  <col className="w-[18%]" />
                  <col className="w-[16%]" />
                  <col className="w-[15%]" />
                  <col className="w-[40%]" />
                </colgroup>

                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#EADACA] text-[#71402D]">
                    <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">
                      Mois
                    </th>
                    <th className="border-b border-[#DCC2AB] px-3 py-4 text-center text-[12px] font-black uppercase tracking-[0.07em]">
                      CA HT
                    </th>
                    <th className="border-b border-[#DCC2AB] px-3 py-4 text-center text-[12px] font-black uppercase tracking-[0.07em]">
                      CM
                    </th>
                    <th className="border-b border-[#DCC2AB] px-3 py-4 text-center text-[12px] font-black uppercase tracking-[0.07em]">
                      Couverts
                    </th>
                    <th className="border-b border-[#DCC2AB] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.07em]">
                      Imports du mois
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {MONTHS_DISPLAY_CONFIG.map((m, rowIndex) => {
                    const importState = getImportState(m.key);
                    const hasImport = importState === 'imported';

                    const renderEditableInput = (field: EditableField, title: string) => {
                      const cellKey = getCellKey(m.key, field);
                      const value = getValue(m.key, field);
                      const isActive = activeCell === cellKey;
                      const displayValue = isActive
                        ? drafts[cellKey] ?? getRawValue(value, field !== 'covers')
                        : formatDisplayValue(field, value);
                      const columnIndex = editableColumns.indexOf(field);

                      return (
                        <input
                          ref={(el) => {
                            cellRefs.current[cellKey] = el;
                          }}
                          type="text"
                          inputMode={field === 'covers' ? 'numeric' : 'decimal'}
                          value={displayValue}
                          onFocus={(e) => {
                            setActiveCell(cellKey);
                            setDrafts((prev) => ({
                              ...prev,
                              [cellKey]: getRawValue(value, field !== 'covers'),
                            }));
                            requestAnimationFrame(() => e.target.select());
                          }}
                          onMouseUp={(e) => e.preventDefault()}
                          onChange={(e) => {
                            setDrafts((prev) => ({
                              ...prev,
                              [cellKey]: e.target.value,
                            }));
                          }}
                          onBlur={() => commitDraft(m.key, field)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitDraft(m.key, field);
                              moveToCell(Math.min(rowIndex + 1, MONTHS_DISPLAY_CONFIG.length - 1), columnIndex);
                              return;
                            }

                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              commitDraft(m.key, field);
                              moveToCell(Math.min(rowIndex + 1, MONTHS_DISPLAY_CONFIG.length - 1), columnIndex);
                              return;
                            }

                            if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              commitDraft(m.key, field);
                              moveToCell(Math.max(rowIndex - 1, 0), columnIndex);
                              return;
                            }

                            if (e.key === 'ArrowRight' && (e.currentTarget.selectionStart ?? 0) === e.currentTarget.value.length) {
                              e.preventDefault();
                              commitDraft(m.key, field);
                              moveToCell(rowIndex, Math.min(columnIndex + 1, editableColumns.length - 1));
                              return;
                            }

                            if (e.key === 'ArrowLeft' && (e.currentTarget.selectionStart ?? 0) === 0) {
                              e.preventDefault();
                              commitDraft(m.key, field);
                              moveToCell(rowIndex, Math.max(columnIndex - 1, 0));
                            }
                          }}
                          disabled={!canEditFields}
                          className={`${inputBase} ${inputTheme}`}
                          placeholder=""
                          title={title}
                        />
                      );
                    };

                    return (
                      <tr key={m.key} className="align-middle">
                        <td className="border-b border-[#E2CEBD] bg-[#F7F0E7] px-3 py-4 text-[15px] font-black uppercase tracking-[0.03em] text-[#4E2E22]">
                          {m.label}
                        </td>

                        <td className="border-b border-[#E2CEBD] bg-[#F7F0E7] px-3 py-3">
                          {renderEditableInput('sales', "Chiffre d'affaires HT")}
                        </td>

                        <td className="border-b border-[#E2CEBD] bg-[#F7F0E7] px-3 py-3">
                          {renderEditableInput('cm', 'Coût matière (%)')}
                        </td>

                        <td className="border-b border-[#E2CEBD] bg-[#F7F0E7] px-3 py-3">
                          {renderEditableInput('covers', 'Couverts')}
                        </td>

                        <td className="border-b border-[#E2CEBD] bg-[#F7F0E7] px-3 py-3">
                          <div className="rounded-[20px] border border-[#D6B293] bg-[#FBF7F1] px-4 py-3.5 shadow-[0_2px_0_rgba(188,145,106,0.18)]">
                            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                              <div className="flex flex-col gap-2.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[11px] font-black uppercase tracking-[0.08em] text-[#7D543E]">
                                    Inventaire détaillé
                                  </span>
                                  <button
                                    onClick={() => canImport && setModalState({ month: m.key, target: 'inventory' })}
                                    disabled={!canImport}
                                    className={`rounded-[14px] border px-3 py-2 text-[11px] font-black uppercase tracking-[0.06em] transition ${
                                      importState === 'imported'
                                        ? 'border-[#9FC9A7] bg-[#E6F3E8] text-[#3F6B4A] hover:bg-[#DDEEE0]'
                                        : importState === 'validated'
                                        ? 'border-[#D0A57A] bg-[#F6E7D6] text-[#A06535] hover:bg-[#F0DDC7]'
                                        : 'border-[#D6B293] bg-[#F5E8DA] text-[#8E6A4E] hover:bg-[#EFDCC8]'
                                    } ${!canImport ? 'cursor-not-allowed opacity-50' : ''}`}
                                  >
                                    {importState === 'imported' ? 'Importé' : importState === 'validated' ? 'En attente' : 'Importer'}
                                  </button>
                                  {hasImport && (
                                    <button
                                      type="button"
                                      onClick={() => removeInventoryForMonth(m.key)}
                                      disabled={!canRemoveImport}
                                      title={`Supprimer l'import inventaire ${m.label}`}
                                      className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-[#D6B293] bg-[#F7EBDD] text-[#A5502F] transition hover:bg-[#F0DECB] disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 6l12 12M18 6L6 18" />
                                      </svg>
                                    </button>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[11px] font-black uppercase tracking-[0.08em] text-[#7D543E]">
                                    Import production
                                  </span>
                                  <button
                                    onClick={() => canImport && setModalState({ month: m.key, target: 'production' })}
                                    disabled={!canImport}
                                    className={`rounded-[14px] border px-3 py-2 text-[11px] font-black uppercase tracking-[0.06em] transition ${
                                      prepImportsByMonth[m.key]
                                        ? 'border-[#9FC9A7] bg-[#E6F3E8] text-[#3F6B4A] hover:bg-[#DDEEE0]'
                                        : 'border-[#D6B293] bg-[#F5E8DA] text-[#8E6A4E] hover:bg-[#EFDCC8]'
                                    } ${!canImport ? 'cursor-not-allowed opacity-50' : ''}`}
                                  >
                                    {prepImportsByMonth[m.key] ? 'Importé' : 'Importer'}
                                  </button>
                                  {prepImportsByMonth[m.key] && (
                                    <button
                                      type="button"
                                      onClick={() => removeProductionImportForMonth(m.key)}
                                      disabled={!canRemoveImport}
                                      title={`Supprimer l'import production ${m.label}`}
                                      className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-[#D6B293] bg-[#F7EBDD] text-[#A5502F] transition hover:bg-[#F0DECB] disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 6l12 12M18 6L6 18" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
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
