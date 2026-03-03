// =============================================================
// pages/SupplierOrderPage.tsx
// Page de commande pour un fournisseur (tableau principal)
//
// ✅ Mobile-first :
//   - Header : grille 2x2 compacte sur mobile, ligne unique sur lg
//   - Tableau : scrollable horizontalement, colonne "À Commander" sticky
// =============================================================

import React from 'react';
import { View, SUPPLIER_LABELS, SupplierId } from '../constants';
import { getDeliveryDates, getForecastForWindow } from '../utils/dateHelpers';
import { calculateOrder, calculateTargetOrder, capitalizeFirstLetter, toNumber } from '../utils/calculations';
import { ResetConfirmModal } from '../components/Modals';
import WindowsCalendar from '../components/WindowsCalendar';
import {
  DOQUET_CONFIG, VINS_CONFIG, VIANDES_CONFIG,
  DOMAFRAIS_CONFIG, DOMAFRAIS_BOF_CONFIG, POMONA_TERRE_AZUR_CONFIG, POMONA_EPISAVEURS_CONFIG,
} from '../data';
import { SupplierConfig } from '../types';
import { useAppState } from '../hooks/useAppState';

type AppState = ReturnType<typeof useAppState>;
interface SupplierOrderPageProps { state: AppState; }

const SupplierIcon: React.FC<{ view: string }> = ({ view }) => {
  // Doquet — sac shopping (softs & jus)
  if (view === 'doquet')
    return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>;
  // Richard Vins — flacon de labo / vin
  if (view === 'vins')
    return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>;
  // Plaine Maison — camion livraison viandes
  if (view === 'viandes')
    return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 1m8-11h4l3 5v5h-2m-5 0H9"/></svg>;
  // Domafrais Viandes — os / viande (couteau + fourchette)
  if (view === 'domafrais')
    return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6c0-1.1.9-2 2-2s2 .9 2 2v6H5a2 2 0 01-2-2V6zM15 4c-1.1 0-2 .9-2 2v2h2v2h-2v2c0 1.1.9 2 2 2h4V4h-4z"/><circle cx="17" cy="17" r="2" strokeWidth="2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12v5a2 2 0 002 2h1"/></svg>;
  // Domafrais BOF — fromage / crémerie
  if (view === 'domafrais_bof')
    return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><circle cx="12" cy="12" r="2" strokeWidth="2"/></svg>;
  // Pomona Terre Azur — cagette fruits & légumes
  if (view === 'pomona_terre_azur')
    return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16l-1 10H5L4 8z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 8V6a3 3 0 016 0v2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11v4M10 13h4"/></svg>;
  // Pomona Episaveurs — caisse épicerie
  if (view === 'pomona_episaveurs')
    return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7h18l-2 10H5L3 7z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V5a4 4 0 018 0v2"/></svg>;
  // Fallback — panier
  return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>;
};

const SupplierOrderPage: React.FC<SupplierOrderPageProps> = ({ state }) => {
  const {
    view, setView,
    calculationMode, setCalculationMode,
    showResetConfirm, setShowResetConfirm,
    activeCalendarSupplier, setActiveCalendarSupplier,
    calendarAnchorRectBySupplier, setCalendarAnchorRectBySupplier,
    deliveryDateBySupplier, setDeliveryDateBySupplier,
    nextDeliveryDateBySupplier, setNextDeliveryDateBySupplier,
    orderStates, setOrderStates,
    supplierConfigs, products, dailyCovers,
    performReset, updateProductValue, getProductStats,
  } = state;

  const [activeNextCalendar, setActiveNextCalendar] = React.useState(false);

  React.useEffect(() => {
    if (calculationMode === 'target') setActiveNextCalendar(false);
  }, [calculationMode]);

  const currentSupplierId = view as SupplierId;
  // Guard : si la config n'est pas encore chargée (Supabase en cours), utiliser le défaut du code
  const _configDefaults: Record<string, SupplierConfig> = {
    doquet: DOQUET_CONFIG, vins: VINS_CONFIG, viandes: VIANDES_CONFIG,
    domafrais: DOMAFRAIS_CONFIG, domafrais_bof: DOMAFRAIS_BOF_CONFIG, pomona_terre_azur: POMONA_TERRE_AZUR_CONFIG, pomona_episaveurs: POMONA_EPISAVEURS_CONFIG,
  };
  const currentConfig  = supplierConfigs[currentSupplierId] ?? _configDefaults[currentSupplierId];
  const supplierLabel  = SUPPLIER_LABELS[currentSupplierId];
  const displayedProducts = products.filter(p => p.supplierId === currentSupplierId);

  const dates = getDeliveryDates(currentConfig);

  // ── Contraintes de date ───────────────────────────────────────
  const minDelivery1 = new Date(dates.delivery);
  minDelivery1.setHours(0, 0, 0, 0);

  // ── Livraison courante (calendrier 1) ────────────────────────
  // Par défaut = calculé par getDeliveryDates (respecte les cut-offs)
  // Si l'override stocké est antérieur au minimum autorisé métier → réinitialiser
  const deliveryOverride = deliveryDateBySupplier[currentSupplierId];
  const _rawDelivery = deliveryOverride ? new Date(deliveryOverride) : dates.delivery;
  const selectedDeliveryDate = _rawDelivery < minDelivery1 ? dates.delivery : _rawDelivery;

  // Nettoyer le stockage si l'override est périmé (ou invalide métier)
  React.useEffect(() => {
    if (deliveryOverride && new Date(deliveryOverride) < minDelivery1) {
      setDeliveryDateBySupplier(prev => { const n = { ...prev }; delete n[currentSupplierId]; return n; });
      setNextDeliveryDateBySupplier(prev => { const n = { ...prev }; delete n[currentSupplierId]; return n; });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSupplierId, dates.delivery]);

  const selectedDeliveryFormatted = selectedDeliveryDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

  // ── Minimum pour calendrier 2 = cal1 + 1 jour ────────────────
  const minDelivery2 = new Date(selectedDeliveryDate);
  minDelivery2.setDate(selectedDeliveryDate.getDate() + 1);

  // ── Livraison suivante (calendrier 2) ────────────────────────
  // Par défaut = delivery2 calculé par getDeliveryDates (prochaine livraison après cal1)
  // Affiché = veille de cette livraison (= fin de la fenêtre de commande)
  const nextDeliveryOverride = nextDeliveryDateBySupplier[currentSupplierId];
  const _rawNext = nextDeliveryOverride ? new Date(nextDeliveryOverride) : dates.delivery2;
  const selectedNextDeliveryDate = (!_rawNext || _rawNext <= selectedDeliveryDate) ? dates.delivery2 : _rawNext;
  const selectedNextDeliveryFormatted = selectedNextDeliveryDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

  // ── Couverts prévus ────────────────────────────────────────────
  // Mode Marge : mécanique actuelle conservée (veille de la livraison suivante)
  const marginForecastEnd = new Date(selectedNextDeliveryDate);
  marginForecastEnd.setDate(selectedNextDeliveryDate.getDate() - 1);
  const marginWindowForecast = getForecastForWindow(marginForecastEnd, dailyCovers);

  // Mode Cible : jusqu'à la veille de la date de livraison choisie (calendrier unique "Livraison")
  const targetForecastEnd = new Date(selectedDeliveryDate);
  targetForecastEnd.setDate(selectedDeliveryDate.getDate() - 1);
  const targetWindowForecast = getForecastForWindow(targetForecastEnd, dailyCovers);

  const windowForecast = calculationMode === 'target' ? targetWindowForecast : marginWindowForecast;

  // ─── Navigation "Suivant" mobile via tabIndex ordonné ──────────────────
  // La seule approche fiable sur Samsung Internet / Android / iOS :
  // on assigne un tabIndex explicite à chaque input.
  // tabIndex = BASE + rowIdx  → le navigateur suit cet ordre nativement
  // quand l'utilisateur appuie sur "Suivant" du clavier.
  //
  // Trois colonnes indépendantes :
  //   upcomingDelivery : base 100  → 100, 101, 102...
  //   stock colissage  : base 200  → 200, 201, 202...
  //   stock pièces     : base 300  → 300, 301, 302...
  //
  // Sur PC, Enter dans un input focus le tabIndex suivant via handleEnterKey.
  const TAB_UPCOMING = 100;
  const TAB_STOCK_CASES = 200;
  const TAB_STOCK_PIECES = 300;


  const getStockSplit = (stockVal: number | '' | undefined, packagingVal: number | '') => {
    const totalStock = Math.max(0, Math.floor(toNumber(stockVal)));
    const pkg = Math.max(1, Math.floor(toNumber(packagingVal) || 1));
    const stockCases = Math.floor(totalStock / pkg);
    const stockPieces = totalStock % pkg;
    return { totalStock, pkg, stockCases, stockPieces };
  };


  const getUpcomingDeliveryUnits = (upcomingVal: number | '' | undefined, packagingVal: number | '') => {
    const upcomingCases = Math.max(0, Math.floor(toNumber(upcomingVal)));
    const pkg = Math.max(1, Math.floor(toNumber(packagingVal) || 1));
    return upcomingCases * pkg;
  };

  const updateStockFromSplit = (
    productId: string,
    packagingVal: number | '',
    rawCases: string,
    rawPieces: string
  ) => {
    const pkg = Math.max(1, Math.floor(toNumber(packagingVal) || 1));
    const parsedCases = rawCases === '' ? 0 : Math.max(0, Math.floor(Number(rawCases) || 0));
    const parsedPieces = rawPieces === '' ? 0 : Math.max(0, Math.floor(Number(rawPieces) || 0));

    if (rawCases === '' && rawPieces === '') {
      updateProductValue(productId, 'stock', '');
      return;
    }

    const totalStock = parsedCases * pkg + parsedPieces;
    updateProductValue(productId, 'stock', String(totalStock));
  };

  const handleEnterKey = (e: React.KeyboardEvent<HTMLInputElement>, tabBase: number, rowIdx: number) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const nextTab = tabBase + rowIdx + 1;
    const next = document.querySelector<HTMLInputElement>(`[tabindex="${nextTab}"]`);
    if (next) {
      next.focus();
      next.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#FCEEB5] p-3 md:p-8 font-sans text-xs relative">
      {showResetConfirm && (
        <ResetConfirmModal onConfirm={performReset} onClose={() => setShowResetConfirm(false)} />
      )}

      {/* ================================================================
          HEADER MOBILE-FIRST
          Mobile  : 2 rangées compactes (nom+nav | mode+infos)
          Desktop : 1 ligne flex-row
      ================================================================ */}
      <div className="max-w-[1600px] mx-auto mb-4">
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl lg:rounded-[32px] p-3 lg:p-6 shadow border border-white">

          {/* ── Rangée 1 : nom fournisseur + boutons nav ── */}
          <div className="flex items-center justify-between gap-2 mb-3 lg:mb-0 lg:hidden">

            {/* Nom */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-9 h-9 shrink-0 bg-slate-900 rounded-full flex items-center justify-center text-[#ffd700]">
                <SupplierIcon view={view} />
              </span>
              <div className="min-w-0">
                <h1 className="text-base font-black text-slate-800 uppercase tracking-tighter truncate leading-tight">
                  {supplierLabel.name}
                </h1>
                <p className="text-slate-400 font-bold uppercase text-[9px] tracking-widest truncate">
                  {supplierLabel.subtitle}
                </p>
              </div>
            </div>

            {/* Boutons nav (mobile) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => setView('home')} title="Accueil"
                className="w-9 h-9 rounded-xl bg-[#FCEEB5] text-slate-500 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
              </button>
              <button onClick={() => setView('suppliers')} title="Fournisseurs"
                className="w-9 h-9 rounded-xl bg-[#FCEEB5] text-slate-500 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
              </button>
              <button onClick={() => setShowResetConfirm(true)}
                className="h-9 px-3 bg-red-50 text-red-600 font-black uppercase text-[10px] rounded-xl border border-red-100">
                RAZ
              </button>
            </div>
          </div>

          {/* ── Rangée 2 : mode calcul + livraison + couverts (mobile) ── */}
          <div className="flex items-center gap-2 lg:hidden">

            {/* Sélecteur mode — compact */}
            <div className="flex bg-[#FCEEB5] p-1 rounded-xl border border-white/50 shrink-0">
              <button onClick={() => setCalculationMode('margin')}
                className={`px-3 py-1.5 rounded-lg font-black uppercase text-[9px] transition-all ${calculationMode === 'margin' ? 'bg-white text-orange-600 shadow' : 'text-slate-400'}`}>
                Marge
              </button>
              <button onClick={() => setCalculationMode('target')}
                className={`px-3 py-1.5 rounded-lg font-black uppercase text-[9px] transition-all ${calculationMode === 'target' ? 'bg-white text-blue-600 shadow' : 'text-slate-400'}`}>
                Cible
              </button>
            </div>

            {/* Livraison courante — calendrier 1 (mobile) */}
            <div className="relative flex-1">
              <button
                onClick={() => {
                  setActiveCalendarSupplier(prev => prev === currentSupplierId ? null : currentSupplierId);
                  setActiveNextCalendar(false);
                }}
                className="w-full flex items-center justify-between gap-1 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl"
              >
                <span className="text-[9px] font-black text-emerald-400 uppercase shrink-0">Livr.</span>
                <span className="font-black text-emerald-900 text-[11px] truncate">
                  {capitalizeFirstLetter(selectedDeliveryFormatted)}
                </span>
                <svg className={`w-3 h-3 text-emerald-400 shrink-0 transition-transform ${activeCalendarSupplier === currentSupplierId ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
              {activeCalendarSupplier === currentSupplierId && (
                <WindowsCalendar
                  selectedDate={selectedDeliveryDate}
                  minDate={minDelivery1}
                  onSelect={d => {
                    setDeliveryDateBySupplier(prev => ({ ...prev, [currentSupplierId]: d.toISOString() }));
                    // Recaler la livraison suivante à +7j automatiquement
                    const next = new Date(d); next.setDate(d.getDate() + 7);
                    setNextDeliveryDateBySupplier(prev => ({ ...prev, [currentSupplierId]: next.toISOString() }));
                    setActiveCalendarSupplier(null);
                  }}
                  onClose={() => setActiveCalendarSupplier(null)}
                />
              )}
            </div>

            {calculationMode === 'margin' && (
              <>
                {/* Livraison suivante — calendrier 2 (mobile) */}
                <div className="relative flex-1">
              <button
                onClick={() => {
                  setActiveNextCalendar(v => !v);
                  setActiveCalendarSupplier(null);
                }}
                className="w-full flex items-center justify-between gap-1 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl"
              >
                <span className="text-[9px] font-black text-amber-500 uppercase shrink-0">Suiv.</span>
                <span className="font-black text-amber-900 text-[11px] truncate">
                  {capitalizeFirstLetter(selectedNextDeliveryFormatted)}
                </span>
                <svg className={`w-3 h-3 text-amber-400 shrink-0 transition-transform ${activeNextCalendar ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
              {activeNextCalendar && (
                <WindowsCalendar
                  selectedDate={selectedNextDeliveryDate}
                  minDate={minDelivery2}
                  onSelect={d => {
                    setNextDeliveryDateBySupplier(prev => ({ ...prev, [currentSupplierId]: d.toISOString() }));
                    setActiveNextCalendar(false);
                  }}
                  onClose={() => setActiveNextCalendar(false)}
                />
              )}
                </div>
              </>
            )}

            {/* Couverts (mobile) */}
            <div className="bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 flex items-center gap-1.5 shrink-0">
              <span className="text-[9px] font-black text-indigo-400 uppercase">Couverts</span>
              <span className="font-black text-indigo-900 text-sm">{windowForecast.total}</span>
            </div>
          </div>

          {/* ── VERSION DESKTOP : 1 seule ligne (inchangée) ── */}
          <div className="hidden lg:flex items-center justify-between gap-6">

            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
                <span className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center text-[#ffd700] shadow-lg">
                  <SupplierIcon view={view} />
                </span>
                {supplierLabel.name}
              </h1>
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest pl-16">{supplierLabel.subtitle}</p>
            </div>

            <div className="flex gap-2 bg-[#FCEEB5] p-1.5 rounded-2xl border border-white/50">
              <button onClick={() => setCalculationMode('margin')}
                className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] transition-all flex items-center gap-2 ${calculationMode === 'margin' ? 'bg-white text-orange-600 shadow-md' : 'text-slate-400'}`}>
                <div className={`w-2 h-2 rounded-full ${calculationMode === 'margin' ? 'bg-orange-500' : 'bg-slate-300'}`} />
                Mode Marge
              </button>
              <button onClick={() => setCalculationMode('target')}
                className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] transition-all flex items-center gap-2 ${calculationMode === 'target' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400'}`}>
                <div className={`w-2 h-2 rounded-full ${calculationMode === 'target' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                Mode Cible
              </button>
            </div>

            <div className="flex gap-4">
              {/* Calendrier 1 — Livraison courante */}
              <div className="bg-emerald-50/50 px-6 py-3 rounded-2xl border border-emerald-100/50 flex flex-col items-center min-w-[140px] relative">
                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Livraison</span>
                <button
                  onClick={() => {
                    setActiveCalendarSupplier(prev => prev === currentSupplierId ? null : currentSupplierId);
                    setActiveNextCalendar(false);
                  }}
                  className="mt-1 flex items-center gap-2 px-3 py-1.5 bg-white/70 hover:bg-white rounded-xl border border-emerald-100 transition-colors"
                >
                  <span className="font-black text-emerald-900 text-sm">{capitalizeFirstLetter(selectedDeliveryFormatted)}</span>
                  <svg className={`w-4 h-4 text-emerald-400 transition-transform ${activeCalendarSupplier === currentSupplierId ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
                {activeCalendarSupplier === currentSupplierId && (
                  <WindowsCalendar
                    selectedDate={selectedDeliveryDate}
                    minDate={minDelivery1}
                    onSelect={d => {
                      setDeliveryDateBySupplier(prev => ({ ...prev, [currentSupplierId]: d.toISOString() }));
                      // Réinitialiser cal2 → sera recalculé par getDeliveryDates
                      setNextDeliveryDateBySupplier(prev => { const n = { ...prev }; delete n[currentSupplierId]; return n; });
                      setActiveCalendarSupplier(null);
                    }}
                    onClose={() => setActiveCalendarSupplier(null)}
                  />
                )}
              </div>

              {calculationMode === 'margin' && (
                <>
                  {/* Calendrier 2 — Livraison suivante */}
                  <div className="bg-amber-50/50 px-6 py-3 rounded-2xl border border-amber-100/50 flex flex-col items-center min-w-[140px] relative">
                <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">Livr. Suivante</span>
                <button
                  onClick={() => {
                    setActiveNextCalendar(v => !v);
                    setActiveCalendarSupplier(null);
                  }}
                  className="mt-1 flex items-center gap-2 px-3 py-1.5 bg-white/70 hover:bg-white rounded-xl border border-amber-100 transition-colors"
                >
                  <span className="font-black text-amber-900 text-sm">{capitalizeFirstLetter(selectedNextDeliveryFormatted)}</span>
                  <svg className={`w-4 h-4 text-amber-400 transition-transform ${activeNextCalendar ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
                {activeNextCalendar && (
                  <WindowsCalendar
                    selectedDate={selectedNextDeliveryDate}
                    minDate={minDelivery2}
                    onSelect={d => {
                      setNextDeliveryDateBySupplier(prev => ({ ...prev, [currentSupplierId]: d.toISOString() }));
                      setActiveNextCalendar(false);
                    }}
                    onClose={() => setActiveNextCalendar(false)}
                  />
                )}
                  </div>
                </>
              )}

              {/* Couverts Prévus */}
              <div className="bg-indigo-50/50 px-6 py-3 rounded-2xl border border-indigo-100/50 flex flex-col items-center min-w-[120px]">
                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Couverts Prévus</span>
                <span className="font-black text-indigo-900 text-xl leading-none">{windowForecast.total}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setView('home')} title="Retour Accueil"
                className="w-12 h-12 rounded-2xl bg-[#FCEEB5] text-slate-400 hover:bg-slate-200 hover:text-slate-600 flex items-center justify-center transition-all shadow-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
              </button>
              <button onClick={() => setView('suppliers')} title="Retour Commandes"
                className="w-12 h-12 rounded-2xl bg-[#FCEEB5] text-slate-400 hover:bg-slate-200 hover:text-slate-600 flex items-center justify-center transition-all shadow-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
              </button>
              <button onClick={() => setShowResetConfirm(true)}
                className="px-6 py-3 bg-red-50 text-red-600 font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-red-600 hover:text-white transition-all border border-red-100 shadow-sm">
                RAZ
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ================================================================
          TABLEAU — scrollable horizontalement sur mobile
          La colonne "À Commander" est sticky à droite (position: sticky)
      ================================================================ */}
      <div className="max-w-[1600px] mx-auto pb-24">
        <div className="bg-white rounded-2xl lg:rounded-[32px] shadow-2xl shadow-slate-300/20 border border-slate-100 overflow-x-auto">
          <table className="w-full" style={{ minWidth: calculationMode === 'margin' ? '760px' : '860px' }}>
          <table className="w-full" style={{ minWidth: calculationMode === 'margin' ? '760px' : '740px' }}>
            <thead>
              <tr className="text-left h-12 lg:h-16">

                {/* Colonne Produit — sticky gauche sur mobile */}
                <th className="px-3 lg:px-6 bg-[#2c1810] text-[#ffd700] font-black uppercase text-[10px] lg:text-xs tracking-widest"
                    style={{ position: 'sticky', left: 0, zIndex: 20, minWidth: '110px', maxWidth: '130px' }}>
                  Produit
                </th>

                {calculationMode === 'margin' ? (<>
                  <th className="p-2 bg-[#FDBA74] text-white font-black uppercase text-[10px] tracking-widest text-center whitespace-nowrap">Besoin<br/>Théo.</th>
                  <th className="p-2 bg-emerald-600 text-white font-black uppercase text-[10px] tracking-widest text-center whitespace-nowrap">Livr.<br/>à venir</th>
                  <th className="p-2 bg-amber-600 text-white font-black uppercase text-[10px] tracking-widest text-center whitespace-nowrap">U. Colisage<br/>en stock</th>
                  <th className="p-2 bg-amber-500 text-white font-black uppercase text-[10px] tracking-widest text-center whitespace-nowrap">U. Pièce<br/>en stock</th>
                  <th className="p-2 bg-[#FDBA74] text-white font-black uppercase text-[10px] tracking-widest text-center whitespace-nowrap">Colis.</th>
                  <th className="p-2 bg-[#FDBA74] text-white font-black uppercase text-[10px] tracking-widest text-center whitespace-nowrap">Marge<br/>(%)</th>
                </>) : (<>
                  <th className="p-2 bg-blue-600 text-white font-black uppercase text-[10px] tracking-widest text-center whitespace-nowrap">Cible<br/>(Unités)</th>
                  <th className="p-2 bg-emerald-600 text-white font-black uppercase text-[10px] tracking-widest text-center whitespace-nowrap">Livr.<br/>à venir</th>
                  <th className="p-2 bg-amber-600 text-white font-black uppercase text-[10px] tracking-widest text-center whitespace-nowrap">U. Colisage<br/>en stock</th>
                  <th className="p-2 bg-amber-500 text-white font-black uppercase text-[10px] tracking-widest text-center whitespace-nowrap">U. Pièce<br/>en stock</th>
                  <th className="p-2 bg-[#FDBA74] text-white font-black uppercase text-[10px] tracking-widest text-center whitespace-nowrap">Conso<br/>Estimée</th>
                  <th className="p-2 bg-[#FDBA74] text-white font-black uppercase text-[10px] tracking-widest text-center whitespace-nowrap">Manque</th>
                  <th className="p-2 bg-[#FDBA74] text-white font-black uppercase text-[10px] tracking-widest text-center whitespace-nowrap">Colis.</th>
                </>)}

                {/* Colonne À Commander — sticky droite */}
                <th className="px-2 lg:px-4 bg-slate-900 text-white font-black uppercase text-[10px] lg:text-xs tracking-widest text-center whitespace-nowrap"
                    style={{ position: 'sticky', right: 0, zIndex: 20, minWidth: '80px' }}>
                  À Cmd.
                </th>
              </tr>
            </thead>

            <tbody className="divide-y-2 divide-slate-200">
              {displayedProducts.map((p, rowIdx) => {
                const { avgRatio } = getProductStats(p);
                const stockSafe      = getStockSplit(p.stock, p.packaging).totalStock;
                const upcomingInUnit = getUpcomingDeliveryUnits(p.upcomingDelivery, p.packaging);
                const targetSafe     = toNumber(p.targetStock);
                let toOrder = 0;
                let displayInfo1: number | null = null;
                let displayInfo2: number | null = null;

                if (calculationMode === 'margin') {
                  const dynamicTheo   = Math.ceil(avgRatio * windowForecast.total);
                  const currentMargin = orderStates[p.id]?.margin ?? 30;
                  const res           = calculateOrder(dynamicTheo, upcomingInUnit, stockSafe, currentMargin, p.packaging);
                  toOrder      = res.toOrder;
                  displayInfo1 = dynamicTheo;
                } else {
                  const estimatedConso = Math.ceil(avgRatio * windowForecast.total);
                  const stockForTarget = stockSafe + upcomingInUnit;
                  const res            = calculateTargetOrder(targetSafe, stockForTarget, estimatedConso, p.packaging);
                  toOrder      = res.toOrder;
                  displayInfo1 = estimatedConso;
                  displayInfo2 = res.missing;
                }

                return (
                  <tr key={p.id} className="hover:bg-amber-50/40 transition-colors">

                    {/* Nom produit — sticky gauche */}
                    <td className="px-3 lg:px-6 py-3 font-['Roboto_Slab'] font-bold text-slate-800 text-xs lg:text-sm border-r-2 border-slate-100 bg-white"
                        style={{ position: 'sticky', left: 0, zIndex: 10 }}>
                      {capitalizeFirstLetter(p.name)}
                    </td>

                    {calculationMode === 'margin' ? (<>
                      <td className="p-2 text-center font-bold text-slate-700 text-sm bg-[#FFE8CC] whitespace-nowrap">{displayInfo1}</td>

                      <td className="p-2 bg-emerald-50/20">
                        <input type="number" value={p.upcomingDelivery}
                          onChange={e => updateProductValue(p.id, 'upcomingDelivery', e.target.value)}
                          tabIndex={TAB_UPCOMING + rowIdx}
                          onKeyDown={e => handleEnterKey(e, TAB_UPCOMING, rowIdx)}
                          enterKeyHint="next"
                          inputMode="numeric"
                          className="w-14 lg:w-full h-9 lg:h-10 rounded-lg border border-emerald-200/50 bg-white text-center font-black text-emerald-700 text-sm outline-none focus:border-emerald-400 transition-all shadow-sm"
                          placeholder="-" />
                      </td>

                      <td className="p-2 bg-amber-50/20">
                        <input type="number" value={p.stock === '' ? '' : getStockSplit(p.stock, p.packaging).stockCases}
                          onChange={e => updateStockFromSplit(p.id, p.packaging, e.target.value, String(getStockSplit(p.stock, p.packaging).stockPieces))}
                          tabIndex={TAB_STOCK_CASES + rowIdx}
                          onKeyDown={e => handleEnterKey(e, TAB_STOCK_CASES, rowIdx)}
                          enterKeyHint="next"
                          inputMode="numeric"
                          className="w-14 lg:w-full h-9 lg:h-10 rounded-lg border border-amber-200/50 bg-white text-center font-black text-amber-700 text-sm outline-none focus:border-amber-400 transition-all shadow-sm"
                          placeholder="-" />
                      </td>

                      <td className="p-2 bg-amber-50/20">
                        <input type="number" value={p.stock === '' ? '' : getStockSplit(p.stock, p.packaging).stockPieces}
                          onChange={e => updateStockFromSplit(p.id, p.packaging, String(getStockSplit(p.stock, p.packaging).stockCases), e.target.value)}
                          tabIndex={TAB_STOCK_PIECES + rowIdx}
                          onKeyDown={e => handleEnterKey(e, TAB_STOCK_PIECES, rowIdx)}
                          enterKeyHint="next"
                          inputMode="numeric"
                          className="w-14 lg:w-full h-9 lg:h-10 rounded-lg border border-amber-200/50 bg-white text-center font-black text-amber-700 text-sm outline-none focus:border-amber-400 transition-all shadow-sm"
                          placeholder="-" />
                      </td>

                      <td className="p-2 text-center bg-[#FFE8CC]">
                        <input type="number" value={p.packaging}
                          onChange={e => updateProductValue(p.id, 'packaging', e.target.value)}
                          className="w-12 lg:w-16 text-center bg-white/50 border border-slate-200 rounded-lg font-bold text-slate-600 text-sm outline-none py-1" />
                      </td>

                      <td className="p-2 text-center bg-[#FFE8CC]">
                        <select
                          value={orderStates[p.id]?.margin ?? 30}
                          onChange={e => setOrderStates(pv => ({ ...pv, [p.id]: { ...pv[p.id], margin: Number(e.target.value) } }))}
                          className="bg-white/80 border border-slate-300 text-slate-700 font-bold text-xs py-1 px-1 rounded-lg outline-none cursor-pointer shadow-sm"
                        >
                          {[0,5,10,15,20,25,30,35,40,45,50].map(o => <option key={o} value={o}>{o}%</option>)}
                        </select>
                      </td>

                    </>) : (<>
                      <td className="p-2 relative bg-blue-50/20">
                        <input type="number" value={p.targetStock}
                          onChange={e => updateProductValue(p.id, 'targetStock', e.target.value)}
                          className="w-14 lg:w-full h-9 lg:h-10 rounded-lg border border-blue-200/50 bg-white text-center font-black text-blue-700 text-sm outline-none focus:border-blue-400 transition-all shadow-sm"
                          placeholder="-" />
                        {toNumber(p.packaging) > 1 && targetSafe > 0 && (
                          <div className="absolute top-2 right-2 text-[8px] font-bold text-blue-400 bg-blue-50 px-1 py-0.5 rounded pointer-events-none hidden lg:block">
                            {(targetSafe / toNumber(p.packaging) || 1).toFixed(1)} cs
                          </div>
                        )}
                      </td>

                      <td className="p-2 bg-emerald-50/20">
                        <input type="number" value={p.upcomingDelivery}
                          onChange={e => updateProductValue(p.id, 'upcomingDelivery', e.target.value)}
                          tabIndex={TAB_UPCOMING + rowIdx}
                          onKeyDown={e => handleEnterKey(e, TAB_UPCOMING, rowIdx)}
                          enterKeyHint="next"
                          inputMode="numeric"
                          className="w-14 lg:w-full h-9 lg:h-10 rounded-lg border border-emerald-200/50 bg-white text-center font-black text-emerald-700 text-sm outline-none focus:border-emerald-400 transition-all shadow-sm"
                          placeholder="-" />
                      </td>

                      <td className="p-2 bg-amber-50/20">
                        <input type="number" value={p.stock === '' ? '' : getStockSplit(p.stock, p.packaging).stockCases}
                          onChange={e => updateStockFromSplit(p.id, p.packaging, e.target.value, String(getStockSplit(p.stock, p.packaging).stockPieces))}
                          tabIndex={TAB_STOCK_CASES + rowIdx}
                          onKeyDown={e => handleEnterKey(e, TAB_STOCK_CASES, rowIdx)}
                          enterKeyHint="next"
                          inputMode="numeric"
                          className="w-14 lg:w-full h-9 lg:h-10 rounded-lg border border-amber-200/50 bg-white text-center font-black text-amber-700 text-sm outline-none focus:border-amber-400 transition-all shadow-sm"
                          placeholder="-" />
                      </td>

                      <td className="p-2 bg-amber-50/20">
                        <input type="number" value={p.stock === '' ? '' : getStockSplit(p.stock, p.packaging).stockCases}
                          onChange={e => updateStockFromSplit(p.id, p.packaging, e.target.value, String(getStockSplit(p.stock, p.packaging).stockPieces))}
                          tabIndex={TAB_STOCK_CASES + rowIdx}
                          onKeyDown={e => handleEnterKey(e, TAB_STOCK_CASES, rowIdx)}
                          enterKeyHint="next"
                          inputMode="numeric"
                          className="w-14 lg:w-full h-9 lg:h-10 rounded-lg border border-amber-200/50 bg-white text-center font-black text-amber-700 text-sm outline-none focus:border-amber-400 transition-all shadow-sm"
                          placeholder="-" />
                      </td>

                      <td className="p-2 bg-amber-50/20">
                        <input type="number" value={p.stock === '' ? '' : getStockSplit(p.stock, p.packaging).stockPieces}
                          onChange={e => updateStockFromSplit(p.id, p.packaging, String(getStockSplit(p.stock, p.packaging).stockCases), e.target.value)}
                          tabIndex={TAB_STOCK_PIECES + rowIdx}
                          onKeyDown={e => handleEnterKey(e, TAB_STOCK_PIECES, rowIdx)}
                          enterKeyHint="next"
                          inputMode="numeric"
                          className="w-14 lg:w-full h-9 lg:h-10 rounded-lg border border-amber-200/50 bg-white text-center font-black text-amber-700 text-sm outline-none focus:border-amber-400 transition-all shadow-sm"
                          placeholder="-" />
                      </td>

                      <td className="p-2 text-center bg-[#FFE8CC] whitespace-nowrap">
                        <span className="text-slate-600 font-bold text-sm">{displayInfo1}</span>
                      </td>

                      <td className="p-2 text-center bg-[#FFE8CC]">
                        {displayInfo2 !== null && displayInfo2 > 0 ? (
                          <span className="text-red-600 font-black bg-white/50 border border-red-200 px-1.5 py-0.5 rounded text-xs">-{displayInfo2}</span>
                        ) : (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </td>

                      <td className="p-2 text-center bg-[#FFE8CC]">
                        <input type="number" value={p.packaging}
                          onChange={e => updateProductValue(p.id, 'packaging', e.target.value)}
                          className="w-12 lg:w-16 text-center bg-white/50 border border-slate-200 rounded-lg font-bold text-slate-600 text-sm outline-none py-1" />
                      </td>
                    </>)}

                    {/* À Commander — sticky droite */}
                    <td className="p-2 text-center border-l-2 border-slate-200 bg-white"
                        style={{ position: 'sticky', right: 0, zIndex: 10 }}>
                      <div className={`inline-flex items-center justify-center w-11 lg:w-14 h-9 lg:h-10 rounded-xl font-black text-lg shadow-sm transition-all
                        ${toOrder > 0
                          ? calculationMode === 'margin'
                            ? 'bg-orange-500 text-white shadow-orange-200 scale-110'
                            : 'bg-blue-600 text-white shadow-blue-200 scale-110'
                          : 'bg-slate-100 text-slate-300 scale-90 opacity-50'}`}>
                        {toOrder}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Hint scroll sur mobile */}
        <p className="text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-3 lg:hidden">
          ← Glisser pour voir toutes les colonnes →
        </p>
      </div>
    </div>
  );
};

export default SupplierOrderPage;
