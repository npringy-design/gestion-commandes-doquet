import type { ProductWithHistory } from '../data';
import type { OrderLineField, OrderLineState, OrderState } from '../types';
import type { OrderLineStateFields, OrderLineStateRow } from '../utils/supabase';

export const ORDER_LINE_SAVE_PREFIX = 'order:';

const ORDER_LINE_FIELD_TO_COLUMN: Record<OrderLineField, keyof OrderLineStateFields> = {
  stock: 'stock',
  upcomingDelivery: 'upcoming_delivery',
  targetStock: 'target_stock',
  packaging: 'packaging',
  margin: 'margin',
};

export const getOrderLineSaveId = (productId: string): string =>
  `${ORDER_LINE_SAVE_PREFIX}${productId}`;

export const getProductIdFromOrderLineSaveId = (saveId: string): string | null =>
  saveId.startsWith(ORDER_LINE_SAVE_PREFIX)
    ? saveId.slice(ORDER_LINE_SAVE_PREFIX.length)
    : null;

export const toOrderLinePatch = (
  field: OrderLineField,
  value: number | '',
): OrderLineStateFields => ({
  [ORDER_LINE_FIELD_TO_COLUMN[field]]: value === '' ? null : Number(value),
});

export const shouldApplyOrderLineRow = (
  row: OrderLineStateRow,
  localTs: string | undefined,
): boolean => !localTs || localTs <= row.updated_at;

export const mapOrderLineRowToState = (row: OrderLineStateRow): OrderLineState => ({
  stock: row.stock ?? '',
  upcomingDelivery: row.upcoming_delivery ?? '',
  targetStock: row.target_stock ?? '',
  packaging: row.packaging ?? '',
  margin: row.margin ?? undefined,
  updatedAt: row.updated_at,
});

export const mergeOrderLineRows = (
  previous: Record<string, OrderLineState>,
  rows: OrderLineStateRow[],
  localTsByProductId: Record<string, string>,
): {
  next: Record<string, OrderLineState>;
  acceptedCloudTsByProductId: Record<string, string>;
} => {
  if (rows.length === 0) {
    return { next: previous, acceptedCloudTsByProductId: {} };
  }

  let next = previous;
  const acceptedCloudTsByProductId: Record<string, string> = {};

  rows.forEach(row => {
    if (!shouldApplyOrderLineRow(row, localTsByProductId[row.product_id])) return;
    if (next === previous) next = { ...previous };
    next[row.product_id] = mapOrderLineRowToState(row);
    acceptedCloudTsByProductId[row.product_id] = row.updated_at;
  });

  return { next, acceptedCloudTsByProductId };
};

export const buildLegacyOrderLineStateMap = (
  products: ProductWithHistory[] | undefined,
  orderStates: Record<string, OrderState> | undefined,
): Record<string, OrderLineState> | null => {
  if (!products?.length) return null;

  return products.reduce<Record<string, OrderLineState>>((acc, product) => {
    acc[product.id] = {
      stock: product.stock ?? '',
      upcomingDelivery: product.upcomingDelivery ?? '',
      targetStock: product.targetStock ?? '',
      packaging: product.packaging ?? '',
      margin: orderStates?.[product.id]?.margin,
    };
    return acc;
  }, {});
};
