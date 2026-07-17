import { normalizeTakeRateKey } from './takeRateResultsModel';

export type TakeRateMappingStatus = 'ok' | 'review';

type TakeRateLinkSourceRow = {
  label: string;
  family: string;
  linkedImports: string[];
};

type TakeRateImportCandidate = {
  label: string;
};

const GENERIC_MATCH_TOKENS = new Set([
  'le', 'la', 'les', 'de', 'des', 'du', 'a', 'au', 'aux', 'avec', 'sans', 'menu', 'formule',
]);

const strongTokens = (value: string): string[] => {
  const tokens = normalizeTakeRateKey(value).split(' ').filter(Boolean);
  const strong = tokens.filter(token => !GENERIC_MATCH_TOKENS.has(token));
  return strong.length > 0 ? strong : tokens;
};

export const scoreTakeRateImportMatch = (productLabel: string, importLabel: string): number => {
  const product = normalizeTakeRateKey(productLabel);
  const imported = normalizeTakeRateKey(importLabel);
  if (!product || !imported) return -1;
  if (product === imported) return 1000;

  const productTokens = strongTokens(productLabel);
  const importTokens = strongTokens(importLabel);
  const intersection = productTokens.filter(token => importTokens.includes(token));
  if (intersection.length === 0) return -1;
  if (!productTokens.every(token => importTokens.includes(token))) return -1;

  const coverage = intersection.length / Math.max(productTokens.length, 1);
  const substringBonus = imported.includes(product) ? 70 : 0;
  return coverage * 160
    + intersection.length * 25
    + substringBonus
    - Math.max(importTokens.length - productTokens.length, 0) * 12;
};

export const applyAutomaticTakeRateLinks = <Row extends TakeRateLinkSourceRow>(
  rows: Row[],
  imports: TakeRateImportCandidate[],
  minimumScore = 155,
): { rows: Row[]; changed: boolean } => {
  let changed = false;
  const linkedRows = rows.map(row => {
    if (row.linkedImports.length > 0 || !row.label.trim()) return row;

    let best: { label: string; score: number } | null = null;
    imports.forEach(item => {
      const score = scoreTakeRateImportMatch(row.label, item.label);
      if (!best || score > best.score) best = { label: item.label, score };
    });
    if (!best || best.score < minimumScore) return row;

    changed = true;
    return { ...row, linkedImports: [best.label] };
  });

  return { rows: linkedRows, changed };
};

export const getTakeRateLinkedSales = (
  row: Pick<TakeRateLinkSourceRow, 'linkedImports'>,
  salesByImport: Record<string, number>,
): number => row.linkedImports.reduce(
  (sum, label) => sum + (salesByImport[normalizeTakeRateKey(label)] ?? 0),
  0,
);

export const getTakeRateMappingStatus = (
  row: TakeRateLinkSourceRow,
  salesByImport: Record<string, number>,
): TakeRateMappingStatus => {
  if (!row.label.trim() || !row.family.trim()) return 'review';
  if (row.linkedImports.length === 0) return 'review';
  if (getTakeRateLinkedSales(row, salesByImport) <= 0) return 'review';
  return 'ok';
};
