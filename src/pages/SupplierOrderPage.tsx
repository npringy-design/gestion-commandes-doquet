// =============================================================
// pages/SupplierOrderPage.tsx
// Page de commande pour un fournisseur (tableau principal)
// Extraite de App.tsx — gère les 2 modes : Marge et Cible
// =============================================================

import React from 'react';
import { View, SUPPLIER_LABELS, SupplierId } from '../constants';
import { getDeliveryDates, getForecastForWindow } from '../utils/dateHelpers';
import { calculateOrder, calculateTargetOrder, capitalizeFirstLetter } from '../utils/calculations';
import { ResetConfirmModal } from '../components/Modals';
import WindowsCalendar from '../components/WindowsCalendar';
import { useAppState } from '../hooks/useAppState';

// Le composant reçoit tout l'état via une prop `state` (retour de useAppState)
type AppState = ReturnType<typeof useAppState>;

interface SupplierOrderPageProps {
  state: AppState;
}

// Icônes SVG par fournisseur
const SupplierIcon: React.FC<{ view: string }> = ({ view }) => {
  if (view === 'doquet')
    return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>;
  if (view === 'vins')
    return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>;
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
    </svg>
  );
};

const SupplierOrderPage: React.FC<SupplierOrderPageProps> = ({ state }) => {
  const {
    view, setView,
    calculationMode, setCalculationMode,
    showResetConfirm, setShowResetConfirm,
    activeCalendarSupplier, setActiveCalendarSupplier,
    calendarAnchorRectBySupplier, setCalendarAnchorRectBySupplier,
    deliveryDateBySupplier, setDeliveryDateBySupplier,
    orderStates, setOrderStates,
    supplierConfigs,
    products,
    dailyCovers,
    performReset,
    updateProductValue,
    getProductStats,
  } = state;

  const [activeNextCalendar, setActiveNextCalendar] = React.useState(false);

  React.useEffect(() => {
    if (calculationMode === 'target') setActiveNextCalendar(false);
  }, [calculationMode]);
  const [nextDeliveryDateBySupplierLocal, setNextDeliveryDateBySupplierLocal] = React.useState<Record<string, string>>({});

  const currentSupplierId = view as SupplierId;
  const currentConfig     = supplierConfigs[currentSupplierId];
  const supplierLabel     = SUPPLIER_LABELS[currentSupplierId];

  // Produits du fournisseur actif
  const displayedProducts = products.filter(p => p.supplierId === currentSupplierId);

  // Dates de livraison
  const dates = getDeliveryDates(currentConfig);
  const deliveryOverride          = deliveryDateBySupplier[currentSupplierId];
  const selectedDeliveryDate      = deliveryOverride ? new Date(deliveryOverride) : dates.delivery;
  const selectedDeliveryFormatted = selectedDeliveryDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const minDelivery2 = new Date(selectedDeliveryDate);
  minDelivery2.setDate(selectedDeliveryDate.getDate() + 1);

  const nextDeliveryOverride = nextDeliveryDateBySupplierLocal[currentSupplierId];
  const rawNextDelivery = nextDeliveryOverride ? new Date(nextDeliveryOverride) : dates.delivery2;
  const selectedNextDeliveryDate = (!rawNextDelivery || rawNextDelivery <= selectedDeliveryDate) ? dates.delivery2 : rawNextDelivery;
  const selectedNextDeliveryFormatted = selectedNextDeliveryDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  // Mode Marge : comportement inchangé (jusqu'à la veille de la livraison suivante)
  const marginForecastEnd = new Date(selectedNextDeliveryDate);
  marginForecastEnd.setDate(selectedNextDeliveryDate.getDate() - 1);
  const marginWindowForecast = getForecastForWindow(marginForecastEnd, dailyCovers);

  // Mode Cible : jusqu'à la veille de la livraison choisie (calendrier unique)
  const targetForecastEnd = new Date(selectedDeliveryDate);
  targetForecastEnd.setDate(selectedDeliveryDate.getDate() - 1);
  const targetWindowForecast = getForecastForWindow(targetForecastEnd, dailyCovers);

  const windowForecast = calculationMode === 'target' ? targetWindowForecast : marginWindowForecast;

  return (
    <div className="min-h-screen bg-[#FCEEB5] p-4 md:p-8 font-sans text-xs relative">
      {showResetConfirm && (
        <ResetConfirmModal
          onConfirm={performReset}
          onClose={() => setShowResetConfirm(false)}
        />
      )}

      {/* ---- HEADER ---- */}
      <div className="max-w-[1600px] mx-auto mb-6">
        <div className="bg-white/90 backdrop-blur-xl rounded-[32px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-white flex flex-col lg:flex-row items-center justify-between gap-6">

          {/* Nom du fournisseur */}
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
              <span className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center text-[#ffd700] shadow-lg shadow-slate-900/20">
                <SupplierIcon view={view} />
              </span>
              {supplierLabel.name}
            </h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest pl-16">
              {supplierLabel.subtitle}
            </p>
          </div>

          {/* Sélecteur de mode */}
          <div className="flex gap-2 bg-[#FCEEB5] p-1.5 rounded-2xl border border-white/50">
            <button
              onClick={() => setCalculationMode('margin')}
              className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] transition-all flex items-center gap-2 ${calculationMode === 'margin' ? 'bg-white text-orange-600 shadow-md ring-1 ring-orange-50' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <div className={`w-2 h-2 rounded-full ${calculationMode === 'margin' ? 'bg-orange-500' : 'bg-slate-300'}`} />
              Mode Marge
            </button>
            <button
              onClick={() => setCalculationMode('target')}
              className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] transition-all flex items-center gap-2 ${calculationMode === 'target' ? 'bg-white text-blue-600 shadow-md ring-1 ring-blue-50' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <div className={`w-2 h-2 rounded-full ${calculationMode === 'target' ? 'bg-blue-500' : 'bg-slate-300'}`} />
              Mode Cible
            </button>
          </div>

          {/* Infos livraison + couverts */}
          <div className="flex gap-4">
            {/* Date de livraison (avec calendrier) */}
            <div className="bg-emerald-50/50 px-6 py-3 rounded-2xl border border-emerald-100/50 flex flex-col items-center min-w-[120px] relative">
              <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Livraison</span>
              <button
                onClick={e => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setCalendarAnchorRectBySupplier(prev => ({ ...prev, [currentSupplierId]: rect }));
                  setActiveCalendarSupplier(prev => prev === currentSupplierId ? null : currentSupplierId);
                }}
                className="mt-1 flex items-center gap-2 px-3 py-1.5 bg-white/70 hover:bg-white rounded-xl border border-emerald-100 transition-colors"
              >
                <span className="font-black text-emerald-900 text-sm">
                  {capitalizeFirstLetter(selectedDeliveryFormatted)}
                </span>
                <svg className={`w-4 h-4 text-emerald-400 transition-transform ${activeCalendarSupplier === currentSupplierId ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>

              {activeCalendarSupplier === currentSupplierId && (
                <WindowsCalendar
                  selectedDate={selectedDeliveryDate}
                  anchorRect={calendarAnchorRectBySupplier[currentSupplierId]}
                  onSelect={d => {
                    setDeliveryDateBySupplier(prev => ({ ...prev, [currentSupplierId]: d.toISOString() }));
                    setActiveCalendarSupplier(null);
                  }}
                  onClose={() => setActiveCalendarSupplier(null)}
                />
              )}
            </div>


            {calculationMode === 'margin' && (
              <div className="bg-amber-50/50 px-6 py-3 rounded-2xl border border-amber-100/50 flex flex-col items-center min-w-[120px] relative">
                <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">Livr. Suivante</span>
                <button
                  onClick={() => {
                    setActiveNextCalendar(v => !v);
                    setActiveCalendarSupplier(null);
                  }}
                  className="mt-1 flex items-center gap-2 px-3 py-1.5 bg-white/70 hover:bg-white rounded-xl border border-amber-100 transition-colors"
                >
                  <span className="font-black text-amber-900 text-sm">
                    {capitalizeFirstLetter(selectedNextDeliveryFormatted)}
                  </span>
                  <svg className={`w-4 h-4 text-amber-400 transition-transform ${activeNextCalendar ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>

                {activeNextCalendar && (
                  <WindowsCalendar
                    selectedDate={selectedNextDeliveryDate}
                    minDate={minDelivery2}
                    onSelect={d => {
                      setNextDeliveryDateBySupplierLocal(prev => ({ ...prev, [currentSupplierId]: d.toISOString() }));
                      setActiveNextCalendar(false);
                    }}
                    onClose={() => setActiveNextCalendar(false)}
                  />
                )}
              </div>
            )}

            {/* Couverts prévus */}
            <div className="bg-indigo-50/50 px-6 py-3 rounded-2xl border border-indigo-100/50 flex flex-col items-center min-w-[120px]">
              <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Couverts Prévus</span>
              <span className="font-black text-indigo-900 text-xl leading-none">{windowForecast.total}</span>
            </div>
          </div>

          {/* Boutons navigation */}
          <div className="flex gap-3">
            <button
              onClick={() => setView('home')}
              title="Retour Accueil"
              className="w-12 h-12 rounded-2xl bg-[#FCEEB5] text-slate-400 hover:bg-slate-200 hover:text-slate-600 flex items-center justify-center transition-all shadow-sm"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
            </button>
            <button
              onClick={() => setView('suppliers')}
              title="Retour Commandes"
              className="w-12 h-12 rounded-2xl bg-[#FCEEB5] text-slate-400 hover:bg-slate-200 hover:text-slate-600 flex items-center justify-center transition-all shadow-sm"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            </button>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="px-6 py-3 bg-red-50 text-red-600 font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-red-600 hover:text-white transition-all border border-red-100 shadow-sm hover:shadow-red-200"
            >
              RAZ
            </button>
          </div>
        </div>
      </div>

      {/* ---- TABLEAU ---- */}
      <div className="max-w-[1600px] mx-auto pb-24">
        <div className="bg-white rounded-[32px] shadow-2xl shadow-slate-300/20 border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-left h-16">
                <th className="px-6 bg-[#2c1810] text-[#ffd700] font-black uppercase text-xs tracking-widest w-1/4">Produit</th>
                {calculationMode === 'margin' ? (
                  <>
                    <th className="p-2 bg-[#FDBA74] text-white font-black uppercase text-[11px] tracking-widest text-center w-28">Besoin<br/>Théorique</th>
                    <th className="p-2 bg-emerald-600 text-white font-black uppercase text-[11px] tracking-widest text-center w-32 shadow-lg z-10">Livraison<br/>à venir</th>
                    <th className="p-2 bg-amber-600 text-white font-black uppercase text-[11px] tracking-widest text-center w-32 shadow-lg z-10">Stock<br/>Actuel</th>
                    <th className="p-2 bg-[#FDBA74] text-white font-black uppercase text-[11px] tracking-widest text-center w-24">Colisage</th>
                    <th className="p-2 bg-[#FDBA74] text-white font-black uppercase text-[11px] tracking-widest text-center w-28">Marge de<br/>Sécurité (%)</th>
                    <th className="px-4 bg-slate-900 text-white font-black uppercase text-xs tracking-widest text-center w-40">A Commander</th>
                  </>
                ) : (
                  <>
                    <th className="p-2 bg-blue-600 text-white font-black uppercase text-[11px] tracking-widest text-center w-32 shadow-lg z-10">Stock Cible<br/>(Unités)</th>
                    <th className="p-2 bg-emerald-600 text-white font-black uppercase text-[11px] tracking-widest text-center w-32 shadow-lg z-10">Livraison<br/>à venir</th>
                    <th className="p-2 bg-amber-600 text-white font-black uppercase text-[11px] tracking-widest text-center w-32 shadow-lg z-10">Stock<br/>Actuel</th>
                    <th className="p-2 bg-[#FDBA74] text-white font-black uppercase text-[11px] tracking-widest text-center w-24">Consommation<br/>Estimée</th>
                    <th className="p-2 bg-[#FDBA74] text-white font-black uppercase text-[11px] tracking-widest text-center w-24">Manque</th>
                    <th className="p-2 bg-[#FDBA74] text-white font-black uppercase text-[11px] tracking-widest text-center w-24">Colisage</th>
                    <th className="px-4 bg-slate-900 text-white font-black uppercase text-xs tracking-widest text-center w-40">A Commander</th>
                  </>
                )}
              </tr>
            </thead>

            <tbody className="divide-y-2 divide-slate-200">
              {displayedProducts.map(p => {
                const { avgRatio }     = getProductStats(p);
                const stockSafe        = Number(p.stock) || 0;
                const upcomingSafe     = Number(p.upcomingDelivery) || 0;
                const targetSafe       = Number(p.targetStock) || 0;
                let toOrder            = 0;
                let displayInfo1: number | null = null;
                let displayInfo2: number | null = null;

                if (calculationMode === 'margin') {
                  const dynamicTheo  = Math.ceil(avgRatio * windowForecast.total);
                  const currentMargin = orderStates[p.id]?.margin ?? 30;
                  const res          = calculateOrder(dynamicTheo, upcomingSafe, stockSafe, currentMargin, p.packaging);
                  toOrder            = res.toOrder;
                  displayInfo1       = dynamicTheo;
                } else {
                  const estimatedConso = Math.ceil(avgRatio * windowForecast.total);
                  const res            = calculateTargetOrder(targetSafe, p.stock, estimatedConso, p.packaging);
                  toOrder              = res.toOrder;
                  displayInfo1         = estimatedConso;
                  displayInfo2         = res.missing;
                }

                return (
                  <tr key={p.id} className="hover:bg-amber-50/40 transition-colors group">
                    <td className="px-6 py-4 font-['Roboto_Slab'] font-bold text-slate-800 text-sm border-r-2 border-slate-100">
                      {capitalizeFirstLetter(p.name)}
                    </td>

                    {calculationMode === 'margin' ? (
                      <>
                        <td className="p-2 text-center font-bold text-slate-700 text-sm bg-[#FFE8CC]">{displayInfo1}</td>

                        {/* Livraison à venir */}
                        <td className="p-2 bg-emerald-50/20">
                          <input type="number" value={p.upcomingDelivery}
                            onChange={e => updateProductValue(p.id, 'upcomingDelivery', e.target.value)}
                            className="w-full h-10 rounded-lg border border-emerald-200/50 bg-white text-center font-black text-emerald-700 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all shadow-sm"
                            placeholder="-"
                          />
                        </td>


                        {/* Stock actuel */}
                        <td className="p-2 bg-amber-50/20">
                          <input type="number" value={p.stock}
                            onChange={e => updateProductValue(p.id, 'stock', e.target.value)}
                            className="w-full h-10 rounded-lg border border-amber-200/50 bg-white text-center font-black text-amber-700 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all shadow-sm"
                            placeholder="-"
                          />
                        </td>

                        {/* Colisage */}
                        <td className="p-2 text-center bg-[#FFE8CC]">
                          <input type="number" value={p.packaging}
                            onChange={e => updateProductValue(p.id, 'packaging', e.target.value)}
                            className="w-16 text-center bg-white/50 border border-slate-200 rounded-lg focus:bg-white focus:border-indigo-500 font-bold text-slate-600 text-sm outline-none transition-all py-1 hover:border-slate-300"
                          />
                        </td>

                        {/* Marge de sécurité */}
                        <td className="p-2 text-center bg-[#FFE8CC]">
                          <select
                            value={orderStates[p.id]?.margin ?? 30}
                            onChange={e => setOrderStates(pv => ({ ...pv, [p.id]: { ...pv[p.id], margin: Number(e.target.value) } }))}
                            className="bg-white/80 border border-slate-300 text-slate-700 font-bold text-sm py-1 px-2 rounded-lg outline-none cursor-pointer hover:border-slate-400 shadow-sm"
                          >
                            {[0,5,10,15,20,25,30,35,40,45,50].map(o => <option key={o} value={o}>{o}%</option>)}
                          </select>
                        </td>

                        {/* À commander */}
                        <td className="p-2 text-center border-l-2 border-slate-200">
                          <div className={`inline-flex items-center justify-center w-14 h-10 rounded-xl font-black text-lg shadow-sm transition-all ${toOrder > 0 ? 'bg-orange-500 text-white shadow-orange-200 scale-110' : 'bg-slate-100 text-slate-300 scale-90 opacity-50'}`}>
                            {toOrder}
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        {/* Stock cible */}
                        <td className="p-2 relative bg-blue-50/20">
                          <input type="number" value={p.targetStock}
                            onChange={e => updateProductValue(p.id, 'targetStock', e.target.value)}
                            className="w-full h-10 rounded-lg border border-blue-200/50 bg-white text-center font-black text-blue-700 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
                            placeholder="-"
                          />
                          {Number(p.packaging) > 1 && targetSafe > 0 && (
                            <div className="absolute top-3 right-4 text-[8px] font-bold text-blue-400 bg-blue-50 px-1.5 py-0.5 rounded-md pointer-events-none">
                              {(targetSafe / (Number(p.packaging) || 1)).toFixed(1)} cs
                            </div>
                          )}
                        </td>

                        {/* Livraison à venir */}
                        <td className="p-2 bg-emerald-50/20">
                          <input type="number" value={p.upcomingDelivery}
                            onChange={e => updateProductValue(p.id, 'upcomingDelivery', e.target.value)}
                            className="w-full h-10 rounded-lg border border-emerald-200/50 bg-white text-center font-black text-emerald-700 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all shadow-sm"
                            placeholder="-"
                          />
                        </td>

                        {/* Stock actuel */}
                        <td className="p-2 bg-amber-50/20">
                          <input type="number" value={p.stock}
                            onChange={e => updateProductValue(p.id, 'stock', e.target.value)}
                            className="w-full h-10 rounded-lg border border-amber-200/50 bg-white text-center font-black text-amber-700 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all shadow-sm"
                            placeholder="-"
                          />
                        </td>

                        <td className="p-2 text-center bg-[#FFE8CC]">
                          <span className="text-slate-600 font-bold text-sm">{displayInfo1}</span>
                        </td>

                        <td className="p-2 text-center bg-[#FFE8CC]">
                          {displayInfo2 !== null && displayInfo2 > 0 ? (
                            <span className="text-red-600 font-black bg-white/50 border border-red-200 px-2 py-0.5 rounded text-sm">-{displayInfo2}</span>
                          ) : (
                            <span className="text-slate-400 text-sm">-</span>
                          )}
                        </td>

                        {/* Colisage */}
                        <td className="p-2 text-center bg-[#FFE8CC]">
                          <input type="number" value={p.packaging}
                            onChange={e => updateProductValue(p.id, 'packaging', e.target.value)}
                            className="w-16 text-center bg-white/50 border border-slate-200 rounded-lg focus:bg-white focus:border-indigo-500 font-bold text-slate-600 text-sm outline-none transition-all py-1 hover:border-slate-300"
                          />
                        </td>

                        {/* À commander */}
                        <td className="p-2 text-center border-l-2 border-slate-200">
                          <div className={`inline-flex items-center justify-center w-14 h-10 rounded-xl font-black text-lg shadow-sm transition-all ${toOrder > 0 ? 'bg-blue-600 text-white shadow-blue-200 scale-110' : 'bg-slate-100 text-slate-300 scale-90 opacity-50'}`}>
                            {toOrder}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SupplierOrderPage;
