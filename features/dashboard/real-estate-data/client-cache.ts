// Client-side result cache for the Real Estate Data page.
//
// The Postgres chunk cache (lib/dld-cache.ts) stops the server re-pulling
// from DLD; this stops the *page* re-asking the server at all when an admin
// opens the page, wanders off, and comes back. Entries live in module memory
// (instant within a tab) and are mirrored to sessionStorage so a full reload
// in the same tab still restores them. Everything expires after
// CLIENT_CACHE_TTL_MS; the Refresh buttons bypass it explicitly.
//
// Every read/write is wrapped: sessionStorage can be missing, full, or
// blocked, and the page must work exactly the same without it.

export const CLIENT_CACHE_TTL_MS = 30 * 60 * 1000

// Bump the version to discard everything browsers have stored (e.g. after a
// bug produced wrong cached figures).
const PREFIX = "dld:v7:"
const mem = new Map<string, { at: number; data: unknown }>()

type Entry<T> = { at: number; data: T }

function fresh(at: number): boolean {
  return Date.now() - at < CLIENT_CACHE_TTL_MS
}

export function cacheGet<T>(key: string): Entry<T> | null {
  const hit = mem.get(key)
  if (hit && fresh(hit.at)) return hit as Entry<T>
  try {
    const raw = sessionStorage.getItem(PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Entry<T>
    if (!parsed || typeof parsed.at !== "number" || !fresh(parsed.at)) return null
    mem.set(key, parsed)
    return parsed
  } catch {
    return null
  }
}

export function cacheSet<T>(key: string, data: T): Entry<T> {
  const entry: Entry<T> = { at: Date.now(), data }
  mem.set(key, entry)
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(entry))
  } catch {
    /* quota / private mode — memory copy still works */
  }
  return entry
}

export function cacheDelete(key: string): void {
  mem.delete(key)
  try {
    sessionStorage.removeItem(PREFIX + key)
  } catch {
    /* ignore */
  }
}

/** "just now", "4 min ago", "2 h ago" for the "updated …" labels. */
export function agoLabel(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 45) return "just now"
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  return `${h} h ago`
}
