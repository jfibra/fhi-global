import { unstable_cache } from "next/cache"
import { createPublicSupabaseClient } from "@/lib/supabase/public"

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
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name")
        .limit(8),
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
      supabase
        .from("projects")
        .select("city")
        .eq("is_active", true)
        .eq("is_published", true)
        .not("city", "is", null)
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
