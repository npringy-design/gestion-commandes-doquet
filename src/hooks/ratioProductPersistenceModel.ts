import type { ProductWithHistory } from '../data';

export const RATIO_PRODUCT_KEY_PREFIX = 'ratioProduct:';
export const RATIO_PRODUCT_ORDER_KEY = 'ratioProductOrder';

export type RatioProductTombstone = {
  deleted: true;
  productId: string;
};

export const getRatioProductStateKey = (productId: string): string =>
  `${RATIO_PRODUCT_KEY_PREFIX}${encodeURIComponent(productId)}`;

export const getRatioProductIdFromStateKey = (key: string): string | null => {
  if (!key.startsWith(RATIO_PRODUCT_KEY_PREFIX)) return null;
  try {
    return decodeURIComponent(key.slice(RATIO_PRODUCT_KEY_PREFIX.length));
  } catch {
    return null;
  }
};

export const createRatioProductTombstone = (productId: string): RatioProductTombstone => ({
  deleted: true,
  productId,
});

export const isRatioProductTombstone = (value: unknown): value is RatioProductTombstone => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<RatioProductTombstone>;
  return candidate.deleted === true && typeof candidate.productId === 'string';
};

const isProduct = (value: unknown): value is ProductWithHistory => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<ProductWithHistory>;
  return typeof candidate.id === 'string' && typeof candidate.name === 'string';
};

// Recompose la liste visible à partir de l'ancien blob (filet de migration),
// des lignes granulaires plus récentes et de la petite liste d'ordre.
// Une ligne granulaire gagne toujours sur sa copie historique.
export const mergeGranularRatioProducts = (
  values: Record<string, unknown>,
): ProductWithHistory[] | undefined => {
  const legacyProducts = Array.isArray(values.products)
    ? values.products.filter(isProduct)
    : [];
  const byId = new Map<string, ProductWithHistory>(
    legacyProducts.map(product => [product.id, product]),
  );
  const deletedIds = new Set<string>();
  const granularIds = new Set<string>();
  let hasGranularRows = false;

  Object.entries(values).forEach(([key, value]) => {
    const productId = getRatioProductIdFromStateKey(key);
    if (productId === null) return;
    hasGranularRows = true;
    granularIds.add(productId);

    if (isRatioProductTombstone(value)) {
      deletedIds.add(productId);
      byId.delete(productId);
      return;
    }

    if (!isProduct(value) || value.id !== productId) return;
    deletedIds.delete(productId);
    byId.set(productId, value);
  });

  const rawOrder = values[RATIO_PRODUCT_ORDER_KEY];
  const order = Array.isArray(rawOrder)
    ? rawOrder.filter((id): id is string => typeof id === 'string')
    : [];
  const hasGranularOrder = Array.isArray(rawOrder);

  if (!hasGranularRows && !hasGranularOrder) {
    return legacyProducts.length > 0 ? legacyProducts : undefined;
  }

  const result: ProductWithHistory[] = [];
  const added = new Set<string>();
  const append = (id: string) => {
    if (added.has(id) || deletedIds.has(id)) return;
    const product = byId.get(id);
    if (!product) return;
    result.push(product);
    added.add(id);
  };

  order.forEach(append);
  if (hasGranularOrder) {
    // Une liste d'ordre écrite par la nouvelle version contient tous les
    // produits actifs. On récupère seulement les lignes granulaires orphelines
    // (sauvegarde partielle), sans ressusciter une copie historique supprimée.
    granularIds.forEach(append);
  } else {
    legacyProducts.forEach(product => append(product.id));
    granularIds.forEach(append);
  }

  return result;
};

export const materializeGranularRatioProducts = (
  values: Record<string, unknown>,
): Record<string, unknown> => {
  const products = mergeGranularRatioProducts(values);
  return products ? { ...values, products } : values;
};
