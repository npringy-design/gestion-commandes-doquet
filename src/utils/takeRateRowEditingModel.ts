export type TakeRateEditableRow = {
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

const MANUAL_MARGIN_FIELDS = new Set([
  'costHt',
  'sellPriceHt',
  'marginPercent',
  'marginEuro',
]);

export const createEmptyTakeRateRow = (id: string): TakeRateEditableRow => ({
  id,
  label: '',
  family: '',
  linkedImports: [],
  costHt: '',
  sellPriceHt: '',
  marginPercent: '',
  marginEuro: '',
  marginSource: '',
  matchedMarginLabel: '',
  matchedMarginSheet: '',
});

export const appendTakeRateRow = <Row extends TakeRateEditableRow>(rows: Row[], row: Row): Row[] =>
  [...rows, row];

export const removeTakeRateRows = <Row extends TakeRateEditableRow>(
  rows: Row[],
  rowIds: Iterable<string>,
): Row[] => {
  const ids = new Set(rowIds);
  return rows.filter(row => !ids.has(row.id));
};

export const updateTakeRateRow = <Row extends TakeRateEditableRow>(
  rows: Row[],
  rowId: string,
  patch: Partial<Row>,
): Row[] => rows.map(row => {
  if (row.id !== rowId) return row;
  const next = { ...row, ...patch } as Row;
  if (Object.keys(patch).some(key => MANUAL_MARGIN_FIELDS.has(key))) {
    next.marginSource = 'manual';
  }
  return next;
});

export const addTakeRateImportLinks = <Row extends TakeRateEditableRow>(
  rows: Row[],
  rowId: string,
  importLabels: string[],
): Row[] => updateTakeRateRow(rows, rowId, {
  linkedImports: Array.from(new Set([
    ...(rows.find(row => row.id === rowId)?.linkedImports ?? []),
    ...importLabels,
  ])),
} as Partial<Row>);

export const removeTakeRateImportLink = <Row extends TakeRateEditableRow>(
  rows: Row[],
  rowId: string,
  importLabel: string,
): Row[] => {
  const row = rows.find(item => item.id === rowId);
  if (!row) return rows;
  return updateTakeRateRow(rows, rowId, {
    linkedImports: row.linkedImports.filter(item => item !== importLabel),
  } as Partial<Row>);
};

export const toggleTakeRateRowSelection = (selectedIds: string[], rowId: string): string[] =>
  selectedIds.includes(rowId)
    ? selectedIds.filter(id => id !== rowId)
    : [...selectedIds, rowId];

export const toggleAllVisibleTakeRateRows = (selectedIds: string[], visibleIds: string[]): string[] => {
  if (visibleIds.length === 0) return selectedIds;
  const allVisibleSelected = visibleIds.every(id => selectedIds.includes(id));
  return allVisibleSelected
    ? selectedIds.filter(id => !visibleIds.includes(id))
    : Array.from(new Set([...selectedIds, ...visibleIds]));
};

export const togglePendingTakeRateImport = (
  pendingByRow: Record<string, string[]>,
  rowId: string,
  importLabel: string,
): Record<string, string[]> => {
  const current = pendingByRow[rowId] ?? [];
  const nextForRow = current.includes(importLabel)
    ? current.filter(item => item !== importLabel)
    : [...current, importLabel];
  const next = { ...pendingByRow };
  if (nextForRow.length === 0) delete next[rowId];
  else next[rowId] = nextForRow;
  return next;
};
