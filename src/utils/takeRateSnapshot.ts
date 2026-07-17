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
