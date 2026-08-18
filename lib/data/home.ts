import { unstable_cache } from "next/cache"
import { createPublicSupabaseClient } from "@/lib/supabase/public"

/**
 * The 11 developers shown in the homepage "Featured Developers" strip.
 * DAMAC is not in the developers table yet — both slug variants are listed so
 * it appears automatically once it's added under either.
 */
const FEATURED_DEVELOPER_SLUGS = [
  "acube-developments",
  "aldar-development",
  "azizi-developments",
  "damac",
  "damac-properties",
  "danube-properties",
  "dugasta",
  "ellington-properties",
  "imtiaz-development",
  "qube-development",
  "samana-developers",
  "sobha-realty",
]

/**
 * Cached home payload: avoids repeated Supabase round-trips during revalidate window
 * and removes an unbounded "all cities" scan (capped to recent projects).
 */
async function loadHomePageData() {
  const supabase = createPublicSupabaseClient()

  const [{ data: developers }, { data: featuredProjects }, { data: cityRows }] =
    await Promise.all([
      supabase
        .from("developers")
        .select("id, name, slug, description, logo_url, rating, is_verified")
        .in("slug", FEATURED_DEVELOPER_SLUGS)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("projects")
        .select(
          "id, name, slug, main_image, location, city, launch_price_from, launch_price_to, currency, status, is_featured, developers(name, logo_url, slug)"
        )
        .eq("is_active", true)
        .eq("is_published", true)
        .eq("is_featured", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(6),
      // One pass over the live catalog serves two homepage needs: the city
      // list, and which developers actually carry the most projects (the
      // hero's "popular" links) — no second round-trip.
      supabase
        .from("projects")
        .select("city, developers(name, slug)")
        .eq("is_active", true)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(4000),
    ])

  return {
    developers: developers ?? [],
    featuredProjects: featuredProjects ?? [],
    cityRows: cityRows ?? [],
  }
}

export function getCachedHomePageData() {
  return unstable_cache(loadHomePageData, ["home-page-supabase"], {
    revalidate: 120,
    tags: ["home"],
  })()
}
