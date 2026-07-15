export const REALTIME_RECONNECT_DELAYS_MS = [2000, 5000, 10000] as const;

export type CloudRealtimeStatus = 'idle' | 'joined' | 'errored';

export type AppStateRealtimeEvent = {
  key: string;
  value: unknown;
  updatedAt: string;
};

type AppStateRealtimePayload = {
  new?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const getRealtimeReconnectDelay = (attempt: number): number => {
  const safeAttempt = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0;
  const index = Math.min(safeAttempt, REALTIME_RECONNECT_DELAYS_MS.length - 1);
  return REALTIME_RECONNECT_DELAYS_MS[index];
};

export const canScheduleRealtimeReconnect = (
  disposed: boolean,
  reconnectAlreadyScheduled: boolean,
): boolean => !disposed && !reconnectAlreadyScheduled;

export const isRealtimeRetryStatus = (status: string): boolean =>
  status === 'CHANNEL_ERROR' || status === 'TIMED_OUT';

export const shouldRecoverRealtimeConnection = (
  visibilityState: string,
  disposed: boolean,
  channelStatus: CloudRealtimeStatus,
): boolean => visibilityState === 'visible' && !disposed && channelStatus !== 'joined';

export const readAppStateRealtimeEvent = (
  payload: AppStateRealtimePayload,
  currentSiteId: string,
): AppStateRealtimeEvent | null => {
  if (!isRecord(payload?.new)) return null;

  const row = payload.new;
  const siteId = typeof row.site_id === 'string' ? row.site_id : undefined;
  if (siteId && siteId !== currentSiteId) return null;

  const key = typeof row.key === 'string' ? row.key.trim() : '';
  const updatedAt = typeof row.updated_at === 'string' ? row.updated_at.trim() : '';
  if (!key || !updatedAt) return null;

  return { key, value: row.value, updatedAt };
};
