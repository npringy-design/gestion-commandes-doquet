// =============================================================
// pages/RatiosPage.tsx
// Page "Intelligence de Vente" - ratios par mois + mapping import
// Desktop only visuel aligned with PrepRatiosPage
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
      <div className="flex items-center gap-2 p-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => toggleProductSelection(p.id)}
          disabled={!canEdit}
          className="w-5 h-5 accent-indigo-600 cursor-pointer shrink-0"
        />
        <input
          className="flex-1 min-w-0 bg-transparent font-black text-slate-900 text-sm uppercase outline-none"
          value={p.name}
          placeholder="NOM PRODUIT..."
          onChange={e => handleNameChange(p.id, e.target.value)}
          disabled={!canEdit}
        />
        <div className="shrink-0 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1 text-center">
          <div className="text-[8px] font-black text-amber-500 uppercase">Ratio</div>
          <div className="font-black text-amber-700 text-sm leading-none">{avgRatio.toFixed(3)}</div>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="shrink-0 w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500"
        >
          <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 p-3 flex flex-col gap-3">
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

          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-400 font-bold uppercase">Ordre : #{idx + 1}</span>
            <div className="flex gap-2">
              <button
                onClick={() => moveProduct(p.id, 'up')}
                disabled={!canEdit || idx === 0}
                className="w-9 h-9 rounded-xl bg-slate-900 text-[#ffd700] flex items-center justify-center disabled:opacity-20"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/></svg>
              </button>
              <button
                onClick={() => moveProduct(p.id, 'down')}
                disabled={!canEdit || idx === total - 1}
                className="w-9 h-9 rounded-xl bg-slate-900 text-[#ffd700] flex items-center justify-center disabled:opacity-20"
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
    products,
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

  const displayedRatioProducts = React.useMemo(() => {
    return products.filter(p => p.supplierId === safeRatioTab);
  }, [products, safeRatioTab]);

  return (
    <div className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#F6EFE6_0%,#F2E8DD_45%,#EBDDCE_100%)] text-[#34271F] pb-24">
      <div className="mx-auto flex h-screen max-w-[1920px] flex-col gap-3 p-3">
        <main className="flex min-h-0 min-w-0 flex-1">
          <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[28px] border border-[#D7B79B] bg-[#FAF5EE] shadow-[0_16px_32px_rgba(145,105,75,0.10)]">
            <div className="border-b border-[#B45439] bg-[linear-gradient(180deg,#A93E2A_0%,#912F20_55%,#782219_100%)] px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FFE1B8]">Hippopotamus Thillois</p>
                  <h2 className="mt-1 text-[30px] font-black leading-none text-[#FFF8F1]">Calcul vente ratio</h2>
                </div>
                <div className="rounded-2xl bg-white/95 px-4 py-3 text-right shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8A5A2F]">Mois de travail</div>
                  <div className="text-base font-black text-[#6C3C2B]">{state.importTargetMonth?.toUpperCase?.() ?? state.importTargetMonth}</div>
                </div>
              </div>
            </div>

            <div className="border-b border-[#E0CCBA] bg-[#FFF9F3] px-4 py-3">
              <div className="flex items-center gap-3">
                <button onClick={() => setView('stats')} className="rounded-[16px] border border-[#D9A72B] bg-[linear-gradient(180deg,#F3C63D_0%,#E3A91F_100%)] px-4 py-3 text-center text-xs font-black uppercase tracking-[0.12em] text-[#4D2B18] shadow-[0_4px_0_#B8810F] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#B8810F]">Retour paramètres</button>
                <button onClick={addNewProduct} disabled={!canEdit} className="rounded-[16px] border border-slate-300 bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-700 shadow-sm disabled:opacity-50">Ajouter un produit</button>
                <button onClick={deleteSelectedProducts} disabled={!canEdit || selectedProductIds.size === 0} className="rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-red-700 shadow-sm disabled:opacity-50">Supprimer la sélection</button>
              </div>
            </div>

            <div className="border-b border-[#E0CCBA] bg-[#FFF9F3] px-4 py-3">
              <div className="rounded-[18px] border border-[#E6D7C8] bg-white/85 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  {supplierTabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setRatioTab(tab.id)}
                      className={`rounded-2xl border px-4 py-2 text-[11px] font-black uppercase tracking-[0.08em] transition ${safeRatioTab === tab.id ? 'border-[#D0B08D] bg-white text-[#6C3C2B] shadow-sm' : 'border-transparent bg-transparent text-slate-400 hover:text-[#6C3C2B]'}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {!canEdit && (
              <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                Lecture seule sur les ratios pour votre rôle.
              </div>
            )}

            <div
              ref={ratiosScrollRef}
              onScroll={() => syncRatiosScroll('main')}
              className="min-h-0 flex-1 overflow-x-auto overflow-y-auto pb-16"
            >
              <table className="min-w-[3400px] w-max text-sm">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-[#F4E4D2] text-[#6C3C2B]">
                    <th className="border-r border-[#E0CCBA] px-3 py-4 text-center font-black uppercase min-w-[64px]" rowSpan={3}>
                      <input
                        type="checkbox"
                        className="h-5 w-5 cursor-pointer accent-indigo-600"
                        checked={displayedRatioProducts.length > 0 && selectedProductIds.size === displayedRatioProducts.length}
                        disabled={!canEdit}
                        onChange={() => setSelectedProductIds(
                          selectedProductIds.size === displayedRatioProducts.length
                            ? new Set()
                            : new Set(displayedRatioProducts.map(p => p.id))
                        )}
                      />
                    </th>
                    <th className="sticky left-0 z-30 border-r border-[#E0CCBA] bg-[#F4E4D2] px-4 py-4 text-left font-black uppercase min-w-[420px]" rowSpan={3}>
                      Produit Hippopotamus
                    </th>
                    <th className="border-r border-[#E0CCBA] px-4 py-4 text-left font-black uppercase min-w-[260px]" rowSpan={3}>Mapping import</th>
                    <th className="border-r border-[#E0CCBA] px-3 py-4 text-center font-black uppercase min-w-[140px]" rowSpan={3}>÷ KG→U</th>
                    <th className="border-b border-[#E0CCBA] bg-[linear-gradient(180deg,#A93E2A_0%,#912F20_55%,#782219_100%)] p-3 text-[12px] font-black uppercase tracking-[0.14em] text-[#FFF8F1]" colSpan={12}>Volumes de ventes</th>
                    <th className="border-b border-[#E0CCBA] bg-[linear-gradient(180deg,#39B37D_0%,#239062_100%)] p-3 text-[12px] font-black uppercase tracking-[0.14em] text-white" colSpan={12}>Analyse ratios</th>
                    <th className="bg-[#E3A91F] p-3 text-xs font-black text-white min-w-[120px]" rowSpan={3}>Moyenne ratios</th>
                  </tr>
                  <tr className="bg-[#6C3C2B] text-[#FFF8F1]">
                    {MONTHS_ORDER.map(m => (
                      <th key={m} className={`border-r border-[#8C5B45] p-2 min-w-[100px] text-[9px] font-black ${validatedMonths[m] ? 'bg-[#8B2D22]' : ''}`}>{m.toUpperCase()}</th>
                    ))}
                    {MONTHS_ORDER.map(m => (
                      <th key={m + 'r'} className="border-r border-[#8C5B45] p-2 min-w-[100px] text-[9px] font-black">{m.toUpperCase()}</th>
                    ))}
                  </tr>
                  <tr className="bg-[#F8EBDD] text-[#6C3C2B]">
                    {MONTHS_ORDER.map(m => (
                      <th key={m + 'b'} className={`border-r border-[#E0CCBA] p-2 ${validatedMonths[m] ? 'bg-[#F3E7D7]' : ''}`}>
                        <button
                          onClick={() => state.toggleValidateMonth(m)}
                          disabled={!canEdit}
                          className={`w-full rounded-xl px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] disabled:opacity-50 disabled:cursor-not-allowed ${validatedMonths[m] ? 'border border-emerald-700 bg-emerald-600 text-white' : 'border border-amber-300 bg-white text-[#8A5A2F]'}`}
                        >
                          {validatedMonths[m] ? 'Figé' : 'Valider'}
                        </button>
                      </th>
                    ))}
                    {MONTHS_ORDER.map(m => (
                      <th key={m + 'ri'} className="border-r border-[#E0CCBA] bg-[#F8EBDD] p-2 text-[8px] italic text-[#8A5A2F]">Auto-Calcul</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedRatioProducts.map((p, idx) => {
                    const { avgRatio, mR, mS } = getProductStats(p);
                    const isMapped = Array.from(state.allAvailableImportNames).includes(p.searchName);
                    const alert = !isMapped && p.searchName.trim().length > 0;

                    return (
                      <tr key={p.id} className={idx % 2 === 0 ? 'bg-[#FCF8F2]' : 'bg-[#F7EFE5]'}>
                        <td className="border-t border-[#E0CCBA] px-3 py-3 text-center align-middle">
                          <input
                            type="checkbox"
                            className="h-5 w-5 cursor-pointer accent-indigo-600"
                            checked={selectedProductIds.has(p.id)}
                            onChange={() => state.toggleProductSelection(p.id)}
                            disabled={!canEdit}
                          />
                        </td>
                        <td className="sticky left-0 z-10 border-t border-r border-[#E0CCBA] bg-inherit p-0 text-[11px] font-black uppercase">
                          <div className="flex items-center gap-2 px-4 py-3 pr-3">
                            <input
                              className="h-full flex-1 bg-transparent font-black text-[#24160F] outline-none"
                              value={p.name}
                              placeholder="Nom produit..."
                              onChange={e => state.handleNameChange(p.id, e.target.value)}
                              disabled={!canEdit}
                            />
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => state.moveProduct(p.id, 'up')}
                                disabled={!canEdit || idx === 0}
                                className="h-8 w-8 rounded-xl bg-slate-900 text-[#ffd700] disabled:opacity-20"
                              >↑</button>
                              <button
                                onClick={() => state.moveProduct(p.id, 'down')}
                                disabled={!canEdit || idx === displayedRatioProducts.length - 1}
                                className="h-8 w-8 rounded-xl bg-slate-900 text-[#ffd700] disabled:opacity-20"
                              >↓</button>
                            </div>
                          </div>
                        </td>
                        <td className={`border-t border-r border-[#E0CCBA] px-4 py-3 ${state.activeMappingId === p.id ? 'relative z-[9999]' : ''}`}>
                          <div className="relative flex items-center gap-2">
                            <input
                              className={`flex-1 bg-transparent text-[11px] font-bold italic outline-none ${alert ? 'text-amber-600' : 'text-[#6C3C2B]'}`}
                              value={p.searchName}
                              onChange={e => state.updateSearchName(p.id, e.target.value)}
                              disabled={!canEdit}
                            />
                            <button
                              onClick={() => canEdit && state.setActiveMappingId(state.activeMappingId === p.id ? null : p.id)}
                              disabled={!canEdit}
                              className={`flex h-7 w-7 items-center justify-center rounded-full ${alert ? 'bg-amber-100 text-amber-600' : 'bg-[#EAECEF] text-slate-500'}`}
                              title="Rechercher un mapping"
                            >
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
                        <td className="border-t border-r border-[#E0CCBA] px-2 py-3 text-center">
                          <input
                            type="number"
                            value={p.importDivisor ?? ''}
                            onChange={e => state.updateImportDivisor(p.id, e.target.value)}
                            disabled={!canEdit}
                            className="h-10 w-24 rounded-xl border border-[#D0B08D] bg-[#FFFDF9] text-center text-[11px] font-black text-[#6C3C2B] outline-none"
                          />
                        </td>
                        {MONTHS_ORDER.map(m => (
                          <td key={m} className={`border-t border-r border-[#E0CCBA] p-2 text-center text-[12px] font-black ${mS[m].isValidated ? 'bg-indigo-50 text-indigo-800' : mS[m].isImported ? 'text-emerald-700' : 'text-slate-400'}`}>
                            {mS[m].value}
                          </td>
                        ))}
                        {MONTHS_ORDER.map(m => (
                          <td key={m + 'rv'} className="border-t border-r border-[#E0CCBA] bg-[#F7EFE5] p-2 text-center font-mono text-[11px] font-bold text-emerald-700">
                            {mR[m].toFixed(4)}
                          </td>
                        ))}
                        <td className="border-t border-[#E0CCBA] bg-[#FFF5E2] p-2 text-center text-sm font-black text-[#B86100]">
                          {avgRatio.toFixed(4)}
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

      <div className="sticky bottom-0 z-30 mx-3 mt-2 rounded-t-[18px] border border-b-0 border-[#D7B79B] bg-[#FFF9F3] px-2 pt-2 shadow-[0_-4px_14px_rgba(145,105,75,0.14)]">
        <div
          ref={ratiosBottomScrollRef}
          onScroll={() => syncRatiosScroll('bottom')}
          className="h-5 overflow-x-auto overflow-y-hidden"
        >
          <div style={{ width: ratiosScrollWidth, height: 1 }} />
        </div>
      </div>
    </div>
  );
};

export default RatiosPage;
