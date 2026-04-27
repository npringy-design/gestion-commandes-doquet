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
import { useAppState } from '../hooks/useAppState';
import { useAuth } from '../auth/AuthProvider';
import { canEditRatios } from '../lib/permissions';

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

const ProductCard: React.FC<{
  p: any;
  idx: number;
  total: number;
  state: AppState;
  canEdit: boolean;
}> = ({ p, idx, total, state, canEdit }) => {
  const [expanded, setExpanded] = useState(false);
  const {
    selectedProductIds, toggleProductSelection,
    moveProduct, handleNameChange,
    updateSearchName, updateImportDivisor,
    activeMappingId, setActiveMappingId,
    allAvailableImportNames, products,
    validatedMonths, ratioValidatedMonths, toggleValidateMonth,
    getProductStats,
  } = state;

  const monthFreezeMap = ratioValidatedMonths ?? validatedMonths;
  const { avgRatio, mR, mS } = getProductStats(p);
  const isMapped = Array.from(allAvailableImportNames).includes(p.searchName);
  const alert    = !isMapped && p.searchName.trim().length > 0;
  const selected = selectedProductIds.has(p.id);

  return (
    <div className={`relative rounded-[22px] border-l-[6px] border-y border-r transition-all shadow-[0_10px_22px_rgba(66,42,24,0.07)] ${selected ? 'border-l-[#B85B2B] border-y-[#D8AE77] border-r-[#D8AE77] bg-[#FFF4E4]' : alert ? 'border-l-[#D4922F] border-y-[#D8CAB8] border-r-[#D8CAB8] bg-[#FFFCF6]' : 'border-l-[#6D8F4E] border-y-[#D8CAB8] border-r-[#D8CAB8] bg-[#FFFCF6]'}`}>
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
          value={p.searchName}
          placeholder="Nom produit dans l'import..."
          onChange={e => updateSearchName(p.id, e.target.value)}
          disabled={!canEdit}
        />
        <button
          onClick={() => setActiveMappingId(activeMappingId === p.id ? null : p.id)}
          disabled={!canEdit}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${alert ? 'bg-amber-100 text-amber-700' : 'bg-[#F3DDC0] text-[#6A432D] hover:bg-[#FFE8C2]'} disabled:opacity-50`}
          title="Rechercher un mapping"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"/>
          </svg>
        </button>
        {activeMappingId === p.id && (
          <div className="absolute z-50 mt-12 ml-8">
            <RatiosMappingPopover
              orphanNames={Array.from(allAvailableImportNames).filter((name) => {
                const normalizedName = String(name).trim().toLowerCase();
                return !products.some((pr) => (
                  pr.id !== p.id &&
                  pr.supplierId === p.supplierId &&
                  pr.searchName.trim().toLowerCase() === normalizedName
                ));
              })}
              onSelect={n => { if (!canEdit) return; updateSearchName(p.id, n); setActiveMappingId(null); }}
              onClose={() => setActiveMappingId(null)}
            />
          </div>
        )}
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
                  value={p.name}
                  placeholder="Nom visible dans les commandes..."
                  onChange={e => handleNameChange(p.id, e.target.value)}
                  disabled={!canEdit}
                />
              </div>
            </div>

            <div className="shrink-0 w-20">
              <div className="mb-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#A85F2A]">÷ KG→U</div>
              <input
                type="number"
                value={p.importDivisor ?? ''}
                onChange={e => updateImportDivisor(p.id, e.target.value)}
                disabled={!canEdit}
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
                    {mS[m].value || '–'}
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

  const isLinkedProduct = React.useCallback(
    (p: any) => p.searchName.trim().length > 0 && availableImportNames.includes(p.searchName),
    [availableImportNames]
  );

  const displayedRatioProducts = React.useMemo(() => {
    if (!showOnlyUnlinked) return supplierRatioProducts;
    return supplierRatioProducts.filter(p => !isLinkedProduct(p));
  }, [supplierRatioProducts, showOnlyUnlinked, isLinkedProduct]);

  const mappedProductsCount = supplierRatioProducts.filter(isLinkedProduct).length;
  const alertProductsCount = supplierRatioProducts.length - mappedProductsCount;
  const selectedVisibleCount = displayedRatioProducts.filter(p => selectedProductIds.has(p.id)).length;
  const activeSupplierLabel = supplierTabs.find(tab => tab.id === safeRatioTab)?.label ?? 'Fournisseur';
  const workMonthKey = String(state.importTargetMonth);
  const monthFreezeMap = ratioValidatedMonths ?? validatedMonths;
  const isWorkMonthValidated = !!monthFreezeMap[workMonthKey];
  const [freezeMonthKey, setFreezeMonthKey] = React.useState<string>(workMonthKey);

  React.useEffect(() => {
    if (!MONTHS_ORDER.includes(freezeMonthKey)) setFreezeMonthKey(workMonthKey);
  }, [freezeMonthKey, workMonthKey]);

  const isSelectedFreezeMonthValidated = !!monthFreezeMap[freezeMonthKey];

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_12%_0%,rgba(184,91,43,0.18),transparent_30%),radial-gradient(circle_at_88%_8%,rgba(109,143,78,0.12),transparent_28%),linear-gradient(180deg,#F8F1E7_0%,#EFE1D0_52%,#D7AA78_100%)] text-[#2F1D14]">
      <div className="mx-auto flex min-h-[100dvh] max-w-[1760px] flex-col gap-3 p-3 lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden lg:p-4">
        <header className="flex-none overflow-hidden rounded-[28px] border border-[#D6B58C] bg-[#FFFBF4]/94 shadow-[0_18px_36px_rgba(66,42,24,0.12)] backdrop-blur">
          <div className="h-2 bg-[linear-gradient(90deg,#2F1D14_0%,#7B3A1E_45%,#D4922F_100%)]" />
          <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between lg:p-5">
            <div className="flex min-w-0 items-center gap-3">
              <AppNavTile onClick={() => setView('stats')} eyebrow="Retour" icon="settings" size="sm" tone="cream">Paramètres</AppNavTile>
              <div className="hidden h-12 w-px bg-[#D8CAB8] sm:block" />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#A85F2A]">Hippopotamus Thillois</p>
                <h2 className="mt-1 truncate text-2xl font-black leading-none text-[#2F1D14] sm:text-[30px]">Calcul vente ratio</h2>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:min-w-[700px]">
              <div className="rounded-2xl border border-[#D8CAB8] bg-[#F8F0E6] px-3 py-2.5 shadow-sm">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#A85F2A]">Mois</p>
                <p className="mt-1 truncate text-sm font-black text-[#3A2116]">{state.importTargetMonth?.toUpperCase?.() ?? state.importTargetMonth}</p>
              </div>
              <div className="rounded-2xl border border-[#D8CAB8] bg-[#F8F0E6] px-3 py-2.5 shadow-sm">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#A85F2A]">OK</p>
                <p className="mt-1 text-sm font-black text-[#2F7A42]">{mappedProductsCount}</p>
              </div>
              <div className="rounded-2xl border border-[#D8CAB8] bg-[#F8F0E6] px-3 py-2.5 shadow-sm">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#A85F2A]">À revoir</p>
                <p className="mt-1 text-sm font-black text-[#B5412D]">{alertProductsCount}</p>
              </div>
              <button
                onClick={() => state.toggleValidateMonth(workMonthKey)}
                disabled={!canEdit}
                className={`rounded-2xl border px-3 py-2.5 text-left shadow-sm transition disabled:opacity-50 ${isWorkMonthValidated ? 'border-[#6D8F4E] bg-[#F1F5E9]' : 'border-[#D4922F] bg-[#FFF1DF] hover:bg-[#FFE8C2]'}`}
              >
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#A85F2A]">{isWorkMonthValidated ? 'Mois figé' : 'Fin de mois'}</p>
                <p className="mt-1 text-sm font-black text-[#3A2116]">{isWorkMonthValidated ? 'Défiger' : 'Figer le mois'}</p>
              </button>
              <div className="rounded-2xl border border-[#D8CAB8] bg-[#F8F0E6] px-3 py-2.5 shadow-sm">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#A85F2A]">Correction mois</p>
                <div className="mt-1 flex items-center gap-2">
                  <select
                    value={freezeMonthKey}
                    onChange={(e) => setFreezeMonthKey(e.target.value)}
                    disabled={!canEdit}
                    className="min-w-0 flex-1 rounded-xl border border-[#D8CAB8] bg-[#FFFDF8] px-2 py-1 text-xs font-black text-[#3A2116] outline-none disabled:opacity-50"
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
        </header>

        {!canEdit && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Lecture seule sur les ratios pour votre rôle.
          </div>
        )}

        <nav className="flex-none rounded-[24px] border border-[#D8CAB8] bg-[#FFFBF4]/92 p-3 shadow-[0_10px_22px_rgba(66,42,24,0.08)] backdrop-blur">
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
          <section className="col-span-12 flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-[#D8CAB8] bg-[#FFFBF4]/88 shadow-[0_16px_32px_rgba(66,42,24,0.10)] backdrop-blur">
            <div className="flex flex-col gap-3 border-b border-[#D8CAB8] bg-[#F8F0E6]/95 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A85F2A]">Produits à paramétrer</p>
                <h3 className="text-xl font-black text-[#2F1D14]">{activeSupplierLabel}</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                  onClick={() => setShowOnlyUnlinked(v => !v)}
                  className={`rounded-[16px] border px-4 py-3 text-xs font-black uppercase tracking-[0.12em] shadow-sm transition ${showOnlyUnlinked ? 'border-[#2F1D14] bg-[#2F1D14] text-[#FFF7EA]' : 'border-[#D8AE77] bg-[#FFFDF8] text-[#6A432D] hover:bg-white'}`}
                >
                  {showOnlyUnlinked ? 'Tous les produits' : 'Produits non liés'}
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
