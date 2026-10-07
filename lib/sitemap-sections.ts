import "server-only"

import { unstable_cache } from "next/cache"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { eventPublicPath } from "@/lib/events/paths"
import { fetchArticlesList, isIndexableNewsArticle, newsConfigured, toManilaIso } from "@/lib/news-service"
import { agentSiteSignalsFromRow, isAgentSiteComplete } from "@/lib/agent-site"
import { isLiveProject, isTestRecord, type ProjectLiveFlags } from "@/lib/listing-publish-checks"

/**
 * Data access for the sitemap shards. Supabase sections read through the ANON
 * public client (no cookies — cacheable, RLS applies as a logged-out visitor).
 *
 * Count semantics matter for the index's self-healing cache:
 *   number ≥ 0 → real count (0 = section skipped, normal cache)
 *   null       → upstream error (section skipped, index short-cached 60s)
 * An UNCONFIGURED news feature returns 0, not null — otherwise a deploy
 * without the news env vars would pin the index to the 60s degraded cache.
 */

export const SUPABASE_PER_PAGE = 1000

/** URLs per news shard: composed of up to 10 upstream pages (per_page cap 100). */
export const NEWS_SHARD_SIZE = 1000
const NEWS_API_PER_PAGE = 100

export type SupabaseSection = "projects" | "developers" | "listings" | "events" | "gallery"

export type SectionRow = {
  slug: string | null
  id?: string | number
  updated_at: string | null
  /** projects only: parent developer slug, for the nested /<dev>/<project> URL. */
  developers?: { slug: string | null } | null
  /** listings only — read to decide whether the listing may be advertised, never printed in the sitemap. */
  title?: string | null
  project_id?: number | null
  projects?: ({ name?: string | null } & ProjectLiveFlags) | null
}

const SECTION_TABLE: Record<SupabaseSection, string> = {
  projects: "projects",
  developers: "developers",
  listings: "agent_listings",
  events: "events",
  gallery: "gallery_albums",
}

const SECTION_SELECT: Record<SupabaseSection, string> = {
  projects: "slug, updated_at, developers(slug)",
  developers: "id, slug, updated_at",
  listings: "id, slug, updated_at, title, project_id, projects(name, is_published, is_active, deleted_at)",
  events: "id, slug, updated_at",
  gallery: "id, slug, updated_at",
}

/** Same published-only filters the public routes use, per section. */
function sectionFilters(section: SupabaseSection): Array<["eq" | "is" | "or", string, unknown]> {
  switch (section) {
    case "projects":
      return [["eq", "is_active", true], ["eq", "is_published", true], ["is", "deleted_at", null]]
    case "developers":
      return [["eq", "is_active", true], ["is", "deleted_at", null]]
    case "listings":
      return [["eq", "status", "published"], ["is", "deleted_at", null]]
    case "events":
      // Every event whose page renders on fhiglobal.ae: company events, and
      // agents' events placed on the main page (074 — /events/<slug> is their
      // canonical). A website-only agent event's /events URL just forwards, so
      // it's listed by its website URL instead (fetchAgentEventPaths).
      return [["eq", "status", "published"], ["is", "deleted_at", null], ["or", "agent_id.is.null,show_on_main.eq.true", null]]
    case "gallery":
      // gallery_albums has no deleted_at or status columns (migration 038) —
      // is_published is the whole publish state.
      return [["eq", "is_published", true]]
  }
}

/** One listed agent site: its slug and when it was last saved. */
export type AgentSiteRow = { slug: string; updated_at: string | null }

/**
 * The published agent sites (/website/<slug>) that are really the agent's — what the sitemap lists.
 * The page's robots tag and this list use ONE predicate (isAgentSiteComplete) over the same three
 * raw fields (the contact name, the bio, the portrait), read here with a single embedded select,
 * so a URL can never be advertised in the sitemap while the page itself says noindex (GSC reports
 * that as "Submitted URL marked noindex"). null = the query failed (degraded). Capped at one
 * shard: past 1000 sites the rest would need a second shard.
 */
export async function fetchAgentSiteRows(): Promise<AgentSiteRow[] | null> {
  try {
    const supabase = createPublicSupabaseClient()
    const { data, error } = await supabase
      .from("website_builder")
      .select("slug, contact, updated_at, about:about_id(bio, photo)")
      .eq("is_published", true)
      .order("slug", { ascending: true })
      .limit(SUPABASE_PER_PAGE)
    if (error || !data) return null
    return (data as unknown as Array<{ slug: string | null; contact: unknown; updated_at: string | null; about: unknown }>)
      .filter((row) => Boolean(row.slug) && isAgentSiteComplete(agentSiteSignalsFromRow(row)))
      .map((row) => ({ slug: row.slug as string, updated_at: row.updated_at }))
  } catch {
    return null
  }
}

/** Row count for a section, or null when the query fails (degraded). */
export async function countSection(section: SupabaseSection): Promise<number | null> {
  try {
    const supabase = createPublicSupabaseClient()
    let query = supabase.from(SECTION_TABLE[section]).select("id", { count: "exact", head: true })
    for (const [op, column, value] of sectionFilters(section)) {
      query = op === "eq" ? query.eq(column, value) : op === "or" ? query.or(column) : query.is(column, value as null)
    }
    const { count, error } = await query
    if (error) return null
    return count ?? 0
  } catch {
    return null
  }
}

/**
 * The newest updated_at among a section's published rows, as YYYY-MM-DD — what
 * that section's entry in the sitemap index should say. The index used to stamp
 * "today" on six of its eight entries (and a frozen date on the pages shard), so
 * crawlers learned to ignore every lastmod we sent. undefined = unknown (query
 * failed or no rows): the entry then carries no lastmod rather than a made-up one.
 */
export async function latestUpdatedAt(section: SupabaseSection): Promise<string | undefined> {
  try {
    const supabase = createPublicSupabaseClient()
    let query = supabase.from(SECTION_TABLE[section]).select("updated_at")
    for (const [op, column, value] of sectionFilters(section)) {
      query = op === "eq" ? query.eq(column, value) : op === "or" ? query.or(column) : query.is(column, value as null)
    }
    const { data, error } = await query
      .not("updated_at", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
    if (error || !data?.length) return undefined
    return (data[0] as { updated_at: string }).updated_at.slice(0, 10)
  } catch {
    return undefined
  }
}

/**
 * One shard page of rows (1-based), ordered stably for consistent pagination.
 * null = query FAILED (shard routes answer 503, not 404 — a transient error on
 * an advertised shard must not read as "page doesn't exist" to crawlers).
 */
export async function fetchSectionPage(
  section: SupabaseSection,
  page: number,
): Promise<SectionRow[] | null> {
  try {
    const supabase = createPublicSupabaseClient()
    let query = supabase.from(SECTION_TABLE[section]).select(SECTION_SELECT[section])
    for (const [op, column, value] of sectionFilters(section)) {
      query = op === "eq" ? query.eq(column, value) : op === "or" ? query.or(column) : query.is(column, value as null)
    }
    const from = (page - 1) * SUPABASE_PER_PAGE
    const { data, error } = await query
      .order("id", { ascending: true })
      .range(from, from + SUPABASE_PER_PAGE - 1)
    if (error || !data) return null
    const rows = data as unknown as SectionRow[]
    if (section === "developers") return await withLiveProjects(supabase, rows)
    return section === "listings" ? rows.filter(isAdvertisableListing) : rows
  } catch {
    return null
  }
}

/**
 * A developer is advertised in the sitemap only when its page has something on it — at least one live project.
 * The page itself says `noindex` for an empty developer (app/(public-page)/(header-footer)/[slug]/page.tsx), and a
 * URL listed here that the page noindexes is a "Submitted URL marked noindex" in Search Console. null = failed read.
 */
async function withLiveProjects(
  supabase: ReturnType<typeof createPublicSupabaseClient>,
  rows: SectionRow[],
): Promise<SectionRow[] | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("developer_id")
    .eq("is_active", true)
    .eq("is_published", true)
    .is("deleted_at", null)
    .not("developer_id", "is", null)
    .limit(5000)
  if (error || !data) return null
  const live = new Set((data as { developer_id: string | null }[]).map((r) => String(r.developer_id)))
  return rows.filter((row) => row.id != null && live.has(String(row.id)))
}

/**
 * A listing is advertised in the sitemap only when its page is something to land on: not test data (the
 * title, or the name of the project it links), and not linked to a project that has been retired — the page
 * then shows no photos or price and says noindex (app/listings/[id]/page.tsx), and a URL listed here that
 * the page itself noindexes is a "Submitted URL marked noindex" in Search Console. A listing whose project
 * could not be embedded counts as retired for the same reason.
 */
function isAdvertisableListing(row: SectionRow): boolean {
  if (isTestRecord({ title: row.title, projectName: row.projects?.name })) return false
  if (row.project_id != null && !isLiveProject(row.projects)) return false
  return true
}

/**
 * Agents' own published events shown on their website only (057 + 074), as
 * their website URLs — the events section above lists everything that renders
 * on fhiglobal.ae. Only events whose agent has a published site are listed
 * (that's where they live). Null on a failed read.
 */
export async function fetchAgentEventPaths(): Promise<Array<{ path: string; updated_at: string | null }> | null> {
  try {
    const supabase = createPublicSupabaseClient()
    const { data: events, error } = await supabase
      .from("events")
      .select("id, slug, agent_id, updated_at")
      .eq("status", "published")
      .is("deleted_at", null)
      .not("agent_id", "is", null)
      // Website-only events (074): one on fhiglobal.ae is listed by its
      // /events URL (the events section), and a fhiglobal.ae-only event's
      // site URL just forwards.
      .eq("show_on_website", true)
      .eq("show_on_main", false)
      .order("id", { ascending: true })
      .limit(SUPABASE_PER_PAGE)
    if (error || !events) return null
    const agentIds = [...new Set(events.map((e) => String(e.agent_id)))]
    if (agentIds.length === 0) return []
    const { data: sites, error: siteError } = await supabase
      .from("website_builder")
      .select("agent_id, slug")
      .in("agent_id", agentIds)
      .eq("is_published", true)
    if (siteError || !sites) return null
    const siteBy = new Map(sites.map((s) => [String(s.agent_id), String(s.slug)]))
    return events.flatMap((e) => {
      const site = siteBy.get(String(e.agent_id))
      return site
        ? [{ path: eventPublicPath({ id: String(e.id), slug: (e.slug as string | null) ?? null }, site), updated_at: (e.updated_at as string | null) ?? null }]
        : []
    })
  } catch {
    return null
  }
}

/**
 * How many news shards exist and when the newest article changed (the index
 * entry's lastmod). { shards: 0 } = none/unconfigured (skip silently), null =
 * the upstream list call failed (degraded).
 */
export async function newsShardInfo(): Promise<{ shards: number; lastmod?: string } | null> {
  if (!newsConfigured()) return { shards: 0 }
  const { articles, total, lastPage } = await fetchArticlesList({ page: 1, perPage: NEWS_API_PER_PAGE })
  // Service failure sentinel is lastPage 0 (a real Laravel page always has ≥ 1).
  if (lastPage === 0) return null
  if (total === 0) return { shards: 0 }
  const newest = articles
    .filter((a) => isIndexableNewsArticle(a))
    .map((a) => toManilaIso(a.updatedAt || a.publishedAt)?.slice(0, 10))
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1)
  return { shards: Math.ceil(total / NEWS_SHARD_SIZE), lastmod: newest }
}

export type NewsShardRow = { slug: string; lastmod?: string }

/**
 * Build one 1000-URL shard from up to 10 upstream pages (100 each). THROWS when
 * an upstream call fails (detected via the lastPage-0 sentinel from
 * fetchArticlesList — a real Laravel page always reports last_page ≥ 1), so a
 * mid-aggregation failure can never cache a silently truncated shard as healthy.
 * The first page is fetched alone to learn how many exist; the rest go out in
 * parallel (the old loop ran them one after another, so the shard's latency was
 * the SUM of up to ten upstream calls).
 */
async function buildNewsShard(page: number): Promise<NewsShardRow[]> {
  const apiPagesPerShard = NEWS_SHARD_SIZE / NEWS_API_PER_PAGE
  const firstApiPage = (page - 1) * apiPagesPerShard + 1

  const first = await fetchArticlesList({ page: firstApiPage, perPage: NEWS_API_PER_PAGE })
  if (first.lastPage === 0) throw new Error("news upstream failed")
  const lastApiPage = Math.min(first.lastPage, firstApiPage + apiPagesPerShard - 1)
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, lastApiPage - firstApiPage) }, (_, i) =>
      fetchArticlesList({ page: firstApiPage + 1 + i, perPage: NEWS_API_PER_PAGE }),
    ),
  )
  if (rest.some((r) => r.lastPage === 0)) throw new Error("news upstream failed")

  const rows: NewsShardRow[] = []
  const seen = new Set<string>()
  for (const { articles } of [first, ...rest]) {
    for (const a of articles) {
      if (!a.slug || seen.has(a.slug)) continue
      // noindex pages must not be advertised in a sitemap (contradictory signal).
      if (!isIndexableNewsArticle(a)) continue
      seen.add(a.slug)
      rows.push({
        slug: a.slug,
        lastmod: toManilaIso(a.updatedAt || a.publishedAt)?.slice(0, 10) ?? undefined,
      })
    }
  }
  return rows
}

// A 30-minute data cache around the shard. Besides saving the upstream calls, it
// is the last-known-good copy: when Next revalidates an expired entry and the
// function throws, the previous result keeps being served — so one upstream blip
// no longer turns the whole shard into a 503 the way it did (a crawl of this very
// site caught the shard mid-failure and stored the 503 body as "the sitemap").
const newsShardCached = unstable_cache(buildNewsShard, ["sitemap-news-shard-v1"], {
  revalidate: 1800,
  tags: ["news-sitemap"],
})

/** null = the upstream failed and there is no earlier copy to fall back on. */
export async function fetchNewsShard(page: number): Promise<NewsShardRow[] | null> {
  if (!newsConfigured() || page < 1) return []
  try {
    return await newsShardCached(page)
  } catch {
    return null
  }
}
