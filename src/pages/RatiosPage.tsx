// =============================================================
// pages/RatiosPage.tsx
// Page "Intelligence de Vente" - ratios par mois + mapping import
// Extraite de App.tsx
// =============================================================

import React from 'react';
import { MONTHS_ORDER, SupplierId } from '../constants';
import MappingPopover from '../components/MappingPopover';
import { useAppState } from '../hooks/useAppState';

type AppState = ReturnType<typeof useAppState>;

interface RatiosPageProps {
  state:               AppState;
  ratiosScrollRef:     React.RefObject<HTMLDivElement>;
  ratiosBottomScrollRef: React.RefObject<HTMLDivElement>;
  ratiosScrollWidth:   number;
  syncRatiosScroll:    (source: 'main' | 'bottom') => void;
}

const SUPPLIER_TABS: { id: SupplierId; label: string }[] = [
  { id: 'doquet',        label: 'Doquet'           },
  { id: 'vins',          label: 'Richard Vins'     },
  { id: 'viandes',       label: 'Plaine Maison'    },
  { id: 'domafrais',     label: 'Domafrais Viandes'},
  { id: 'domafrais_bof', label: 'Domafrais B.O.F'  },
  { id: 'domafrais_surgele', label: 'Domafrais Surgelé' },
];

const RatiosPage: React.FC<RatiosPageProps> = ({
  state,
  ratiosScrollRef,
  ratiosBottomScrollRef,
  ratiosScrollWidth,
  syncRatiosScroll,
}) => {
  const {
    setView,
    ratioTab, setRatioTab,
    products, setProducts,
    selectedProductIds, setSelectedProductIds,
    activeMappingId, setActiveMappingId,
    allAvailableImportNames,
    validatedMonths,
    addNewProduct,
    deleteSelectedProducts,
    toggleProductSelection,
    moveProduct,
    handleNameChange,
    updateSearchName,
    updateImportDivisor,
    toggleValidateMonth,
    getProductStats,
  } = state;

  const displayedRatioProducts = products.filter(p => p.supplierId === ratioTab);

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-4 pb-12 font-sans text-[10px]">
      <div className="max-w-full">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 bg-white p-6 rounded-[30px] shadow-2xl border border-slate-200 min-w-[1200px]">
          <div className="flex gap-4">
            <button
              onClick={() => setView('stats')}
              className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black uppercase text-[11px] hover:bg-black shadow-xl"
            >
              Retour Paramètres
            </button>
            <button
              onClick={addNewProduct}
              className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-[11px] hover:bg-indigo-700 shadow-xl flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/>
              </svg>
              Ajouter Produit
            </button>
            {selectedProductIds.size > 0 && (
              <button
                onClick={deleteSelectedProducts}
                className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-[11px] hover:bg-red-700 shadow-xl flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
                Supprimer ({selectedProductIds.size})
              </button>
            )}
          </div>

          {/* Onglets fournisseurs */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            {SUPPLIER_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setRatioTab(tab.id)}
                className={`px-6 py-2 rounded-xl font-black uppercase text-[11px] transition-all ${ratioTab === tab.id ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-800">
              Intelligence de Vente <span className="text-indigo-600">2026</span>
            </h1>
          </div>
        </div>

        {/* Tableau principal */}
        <div
          ref={ratiosScrollRef}
          onScroll={() => syncRatiosScroll('main')}
          className="bg-white border border-slate-200 rounded-[40px] shadow-2xl overflow-x-auto overflow-y-visible custom-scrollbar"
        >
          <table className="border-collapse min-w-[3400px]">
            <thead>
              {/* Ligne 1 : groupes de colonnes */}
              <tr className="bg-slate-900 text-white">
                <th className="border-r border-slate-700 p-5 text-center w-16 sticky left-0 z-40 bg-slate-900 font-black text-xs" rowSpan={3}>
                  <input
                    type="checkbox"
                    className="w-5 h-5 accent-indigo-500 cursor-pointer"
                    checked={displayedRatioProducts.length > 0 && selectedProductIds.size === displayedRatioProducts.length}
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
                <th className="border-r border-slate-700 p-5 text-left w-64 sticky left-[31.5rem] z-30 bg-slate-900 font-black text-sm shadow-2xl" rowSpan={3}>
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

              {/* Ligne 2 : noms de mois */}
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

              {/* Ligne 3 : boutons Valider */}
              <tr className="bg-slate-700 text-white">
                {MONTHS_ORDER.map(m => (
                  <th key={m + 'b'} className={`border-r border-slate-600 p-2 ${validatedMonths[m] ? 'bg-indigo-800' : ''}`}>
                    <button
                      onClick={() => toggleValidateMonth(m)}
                      className={`w-full py-2 px-3 rounded-lg font-black text-[9px] uppercase ${validatedMonths[m] ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
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
                const isMapped = Array.from(allAvailableImportNames).includes(p.searchName);
                const alert    = !isMapped && p.searchName.trim().length > 0;

                return (
                  <tr
                    key={p.id}
                    className={`hover:bg-slate-50 border-b border-slate-100 h-16 group transition-colors ${selectedProductIds.has(p.id) ? 'bg-indigo-50/30' : ''}`}
                  >
                    {/* Checkbox */}
                    <td className="border-r border-slate-200 text-center sticky left-0 z-20 bg-inherit">
                      <input type="checkbox" className="w-5 h-5 accent-indigo-600 cursor-pointer"
                        checked={selectedProductIds.has(p.id)}
                        onChange={() => toggleProductSelection(p.id)}
                      />
                    </td>

                    {/* Nom du produit */}
                    <td className="border-r border-slate-200 p-0 bg-inherit sticky left-16 z-20 font-black uppercase text-[11px]">
                      <div className="flex items-center w-full h-full pr-4 gap-2">
                        <input
                          className="flex-1 h-full bg-transparent px-4 outline-none focus:bg-white font-black text-slate-900"
                          value={p.name}
                          placeholder="NOM PRODUIT..."
                          onChange={e => handleNameChange(p.id, e.target.value)}
                        />
                        {/* Flèches déplacement */}
                        <div className="flex flex-col items-center justify-center gap-1 opacity-20 group-hover:opacity-100 transition-opacity pr-2">
                          <button
                            onClick={() => moveProduct(p.id, 'up')}
                            disabled={idx === 0}
                            className="text-[#ffd700] hover:text-white disabled:opacity-0 active:scale-110 p-1 bg-slate-900 rounded shadow-md border border-[#ffd700]/20"
                          >
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/>
                            </svg>
                          </button>
                          <button
                            onClick={() => moveProduct(p.id, 'down')}
                            disabled={idx === displayedRatioProducts.length - 1}
                            className="text-[#ffd700] hover:text-white disabled:opacity-0 active:scale-110 p-1 bg-slate-900 rounded shadow-md border border-[#ffd700]/20"
                          >
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Mapping import */}
                    <td className={`border-r border-slate-200 p-0 bg-inherit sticky left-[31.5rem] shadow-2xl ${activeMappingId === p.id ? 'z-[9999]' : 'z-20'}`}>
                      <div className="w-full h-full flex items-center px-4 relative">
                        <input
                          className={`flex-1 h-full bg-transparent outline-none font-bold italic text-[11px] ${alert ? 'text-amber-600' : 'text-slate-500'}`}
                          value={p.searchName}
                          onChange={e => updateSearchName(p.id, e.target.value)}
                        />
                        {alert && (
                          <button
                            onClick={() => setActiveMappingId(activeMappingId === p.id ? null : p.id)}
                            className="w-7 h-7 bg-amber-100 hover:bg-amber-200 rounded-full flex items-center justify-center text-amber-600 ml-2"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"/>
                            </svg>
                          </button>
                        )}
                        {activeMappingId === p.id && (
                          <MappingPopover
                            orphanNames={Array.from(allAvailableImportNames).filter(
                              n => !products.some(pr => pr.searchName === n)
                            )}
                            onSelect={n => { updateSearchName(p.id, n); setActiveMappingId(null); }}
                            onClose={() => setActiveMappingId(null)}
                          />
                        )}
                      </div>
                    </td>

                    {/* Diviseur kg→u */}
                    <td className="border-r border-slate-100 p-0 bg-inherit">
                      <div className="w-full h-full flex items-center justify-center px-2">
                        <input
                          type="number"
                          value={(p.importDivisor ?? '') as string | number}
                          onChange={e => updateImportDivisor(p.id, e.target.value)}
                          className="w-24 h-10 bg-white/70 border border-slate-200 rounded-xl text-center font-black text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-[11px]"
                        />
                      </div>
                    </td>

                    {/* Ventes mensuelles */}
                    {MONTHS_ORDER.map(m => (
                      <td key={m} className={`border-r border-slate-100 p-2 text-center text-[12px] font-black ${mS[m].isValidated ? 'text-indigo-800 bg-indigo-50/50' : mS[m].isImported ? 'text-indigo-600' : 'text-slate-400'}`}>
                        {mS[m].value}
                      </td>
                    ))}

                    {/* Ratios mensuels */}
                    {MONTHS_ORDER.map(m => (
                      <td key={m + 'rv'} className="border-r border-slate-100 p-2 text-center font-mono text-[11px] text-emerald-700 font-bold bg-emerald-50/10">
                        {mR[m].toFixed(4)}
                      </td>
                    ))}

                    {/* Ratio moyen */}
                    <td className="p-2 text-center font-black bg-amber-50 text-amber-700 text-sm shadow-inner">
                      {avgRatio.toFixed(4)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Barre de défilement horizontale fixe en bas d'écran */}
      <div
        ref={ratiosBottomScrollRef}
        onScroll={() => syncRatiosScroll('bottom')}
        className="fixed bottom-2 left-4 right-4 h-5 overflow-x-auto overflow-y-hidden bg-white/85 backdrop-blur border border-slate-200 rounded-full shadow-lg z-[9999]"
      >
        <div style={{ width: ratiosScrollWidth }} />
      </div>
    </div>
  );
};

export default RatiosPage;
