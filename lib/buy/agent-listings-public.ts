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
  title: string
  description: string | null
  listing_kind: "sale" | "rent"
  price: number | string | null
  currency: string
  created_at: string
  updated_at: string
  projects: BuyRawProject | null
  agent_listing_images?: { url: string; sort_order: number }[] | null
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
      `id, title, description, listing_kind, price, currency, created_at, updated_at, projects ( ${PROJECT_EMBED} ), agent_listing_images ( url, sort_order )`,
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

export async function fetchPublicAgentListingById(id: string): Promise<{
  row: PublicAgentListingRow | null
  error: boolean
}> {
  const trimmed = id.trim()
  if (!UUID_RE.test(trimmed)) {
    return { row: null, error: false }
  }

  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase
    .from("agent_listings")
    .select(
      `id, title, description, listing_kind, price, currency, created_at, updated_at, projects ( ${PROJECT_EMBED} ), agent_listing_images ( url, sort_order )`,
    )
    .eq("id", trimmed)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle()

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
