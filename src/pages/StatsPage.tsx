// =============================================================
// pages/StatsPage.tsx
// Version optimisée pour opérationnels terrain
// Interface simplifiée, ergonomique et pratique
// =============================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { readFileAsCSV } from '../utils/csvHelpers';
import { validateImportFile } from '../utils/importFileValidation';
import { useToast } from '../components/Toast';
import { View, MONTHS_DISPLAY_CONFIG } from '../constants';
import { ImportModal } from '../components/Modals';
import AppNavTile from '../components/AppNavTile';
import AiAssistantDrawer from '../components/AiAssistantDrawer';
import { useAuth } from '../auth/AuthProvider';
import { loadUiState, saveUiState } from '../hooks/appStateHelpers';
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
  const [selectedMonthKey, setSelectedMonthKey] = useState(() =>
    loadUiState(
      'statsSelectedMonth',
      MONTHS_DISPLAY_CONFIG[new Date().getMonth()]?.key ?? MONTHS_DISPLAY_CONFIG[0].key
    )
  );
  const [showAllMonths, setShowAllMonths] = useState(false);
  const cellRefs = useRef<Record<CellKey, HTMLInputElement | null>>({});

  useEffect(() => {
    saveUiState('statsSelectedMonth', selectedMonthKey);
  }, [selectedMonthKey]);

  const editableColumns = useMemo<EditableField[]>(() => ['sales', 'cm', 'covers'], []);

  const resolveImportTargetMonth = (requestedMonth: string, target: 'inventory' | 'production') => {
    const lockMap = target === 'production' ? prepValidatedMonths : {}; // le figé Calcul vente ratio ne verrouille pas les imports Paramètres
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
      await validateImportFile(file, 'tabular');
      const content = await readFileAsCSV(file);
      const targetMonth = resolveImportTargetMonth(modalState.month, modalState.target);

      if (modalState.target === 'inventory') {
        setDetailedInventory((prev) => ({ ...prev, [targetMonth]: content }));
        showToast(`✓ Inventaire ${targetMonth.toUpperCase()} importé`, 'success');
      } else {
        setPrepImportsByMonth((prev) => ({ ...prev, [targetMonth]: content }));
        showToast(`✓ Production ${targetMonth.toUpperCase()} importée`, 'success');
      }
      setModalState(null);
    } catch (err) {
      showToast('Erreur : ' + (err as Error).message, 'error');
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
    } else if (field === 'cm') {
      setCostMatterByMonth((prev) => ({ ...prev, [monthKey]: value }));
    } else {
      setCovers((prev) => ({ ...prev, [monthKey]: value }));
    }
  };

  const startEdit = (monthKey: string, field: EditableField, monthIndex: number) => {
    if (!canEditFields) return;
    const cellKey: CellKey = `${monthKey}-${field}`;
    const val = getValue(monthKey, field);
    const allowDecimals = field !== 'covers';
    setDrafts((prev) => ({ ...prev, [cellKey]: getRawValue(val, allowDecimals) }));
    setActiveCell(cellKey);

    setTimeout(() => {
      const input = cellRefs.current[cellKey];
      if (input) {
        input.focus();
        input.select();
      }
    }, 10);
  };

  const commitEdit = (monthKey: string, field: EditableField) => {
    const cellKey: CellKey = `${monthKey}-${field}`;
    const draft = drafts[cellKey] ?? '';
    const allowDecimals = field !== 'covers';
    const newVal = parseInputValue(draft, allowDecimals);

    setValue(monthKey, field, newVal);
    setActiveCell(null);
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[cellKey];
      return next;
    });
  };

  const cancelEdit = (monthKey: string, field: EditableField) => {
    const cellKey: CellKey = `${monthKey}-${field}`;
    setActiveCell(null);
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[cellKey];
      return next;
    });
  };

  const renderEditableInput = (
    monthKey: string,
    monthIndex: number,
    field: EditableField,
    placeholder: string,
    className = ''
  ) => {
    const cellKey: CellKey = `${monthKey}-${field}`;
    const isActive = activeCell === cellKey;
    const locked = false;
    const val = getValue(monthKey, field);
    const displayVal = formatDisplayValue(field, val);
    const draft = drafts[cellKey] ?? '';

    if (isActive && !locked) {
      return (
        <input
          ref={(el) => (cellRefs.current[cellKey] = el)}
          type="text"
          inputMode={field === 'covers' ? 'numeric' : 'decimal'}
          value={draft}
          onChange={(e) => setDrafts((prev) => ({ ...prev, [cellKey]: e.target.value }))}
          onBlur={() => commitEdit(monthKey, field)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitEdit(monthKey, field);
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              cancelEdit(monthKey, field);
            }
          }}
          placeholder={placeholder}
          className={`w-full rounded-lg border-2 border-[#B66A2C] bg-[#FFFDF8] px-4 py-3 font-semibold text-[#2F1D14] placeholder:text-[#A88B72] focus:outline-none ${className}`}
        />
      );
    }

    return (
      <button
        type="button"
        onClick={() => canEditFields && !locked && startEdit(monthKey, field, monthIndex)}
        disabled={!canEditFields || locked}
        className={`w-full rounded-lg border-2 px-4 py-3 text-left font-semibold transition ${
          locked
            ? 'cursor-not-allowed border-[#DEC4A3] bg-[#F4E8D8] text-[#9A806A]'
            : canEditFields
            ? 'border-[#DEC4A3] bg-[#FFFDF8] text-[#2F1D14] hover:border-[#B66A2C] hover:bg-white'
            : 'cursor-not-allowed border-[#DEC4A3] bg-[#F4E8D8] text-[#7B5A43]'
        } ${className}`}
      >
        {displayVal || <span className="text-gray-400">{placeholder}</span>}
      </button>
    );
  };

  const selectedMonthIndex = MONTHS_DISPLAY_CONFIG.findIndex((m) => m.key === selectedMonthKey);
  const selectedMonth = MONTHS_DISPLAY_CONFIG[selectedMonthIndex] || MONTHS_DISPLAY_CONFIG[0];

  const selectedHasNumbers = !!(
    getValue(selectedMonth.key, 'sales') ||
    getValue(selectedMonth.key, 'cm') ||
    getValue(selectedMonth.key, 'covers')
  );

  const selectedHasImport = !!detailedInventory[selectedMonth.key];
  const selectedProductionImported = !!prepImportsByMonth[selectedMonth.key];
  const monthsToDisplay = showAllMonths ? MONTHS_DISPLAY_CONFIG : MONTHS_DISPLAY_CONFIG.slice(0, 6);
  const getAiContext = React.useCallback(() => {
    const monthRows = MONTHS_DISPLAY_CONFIG.map((month) => {
      const inventoryImported = !!detailedInventory[month.key];
      const productionImported = !!prepImportsByMonth[month.key];
      return `${month.label}: inventaire=${inventoryImported ? 'importé' : 'absent'}, prod=${productionImported ? 'importé' : 'absent'}, CA_HT=${salesHtByMonth[month.key] || 0}, cout_matiere=${costMatterByMonth[month.key] || 0}%, couverts=${covers[month.key] || 0}, prod_fige=${prepValidatedMonths[month.key] ? 'oui' : 'non'}`;
    });

    return [
      'Page: Paramètres imports.',
      `Mois sélectionné: ${selectedMonth.label}.`,
      'Rappel logique: import inventaire pour calcul vente ratio; import production pour mise en place, calcul prod ratio et taux de prise.',
      `Droits: import=${canImport ? 'oui' : 'non'}, suppression import=${canRemoveImport ? 'oui' : 'non'}, édition chiffres=${canEditFields ? 'oui' : 'non'}.`,
      ...monthRows,
    ].join('\n');
  }, [canEditFields, canImport, canRemoveImport, costMatterByMonth, covers, detailedInventory, prepImportsByMonth, prepValidatedMonths, salesHtByMonth, selectedMonth.label]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,rgba(245,166,58,0.28),transparent_30%),linear-gradient(180deg,#FFF7EA_0%,#F3DDC0_46%,#C97933_100%)] text-[#2F1D14]">
      {modalState && (
        <ImportModal
          monthLabel={MONTHS_DISPLAY_CONFIG.find((m) => m.key === modalState.month)?.label || ''}
          onClose={() => setModalState(null)}
          onFileSelected={handleFile}
          type="detailed"
        />
      )}

      <div className="mx-auto max-w-7xl">
        <main className="p-4 md:p-6">
          {/* En-tête */}
          <div className="mb-6 flex flex-col gap-4 rounded-[24px] border border-[#C89245]/55 bg-[linear-gradient(135deg,#3A2116_0%,#69331F_58%,#A85F2A_100%)] p-4 shadow-[0_18px_42px_rgba(54,24,12,0.18)] xl:flex-row xl:items-center xl:justify-between [&>h1]:hidden">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <h1 className="text-3xl font-black tracking-tight text-[#FFF7EA]">Paramètres</h1>
              <AppNavTile
                type="button"
                onClick={() => setView('home')}
                eyebrow="Retour"
                icon="home"
                tone="dark"
                size="md"
              >
                Accueil
              </AppNavTile>
              <AiAssistantDrawer placement="inline" title="Assistant IA - Imports" getContext={getAiContext} />
            </div>
            <div className="hidden">
            <h1 className="text-2xl font-bold text-gray-900">Données mensuelles</h1>
            <p className="mt-1 text-sm text-gray-600">Saisie et imports des données du restaurant</p>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>

            <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[560px] [&>button:nth-child(-n+2)]:hidden">
              <button
                type="button"
                onClick={() => setView('home')}
                className="rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-left text-sm font-bold text-gray-900 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
              >
                <span className="block text-[10px] font-black uppercase tracking-wide text-gray-400">Retour</span>
                Accueil
              </button>

              <button
                type="button"
                disabled
                className="rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm font-bold text-amber-900 shadow-sm"
              >
                <span className="block text-[10px] font-black uppercase tracking-wide text-amber-500">Page active</span>
                ParamÃ¨tres
              </button>

              <AppNavTile
                type="button"
                onClick={() => canOpenRatios && setView('ratios')}
                disabled={!canOpenRatios}
                eyebrow="Calcul"
                size="md"
              >
                Vente ratio
              </AppNavTile>

              <AppNavTile
                type="button"
                onClick={() => canOpenRatios && setView('prep_ratios')}
                disabled={!canOpenRatios}
                eyebrow="Calcul"
                size="md"
              >
                Production
              </AppNavTile>

              <AppNavTile
                type="button"
                onClick={() => canOpenRatios && setView('take_rate')}
                disabled={!canOpenRatios}
                eyebrow="Suivi"
                size="md"
              >
                Taux de prise
              </AppNavTile>

              <AppNavTile
                type="button"
                onClick={() => canOpenRatios && setView('order_template')}
                disabled={!canOpenRatios}
                eyebrow="Import"
                size="md"
              >
                Trame commande
              </AppNavTile>

              <AppNavTile
                type="button"
                onClick={() => setView('tutorials')}
                eyebrow="Aide"
                size="md"
              >
                Tutoriels
              </AppNavTile>
            </div>
          </div>

          {/* Navigation mois */}
          <div className="hidden">
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {MONTHS_DISPLAY_CONFIG.map((month) => {
                const isSelected = month.key === selectedMonthKey;
                const hasData = !!(
                  getValue(month.key, 'sales') ||
                  getValue(month.key, 'cm') ||
                  getValue(month.key, 'covers')
                );
                const isLocked = false;

                return (
                  <button
                    key={month.key}
                    onClick={() => setSelectedMonthKey(month.key)}
                    className={`flex-shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md'
                        : hasData
                        ? 'bg-white text-gray-900 shadow-sm hover:bg-gray-50'
                        : 'bg-white text-gray-500 shadow-sm hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {month.label}
                      {isLocked && <span className="text-xs">🔒</span>}
                      {!isLocked && hasData && <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contenu principal */}
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="rounded-[24px] border border-[#D8AE77] bg-[#FFF7EA] p-4 shadow-[0_14px_30px_rgba(80,38,18,0.12)] lg:sticky lg:top-6 lg:self-start">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[#7B4B2A]">Mois</h2>
              <div className="mt-4 grid gap-2">
                {MONTHS_DISPLAY_CONFIG.map((month) => {
                  const isSelected = month.key === selectedMonthKey;
                  const inventoryImported = !!detailedInventory[month.key];
                  const productionImported = !!prepImportsByMonth[month.key];
                  const importCount = Number(inventoryImported) + Number(productionImported);
                  const statusColor =
                    importCount === 2 ? 'bg-green-500' : importCount === 1 ? 'bg-orange-500' : 'bg-red-500';
                  const statusLabel = importCount === 2 ? 'Complet' : importCount === 1 ? 'Partiel' : 'Vide';

                  return (
                    <button
                      key={month.key}
                      type="button"
                      onClick={() => setSelectedMonthKey(month.key)}
                      className={`flex w-full items-center gap-3 rounded-lg border-2 px-3 py-3 text-left text-sm font-semibold transition ${
                        isSelected
                          ? 'border-[#A85F2A] bg-[#3A2116] text-[#FFF7EA] shadow-[0_8px_18px_rgba(54,24,12,0.18)]'
                          : 'border-[#E5C89D] bg-[#FFFDF8] text-[#342016] hover:border-[#C89245] hover:bg-white'
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
                      <span className="min-w-0 flex-1">{month.label}</span>
                      <span className={`text-xs font-black uppercase tracking-wide ${isSelected ? 'text-[#F1C27B]' : 'text-[#9A806A]'}`}>{statusLabel}</span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="space-y-6">
            {/* Section chiffres */}
            <section className="rounded-[24px] border border-[#D8AE77] bg-[#FFF7EA] p-6 shadow-[0_14px_30px_rgba(80,38,18,0.12)] [&_label]:font-black [&_label]:text-[#6A432D]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-black text-[#2F1D14]">Chiffres du mois</h2>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    selectedHasNumbers
                      ? 'bg-[#E8F0DE] text-[#4D613C]'
                      : 'bg-[#F6DEB1] text-[#7B4B2A]'
                  }`}
                >
                  {selectedHasNumbers ? '✓ Complété' : 'À saisir'}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">CA HT (€)</label>
                  {renderEditableInput(selectedMonth.key, selectedMonthIndex, 'sales', '0', 'text-lg')}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Coût matière (%)</label>
                  {renderEditableInput(selectedMonth.key, selectedMonthIndex, 'cm', '0', 'text-lg')}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Couverts</label>
                  {renderEditableInput(selectedMonth.key, selectedMonthIndex, 'covers', '0', 'text-lg')}
                </div>
              </div>
            </section>

            {/* Section imports et actions */}
            <div className="grid gap-6 lg:grid-cols-1">
              {/* Imports */}
              <section className="rounded-[24px] border border-[#D8AE77] bg-[#FFF7EA] p-6 shadow-[0_14px_30px_rgba(80,38,18,0.12)]">
                <h2 className="mb-4 text-lg font-black text-[#2F1D14]">Imports fichiers</h2>

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Inventaire */}
                  <div className="rounded-[18px] border-2 border-[#E2C39B] bg-[#FFFDF8] p-4 shadow-[0_8px_18px_rgba(80,38,18,0.08)]">
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <h3 className="font-black text-[#2F1D14]">Inventaire</h3>
                        <div className="mt-1 flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              selectedHasImport ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                          />
                          <span className="text-sm font-bold text-[#6A432D]">
                            {selectedHasImport ? 'Importé' : 'Non importé'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => canImport && setModalState({ month: selectedMonth.key, target: 'inventory' })}
                        disabled={!canImport}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                          canImport
                            ? 'bg-[#C86F24] text-white shadow-[0_4px_0_#8B431C] hover:bg-[#B85F1D]'
                            : 'cursor-not-allowed bg-[#F4E8D8] text-[#9A806A]'
                        }`}
                      >
                        {selectedHasImport ? 'Modifier' : 'Importer'}
                      </button>
                    </div>

                    {selectedHasImport && (
                      <button
                        onClick={() => removeInventoryForMonth(selectedMonth.key)}
                        disabled={!canRemoveImport}
                        className="w-full rounded-lg border-2 border-[#E7B7A0] bg-[#FFF1EA] px-4 py-2 text-sm font-black text-[#9B3F21] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>

                  {/* Production */}
                  <div className="rounded-[18px] border-2 border-[#E2C39B] bg-[#FFFDF8] p-4 shadow-[0_8px_18px_rgba(80,38,18,0.08)]">
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <h3 className="font-black text-[#2F1D14]">Production</h3>
                        <div className="mt-1 flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              selectedProductionImported ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                          />
                          <span className="text-sm font-bold text-[#6A432D]">
                            {selectedProductionImported ? 'Importé' : 'Non importé'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => canImport && setModalState({ month: selectedMonth.key, target: 'production' })}
                        disabled={!canImport}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                          canImport
                            ? 'bg-[#C86F24] text-white shadow-[0_4px_0_#8B431C] hover:bg-[#B85F1D]'
                            : 'cursor-not-allowed bg-[#F4E8D8] text-[#9A806A]'
                        }`}
                      >
                        {selectedProductionImported ? 'Modifier' : 'Importer'}
                      </button>
                    </div>

                    {selectedProductionImported && (
                      <button
                        onClick={() => removeProductionImportForMonth(selectedMonth.key)}
                        disabled={!canRemoveImport}
                        className="w-full rounded-lg border-2 border-[#E7B7A0] bg-[#FFF1EA] px-4 py-2 text-sm font-black text-[#9B3F21] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>
              </section>

              {/* Actions rapides */}
              <aside className="hidden">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-600">
                  Actions rapides
                </h2>

                {canOpenRatios ? (
                  <div className="space-y-3">
                    <button
                      onClick={() => setView('ratios')}
                      className="w-full rounded-lg bg-gray-900 px-4 py-3.5 text-left font-semibold text-white transition hover:bg-gray-800"
                    >
                      <span className="block text-sm">Vente</span>
                      <span className="mt-0.5 block text-xs text-gray-400">Ratios de vente</span>
                    </button>
                    <button
                      onClick={() => setView('prep_ratios')}
                      className="w-full rounded-lg bg-blue-600 px-4 py-3.5 text-left font-semibold text-white transition hover:bg-blue-700"
                    >
                      <span className="block text-sm">Production</span>
                      <span className="mt-0.5 block text-xs text-blue-200">Ratios de production</span>
                    </button>
                  </div>
                ) : (
                  <button
                    disabled
                    className="w-full cursor-not-allowed rounded-lg bg-gray-200 px-4 py-3 text-sm font-semibold text-gray-500"
                  >
                    Accès ratios indisponible
                  </button>
                )}

                <div className="mt-4 rounded-lg bg-white/60 p-3">
                  <p className="text-xs text-gray-600">
                    💡 Le taux de prise utilise les données de production
                  </p>
                </div>
              </aside>
            </div>

            {/* Tableau récapitulatif */}
            <section className="hidden">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Vue d'ensemble</h2>
                <button
                  onClick={() => setShowAllMonths(!showAllMonths)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  {showAllMonths ? 'Voir moins' : 'Voir tout'}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="pb-3 pr-4 font-semibold text-gray-900">Mois</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-900">CA HT</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-900">Coût %</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-900">Couverts</th>
                      <th className="pb-3 font-semibold text-gray-900">État</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthsToDisplay.map((month) => {
                      const sales = getValue(month.key, 'sales');
                      const cm = getValue(month.key, 'cm');
                      const couverts = getValue(month.key, 'covers');
                      const isLocked = false;
                      const hasImport = !!detailedInventory[month.key];

                      return (
                        <tr key={month.key} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 pr-4 font-medium text-gray-900">{month.label}</td>
                          <td className="py-3 pr-4 text-gray-700">
                            {sales ? `${formatNumber(sales)} €` : '-'}
                          </td>
                          <td className="py-3 pr-4 text-gray-700">
                            {cm ? `${formatNumber(cm)} %` : '-'}
                          </td>
                          <td className="py-3 pr-4 text-gray-700">
                            {couverts ? formatNumber(couverts, 0) : '-'}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              {isLocked && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                                  🔒 Validé
                                </span>
                              )}
                              {!isLocked && hasImport && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                                  ✓ Importé
                                </span>
                              )}
                              {!isLocked && !hasImport && (sales || cm || couverts) && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                                  ✓ Saisi
                                </span>
                              )}
                              {!isLocked && !hasImport && !sales && !cm && !couverts && (
                                <span className="text-xs text-gray-400">Vide</span>
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
          </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default StatsPage;
