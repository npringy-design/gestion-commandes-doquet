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
    'h-10 w-full rounded-[10px] border px-3 text-center text-[13px] font-extrabold outline-none transition disabled:cursor-not-allowed disabled:opacity-50';
  const inputTheme =
    'border-[#CDAF8A] bg-[#FBF6EE] text-[#2F1F17] placeholder:text-[#9A806A] focus:border-[#9E5E2B] focus:bg-white focus:ring-2 focus:ring-[#9E5E2B]/15';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_18%_0%,rgba(246,178,74,0.28),transparent_30%),linear-gradient(180deg,#2B160F_0%,#6B2D1D_46%,#C07832_100%)] text-[#34271F]">
      {modalState && canImport && (
        <ImportModal
          monthLabel={MONTHS_DISPLAY_CONFIG.find((m) => m.key === modalState.month)?.label || ''}
          onClose={() => setModalState(null)}
          onFileSelected={handleFile}
          type="detailed"
        />
      )}

      <div className="mx-auto flex min-h-screen max-w-[1760px] flex-col gap-4 p-3 sm:p-4 lg:p-5">
        <header className="shrink-0 overflow-hidden rounded-[24px] border border-[#9F6635] bg-[linear-gradient(135deg,rgba(31,20,15,0.98)_0%,rgba(76,37,25,0.96)_58%,rgba(122,68,34,0.94)_100%)] shadow-[0_18px_42px_rgba(30,13,8,0.22)]">
          <div className="h-1 bg-gradient-to-r from-[#C89245] via-[#A95D2F] to-[#5A2C1D]" />
          <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-stretch lg:justify-between lg:p-6">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#FFD28A]">
                Hippopotamus Thillois
              </p>
              <h1 className="mt-2 text-[34px] font-black leading-none tracking-tight text-[#FFF6E8] lg:text-[42px]">
                Paramètres
              </h1>
              <p className="mt-3 max-w-[680px] text-sm font-bold leading-relaxed text-[#F6DEC0]">
                Saisie des indicateurs mensuels, imports inventaire et production, accès aux ratios.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[560px] lg:grid-cols-4">
              <button
                onClick={() => setView('home')}
                className="group rounded-[16px] border border-[#CBA36D]/70 bg-[#FFF7EA]/95 px-4 py-3 text-left shadow-[0_8px_16px_rgba(26,13,8,0.10)] transition hover:border-[#DEB477] hover:bg-white"
              >
                <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-[#8C5A35]">Retour</span>
                <span className="mt-1 block text-[15px] font-black text-[#332117]">Accueil</span>
              </button>

              {canOpenRatios && (
                <>
                  <button
                    onClick={() => setView('ratios')}
                    className="group rounded-[16px] border border-[#CBA36D]/70 bg-[#FFF7EA]/95 px-4 py-3 text-left shadow-[0_8px_16px_rgba(26,13,8,0.10)] transition hover:border-[#DEB477] hover:bg-white"
                  >
                    <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-[#8C5A35]">Calcul</span>
                    <span className="mt-1 block text-[15px] font-black text-[#332117]">Vente ratio</span>
                  </button>

                  <button
                    onClick={() => setView('prep_ratios')}
                    className="group rounded-[16px] border border-[#CBA36D]/70 bg-[#FFF7EA]/95 px-4 py-3 text-left shadow-[0_8px_16px_rgba(26,13,8,0.10)] transition hover:border-[#DEB477] hover:bg-white"
                  >
                    <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-[#8C5A35]">Calcul</span>
                    <span className="mt-1 block text-[15px] font-black text-[#332117]">Prod ratio</span>
                  </button>

                  <button
                    onClick={() => setView('take_rate')}
                    className="group rounded-[16px] border border-[#CBA36D]/70 bg-[#FFF7EA]/95 px-4 py-3 text-left shadow-[0_8px_16px_rgba(26,13,8,0.10)] transition hover:border-[#DEB477] hover:bg-white"
                  >
                    <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-[#8C5A35]">Paramétrage</span>
                    <span className="mt-1 block text-[15px] font-black text-[#332117]">Taux de prise</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1">
          <section className="rounded-[24px] border border-[#C9A57C] bg-[#F8EFE3] p-4 shadow-[0_18px_42px_rgba(54,24,12,0.16)] lg:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#D4B58F] bg-[#EFE0CC] px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#B56A28]">
                  Pilotage
                </p>
                <h2 className="mt-1 text-[22px] font-black tracking-tight text-[#342016]">
                  Indicateurs mensuels
                </h2>
                <p className="mt-1 text-sm font-bold text-[#7B543B]">
                  CA HT, coût matière et couverts par mois, avec les imports associés.
                </p>
              </div>
              <p className="rounded-[10px] border border-[#CDB08A] bg-[#FBF6EE] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-[#6F4A34]">
                {MONTHS_DISPLAY_CONFIG.length} mois
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {MONTHS_DISPLAY_CONFIG.map((m, rowIndex) => {
                const importState = getImportState(m.key);
                const hasImport = importState === 'imported';
                const productionImported = !!prepImportsByMonth[m.key];

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
                  <article
                    key={m.key}
                    className="overflow-hidden rounded-[18px] border border-[#D4B58F] bg-[#FCF7EF] shadow-[0_8px_18px_rgba(87,52,33,0.08)]"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-[#D8C1A5] bg-[#EFE0CC] px-4 py-3">
                      <h3 className="text-[16px] font-black uppercase tracking-[0.04em] text-[#342016]">
                        {m.label}
                      </h3>
                      <div className="flex gap-1.5">
                        <span
                          className={`rounded-[8px] border px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] ${
                            importState === 'imported'
                              ? 'border-[#A8B69A] bg-[#EEF3E9] text-[#4D613C]'
                              : importState === 'validated'
                              ? 'border-[#CDAA77] bg-[#F3E7D7] text-[#8B5A2C]'
                              : 'border-[#D4C1AA] bg-[#F3EAE0] text-[#76614D]'
                          }`}
                        >
                          Inv. {importState === 'imported' ? 'OK' : importState === 'validated' ? 'À faire' : 'vide'}
                        </span>
                        <span
                          className={`rounded-[8px] border px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] ${
                            productionImported
                              ? 'border-[#A8B69A] bg-[#EEF3E9] text-[#4D613C]'
                              : 'border-[#D4C1AA] bg-[#F3EAE0] text-[#76614D]'
                          }`}
                        >
                          Prod. {productionImported ? 'OK' : 'vide'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4 p-4">
                      <div className="grid grid-cols-3 gap-2">
                        <label className="block">
                          <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[#71513C]">CA HT</span>
                          {renderEditableInput('sales', "Chiffre d'affaires HT")}
                        </label>

                        <label className="block">
                          <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[#71513C]">CM</span>
                          {renderEditableInput('cm', 'Coût matière (%)')}
                        </label>

                        <label className="block">
                          <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[#71513C]">Couverts</span>
                          {renderEditableInput('covers', 'Couverts')}
                        </label>
                      </div>

                      <div className="grid gap-2">
                        <div className="rounded-[14px] border border-[#D8C1A5] bg-[#F6EBDD] p-3">
                          <div className="flex items-center gap-2">
                            <span className="mr-auto text-[11px] font-black uppercase tracking-[0.12em] text-[#5F4231]">
                              Inventaire
                            </span>
                            <button
                              onClick={() => canImport && setModalState({ month: m.key, target: 'inventory' })}
                              disabled={!canImport}
                              className={`rounded-[13px] border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] transition ${
                                importState === 'imported'
                                  ? 'border-[#A8B69A] bg-[#EEF3E9] text-[#4D613C] hover:bg-[#E7EEE0]'
                                  : 'border-[#CDB08A] bg-[#FBF6EE] text-[#6F4A34] hover:bg-white'
                              } ${!canImport ? 'cursor-not-allowed opacity-50' : ''}`}
                            >
                              {importState === 'imported' ? 'Modifier' : 'Ajouter'}
                            </button>
                            {hasImport && (
                              <button
                                type="button"
                                onClick={() => removeInventoryForMonth(m.key)}
                                disabled={!canRemoveImport}
                                title={`Supprimer l'import inventaire ${m.label}`}
                                className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#CDB08A] bg-[#FBF6EE] text-[#8A452C] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 6l12 12M18 6L6 18" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="rounded-[14px] border border-[#D8C1A5] bg-[#F6EBDD] p-3">
                          <div className="flex items-center gap-2">
                            <span className="mr-auto text-[11px] font-black uppercase tracking-[0.12em] text-[#5F4231]">
                              Production
                            </span>
                            <button
                              onClick={() => canImport && setModalState({ month: m.key, target: 'production' })}
                              disabled={!canImport}
                              className={`rounded-[13px] border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] transition ${
                                productionImported
                                  ? 'border-[#A8B69A] bg-[#EEF3E9] text-[#4D613C] hover:bg-[#E7EEE0]'
                                  : 'border-[#CDB08A] bg-[#FBF6EE] text-[#6F4A34] hover:bg-white'
                              } ${!canImport ? 'cursor-not-allowed opacity-50' : ''}`}
                            >
                              {productionImported ? 'Modifier' : 'Ajouter'}
                            </button>
                            {productionImported && (
                              <button
                                type="button"
                                onClick={() => removeProductionImportForMonth(m.key)}
                                disabled={!canRemoveImport}
                                title={`Supprimer l'import production ${m.label}`}
                                className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#CDB08A] bg-[#FBF6EE] text-[#8A452C] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
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
                  </article>
                );
              })}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default StatsPage;
