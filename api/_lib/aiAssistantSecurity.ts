export const AI_ASSISTANT_MAX_BODY_BYTES = 32_000;
export const AI_ASSISTANT_RATE_LIMIT_MAX = 12;
export const AI_ASSISTANT_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
export const AI_ASSISTANT_TIMEOUT_MS = 30_000;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

export const createFixedWindowRateLimiter = (
  maxRequests = AI_ASSISTANT_RATE_LIMIT_MAX,
  windowMs = AI_ASSISTANT_RATE_LIMIT_WINDOW_MS,
) => {
  const buckets = new Map<string, RateLimitBucket>();

  const pruneExpiredBuckets = (now: number) => {
    if (buckets.size < 500) return;
    buckets.forEach((bucket, key) => {
      if (bucket.resetAt <= now) buckets.delete(key);
    });
  };

  const consume = (key: string, now = Date.now()): RateLimitDecision => {
    pruneExpiredBuckets(now);
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;

    if (bucket.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: bucket.resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      };
    }

    bucket.count += 1;
    buckets.set(key, bucket);
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - bucket.count),
      resetAt: bucket.resetAt,
      retryAfterSeconds: 0,
    };
  };

  return { consume };
};

const aiAssistantRateLimiter = createFixedWindowRateLimiter();

export const consumeAiAssistantRateLimit = (userId: string, now = Date.now()) =>
  aiAssistantRateLimiter.consume(userId, now);

export const readRequestContentLength = (req: any): number | null => {
  const raw = req.headers?.['content-length'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};
