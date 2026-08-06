import { NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { canUseWebsiteBuilder, isSalesPipelineRole } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { fetchListingCards } from "@/lib/website-builder-service"

// Published listings for the Website Builder "Featured Listings" picker,
// mapped to the template's PropertyCard shape (shared with the save/load
// service). Sales-pipeline roles see their OWN listings (it's their personal
// site); admin staff see all published ones.

export const runtime = "nodejs"

export async function GET() {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  const role = session.context.profile.role
  if (!canUseWebsiteBuilder(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const listings = await fetchListingCards(createAdminSupabase(), {
      agentId: isSalesPipelineRole(role) ? session.context.userId : undefined,
    })
    return NextResponse.json({ listings })
  } catch {
    return NextResponse.json({ error: "Failed to load listings" }, { status: 500 })
  }
}
