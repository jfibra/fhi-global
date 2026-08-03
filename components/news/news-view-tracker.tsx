"use client"

import { useEffect } from "react"

/**
 * Fire-and-forget read receipt for a news article. Posts to our own
 * /api/news/view proxy (the site key stays server-side) with a stable
 * per-visitor id so the upstream 12h dedup counts real readers instead of
 * collapsing everyone onto the server's IP. Session-guarded so client-side
 * back/forward navigation doesn't re-fire.
 */
export function NewsViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    if (!slug) return
    try {
      const sessionKey = `fhi_viewed_${slug}`
      if (sessionStorage.getItem(sessionKey)) return
      sessionStorage.setItem(sessionKey, "1")

      let visitorId = localStorage.getItem("fhi_news_visitor_id")
      if (!visitorId) {
        visitorId = crypto.randomUUID()
        localStorage.setItem("fhi_news_visitor_id", visitorId)
      }

      void fetch("/api/news/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          slug,
          placement: "article",
          referrer: document.referrer || undefined,
          visitor_id: visitorId,
        }),
      }).catch(() => {})
    } catch {
      // storage unavailable (private mode etc.) — tracking is best-effort
    }
  }, [slug])

  return null
}
