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

export type GranularRatioReconstruction = {
  products: ProductWithHistory[] | undefined;
  // Produits présents en lignes granulaires mais absents de la liste d'ordre
  // (sauvegarde partielle), recollés en fin de liste dans un ordre déterministe.
  orphanIds: string[];
};

const compareOrphanProducts = (left: ProductWithHistory, right: ProductWithHistory): number =>
  left.name.localeCompare(right.name, 'fr', { numeric: true })
  || left.id.localeCompare(right.id, 'fr', { numeric: true });

// Recompose la liste visible à partir de l'ancien blob (filet de migration),
// des lignes granulaires plus récentes et de la petite liste d'ordre.
// Une ligne granulaire gagne toujours sur sa copie historique.
export const reconstructGranularRatioProducts = (
  values: Record<string, unknown>,
): GranularRatioReconstruction => {
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
    return { products: legacyProducts.length > 0 ? legacyProducts : undefined, orphanIds: [] };
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
  if (!hasGranularOrder) legacyProducts.forEach(product => append(product.id));

  // Une liste d'ordre écrite par la nouvelle version contient tous les produits
  // actifs. Les lignes granulaires restantes sont orphelines (sauvegarde
  // partielle) : on les recolle sans ressusciter une copie historique supprimée,
  // triées par nom plutôt que dans l'ordre brut d'itération de l'objet.
  const orphans: ProductWithHistory[] = [];
  granularIds.forEach(id => {
    if (added.has(id) || deletedIds.has(id)) return;
    const product = byId.get(id);
    if (product) orphans.push(product);
  });
  orphans.sort(compareOrphanProducts);
  orphans.forEach(product => append(product.id));

  return { products: result, orphanIds: hasGranularOrder ? orphans.map(product => product.id) : [] };
};

export const mergeGranularRatioProducts = (
  values: Record<string, unknown>,
): ProductWithHistory[] | undefined => reconstructGranularRatioProducts(values).products;

// Rejoue la réécriture de la liste d'ordre tant qu'elle n'a pas pu être
// enregistrée (hydratation encore en cours, chargement cloud non terminé).
export const RATIO_ORDER_REPAIR_RETRY_DELAYS_MS = [700, 2000, 5000];

export const runRatioOrderRepair = (
  attempt: () => boolean,
  schedule: (callback: () => void, delayMs: number) => unknown = (callback, delayMs) => setTimeout(callback, delayMs),
  delaysMs: number[] = RATIO_ORDER_REPAIR_RETRY_DELAYS_MS,
): void => {
  const [delayMs, ...remainingDelays] = delaysMs;
  if (delayMs === undefined) return;
  schedule(() => {
    if (!attempt()) runRatioOrderRepair(attempt, schedule, remainingDelays);
  }, delayMs);
};

export const materializeGranularRatioProducts = (
  values: Record<string, unknown>,
): Record<string, unknown> => {
  const products = mergeGranularRatioProducts(values);
  return products ? { ...values, products } : values;
};
