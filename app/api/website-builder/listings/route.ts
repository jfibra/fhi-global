import { NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { canUseWebsiteBuilder, isSalesPipelineRole } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"

// Published listings for the Website Builder "Featured Listings" picker,
// mapped to the template's PropertyCard shape. Sales-pipeline roles see their
// OWN listings (it's their personal site); admin staff see all published ones.

export const runtime = "nodejs"

type UnitFacts = {
  unit_type: string | null
  bedrooms: number | null
  bathrooms: number | null
  size_sqft: number | string | null
}

export async function GET() {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  const role = session.context.profile.role
  if (!canUseWebsiteBuilder(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createAdminSupabase()
  let query = admin
    .from("agent_listings")
    .select(
      "id, title, listing_kind, price, currency, unit_type, projects ( name, city, location, community, launch_price_from, currency, project_units ( unit_type, bedrooms, bathrooms, size_sqft ) ), agent_listing_images ( url, sort_order )",
    )
    .eq("status", "published")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(200)

  if (isSalesPipelineRole(role)) {
    query = query.eq("agent_id", session.context.userId)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: "Failed to load listings" }, { status: 500 })
  }

  const listings = (data ?? []).map((row) => {
    const project = (Array.isArray(row.projects) ? row.projects[0] : row.projects) as
      | {
          name: string | null
          city: string | null
          location: string | null
          community: string | null
          launch_price_from: number | string | null
          currency: string | null
          project_units: UnitFacts[] | null
        }
      | null

    const images = ((row.agent_listing_images ?? []) as { url: string; sort_order: number | null }[])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

    // Beds/baths/size live on the project's unit lines, matched by unit_type.
    const units = project?.project_units ?? []
    const unit = units.find((u) => u.unit_type && u.unit_type === row.unit_type) ?? units[0] ?? null

    const location =
      [project?.community, project?.city].filter(Boolean).join(", ") || (project?.location ?? "")

    const rawPrice = (row.price as number | null) ?? (project?.launch_price_from != null ? Number(project.launch_price_from) : null)
    const currency = ((row.currency as string | null) ?? project?.currency ?? "AED").trim() || "AED"
    const price = rawPrice != null && Number.isFinite(rawPrice) && rawPrice > 0 ? `${currency} ${rawPrice.toLocaleString()}` : ""

    const isRent = (row.listing_kind as string) === "rent"
    const sqftNum = unit?.size_sqft != null ? Number(unit.size_sqft) : null

    return {
      sourceId: row.id as string,
      image: images[0]?.url ?? "",
      badge: isRent ? "For Rent" : "For Sale",
      title: (row.title as string) ?? "",
      location,
      beds: unit?.bedrooms != null ? String(unit.bedrooms) : "",
      baths: unit?.bathrooms != null ? String(unit.bathrooms) : "",
      sqft: sqftNum != null && Number.isFinite(sqftNum) && sqftNum > 0 ? sqftNum.toLocaleString() : "",
      price,
      suffix: isRent ? "/ Year" : "",
    }
  })

  return NextResponse.json({ listings })
}
