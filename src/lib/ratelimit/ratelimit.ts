import "server-only";

/**
 * Simple in-memory sliding-window rate limiter.
 * Suitable for dev / single-instance deployments.
 * Swap for Upstash/Redis in production.
 */
interface Bucket {
  tokens: number[];
}
const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  const bucket = buckets.get(key) ?? { tokens: [] };
  bucket.tokens = bucket.tokens.filter((t) => t > cutoff);
  if (bucket.tokens.length >= limit) {
    buckets.set(key, bucket);
    const earliest = bucket.tokens[0];
    return { allowed: false, remaining: 0, resetAt: earliest + windowMs };
  }
  bucket.tokens.push(now);
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: limit - bucket.tokens.length,
    resetAt: now + windowMs,
  };
}
