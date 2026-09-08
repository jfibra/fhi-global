import "server-only"

import { SITE_URL } from "@/lib/seo"

/**
 * Shared XML builders + response helper for the sitemap-index architecture:
 * /sitemap.xml is a <sitemapindex> pointing at per-section shards
 * (/sitemap-<section>-N.xml, served by app/api/sitemap/<section>/[page] via
 * next.config rewrites).
 */

export { SITE_URL }

/**
 * lastmod for the static-pages shard AND its entry in the sitemap index.
 * Single source of truth — bump when the static pages list meaningfully
 * changes (the two consumers previously kept hand-maintained copies that
 * drifted apart).
 */
export const PAGES_LASTMOD = "2026-08-11"

export type SitemapUrl = {
  loc: string
  /** YYYY-MM-DD. Date-only on purpose — synthetic midnight timestamps read as fake to crawlers. */
  lastmod?: string
}

export type SitemapIndexEntry = {
  loc: string
  lastmod?: string
}

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * <urlset> with loc + lastmod only. changefreq/priority are deliberately not
 * emitted — Google ignores both when lastmod is present.
 */
export function buildUrlsetXml(urls: SitemapUrl[]): string {
  const items = urls
    .map((u) => {
      const lastmod = u.lastmod ? `\n    <lastmod>${escapeXml(u.lastmod)}</lastmod>` : ""
      return `  <url>\n    <loc>${escapeXml(u.loc)}</loc>${lastmod}\n  </url>`
    })
    .join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>`
}

export function buildSitemapIndexXml(sitemaps: SitemapIndexEntry[]): string {
  const items = sitemaps
    .map((s) => {
      const lastmod = s.lastmod ? `\n    <lastmod>${escapeXml(s.lastmod)}</lastmod>` : ""
      return `  <sitemap>\n    <loc>${escapeXml(s.loc)}</loc>${lastmod}\n  </sitemap>`
    })
    .join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>`
}

/**
 * XML response with CDN caching. Normal: 1h + a day of stale-while-revalidate.
 * shortCache (degraded upstream or empty result): 60s, so the file self-heals
 * quickly once data is available again.
 */
export function sitemapResponse(xml: string, opts: { shortCache?: boolean } = {}): Response {
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": opts.shortCache
        ? "public, max-age=60, s-maxage=60"
        : "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}

/**
 * Transient-failure answer for an ADVERTISED shard: 503 + Retry-After, never
 * 404 — crawlers treat 5xx as "try again", while a 404 on a URL the index
 * advertises reads as removed content.
 */
export function sitemapUnavailableResponse(): Response {
  return new Response("Sitemap temporarily unavailable", {
    status: 503,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=60",
      "Retry-After": "300",
    },
  })
}
