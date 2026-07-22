// Minimal in-memory sliding-window rate limiter. This is defense-in-depth for a
// single-instance self-hosted deployment — state lives in the process and is NOT
// shared across replicas or restarts. For multi-instance setups, front the app
// with a real limiter (e.g. Caddy rate_limit or a Redis-backed limiter).

type Window = { count: number; resetAt: number };
const buckets = new Map<string, Window>();

/**
 * Records a hit for `key` and reports whether it is within `limit` per `windowMs`.
 * Fails open only when the key is fresh; otherwise counts strictly.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now();

  // Opportunistic cleanup so the map can't grow unbounded across many keys.
  if (buckets.size > 10_000) {
    for (const [k, w] of buckets) if (w.resetAt <= now) buckets.delete(k);
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }
  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSeconds: 0 };
}

/** Best-effort client IP from proxy headers (Caddy sets X-Forwarded-For). */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}
