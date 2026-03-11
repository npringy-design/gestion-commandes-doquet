import { MONTHS } from '../constants';
import type {
  CostChartPoint,
  DailyRow,
  DailySheet,
  EcartItem,
  FollowUpItem,
  MonthKey,
  PeriodKey,
  ProductSeriesPoint,
  ProductType,
} from '../types';
import { cleanLabel, determineType } from './ecartImport';

export const DEFAULT_TARGET_PERCENT = 25.5;

export const getTodayKey = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const buildAnnualItems = (ecartByMonth: Record<MonthKey, EcartItem[]>) => {
  const agg = new Map<string, EcartItem>();
  for (const m of MONTHS) {
    const items = ecartByMonth[m] ?? [];
    for (const it of items) {
      if (!it.id) continue;
      const prev = agg.get(it.id);
      if (!prev) {
        agg.set(it.id, { ...it });
      } else {
        agg.set(it.id, {
          ...prev,
          quantity: (prev.quantity ?? 0) + (it.quantity ?? 0),
          value: (prev.value ?? 0) + (it.value ?? 0),
        });
      }
    }
  }
  return Array.from(agg.values());
};

export const getWeightedCostForPeriod = (
  isAnnual: boolean,
  selectedMonth: PeriodKey,
  costByMonthFromParams?: Record<string, number | null>,
  salesByMonthFromParams?: Record<string, number | null>,
) => {
  const cmMap = costByMonthFromParams ?? {};
  if (!isAnnual) return cmMap[selectedMonth as MonthKey] ?? null;

  const rows = MONTHS.map((m) => ({
    cm: cmMap[m] ?? null,
    ca: (salesByMonthFromParams ?? {})[m] ?? null,
  })).filter((row) => row.cm != null);

  if (!rows.length) return null;

  const weighted = rows.filter((row) => (row.ca ?? 0) > 0);
  if (weighted.length) {
    const sumCa = weighted.reduce((acc, row) => acc + (row.ca as number), 0);
    const sumWeighted = weighted.reduce((acc, row) => acc + ((row.cm as number) * (row.ca as number)), 0);
    return sumCa > 0 ? sumWeighted / sumCa : null;
  }

  return rows.reduce((acc, row) => acc + (row.cm as number), 0) / rows.length;
};

export const getSummedMetricForPeriod = (
  isAnnual: boolean,
  selectedMonth: PeriodKey,
  values?: Record<string, number | null>,
) => {
  const source = values ?? {};
  if (!isAnnual) return source[selectedMonth as MonthKey] ?? null;
  return MONTHS.reduce((acc, month) => acc + (source[month] ?? 0), 0) || null;
};

export const createExcludedSectorMatcher = () => {
  const excludedSectorPrefixes = [
    cleanLabel('Réserve consommable vente'),
    cleanLabel('Réserve Bar'),
    cleanLabel('Réserve Libre'),
  ];

  return (sector?: string | null) => {
    if (!sector) return false;
    const normalized = cleanLabel(sector);
    return excludedSectorPrefixes.some((prefix) => normalized === prefix || normalized.startsWith(prefix));
  };
};

export const buildCostChartData = (
  costByMonthFromParams?: Record<string, number | null>,
  targetPercent = DEFAULT_TARGET_PERCENT,
): CostChartPoint[] => {
  const cmMap = costByMonthFromParams ?? {};
  return MONTHS.map((month) => ({
    month: month.slice(0, 3),
    actual: cmMap[month] ?? 0,
    target: targetPercent,
  }));
};

export const withResolvedType = (
  items: EcartItem[],
  isExcluded: (sector?: string | null) => boolean,
): Array<EcartItem & { _type: ProductType }> => {
  return items
    .filter((item) => !isExcluded(item.sector))
    .map((item) => {
      const id = (item.id ?? '').toString();
      const resolvedType = item.type ?? determineType({ sector: item.sector, supplier: item.supplier, cleanName: id }).type;
      return { ...item, id, _type: resolvedType };
    });
};

export const getTopEcartsByType = (
  items: Array<EcartItem & { _type: ProductType }>,
  type: ProductType,
  limit = 10,
) => {
  return items
    .filter((item) => item._type === type)
    .slice()
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, limit);
};

export const collectProducts = (ecartByMonth: Record<MonthKey, EcartItem[]>) => {
  const products = new Map<string, string>();
  for (const month of MONTHS) {
    const items = ecartByMonth[month] ?? [];
    for (const item of items) {
      if (!item.id) continue;
      if (!products.has(item.id)) products.set(item.id, item.name);
    }
  }

  return Array.from(products.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
};

export const buildTrendData = (
  productId: string | null | undefined,
  ecartByMonth: Record<MonthKey, EcartItem[]>,
): ProductSeriesPoint[] => {
  if (!productId) {
    return MONTHS.map((month) => ({ month: month.slice(0, 3), euro: 0, qty: 0 }));
  }

  return MONTHS.map((month) => {
    const hit = (ecartByMonth[month] ?? []).find((item) => item.id === productId);
    return {
      month: month.slice(0, 3),
      euro: hit?.value ?? 0,
      qty: hit?.quantity ?? 0,
    };
  });
};

export const getUnitPriceForProduct = (
  productId: string,
  isAnnual: boolean,
  selectedMonth: PeriodKey,
  ecartByMonth: Record<MonthKey, EcartItem[]>,
) => {
  if (!productId) return null;

  const candidates: (EcartItem | undefined)[] = [];
  if (!isAnnual) {
    candidates.push((ecartByMonth[selectedMonth as MonthKey] ?? []).find((item) => item.id === productId));
  }

  for (const month of MONTHS) {
    candidates.push((ecartByMonth[month] ?? []).find((item) => item.id === productId));
  }

  for (const candidate of candidates) {
    const unitPrice = candidate?.unitPrice;
    if (unitPrice != null && Number.isFinite(unitPrice) && unitPrice !== 0) return unitPrice;
  }

  return null;
};

export const ensureDailySheet = (
  currentDailySheet: DailySheet | null,
  dailyDateKey: string,
  currentPeriod: PeriodKey,
  upsertDailySheet: (sheet: DailySheet) => void,
) => {
  if (currentDailySheet) return currentDailySheet;
  const now = new Date().toISOString();
  const sheet: DailySheet = {
    dateKey: dailyDateKey,
    period: currentPeriod,
    rows: [],
    createdAt: now,
    updatedAt: now,
  };
  upsertDailySheet(sheet);
  return sheet;
};

export const buildFollowUpsFromTop10 = (
  currentPeriod: PeriodKey,
  followUps: FollowUpItem[],
  topLiquides: Array<EcartItem & { _type: ProductType }>,
  topSolides: Array<EcartItem & { _type: ProductType }>,
): FollowUpItem[] => {
  const now = new Date().toISOString();
  const existingIds = new Set(followUps.filter((item) => item.period === currentPeriod).map((item) => item.id));

  return [...topLiquides, ...topSolides]
    .filter((item) => !!item.id)
    .filter((item) => !existingIds.has(item.id))
    .map((item) => ({
      id: item.id,
      name: item.name,
      type: item._type,
      sector: item.sector,
      supplier: item.supplier,
      status: 'À faire',
      notes: '',
      createdAt: now,
      period: currentPeriod,
    }));
};

export const buildDailyRowsFromTop10 = (
  baseSheet: DailySheet,
  topLiquides: Array<EcartItem & { _type: ProductType }>,
  topSolides: Array<EcartItem & { _type: ProductType }>,
  resolveUnitPrice: (productId: string) => number | null,
): DailyRow[] => {
  const existingRows = new Map(baseSheet.rows.map((row) => [row.id, row]));
  const mergedItems = [...topLiquides, ...topSolides].filter((item) => !!item.id);

  return mergedItems.map((item) => {
    const previous = existingRows.get(item.id);
    return {
      id: item.id,
      name: item.name,
      type: item._type,
      sector: item.sector,
      supplier: item.supplier,
      unitPrice: previous?.unitPrice ?? resolveUnitPrice(item.id),
      stockPrev: previous?.stockPrev ?? null,
      salesPrev: previous?.salesPrev ?? null,
      stockToday: previous?.stockToday ?? null,
      perso: previous?.perso ?? null,
      loss: previous?.loss ?? null,
    };
  });
};
