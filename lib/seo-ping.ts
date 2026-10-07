/**
 * Fire-and-forget publish-time SEO hook. Project, developer, and agent-listing
 * publishes run client-side through the browser Supabase client, so the server
 * never sees the moment content goes live — this tells it. The route
 * (app/api/seo/revalidate) purges the entity's ISR cache and, when the entity
 * is publicly visible or has just been taken down, pings IndexNow. Failures are
 * swallowed: SEO plumbing must never break a publish.
 */
// Pending coalesced pings by `${kind}:${id}` (one timer each).
const pending = new Map<string, number>()

export type SeoPingOptions = {
  /**
   * Wait this long and send ONE ping for a burst of calls — editing ten unit rows in a row should purge
   * the page once, not ten times. Publish, unpublish and delete pings stay immediate.
   */
  coalesceMs?: number
  /**
   * This change takes the page OFF the site (unpublish, deactivate, delete). The server cannot tell a removal
   * from an edit to a draft that was never online — both leave a non-public row — and only a removal is worth
   * an IndexNow notice (submitting the 404 URLs of drafts that were never public is what gets a key
   * rate-limited). Always sent at once, and it supersedes any burst still waiting for its timer.
   */
  removed?: boolean
  /**
   * The slug this project or developer had BEFORE the change, when the change renamed it. There is no redirect
   * table, so the old address now 404s: the server purges it and tells IndexNow it is gone (and, for a developer,
   * moves every project URL under it too). Only the editor that did the rename knows the old value.
   */
  fromSlug?: string
}

export function pingSeoRevalidate(
  kind: "project" | "developer" | "agent-listing",
  id: string | number,
  options: SeoPingOptions = {},
): void {
  const key = `${kind}:${id}`
  const send = () => {
    try {
      void fetch("/api/seo/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          id: String(id),
          ...(options.removed ? { removed: true } : {}),
          ...(options.fromSlug ? { fromSlug: options.fromSlug } : {}),
        }),
        // Survives page navigations right after a publish click.
        keepalive: true,
      }).catch(() => {})
    } catch {
      // e.g. called in a non-browser context — ignore.
    }
  }

  const waiting = typeof window === "undefined" ? undefined : pending.get(key)
  if (!options.coalesceMs || options.removed || typeof window === "undefined") {
    // An immediate ping purges the same page the waiting one would: drop the timer instead of sending twice.
    if (waiting !== undefined) {
      window.clearTimeout(waiting)
      pending.delete(key)
    }
    send()
    return
  }
  if (waiting !== undefined) window.clearTimeout(waiting)
  pending.set(
    key,
    window.setTimeout(() => {
      pending.delete(key)
      send()
    }, options.coalesceMs),
  )
}
