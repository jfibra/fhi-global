import "server-only"

import { after } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import type { createAdminSupabase } from "@/lib/admin-supabase"
import { SITE_URL } from "@/lib/seo"
import { submitToIndexNow } from "@/lib/indexnow"

/**
 * A developer's address changed: every URL under the old slug is gone (there is no redirect table) and every
 * one under the new slug is new. Drop the cached pages and lists, then tell IndexNow about both addresses —
 * the developer page and each of its published projects — so Bing learns the move now instead of on a
 * re-crawl. Used by the admin's slug-approval route and by /api/seo/revalidate when an admin renames a
 * developer directly. Call from a route handler (it schedules the IndexNow ping with after()).
 */
export async function moveDeveloperPages(
  admin: ReturnType<typeof createAdminSupabase>,
  developerId: string,
  oldSlug: string | null,
  newSlug: string,
): Promise<void> {
  const { data: projects } = await admin
    .from("projects")
    .select("slug")
    .eq("developer_id", developerId)
    .eq("is_published", true)
    .eq("is_active", true)
    .is("deleted_at", null)
    .limit(500)
  const projectSlugs = (projects ?? []).map((p: { slug: string | null }) => p.slug).filter((v): v is string => Boolean(v))

  const base = SITE_URL.replace(/\/$/, "")
  const slugs = [oldSlug, newSlug].filter((v): v is string => Boolean(v))
  const paths = slugs.flatMap((slug) => [`/${slug}`, ...projectSlugs.map((project) => `/${slug}/${project}`)])
  for (const path of paths) revalidatePath(path)
  revalidatePath("/developers")
  for (const tag of ["projects", "home", "developers", "buy-projects", "agent-listings"]) revalidateTag(tag, { expire: 0 })
  after(() => submitToIndexNow(paths.map((path) => `${base}${path}`)))
}
