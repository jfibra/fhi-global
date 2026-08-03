import "server-only"

import { SITE_URL } from "@/lib/seo"

/**
 * IndexNow submission (Bing/Yandex/Seznam instant indexing; Google ignores it).
 * The key file is served from /indexnow.txt on this origin. Silent no-op when
 * INDEXNOW_KEY is unset — the feature is env-gated like the news integration.
 */

const ENDPOINT = "https://api.indexnow.org/IndexNow"
const BATCH_SIZE = 1000

export function indexNowConfigured(): boolean {
  return Boolean(process.env.INDEXNOW_KEY)
}

export function indexNowKey(): string {
  return process.env.INDEXNOW_KEY ?? ""
}

/**
 * Submit URLs (same-origin only) to IndexNow. Fire-and-forget safe: never
 * throws, returns the number of URLs actually submitted.
 */
export async function submitToIndexNow(urls: string[]): Promise<number> {
  if (!indexNowConfigured()) return 0

  const host = new URL(SITE_URL).host
  const sameHost = [...new Set(urls)].filter((u) => {
    try {
      return new URL(u).host === host
    } catch {
      return false
    }
  })
  if (sameHost.length === 0) return 0

  let submitted = 0
  for (let i = 0; i < sameHost.length; i += BATCH_SIZE) {
    const batch = sameHost.slice(i, i + BATCH_SIZE)
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        cache: "no-store",
        body: JSON.stringify({
          host,
          key: indexNowKey(),
          keyLocation: `${SITE_URL}/indexnow.txt`,
          urlList: batch,
        }),
      })
      if (res.ok || res.status === 202) submitted += batch.length
    } catch {
      // best-effort — a failed ping must never break the caller
    }
  }
  return submitted
}
