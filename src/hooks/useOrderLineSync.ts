import { useCallback, useRef, useState } from 'react';
import { CURRENT_SITE_ID } from '../constants';
import type { ProductWithHistory } from '../data';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import type { OrderLineField, OrderLineState, OrderState } from '../types';
import {
  deleteOrderLineState,
  loadOrderLineStates,
  type OrderLineStateRow,
} from '../utils/supabase';
import {
  scheduleReliableOrderLineSave,
  type ReliableSaveFailureReason,
} from '../utils/reliableSaveQueue';
import { nowIso } from './appStateHelpers';
import {
  buildLegacyOrderLineStateMap,
  getOrderLineSaveId,
  getProductIdFromOrderLineSaveId,
  mergeOrderLineRows,
  toOrderLinePatch,
} from './orderLineSyncModel';

type SaveLifecycleCallbacks = {
  markSaveStarted: (id: string, ts: string) => void;
  markSaveConfirmed: (id: string, confirmedTs: string) => void;
  markSavePending: (id: string, localTs: string, pending: number, persistedLocally: boolean) => void;
  markSaveError: (id: string, localTs: string, reason: ReliableSaveFailureReason, pending: number) => void;
};

type HydrateOrderLinesOptions = {
  isReconnect?: boolean;
  legacyProducts?: ProductWithHistory[];
  legacyOrderStates?: Record<string, OrderState>;
};

type OrderLineRealtimePayload = {
  eventType?: string;
  old?: unknown;
  new?: unknown;
};

export const useOrderLineSync = ({
  markSaveStarted,
  markSaveConfirmed,
  markSavePending,
  markSaveError,
}: SaveLifecycleCallbacks) => {
  const [orderLineStates, setOrderLineStates] = useState<Record<string, OrderLineState>>({});
  const orderLineLocalTsByProductId = useRef<Record<string, string>>({});
  const orderLineCloudTsByProductId = useRef<Record<string, string>>({});

  const applyOrderLineRows = useCallback((rows: OrderLineStateRow[]) => {
    if (rows.length === 0) return;

    setOrderLineStates(previous => {
      const { next, acceptedCloudTsByProductId } = mergeOrderLineRows(
        previous,
        rows,
        orderLineLocalTsByProductId.current,
      );
      Object.assign(orderLineCloudTsByProductId.current, acceptedCloudTsByProductId);
      return next;
    });
  }, []);

  const removeOrderLineRowLocally = useCallback((productId: string) => {
    setOrderLineStates(previous => {
      if (!(productId in previous)) return previous;
      const next = { ...previous };
      delete next[productId];
      return next;
    });
    delete orderLineLocalTsByProductId.current[productId];
    delete orderLineCloudTsByProductId.current[productId];
  }, []);

  const updateOrderLineField = useCallback((
    productId: string,
    field: OrderLineField,
    value: number | '',
  ) => {
    const ts = nowIso();
    const saveId = getOrderLineSaveId(productId);
    orderLineLocalTsByProductId.current[productId] = ts;
    setOrderLineStates(previous => ({
      ...previous,
      [productId]: { ...previous[productId], [field]: value, updatedAt: ts },
    }));

    if (!isSupabaseConfigured()) return;

    markSaveStarted(saveId, ts);
    scheduleReliableOrderLineSave(
      productId,
      toOrderLinePatch(field, value),
      ts,
      {
        onSaved: (_id, confirmedTs) => {
          orderLineCloudTsByProductId.current[productId] = confirmedTs;
          markSaveConfirmed(saveId, confirmedTs);
        },
        onPending: markSavePending,
        onError: markSaveError,
      },
    );
  }, [markSaveConfirmed, markSaveError, markSavePending, markSaveStarted]);

  const deleteOrderLineForProduct = useCallback((productId: string) => {
    // Seule la suppression explicite d'un produit passe ici.
    // Aucun chargement, reconnect ou changement de site ne supprime une ligne en base.
    removeOrderLineRowLocally(productId);
    if (isSupabaseConfigured()) void deleteOrderLineState(productId);
  }, [removeOrderLineRowLocally]);

  const hydrateOrderLineStates = useCallback(async ({
    isReconnect = false,
    legacyProducts,
    legacyOrderStates,
  }: HydrateOrderLinesOptions = {}) => {
    const rows = await loadOrderLineStates();
    if (rows?.length) {
      applyOrderLineRows(rows);
      return;
    }

    // Sur reconnexion, une réponse vide ne doit jamais vider l'état déjà chargé.
    if (isReconnect) return;

    // Filet de compatibilité historique, uniquement en mémoire et uniquement
    // lorsque la table dédiée ne contient encore aucune ligne pour le site.
    const legacyMap = buildLegacyOrderLineStateMap(legacyProducts, legacyOrderStates);
    if (legacyMap) setOrderLineStates(legacyMap);
  }, [applyOrderLineRows]);

  const confirmRetriedOrderLineSave = useCallback((saveId: string, confirmedTs: string): boolean => {
    const productId = getProductIdFromOrderLineSaveId(saveId);
    if (productId === null) return false;
    orderLineCloudTsByProductId.current[productId] = confirmedTs;
    return true;
  }, []);

  const handleOrderLineRealtimePayload = useCallback((payload: OrderLineRealtimePayload) => {
    if (payload.eventType === 'DELETE') {
      const oldRow = payload.old as { site_id?: string; product_id?: string } | null;
      if (oldRow?.site_id && oldRow.site_id !== CURRENT_SITE_ID) return;
      if (oldRow?.product_id) removeOrderLineRowLocally(oldRow.product_id);
      return;
    }

    const row = payload.new as (OrderLineStateRow & { site_id?: string }) | null;
    if (row?.site_id && row.site_id !== CURRENT_SITE_ID) return;
    if (!row?.product_id || !row?.updated_at) return;
    applyOrderLineRows([row]);
  }, [applyOrderLineRows, removeOrderLineRowLocally]);

  return {
    orderLineStates,
    updateOrderLineField,
    deleteOrderLineForProduct,
    hydrateOrderLineStates,
    confirmRetriedOrderLineSave,
    handleOrderLineRealtimePayload,
  };
};
