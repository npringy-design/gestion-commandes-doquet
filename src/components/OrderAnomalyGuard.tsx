import React from 'react';
import { createPortal } from 'react-dom';
import { RESERVED_VIEWS } from '../constants';
import type { AppState } from '../hooks/useAppState';
import { getDeliveryDates, getForecastForWindow } from '../utils/dateHelpers';
import { calculateOrder, calculateTargetOrder, toNumber } from '../utils/calculations';
import {
  buildOrderProductNameCounts,
  getOrderAnomalies,
  normalizeOrderProductName,
  resolveOrderRatioLinkStatus,
  type OrderAnomaly,
} from '../utils/orderAnomalies';

const ORDER_HEADER_MARKER = 'À Cmd';

const isOrderTable = (table: HTMLTableElement): boolean =>
  Array.from(table.querySelectorAll('th')).some(header =>
    (header.textContent ?? '').replace(/\s+/g, ' ').includes(ORDER_HEADER_MARKER)
  );

const findOrderProductCells = (): HTMLElement[] => {
  const table = Array.from(document.querySelectorAll<HTMLTableElement>('table')).find(isOrderTable);
  if (!table) return [];

  return Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody tr'))
    .map(row => row.querySelector<HTMLElement>('td'))
    .filter((cell): cell is HTMLElement => Boolean(cell));
};

const sameElements = (left: HTMLElement[], right: HTMLElement[]): boolean =>
  left.length === right.length && left.every((element, index) => element === right[index]);

type ProductWithRatioSnapshots = {
  ratioSnapshots?: Record<string, { isLinked?: boolean }>;
};

interface OrderAnomalyIndicatorProps {
  productName: string;
  anomalies: OrderAnomaly[];
}

const OrderAnomalyIndicator: React.FC<OrderAnomalyIndicatorProps> = ({ productName, anomalies }) => {
  const [open, setOpen] = React.useState(false);
  const summary = anomalies.map(anomaly => anomaly.message).join('\n');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={summary}
        aria-label={`${anomalies.length} alerte${anomalies.length > 1 ? 's' : ''} pour ${productName}`}
        className="absolute right-1 top-1 z-20 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-50 text-amber-600 shadow-sm ring-1 ring-amber-300 transition hover:scale-110 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M10.29 3.86c.76-1.35 2.66-1.35 3.42 0l8.03 14.27C22.48 19.45 21.53 21 20.03 21H3.97c-1.5 0-2.45-1.55-1.71-2.87l8.03-14.27zM12 8a1 1 0 011 1v4a1 1 0 11-2 0V9a1 1 0 011-1zm0 9a1.25 1.25 0 100-2.5A1.25 1.25 0 0012 17z" clipRule="evenodd" />
        </svg>
        {anomalies.length > 1 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-black leading-none text-white">
            {anomalies.length}
          </span>
        )}
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/45 p-3 sm:items-center sm:p-6"
          role="presentation"
          onMouseDown={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Alertes pour ${productName}`}
            onMouseDown={event => event.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-amber-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10.29 3.86c.76-1.35 2.66-1.35 3.42 0l8.03 14.27C22.48 19.45 21.53 21 20.03 21H3.97c-1.5 0-2.45-1.55-1.71-2.87l8.03-14.27zM12 8a1 1 0 011 1v4a1 1 0 11-2 0V9a1 1 0 011-1zm0 9a1.25 1.25 0 100-2.5A1.25 1.25 0 0012 17z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">
                  Vérification conseillée
                </div>
                <h2 className="mt-1 break-words text-lg font-black text-slate-900">{productName}</h2>
              </div>
            </div>

            <ul className="mt-4 space-y-2">
              {anomalies.map((anomaly, index) => (
                <li key={`${anomaly.code}-${index}`} className="flex gap-2 rounded-2xl bg-amber-50 px-3 py-2.5 text-sm font-semibold leading-snug text-slate-700">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                  <span>{anomaly.message}</span>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-xs font-medium leading-relaxed text-slate-500">
              Cette alerte est informative. Elle ne bloque pas la saisie ni la quantité proposée.
            </p>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-5 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black uppercase tracking-wider text-white transition hover:bg-slate-700"
            >
              Fermer
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

interface OrderAnomalyGuardProps {
  state: AppState;
}

const OrderAnomalyGuard: React.FC<OrderAnomalyGuardProps> = ({ state }) => {
  const [productCells, setProductCells] = React.useState<HTMLElement[]>([]);
  const supplierId = state.view;
  const isSupplierView = !RESERVED_VIEWS.has(supplierId as never);
  const displayedProducts = React.useMemo(
    () => isSupplierView ? state.products.filter(product => product.supplierId === supplierId) : [],
    [isSupplierView, state.products, supplierId]
  );
  const productIdsKey = displayedProducts.map(product => product.id).join('|');

  React.useLayoutEffect(() => {
    let frameId: number | null = null;

    const refreshCells = () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        frameId = null;
        const nextCells = isSupplierView ? findOrderProductCells() : [];
        setProductCells(previous => sameElements(previous, nextCells) ? previous : nextCells);
      });
    };

    const observer = new MutationObserver(refreshCells);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', refreshCells);
    refreshCells();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', refreshCells);
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, [isSupplierView, productIdsKey, supplierId]);

  const anomaliesByProductId = React.useMemo(() => {
    const result = new Map<string, OrderAnomaly[]>();
    if (!isSupplierView || displayedProducts.length === 0) return result;

    const currentConfig = state.supplierConfigs[supplierId];
    if (!currentConfig) return result;

    const dates = getDeliveryDates(currentConfig);
    const minDelivery = new Date(dates.delivery);
    minDelivery.setHours(0, 0, 0, 0);

    const deliveryOverride = state.deliveryDateBySupplier[supplierId];
    const rawDelivery = deliveryOverride ? new Date(deliveryOverride) : dates.delivery;
    const selectedDelivery = rawDelivery < minDelivery ? dates.delivery : rawDelivery;

    const nextDeliveryOverride = state.nextDeliveryDateBySupplier[supplierId];
    const fallbackNextDelivery = dates.delivery2 ?? (() => {
      const fallback = new Date(selectedDelivery);
      fallback.setDate(fallback.getDate() + 7);
      return fallback;
    })();
    const rawNextDelivery = nextDeliveryOverride ? new Date(nextDeliveryOverride) : fallbackNextDelivery;
    const selectedNextDelivery = rawNextDelivery <= selectedDelivery ? fallbackNextDelivery : rawNextDelivery;

    const forecastEnd = new Date(
      state.calculationMode === 'target' ? selectedDelivery : selectedNextDelivery
    );
    forecastEnd.setDate(forecastEnd.getDate() - 1);
    const forecastTotal = getForecastForWindow(forecastEnd, state.dailyCovers).total;
    const duplicateNameCounts = buildOrderProductNameCounts(displayedProducts);
    const hasCurrentImportSource = Boolean(state.detailedInventory[state.importTargetMonth]);

    displayedProducts.forEach(product => {
      const stats = state.getProductStats(product);
      const avgRatio = stats.avgRatio;
      const currentMonthStats = stats.mS[state.importTargetMonth];
      const currentImportMatched = Boolean(currentMonthStats?.isImported);
      const ratioSnapshots = (product as ProductWithRatioSnapshots).ratioSnapshots ?? {};
      const ratioLinkStatus = resolveOrderRatioLinkStatus({
        currentMonthValidated: Boolean(currentMonthStats?.isValidated),
        currentSnapshotLinked: ratioSnapshots[state.importTargetMonth]?.isLinked,
        hasCurrentImportSource,
        currentImportMatched,
        historicalSnapshotLinks: Object.values(ratioSnapshots).map(snapshot => snapshot?.isLinked),
      });
      const packaging = Math.max(1, Math.floor(toNumber(product.packaging) || 1));
      const stock = Math.max(0, Math.floor(toNumber(product.stock)));
      const upcomingUnits = Math.max(0, Math.floor(toNumber(product.upcomingDelivery))) * packaging;
      const estimatedNeed = Math.ceil(avgRatio * forecastTotal);
      let toOrder = 0;

      if (state.calculationMode === 'margin') {
        const margin = state.orderLineStates[product.id]?.margin ?? 30;
        toOrder = calculateOrder(
          estimatedNeed,
          upcomingUnits,
          stock,
          margin,
          product.packaging
        ).toOrder;
      } else {
        toOrder = calculateTargetOrder(
          toNumber(product.targetStock),
          product.stock,
          estimatedNeed,
          product.packaging
        ).toOrder;
      }

      const normalizedName = normalizeOrderProductName(product.name);
      const anomalies = getOrderAnomalies({
        product,
        calculationMode: state.calculationMode,
        averageRatio: avgRatio,
        forecastTotal,
        toOrder,
        duplicateNameCount: normalizedName ? duplicateNameCounts.get(normalizedName) ?? 1 : 1,
        ratioLinkStatus,
      });

      if (anomalies.length > 0) result.set(product.id, anomalies);
    });

    return result;
  }, [
    displayedProducts,
    isSupplierView,
    state.calculationMode,
    state.dailyCovers,
    state.deliveryDateBySupplier,
    state.detailedInventory,
    state.getProductStats,
    state.importTargetMonth,
    state.nextDeliveryDateBySupplier,
    state.orderLineStates,
    state.supplierConfigs,
    supplierId,
  ]);

  if (!isSupplierView || displayedProducts.length === 0) return null;

  return (
    <>
      {displayedProducts.map((product, index) => {
        const cell = productCells[index];
        const anomalies = anomaliesByProductId.get(product.id);
        if (!cell || !anomalies?.length) return null;

        return createPortal(
          <OrderAnomalyIndicator productName={product.name || 'Article sans nom'} anomalies={anomalies} />,
          cell,
          `order-anomaly-${product.id}`
        );
      })}
    </>
  );
};

export default OrderAnomalyGuard;