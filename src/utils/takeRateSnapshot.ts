const toFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number'
    ? value
    : Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

// Les nouveaux mois figés conservent leur nombre de couverts. Les anciens
// snapshots, qui ne possèdent pas encore cette propriété, restent lisibles en
// utilisant la valeur courante comme filet de compatibilité.
export const resolveTakeRateMonthCovers = (
  snapshotCovers: unknown,
  liveCovers: unknown,
): number => toFiniteNumber(snapshotCovers) ?? toFiniteNumber(liveCovers) ?? 0;

type SnapshotRow = object & { linkedImports?: unknown };

type CreateTakeRateMonthSnapshotParams<Row extends SnapshotRow, Margin extends object> = {
  rows: Row[];
  marginCatalog: Margin[];
  marginFileName: string;
  salesByImport: Record<string, number>;
  covers: unknown;
  frozenAt?: string;
};

// Le snapshot reçoit ses propres tableaux et objets : une modification
// ultérieure de la base ouverte ne peut pas changer un mois déjà figé.
export const createTakeRateMonthSnapshot = <Row extends SnapshotRow, Margin extends object>({
  rows,
  marginCatalog,
  marginFileName,
  salesByImport,
  covers,
  frozenAt = new Date().toISOString(),
}: CreateTakeRateMonthSnapshotParams<Row, Margin>) => ({
  rows: rows.map(row => ({
    ...row,
    ...(Array.isArray(row.linkedImports) ? { linkedImports: [...row.linkedImports] } : {}),
  })) as Row[],
  marginCatalog: marginCatalog.map(item => ({ ...item })) as Margin[],
  marginFileName: String(marginFileName ?? ''),
  salesByImport: { ...salesByImport },
  covers: resolveTakeRateMonthCovers(undefined, covers),
  frozenAt,
});

export const setFrozenTakeRateMonth = <Snapshot>(
  frozenMonths: Record<string, Snapshot>,
  monthKey: string,
  snapshot: Snapshot,
): Record<string, Snapshot> => ({ ...frozenMonths, [monthKey]: snapshot });

export const removeFrozenTakeRateMonth = <Snapshot>(
  frozenMonths: Record<string, Snapshot>,
  monthKey: string,
): Record<string, Snapshot> => {
  const next = { ...frozenMonths };
  delete next[monthKey];
  return next;
};
