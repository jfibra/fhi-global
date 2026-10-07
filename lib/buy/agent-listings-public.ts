import { unstable_cache } from "next/cache"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import type { BuyRawProject, ListingMarket } from "@/lib/buy/cached-projects"
import { isLiveProject, isTestRecord, type ProjectLiveFlags } from "@/lib/listing-publish-checks"

const DEV_QUERY_MS = 18_000

function withDevTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  if (process.env.NODE_ENV !== "development") {
    return promise
  }
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      console.warn(
        `[agent-listings-public] Supabase query exceeded ${DEV_QUERY_MS}ms — returning empty list so the page can render.`,
      )
      resolve(fallback)
    }, DEV_QUERY_MS)
    promise
      .then((v) => {
        clearTimeout(t)
        resolve(v)
      })
      .catch(() => {
        clearTimeout(t)
        resolve(fallback)
      })
  })
}

/** Row shape from public fetch (nested project matches BuyRawProject when linked). */
export type PublicAgentListingRow = {
  id: string
  slug: string | null
  title: string
  description: string | null
  listing_kind: "sale" | "rent"
  price: number | string | null
  currency: string
  unit_type: string | null
  created_at: string
  updated_at: string
  projects: BuyRawProject | null
  /**
   * The linked project's id as stored. Still set when the project is no longer public — `projects` is then
   * null — which is how the listing page tells "never linked" from "linked to a retired project".
   */
  project_id?: number | null
  agent_listing_images?: { url: string; sort_order: number }[] | null
  /** Owning agent's id. The profile itself is fetched server-side — see below. */
  agent_id?: string | null
}

/**
 * The listing owner's public-facing details, for the enquiry card.
 *
 * Deliberately NOT embedded in the public query any more: `profiles` is behind
 * RLS (migration 020) and unreadable by the anon key, so the embed would come
 * back null. app/listings/[id]/page.tsx loads it with the service-role client
 * instead, which also lets it pick up the agent's email from auth.users.
 *
 * The phone lives in `profiles.metadata` — there is no column for it — same as
 * the business card and public profile read it.
 */
export type PublicListingAgent = {
  id: string
  fullname: string | null
  fname: string | null
  lname: string | null
  profile_url: string | null
  role: string | null
  status: string | null
  is_deleted: boolean | null
  metadata: Record<string, unknown> | null
}

/** A deactivated or deleted agent falls back to the house contact card. */
export function isUsableListingAgent(agent: PublicListingAgent | null): boolean {
  if (!agent) return false
  return agent.is_deleted !== true && (agent.status ?? "active") === "active"
}

/**
 * E.164 phone for the agent, or "" when they have none saved.
 *
 * "+971" + "501234567" → "+971501234567". Not every profile is that tidy:
 * some store the number with the country code already in it, and naively
 * concatenating gives "+971+971501234567" — a link that dials nothing. So the
 * dial code is only prepended when it isn't already there, and a leading zero
 * on the local part is dropped.
 */
export function listingAgentPhone(agent: PublicListingAgent | null): string {
  const meta = agent?.metadata ?? {}
  const dialRaw = typeof meta.phone_country_code === "string" ? meta.phone_country_code.trim() : ""
  const localRaw = typeof meta.phone_number === "string" ? meta.phone_number.trim() : ""
  if (!localRaw) return ""

  const digits = (s: string) => s.replace(/\D/g, "")
  const dial = digits(dialRaw)
  const local = digits(localRaw)
  if (!local) return ""

  // Already international (typed with a +, or repeats the dial code).
  if (localRaw.startsWith("+") || (dial && local.startsWith(dial))) return `+${local}`
  return `+${dial}${local.replace(/^0+/, "")}`
}

/** Display name, falling back through the same chain as the business card. */
export function listingAgentName(agent: PublicListingAgent | null): string {
  if (!agent) return ""
  return (
    (agent.fullname ?? "").trim() ||
    [agent.fname, agent.lname].filter(Boolean).join(" ").trim()
  )
}

const PROJECT_EMBED = `
  id, name, slug, listing_type, main_image, description, city, location, latitude, longitude,
  launch_price_from, launch_price_to, currency, created_at, is_featured, is_published, is_active, deleted_at,
  developers ( name, logo_url, slug ),
  project_units ( unit_type, bedrooms, bathrooms, size_sqft, size_sqm ),
  project_property_types ( property_types ( name ) ),
  project_images ( url, is_main, rank )
`

/**
 * A listing borrows its price, location and unit facts from its linked project.
 * When that project is no longer live (unpublished, deactivated or deleted) its
 * own page already 404s, so its facts must stop advertising too: the listing is
 * treated as unlinked. (The public API still returned the row — "/listings/luxury"
 * kept showing a test project's AED 100–500M after that project's page was gone.)
 * Missing flags count as live, so an embed without them is left alone.
 */
function withLiveProject<T extends { projects: BuyRawProject | null }>(row: T): T {
  const project = row.projects as (BuyRawProject & ProjectLiveFlags) | null
  if (!project) return row
  return isLiveProject(project) ? row : { ...row, projects: null }
}

/**
 * Test data never reaches a public surface. Judged on the RAW row — before withLiveProject drops a retired
 * project, whose NAME ("Test IT purposes") is the only giveaway of the junk listing titled "luxury".
 */
function isHiddenTestListing(row: { title: string; projects: BuyRawProject | null }): boolean {
  return isTestRecord({ title: row.title, projectName: row.projects?.name })
}

async function fetchPublishedAgentListings(market: ListingMarket): Promise<{
  rows: PublicAgentListingRow[]
  error: boolean
}> {
  const supabase = createPublicSupabaseClient()
  const kind = market === "buy" ? "sale" : "rent"
  const { data, error } = await supabase
    .from("agent_listings")
    .select(
      `id, slug, title, description, listing_kind, price, currency, unit_type, created_at, updated_at, project_id, projects ( ${PROJECT_EMBED} ), agent_listing_images ( url, sort_order )`,
    )
    .eq("status", "published")
    .is("deleted_at", null)
    .eq("listing_kind", kind)
    .order("updated_at", { ascending: false })
    .limit(120)

  if (error != null) {
    return { rows: [], error: true }
  }

  const rows = ((data ?? []) as unknown as PublicAgentListingRow[])
    .filter((row) => !isHiddenTestListing(row))
    .map(withLiveProject)
  for (const row of rows) {
    if (row.agent_listing_images?.length) {
      row.agent_listing_images.sort((a, b) => a.sort_order - b.sort_order)
    }
  }
  return { rows, error: false }
}

// Cross-request cache (see lib/buy/cached-projects.ts for the Turbopack
// history). Failures THROW inside the cached fn so an error result is never
// cached for 120s; the outer catch restores the { rows, error } contract.
const getAgentListingsCachedByMarket = (market: ListingMarket) =>
  unstable_cache(
    async () => {
      const result = await fetchPublishedAgentListings(market)
      if (result.error) throw new Error(`[listings] agent-listings fetch failed (${market})`)
      return result
    },
    [`public-agent-listings-${market}`],
    { revalidate: 120, tags: ["agent-listings"] },
  )

export async function getPublicAgentListingsCached(market: ListingMarket): Promise<{
  rows: PublicAgentListingRow[]
  error: boolean
}> {
  const fallback = { rows: [] as PublicAgentListingRow[], error: true }
  return withDevTimeout(
    getAgentListingsCachedByMarket(market)().catch(() => fallback),
    fallback,
  )
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Fetch by the human slug (/listings/luxury-2br-marina) or the legacy uuid
 * (/listings/410ba775-…) — old shared links keep working forever.
 */
export async function fetchPublicAgentListingById(idOrSlug: string): Promise<{
  row: PublicAgentListingRow | null
  error: boolean
}> {
  const trimmed = idOrSlug.trim()
  if (!trimmed) {
    return { row: null, error: false }
  }

  const supabase = createPublicSupabaseClient()
  const query = supabase
    .from("agent_listings")
    .select(
      // agent_id only — the profile behind it is behind RLS and is loaded by
      // the page on the service-role client. The list query above doesn't even
      // need the id: the enquiry card exists only on the detail page.
      `id, slug, title, description, listing_kind, price, currency, unit_type, created_at, updated_at, agent_id, project_id,
       projects ( ${PROJECT_EMBED} ), agent_listing_images ( url, sort_order )`,
    )
    .eq("status", "published")
    .is("deleted_at", null)
  const { data, error } = UUID_RE.test(trimmed)
    ? await query.eq("id", trimmed).maybeSingle()
    : await query.eq("slug", trimmed).maybeSingle()

  if (error != null) {
    return { row: null, error: true }
  }
  if (!data) {
    return { row: null, error: false }
  }

  // A test record is a real 404 (the listing page throws on an error but 404s a miss), not a hidden row.
  if (isHiddenTestListing(data as unknown as PublicAgentListingRow)) {
    return { row: null, error: false }
  }

  const row = withLiveProject(data as unknown as PublicAgentListingRow)
  if (row.agent_listing_images?.length) {
    row.agent_listing_images.sort((a, b) => a.sort_order - b.sort_order)
  }
  return { row, error: false }
}
