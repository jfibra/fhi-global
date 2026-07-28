import { NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { canUseReelsMaker } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"

// Published listings across ALL agents for the Reels Maker picker (used by
// members, who have no listings of their own). Listings and their images are
// already publicly readable under RLS; the service-role client is only needed
// to attach each agent's name, since profiles are not publicly readable.

export const runtime = "nodejs"

export async function GET() {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  if (!canUseReelsMaker(session.context.profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("agent_listings")
    .select(
      "id, title, listing_kind, price, currency, status, updated_at, agent:profiles!agent_id ( fullname ), projects ( id, name ), agent_listing_images ( id, url, sort_order )",
    )
    .eq("status", "published")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: "Failed to load listings" }, { status: 500 })
  }

  const listings = (data ?? []).map((row) => {
    const agent = (Array.isArray(row.agent) ? row.agent[0] : row.agent) as { fullname: string | null } | null
    const project = (Array.isArray(row.projects) ? row.projects[0] : row.projects) as
      | { id: number; name: string | null }
      | null
    const images = ((row.agent_listing_images ?? []) as { id: string; url: string; sort_order: number | null }[])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    return {
      id: row.id as string,
      title: row.title as string,
      listingKind: row.listing_kind as "sale" | "rent",
      price: row.price as number | null,
      currency: (row.currency as string | null) ?? "AED",
      projectName: project?.name ?? null,
      agentName: agent?.fullname ?? null,
      images: images.map((im) => ({ id: im.id, url: im.url, sort_order: im.sort_order ?? 0 })),
    }
  })

  return NextResponse.json({ listings })
}
