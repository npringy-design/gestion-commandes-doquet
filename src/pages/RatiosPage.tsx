// =============================================================
// pages/RatiosPage.tsx
// Page "Intelligence de Vente" - ratios par mois + mapping import
//
// ✅ Deux rendus complètement séparés :
//   - lg:block  → tableau PC original (inchangé)
//   - lg:hidden → vue cartes mobile/tablette (repensée)
// =============================================================

import React, { useState } from 'react';
import { MONTHS_ORDER, SupplierId } from '../constants';
import { SupplierConfig } from '../types';
import MappingPopover from '../components/MappingPopover';
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

// ─── Composant carte produit (mobile/tablette) ───────────────
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
    validatedMonths, toggleValidateMonth,
    getProductStats,
  } = state;

  const { avgRatio, mR, mS } = getProductStats(p);
  const isMapped = Array.from(allAvailableImportNames).includes(p.searchName);
  const alert    = !isMapped && p.searchName.trim().length > 0;
  const selected = selectedProductIds.has(p.id);

  return (
    <div className={`bg-white rounded-2xl border-2 transition-all ${selected ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-200'}`}>

      {/* ── Ligne principale ── */}
      <div className="flex items-center gap-2 p-3">

        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selected}
          onChange={() => toggleProductSelection(p.id)}
          disabled={!canEdit}
          className="w-5 h-5 accent-indigo-600 cursor-pointer shrink-0"
        />

        {/* Nom produit */}
        <input
          className="flex-1 min-w-0 bg-transparent font-black text-slate-900 text-sm uppercase outline-none"
          value={p.name}
          placeholder="NOM PRODUIT..."
          onChange={e => handleNameChange(p.id, e.target.value)}
          disabled={!canEdit}
        />

        {/* Ratio moyen */}
        <div className="shrink-0 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1 text-center">
          <div className="text-[8px] font-black text-amber-500 uppercase">Ratio</div>
          <div className="font-black text-amber-700 text-sm leading-none">{avgRatio.toFixed(3)}</div>
        </div>

        {/* Bouton déplier */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="shrink-0 w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500"
        >
          <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
      </div>

      {/* ── Détails dépliés ── */}
      {expanded && (
        <div className="border-t border-slate-100 p-3 flex flex-col gap-3">

          {/* Mapping + Diviseur */}
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-black text-slate-400 uppercase mb-1">Mapping Import</div>
              <div className="relative flex items-center gap-1">
                <input
                  className={`flex-1 min-w-0 bg-slate-50 border rounded-xl px-3 py-2 text-xs font-bold italic outline-none ${alert ? 'border-amber-300 text-amber-600' : 'border-slate-200 text-slate-500'}`}
                  value={p.searchName}
                  placeholder="nom dans le CSV..."
                  onChange={e => updateSearchName(p.id, e.target.value)}
                />
                <button
                  onClick={() => setActiveMappingId(activeMappingId === p.id ? null : p.id)}
                  className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${alert ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  title="Rechercher un mapping"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"/>
                  </svg>
                </button>
                {activeMappingId === p.id && (
                  <div className="absolute top-full left-0 z-50 mt-1">
                    <MappingPopover
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
              </div>
            </div>

            <div className="shrink-0 w-20">
              <div className="text-[9px] font-black text-slate-400 uppercase mb-1">÷ KG→U</div>
              <input
                type="number"
                value={p.importDivisor ?? ''}
                onChange={e => updateImportDivisor(p.id, e.target.value)}
                disabled={!canEdit}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-center font-black text-slate-700 outline-none focus:border-indigo-400 text-sm"
              />
            </div>
          </div>

          {/* Grille ventes + ratios par mois */}
          <div>
            <div className="text-[9px] font-black text-slate-400 uppercase mb-1.5">Ventes & Ratios par mois</div>
            <div className="grid grid-cols-6 gap-1">
              {MONTHS_ORDER.map(m => (
                <div key={m} className={`rounded-lg p-1.5 text-center ${mS[m].isValidated ? 'bg-indigo-50 border border-indigo-100' : mS[m].isImported ? 'bg-blue-50' : 'bg-slate-50'}`}>
                  <div className="text-[8px] font-black uppercase text-slate-400 mb-0.5">{MONTH_LABELS[m]}</div>
                  <div className={`font-black text-xs leading-none mb-0.5 ${mS[m].isValidated ? 'text-indigo-800' : mS[m].isImported ? 'text-indigo-600' : 'text-slate-400'}`}>
                    {mS[m].value || '–'}
                  </div>
                  <div className="text-[8px] text-emerald-600 font-mono">{mR[m].toFixed(2)}</div>
                  {/* Bouton figé/valider */}
                  <button
                    onClick={() => toggleValidateMonth(m)}
                    disabled={!canEdit}
                    className={`mt-0.5 w-full text-[7px] font-black rounded py-0.5 uppercase disabled:opacity-50 disabled:cursor-not-allowed ${validatedMonths[m] ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-500'}`}
                  >
                    {validatedMonths[m] ? 'Figé' : 'Val.'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Flèches déplacement */}
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-400 font-bold uppercase">Ordre : #{idx + 1}</span>
            <div className="flex gap-2">
              <button
                onClick={() => moveProduct(p.id, 'up')}
                disabled={!canEdit || idx === 0}

                className="w-9 h-9 rounded-xl bg-slate-900 text-[#ffd700] flex items-center justify-center disabled:opacity-20"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/>
                </svg>
              </button>
              <button
                onClick={() => moveProduct(p.id, 'down')}
                disabled={!canEdit || idx === total - 1}

                className="w-9 h-9 rounded-xl bg-slate-900 text-[#ffd700] flex items-center justify-center disabled:opacity-20"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                </svg>
              </button>
            </div>
          </div>

        </div>
      )}
      </div>
    </div>
  );
};

// ─── Page principale ─────────────────────────────────────────
const RatiosPage: React.FC<RatiosPageProps> = ({
  state,
  ratiosScrollRef,
  ratiosBottomScrollRef,
  ratiosScrollWidth,
  syncRatiosScroll,
}) => {
  const { profile } = useAuth();
  const canEdit = canEditRatios(profile);

  const {
    setView,
    ratioTab, setRatioTab,
    products, setProducts,
    supplierConfigs,
    selectedProductIds, setSelectedProductIds,
    addNewProduct,
    deleteSelectedProducts,
    validatedMonths,
    getProductStats,
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

  const displayedRatioProducts = products.filter(p => p.supplierId === safeRatioTab);

  // ── Header commun (PC + mobile) ──────────────────────────────
  const Header = (
    <div className="mb-4 lg:mb-8 bg-white p-3 lg:p-6 rounded-2xl lg:rounded-[30px] shadow-xl border border-slate-200">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">

        {/* Boutons actions */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setView('stats')}
            className="bg-slate-900 text-white px-3 lg:px-8 py-2.5 lg:py-3 rounded-xl lg:rounded-2xl font-black uppercase text-[10px] lg:text-[11px] hover:bg-black shadow-lg"
          >
            Retour Paramètres
          </button>
          <button
            onClick={addNewProduct}
            disabled={!canEdit}
            className="bg-indigo-600 text-white px-3 lg:px-8 py-2.5 lg:py-3 rounded-xl lg:rounded-2xl font-black uppercase text-[10px] lg:text-[11px] hover:bg-indigo-700 shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/>
            </svg>
            Ajouter
          </button>
          {selectedProductIds.size > 0 && (
            <button
              onClick={deleteSelectedProducts}
              disabled={!canEdit}
              className="bg-red-600 text-white px-3 lg:px-8 py-2.5 lg:py-3 rounded-xl lg:rounded-2xl font-black uppercase text-[10px] lg:text-[11px] hover:bg-red-700 shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
              Supprimer ({selectedProductIds.size})
            </button>
          )}
        </div>

        {/* Onglets fournisseurs */}
        <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          {supplierTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setRatioTab(tab.id)}
              className={`px-3 lg:px-6 py-2 rounded-xl font-black uppercase text-[10px] lg:text-[11px] transition-all whitespace-nowrap ${safeRatioTab === tab.id ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="hidden xl:block text-center">
          <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-800">
            Intelligence de Vente <span className="text-indigo-600">2026</span>
          </h1>
          <div className="mt-1 text-xs text-slate-500">
            Mois de travail (workMonth) : <span className="font-semibold text-slate-700">{state.importTargetMonth?.toUpperCase?.() ?? state.importTargetMonth}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        .hide-ratios-main-scrollbar::-webkit-scrollbar {
          height: 0px;
          display: none;
        }
      `}</style>
      <div className="min-h-screen bg-[#f1f5f9] p-2 lg:p-4 pb-24 lg:pb-12 font-sans text-[10px]">

      {Header}

      {!canEdit && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Lecture seule sur les ratios pour votre rôle.
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          VUE MOBILE / TABLETTE  (< lg = < 1024px)
          Cartes empilées, pas de tableau
      ══════════════════════════════════════════════════════ */}
      <div className="lg:hidden flex flex-col gap-2">

        {/* Sélectionner tout */}
        {displayedRatioProducts.length > 0 && (
          <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 py-2">
            <input
              type="checkbox"
              className="w-5 h-5 accent-indigo-600 cursor-pointer"
              checked={selectedProductIds.size === displayedRatioProducts.length}
              disabled={!canEdit}
              onChange={() => setSelectedProductIds(
                selectedProductIds.size === displayedRatioProducts.length
                  ? new Set()
                  : new Set(displayedRatioProducts.map(p => p.id))
              )}
            />
            <span className="text-[11px] font-black text-slate-500 uppercase">
              Tout sélectionner — {displayedRatioProducts.length} produit{displayedRatioProducts.length > 1 ? 's' : ''}
            </span>
          </div>
        )}

        {displayedRatioProducts.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 font-bold">
            Aucun produit — cliquez sur "Ajouter"
          </div>
        )}

        {displayedRatioProducts.map((p, idx) => (
          <ProductCard
            key={p.id}
            p={p}
            idx={idx}
            total={displayedRatioProducts.length}
            state={state}
          />
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          VUE PC  (>= lg = >= 1024px)
          Tableau original inchangé
      ══════════════════════════════════════════════════════ */}
      <div className="hidden lg:block relative">
        <div
          ref={ratiosScrollRef}
          onScroll={() => syncRatiosScroll('main')}
          className="bg-white border border-slate-200 rounded-[40px] shadow-2xl overflow-x-auto overflow-y-visible pb-4 hide-ratios-main-scrollbar"
          style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
        >
          <table className="border-collapse min-w-[3400px]">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="border-r border-slate-700 p-5 text-center w-16 sticky left-0 z-40 bg-slate-900 font-black text-xs" rowSpan={3}>
                  <input
                    type="checkbox"
                    className="w-5 h-5 accent-indigo-500 cursor-pointer"
                    checked={displayedRatioProducts.length > 0 && selectedProductIds.size === displayedRatioProducts.length}
                    disabled={!canEdit}
                    onChange={() => setSelectedProductIds(
                      selectedProductIds.size === displayedRatioProducts.length
                        ? new Set()
                        : new Set(displayedRatioProducts.map(p => p.id))
                    )}
                  />
                </th>
                <th className="border-r border-slate-700 p-5 text-left w-[420px] sticky left-16 z-30 bg-slate-900 font-black text-sm" rowSpan={3}>
                  Produit Hippopotamus
                </th>
                <th className="border-r border-slate-700 p-5 text-left w-64 sticky left-[calc(4rem+420px)] z-30 bg-slate-900 font-black text-sm" rowSpan={3}>
                  Mapping Import
                </th>
                <th className="border-r border-slate-700 p-5 text-center w-40 bg-slate-900 font-black text-sm" rowSpan={3}>
                  ÷ KG→U
                </th>
                <th className="border-b border-slate-700 p-3 bg-blue-600 text-white font-black uppercase tracking-widest text-[12px]" colSpan={12}>
                  Volumes de Ventes
                </th>
                <th className="border-b border-slate-700 p-3 bg-emerald-600 text-white font-black uppercase tracking-widest text-[12px]" colSpan={12}>
                  Analyse Ratios
                </th>
                <th className="p-3 bg-amber-500 font-black text-xs text-white" rowSpan={3}>
                  Moyenne Ratios
                </th>
              </tr>
              <tr className="bg-slate-800 text-white">
                {MONTHS_ORDER.map(m => (
                  <th key={m} className={`border-r border-slate-700 p-2 min-w-[100px] text-[9px] font-black ${validatedMonths[m] ? 'bg-indigo-900' : ''}`}>
                    {m.toUpperCase()}
                  </th>
                ))}
                {MONTHS_ORDER.map(m => (
                  <th key={m + 'r'} className="border-r border-slate-700 p-2 min-w-[100px] text-[9px] font-black">
                    {m.toUpperCase()}
                  </th>
                ))}
              </tr>
              <tr className="bg-slate-700 text-white">
                {MONTHS_ORDER.map(m => (
                  <th key={m + 'b'} className={`border-r border-slate-600 p-2 ${validatedMonths[m] ? 'bg-indigo-800' : ''}`}>
                    <button
                      onClick={() => state.toggleValidateMonth(m)}
                    disabled={!canEdit}
                      className={`w-full py-2 px-3 rounded-lg font-black text-[9px] uppercase disabled:opacity-50 disabled:cursor-not-allowed ${validatedMonths[m] ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                    >
                      {validatedMonths[m] ? 'Figé' : 'Valider'}
                    </button>
                  </th>
                ))}
                {MONTHS_ORDER.map(m => (
                  <th key={m + 'ri'} className="border-r border-slate-600 p-2 bg-emerald-900/20 text-[8px] italic">
                    Auto-Calcul
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {displayedRatioProducts.map((p, idx) => {
                const { avgRatio, mR, mS } = getProductStats(p);
                const isMapped = Array.from(state.allAvailableImportNames).includes(p.searchName);
                const alert    = !isMapped && p.searchName.trim().length > 0;

                return (
                  <tr
                    key={p.id}
                    className={`hover:bg-slate-50 border-b border-slate-100 h-16 group transition-colors ${selectedProductIds.has(p.id) ? 'bg-indigo-50/30' : ''}`}
                  >
                    <td className={`border-r border-slate-200 text-center sticky left-0 z-20 ${selectedProductIds.has(p.id) ? 'bg-indigo-50' : 'bg-white'}`}>
                      <input type="checkbox" className="w-5 h-5 accent-indigo-600 cursor-pointer"
                        checked={selectedProductIds.has(p.id)}
                        onChange={() => state.toggleProductSelection(p.id)}
                        disabled={!canEdit}
                      />
                    </td>

                    <td className={`border-r border-slate-200 p-0 sticky left-16 z-20 font-black uppercase text-[11px] ${selectedProductIds.has(p.id) ? 'bg-indigo-50' : 'bg-white'}`}>
                      <div className="flex items-center w-full h-full pr-4 gap-2">
                        <input
                          className="flex-1 h-full bg-transparent px-4 outline-none focus:bg-white font-black text-slate-900"
                          value={p.name}
                          placeholder="NOM PRODUIT..."
                          onChange={e => state.handleNameChange(p.id, e.target.value)}
                          disabled={!canEdit}
                        />
                        <div className="flex flex-col items-center justify-center gap-1 opacity-20 group-hover:opacity-100 transition-opacity pr-2">
                          <button onClick={() => state.moveProduct(p.id, 'up')} disabled={!canEdit || idx === 0}
                            className="text-[#ffd700] hover:text-white disabled:opacity-0 active:scale-110 p-1 bg-slate-900 rounded shadow-md border border-[#ffd700]/20">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/></svg>
                          </button>
                          <button onClick={() => state.moveProduct(p.id, 'down')} disabled={!canEdit || idx === displayedRatioProducts.length - 1}
                            className="text-[#ffd700] hover:text-white disabled:opacity-0 active:scale-110 p-1 bg-slate-900 rounded shadow-md border border-[#ffd700]/20">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                          </button>
                        </div>
                      </div>
                    </td>

                    <td className={`border-r border-slate-200 p-0 sticky left-[calc(4rem+420px)] ${state.activeMappingId === p.id ? 'z-[9999]' : 'z-20'} ${selectedProductIds.has(p.id) ? 'bg-indigo-50' : 'bg-white'}`}>
                      <div className="w-full h-full flex items-center px-4 relative">
                        <input
                          className={`flex-1 h-full bg-transparent outline-none font-bold italic text-[11px] ${alert ? 'text-amber-600' : 'text-slate-500'}`}
                          value={p.searchName}
                          onChange={e => state.updateSearchName(p.id, e.target.value)}
                          disabled={!canEdit}
                        />
                        <button onClick={() => canEdit && state.setActiveMappingId(state.activeMappingId === p.id ? null : p.id)} disabled={!canEdit}
                          className={`w-7 h-7 rounded-full flex items-center justify-center ml-2 ${alert ? 'bg-amber-100 hover:bg-amber-200 text-amber-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}
                          title="Rechercher un mapping">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"/></svg>
                        </button>
                        {state.activeMappingId === p.id && (
                          <MappingPopover
                            orphanNames={Array.from(state.allAvailableImportNames).filter((name) => {
                              const normalizedName = String(name).trim().toLowerCase();
                              return !state.products.some((pr) => (
                                pr.id !== p.id &&
                                pr.supplierId === p.supplierId &&
                                pr.searchName.trim().toLowerCase() === normalizedName
                              ));
                            })}
                            onSelect={n => { if (!canEdit) return; state.updateSearchName(p.id, n); state.setActiveMappingId(null); }}
                            onClose={() => state.setActiveMappingId(null)}
                          />
                        )}
                      </div>
                    </td>

                    <td className="border-r border-slate-100 p-0 bg-inherit">
                      <div className="w-full h-full flex items-center justify-center px-2">
                        <input type="number" value={p.importDivisor ?? ''}
                          onChange={e => state.updateImportDivisor(p.id, e.target.value)}
                          disabled={!canEdit}
                          className="w-24 h-10 bg-white/70 border border-slate-200 rounded-xl text-center font-black text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-[11px]"
                        />
                      </div>
                    </td>

                    {MONTHS_ORDER.map(m => (
                      <td key={m} className={`border-r border-slate-100 p-2 text-center text-[12px] font-black ${mS[m].isValidated ? 'text-indigo-800 bg-indigo-50/50' : mS[m].isImported ? 'text-indigo-600' : 'text-slate-400'}`}>
                        {mS[m].value}
                      </td>
                    ))}

                    {MONTHS_ORDER.map(m => (
                      <td key={m + 'rv'} className="border-r border-slate-100 p-2 text-center font-mono text-[11px] text-emerald-700 font-bold bg-emerald-50/10">
                        {mR[m].toFixed(4)}
                      </td>
                    ))}

                    <td className="p-2 text-center font-black bg-amber-50 text-amber-700 text-sm shadow-inner">
                      {avgRatio.toFixed(4)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Barre scroll bas — PC uniquement */}
        <div
          ref={ratiosBottomScrollRef}
          onScroll={() => syncRatiosScroll('bottom')}
          className="fixed bottom-0 left-0 right-0 h-5 overflow-x-auto overflow-y-hidden bg-[#efe6de] border-t border-[#d9c3b4] z-[9999] custom-scrollbar"
        >
          <div style={{ width: ratiosScrollWidth, height: 1 }} />
        </div>
      </div>

    </div>
  );
};

export default RatiosPage;
