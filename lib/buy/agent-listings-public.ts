import { createPublicSupabaseClient } from "@/lib/supabase/public"
import type { BuyRawProject, ListingMarket } from "@/lib/buy/cached-projects"

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
  agent_listing_images?: { url: string; sort_order: number }[] | null
  /** Owning agent, for the enquiry card. Embedded only on the detail fetch. */
  profiles?: PublicListingAgent | PublicListingAgent[] | null
}

/**
 * The listing owner's public-facing details.
 *
 * Only what an enquiry needs: who they are, their photo and their phone. The
 * phone lives in `profiles.metadata` (there is no column for it), same as the
 * business card and public profile read it.
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

/** Flatten the embed (PostgREST may hand back an array) and drop unusable rows. */
export function listingAgentOf(row: PublicAgentListingRow): PublicListingAgent | null {
  const raw = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
  if (!raw) return null
  // A deactivated or deleted agent falls back to the house contact card.
  if (raw.is_deleted === true || (raw.status ?? "active") !== "active") return null
  return raw
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
  launch_price_from, launch_price_to, currency, created_at, is_featured,
  developers ( name, logo_url, slug ),
  project_units ( unit_type, bedrooms, bathrooms, size_sqft, size_sqm ),
  project_property_types ( property_types ( name ) ),
  project_images ( url, is_main, rank )
`

async function fetchPublishedAgentListings(market: ListingMarket): Promise<{
  rows: PublicAgentListingRow[]
  error: boolean
}> {
  const supabase = createPublicSupabaseClient()
  const kind = market === "buy" ? "sale" : "rent"
  const { data, error } = await supabase
    .from("agent_listings")
    .select(
      `id, slug, title, description, listing_kind, price, currency, unit_type, created_at, updated_at, projects ( ${PROJECT_EMBED} ), agent_listing_images ( url, sort_order )`,
    )
    .eq("status", "published")
    .is("deleted_at", null)
    .eq("listing_kind", kind)
    .order("updated_at", { ascending: false })
    .limit(120)

  if (error != null) {
    return { rows: [], error: true }
  }

  const rows = (data ?? []) as unknown as PublicAgentListingRow[]
  for (const row of rows) {
    if (row.agent_listing_images?.length) {
      row.agent_listing_images.sort((a, b) => a.sort_order - b.sort_order)
    }
  }
  return { rows, error: false }
}

export async function getPublicAgentListingsCached(market: ListingMarket): Promise<{
  rows: PublicAgentListingRow[]
  error: boolean
}> {
  return withDevTimeout(fetchPublishedAgentListings(market), { rows: [], error: true })
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
      // The owning agent is embedded here but NOT on the list query above —
      // the enquiry card only exists on the detail page, and the browse grids
      // would be paying for a join they never read.
      `id, slug, title, description, listing_kind, price, currency, unit_type, created_at, updated_at,
       projects ( ${PROJECT_EMBED} ), agent_listing_images ( url, sort_order ),
       profiles:agent_id ( id, fullname, fname, lname, profile_url, role, status, is_deleted, metadata )`,
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

  const row = data as unknown as PublicAgentListingRow
  if (row.agent_listing_images?.length) {
    row.agent_listing_images.sort((a, b) => a.sort_order - b.sort_order)
  }
  return { row, error: false }
}
