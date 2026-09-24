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

  const [{ data: developers }, { data: featuredProjects }, { data: cityRows }, { data: wallRows }] =
    await Promise.all([
      supabase
        .from("developers")
        .select("id, name, slug, description, logo_url, logo_bg, rating, is_verified")
        .in("slug", FEATURED_DEVELOPER_SLUGS)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("projects")
        .select(
          "id, name, slug, main_image, location, city, community, delivery_quarter, launch_price_from, launch_price_to, currency, status, is_featured, down_payment_percentage, payment_plan_details, expected_roi, agent_note, developers(name, logo_url, logo_bg, slug)"
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
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(4000),
      // Renders for the collage on the Featured Projects doors: featured
      // first, then the newest, only rows that actually have a photo.
      supabase
        .from("projects")
        .select("name, main_image")
        .eq("is_active", true)
        .eq("is_published", true)
        .is("deleted_at", null)
        .not("main_image", "is", null)
        .neq("main_image", "")
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(36),
    ])

  return {
    developers: developers ?? [],
    featuredProjects: featuredProjects ?? [],
    cityRows: cityRows ?? [],
    wallImages: ((wallRows ?? []) as { name: string; main_image: string | null }[])
      .filter((r) => r.main_image)
      .map((r) => ({ src: r.main_image as string, alt: `${r.name} render` })),
  }
}

export function getCachedHomePageData() {
  return unstable_cache(loadHomePageData, ["home-page-supabase-v2"], {
    revalidate: 120,
    tags: ["home"],
  })()
}
