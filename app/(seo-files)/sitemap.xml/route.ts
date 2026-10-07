import {
  SITE_URL,
  buildSitemapIndexXml,
  sitemapResponse,
  type SitemapIndexEntry,
} from "@/lib/sitemap-helpers"
import {
  countSection,
  fetchAgentEventPaths,
  fetchAgentSiteRows,
  latestUpdatedAt,
  newsShardInfo,
  SUPABASE_PER_PAGE,
} from "@/lib/sitemap-sections"
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

function appendPaginated(
  sitemaps: SitemapIndexEntry[],
  prefix: string,
  shardCount: number | null,
  lastmod: string | undefined,
) {
  if (shardCount === null || shardCount <= 0) return
  for (let i = 1; i <= shardCount; i++) {
    // The date is the whole SECTION's newest change. With one shard that is the shard's own date; with several
    // it would be stamped on every shard, including those that did not change — so then none is claimed.
    sitemaps.push({ loc: `${SITE_URL}/${prefix}-${i}.xml`, lastmod: shardCount === 1 ? lastmod : undefined })
  }
}

export async function GET() {
  const [projects, developers, listings, events, gallery, news, agentEvents, agentSites, lastmods] = await Promise.all([
    countSection("projects"),
    countSection("developers"),
    countSection("listings"),
    countSection("events"),
    countSection("gallery"),
    newsShardInfo(),
    fetchAgentEventPaths(),
    fetchAgentSiteRows(),
    // Each entry says when its section last REALLY changed. The index used to
    // stamp today's date on six of eight entries, so crawlers learned to ignore
    // every lastmod the site sent. A section with no known date carries none.
    Promise.all((["projects", "developers", "listings", "events", "gallery"] as const).map((s) => latestUpdatedAt(s))),
  ])
  const [projectsMod, developersMod, listingsMod, eventsMod, galleryMod] = lastmods

  const degraded =
    projects === null ||
    developers === null ||
    listings === null ||
    events === null ||
    gallery === null ||
    news === null ||
    agentEvents === null ||
    agentSites === null

  const shards = (count: number | null) =>
    count === null ? null : Math.ceil(count / SUPABASE_PER_PAGE)

  // The static-pages shard has no lastmod: its dates live in code, not data, and
  // a frozen "2026-09-08" on 52 URLs was already untrue (pages had changed since).
  const sitemaps: SitemapIndexEntry[] = [{ loc: `${SITE_URL}/sitemap-pages-1.xml` }]
  appendPaginated(sitemaps, "sitemap-projects", shards(projects), projectsMod)
  appendPaginated(sitemaps, "sitemap-developers", shards(developers), developersMod)
  appendPaginated(sitemaps, "sitemap-listings", shards(listings), listingsMod)
  // Agents' own events (057) ride on events shard 1, so it must exist even
  // when there are no company events.
  const eventShards = shards(events)
  appendPaginated(
    sitemaps,
    "sitemap-events",
    eventShards === null ? null : Math.max(eventShards, agentEvents?.length ? 1 : 0),
    // Agents' website-only events ride on shard 1 too: the newest of either source.
    [eventsMod, ...(agentEvents ?? []).map((e) => e.updated_at?.slice(0, 10))].filter((d): d is string => Boolean(d)).sort().at(-1),
  )
  appendPaginated(sitemaps, "sitemap-gallery", shards(gallery), galleryMod)
  appendPaginated(sitemaps, "sitemap-news", news === null ? null : news.shards, news?.lastmod)
  // The agents' own sites — only the ones that are really theirs (see lib/agent-site.ts).
  appendPaginated(
    sitemaps,
    "sitemap-agent-sites",
    agentSites === null ? null : Math.min(1, Math.ceil(agentSites.length / SUPABASE_PER_PAGE)),
    agentSites?.map((r) => r.updated_at?.slice(0, 10) ?? "").sort().at(-1) || undefined,
  )
  // Google News sitemap only exists meaningfully when the news feature is on. It lists the last 48 hours of
  // articles, so its date is the newest article's — and only while that is recent: a quiet week leaves the
  // file empty, and "today" on an empty file is a date nothing changed on.
  if (newsConfigured()) {
    const newest = news?.lastmod
    const fresh = newest !== undefined && Date.now() - Date.parse(newest) <= 3 * 86_400_000
    sitemaps.push({ loc: `${SITE_URL}/news-sitemap.xml`, lastmod: fresh ? newest : undefined })
  }

  return sitemapResponse(buildSitemapIndexXml(sitemaps), { shortCache: degraded })
}
