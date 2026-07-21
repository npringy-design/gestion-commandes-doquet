export type RatioSupplierMonthFreezeMap = Record<string, Record<string, boolean>>;
export type RatioProductMonthUnfreezeMap = Record<string, Record<string, boolean>>;

const hasOwnMonth = (months: Record<string, boolean> | undefined, month: string) =>
  !!months && Object.prototype.hasOwnProperty.call(months, month);

// Les anciens comptes ne possèdent qu'un statut global par mois. Tant qu'un
// fournisseur n'a pas reçu de valeur explicite, on conserve ce statut afin
// que la migration n'ouvre pas silencieusement un mois déjà clôturé.
export const isRatioSupplierMonthFrozen = (
  legacyMonths: Record<string, boolean>,
  supplierMonths: RatioSupplierMonthFreezeMap,
  supplierId: string,
  month: string,
): boolean => {
  const scopedMonths = supplierMonths[supplierId];
  return hasOwnMonth(scopedMonths, month)
    ? !!scopedMonths[month]
    : !!legacyMonths[month];
};

export const isRatioProductMonthFrozen = (
  legacyMonths: Record<string, boolean>,
  supplierMonths: RatioSupplierMonthFreezeMap,
  productUnfrozenMonths: RatioProductMonthUnfreezeMap,
  supplierId: string,
  productId: string,
  month: string,
): boolean => (
  isRatioSupplierMonthFrozen(legacyMonths, supplierMonths, supplierId, month) &&
  !productUnfrozenMonths[productId]?.[month]
);

export const setRatioSupplierMonthFreeze = (
  current: RatioSupplierMonthFreezeMap,
  supplierId: string,
  month: string,
  frozen: boolean,
): RatioSupplierMonthFreezeMap => ({
  ...current,
  [supplierId]: {
    ...(current[supplierId] || {}),
    [month]: frozen,
  },
});

export const setRatioProductMonthUnfrozen = (
  current: RatioProductMonthUnfreezeMap,
  productId: string,
  month: string,
  unfrozen: boolean,
): RatioProductMonthUnfreezeMap => {
  const productMonths = { ...(current[productId] || {}) };
  if (unfrozen) productMonths[month] = true;
  else delete productMonths[month];

  const next = { ...current };
  if (Object.keys(productMonths).length > 0) next[productId] = productMonths;
  else delete next[productId];
  return next;
};

export const openNewRatioProductsForMonth = (
  current: RatioProductMonthUnfreezeMap,
  productIds: string[],
  month: string,
): RatioProductMonthUnfreezeMap => productIds.reduce(
  (next, productId) => setRatioProductMonthUnfrozen(next, productId, month, true),
  current,
);

export const clearRatioProductMonthOverrides = (
  current: RatioProductMonthUnfreezeMap,
  productIds: string[],
  month: string,
): RatioProductMonthUnfreezeMap => productIds.reduce(
  (next, productId) => setRatioProductMonthUnfrozen(next, productId, month, false),
  current,
);
