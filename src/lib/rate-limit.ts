import "server-only";

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

// In-memory registry mapping IPs to bucket states
const buckets = new Map<string, RateLimitBucket>();

const BUCKET_LIMIT = 100; // Maximum allowed burst requests
const WINDOW_MS = 60 * 1000; // Window size: 1 minute
const REFILL_RATE = BUCKET_LIMIT / WINDOW_MS; // Token replenishment speed per ms

/**
 * Executes a token bucket check for rate limiting.
 * Returns information on success, limit bounds, remaining token allocation, and reset timestamps.
 */
export function rateLimitCheck(ip: string): {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
} {
  const now = Date.now();
  let bucket = buckets.get(ip);

  if (!bucket) {
    bucket = { tokens: BUCKET_LIMIT, lastRefill: now };
    buckets.set(ip, bucket);
  }

  // Refill tokens based on time passed
  const elapsed = now - bucket.lastRefill;
  const refillTokens = elapsed * REFILL_RATE;
  bucket.tokens = Math.min(BUCKET_LIMIT, bucket.tokens + refillTokens);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return {
      success: true,
      limit: BUCKET_LIMIT,
      remaining: Math.floor(bucket.tokens),
      reset: Math.ceil((BUCKET_LIMIT - bucket.tokens) / REFILL_RATE),
    };
  }

  return {
    success: false,
    limit: BUCKET_LIMIT,
    remaining: 0,
    reset: Math.ceil((1 - bucket.tokens) / REFILL_RATE),
  };
}
