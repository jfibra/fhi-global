import {
  SITE_URL,
  buildSitemapIndexXml,
  sitemapResponse,
  todayISO,
  type SitemapIndexEntry,
} from "@/lib/sitemap-helpers"
import { countNewsShards, countSection, SUPABASE_PER_PAGE } from "@/lib/sitemap-sections"
import { newsConfigured } from "@/lib/news-service"

/**
 * /sitemap.xml — the <sitemapindex>. Sections are advertised only when they
 * have rows, so no advertised shard can 404. Generated at request time
 * (force-dynamic) so a deploy never bakes in a degraded index; the CDN
 * Cache-Control from sitemapResponse (1h, or 60s when any count fetch failed)
 * is what actually bounds regeneration. Do NOT export `revalidate` here —
 * it would fight the hand-set Cache-Control.
 */
export const dynamic = "force-dynamic"

// Bumped when the static pages list meaningfully changes.
const PAGES_LASTMOD = "2026-08-03"

function appendPaginated(
  sitemaps: SitemapIndexEntry[],
  prefix: string,
  shardCount: number | null,
  lastmod: string,
) {
  if (shardCount === null || shardCount <= 0) return
  for (let i = 1; i <= shardCount; i++) {
    sitemaps.push({ loc: `${SITE_URL}/${prefix}-${i}.xml`, lastmod })
  }
}

export async function GET() {
  const [projects, developers, listings, events, newsShards] = await Promise.all([
    countSection("projects"),
    countSection("developers"),
    countSection("listings"),
    countSection("events"),
    countNewsShards(),
  ])

  const degraded =
    projects === null || developers === null || listings === null || events === null || newsShards === null

  const shards = (count: number | null) =>
    count === null ? null : Math.ceil(count / SUPABASE_PER_PAGE)

  const lastmod = todayISO()
  const sitemaps: SitemapIndexEntry[] = [
    { loc: `${SITE_URL}/sitemap-pages-1.xml`, lastmod: PAGES_LASTMOD },
  ]
  appendPaginated(sitemaps, "sitemap-projects", shards(projects), lastmod)
  appendPaginated(sitemaps, "sitemap-developers", shards(developers), lastmod)
  appendPaginated(sitemaps, "sitemap-listings", shards(listings), lastmod)
  appendPaginated(sitemaps, "sitemap-events", shards(events), lastmod)
  appendPaginated(sitemaps, "sitemap-news", newsShards, lastmod)
  // Google News sitemap only exists meaningfully when the news feature is on.
  if (newsConfigured()) {
    sitemaps.push({ loc: `${SITE_URL}/news-sitemap.xml`, lastmod })
  }

  return sitemapResponse(buildSitemapIndexXml(sitemaps), { shortCache: degraded })
}
