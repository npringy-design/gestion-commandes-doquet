// =============================================================
// pages/SupplierOrderPage.tsx
// Page de commande pour un fournisseur
//
// Desktop : tableau complet.
// Mobile/tablette : cartes operationnelles sans scroll horizontal.
// Les informations de colisage et unite de comptage viennent de
// Parametre commandes quand une ligne correspond au produit.
// =============================================================

import React from 'react';
import { SupplierId } from '../constants';
import { getDeliveryDates, getForecastForWindow } from '../utils/dateHelpers';
import { calculateOrder, calculateTargetOrder, capitalizeFirstLetter, toNumber } from '../utils/calculations';
import { ResetConfirmModal } from '../components/Modals';
import WindowsCalendar from '../components/WindowsCalendar';
import AppNavTile from '../components/AppNavTile';
import {
  DOQUET_CONFIG,
  VINS_CONFIG,
  VIANDES_CONFIG,
  DOMAFRAIS_CONFIG,
  DOMAFRAIS_BOF_CONFIG,
  POMONA_TERRE_AZUR_CONFIG,
  POMONA_EPISAVEURS_CONFIG,
} from '../data';
import type { Product, SupplierConfig, OrderParameterRow } from '../types';
import { useAppState } from '../hooks/useAppState';
import { useAuth } from '../auth/AuthProvider';
import { isCommandeRole } from '../lib/permissions';

type AppState = ReturnType<typeof useAppState>;
interface SupplierOrderPageProps { state: AppState; }

type DisplayProduct = Product & {
  salesHistory?: Record<string, number>;
  ratioHistory?: Record<string, number>;
};

const normalizeProductKey = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const SupplierIcon: React.FC<{ view: string }> = ({ view }) => {
  if (view === 'doquet') {
    return <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>;
  }
  if (view === 'vins') {
    return <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 4h8l-1 1v5l5 6c1 1.3.2 4-1.6 4H5.6C3.8 20 3 17.3 4 16l5-6V5L8 4z" /></svg>;
  }
  return <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7h18l-2 10H5L3 7zM8 7V5a4 4 0 018 0v2" /></svg>;
};

const defaultConfigs: Record<string, SupplierConfig> = {
  doquet: { ...DOQUET_CONFIG, subtitle: 'Softs • Jus • Cocktails' },
  vins: { ...VINS_CONFIG, subtitle: 'Cave • Alcools' },
  viandes: { ...VIANDES_CONFIG, subtitle: 'Boucherie • Grill' },
  domafrais: { ...DOMAFRAIS_CONFIG, subtitle: 'Viandes • Volailles' },
  domafrais_bof: { ...DOMAFRAIS_BOF_CONFIG, subtitle: 'Crémerie • Fromages' },
  pomona_terre_azur: { ...POMONA_TERRE_AZUR_CONFIG, subtitle: 'Fruits • Légumes' },
  pomona_episaveurs: { ...POMONA_EPISAVEURS_CONFIG, subtitle: 'Épicerie • Aides culinaires' },
};

const NumberInput: React.FC<{
  value: number | '';
  onChange: (value: string) => void;
  tabIndex?: number;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  tone?: 'amber' | 'emerald' | 'blue' | 'neutral';
}> = ({ value, onChange, tabIndex, onKeyDown, disabled, tone = 'neutral' }) => {
  const toneClass = tone === 'amber'
    ? 'border-amber-200 text-amber-700 focus:border-amber-400'
    : tone === 'emerald'
      ? 'border-emerald-200 text-emerald-700 focus:border-emerald-400'
      : tone === 'blue'
        ? 'border-blue-200 text-blue-700 focus:border-blue-400'
        : 'border-slate-200 text-slate-700 focus:border-slate-400';

  return (
    <input
      type="number"
      inputMode="numeric"
      enterKeyHint="next"
      value={value}
      disabled={disabled}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      onChange={event => onChange(event.target.value)}
      className={`h-11 w-full rounded-xl border bg-white text-center text-base font-black outline-none transition ${toneClass} ${disabled ? 'cursor-not-allowed bg-slate-100 text-slate-400' : ''}`}
      placeholder="-"
    />
  );
};

const SupplierOrderPage: React.FC<SupplierOrderPageProps> = ({ state }) => {
  const {
    view,
    setView,
    calculationMode,
    setCalculationMode,
    showResetConfirm,
    setShowResetConfirm,
    activeCalendarSupplier,
    setActiveCalendarSupplier,
    deliveryDateBySupplier,
    setDeliveryDateBySupplier,
    nextDeliveryDateBySupplier,
    setNextDeliveryDateBySupplier,
    orderStates,
    setOrderStates,
    supplierConfigs,
    products,
    dailyCovers,
    orderParameterRows,
    performReset,
    updateProductValue,
    getProductStats,
  } = state;

  const [activeNextCalendar, setActiveNextCalendar] = React.useState(false);
  const { profile } = useAuth();
  const commandeOnly = isCommandeRole(profile);
  const currentSupplierId = view as SupplierId;
  const currentConfig = supplierConfigs[currentSupplierId] ?? defaultConfigs[currentSupplierId] ?? {
    id: currentSupplierId,
    name: currentSupplierId,
    subtitle: 'Fournisseur',
    deliveryDay: 3,
    cutoffDay: 2,
    cutoffTime: '10:00',
    deliveryRules: [{ cutoffDay: 2, deliveryDay: 3 }],
  };

  React.useEffect(() => {
    if (calculationMode === 'target') setActiveNextCalendar(false);
  }, [calculationMode]);

  const displayedProducts = products.filter(product => product.supplierId === currentSupplierId) as DisplayProduct[];
  const supplierLabel = {
    name: (currentConfig.name || currentSupplierId).toUpperCase(),
    subtitle: currentConfig.subtitle || 'Fournisseur',
  };

  const orderParameterByProduct = React.useMemo(() => {
    const map = new Map<string, OrderParameterRow>();
    orderParameterRows
      .filter(row => (row.supplierId ?? currentSupplierId) === currentSupplierId && row.product)
      .forEach(row => map.set(normalizeProductKey(row.product), row));
    return map;
  }, [orderParameterRows, currentSupplierId]);

  const getOrderParameterForProduct = (product: DisplayProduct) =>
    orderParameterByProduct.get(normalizeProductKey(product.name))
    ?? orderParameterByProduct.get(normalizeProductKey(product.searchName));

  const getLinkedPackagingForProduct = (product: DisplayProduct): number | '' => {
    const row = getOrderParameterForProduct(product);
    const linkedPackaging = row?.packaging;
    if (linkedPackaging !== '' && toNumber(linkedPackaging) > 0) return linkedPackaging ?? product.packaging;
    return product.packaging;
  };

  const hasLinkedPackagingForProduct = (product: DisplayProduct) => {
    const linkedPackaging = getOrderParameterForProduct(product)?.packaging;
    return linkedPackaging !== '' && toNumber(linkedPackaging) > 0;
  };

  const getCountingUnitForProduct = (product: DisplayProduct) => {
    const unit = String(getOrderParameterForProduct(product)?.countingUnit || '').trim();
    return unit || '-';
  };

  const dates = getDeliveryDates(currentConfig);
  const minDelivery1 = new Date(dates.delivery);
  minDelivery1.setHours(0, 0, 0, 0);

  const deliveryOverride = deliveryDateBySupplier[currentSupplierId];
  const rawDelivery = deliveryOverride ? new Date(deliveryOverride) : dates.delivery;
  const selectedDeliveryDate = rawDelivery < minDelivery1 ? dates.delivery : rawDelivery;
  const selectedDeliveryFormatted = selectedDeliveryDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

  React.useEffect(() => {
    if (deliveryOverride && new Date(deliveryOverride) < minDelivery1) {
      setDeliveryDateBySupplier(prev => { const next = { ...prev }; delete next[currentSupplierId]; return next; });
      setNextDeliveryDateBySupplier(prev => { const next = { ...prev }; delete next[currentSupplierId]; return next; });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSupplierId, dates.delivery]);

  const minDelivery2 = new Date(selectedDeliveryDate);
  minDelivery2.setDate(selectedDeliveryDate.getDate() + 1);
  const nextDeliveryOverride = nextDeliveryDateBySupplier[currentSupplierId];
  const rawNextDelivery = nextDeliveryOverride ? new Date(nextDeliveryOverride) : dates.delivery2;
  const selectedNextDeliveryDate = !rawNextDelivery || rawNextDelivery <= selectedDeliveryDate ? dates.delivery2 : rawNextDelivery;
  const selectedNextDeliveryFormatted = selectedNextDeliveryDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

  const marginForecastEnd = new Date(selectedNextDeliveryDate);
  marginForecastEnd.setDate(selectedNextDeliveryDate.getDate() - 1);
  const marginWindowForecast = getForecastForWindow(marginForecastEnd, dailyCovers);

  const targetForecastEnd = new Date(selectedDeliveryDate);
  targetForecastEnd.setDate(selectedDeliveryDate.getDate() - 1);
  const targetWindowForecast = getForecastForWindow(targetForecastEnd, dailyCovers);
  const windowForecast = calculationMode === 'target' ? targetWindowForecast : marginWindowForecast;

  const getStockSplit = (stockVal: number | '' | undefined, packagingVal: number | '') => {
    const totalStock = Math.max(0, Math.floor(toNumber(stockVal)));
    const pkg = Math.max(1, Math.floor(toNumber(packagingVal) || 1));
    return {
      totalStock,
      pkg,
      stockCases: Math.floor(totalStock / pkg),
      stockPieces: totalStock % pkg,
    };
  };

  const getUpcomingDeliveryUnits = (upcomingVal: number | '' | undefined, packagingVal: number | '') => {
    const upcomingCases = Math.max(0, Math.floor(toNumber(upcomingVal)));
    const pkg = Math.max(1, Math.floor(toNumber(packagingVal) || 1));
    return upcomingCases * pkg;
  };

  const updateStockFromSplit = (productId: string, packagingVal: number | '', rawCases: string, rawPieces: string) => {
    if (rawCases === '' && rawPieces === '') {
      updateProductValue(productId, 'stock', '');
      return;
    }
    const pkg = Math.max(1, Math.floor(toNumber(packagingVal) || 1));
    const parsedCases = rawCases === '' ? 0 : Math.max(0, Math.floor(Number(rawCases) || 0));
    const parsedPieces = rawPieces === '' ? 0 : Math.max(0, Math.floor(Number(rawPieces) || 0));
    updateProductValue(productId, 'stock', String(parsedCases * pkg + parsedPieces));
  };

  const handleEnterKey = (event: React.KeyboardEvent<HTMLInputElement>, tabBase: number, rowIdx: number) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const next = document.querySelector<HTMLInputElement>(`[tabindex="${tabBase + rowIdx + 1}"]`);
    if (next) {
      next.focus();
      next.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };

  const getRowResult = (product: DisplayProduct, packagingValue: number | '') => {
    const { avgRatio } = getProductStats(product);
    const stockSafe = getStockSplit(product.stock, packagingValue).totalStock;
    const upcomingInUnit = getUpcomingDeliveryUnits(product.upcomingDelivery, packagingValue);
    const targetSafe = toNumber(product.targetStock);

    if (calculationMode === 'margin') {
      const dynamicTheo = Math.ceil(avgRatio * windowForecast.total);
      const currentMargin = orderStates[product.id]?.margin ?? 30;
      const result = calculateOrder(dynamicTheo, upcomingInUnit, stockSafe, currentMargin, packagingValue);
      return { toOrder: result.toOrder, info1: dynamicTheo, info2: null as number | null };
    }

    const estimatedConso = Math.ceil(avgRatio * windowForecast.total);
    const result = calculateTargetOrder(targetSafe, product.stock, estimatedConso, packagingValue);
    return { toOrder: result.toOrder, info1: estimatedConso, info2: result.missing };
  };

  const renderHeader = () => (
    <div className="mx-auto mb-4 max-w-[1600px]">
      <div className="rounded-2xl border border-white bg-white/90 p-3 shadow lg:rounded-[32px] lg:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="flex items-center justify-between gap-2 lg:block">
            <div className="mb-0 flex gap-2 lg:mb-2">
              <AppNavTile onClick={() => setView('home')} title="Accueil" aria-label="Accueil" icon="home" size="icon" className="h-10 w-10 lg:h-12 lg:w-12" />
              <AppNavTile onClick={() => setView('suppliers')} title="Fournisseurs" aria-label="Fournisseurs" icon="back" size="icon" className="h-10 w-10 lg:h-12 lg:w-12" />
            </div>
            <button onClick={() => setShowResetConfirm(true)} className="h-10 rounded-xl border border-red-100 bg-red-50 px-3 text-[10px] font-black uppercase text-red-600 lg:hidden">
              RAZ
            </button>
          </div>

          <div className="flex min-w-0 items-center gap-2 lg:mr-auto">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[#ffd700] shadow-lg lg:h-12 lg:w-12">
              <SupplierIcon view={view} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-base font-black uppercase leading-tight tracking-tighter text-slate-800 lg:text-3xl">{supplierLabel.name}</h1>
              <p className="truncate text-[9px] font-bold uppercase tracking-widest text-slate-400 lg:text-[10px]">{supplierLabel.subtitle}</p>
            </div>
          </div>

          <div className="flex rounded-xl border border-white/50 bg-[#FCEEB5] p-1 lg:rounded-2xl lg:p-1.5">
            <button onClick={() => setCalculationMode('margin')} className={`flex-1 rounded-lg px-3 py-2 text-[10px] font-black uppercase transition lg:px-6 lg:py-3 ${calculationMode === 'margin' ? 'bg-white text-orange-600 shadow' : 'text-slate-400'}`}>Mode Marge</button>
            <button onClick={() => setCalculationMode('target')} className={`flex-1 rounded-lg px-3 py-2 text-[10px] font-black uppercase transition lg:px-6 lg:py-3 ${calculationMode === 'target' ? 'bg-white text-blue-600 shadow' : 'text-slate-400'}`}>Mode Cible</button>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:flex lg:gap-4">
            <div className="relative rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-center lg:min-w-[140px] lg:px-6 lg:py-3">
              <span className="block text-[8px] font-black uppercase tracking-widest text-emerald-400 lg:text-[9px]">Livraison</span>
              <button onClick={() => { setActiveCalendarSupplier(prev => prev === currentSupplierId ? null : currentSupplierId); setActiveNextCalendar(false); }} className="mt-1 rounded-xl bg-white/70 px-2 py-1 text-xs font-black text-emerald-900 lg:text-sm">
                {capitalizeFirstLetter(selectedDeliveryFormatted)}
              </button>
              {activeCalendarSupplier === currentSupplierId && (
                <WindowsCalendar
                  selectedDate={selectedDeliveryDate}
                  minDate={minDelivery1}
                  onSelect={date => {
                    setDeliveryDateBySupplier(prev => ({ ...prev, [currentSupplierId]: date.toISOString() }));
                    setNextDeliveryDateBySupplier(prev => { const next = { ...prev }; delete next[currentSupplierId]; return next; });
                    setActiveCalendarSupplier(null);
                  }}
                  onClose={() => setActiveCalendarSupplier(null)}
                />
              )}
            </div>

            {calculationMode === 'margin' && (
              <div className="relative hidden rounded-2xl border border-amber-100 bg-amber-50/70 px-6 py-3 text-center lg:block lg:min-w-[140px]">
                <span className="block text-[9px] font-black uppercase tracking-widest text-amber-500">Livr. Suivante</span>
                <button onClick={() => { setActiveNextCalendar(v => !v); setActiveCalendarSupplier(null); }} className="mt-1 rounded-xl bg-white/70 px-2 py-1 text-sm font-black text-amber-900">
                  {capitalizeFirstLetter(selectedNextDeliveryFormatted)}
                </button>
                {activeNextCalendar && (
                  <WindowsCalendar
                    selectedDate={selectedNextDeliveryDate}
                    minDate={minDelivery2}
                    onSelect={date => { setNextDeliveryDateBySupplier(prev => ({ ...prev, [currentSupplierId]: date.toISOString() })); setActiveNextCalendar(false); }}
                    onClose={() => setActiveNextCalendar(false)}
                  />
                )}
              </div>
            )}

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-center lg:min-w-[120px] lg:px-6 lg:py-3">
              <span className="block text-[8px] font-black uppercase tracking-widest text-indigo-400 lg:text-[9px]">Couverts prévus</span>
              <span className="text-lg font-black leading-none text-indigo-900 lg:text-xl">{windowForecast.total}</span>
            </div>
          </div>

          <button onClick={() => setShowResetConfirm(true)} className="hidden rounded-2xl border border-red-100 bg-red-50 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-red-600 transition hover:bg-red-600 hover:text-white lg:block">
            RAZ
          </button>
        </div>
      </div>
    </div>
  );

  const renderMobileCards = () => (
    <div className="mx-auto max-w-[720px] space-y-3 pb-24 lg:hidden">
      {displayedProducts.map((product, rowIdx) => {
        const packaging = getLinkedPackagingForProduct(product);
        const split = getStockSplit(product.stock, packaging);
        const result = getRowResult(product, packaging);
        const unit = getCountingUnitForProduct(product);
        return (
          <div key={product.id} className="rounded-2xl border border-amber-100 bg-white p-3 shadow-lg shadow-slate-300/20">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-black leading-tight text-slate-800">{capitalizeFirstLetter(product.name)}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black uppercase text-amber-800">Unité : {unit}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-700">Colisage : {packaging || '-'}</span>
                  {calculationMode === 'margin' ? (
                    <span className="rounded-full bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-700">Besoin : {result.info1}</span>
                  ) : (
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">Conso : {result.info1}</span>
                  )}
                </div>
              </div>
              <div className={`flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-2xl text-white shadow ${result.toOrder > 0 ? calculationMode === 'margin' ? 'bg-orange-500' : 'bg-blue-600' : 'bg-slate-200 text-slate-400'}`}>
                <span className="text-[8px] font-black uppercase leading-none">À cmd</span>
                <span className="text-2xl font-black leading-tight">{result.toOrder}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="rounded-2xl bg-amber-50 p-2">
                <span className="mb-1 block text-[10px] font-black uppercase text-amber-700">U. colisage stock</span>
                <NumberInput value={product.stock === '' ? '' : split.stockCases} onChange={value => updateStockFromSplit(product.id, packaging, value, String(split.stockPieces))} tabIndex={200 + rowIdx} onKeyDown={event => handleEnterKey(event, 200, rowIdx)} tone="amber" />
              </label>
              <label className="rounded-2xl bg-amber-50 p-2">
                <span className="mb-1 block text-[10px] font-black uppercase text-amber-700">U. pièce stock</span>
                <NumberInput value={product.stock === '' ? '' : split.stockPieces} onChange={value => updateStockFromSplit(product.id, packaging, String(split.stockCases), value)} tabIndex={300 + rowIdx} onKeyDown={event => handleEnterKey(event, 300, rowIdx)} tone="amber" />
              </label>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-slate-500">
              <div className="rounded-xl bg-slate-50 px-2 py-2">Colisage<br /><span className="text-slate-800">{packaging || '-'}</span></div>
              <div className="rounded-xl bg-slate-50 px-2 py-2">Stock total<br /><span className="text-slate-800">{split.totalStock}</span></div>
              {calculationMode === 'target' && result.info2 !== null ? (
                <div className="rounded-xl bg-red-50 px-2 py-2 text-red-600">Manque<br /><span>{result.info2 > 0 ? `-${result.info2}` : '-'}</span></div>
              ) : (
                <div className="rounded-xl bg-slate-50 px-2 py-2">Mode<br /><span className="text-slate-800">{calculationMode === 'margin' ? 'Marge' : 'Cible'}</span></div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderDesktopTable = () => (
    <div className="mx-auto hidden max-w-[1600px] pb-24 lg:block">
      <div className="overflow-x-auto rounded-[32px] border border-slate-100 bg-white shadow-2xl shadow-slate-300/20">
        <table className="w-full" style={{ tableLayout: 'auto', minWidth: calculationMode === 'margin' ? '860px' : '940px' }}>
          <thead>
            <tr className="h-16 text-left">
              <th className="sticky left-0 z-20 bg-[#2c1810] px-6 text-xs font-black uppercase tracking-widest text-[#ffd700]">Produit</th>
              {calculationMode === 'margin' ? (<>
                <th className="bg-[#FDBA74] p-2 text-center text-[10px] font-black uppercase tracking-widest text-white">Besoin<br />Théo.</th>
                <th className="bg-emerald-600 p-2 text-center text-[10px] font-black uppercase tracking-widest text-white">Livr.<br />à venir</th>
                <th className="bg-amber-600 p-2 text-center text-[10px] font-black uppercase tracking-widest text-white">U. Colisage<br />en stock</th>
                <th className="bg-amber-500 p-2 text-center text-[10px] font-black uppercase tracking-widest text-white">U. Pièce<br />en stock</th>
                <th className="bg-[#F59E0B] p-2 text-center text-[10px] font-black uppercase tracking-widest text-white">Unité<br />comptage</th>
                <th className="bg-[#FDBA74] p-2 text-center text-[10px] font-black uppercase tracking-widest text-white">Colis.</th>
                <th className="bg-[#FDBA74] p-2 text-center text-[10px] font-black uppercase tracking-widest text-white">Marge<br />(%)</th>
              </>) : (<>
                <th className="bg-blue-600 p-2 text-center text-[10px] font-black uppercase tracking-widest text-white">Cible<br />(Unités)</th>
                <th className="bg-emerald-600 p-2 text-center text-[10px] font-black uppercase tracking-widest text-white">Livr.<br />à venir</th>
                <th className="bg-amber-600 p-2 text-center text-[10px] font-black uppercase tracking-widest text-white">U. Colisage<br />en stock</th>
                <th className="bg-amber-500 p-2 text-center text-[10px] font-black uppercase tracking-widest text-white">U. Pièce<br />en stock</th>
                <th className="bg-[#F59E0B] p-2 text-center text-[10px] font-black uppercase tracking-widest text-white">Unité<br />comptage</th>
                <th className="bg-[#FDBA74] p-2 text-center text-[10px] font-black uppercase tracking-widest text-white">Conso<br />Estimée</th>
                <th className="bg-[#FDBA74] p-2 text-center text-[10px] font-black uppercase tracking-widest text-white">Manque</th>
                <th className="bg-[#FDBA74] p-2 text-center text-[10px] font-black uppercase tracking-widest text-white">Colis.</th>
              </>)}
              <th className="sticky right-0 z-20 bg-slate-900 px-4 text-center text-xs font-black uppercase tracking-widest text-white">À Cmd.</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-slate-200">
            {displayedProducts.map((product, rowIdx) => {
              const packaging = getLinkedPackagingForProduct(product);
              const hasLinkedPackaging = hasLinkedPackagingForProduct(product);
              const split = getStockSplit(product.stock, packaging);
              const result = getRowResult(product, packaging);
              const unit = getCountingUnitForProduct(product);
              return (
                <tr key={product.id} className="transition hover:bg-amber-50/40">
                  <td className="sticky left-0 z-10 overflow-hidden border-r-2 border-slate-100 bg-white px-6 py-3 font-['Roboto_Slab'] text-sm font-bold text-slate-800"><span className="block truncate">{capitalizeFirstLetter(product.name)}</span></td>
                  {calculationMode === 'margin' ? (<>
                    <td className="bg-[#FFE8CC] p-2 text-center text-sm font-bold text-slate-700">{result.info1}</td>
                    <td className="bg-emerald-50/20 p-2"><NumberInput value={product.upcomingDelivery ?? ''} onChange={value => updateProductValue(product.id, 'upcomingDelivery', value)} tabIndex={100 + rowIdx} onKeyDown={event => handleEnterKey(event, 100, rowIdx)} tone="emerald" /></td>
                    <td className="bg-amber-50/20 p-2"><NumberInput value={product.stock === '' ? '' : split.stockCases} onChange={value => updateStockFromSplit(product.id, packaging, value, String(split.stockPieces))} tabIndex={200 + rowIdx} onKeyDown={event => handleEnterKey(event, 200, rowIdx)} tone="amber" /></td>
                    <td className="bg-amber-50/20 p-2"><NumberInput value={product.stock === '' ? '' : split.stockPieces} onChange={value => updateStockFromSplit(product.id, packaging, String(split.stockCases), value)} tabIndex={300 + rowIdx} onKeyDown={event => handleEnterKey(event, 300, rowIdx)} tone="amber" /></td>
                    <td className="bg-amber-50/20 p-2 text-center"><span className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-amber-200 bg-white px-1 text-xs font-black uppercase text-slate-700">{unit}</span></td>
                    <td className="bg-[#FFE8CC] p-2 text-center"><NumberInput value={packaging} disabled={commandeOnly || hasLinkedPackaging} onChange={value => updateProductValue(product.id, 'packaging', value)} /></td>
                    <td className="bg-[#FFE8CC] p-2 text-center"><select value={orderStates[product.id]?.margin ?? 30} disabled={commandeOnly} onChange={event => setOrderStates(prev => ({ ...prev, [product.id]: { ...prev[product.id], margin: Number(event.target.value) } }))} className={`rounded-lg border border-slate-300 px-1 py-1 text-xs font-bold shadow-sm ${commandeOnly ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-white/80 text-slate-700'}`}>{[0,5,10,15,20,25,30,35,40,45,50].map(value => <option key={value} value={value}>{value}%</option>)}</select></td>
                  </>) : (<>
                    <td className="bg-blue-50/20 p-2"><NumberInput value={product.targetStock ?? ''} disabled={commandeOnly} onChange={value => updateProductValue(product.id, 'targetStock', value)} tone="blue" /></td>
                    <td className="bg-emerald-50/20 p-2"><NumberInput value={product.upcomingDelivery ?? ''} onChange={value => updateProductValue(product.id, 'upcomingDelivery', value)} tabIndex={100 + rowIdx} onKeyDown={event => handleEnterKey(event, 100, rowIdx)} tone="emerald" /></td>
                    <td className="bg-amber-50/20 p-2"><NumberInput value={product.stock === '' ? '' : split.stockCases} onChange={value => updateStockFromSplit(product.id, packaging, value, String(split.stockPieces))} tabIndex={200 + rowIdx} onKeyDown={event => handleEnterKey(event, 200, rowIdx)} tone="amber" /></td>
                    <td className="bg-amber-50/20 p-2"><NumberInput value={product.stock === '' ? '' : split.stockPieces} onChange={value => updateStockFromSplit(product.id, packaging, String(split.stockCases), value)} tabIndex={300 + rowIdx} onKeyDown={event => handleEnterKey(event, 300, rowIdx)} tone="amber" /></td>
                    <td className="bg-amber-50/20 p-2 text-center"><span className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-amber-200 bg-white px-1 text-xs font-black uppercase text-slate-700">{unit}</span></td>
                    <td className="bg-[#FFE8CC] p-2 text-center text-sm font-bold text-slate-600">{result.info1}</td>
                    <td className="bg-[#FFE8CC] p-2 text-center">{result.info2 !== null && result.info2 > 0 ? <span className="rounded border border-red-200 bg-white/50 px-1.5 py-0.5 text-xs font-black text-red-600">-{result.info2}</span> : <span className="text-sm text-slate-400">-</span>}</td>
                    <td className="bg-[#FFE8CC] p-2 text-center"><NumberInput value={packaging} disabled={commandeOnly || hasLinkedPackaging} onChange={value => updateProductValue(product.id, 'packaging', value)} /></td>
                  </>)}
                  <td className="sticky right-0 z-10 border-l-2 border-slate-200 bg-white p-2 text-center"><div className={`inline-flex h-10 w-14 items-center justify-center rounded-xl text-lg font-black shadow-sm ${result.toOrder > 0 ? calculationMode === 'margin' ? 'scale-110 bg-orange-500 text-white shadow-orange-200' : 'scale-110 bg-blue-600 text-white shadow-blue-200' : 'scale-90 bg-slate-100 text-slate-300 opacity-50'}`}>{result.toOrder}</div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen bg-[#FCEEB5] p-3 font-sans text-xs md:p-8">
      {showResetConfirm && <ResetConfirmModal onConfirm={performReset} onClose={() => setShowResetConfirm(false)} />}
      {renderHeader()}
      {renderMobileCards()}
      {renderDesktopTable()}
    </div>
  );
};

export default SupplierOrderPage;
