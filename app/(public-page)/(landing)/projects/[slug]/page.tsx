import { notFound, permanentRedirect, redirect } from "next/navigation"
import { createPublicSupabaseClient } from "@/lib/supabase/public"

/**
 * Legacy project URL. Projects moved under their developer —
 * /samana-developers/samana-miami-2 instead of /projects/samana-miami-2 — so
 * the developer's name rides in every project URL. This route exists solely
 * to keep old links, bookmarks and indexed pages working: one lookup, one 308.
 */
export const revalidate = 3600

export default async function LegacyProjectRedirect({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = createPublicSupabaseClient()
  const { data } = await supabase
    .from("projects")
    .select("slug, developers(slug)")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle()

  if (!data) notFound()
  const dev = data.developers as unknown as { slug: string | null } | null
  if (dev?.slug) permanentRedirect(`/${dev.slug}/${data.slug}`)
  // No developer slug to nest under — the browser index is the best landing.
  redirect("/projects")
}
