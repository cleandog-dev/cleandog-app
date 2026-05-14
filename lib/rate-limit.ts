// Lightweight in-memory rate limiter (per-process). Good enough for a single instance.
// For multi-instance / Vercel-edge, swap to Upstash Redis.

interface Bucket {
  tokens: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(opts.key);

  if (!existing || existing.resetAt <= now) {
    const fresh: Bucket = { tokens: opts.limit - 1, resetAt: now + opts.windowMs };
    buckets.set(opts.key, fresh);
    return { ok: true, remaining: fresh.tokens, resetAt: fresh.resetAt };
  }

  if (existing.tokens <= 0) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.tokens -= 1;
  return { ok: true, remaining: existing.tokens, resetAt: existing.resetAt };
}

// Periodically clean expired buckets (best-effort).
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }, 60_000).unref?.();
}
