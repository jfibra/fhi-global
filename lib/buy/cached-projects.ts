import { unstable_cache } from "next/cache"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import type { ProjectListingType } from "@/lib/project-service"

/** Which public listing route loads this row. */
export type ListingMarket = "buy" | "rent"

export type BuyRawProject = {
  id: string
  name: string
  slug: string
  listing_type: ProjectListingType
  main_image: string | null
  project_images?: { url: string; is_main: boolean; rank: number | null }[] | null
  description: string | null
  city: string | null
  location: string | null
  latitude: string | null
  longitude: string | null
  launch_price_from: number | null
  launch_price_to: number | null
  currency: string | null
  created_at: string
  is_featured: boolean | null
  developers: { name: string; logo_url: string | null; slug: string | null } | null
  project_units: {
    unit_type: string | null
    bedrooms: number | null
    bathrooms: number | null
    size_sqft: number | null
    size_sqm: number | null
  }[] | null
  /** From Project → Property Types tab (`project_property_types` → `property_types`). */
  project_property_types?: { property_types: { name: string } | null }[] | null
}

const LISTING_TYPES_FOR_MARKET: Record<ListingMarket, ProjectListingType[]> = {
  buy: ["sale", "both"],
  rent: ["rent", "both"],
}

async function fetchBuyProjectsFromSupabase(market: ListingMarket): Promise<{
  rows: BuyRawProject[]
  error: boolean
}> {
  const supabase = createPublicSupabaseClient()
  const types = LISTING_TYPES_FOR_MARKET[market]
  const { data, error } = await supabase
    .from("projects")
    .select(
      `id, name, slug, listing_type, main_image, description, city, location, latitude, longitude, launch_price_from, launch_price_to, currency, created_at, is_featured,
       developers ( name, logo_url, slug ),
       project_units ( unit_type, bedrooms, bathrooms, size_sqft, size_sqm ),
       project_property_types ( property_types ( name ) ),
       project_images ( url, is_main, rank )`
    )
    .eq("is_active", true)
    .eq("is_published", true)
    .in("listing_type", types)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(80)

  return {
    rows: (data ?? []) as unknown as BuyRawProject[],
    error: error != null,
  }
}

/** Public listing hero: `projects.main_image`, else gallery `is_main`, else first by `rank`. */
export function pickBuyListingImage(p: BuyRawProject): string | null {
  const urls = orderedProjectGalleryUrls(p)
  return urls[0] ?? null
}

/** Developer project images in display order (main image first, then gallery by main flag + rank). */
export function orderedProjectGalleryUrls(p: BuyRawProject | null): string[] {
  if (!p) return []
  const seen = new Set<string>()
  const out: string[] = []
  const add = (u: string | null | undefined) => {
    const t = u?.trim()
    if (!t || seen.has(t)) return
    seen.add(t)
    out.push(t)
  }
  add(p.main_image)
  const imgs = [...(p.project_images ?? [])].sort((a, b) => {
    if (a.is_main && !b.is_main) return -1
    if (!a.is_main && b.is_main) return 1
    return (a.rank ?? 0) - (b.rank ?? 0)
  })
  for (const im of imgs) add(im.url)
  return out
}

const DEV_QUERY_MS = 18_000

function withDevTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  if (process.env.NODE_ENV !== "development") {
    return promise
  }
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      console.warn(
        `[listings] Supabase query exceeded ${DEV_QUERY_MS}ms — returning empty list so the page can render.`
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

// Cross-request cache, mirroring lib/data/home.ts. History: an earlier
// unstable_cache here hung dev-mode Turbopack ("Compiling /buy" forever), so
// it was stripped — but `next dev` has since been pinned to webpack and the
// production Turbopack build is verified against this wrapper. Failures THROW
// inside the cached fn so an error result is never cached for 120s; the outer
// catch converts them back to the { rows: [], error: true } contract.
const getBuyProjectsCachedByMarket = (market: ListingMarket) =>
  unstable_cache(
    async () => {
      const result = await fetchBuyProjectsFromSupabase(market)
      if (result.error) throw new Error(`[listings] buy-projects fetch failed (${market})`)
      return result
    },
    [`buy-projects-${market}`],
    { revalidate: 120, tags: ["buy-projects"] },
  )

/** Loads published projects for /buy or /rent (filters run in memory on the page). */
export async function getListingPageProjectsCached(market: ListingMarket): Promise<{
  rows: BuyRawProject[]
  error: boolean
}> {
  const fallback = { rows: [] as BuyRawProject[], error: true }
  return withDevTimeout(
    getBuyProjectsCachedByMarket(market)().catch(() => fallback),
    fallback,
  )
}
