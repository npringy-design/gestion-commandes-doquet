import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProductWithHistory } from '../data';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import type { OrderState } from '../types';
import { loadAllFromSupabase } from '../utils/supabase';
import type { AppStateCloudRow } from './appStateSyncModel';
import { createIdleDeferral } from './idleDeferralModel';
import { isUserTyping } from './useAppStateRealtimeEvents';

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

  // Une reprise après coupure ou retour d'onglet remplace l'état local par celui
  // du cloud : elle est repoussée tant qu'un champ est en cours d'édition, puis
  // exécutée à la perte de focus. Le chargement initial n'est jamais différé.
  const idleDeferralRef = useRef<ReturnType<typeof createIdleDeferral> | null>(null);
  if (!idleDeferralRef.current) {
    idleDeferralRef.current = createIdleDeferral({
      isBusy: isUserTyping,
      subscribe: (onActivity) => {
        window.addEventListener('focusout', onActivity);
        return () => window.removeEventListener('focusout', onActivity);
      },
    });
  }
  useEffect(() => () => idleDeferralRef.current?.dispose(), []);

  const loadFromCloud = useCallback(async (
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

  const hydrateFromCloud = useCallback(async (
    options: HydrateFromCloudOptions = {},
  ): Promise<void> => {
    if (options.isReconnect && isUserTyping()) {
      idleDeferralRef.current?.runOrDefer(() => { void loadFromCloud(options); });
      return;
    }
    await loadFromCloud(options);
  }, [loadFromCloud]);

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
