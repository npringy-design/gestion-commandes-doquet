export const TAKE_RATE_BASE_ROWS_CLOUD_KEY = 'takeRateBaseRows';
export const TAKE_RATE_MARGIN_CATALOG_CLOUD_KEY = 'takeRateMarginCatalog';
export const TAKE_RATE_MARGIN_FILE_NAME_CLOUD_KEY = 'takeRateMarginFileName';
export const TAKE_RATE_FROZEN_CLOUD_KEY = 'takeRateFrozenMonths';

type TakeRateCloudEntry = {
  key?: unknown;
  value?: unknown;
  updated_at?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const isTakeRateMarginBaseRow = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  return Boolean(
    value.matchedMarginLabel
      || value.matchedMarginSheet
      || value.marginSource
      || value.costHt
      || value.sellPriceHt
      || value.marginEuro
      || value.marginPercent,
  );
};

export const hydrateTakeRateCloudRows = (entries: unknown) => {
  let baseRows: unknown[] = [];
  let marginCatalog: unknown[] = [];
  let marginFileName = '';
  let frozenMonths: Record<string, unknown> = {};
  const updatedAtByKey: Record<string, string> = {};
  const acceptedKeys: Record<string, true> = {};

  if (!Array.isArray(entries)) {
    return { baseRows, marginCatalog, marginFileName, frozenMonths, updatedAtByKey, acceptedKeys };
  }

  entries.forEach(rawEntry => {
    if (!isRecord(rawEntry)) return;
    const entry = rawEntry as TakeRateCloudEntry;
    const key = typeof entry.key === 'string' ? entry.key : '';
    let accepted = false;

    if (key === TAKE_RATE_BASE_ROWS_CLOUD_KEY && Array.isArray(entry.value)) {
      baseRows = entry.value.filter(isTakeRateMarginBaseRow);
      accepted = true;
    } else if (key === TAKE_RATE_MARGIN_CATALOG_CLOUD_KEY && Array.isArray(entry.value)) {
      marginCatalog = entry.value;
      accepted = true;
    } else if (key === TAKE_RATE_MARGIN_FILE_NAME_CLOUD_KEY && typeof entry.value === 'string') {
      marginFileName = entry.value;
      accepted = true;
    } else if (key === TAKE_RATE_FROZEN_CLOUD_KEY && isRecord(entry.value)) {
      frozenMonths = entry.value;
      accepted = true;
    }

    if (accepted) acceptedKeys[key] = true;
    if (accepted && typeof entry.updated_at === 'string' && entry.updated_at) {
      updatedAtByKey[key] = entry.updated_at;
    }
  });

  return { baseRows, marginCatalog, marginFileName, frozenMonths, updatedAtByKey, acceptedKeys };
};
