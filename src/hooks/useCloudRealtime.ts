import { useEffect, useRef } from 'react';
import { CURRENT_SITE_ID } from '../constants';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { getReliablePendingSaveCount } from '../utils/reliableSaveQueue';
import {
  canScheduleRealtimeReconnect,
  getRealtimeReconnectDelay,
  isRealtimeRetryStatus,
  readAppStateRealtimeEvent,
  shouldRecoverRealtimeConnection,
  type CloudRealtimeStatus,
} from './cloudRealtimeModel';

type RehydrateOptions = { isReconnect?: boolean };

type UseCloudRealtimeParams = {
  enabled: boolean;
  onAppStateChange: (key: string, cloudTs: string, value: unknown) => void;
  onOrderLineChange: (payload: any) => void;
  flushPendingAppState: () => void;
  hydrateFromCloud: (options?: RehydrateOptions) => Promise<void>;
  retryQueuedSaves: () => Promise<void>;
};

export const useCloudRealtime = ({
  enabled,
  onAppStateChange,
  onOrderLineChange,
  flushPendingAppState,
  hydrateFromCloud,
  retryQueuedSaves,
}: UseCloudRealtimeParams): void => {
  const channelRef = useRef<any>(null);
  const channelStatusRef = useRef<CloudRealtimeStatus>('idle');
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!enabled || !isSupabaseConfigured() || !client) return;

    let disposed = false;
    let networkRecoveryInFlight = false;

    function clearReconnectTimer(): void {
      if (!reconnectTimerRef.current) return;
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    function closeCurrentChannel(): void {
      const currentChannel = channelRef.current;
      if (!currentChannel) return;
      channelRef.current = null;
      void client.removeChannel(currentChannel);
    }

    function scheduleReconnect(): void {
      if (!canScheduleRealtimeReconnect(disposed, Boolean(reconnectTimerRef.current))) return;

      const attempt = reconnectAttemptRef.current;
      reconnectAttemptRef.current = attempt + 1;
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        if (!disposed) openChannel();
      }, getRealtimeReconnectDelay(attempt));
    }

    function openChannel(): void {
      if (disposed) return;

      // Toujours fermer l'ancien canal avant d'en créer un autre : une seule
      // souscription peut donc rester active pour ce hook.
      closeCurrentChannel();
      channelStatusRef.current = 'idle';

      const channel = client
        .channel(`app_state_sync:${CURRENT_SITE_ID}`)
        .on(
          'postgres_changes' as any,
          { event: '*', schema: 'public', table: 'app_state', filter: `site_id=eq.${CURRENT_SITE_ID}` },
          (payload: unknown) => {
            const event = readAppStateRealtimeEvent(
              payload as { new?: unknown },
              CURRENT_SITE_ID,
            );
            if (!event) return;
            onAppStateChange(event.key, event.updatedAt, event.value);
          },
        )
        .on(
          'postgres_changes' as any,
          {
            event: '*',
            schema: 'public',
            table: 'order_line_states',
            filter: `site_id=eq.${CURRENT_SITE_ID}`,
          },
          (payload: unknown) => onOrderLineChange(payload),
        )
        .subscribe((status: string) => {
          if (disposed) return;

          if (status === 'SUBSCRIBED') {
            channelStatusRef.current = 'joined';
            reconnectAttemptRef.current = 0;
            clearReconnectTimer();
            console.log('[Realtime] ✅ Connecté — sync instantanée active');
          } else if (isRealtimeRetryStatus(status)) {
            channelStatusRef.current = 'errored';
            console.warn(`[Realtime] ⚠️ ${status}, reconnexion programmée...`);
            scheduleReconnect();
          } else if (status === 'CLOSED') {
            channelStatusRef.current = 'idle';
          }
        });

      channelRef.current = channel;
    }

    const recoverLatestCloudState = async (): Promise<void> => {
      if (disposed || networkRecoveryInFlight) return;
      networkRecoveryInFlight = true;

      try {
        // Les saisies locales hors connexion sont renvoyées en premier. Le
        // rechargement suivant récupère ensuite l'état final confirmé du site.
        if (getReliablePendingSaveCount() > 0) await retryQueuedSaves();
        await hydrateFromCloud({ isReconnect: true });
      } finally {
        networkRecoveryInFlight = false;
      }
    };

    const handleNetworkOnline = (): void => {
      if (disposed) return;

      // Le navigateur peut encore considérer l'ancien canal comme « joined »
      // après un mode avion. On le recrée volontairement, puis on recharge les
      // données manquées pendant la coupure.
      reconnectAttemptRef.current = 0;
      clearReconnectTimer();
      openChannel();
      void recoverLatestCloudState();
    };

    openChannel();
    window.addEventListener('focusout', flushPendingAppState);
    window.addEventListener('online', handleNetworkOnline);

    const handleVisibilityChange = (): void => {
      const visible = document.visibilityState === 'visible' && !disposed;
      if (!visible) return;

      if (shouldRecoverRealtimeConnection(
        document.visibilityState,
        disposed,
        channelStatusRef.current,
      )) {
        reconnectAttemptRef.current = 0;
        clearReconnectTimer();
        openChannel();
      }

      // Même si le canal se croit encore connecté, un mobile peut avoir raté
      // des événements pendant l'arrière-plan ou une coupure réseau.
      void recoverLatestCloudState();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      clearReconnectTimer();
      closeCurrentChannel();
      window.removeEventListener('focusout', flushPendingAppState);
      window.removeEventListener('online', handleNetworkOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    enabled,
    flushPendingAppState,
    hydrateFromCloud,
    onAppStateChange,
    onOrderLineChange,
    retryQueuedSaves,
  ]);
};