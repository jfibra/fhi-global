import { unstable_cache } from "next/cache"
import { createPublicSupabaseClient } from "@/lib/supabase/public"

/**
 * Cached developers directory (list + project coordinates for the map).
 * The /developers page renders dynamically because of its search params, so
 * without this every visit paid two Supabase round-trips; the directory is
 * small (~tens of rows), so we cache it whole and filter in memory.
 */
async function loadDevelopersDirectory() {
  const supabase = createPublicSupabaseClient()

  const [{ data: developers }, { data: projectCoords }] = await Promise.all([
    supabase
      .from("developers")
      .select("id, name, slug, description, logo_url, rating, is_verified")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("projects")
      .select("developer_id, latitude, longitude")
      .eq("is_active", true)
      .eq("is_published", true)
      .is("deleted_at", null),
  ])

  return {
    developers: developers ?? [],
    projectCoords: projectCoords ?? [],
  }
}

export function getCachedDevelopersDirectory() {
  return unstable_cache(loadDevelopersDirectory, ["developers-directory-supabase"], {
    revalidate: 120,
    tags: ["developers"],
  })()
}
