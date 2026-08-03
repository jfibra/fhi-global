import "server-only"

import { SITE_URL } from "@/lib/seo"

/**
 * Shared XML builders + response helper for the sitemap-index architecture:
 * /sitemap.xml is a <sitemapindex> pointing at per-section shards
 * (/sitemap-<section>-N.xml, served by app/api/sitemap/<section>/[page] via
 * next.config rewrites) plus the Google News /news-sitemap.xml.
 */

export { SITE_URL }

export type SitemapUrl = {
  loc: string
  /** YYYY-MM-DD. Date-only on purpose — synthetic midnight timestamps read as fake to crawlers. */
  lastmod?: string
}

export type SitemapIndexEntry = {
  loc: string
  lastmod?: string
}

export type NewsSitemapItem = {
  loc: string
  title: string
  /** Full ISO 8601 with offset, e.g. 2026-08-03T13:31:04+08:00 */
  publicationDate: string
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

/** Google News sitemap (only articles from the last 48h belong here). */
export function buildNewsSitemapXml(items: NewsSitemapItem[]): string {
  const body = items
    .map(
      (item) => `  <url>
    <loc>${escapeXml(item.loc)}</loc>
    <news:news>
      <news:publication>
        <news:name>FHI Global News</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${escapeXml(item.publicationDate)}</news:publication_date>
      <news:title>${escapeXml(item.title)}</news:title>
    </news:news>
  </url>`,
    )
    .join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${body}\n</urlset>`
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
