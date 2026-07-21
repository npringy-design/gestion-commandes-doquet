import type { ProductWithHistory } from '../data';
import type { OrderTemplateRow, SupplierConfig } from '../types';

export const getOrderTemplateSupplierOptions = (
  supplierConfigs: Record<string, SupplierConfig>,
): SupplierConfig[] => Object.entries(supplierConfigs)
  .map(([supplierId, config]) => ({ ...config, id: config.id || supplierId }))
  .filter(config => !config.isArchived)
  .sort((left, right) => left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' }));

export const normalizeTemplateProductName = (name: string) => name.replace(/\s+/g, ' ').trim();

export const normalizeTemplateProductKey = (supplierId: string, name: string) => (
  `${supplierId}::${normalizeTemplateProductName(name).toLowerCase()}`
);

// Extrait le premier nombre trouvé dans l'unité de conditionnement
// (ex: "carton x 24" -> 24), 1 par défaut si aucun nombre n'est présent.
export const parseTemplatePackagingQuantity = (packagingUnit: string): number => {
  const match = packagingUnit.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
};

export const buildTemplateRowsFromProducts = (
  products: ProductWithHistory[],
  supplierId: string,
): OrderTemplateRow[] => products
  .filter(product => String(product.supplierId || '') === supplierId)
  .map(product => ({
    id: `template-${product.id}`,
    productId: product.id,
    article: product.name,
    storageUnit: product.storageUnit || '',
    packagingUnit: product.packagingUnit
      || (Number(product.packaging || 0) > 1 ? `conditionnement x ${product.packaging}` : 'pièce'),
  }));

export const linkTemplateRowsToExistingProducts = (
  rows: OrderTemplateRow[],
  products: ProductWithHistory[],
  supplierId: string,
): OrderTemplateRow[] => {
  const productsById = new Map(products.map(product => [product.id, product]));
  const productsByKey = new Map(
    products
      .filter(product => String(product.supplierId || '') === supplierId)
      .map(product => [normalizeTemplateProductKey(supplierId, product.name), product]),
  );

  return rows.map(row => {
    const linked = (row.productId ? productsById.get(row.productId) : undefined)
      || productsByKey.get(normalizeTemplateProductKey(supplierId, row.article));
    return linked ? { ...row, productId: linked.id } : row;
  });
};

export type ProductUpdate = {
  id: string;
  name: string;
  storageUnit?: string;
  packagingUnit: string;
  packaging: number;
};

// Prépare uniquement les mises à jour des lignes déjà rattachées à un produit.
// Cette fonction est utilisée par l'enregistrement automatique de la trame :
// une ligne nouvelle reste soumise à l'action explicite « Créer les produits ».
export const getLinkedTemplateProductUpdates = ({
  rows,
  products,
  supplierId,
}: {
  rows: OrderTemplateRow[];
  products: ProductWithHistory[];
  supplierId: string;
}): ProductUpdate[] => {
  const productsById = new Map(
    products
      .filter(product => String(product.supplierId || '') === supplierId)
      .map(product => [product.id, product]),
  );

  return rows.flatMap(row => {
    if (!row.productId) return [];
    const existing = productsById.get(row.productId);
    if (!existing) return [];

    const name = normalizeTemplateProductName(row.article) || existing.name;
    const storageUnit = row.storageUnit.trim() || undefined;
    const packagingUnit = row.packagingUnit.trim();
    const packaging = parseTemplatePackagingQuantity(packagingUnit);
    const hasChanged = existing.name !== name
      || (existing.storageUnit || '') !== (storageUnit || '')
      || (existing.packagingUnit || '') !== packagingUnit
      || existing.packaging !== packaging;

    return hasChanged ? [{
      id: existing.id,
      name,
      storageUnit,
      packagingUnit,
      packaging,
    }] : [];
  });
};

export interface OrderTemplateSyncResult {
  linkedRows: OrderTemplateRow[];
  updates: ProductUpdate[];
  creations: ProductWithHistory[];
  duplicateCount: number;
}

const compareProductNames = (left: ProductWithHistory, right: ProductWithHistory) => (
  normalizeTemplateProductName(left.name).localeCompare(
    normalizeTemplateProductName(right.name),
    'fr',
    { sensitivity: 'base', numeric: true },
  )
);

// Insère les créations à leur place alphabétique dans le fournisseur sans
// déplacer les produits existants des autres fournisseurs. Les mises à jour
// conservent l'identité, l'historique et les paramètres du produit.
export const mergeTemplateProductChanges = ({
  products,
  updates,
  creations,
  supplierId,
}: {
  products: ProductWithHistory[];
  updates: ProductUpdate[];
  creations: ProductWithHistory[];
  supplierId: string;
}): ProductWithHistory[] => {
  const updatesById = new Map(updates.map(update => [update.id, update]));
  const nextProducts = products.map(product => {
    const update = updatesById.get(product.id);
    return update ? { ...product, ...update } : product;
  });

  [...creations].sort(compareProductNames).forEach(creation => {
    const firstFollowingProductIndex = nextProducts.findIndex(product => (
      String(product.supplierId || '') === supplierId
      && compareProductNames(creation, product) < 0
    ));
    if (firstFollowingProductIndex >= 0) {
      nextProducts.splice(firstFollowingProductIndex, 0, creation);
      return;
    }

    let lastSupplierProductIndex = -1;
    nextProducts.forEach((product, index) => {
      if (String(product.supplierId || '') === supplierId) lastSupplierProductIndex = index;
    });
    nextProducts.splice(lastSupplierProductIndex >= 0 ? lastSupplierProductIndex + 1 : nextProducts.length, 0, creation);
  });

  return nextProducts;
};

export const synchronizeOrderTemplateProducts = ({
  rows,
  products,
  supplierId,
  makeProductId,
}: {
  rows: OrderTemplateRow[];
  products: ProductWithHistory[];
  supplierId: string;
  makeProductId: (index: number) => string;
}): OrderTemplateSyncResult => {
  const supplierProducts = products.filter(product => String(product.supplierId || '') === supplierId);
  const productsById = new Map(supplierProducts.map(product => [product.id, product]));
  const productsByKey = new Map(
    supplierProducts.map(product => [normalizeTemplateProductKey(supplierId, product.name), product]),
  );
  const usedProductIds = new Set<string>();
  const usedKeys = new Set<string>();
  const linkedRows: OrderTemplateRow[] = [];
  const updates: ProductUpdate[] = [];
  const creations: ProductWithHistory[] = [];
  let duplicateCount = 0;

  rows.forEach((row, index) => {
    const article = normalizeTemplateProductName(row.article);
    if (!article) return;
    const key = normalizeTemplateProductKey(supplierId, article);
    const existing = (row.productId ? productsById.get(row.productId) : undefined) || productsByKey.get(key);

    if (usedKeys.has(key) || (existing && usedProductIds.has(existing.id))) {
      duplicateCount += 1;
      return;
    }
    usedKeys.add(key);

    const packagingUnit = row.packagingUnit.trim();
    const packaging = parseTemplatePackagingQuantity(packagingUnit);
    const storageUnit = row.storageUnit.trim() || undefined;

    if (existing) {
      usedProductIds.add(existing.id);
      updates.push({
        id: existing.id,
        name: article,
        storageUnit,
        packagingUnit,
        packaging,
      });
      linkedRows.push({ ...row, productId: existing.id, article, storageUnit: storageUnit || '', packagingUnit });
      return;
    }

    const id = makeProductId(index);
    creations.push({
      id,
      supplierId,
      name: article,
      searchName: article,
      storageUnit,
      packagingUnit,
      packaging,
      defaultMargin: 0,
      salesHistory: {},
    });
    linkedRows.push({ ...row, productId: id, article, storageUnit: storageUnit || '', packagingUnit });
  });

  return { linkedRows, updates, creations, duplicateCount };
};
