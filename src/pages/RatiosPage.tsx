// =============================================================
// pages/RatiosPage.tsx
// Page "Intelligence de Vente" - ratios par mois + mapping import
// Desktop only visuel aligned with PrepRatiosPage
// =============================================================

import React, { useState } from 'react';
import { MONTHS_ORDER, SupplierId } from '../constants';
import { SupplierConfig } from '../types';
import RatiosMappingPopover from '../components/RatiosMappingPopover';
import AppNavTile from '../components/AppNavTile';
import AiAssistantDrawer from '../components/AiAssistantDrawer';
import { useAppState } from '../hooks/useAppState';
import { useAuth } from '../auth/AuthProvider';
import { canEditRatios } from '../lib/permissions';
import { getImportedValueForProduct } from '../utils/csvHelpers';

type AppState = ReturnType<typeof useAppState>;

interface RatiosPageProps {
  state:                 AppState;
  ratiosScrollRef:       React.RefObject<HTMLDivElement>;
  ratiosBottomScrollRef: React.RefObject<HTMLDivElement>;
  ratiosScrollWidth:     number;
  syncRatiosScroll:      (source: 'main' | 'bottom') => void;
}

const MONTH_LABELS: Record<string, string> = {
  jan: 'Jan', feb: 'Fév', mar: 'Mar', apr: 'Avr',
  may: 'Mai', jun: 'Jun', jul: 'Jul', aug: 'Aoû',
  sep: 'Sep', oct: 'Oct', nov: 'Nov', dec: 'Déc',
};

const hasUsableAmount = (value: unknown) =>
  Number(value || 0) > 0;

const hasFrozenLinkedValue = (snapshot: any) =>
  !!snapshot?.isLinked && hasUsableAmount(snapshot?.salesValue);

const hasFrozenMonthData = (product: any, month: string) =>
  !!product.ratioSnapshots?.[month] || Number(product.salesHistory?.[month] || 0) > 0;

// Source unique de vérité pour le statut lié/non lié d'un produit,
// utilisée à la fois par ProductCard et par la page (filtrage, comptages, contexte IA).
const isProductLinked = (p: any, monthFreezeMap: Record<string, boolean>, displayMonthKey: string, detailedInventory: any): boolean => {
  const isFrozenDisplay = !!monthFreezeMap[displayMonthKey];
  const frozenSnapshot = isFrozenDisplay ? p.ratioSnapshots?.[displayMonthKey] : undefined;
  if (frozenSnapshot) return hasFrozenLinkedValue(frozenSnapshot);

  const hasLegacyFrozenValue = isFrozenDisplay && Number(p.salesHistory?.[displayMonthKey] || 0) > 0;
  if (hasLegacyFrozenValue) return true;

  const liveImportedValue = isFrozenDisplay
    ? null
    : getImportedValueForProduct(detailedInventory[displayMonthKey], p.searchName, p.importDivisor);
  return hasUsableAmount(liveImportedValue);
};

type LinkState = 'linked' | 'unlinked';

// Palette partagée : bordure, fond de carte et bouton rond dérivent tous du même état.
const LINK_STATE_STYLES: Record<LinkState, { border: string; bg: string; dot: string }> = {
  linked:   { border: 'border-l-[#6D8F4E]', bg: 'bg-[#F2F7EC]', dot: 'bg-[#6D8F4E]' },
  unlinked: { border: 'border-l-[#D4922F]', bg: 'bg-[#FDF3E1]', dot: 'bg-[#D4922F]' },
};

const formatWholeVisual = (value: unknown) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return '–';
  return Math.ceil(numeric).toLocaleString('fr-FR');
};

const ProductCard: React.FC<{
  p: any;
  idx: number;
  total: number;
  state: AppState;
  canEdit: boolean;
  displayMonthKey: string;
}> = ({ p, idx, total, state, canEdit, displayMonthKey }) => {
  const [expanded, setExpanded] = useState(false);
  const mappingButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const [mappingAnchorRect, setMappingAnchorRect] = React.useState<DOMRect | null>(null);
  const {
    selectedProductIds, toggleProductSelection,
    moveProduct, handleNameChange,
    updateSearchName, updateImportDivisor,
    activeMappingId, setActiveMappingId,
    allAvailableImportNames, products, detailedInventory,
    validatedMonths, ratioValidatedMonths, toggleValidateMonth,
    getProductStats,
  } = state;

  const monthFreezeMap = ratioValidatedMonths ?? validatedMonths;
  const { avgRatio, mR, mS } = getProductStats(p);
  const isFrozenDisplay = !!monthFreezeMap[displayMonthKey];
  const frozenSnapshot = isFrozenDisplay ? p.ratioSnapshots?.[displayMonthKey] : undefined;
  const displaySearchName = frozenSnapshot?.searchName ?? p.searchName;
  const displayProductName = frozenSnapshot?.productName ?? p.name;
  const isMapped = isProductLinked(p, monthFreezeMap, displayMonthKey, detailedInventory);
  const alert      = !isMapped;
  const linkState: LinkState = alert ? 'unlinked' : 'linked';
  const stateStyle = LINK_STATE_STYLES[linkState];
  const selected   = selectedProductIds.has(p.id);
  const cardStateClasses = selected
    ? 'border-l-[#B85B2B] border-y-[#D8AE77] border-r-[#D8AE77] bg-[#FFF4E4]'
    : `${stateStyle.border} border-y-[#D8CAB8] border-r-[#D8CAB8] ${stateStyle.bg}`;

  return (
    <div className={`relative rounded-[22px] border-l-[6px] border-y border-r transition-all shadow-[0_10px_22px_rgba(66,42,24,0.07)] ${cardStateClasses}`}>
      <div className="flex items-center gap-2 p-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => toggleProductSelection(p.id)}
          disabled={!canEdit}
          className="h-5 w-5 shrink-0 cursor-pointer accent-[#C86F24]"
        />
        <input
          className={`min-w-0 flex-1 rounded-xl border bg-[#FFFDF8] px-3 py-2 text-sm font-black italic outline-none ${alert ? 'border-amber-300 text-amber-700' : 'border-transparent text-[#24160F]'}`}
          value={displaySearchName}
          placeholder="Nom produit dans l'import..."
          onChange={e => updateSearchName(p.id, e.target.value)}
          disabled={!canEdit || isFrozenDisplay}
        />
        <div className="relative z-[70] shrink-0 overflow-visible">
          <button
            ref={mappingButtonRef}
            type="button"
            onClick={() => {
              const nextOpen = activeMappingId !== p.id;
              setActiveMappingId(nextOpen ? p.id : null);
              setMappingAnchorRect(nextOpen ? mappingButtonRef.current?.getBoundingClientRect() ?? null : null);
            }}
            disabled={!canEdit || isFrozenDisplay}
            className={`flex h-9 w-9 items-center justify-center rounded-full ${stateStyle.dot} text-white shadow-sm transition hover:opacity-90 disabled:opacity-50`}
            title="Rechercher un mapping"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"/>
            </svg>
          </button>
          {activeMappingId === p.id && !isFrozenDisplay && (
            <div className="absolute right-0 top-[calc(100%+10px)] z-[9999] w-[320px] max-w-[calc(100vw-32px)] overflow-visible">
              <RatiosMappingPopover
                anchorRect={mappingAnchorRect}
                orphanNames={Array.from(allAvailableImportNames).filter((name) => {
                  const normalizedName = String(name).trim().toLowerCase();
                  return !products.some((pr) => (
                    pr.id !== p.id &&
                    pr.supplierId === p.supplierId &&
                    pr.searchName.trim().toLowerCase() === normalizedName
                  ));
                })}
                onSelect={n => { if (!canEdit) return; updateSearchName(p.id, n); setActiveMappingId(null); setMappingAnchorRect(null); }}
                onClose={() => { setActiveMappingId(null); setMappingAnchorRect(null); }}
              />
            </div>
          )}
        </div>
        <div className="shrink-0 rounded-xl border border-[#D8CAB8] bg-[#F6EFE6] px-2.5 py-1 text-center">
          <div className="text-[8px] font-black uppercase text-[#8B5A35]">Ratio</div>
          <div className="text-sm font-black leading-none text-[#2F1D14]">{avgRatio.toFixed(3)}</div>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#D8CAB8] bg-[#F6EFE6] text-[#6A432D]"
        >
          <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-[#E2C39B] bg-[#F8F0E6]/80 p-3">
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <div className="mb-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#A85F2A]">Nom affiché dans les commandes</div>
              <div className="flex items-center gap-1">
                <input
                  className="min-w-0 flex-1 rounded-xl border border-[#E2C39B] bg-[#FFFDF8] px-3 py-2 text-xs font-black uppercase text-[#24160F] outline-none focus:border-[#C86F24]"
                  value={displayProductName}
                  placeholder="Nom visible dans les commandes..."
                  onChange={e => handleNameChange(p.id, e.target.value)}
                  disabled={!canEdit || isFrozenDisplay}
                />
              </div>
              {p.storageUnit && (
                <div className="mt-1 text-[10px] font-semibold text-gray-400">{p.storageUnit}</div>
              )}
            </div>

            <div className="shrink-0 w-20">
              <div className="mb-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#A85F2A]">÷ KG→U</div>
              <input
                type="number"
                value={p.importDivisor ?? ''}
                onChange={e => updateImportDivisor(p.id, e.target.value)}
                disabled={!canEdit || isFrozenDisplay}
                className="w-full rounded-xl border border-[#E2C39B] bg-[#FFFDF8] px-2 py-2 text-center text-sm font-black text-[#6A432D] outline-none focus:border-[#C86F24]"
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#A85F2A]">Ventes & ratios par mois</div>
            <div className="grid grid-cols-6 gap-1 2xl:grid-cols-12">
              {MONTHS_ORDER.map(m => (
                <div key={m} className={`rounded-lg p-1.5 text-center ${mS[m].isValidated ? 'border border-[#6D8F4E] bg-[#F1F5E9]' : mS[m].isImported ? 'border border-[#D8AE77] bg-[#FFF7EA]' : 'border border-[#E8D8C6] bg-[#FFFDF8]'}`}>
                  <div className="mb-0.5 text-[8px] font-black uppercase text-[#8B6B54]">{MONTH_LABELS[m]}</div>
                  <div className={`mb-0.5 text-xs font-black leading-none ${mS[m].isValidated ? 'text-[#2F6B38]' : mS[m].isImported ? 'text-[#A85F2A]' : 'text-[#B7A08D]'}`}>
                    {formatWholeVisual(mS[m].value)}
                  </div>
                  <div className="font-mono text-[8px] text-[#2F7A42]">{mR[m].toFixed(2)}</div>
                  <button
                    onClick={() => toggleValidateMonth(m)}
                    disabled={!canEdit}
                    className={`mt-0.5 w-full rounded py-0.5 text-[7px] font-black uppercase disabled:cursor-not-allowed disabled:opacity-50 ${monthFreezeMap[m] ? 'bg-[#2F7A42] text-white' : 'bg-[#F3DDC0] text-[#8B6B54]'}`}
                  >
                    {monthFreezeMap[m] ? 'Figé' : 'Val.'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase text-[#8B6B54]">Ordre : #{idx + 1}</span>
            <div className="flex gap-2">
              <button
                onClick={() => moveProduct(p.id, 'up')}
                disabled={!canEdit || idx === 0}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2F1D14] text-[#F7B24A] disabled:opacity-20"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/></svg>
              </button>
              <button
                onClick={() => moveProduct(p.id, 'down')}
                disabled={!canEdit || idx === total - 1}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2F1D14] text-[#F7B24A] disabled:opacity-20"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const RatiosPage: React.FC<RatiosPageProps> = ({
  state,
}) => {
  const { profile } = useAuth();
  const canEdit = canEditRatios(profile);
  const [showOnlyUnlinked, setShowOnlyUnlinked] = React.useState(false);

  const {
    setView,
    ratioTab, setRatioTab,
    products,
    supplierConfigs,
    selectedProductIds, setSelectedProductIds,
    addNewProduct,
    deleteSelectedProducts,
    validatedMonths,
    ratioValidatedMonths,
  } = state;

  const supplierTabs: { id: SupplierId; label: string }[] = Object.values(supplierConfigs)
    .filter((config: SupplierConfig) => !config.isArchived)
    .map((config: SupplierConfig) => ({ id: config.id, label: config.name }));

  const safeRatioTab = supplierTabs.some(tab => tab.id === ratioTab)
    ? ratioTab
    : (supplierTabs[0]?.id ?? 'doquet');

  React.useEffect(() => {
    if (safeRatioTab !== ratioTab) setRatioTab(safeRatioTab);
  }, [ratioTab, safeRatioTab, setRatioTab]);

  const supplierRatioProducts = React.useMemo(() => {
    return products.filter(p => p.supplierId === safeRatioTab);
  }, [products, safeRatioTab]);

  const availableImportNames = React.useMemo(
    () => Array.from(state.allAvailableImportNames),
    [state.allAvailableImportNames]
  );

  const activeSupplierLabel = supplierTabs.find(tab => tab.id === safeRatioTab)?.label ?? 'Fournisseur';
  const workMonthKey = String(state.importTargetMonth);
  const monthFreezeMap = ratioValidatedMonths ?? validatedMonths;
  const isWorkMonthValidated = !!monthFreezeMap[workMonthKey];
  const [freezeMonthKey, setFreezeMonthKey] = React.useState<string>(workMonthKey);
  const [displayMonthKey, setDisplayMonthKey] = React.useState<string>(workMonthKey);

  React.useEffect(() => {
    setFreezeMonthKey(workMonthKey);
    setDisplayMonthKey(workMonthKey);
  }, [workMonthKey]);

  React.useEffect(() => {
    if (!MONTHS_ORDER.includes(freezeMonthKey)) setFreezeMonthKey(workMonthKey);
  }, [freezeMonthKey, workMonthKey]);

  React.useEffect(() => {
    if (!MONTHS_ORDER.includes(displayMonthKey)) setDisplayMonthKey(workMonthKey);
  }, [displayMonthKey, workMonthKey]);

  const isSelectedFreezeMonthValidated = !!monthFreezeMap[freezeMonthKey];

  const isLinkedProduct = React.useCallback(
    (p: any) => isProductLinked(p, monthFreezeMap, displayMonthKey, state.detailedInventory),
    [displayMonthKey, monthFreezeMap, state.detailedInventory],
  );

  const displaySourceProducts = React.useMemo(() => {
    if (!monthFreezeMap[displayMonthKey]) return supplierRatioProducts;
    return supplierRatioProducts.filter((product) => hasFrozenMonthData(product, displayMonthKey));
  }, [displayMonthKey, monthFreezeMap, supplierRatioProducts]);

  const displayedRatioProducts = React.useMemo(() => {
    if (!showOnlyUnlinked) return displaySourceProducts;
    return displaySourceProducts.filter(p => !isLinkedProduct(p));
  }, [displaySourceProducts, showOnlyUnlinked, isLinkedProduct]);

  const mappedProductsCount = displaySourceProducts.filter(isLinkedProduct).length;
  const alertProductsCount = displaySourceProducts.length - mappedProductsCount;
  const selectedVisibleCount = displayedRatioProducts.filter(p => selectedProductIds.has(p.id)).length;
  const getAiContext = React.useCallback(() => {
    const topProducts = displaySourceProducts.slice(0, 80).map((p: any) => {
      const stats = state.getProductStats(p);
      const monthSales = stats.mS[displayMonthKey]?.value ?? 0;
      const monthRatio = stats.mR[displayMonthKey] ?? 0;
      return `${p.name || p.searchName || 'Produit sans nom'}: fournisseur=${activeSupplierLabel}, rechercheImport=${p.searchName || ''}, lié=${isLinkedProduct(p) ? 'oui' : 'non'}, ventesMois=${monthSales}, ratioMois=${monthRatio.toFixed(3)}`;
    });

    return [
      'Page: Calcul vente ratio.',
      'Source utilisée: import inventaire. La colonne quantité attendue est Conso Théorique Qté.',
      `Fournisseur actif: ${activeSupplierLabel}.`,
      `Mois de travail: ${workMonthKey}; mois affiché: ${displayMonthKey}; figé=${monthFreezeMap[displayMonthKey] ? 'oui' : 'non'}.`,
      `Produits fournisseur affichés: ${displaySourceProducts.length}; liés=${mappedProductsCount}; à revoir=${alertProductsCount}.`,
      `Imports disponibles sur mois de travail: ${availableImportNames.length}.`,
      'Produits visibles/extraits:',
      ...topProducts,
    ].join('\n');
  }, [activeSupplierLabel, alertProductsCount, availableImportNames.length, displayMonthKey, displaySourceProducts, isLinkedProduct, mappedProductsCount, monthFreezeMap, state, workMonthKey]);

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_12%_0%,rgba(247,178,74,0.18),transparent_30%),radial-gradient(circle_at_88%_8%,rgba(181,65,45,0.12),transparent_28%),linear-gradient(180deg,#FFF7EA_0%,#F8E6C7_52%,#E9C38B_100%)] text-[#2E1B12]">
      <div className="mx-auto flex min-h-[100dvh] max-w-[1760px] flex-col gap-3 p-3 lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden lg:p-4">
        <header className="flex-none overflow-hidden rounded-[28px] border border-[#8B431C] bg-[linear-gradient(90deg,#2F1D14_0%,#5A2819_48%,#A85F2A_100%)] shadow-[0_18px_36px_rgba(66,42,24,0.18)]">
          <div className="flex flex-col gap-3 px-4 py-3 lg:px-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-3">
              <AppNavTile onClick={() => setView('home')} eyebrow="Retour" icon="home" size="sm" tone="cream">Accueil</AppNavTile>
              <AppNavTile onClick={() => setView('stats')} eyebrow="Retour" icon="settings" size="sm" tone="cream">Paramètres</AppNavTile>
              <div className="hidden h-12 w-px bg-[#EBC28A]/55 sm:block" />
              <div className="min-w-0">
                <h2 className="truncate text-3xl font-black leading-none text-[#FFF7EA]">Calcul vente ratio</h2>
              </div>
              <AiAssistantDrawer placement="inline" title="Assistant IA - Vente ratio" getContext={getAiContext} />
            </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:min-w-[260px] [&>*:nth-child(1)]:hidden [&>*:nth-child(4)]:hidden [&>*:nth-child(5)]:hidden">
              <div className="rounded-2xl border border-[#EBC28A] bg-[#FFF7EA] px-3 py-2.5 shadow-sm">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#A85F2A]">Mois</p>
                <p className="mt-1 truncate text-sm font-black text-[#3A2116]">{state.importTargetMonth?.toUpperCase?.() ?? state.importTargetMonth}</p>
              </div>
              <div className="rounded-2xl border border-[#EBC28A] bg-[#FFF7EA] px-3 py-2.5 shadow-sm">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#A85F2A]">OK</p>
                <p className="mt-1 text-sm font-black text-[#2F7A42]">{mappedProductsCount}</p>
              </div>
              <div className="rounded-2xl border border-[#EBC28A] bg-[#FFF7EA] px-3 py-2.5 shadow-sm">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#A85F2A]">À revoir</p>
                <p className="mt-1 text-sm font-black text-[#B5412D]">{alertProductsCount}</p>
              </div>
              <button
                onClick={() => state.toggleValidateMonth(workMonthKey)}
                disabled={!canEdit}
                className={`rounded-2xl border px-3 py-2.5 text-left shadow-sm transition disabled:opacity-50 ${isWorkMonthValidated ? 'border-[#6D8F4E] bg-[#F1F5E9]' : 'border-[#EBC28A] bg-[#FFF7EA] hover:bg-white'}`}
              >
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#A85F2A]">{isWorkMonthValidated ? 'Mois figé' : 'Fin de mois'}</p>
                <p className="mt-1 text-sm font-black text-[#3A2116]">{isWorkMonthValidated ? 'Défiger' : 'Figer le mois'}</p>
              </button>
              <div className="rounded-2xl border border-[#EBC28A] bg-[#FFF7EA] px-3 py-2.5 shadow-sm">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#A85F2A]">Correction mois</p>
                <div className="mt-1 flex items-center gap-2">
                  <select
                    value={freezeMonthKey}
                    onChange={(e) => setFreezeMonthKey(e.target.value)}
                    disabled={!canEdit}
                    className="min-w-0 flex-1 rounded-xl border border-[#EBC28A] bg-[#FFFDF8] px-2 py-1 text-xs font-black text-[#3A2116] outline-none disabled:opacity-50"
                  >
                    {MONTHS_ORDER.map(m => (
                      <option key={m} value={m}>{MONTH_LABELS[m]}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => state.toggleValidateMonth(freezeMonthKey)}
                    disabled={!canEdit || !freezeMonthKey}
                    className="rounded-xl border border-[#D4922F] bg-[#FFF1DF] px-2 py-1 text-xs font-black text-[#3A2116] transition hover:bg-[#FFE8C2] disabled:opacity-50"
                  >
                    {isSelectedFreezeMonthValidated ? 'Défiger' : 'Figer'}
                  </button>
                </div>
              </div>
              </div>
            </div>
            <div className="rounded-2xl border border-[#EBC28A]/70 bg-[#FFF7EA]/14 p-2">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#F7C05B]">Figer les mois de vente</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#FFE1B8]">Mois affiché</span>
                  <select
                    value={displayMonthKey}
                    onChange={(e) => setDisplayMonthKey(e.target.value)}
                    className="rounded-xl border border-[#EBC28A] bg-[#FFF7EA] px-3 py-1.5 text-xs font-black text-[#3A2116] outline-none"
                  >
                    {MONTHS_ORDER.map(month => (
                      <option key={`display-sales-${month}`} value={month}>{MONTH_LABELS[month]}</option>
                    ))}
                  </select>
                  <p className="text-[11px] font-bold text-[#FFE1B8]">{MONTHS_ORDER.filter((month) => monthFreezeMap[month]).length} mois figes</p>
                </div>
              </div>
              <div className="grid grid-cols-6 gap-1.5 xl:grid-cols-12">
                {MONTHS_ORDER.map((month) => {
                  const locked = !!monthFreezeMap[month];
                  return (
                    <button
                      key={`sales-freeze-${month}`}
                      type="button"
                      onClick={() => {
                        setFreezeMonthKey(month);
                        state.toggleValidateMonth(month);
                      }}
                      disabled={!canEdit}
                      className={`min-h-[42px] rounded-xl border px-2 py-1 text-[10px] font-black uppercase tracking-[0.07em] transition disabled:opacity-50 ${
                        locked
                          ? 'border-emerald-700 bg-emerald-600 text-white shadow-sm'
                          : month === displayMonthKey
                            ? 'border-[#D8A640] bg-[#FFE8A8] text-[#5B321E]'
                            : 'border-[#EBC28A] bg-[#FFF7EA] text-[#2F1D14] hover:bg-white'
                      }`}
                    >
                      <span className="block text-xs">{MONTH_LABELS[month]}</span>
                      <span className="block text-[8px]">{locked ? 'Fige' : 'Ouvert'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </header>

        {!canEdit && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Lecture seule sur les ratios pour votre rôle.
          </div>
        )}

        <nav className="flex-none rounded-[24px] border border-[#EBC28A] bg-[#FFF7EA]/92 p-3 shadow-[0_10px_22px_rgba(66,42,24,0.08)] backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#A85F2A]">Fournisseur</span>
            {supplierTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setRatioTab(tab.id)}
                className={`min-h-[40px] rounded-2xl border px-4 py-2 text-[11px] font-black uppercase tracking-[0.08em] transition ${safeRatioTab === tab.id ? 'border-[#2F1D14] bg-[#2F1D14] text-[#FFF7EA] shadow-[0_8px_16px_rgba(54,24,12,0.16)]' : 'border-[#D8CAB8] bg-[#FFFCF6] text-[#6A432D] hover:border-[#A85F2A]'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        <main className="grid min-h-0 flex-1 grid-cols-12 gap-3 overflow-hidden">
          <section className="col-span-12 flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-[#EBC28A] bg-[#FFFDF8]/88 shadow-[0_16px_32px_rgba(66,42,24,0.10)] backdrop-blur">
            <div className="flex flex-col gap-3 border-b border-[#EBC28A] bg-[#FFF7EA]/95 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A85F2A]">Produits à paramétrer</p>
                <h3 className="text-xl font-black text-[#2F1D14]">{activeSupplierLabel}</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowOnlyUnlinked(v => !v)}
                  className={`rounded-[16px] border px-4 py-3 text-xs font-black uppercase tracking-[0.12em] shadow-sm transition ${showOnlyUnlinked ? 'border-[#2F1D14] bg-[#2F1D14] text-[#FFF7EA]' : 'border-[#D8AE77] bg-[#FFFDF8] text-[#6A432D] hover:bg-white'}`}
                >
                  {showOnlyUnlinked ? 'Tous les produits' : 'Produits non liés'}
                </button>
                <button
                  onClick={addNewProduct}
                  disabled={!canEdit}
                  className="rounded-[16px] border border-[#D8AE77] bg-[#F7B24A] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#3A2116] shadow-sm transition hover:bg-[#FFC266] disabled:opacity-50"
                >
                  Ajouter produit
                </button>
                <button
                  onClick={deleteSelectedProducts}
                  disabled={!canEdit || selectedProductIds.size === 0}
                  className="rounded-[16px] border border-[#D9A08B] bg-[#FFF1EA] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#8A2F20] shadow-sm transition hover:bg-white disabled:opacity-50"
                >
                  Supprimer produit
                </button>
                <button
                  onClick={() => setSelectedProductIds(
                    selectedVisibleCount === displayedRatioProducts.length
                      ? new Set()
                      : new Set(displayedRatioProducts.map(p => p.id))
                  )}
                  disabled={!canEdit || displayedRatioProducts.length === 0}
                  className="rounded-[16px] border border-[#D8AE77] bg-[#FFFDF8] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#6A432D] shadow-sm transition hover:bg-white disabled:opacity-50"
                >
                  {selectedVisibleCount === displayedRatioProducts.length && displayedRatioProducts.length > 0 ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 lg:p-4">
              {displayedRatioProducts.length === 0 ? (
                <div className="flex min-h-[260px] items-center justify-center rounded-[22px] border border-dashed border-[#D8AE77] bg-[#FFFDF8]/75 p-6 text-center">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A85F2A]">{showOnlyUnlinked ? 'Tout est lié' : 'Aucun produit'}</p>
                    <h4 className="mt-2 text-xl font-black text-[#2F1D14]">{showOnlyUnlinked ? 'Aucun produit non lié pour ce fournisseur.' : 'Ajoute un premier produit pour démarrer.'}</h4>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 items-start gap-3 2xl:grid-cols-2">
                  {displayedRatioProducts.map((p, idx) => (
                    <ProductCard
                      key={p.id}
                      p={p}
                      idx={idx}
                      total={displayedRatioProducts.length}
                      state={state}
                      canEdit={canEdit}
                      displayMonthKey={displayMonthKey}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default RatiosPage;
