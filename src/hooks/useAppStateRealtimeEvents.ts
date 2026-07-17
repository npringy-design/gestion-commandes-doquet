import { useCallback, useRef, type MutableRefObject } from 'react';
import { getAppStateRealtimeDecision } from './appStateRealtimeEventModel';

type PendingRealtimeValue = { ts: string; value: unknown };

type UseAppStateRealtimeEventsParams = {
  applyCloudAppStateValue: (key: string, cloudTs: string, value: unknown) => boolean;
  lastCloudUpdatedAtByKey: MutableRefObject<Record<string, string>>;
  localTsByKey: MutableRefObject<Record<string, string>>;
};

const isUserTyping = (): boolean => {
  const element = document?.activeElement as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return tag === 'INPUT'
    || tag === 'TEXTAREA'
    || tag === 'SELECT'
    || Boolean((element as HTMLElement & { isContentEditable?: boolean }).isContentEditable);
};

// Filtre et applique les événements app_state déjà validés par le canal
// Realtime, sans posséder de setter métier ni effectuer d'écriture Supabase.
export const useAppStateRealtimeEvents = ({
  applyCloudAppStateValue,
  lastCloudUpdatedAtByKey,
  localTsByKey,
}: UseAppStateRealtimeEventsParams) => {
  const pendingRealtimeRef = useRef<Map<string, PendingRealtimeValue>>(new Map());

  const flushPendingAppState = useCallback(() => {
    if (pendingRealtimeRef.current.size === 0) return;
    setTimeout(() => {
      if (isUserTyping()) return;
      pendingRealtimeRef.current.forEach(({ ts, value }, key) => {
        applyCloudAppStateValue(key, ts, value);
      });
      pendingRealtimeRef.current.clear();
    }, 150);
  }, [applyCloudAppStateValue]);

  const handleAppStateRealtimeEvent = useCallback((
    key: string,
    cloudTs: string,
    value: unknown,
  ) => {
    const decision = getAppStateRealtimeDecision({
      key,
      cloudTs,
      localTs: localTsByKey.current[key],
      userIsTyping: isUserTyping(),
    });
    if (decision === 'ignore') return;

    lastCloudUpdatedAtByKey.current[key] = cloudTs;
    if (decision === 'defer') {
      const existing = pendingRealtimeRef.current.get(key);
      if (!existing || cloudTs > existing.ts) {
        pendingRealtimeRef.current.set(key, { ts: cloudTs, value });
      }
      return;
    }

    applyCloudAppStateValue(key, cloudTs, value);
  }, [applyCloudAppStateValue, lastCloudUpdatedAtByKey, localTsByKey]);

  return {
    flushPendingAppState,
    handleAppStateRealtimeEvent,
  };
};
