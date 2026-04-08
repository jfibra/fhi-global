import { createPublicSupabaseClient } from "@/lib/supabase/public"

export type BuyRawProject = {
  id: string
  name: string
  slug: string
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

async function fetchBuyProjectsFromSupabase(): Promise<{
  rows: BuyRawProject[]
  error: boolean
}> {
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase
    .from("projects")
    .select(
      `id, name, slug, main_image, description, city, location, latitude, longitude, launch_price_from, launch_price_to, currency, created_at, is_featured,
       developers ( name, logo_url, slug ),
       project_units ( unit_type, bedrooms, bathrooms, size_sqft, size_sqm ),
       project_property_types ( property_types ( name ) ),
       project_images ( url, is_main, rank )`
    )
    .eq("is_active", true)
    .eq("is_published", true)
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
  const direct = p.main_image?.trim()
  if (direct) return direct
  const imgs = p.project_images
  if (!imgs?.length) return null
  const main = imgs.find((i) => i.is_main)
  if (main?.url) return main.url
  const sorted = [...imgs].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
  return sorted[0]?.url?.trim() || null
}

const DEV_QUERY_MS = 18_000

function withDevTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  if (process.env.NODE_ENV !== "development") {
    return promise
  }
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      console.warn(
        `[buy] Supabase query exceeded ${DEV_QUERY_MS}ms — returning empty list so the page can render.`
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

/**
 * Loads published projects for the buy page (filters run in memory in the page).
 * Avoids `unstable_cache` here — it interacted badly with Turbopack (stuck on "Compiling /buy").
 */
export async function getBuyPageProjectsCached(): Promise<{
  rows: BuyRawProject[]
  error: boolean
}> {
  return withDevTimeout(fetchBuyProjectsFromSupabase(), { rows: [], error: true })
}
