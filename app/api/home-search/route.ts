import { NextRequest, NextResponse } from "next/server"
import { createPublicSupabaseClient } from "@/lib/supabase/public"

export const runtime = "nodejs"

/**
 * Instant search behind the homepage hero. Matches the LIVE catalog by name:
 * published projects, active developers, and the communities those projects
 * sit in. Anon client — public data only — and cacheable per query, so
 * keystrokes are cheap.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim()
  if (q.length < 2) {
    return NextResponse.json({ projects: [], developers: [], cities: [] })
  }
  // The term is user input inside an ilike pattern — strip pattern syntax.
  const like = `%${q.replace(/[%_\\]/g, "")}%`
  const supabase = createPublicSupabaseClient()

  const [proj, devs, cityRows] = await Promise.all([
    supabase
      .from("projects")
      .select("name, slug, city, main_image, launch_price_from, currency, developers(name, slug)")
      .eq("is_active", true)
      .eq("is_published", true)
      .ilike("name", like)
      .order("is_featured", { ascending: false })
      .limit(5),
    supabase
      .from("developers")
      .select("name, slug, logo_url")
      .eq("is_active", true)
      .is("deleted_at", null)
      .ilike("name", like)
      .limit(3),
    supabase
      .from("projects")
      .select("city")
      .eq("is_active", true)
      .eq("is_published", true)
      .ilike("city", like)
      .limit(40),
  ])

  const cities = [...new Set((cityRows.data ?? []).map((r) => r.city).filter(Boolean))].slice(0, 3)

  return NextResponse.json(
    {
      projects: (proj.data ?? []).map((p) => ({
        name: p.name,
        slug: p.slug,
        city: p.city,
        image: p.main_image?.trim() || null,
        devSlug: (p.developers as unknown as { slug: string | null } | null)?.slug ?? null,
        devName: (p.developers as unknown as { name: string | null } | null)?.name ?? null,
        price: p.launch_price_from,
        currency: p.currency,
      })),
      developers: devs.data ?? [],
      cities,
    },
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } },
  )
}
