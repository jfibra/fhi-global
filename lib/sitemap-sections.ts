import "server-only"

import { createPublicSupabaseClient } from "@/lib/supabase/public"

/**
 * Data access for the sitemap shards. Supabase sections read through the ANON
 * public client (no cookies — cacheable, RLS applies as a logged-out visitor).
 *
 * Count semantics matter for the index's self-healing cache:
 *   number ≥ 0 → real count (0 = section skipped, normal cache)
 *   null       → upstream error (section skipped, index short-cached 60s)
 */

export const SUPABASE_PER_PAGE = 1000

export type SupabaseSection = "projects" | "developers" | "listings" | "events" | "gallery"

export type SectionRow = {
  slug: string | null
  id?: string | number
  updated_at: string | null
  /** projects only: parent developer slug, for the nested /<dev>/<project> URL. */
  developers?: { slug: string | null } | null
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
  developers: "slug, updated_at",
  listings: "id, slug, updated_at",
  events: "id, slug, updated_at",
  gallery: "id, slug, updated_at",
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
    case "gallery":
      // gallery_albums has no deleted_at or status columns (migration 038) —
      // is_published is the whole publish state.
      return [["eq", "is_published", true]]
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
