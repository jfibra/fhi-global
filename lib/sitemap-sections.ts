import "server-only"

import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { fetchArticlesList, newsConfigured, toManilaIso } from "@/lib/news-service"

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

export type SupabaseSection = "projects" | "developers" | "listings" | "events"

export type SectionRow = {
  slug: string | null
  id?: string | number
  updated_at: string | null
}

const SECTION_TABLE: Record<SupabaseSection, string> = {
  projects: "projects",
  developers: "developers",
  listings: "agent_listings",
  events: "events",
}

const SECTION_SELECT: Record<SupabaseSection, string> = {
  projects: "slug, updated_at",
  developers: "slug, updated_at",
  listings: "id, slug, updated_at",
  events: "id, slug, updated_at",
}

/** Same published-only filters the public routes use, per section. */
function sectionFilters(section: SupabaseSection): Array<["eq" | "is", string, unknown]> {
  switch (section) {
    case "projects":
      return [["eq", "is_active", true], ["eq", "is_published", true], ["is", "deleted_at", null]]
    case "developers":
      return [["eq", "is_active", true], ["is", "deleted_at", null]]
    case "listings":
    case "events":
      return [["eq", "status", "published"], ["is", "deleted_at", null]]
  }
}

/** Row count for a section, or null when the query fails (degraded). */
export async function countSection(section: SupabaseSection): Promise<number | null> {
  try {
    const supabase = createPublicSupabaseClient()
    let query = supabase.from(SECTION_TABLE[section]).select("id", { count: "exact", head: true })
    for (const [op, column, value] of sectionFilters(section)) {
      query = op === "eq" ? query.eq(column, value) : query.is(column, value as null)
    }
    const { count, error } = await query
    if (error) return null
    return count ?? 0
  } catch {
    return null
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
      query = op === "eq" ? query.eq(column, value) : query.is(column, value as null)
    }
    const from = (page - 1) * SUPABASE_PER_PAGE
    const { data, error } = await query
      .order("id", { ascending: true })
      .range(from, from + SUPABASE_PER_PAGE - 1)
    if (error || !data) return null
    return data as unknown as SectionRow[]
  } catch {
    return null
  }
}

/**
 * Number of news shards. 0 = none/unconfigured (skip silently), null = the
 * upstream list call failed (degraded).
 */
export async function countNewsShards(): Promise<number | null> {
  if (!newsConfigured()) return 0
  const { total, lastPage } = await fetchArticlesList({ page: 1, perPage: NEWS_API_PER_PAGE })
  // Service failure sentinel is lastPage 0 (a real Laravel page always has ≥ 1).
  if (lastPage === 0) return null
  if (total === 0) return 0
  return Math.ceil(total / NEWS_SHARD_SIZE)
}

export type NewsShardRow = { slug: string; lastmod?: string }

/**
 * Aggregate up to 10 upstream pages (100 each) into one 1000-URL shard.
 * null = an upstream call FAILED (detected via the lastPage-0 sentinel from
 * fetchArticlesList — a real Laravel page always reports last_page ≥ 1).
 * Returning null instead of partial rows prevents a mid-aggregation failure
 * from caching a silently truncated shard as healthy for an hour.
 */
export async function fetchNewsShard(page: number): Promise<NewsShardRow[] | null> {
  if (!newsConfigured() || page < 1) return []

  const apiPagesPerShard = NEWS_SHARD_SIZE / NEWS_API_PER_PAGE
  const firstApiPage = (page - 1) * apiPagesPerShard + 1

  const rows: NewsShardRow[] = []
  const seen = new Set<string>()

  for (let i = 0; i < apiPagesPerShard; i++) {
    const apiPage = firstApiPage + i
    const { articles, lastPage } = await fetchArticlesList({ page: apiPage, perPage: NEWS_API_PER_PAGE })
    if (lastPage === 0) return null // upstream failure, not end-of-data
    for (const a of articles) {
      if (!a.slug || seen.has(a.slug)) continue
      seen.add(a.slug)
      rows.push({
        slug: a.slug,
        lastmod: toManilaIso(a.updatedAt || a.publishedAt)?.slice(0, 10) ?? undefined,
      })
    }
    if (articles.length === 0 || apiPage >= lastPage) break
  }

  return rows
}
