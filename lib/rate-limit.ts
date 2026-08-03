import "server-only"

/**
 * Small in-memory sliding-window rate limiter for public proxy endpoints
 * (view tracking, newsletter subscribe). Per-instance on serverless — an
 * attacker spread across instances can exceed the aggregate, but this still
 * caps the per-instance amplification toward the upstream API's shared
 * 300 req/min budget, and legit users never hit it.
 */

const buckets = new Map<string, number[]>()
const MAX_BUCKETS = 5000

/** True when the caller is within `limit` hits per `windowMs` for this key. */
export function allowRequest(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const cutoff = now - windowMs

  let hits = buckets.get(key)
  if (!hits) {
    // Opportunistic cleanup so the map can't grow unbounded across a long-lived instance.
    if (buckets.size >= MAX_BUCKETS) {
      for (const [k, v] of buckets) {
        if (v.length === 0 || v[v.length - 1] < cutoff) buckets.delete(k)
        if (buckets.size < MAX_BUCKETS) break
      }
      if (buckets.size >= MAX_BUCKETS) buckets.clear()
    }
    hits = []
    buckets.set(key, hits)
  }

  while (hits.length > 0 && hits[0] < cutoff) hits.shift()
  if (hits.length >= limit) return false
  hits.push(now)
  return true
}

/** Best-effort client IP for rate-limit keys (Vercel/proxies set x-forwarded-for). */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  return headers.get("x-real-ip") ?? "unknown"
}
