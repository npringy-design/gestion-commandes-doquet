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
    <>
      <style>{`
        .hide-ratios-main-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .hide-ratios-main-scrollbar::-webkit-scrollbar {
          height: 0px;
          width: 0px;
          display: none;
        }
      `}</style>

      <div className="min-h-screen bg-[#efe3d6] p-3 lg:p-4 pb-20 font-sans text-[10px] text-[#6d3b1f]">
        <div className="grid grid-cols-[250px_minmax(0,1fr)] gap-4 items-start">
          <aside className="rounded-[28px] bg-[#f7efe5] border border-[#d7b79b] shadow-[0_14px_30px_rgba(92,46,14,0.08)] p-3">
            <div className="rounded-[24px] bg-gradient-to-b from-[#b7442a] to-[#8f261b] px-4 py-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_0_rgba(90,32,16,0.65)]">
              <div className="text-[11px] font-black uppercase tracking-[0.22em] opacity-90">Hippopotamus Thillois</div>
              <div className="mt-2 text-[24px] leading-[0.95] font-black">Calcul<br />vente ratio</div>
            </div>

            <div className="mt-4 space-y-3">
              <button
                onClick={() => setView('stats')}
                className="w-full rounded-[20px] border border-[#c8d2e0] bg-white px-4 py-4 text-center font-black uppercase tracking-[0.12em] text-[#15335f] shadow-[0_2px_0_rgba(170,184,202,0.9)]"
              >
                Retour paramètres
              </button>

              <button
                onClick={addNewProduct}
                disabled={!canEdit}
                className="w-full rounded-[20px] border border-[#5a57ef] bg-gradient-to-b from-[#5c5bff] to-[#4b46df] px-4 py-4 text-center font-black uppercase tracking-[0.12em] text-white shadow-[0_3px_0_rgba(55,51,160,0.85)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Ajouter
              </button>

              {selectedProductIds.size > 0 && (
                <button
                  onClick={deleteSelectedProducts}
                  disabled={!canEdit}
                  className="w-full rounded-[20px] border border-[#f0cbc3] bg-[#f8ece8] px-4 py-4 text-center font-black uppercase tracking-[0.12em] text-[#d38b80] shadow-[0_2px_0_rgba(233,209,201,0.9)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Supprimer la sélection
                </button>
              )}
            </div>
          </aside>

          <section className="min-w-0">
            <div className="rounded-[28px] bg-[#f7efe5] border border-[#d7b79b] shadow-[0_14px_30px_rgba(92,46,14,0.08)] overflow-hidden">
              <div className="flex items-center justify-between gap-4 px-5 py-4 bg-gradient-to-b from-[#b7442a] to-[#8f261b] text-white">
                <h1 className="text-[18px] font-black uppercase tracking-[0.06em]">Produits & ratios</h1>
                <div className="text-right">
                  <div className="text-[12px] font-black uppercase tracking-[0.08em] opacity-95">Intelligence de Vente 2026</div>
                  <div className="mt-1 text-[11px] opacity-90">
                    Mois de travail : <span className="font-black">{state.importTargetMonth?.toUpperCase?.() ?? state.importTargetMonth}</span>
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 border-b border-[#d7b79b] bg-[#f4e7da]">
                <div className="flex flex-wrap gap-2">
                  {supplierTabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setRatioTab(tab.id)}
                      className={`rounded-[14px] px-4 py-2 text-[11px] font-black uppercase tracking-[0.06em] transition-all ${
                        safeRatioTab === tab.id
                          ? 'bg-white text-[#6d3b1f] border border-[#d7b79b] shadow-[0_2px_0_rgba(182,138,108,0.65)]'
                          : 'bg-transparent text-[#9f7a60] border border-transparent hover:bg-white/70 hover:border-[#e3c9b3]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {!canEdit && (
                <div className="mx-5 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                  Lecture seule sur les ratios pour votre rôle.
                </div>
              )}

              <div className="hidden lg:block relative">
                <div
                  ref={ratiosScrollRef}
                  onScroll={() => syncRatiosScroll('main')}
                  className="hide-ratios-main-scrollbar overflow-x-auto overflow-y-auto"
                >
                  <table className="min-w-[3300px] border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-[#efe1d2] text-[#7a4b2a]">
                        <th className="w-16 border-b border-r border-[#d7b79b] px-3 py-4 text-center font-black uppercase tracking-[0.08em]" rowSpan={3}>
                          <input
                            type="checkbox"
                            className="h-5 w-5 rounded accent-[#b7442a] cursor-pointer"
                            checked={displayedRatioProducts.length > 0 && selectedProductIds.size === displayedRatioProducts.length}
                            disabled={!canEdit}
                            onChange={() => setSelectedProductIds(
                              selectedProductIds.size === displayedRatioProducts.length
                                ? new Set()
                                : new Set(displayedRatioProducts.map(p => p.id))
                            )}
                          />
                        </th>

                        <th className="sticky left-0 z-20 w-[420px] border-b border-r border-[#d7b79b] bg-[#efe1d2] px-4 py-4 text-left font-black uppercase tracking-[0.08em]" rowSpan={3}>
                          Produit Hippopotamus
                        </th>

                        <th className="w-[260px] border-b border-r border-[#d7b79b] bg-[#efe1d2] px-4 py-4 text-left font-black uppercase tracking-[0.08em]" rowSpan={3}>
                          Mapping Import
                        </th>

                        <th className="w-[160px] border-b border-r border-[#d7b79b] bg-[#efe1d2] px-4 py-4 text-center font-black uppercase tracking-[0.08em]" rowSpan={3}>
                          ÷ KG→U
                        </th>

                        <th className="border-b border-r border-[#d7b79b] bg-[#b7442a] px-3 py-4 text-center font-black uppercase tracking-[0.12em] text-white" colSpan={12}>
                          Volumes de ventes
                        </th>

                        <th className="border-b border-r border-[#d7b79b] bg-[#b98a2a] px-3 py-4 text-center font-black uppercase tracking-[0.12em] text-white" colSpan={12}>
                          Analyse ratios
                        </th>

                        <th className="w-[110px] border-b border-[#d7b79b] bg-[#d88910] px-3 py-4 text-center font-black text-white" rowSpan={3}>
                          Moyenne<br />Ratios
                        </th>
                      </tr>

                      <tr className="bg-[#f4e7da] text-[#7a4b2a]">
                        {MONTHS_ORDER.map(m => (
                          <th key={m} className="min-w-[100px] border-b border-r border-[#d7b79b] px-2 py-3 text-center text-[10px] font-black uppercase">
                            {MONTH_LABELS[m] ?? m.toUpperCase()}
                          </th>
                        ))}
                        {MONTHS_ORDER.map(m => (
                          <th key={m + 'r'} className="min-w-[100px] border-b border-r border-[#d7b79b] px-2 py-3 text-center text-[10px] font-black uppercase">
                            {MONTH_LABELS[m] ?? m.toUpperCase()}
                          </th>
                        ))}
                      </tr>

                      <tr className="bg-[#f8efe6]">
                        {MONTHS_ORDER.map(m => (
                          <th key={m + 'b'} className="border-b border-r border-[#d7b79b] px-2 py-3 text-center">
                            <button
                              onClick={() => state.toggleValidateMonth(m)}
                              disabled={!canEdit}
                              className={`rounded-[14px] px-4 py-2 text-[10px] font-black uppercase tracking-[0.06em] disabled:opacity-50 disabled:cursor-not-allowed ${
                                validatedMonths[m]
                                  ? 'border border-[#be8f2f] bg-[#d9a63b] text-white shadow-[0_2px_0_rgba(138,94,17,0.65)]'
                                  : 'border border-[#d7b79b] bg-white text-[#8d6a50] shadow-[0_2px_0_rgba(205,181,160,0.8)]'
                              }`}
                            >
                              {validatedMonths[m] ? 'Figé' : 'Valider'}
                            </button>
                          </th>
                        ))}
                        {MONTHS_ORDER.map(m => (
                          <th key={m + 'ri'} className="border-b border-r border-[#d7b79b] px-2 py-3 text-center text-[9px] font-black uppercase text-[#ad8a68]">
                            Auto-calcul
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {displayedRatioProducts.map((p, idx) => {
                        const { avgRatio, mR, mS } = getProductStats(p);
                        const isMapped = Array.from(state.allAvailableImportNames).includes(p.searchName);
                        const alert = !isMapped && p.searchName.trim().length > 0;
                        const selected = selectedProductIds.has(p.id);

                        return (
                          <tr key={p.id} className={`${selected ? 'bg-[#f7efe7]' : 'bg-[#fbf5ee]'} hover:bg-[#f5ede3]`}>
                            <td className="border-b border-r border-[#ead7c5] px-3 py-4 text-center">
                              <input
                                type="checkbox"
                                className="h-5 w-5 rounded accent-[#b7442a] cursor-pointer"
                                checked={selected}
                                onChange={() => state.toggleProductSelection(p.id)}
                                disabled={!canEdit}
                              />
                            </td>

                            <td className={`sticky left-0 z-10 border-b border-r border-[#ead7c5] px-4 py-3 ${selected ? 'bg-[#f7efe7]' : 'bg-[#fbf5ee]'} font-black uppercase text-[12px] text-[#2f2418]`}>
                              <div className="flex items-center gap-2">
                                <input
                                  className="min-w-0 flex-1 bg-transparent outline-none font-black text-[#2f2418]"
                                  value={p.name}
                                  placeholder="Nom produit..."
                                  onChange={e => state.handleNameChange(p.id, e.target.value)}
                                  disabled={!canEdit}
                                />
                                <div className="flex flex-col gap-1">
                                  <button
                                    onClick={() => state.moveProduct(p.id, 'up')}
                                    disabled={!canEdit || idx === 0}
                                    className="h-8 w-8 rounded-md bg-[#2b1d13] text-[#ffd25a] disabled:opacity-25"
                                  >
                                    ▲
                                  </button>
                                  <button
                                    onClick={() => state.moveProduct(p.id, 'down')}
                                    disabled={!canEdit || idx === displayedRatioProducts.length - 1}
                                    className="h-8 w-8 rounded-md bg-[#2b1d13] text-[#ffd25a] disabled:opacity-25"
                                  >
                                    ▼
                                  </button>
                                </div>
                              </div>
                            </td>

                            <td className="border-b border-r border-[#ead7c5] px-4 py-3">
                              <div className="relative flex items-center gap-2">
                                <input
                                  className={`min-w-0 flex-1 bg-transparent outline-none font-bold italic text-[12px] ${alert ? 'text-[#c66a00]' : 'text-[#7b5d45]'}`}
                                  value={p.searchName}
                                  onChange={e => state.updateSearchName(p.id, e.target.value)}
                                  disabled={!canEdit}
                                />
                                <button
                                  onClick={() => canEdit && state.setActiveMappingId(state.activeMappingId === p.id ? null : p.id)}
                                  disabled={!canEdit}
                                  className={`h-8 w-8 rounded-full ${alert ? 'bg-[#f3d68f] text-[#9f5b00]' : 'bg-[#eef2f8] text-[#697b95]'}`}
                                  title="Rechercher un mapping"
                                >
                                  ●
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

                            <td className="border-b border-r border-[#ead7c5] px-3 py-3 text-center">
                              <input
                                type="number"
                                value={p.importDivisor ?? ''}
                                onChange={e => state.updateImportDivisor(p.id, e.target.value)}
                                disabled={!canEdit}
                                className="h-11 w-24 rounded-[14px] border border-[#d7b79b] bg-white text-center font-black text-[#6d3b1f] outline-none"
                              />
                            </td>

                            {MONTHS_ORDER.map(m => (
                              <td key={m} className={`border-b border-r border-[#ead7c5] px-2 py-3 text-center text-[12px] font-black ${mS[m].isValidated ? 'bg-[#ecf4ef] text-[#0b8b63]' : mS[m].isImported ? 'text-[#0b8b63]' : 'text-[#97a3b6]'}`}>
                                {mS[m].value}
                              </td>
                            ))}

                            {MONTHS_ORDER.map(m => (
                              <td key={m + 'rv'} className="border-b border-r border-[#ead7c5] px-2 py-3 text-center font-mono text-[11px] font-bold text-[#0b8b63]">
                                {mR[m].toFixed(4)}
                              </td>
                            ))}

                            <td className="border-b border-[#ead7c5] bg-[#f7f0df] px-2 py-3 text-center font-black text-[13px] text-[#b35f00]">
                              {avgRatio.toFixed(4)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div
                  ref={ratiosBottomScrollRef}
                  onScroll={() => syncRatiosScroll('bottom')}
                  className="fixed bottom-0 left-0 right-0 z-[9999] h-5 overflow-x-auto overflow-y-hidden border-t border-[#d7b79b] bg-[#efe3d6]"
                >
                  <div style={{ width: ratiosScrollWidth, height: 1 }} />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default RatiosPage;
