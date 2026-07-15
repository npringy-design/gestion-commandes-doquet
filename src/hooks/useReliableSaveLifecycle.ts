import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import {
  flushReliablePendingSaves,
  getReliablePendingSaveCount,
  retryReliablePendingSaves,
  type ReliableSaveFailureReason,
} from '../utils/reliableSaveQueue';
import {
  getConfirmedSyncStatus,
  getPendingSaveFeedback,
  getSaveErrorFeedback,
  SAVED_STATUS_VISIBLE_MS,
  SAVE_PROBLEM_THROTTLE_MS,
  type SyncStatus,
} from './reliableSaveLifecycleModel';

type RetryReliableSavesOptions = {
  confirmRetriedOrderLineSave: (id: string, confirmedTs: string) => boolean;
  hydrateFromCloud: (options?: { isReconnect?: boolean }) => Promise<void>;
};

type UseReliableSaveLifecycleParams = {
  onSaveError: (message: string) => void;
  lastCloudUpdatedAtByKey: MutableRefObject<Record<string, string>>;
  localTsByKey: MutableRefObject<Record<string, string>>;
};

// Centralise le cycle de vie commun aux sauvegardes app_state et lignes de
// commande. Les hooks métier ne décident donc pas eux-mêmes des statuts,
// messages, reprises de file ou confirmations affichés à l'utilisateur.
export const useReliableSaveLifecycle = ({
  onSaveError,
  lastCloudUpdatedAtByKey,
  localTsByKey,
}: UseReliableSaveLifecycleParams) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pendingSaveCount, setPendingSaveCount] = useState(() => getReliablePendingSaveCount());

  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSaveIdsRef = useRef<Set<string>>(new Set());
  const latestSaveTsByIdRef = useRef<Record<string, string>>({});
  const lastSaveToastAtRef = useRef(0);
  const retryInFlightRef = useRef(false);

  const clearSyncTimer = useCallback(() => {
    if (!syncTimerRef.current) return;
    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = null;
  }, []);

  const notifySaveProblem = useCallback((message: string) => {
    const now = Date.now();
    if (now - lastSaveToastAtRef.current < SAVE_PROBLEM_THROTTLE_MS) return;
    lastSaveToastAtRef.current = now;
    onSaveError(message);
  }, [onSaveError]);

  const markSaveStarted = useCallback((id: string, ts: string) => {
    latestSaveTsByIdRef.current[id] = ts;
    activeSaveIdsRef.current.add(id);
    clearSyncTimer();
    setSyncStatus('saving');
  }, [clearSyncTimer]);

  const markSaveConfirmed = useCallback((id: string, confirmedTs: string) => {
    const latestTs = latestSaveTsByIdRef.current[id];
    if (latestTs && confirmedTs < latestTs) return;

    activeSaveIdsRef.current.delete(id);
    const pending = getReliablePendingSaveCount();
    setPendingSaveCount(pending);

    const status = getConfirmedSyncStatus(pending, activeSaveIdsRef.current.size);
    setSyncStatus(status);
    if (status !== 'saved') return;

    clearSyncTimer();
    syncTimerRef.current = setTimeout(() => {
      syncTimerRef.current = null;
      setSyncStatus('idle');
    }, SAVED_STATUS_VISIBLE_MS);
  }, [clearSyncTimer]);

  const markSavePending = useCallback((
    id: string,
    localTs: string,
    pending: number,
    persistedLocally: boolean,
  ) => {
    const latestTs = latestSaveTsByIdRef.current[id];
    if (!latestTs || localTs >= latestTs) activeSaveIdsRef.current.delete(id);
    setPendingSaveCount(pending);
    const feedback = getPendingSaveFeedback(persistedLocally);
    setSyncStatus(feedback.status);
    notifySaveProblem(feedback.message);
  }, [notifySaveProblem]);

  const markSaveError = useCallback((
    id: string,
    localTs: string,
    reason: ReliableSaveFailureReason,
    pending: number,
  ) => {
    const latestTs = latestSaveTsByIdRef.current[id];
    if (!latestTs || localTs >= latestTs) activeSaveIdsRef.current.delete(id);
    setPendingSaveCount(pending);
    const feedback = getSaveErrorFeedback(reason, pending);
    setSyncStatus(feedback.status);
    notifySaveProblem(feedback.message);
  }, [notifySaveProblem]);

  const retryReliableSaves = useCallback(async ({
    confirmRetriedOrderLineSave,
    hydrateFromCloud,
  }: RetryReliableSavesOptions): Promise<void> => {
    if (retryInFlightRef.current || !isSupabaseConfigured()) return;
    const queuedBeforeRetry = getReliablePendingSaveCount();
    setPendingSaveCount(queuedBeforeRetry);
    if (queuedBeforeRetry === 0) return;

    retryInFlightRef.current = true;
    clearSyncTimer();
    setSyncStatus('saving');

    try {
      const result = await retryReliablePendingSaves({
        onSaved: (id: string, confirmedTs: string) => {
          if (!confirmRetriedOrderLineSave(id, confirmedTs) && id.startsWith('app:')) {
            const key = id.slice('app:'.length);
            lastCloudUpdatedAtByKey.current[key] = confirmedTs;
            localTsByKey.current[key] = confirmedTs;
          }
          markSaveConfirmed(id, confirmedTs);
        },
        onPending: markSavePending,
        onError: markSaveError,
      });

      setPendingSaveCount(result.pending);
      if (result.saved > 0 || result.discarded > 0) {
        await hydrateFromCloud({ isReconnect: true });
      }
      if (result.pending > 0) setSyncStatus('pending');
    } finally {
      retryInFlightRef.current = false;
    }
  }, [
    clearSyncTimer,
    lastCloudUpdatedAtByKey,
    localTsByKey,
    markSaveConfirmed,
    markSaveError,
    markSavePending,
  ]);

  useEffect(() => {
    const handleHidden = () => {
      if (document.visibilityState === 'hidden') flushReliablePendingSaves();
    };
    document.addEventListener('visibilitychange', handleHidden);
    window.addEventListener('pagehide', flushReliablePendingSaves);
    return () => {
      document.removeEventListener('visibilitychange', handleHidden);
      window.removeEventListener('pagehide', flushReliablePendingSaves);
    };
  }, []);

  useEffect(() => () => clearSyncTimer(), [clearSyncTimer]);

  return {
    syncStatus,
    pendingSaveCount,
    markSaveStarted,
    markSaveConfirmed,
    markSavePending,
    markSaveError,
    retryReliableSaves,
  };
};
