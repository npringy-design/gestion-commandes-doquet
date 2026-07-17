import Papa from 'papaparse';
import { normalizeTakeRateKey, parseTakeRateNumber } from './takeRateResultsModel';

export type TakeRateImportRow = {
  label: string;
  normalized: string;
  quantity: number;
};

const NAME_HEADERS = ['libelle', 'designation', 'produit', 'article', 'nom'];
const QUANTITY_HEADERS = ['nombre', 'nb'];

const pickImportColumn = (headers: string[], preferred: string[]): number => {
  for (const name of preferred) {
    const exactIndex = headers.findIndex(cell => cell === name);
    if (exactIndex !== -1) return exactIndex;
  }
  for (const name of preferred) {
    const includesIndex = headers.findIndex(cell => cell.includes(name));
    if (includesIndex !== -1) return includesIndex;
  }
  return -1;
};

// Source unique pour les deux pages du taux de prise. PapaParse prend en charge
// les séparateurs CSV usuels ainsi que les champs entre guillemets et multilignes.
export const buildTakeRateImportRows = (content: string): TakeRateImportRow[] => {
  if (!content?.trim()) return [];

  const parsed = Papa.parse<string[]>(content, { skipEmptyLines: 'greedy' });
  const data = parsed.data.filter(row => Array.isArray(row) && row.some(cell => String(cell ?? '').trim()));
  if (data.length === 0) return [];

  const headers = data[0].map(normalizeTakeRateKey);
  const nameIndex = pickImportColumn(headers, NAME_HEADERS);
  const quantityIndex = pickImportColumn(headers, QUANTITY_HEADERS);
  if (nameIndex === -1 || quantityIndex === -1) return [];

  const byLabel = new Map<string, TakeRateImportRow>();
  data.slice(1).forEach(columns => {
    const label = String(columns[nameIndex] ?? '').trim();
    const normalized = normalizeTakeRateKey(label);
    if (!label || !normalized) return;

    const quantity = parseTakeRateNumber(columns[quantityIndex]);
    const existing = byLabel.get(normalized);
    if (existing) {
      existing.quantity += quantity;
      return;
    }
    byLabel.set(normalized, { label, normalized, quantity });
  });

  return Array.from(byLabel.values()).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
};

export const buildTakeRateSalesObject = (
  rows: Array<Pick<TakeRateImportRow, 'normalized' | 'quantity'>>,
): Record<string, number> => Object.fromEntries(rows.map(row => [row.normalized, row.quantity]));

export const buildTakeRateSalesMap = (content: string): Map<string, number> =>
  new Map(buildTakeRateImportRows(content).map(row => [row.normalized, row.quantity]));
