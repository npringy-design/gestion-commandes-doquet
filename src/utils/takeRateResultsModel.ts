export type TakeRateSortKey = 'takeRate' | 'sales' | 'marginTotal';

export type TakeRateResultSourceRow = {
  id: string;
  label: string;
  family: string;
  linkedImports: string[];
  costHt?: unknown;
  sellPriceHt?: unknown;
  marginEuro?: unknown;
  marginPercent?: unknown;
};

export const normalizeTakeRateKey = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const parseTakeRateNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? '').replace(/\s/g, '').replace(',', '.');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

type BuildTakeRateResultRowsParams<Row extends TakeRateResultSourceRow> = {
  rows: Row[];
  salesByImport: ReadonlyMap<string, number>;
  monthCovers: number;
  familyFilter: string;
  search: string;
  sortBy: TakeRateSortKey;
};

export const buildTakeRateResultRows = <Row extends TakeRateResultSourceRow>({
  rows,
  salesByImport,
  monthCovers,
  familyFilter,
  search,
  sortBy,
}: BuildTakeRateResultRowsParams<Row>) => {
  const query = normalizeTakeRateKey(search);

  return rows
    .filter(row => row.label.trim().length > 0 && row.linkedImports.length > 0)
    .map(row => {
      const sales = row.linkedImports.reduce(
        (sum, item) => sum + (salesByImport.get(normalizeTakeRateKey(item)) ?? 0),
        0,
      );
      const takeRate = monthCovers > 0 ? (sales / monthCovers) * 100 : 0;
      const costHt = parseTakeRateNumber(row.costHt);
      const sellPriceHt = parseTakeRateNumber(row.sellPriceHt);
      const storedMarginEuro = parseTakeRateNumber(row.marginEuro);
      const marginPercent = parseTakeRateNumber(row.marginPercent);
      const marginEuro = storedMarginEuro > 0
        ? storedMarginEuro
        : sellPriceHt * (marginPercent / 100);

      return {
        ...row,
        sales,
        takeRate,
        costHt,
        sellPriceHt,
        marginEuro,
        marginPercent,
        marginTotal: sales * marginEuro,
        caTheo: sales * sellPriceHt,
      };
    })
    .filter(row => familyFilter === 'all' || row.family === familyFilter)
    .filter(row => !query
      || normalizeTakeRateKey(row.label).includes(query)
      || normalizeTakeRateKey(row.family).includes(query))
    .sort((a, b) => {
      if (sortBy === 'sales') return b.sales - a.sales || a.label.localeCompare(b.label, 'fr');
      if (sortBy === 'marginTotal') {
        return b.marginTotal - a.marginTotal || a.label.localeCompare(b.label, 'fr');
      }
      return b.takeRate - a.takeRate || b.sales - a.sales || a.label.localeCompare(b.label, 'fr');
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));
};

export const getMaxTakeRate = (rows: Array<{ takeRate: number }>): number =>
  rows.reduce((maximum, row) => Math.max(maximum, row.takeRate), 0);
