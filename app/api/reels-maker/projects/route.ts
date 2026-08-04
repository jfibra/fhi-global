import { NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { canUseReelsMaker } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"

// Published projects for the Reels Maker "Project Reels" picker (admin/super
// admin). Projects and their images are publicly readable under RLS; the
// service-role client is used for parity with the listings picker route.

export const runtime = "nodejs"

export async function GET() {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  if (!canUseReelsMaker(session.context.profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("projects")
    .select(
      "id, name, location, community, city, launch_price_from, currency, main_image, developers ( name ), project_images ( id, url, is_main, rank )",
    )
    .eq("is_active", true)
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 })
  }

  const projects = (data ?? []).map((row) => {
    const developer = (Array.isArray(row.developers) ? row.developers[0] : row.developers) as
      | { name: string | null }
      | null
    const images = ((row.project_images ?? []) as { id: number; url: string; is_main: boolean | null; rank: number | null }[])
      .slice()
      .sort((a, b) => Number(b.is_main ?? false) - Number(a.is_main ?? false) || (a.rank ?? 0) - (b.rank ?? 0))
      .map((im, i) => ({ id: String(im.id), url: im.url, sort_order: i }))
    // Ensure the cover image leads even when it isn't in project_images.
    const mainImage = row.main_image as string | null
    if (mainImage && !images.some((im) => im.url === mainImage)) {
      images.unshift({ id: `main-${row.id}`, url: mainImage, sort_order: -1 })
    }
    const location = [row.community, row.city].filter(Boolean).join(", ") || (row.location as string | null)
    return {
      id: String(row.id),
      name: row.name as string,
      location,
      priceFrom: row.launch_price_from as number | null,
      currency: (row.currency as string | null) ?? "AED",
      developerName: developer?.name ?? null,
      images,
    }
  })

  return NextResponse.json({ projects })
}
