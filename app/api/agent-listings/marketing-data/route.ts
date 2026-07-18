import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { isSalesPipelineRole } from "@/lib/app-roles"
import { createClient } from "@/lib/supabase/server"
import { assembleListingMarketingData, type MarketingListingRow } from "@/lib/flyer/marketing-data"

// Normalized data feed for the marketing generators (Flyer + Just Listed/Sold
// poster + share card). Given a listing the caller owns, it returns the
// flyer-shaped object the client components render — the shaping itself lives
// in lib/flyer/marketing-data.ts, shared with the /og/listing image route.

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  if (!isSalesPipelineRole(session.context.profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const listingId = req.nextUrl.searchParams.get("listingId")
  if (!listingId) {
    return NextResponse.json({ error: "Missing listingId" }, { status: 400 })
  }

  const supabase = await createClient()

  // RLS restricts this to listings the session user owns.
  const { data: listing, error } = await supabase
    .from("agent_listings")
    .select(
      "id, agent_id, project_id, title, price, currency, listing_kind, unit_type, agent_listing_images ( url, sort_order )",
    )
    .eq("id", listingId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 })

  const data = await assembleListingMarketingData(
    supabase,
    listing as unknown as MarketingListingRow,
    session.context.email,
  )

  return NextResponse.json({ data })
}
