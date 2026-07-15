// =============================================================
// utils/orderAnomalies.ts
//
// Détection pure des anomalies potentielles sur les lignes de commande.
// Ces alertes sont informatives : elles ne modifient ni ne bloquent les calculs.
// =============================================================

export type OrderCalculationMode = 'margin' | 'target';
export type OrderRatioLinkStatus = 'linked' | 'unlinked' | 'unknown';

export type OrderAnomalyCode =
  | 'invalid_packaging'
  | 'missing_target'
  | 'negative_value'
  | 'duplicate_product'
  | 'unlinked_ratio'
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
  ratioLinkStatus?: OrderRatioLinkStatus;
}

export interface OrderRatioLinkEvidence {
  currentMonthValidated: boolean;
  currentSnapshotLinked?: boolean;
  hasCurrentImportSource: boolean;
  currentImportMatched: boolean;
  historicalSnapshotLinks?: Array<boolean | undefined>;
}

const STOCK_EXCESS_MULTIPLIER = 4; // stock >= 4 x besoin = au moins +300 %
const ORDER_EXCESS_MULTIPLIER = 2;

const toFiniteNumber = (value: number | '' | undefined): number => {
  if (value === '' || value === undefined) return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const isBlank = (value: number | '' | undefined): boolean =>
  value === '' || value === undefined;

const formatExcessPercent = (value: number, reference: number): number =>
  reference > 0 ? Math.round(((value - reference) / reference) * 100) : 0;

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

export const resolveOrderRatioLinkStatus = ({
  currentMonthValidated,
  currentSnapshotLinked,
  hasCurrentImportSource,
  currentImportMatched,
  historicalSnapshotLinks = [],
}: OrderRatioLinkEvidence): OrderRatioLinkStatus => {
  // Un mois figé doit utiliser exactement le statut enregistré lors du figeage.
  // Le fichier d'import encore présent ne doit jamais écraser ce statut.
  if (currentMonthValidated && currentSnapshotLinked !== undefined) {
    return currentSnapshotLinked ? 'linked' : 'unlinked';
  }

  // Pour un mois encore en cours de travail, le fichier actuel est la source de vérité.
  if (!currentMonthValidated && hasCurrentImportSource) {
    return currentImportMatched ? 'linked' : 'unlinked';
  }

  // En l'absence de source courante exploitable, les snapshots historiques évitent
  // d'annoncer à tort qu'un article déjà lié est non lié.
  if (historicalSnapshotLinks.some(isLinked => isLinked === true)) return 'linked';
  if (historicalSnapshotLinks.some(isLinked => isLinked === false)) return 'unlinked';

  return 'unknown';
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
  ratioLinkStatus = 'unknown',
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
      message: 'Conditionnement absent ou égal à 0 : vérifier le paramétrage de l’article.',
    });
  }

  if (calculationMode === 'target' && forecastNeed > 0 && isBlank(product.targetStock)) {
    anomalies.push({
      code: 'missing_target',
      message: 'Stock cible non renseigné : vérifier le paramétrage du mode Cible.',
    });
  }

  if (ratioLinkStatus === 'unlinked') {
    anomalies.push({
      code: 'unlinked_ratio',
      message: 'Produit non lié dans Calcul vente ratio : vérifier l’article associé avant d’utiliser la proposition.',
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
  const minimumManualGap = Math.max(5, safePackaging);
  const unusualManualLevel = Math.max(
    referenceNeed * STOCK_EXCESS_MULTIPLIER,
    referenceNeed + minimumManualGap
  );

  if (!isBlank(product.stock) && referenceNeed > 0 && stockUnits >= unusualManualLevel) {
    const excessPercent = formatExcessPercent(stockUnits, referenceNeed);
    anomalies.push({
      code: 'unusual_stock',
      message: `Stock saisi très supérieur au besoin estimé (${stockUnits} pour ${referenceNeed}, soit +${excessPercent} %) : vérifier une erreur de frappe ou d’unité.`,
    });
  }

  if (!isBlank(product.upcomingDelivery) && referenceNeed > 0 && upcomingUnits >= unusualManualLevel) {
    const excessPercent = formatExcessPercent(upcomingUnits, referenceNeed);
    anomalies.push({
      code: 'unusual_upcoming_delivery',
      message: `Livraison saisie très supérieure au besoin estimé (${upcomingUnits} unités pour ${referenceNeed}, soit +${excessPercent} %) : vérifier le nombre de colis.`,
    });
  }

  const orderedUnits = Math.max(0, toOrder) * safePackaging;
  const unusualOrderLevel = Math.max(
    referenceNeed * ORDER_EXCESS_MULTIPLIER,
    referenceNeed + safePackaging * 4
  );

  if (
    packaging > 0
    && referenceNeed > 0
    && toOrder >= 5
    && orderedUnits >= unusualOrderLevel
  ) {
    anomalies.push({
      code: 'unusual_order_quantity',
      message: `Proposition de commande disproportionnée (${toOrder} colis, soit ${orderedUnits} unités, pour un besoin estimé à ${referenceNeed}) : contrôler le ratio, les stocks et le conditionnement.`,
    });
  }

  return anomalies;
};