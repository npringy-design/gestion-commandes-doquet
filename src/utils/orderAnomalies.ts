// =============================================================
// utils/orderAnomalies.ts
//
// Détection pure des anomalies potentielles sur les lignes de commande.
// Ces alertes sont informatives : elles ne modifient ni ne bloquent les calculs.
// =============================================================

export type OrderCalculationMode = 'margin' | 'target';

export type OrderAnomalyCode =
  | 'invalid_packaging'
  | 'missing_stock'
  | 'missing_target'
  | 'negative_value'
  | 'duplicate_product'
  | 'unusual_stock'
  | 'unusual_upcoming_delivery'
  | 'unusual_order_quantity';

export interface OrderAnomaly {
  code: OrderAnomalyCode;
  message: string;
}

export interface OrderAnomalyProduct {
  id: string;
  name: string;
  stock?: number | '';
  upcomingDelivery?: number | '';
  targetStock?: number | '';
  packaging: number | '';
}

export interface OrderAnomalyInput {
  product: OrderAnomalyProduct;
  calculationMode: OrderCalculationMode;
  averageRatio: number;
  forecastTotal: number;
  toOrder: number;
  duplicateNameCount?: number;
}

const toFiniteNumber = (value: number | '' | undefined): number => {
  if (value === '' || value === undefined) return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const isBlank = (value: number | '' | undefined): boolean =>
  value === '' || value === undefined;

export const normalizeOrderProductName = (value: string): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

export const buildOrderProductNameCounts = (
  products: Array<Pick<OrderAnomalyProduct, 'name'>>
): Map<string, number> => {
  const counts = new Map<string, number>();

  products.forEach(product => {
    const normalizedName = normalizeOrderProductName(product.name);
    if (!normalizedName) return;
    counts.set(normalizedName, (counts.get(normalizedName) ?? 0) + 1);
  });

  return counts;
};

const pushNegativeValueAlert = (
  anomalies: OrderAnomaly[],
  label: string,
  value: number | '' | undefined
): void => {
  if (!isBlank(value) && toFiniteNumber(value) < 0) {
    anomalies.push({
      code: 'negative_value',
      message: `${label} négatif : vérifier la valeur saisie.`,
    });
  }
};

export const getOrderAnomalies = ({
  product,
  calculationMode,
  averageRatio,
  forecastTotal,
  toOrder,
  duplicateNameCount = 1,
}: OrderAnomalyInput): OrderAnomaly[] => {
  const anomalies: OrderAnomaly[] = [];
  const packaging = toFiniteNumber(product.packaging);
  const safePackaging = packaging > 0 ? packaging : 1;
  const forecastNeed = Math.max(0, Math.ceil(Math.max(0, averageRatio) * Math.max(0, forecastTotal)));
  const targetStock = Math.max(0, toFiniteNumber(product.targetStock));
  const referenceNeed = calculationMode === 'target'
    ? Math.max(forecastNeed, targetStock)
    : forecastNeed;

  if (packaging <= 0) {
    anomalies.push({
      code: 'invalid_packaging',
      message: 'Conditionnement absent ou égal à 0 : le calcul de commande ne peut pas être fiable.',
    });
  }

  if (forecastNeed > 0 && isBlank(product.stock)) {
    anomalies.push({
      code: 'missing_stock',
      message: 'Stock non saisi alors qu’un besoin est prévu : la proposition peut être surévaluée.',
    });
  }

  if (calculationMode === 'target' && forecastNeed > 0 && isBlank(product.targetStock)) {
    anomalies.push({
      code: 'missing_target',
      message: 'Stock cible non renseigné : le mode Cible ne peut pas proposer une quantité fiable.',
    });
  }

  pushNegativeValueAlert(anomalies, 'Stock', product.stock);
  pushNegativeValueAlert(anomalies, 'Livraison à venir', product.upcomingDelivery);
  pushNegativeValueAlert(anomalies, 'Stock cible', product.targetStock);

  if (duplicateNameCount > 1) {
    anomalies.push({
      code: 'duplicate_product',
      message: 'Un autre article porte le même nom chez ce fournisseur : vérifier qu’il ne s’agit pas d’un doublon.',
    });
  }

  const stockUnits = Math.max(0, toFiniteNumber(product.stock));
  const upcomingCases = Math.max(0, toFiniteNumber(product.upcomingDelivery));
  const upcomingUnits = upcomingCases * safePackaging;
  const unusualLevel = Math.max(
    referenceNeed * 4,
    referenceNeed + safePackaging * 5,
    safePackaging * 8
  );

  if (!isBlank(product.stock) && referenceNeed > 0 && stockUnits >= unusualLevel) {
    anomalies.push({
      code: 'unusual_stock',
      message: 'Stock très supérieur au besoin estimé : vérifier qu’un zéro ou une unité n’a pas été ajouté par erreur.',
    });
  }

  if (!isBlank(product.upcomingDelivery) && referenceNeed > 0 && upcomingUnits >= unusualLevel) {
    anomalies.push({
      code: 'unusual_upcoming_delivery',
      message: 'Livraison à venir très supérieure au besoin estimé : vérifier le nombre de colis saisi.',
    });
  }

  const orderedUnits = Math.max(0, toOrder) * safePackaging;
  const unusualOrderLevel = Math.max(
    referenceNeed * 2,
    referenceNeed + safePackaging * 8
  );

  if (
    packaging > 0
    && referenceNeed > 0
    && toOrder >= 10
    && orderedUnits > unusualOrderLevel
  ) {
    anomalies.push({
      code: 'unusual_order_quantity',
      message: 'Quantité à commander nettement supérieure au besoin estimé : contrôler les stocks, la livraison et le conditionnement.',
    });
  }

  return anomalies;
};
