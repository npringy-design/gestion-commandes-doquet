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
  const [selectedMonthKey, setSelectedMonthKey] = useState(
    MONTHS_DISPLAY_CONFIG[new Date().getMonth()]?.key ?? MONTHS_DISPLAY_CONFIG[0].key
  );
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
    setSelectedMonthKey(month.key);
    requestAnimationFrame(() => {
      const nextInput = cellRefs.current[nextCellKey];
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    });
  };

  const inputBase =
    'h-10 w-full rounded-[10px] border px-3 text-center text-[13px] font-extrabold outline-none transition disabled:cursor-not-allowed disabled:opacity-50';
  const inputTheme =
    'border-[#CDAF8A] bg-[#FBF6EE] text-[#2F1F17] placeholder:text-[#9A806A] focus:border-[#9E5E2B] focus:bg-white focus:ring-2 focus:ring-[#9E5E2B]/15';

  const selectedMonthIndex = Math.max(
    0,
    MONTHS_DISPLAY_CONFIG.findIndex((month) => month.key === selectedMonthKey)
  );
  const selectedMonth = MONTHS_DISPLAY_CONFIG[selectedMonthIndex] ?? MONTHS_DISPLAY_CONFIG[0];
  const selectedImportState = getImportState(selectedMonth.key);
  const selectedHasImport = selectedImportState === 'imported';
  const selectedProductionImported = !!prepImportsByMonth[selectedMonth.key];
  const selectedHasNumbers = !!(
    getValue(selectedMonth.key, 'sales') ||
    getValue(selectedMonth.key, 'cm') ||
    getValue(selectedMonth.key, 'covers')
  );
  const selectedMonthReady = selectedHasNumbers && selectedHasImport && selectedProductionImported;
  const nextMonth = MONTHS_DISPLAY_CONFIG[selectedMonthIndex + 1] ?? null;
  const selectedMainAction = !selectedHasNumbers
    ? {
        label: 'Saisir les 3 chiffres',
        hint: 'CA HT, CM et couverts',
        tone: 'bg-[#F7D48A] text-[#3A2418]',
      }
    : !selectedHasImport
    ? {
        label: "Ajouter l'inventaire",
        hint: 'Fichier inventaire du mois',
        tone: 'bg-[#EBC28C] text-[#3A2418]',
      }
    : !selectedProductionImported
    ? {
        label: 'Ajouter la production',
        hint: 'Fichier production cuisine',
        tone: 'bg-[#D6E0C6] text-[#263A1D]',
      }
    : {
        label: 'Mois prêt',
        hint: 'Les ratios peuvent être consultés',
        tone: 'bg-[#E8F0DE] text-[#263A1D]',
      };
  const completedImportsCount = MONTHS_DISPLAY_CONFIG.filter(
    (month) => detailedInventory[month.key] && prepImportsByMonth[month.key]
  ).length;
  const filledIndicatorsCount = MONTHS_DISPLAY_CONFIG.filter(
    (month) => getValue(month.key, 'sales') || getValue(month.key, 'cm') || getValue(month.key, 'covers')
  ).length;

  const renderEditableInput = (monthKey: string, rowIndex: number, field: EditableField, title: string, className = '') => {
    const cellKey = getCellKey(monthKey, field);
    const value = getValue(monthKey, field);
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
        onBlur={() => commitDraft(monthKey, field)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitDraft(monthKey, field);
            moveToCell(Math.min(rowIndex + 1, MONTHS_DISPLAY_CONFIG.length - 1), columnIndex);
            return;
          }

          if (e.key === 'ArrowDown') {
            e.preventDefault();
            commitDraft(monthKey, field);
            moveToCell(Math.min(rowIndex + 1, MONTHS_DISPLAY_CONFIG.length - 1), columnIndex);
            return;
          }

          if (e.key === 'ArrowUp') {
            e.preventDefault();
            commitDraft(monthKey, field);
            moveToCell(Math.max(rowIndex - 1, 0), columnIndex);
            return;
          }

          if (e.key === 'ArrowRight' && (e.currentTarget.selectionStart ?? 0) === e.currentTarget.value.length) {
            e.preventDefault();
            commitDraft(monthKey, field);
            moveToCell(rowIndex, Math.min(columnIndex + 1, editableColumns.length - 1));
            return;
          }

          if (e.key === 'ArrowLeft' && (e.currentTarget.selectionStart ?? 0) === 0) {
            e.preventDefault();
            commitDraft(monthKey, field);
            moveToCell(rowIndex, Math.max(columnIndex - 1, 0));
          }
        }}
        disabled={!canEditFields}
        className={`${inputBase} ${inputTheme} ${className}`}
        placeholder=""
        title={title}
      />
    );
  };

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
          <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="rounded-[24px] border border-[#C9A57C] bg-[#F8EFE3] p-4 shadow-[0_18px_42px_rgba(54,24,12,0.16)]">
              <div className="rounded-[18px] border border-[#D4B58F] bg-[#EFE0CC] px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#B56A28]">
                  Planning
                </p>
                <h2 className="mt-1 text-[22px] font-black tracking-tight text-[#342016]">
                  Choisir le mois
                </h2>
                <p className="mt-1 text-sm font-bold text-[#7B543B]">
                  On travaille un mois à la fois pour garder l’écran lisible.
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-[14px] border border-[#D4B58F] bg-[#FCF7EF] px-3 py-3">
                  <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-[#71513C]">Chiffres</span>
                  <span className="mt-1 block text-xl font-black text-[#342016]">{filledIndicatorsCount}/12</span>
                </div>
                <div className="rounded-[14px] border border-[#D4B58F] bg-[#FCF7EF] px-3 py-3">
                  <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-[#71513C]">Imports</span>
                  <span className="mt-1 block text-xl font-black text-[#342016]">{completedImportsCount}/12</span>
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                {MONTHS_DISPLAY_CONFIG.map((month) => {
                  const monthImportState = getImportState(month.key);
                  const monthProductionImported = !!prepImportsByMonth[month.key];
                  const monthHasNumbers = !!(
                    getValue(month.key, 'sales') ||
                    getValue(month.key, 'cm') ||
                    getValue(month.key, 'covers')
                  );
                  const isSelected = month.key === selectedMonth.key;
                  const monthReady = monthImportState === 'imported' && monthProductionImported;

                  return (
                    <button
                      key={month.key}
                      type="button"
                      onClick={() => setSelectedMonthKey(month.key)}
                      className={`flex items-center gap-3 rounded-[14px] border px-3 py-3 text-left transition ${
                        isSelected
                          ? 'border-[#9E5E2B] bg-[#3A2418] text-[#FFF6E8] shadow-[0_8px_18px_rgba(54,24,12,0.20)]'
                          : 'border-[#D4B58F] bg-[#FCF7EF] text-[#342016] hover:border-[#B9854E] hover:bg-white'
                      }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          monthReady ? 'bg-[#6F8B4B]' : monthHasNumbers ? 'bg-[#C89245]' : 'bg-[#B7A28B]'
                        }`}
                      />
                      <span className="min-w-0 flex-1 text-[13px] font-black uppercase tracking-[0.04em]">
                        {month.label}
                      </span>
                      <span className={`text-[10px] font-black uppercase tracking-[0.08em] ${isSelected ? 'text-[#F6DEC0]' : 'text-[#84624A]'}`}>
                        {monthReady ? 'Prêt' : monthHasNumbers ? 'En cours' : 'À faire'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="flex min-h-[620px] flex-col overflow-hidden rounded-[24px] border border-[#C9A57C] bg-[#F8EFE3] shadow-[0_18px_42px_rgba(54,24,12,0.16)]">
              <div className="border-b border-[#D4B58F] bg-[#EFE0CC] px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#B56A28]">
                      Mois sélectionné
                    </p>
                    <h2 className="mt-1 text-[34px] font-black leading-none tracking-tight text-[#342016]">
                      {selectedMonth.label}
                    </h2>
                    <p className="mt-2 text-sm font-bold text-[#7B543B]">
                      Les trois chiffres essentiels, puis les fichiers à déposer.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <span
                      className={`rounded-[10px] border px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] ${
                        selectedHasImport
                          ? 'border-[#A8B69A] bg-[#EEF3E9] text-[#4D613C]'
                          : selectedImportState === 'validated'
                          ? 'border-[#CDAA77] bg-[#F3E7D7] text-[#8B5A2C]'
                          : 'border-[#D4C1AA] bg-[#F3EAE0] text-[#76614D]'
                      }`}
                    >
                      Inventaire {selectedHasImport ? 'OK' : selectedImportState === 'validated' ? 'à faire' : 'vide'}
                    </span>
                    <span
                      className={`rounded-[10px] border px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] ${
                        selectedProductionImported
                          ? 'border-[#A8B69A] bg-[#EEF3E9] text-[#4D613C]'
                          : 'border-[#D4C1AA] bg-[#F3EAE0] text-[#76614D]'
                      }`}
                    >
                      Production {selectedProductionImported ? 'OK' : 'vide'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid flex-1 gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="flex min-h-0 flex-col gap-4">
                  <div className="grid gap-3 md:grid-cols-3">
                  <label className="rounded-[18px] border border-[#D4B58F] bg-[#FCF7EF] p-4">
                    <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-[#71513C]">CA HT</span>
                    <span className="mt-1 block text-xs font-bold text-[#8B6B54]">Chiffre d’affaires du mois</span>
                    {renderEditableInput(selectedMonth.key, selectedMonthIndex, 'sales', "Chiffre d'affaires HT", 'mt-4 h-14 text-[20px]')}
                  </label>

                  <label className="rounded-[18px] border border-[#D4B58F] bg-[#FCF7EF] p-4">
                    <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-[#71513C]">CM</span>
                    <span className="mt-1 block text-xs font-bold text-[#8B6B54]">Coût matière en %</span>
                    {renderEditableInput(selectedMonth.key, selectedMonthIndex, 'cm', 'Coût matière (%)', 'mt-4 h-14 text-[20px]')}
                  </label>

                  <label className="rounded-[18px] border border-[#D4B58F] bg-[#FCF7EF] p-4">
                    <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-[#71513C]">Couverts</span>
                    <span className="mt-1 block text-xs font-bold text-[#8B6B54]">Nombre de clients servis</span>
                    {renderEditableInput(selectedMonth.key, selectedMonthIndex, 'covers', 'Couverts', 'mt-4 h-14 text-[20px]')}
                  </label>
                  </div>

                  <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="flex min-h-[230px] flex-col rounded-[22px] border border-[#A25E2E] bg-[linear-gradient(135deg,#3A2418_0%,#64301F_54%,#9E5E2B_100%)] p-5 text-[#FFF6E8] shadow-[0_16px_32px_rgba(54,24,12,0.18)]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7D48A]">
                            Prochaine action
                          </p>
                          <h3 className="mt-2 text-[28px] font-black leading-tight tracking-tight">
                            {selectedMainAction.label}
                          </h3>
                          <p className="mt-2 text-sm font-bold text-[#F6DEC0]">
                            {selectedMainAction.hint}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] ${selectedMainAction.tone}`}>
                          {selectedMonthReady ? 'Prêt' : 'À faire'}
                        </span>
                      </div>

                      <div className="mt-auto grid gap-2 pt-6 sm:grid-cols-3">
                        <div className="rounded-[16px] border border-white/15 bg-white/10 p-3">
                          <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-[#F7D48A]">Chiffres</span>
                          <span className="mt-1 block text-sm font-black">{selectedHasNumbers ? 'OK' : 'À saisir'}</span>
                        </div>
                        <div className="rounded-[16px] border border-white/15 bg-white/10 p-3">
                          <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-[#F7D48A]">Inventaire</span>
                          <span className="mt-1 block text-sm font-black">{selectedHasImport ? 'OK' : 'À ajouter'}</span>
                        </div>
                        <div className="rounded-[16px] border border-white/15 bg-white/10 p-3">
                          <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-[#F7D48A]">Production</span>
                          <span className="mt-1 block text-sm font-black">{selectedProductionImported ? 'OK' : 'À ajouter'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-[#D4B58F] bg-[#FCF7EF] p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#B56A28]">
                        Repère terrain
                      </p>
                      <div className="mt-4 grid gap-3">
                        <div className="flex items-center gap-3 rounded-[16px] bg-[#F3E6D5] p-3">
                          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#3A2418] text-sm font-black text-[#F7D48A]">1</span>
                          <span className="text-sm font-black text-[#342016]">Les chiffres du mois</span>
                        </div>
                        <div className="flex items-center gap-3 rounded-[16px] bg-[#F3E6D5] p-3">
                          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#3A2418] text-sm font-black text-[#F7D48A]">2</span>
                          <span className="text-sm font-black text-[#342016]">Les deux fichiers</span>
                        </div>
                        <div className="flex items-center gap-3 rounded-[16px] bg-[#F3E6D5] p-3">
                          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#3A2418] text-sm font-black text-[#F7D48A]">3</span>
                          <span className="text-sm font-black text-[#342016]">Lecture des ratios</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-col gap-3">
                  <div className="rounded-[18px] border border-[#D4B58F] bg-[#FCF7EF] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#71513C]">Inventaire</p>
                        <p className="mt-1 text-sm font-bold text-[#342016]">
                          {selectedHasImport ? 'Fichier chargé' : 'Fichier à ajouter'}
                        </p>
                      </div>
                      <button
                        onClick={() => canImport && setModalState({ month: selectedMonth.key, target: 'inventory' })}
                        disabled={!canImport}
                        className={`rounded-[12px] border px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] transition ${
                          selectedHasImport
                            ? 'border-[#A8B69A] bg-[#EEF3E9] text-[#4D613C] hover:bg-[#E7EEE0]'
                            : 'border-[#CDB08A] bg-[#FBF6EE] text-[#6F4A34] hover:bg-white'
                        } ${!canImport ? 'cursor-not-allowed opacity-50' : ''}`}
                      >
                        {selectedHasImport ? 'Modifier' : 'Ajouter'}
                      </button>
                    </div>

                    {selectedHasImport && (
                      <button
                        type="button"
                        onClick={() => removeInventoryForMonth(selectedMonth.key)}
                        disabled={!canRemoveImport}
                        title={`Supprimer l'import inventaire ${selectedMonth.label}`}
                        className="mt-3 w-full rounded-[12px] border border-[#CDB08A] bg-[#FBF6EE] px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#8A452C] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Supprimer l’import
                      </button>
                    )}
                  </div>

                  <div className="rounded-[18px] border border-[#D4B58F] bg-[#FCF7EF] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#71513C]">Production</p>
                        <p className="mt-1 text-sm font-bold text-[#342016]">
                          {selectedProductionImported ? 'Fichier chargé' : 'Fichier à ajouter'}
                        </p>
                      </div>
                      <button
                        onClick={() => canImport && setModalState({ month: selectedMonth.key, target: 'production' })}
                        disabled={!canImport}
                        className={`rounded-[12px] border px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] transition ${
                          selectedProductionImported
                            ? 'border-[#A8B69A] bg-[#EEF3E9] text-[#4D613C] hover:bg-[#E7EEE0]'
                            : 'border-[#CDB08A] bg-[#FBF6EE] text-[#6F4A34] hover:bg-white'
                        } ${!canImport ? 'cursor-not-allowed opacity-50' : ''}`}
                      >
                        {selectedProductionImported ? 'Modifier' : 'Ajouter'}
                      </button>
                    </div>

                    {selectedProductionImported && (
                      <button
                        type="button"
                        onClick={() => removeProductionImportForMonth(selectedMonth.key)}
                        disabled={!canRemoveImport}
                        title={`Supprimer l'import production ${selectedMonth.label}`}
                        className="mt-3 w-full rounded-[12px] border border-[#CDB08A] bg-[#FBF6EE] px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#8A452C] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Supprimer l’import
                      </button>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col justify-end rounded-[18px] border border-[#D4B58F] bg-[#F3E6D5] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#71513C]">
                      Suite logique
                    </p>
                    <p className="mt-2 text-lg font-black text-[#342016]">
                      {nextMonth ? nextMonth.label : 'Année complète'}
                    </p>
                    {nextMonth ? (
                      <button
                        type="button"
                        onClick={() => setSelectedMonthKey(nextMonth.key)}
                        className="mt-4 w-full rounded-[14px] border border-[#9E5E2B] bg-[#3A2418] px-4 py-3 text-[12px] font-black uppercase tracking-[0.1em] text-[#FFF6E8] transition hover:bg-[#4B2A1B]"
                      >
                        Passer au mois suivant
                      </button>
                    ) : (
                      <span className="mt-4 block rounded-[14px] border border-[#A8B69A] bg-[#EEF3E9] px-4 py-3 text-center text-[12px] font-black uppercase tracking-[0.1em] text-[#4D613C]">
                        Tous les mois sont visibles
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </section>
        </main>
      </div>
    </div>
  );
};

export default StatsPage;
