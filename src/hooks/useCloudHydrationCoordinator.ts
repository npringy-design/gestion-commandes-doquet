import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProductWithHistory } from '../data';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import type { OrderState } from '../types';
import { loadAllFromSupabase } from '../utils/supabase';
import type { AppStateCloudRow } from './appStateSyncModel';

type HydrateFromCloudOptions = { isReconnect?: boolean };

type HydrateOrderLineStatesOptions = HydrateFromCloudOptions & {
  legacyProducts?: ProductWithHistory[];
  legacyOrderStates?: Record<string, OrderState>;
};

type RetryReliableSavesOptions = {
  confirmRetriedOrderLineSave: (id: string, confirmedTs: string) => boolean;
  hydrateFromCloud: (options?: HydrateFromCloudOptions) => Promise<void>;
};

type UseCloudHydrationCoordinatorParams = {
  hydrateAppStateRows: (
    rows: AppStateCloudRow[] | null | undefined,
  ) => Record<string, unknown>;
  hydrateOrderLineStates: (options?: HydrateOrderLineStatesOptions) => Promise<void>;
  confirmRetriedOrderLineSave: (id: string, confirmedTs: string) => boolean;
  retryReliableSaves: (options: RetryReliableSavesOptions) => Promise<void>;
};

// Ordonne le chargement initial et les reprises après reconnexion : app_state
// est appliqué avant les lignes de commande, et les sauvegardes locales en
// attente sont toujours reprises avec le même rechargement cloud sécurisé.
export const useCloudHydrationCoordinator = ({
  hydrateAppStateRows,
  hydrateOrderLineStates,
  confirmRetriedOrderLineSave,
  retryReliableSaves,
}: UseCloudHydrationCoordinatorParams) => {
  const [supabaseLoaded, setSupabaseLoaded] = useState(false);
  const initialCloudLoadSucceededRef = useRef(false);

  const hydrateFromCloud = useCallback(async (
    options: HydrateFromCloudOptions = {},
  ): Promise<void> => {
    if (!isSupabaseConfigured()) {
      setSupabaseLoaded(true);
      return;
    }

    try {
      const cloud = await loadAllFromSupabase();
      initialCloudLoadSucceededRef.current = cloud !== null;
      const cloudValues = hydrateAppStateRows(cloud);

      await hydrateOrderLineStates({
        isReconnect: options.isReconnect,
        legacyProducts: cloudValues.products as ProductWithHistory[] | undefined,
        legacyOrderStates: cloudValues.orderStates as Record<string, OrderState> | undefined,
      });
    } catch (error) {
      console.error('[Supabase load exception]', error);
    } finally {
      setSupabaseLoaded(true);
    }
  }, [hydrateAppStateRows, hydrateOrderLineStates]);

  useEffect(() => {
    void hydrateFromCloud();
  }, [hydrateFromCloud]);

  const retryQueuedSaves = useCallback(async (): Promise<void> => {
    await retryReliableSaves({
      confirmRetriedOrderLineSave,
      hydrateFromCloud,
    });
  }, [
    confirmRetriedOrderLineSave,
    hydrateFromCloud,
    retryReliableSaves,
  ]);

  useEffect(() => {
    if (!supabaseLoaded || !isSupabaseConfigured()) return;
    void retryQueuedSaves();
    const handleOnline = () => { void retryQueuedSaves(); };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [retryQueuedSaves, supabaseLoaded]);

  return {
    supabaseLoaded,
    initialCloudLoadSucceededRef,
    hydrateFromCloud,
    retryQueuedSaves,
  };
};
