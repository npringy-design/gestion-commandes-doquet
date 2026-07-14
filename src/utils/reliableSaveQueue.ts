import { CURRENT_SITE_ID } from '../constants';
import {
  loadMetaFromSupabase,
  loadOrderLineStates,
  saveToSupabase,
  upsertOrderLineState,
  type OrderLineStateFields,
} from './supabase';

export type ReliableSaveFailureReason = 'network' | 'conflict' | 'storage';

export type ReliableSaveCallbacks = {
  onSaved?: (id: string, confirmedTs: string) => void;
  onPending?: (id: string, localTs: string, pendingCount: number, persistedLocally: boolean) => void;
  onError?: (id: string, localTs: string, reason: ReliableSaveFailureReason, pendingCount: number) => void;
};

type AppStateQueueItem = {
  id: string;
  kind: 'app_state';
  key: string;
  value: unknown;
  ts: string;
};

type OrderLineQueueItem = {
  id: string;
  kind: 'order_line';
  productId: string;
  fields: OrderLineStateFields;
  ts: string;
};

type PendingQueueItem = AppStateQueueItem | OrderLineQueueItem;

type ScheduledAppStateSave = {
  value: unknown;
  ts: string;
  getCloudTs: (key: string) => string | undefined;
  callbacks: ReliableSaveCallbacks;
};

type ScheduledOrderLineSave = {
  fields: OrderLineStateFields;
  ts: string;
  callbacks: ReliableSaveCallbacks;
};

export type ReliableRetryResult = {
  attempted: number;
  saved: number;
  discarded: number;
  failed: number;
  pending: number;
};

const APP_ENV = (import.meta.env.VITE_APP_ENV as string | undefined) || 'production';
const STORAGE_KEY = `gestion-commandes:pending-saves:v1:${APP_ENV}:${CURRENT_SITE_ID}`;

let queueCache: PendingQueueItem[] | null = null;

const canUseLocalStorage = (): boolean => typeof window !== 'undefined' && Boolean(window.localStorage);

const readQueue = (): PendingQueueItem[] => {
  if (queueCache) return queueCache;
  if (!canUseLocalStorage()) {
    queueCache = [];
    return queueCache;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    queueCache = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('[Reliable save queue read error]', { siteId: CURRENT_SITE_ID, error });
    queueCache = [];
  }

  return queueCache;
};

const writeQueue = (items: PendingQueueItem[]): boolean => {
  queueCache = items;
  if (!canUseLocalStorage()) return false;

  try {
    if (items.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
    return true;
  } catch (error) {
    console.error('[Reliable save queue write error]', { siteId: CURRENT_SITE_ID, error });
    return false;
  }
};

const upsertQueueItem = (item: PendingQueueItem): { count: number; persisted: boolean } => {
  const current = readQueue();
  const existing = current.find(candidate => candidate.id === item.id);
  let nextItem = item;

  if (existing?.kind === 'order_line' && item.kind === 'order_line') {
    nextItem = {
      ...item,
      fields: { ...existing.fields, ...item.fields },
      ts: existing.ts > item.ts ? existing.ts : item.ts,
    };
  } else if (existing && existing.ts > item.ts) {
    nextItem = existing;
  }

  const next = [...current.filter(candidate => candidate.id !== item.id), nextItem]
    .sort((left, right) => left.ts.localeCompare(right.ts));
  return { count: next.length, persisted: writeQueue(next) };
};

const removeQueueItem = (id: string, confirmedTs?: string): number => {
  const current = readQueue();
  const next = current.filter(item => {
    if (item.id !== id) return true;
    if (!confirmedTs) return false;
    return item.ts > confirmedTs;
  });
  writeQueue(next);
  return next.length;
};

export const getReliablePendingSaveCount = (): number => readQueue().length;

const appStateTimers = new Map<string, ReturnType<typeof setTimeout>>();
const appStatePending = new Map<string, ScheduledAppStateSave>();
const orderLineTimers = new Map<string, ReturnType<typeof setTimeout>>();
const orderLinePending = new Map<string, ScheduledOrderLineSave>();

const commitAppState = async (key: string): Promise<void> => {
  const pending = appStatePending.get(key);
  if (!pending) return;
  appStatePending.delete(key);

  const id = `app:${key}`;
  const cloudTs = pending.getCloudTs(key);
  if (cloudTs && cloudTs > pending.ts) {
    const count = removeQueueItem(id);
    console.warn('[Reliable save skipped by LWW]', { siteId: CURRENT_SITE_ID, key, cloudTs, localTs: pending.ts });
    pending.callbacks.onError?.(id, pending.ts, 'conflict', count);
    return;
  }

  const confirmedTs = await saveToSupabase(key, pending.value, pending.ts);
  if (confirmedTs) {
    removeQueueItem(id, confirmedTs);
    pending.callbacks.onSaved?.(id, confirmedTs);
    return;
  }

  const queued = upsertQueueItem({ id, kind: 'app_state', key, value: pending.value, ts: pending.ts });
  pending.callbacks.onPending?.(id, pending.ts, queued.count, queued.persisted);
  if (!queued.persisted) pending.callbacks.onError?.(id, pending.ts, 'storage', queued.count);
};

const commitOrderLine = async (productId: string): Promise<void> => {
  const pending = orderLinePending.get(productId);
  if (!pending) return;
  orderLinePending.delete(productId);

  const id = `order:${productId}`;
  const confirmedTs = await upsertOrderLineState(productId, pending.fields, pending.ts);
  if (confirmedTs) {
    removeQueueItem(id, confirmedTs);
    pending.callbacks.onSaved?.(id, confirmedTs);
    return;
  }

  const queued = upsertQueueItem({
    id,
    kind: 'order_line',
    productId,
    fields: pending.fields,
    ts: pending.ts,
  });
  pending.callbacks.onPending?.(id, pending.ts, queued.count, queued.persisted);
  if (!queued.persisted) pending.callbacks.onError?.(id, pending.ts, 'storage', queued.count);
};

export const scheduleReliableAppStateSave = (
  key: string,
  value: unknown,
  ts: string,
  getCloudTs: (key: string) => string | undefined,
  callbacks: ReliableSaveCallbacks,
  ms = 1500,
): void => {
  const existingTimer = appStateTimers.get(key);
  if (existingTimer) clearTimeout(existingTimer);

  const existingQueued = readQueue().find(item => item.id === `app:${key}`);
  if (existingQueued) upsertQueueItem({ id: `app:${key}`, kind: 'app_state', key, value, ts });

  appStatePending.set(key, { value, ts, getCloudTs, callbacks });
  appStateTimers.set(key, setTimeout(() => {
    appStateTimers.delete(key);
    void commitAppState(key);
  }, ms));
};

export const scheduleReliableOrderLineSave = (
  productId: string,
  fields: OrderLineStateFields,
  ts: string,
  callbacks: ReliableSaveCallbacks,
  ms = 400,
): void => {
  const existingTimer = orderLineTimers.get(productId);
  if (existingTimer) clearTimeout(existingTimer);

  const previous = orderLinePending.get(productId);
  const mergedFields = previous ? { ...previous.fields, ...fields } : fields;
  const existingQueued = readQueue().find(item => item.id === `order:${productId}`);
  if (existingQueued) {
    upsertQueueItem({ id: `order:${productId}`, kind: 'order_line', productId, fields: mergedFields, ts });
  }

  orderLinePending.set(productId, { fields: mergedFields, ts, callbacks });
  orderLineTimers.set(productId, setTimeout(() => {
    orderLineTimers.delete(productId);
    void commitOrderLine(productId);
  }, ms));
};

export const flushReliablePendingSaves = (): void => {
  appStateTimers.forEach(timer => clearTimeout(timer));
  appStateTimers.clear();
  appStatePending.forEach((pending, key) => {
    const id = `app:${key}`;
    const queued = upsertQueueItem({ id, kind: 'app_state', key, value: pending.value, ts: pending.ts });
    pending.callbacks.onPending?.(id, pending.ts, queued.count, queued.persisted);
    void commitAppState(key);
  });

  orderLineTimers.forEach(timer => clearTimeout(timer));
  orderLineTimers.clear();
  orderLinePending.forEach((pending, productId) => {
    const id = `order:${productId}`;
    const queued = upsertQueueItem({
      id,
      kind: 'order_line',
      productId,
      fields: pending.fields,
      ts: pending.ts,
    });
    pending.callbacks.onPending?.(id, pending.ts, queued.count, queued.persisted);
    void commitOrderLine(productId);
  });
};

export const retryReliablePendingSaves = async (
  callbacks: ReliableSaveCallbacks = {},
): Promise<ReliableRetryResult> => {
  const queuedItems = [...readQueue()];
  if (queuedItems.length === 0) {
    return { attempted: 0, saved: 0, discarded: 0, failed: 0, pending: 0 };
  }

  const hasAppStateItems = queuedItems.some(item => item.kind === 'app_state');
  const hasOrderLineItems = queuedItems.some(item => item.kind === 'order_line');
  const [metaRows, orderLineRows] = await Promise.all([
    hasAppStateItems ? loadMetaFromSupabase() : Promise.resolve([]),
    hasOrderLineItems ? loadOrderLineStates() : Promise.resolve([]),
  ]);

  const appCloudTs = new Map((metaRows ?? []).map(row => [row.key, row.updated_at]));
  const orderCloudTs = new Map((orderLineRows ?? []).map(row => [row.product_id, row.updated_at]));
  let saved = 0;
  let discarded = 0;
  let failed = 0;

  for (const item of queuedItems) {
    const metadataAvailable = item.kind === 'app_state' ? metaRows !== null : orderLineRows !== null;
    if (!metadataAvailable) {
      failed += 1;
      callbacks.onPending?.(item.id, item.ts, getReliablePendingSaveCount(), true);
      continue;
    }

    const remoteTs = item.kind === 'app_state'
      ? appCloudTs.get(item.key)
      : orderCloudTs.get(item.productId);

    if (remoteTs && remoteTs > item.ts) {
      const count = removeQueueItem(item.id);
      discarded += 1;
      callbacks.onError?.(item.id, item.ts, 'conflict', count);
      continue;
    }

    const confirmedTs = item.kind === 'app_state'
      ? await saveToSupabase(item.key, item.value, item.ts)
      : await upsertOrderLineState(item.productId, item.fields, item.ts);

    if (confirmedTs) {
      removeQueueItem(item.id, confirmedTs);
      saved += 1;
      callbacks.onSaved?.(item.id, confirmedTs);
    } else {
      failed += 1;
      callbacks.onPending?.(item.id, item.ts, getReliablePendingSaveCount(), true);
    }
  }

  return {
    attempted: queuedItems.length,
    saved,
    discarded,
    failed,
    pending: getReliablePendingSaveCount(),
  };
};
