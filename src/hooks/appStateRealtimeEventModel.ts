export type AppStateRealtimeDecision = 'ignore' | 'defer' | 'apply';

type AppStateRealtimeDecisionParams = {
  key: string;
  cloudTs: string;
  localTs?: string;
  userIsTyping: boolean;
};

const REALTIME_APP_STATE_KEYS = new Set<string>([
  'deliveryDateBySupplier',
  'nextDeliveryDateBySupplier',
]);

// Aucune clé n'est différée aujourd'hui. Le mécanisme reste explicite afin de
// préserver la file historique si une clé éditable est réactivée plus tard.
const DEFER_WHILE_TYPING = new Set<string>([]);

export const getAppStateRealtimeDecision = ({
  key,
  cloudTs,
  localTs,
  userIsTyping,
}: AppStateRealtimeDecisionParams): AppStateRealtimeDecision => {
  if (!REALTIME_APP_STATE_KEYS.has(key)) return 'ignore';
  if (localTs && localTs >= cloudTs) return 'ignore';
  if (DEFER_WHILE_TYPING.has(key) && userIsTyping) return 'defer';
  return 'apply';
};
