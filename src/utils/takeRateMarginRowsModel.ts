import { normalizeTakeRateKey } from './takeRateResultsModel';

export type TakeRateMarginCatalogSource = {
  label: string;
  normalized: string;
  costHt: number | null;
  sellPriceHt: number | null;
  marginPercent: number | null;
  marginEuro: number | null;
  sourceSheet: string;
  section: string;
};

export type TakeRateMarginMappingRow = {
  id: string;
  label: string;
  family: string;
  linkedImports: string[];
  costHt?: string;
  sellPriceHt?: string;
  marginPercent?: string;
  marginEuro?: string;
  marginSource?: 'auto' | 'manual' | '';
  matchedMarginLabel?: string;
  matchedMarginSheet?: string;
};

const formatDecimal = (value: number | null): string =>
  value === null || !Number.isFinite(value) ? '' : value.toFixed(2).replace('.', ',');

const formatPercent = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) return '';
  const ratio = value <= 1 ? value * 100 : value;
  return ratio.toFixed(1).replace('.', ',');
};

const getExistingRowKey = (row: TakeRateMarginMappingRow): string =>
  normalizeTakeRateKey(row.matchedMarginLabel || row.label);

// Un réimport marge actualise les valeurs du catalogue, mais conserve les
// liaisons de ventes déjà vérifiées pour le même produit normalisé.
export const buildTakeRateRowsFromMarginCatalog = <Row extends TakeRateMarginMappingRow>(
  catalog: TakeRateMarginCatalogSource[],
  existingRows: Row[],
): TakeRateMarginMappingRow[] => {
  const existingByKey = new Map<string, Row[]>();
  existingRows.forEach(row => {
    const key = getExistingRowKey(row);
    if (!key) return;
    const bucket = existingByKey.get(key) ?? [];
    bucket.push(row);
    existingByKey.set(key, bucket);
  });

  return catalog.map((item, index) => {
    // `item.normalized` contient historiquement le numéro de ligne du classeur.
    // Seul le libellé métier peut donc servir de clé stable entre deux imports.
    const key = normalizeTakeRateKey(item.label);
    const existingBucket = existingByKey.get(key);
    const existing = existingBucket?.shift();

    return {
      id: existing?.id || `margin-${index + 1}-${key}`,
      label: item.label,
      family: item.section,
      linkedImports: existing?.linkedImports.map(String) ?? [],
      costHt: formatDecimal(item.costHt),
      sellPriceHt: formatDecimal(item.sellPriceHt),
      marginPercent: formatPercent(item.marginPercent),
      marginEuro: formatDecimal(item.marginEuro),
      marginSource: 'auto',
      matchedMarginLabel: item.label,
      matchedMarginSheet: item.sourceSheet,
    };
  });
};
