import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { isSalesPipelineRole } from "@/lib/app-roles"
import { createClient } from "@/lib/supabase/server"
import { orderedProjectGalleryUrls } from "@/lib/buy/cached-projects"
import type { BuyRawProject } from "@/lib/buy/cached-projects"
import type { FlyerData } from "@/lib/flyer/theme"

// Normalized data feed for the marketing generators (Flyer + Just Listed/Sold
// poster). Given a listing the caller owns, it assembles the flyer-shaped
// object the client components render: photos (agent uploads + linked-project
// gallery), price/currency, address (composed from the project location), and
// the agent's "Listed by" details (profile + contact).

export const runtime = "nodejs"

type ProjectRow = {
  id: number
  location: string | null
  region: string | null
  community: string | null
  sub_community: string | null
  city: string | null
  country: string | null
  launch_price_from: number | string | null
  launch_price_to: number | string | null
  currency: string | null
  main_image: string | null
  sales_contact_phone: string | null
  sales_contact_email: string | null
  project_images?: { url: string; is_main: boolean; rank: number | null }[] | null
  project_units?: ProjectUnitRow[] | null
}

type ProjectUnitRow = {
  unit_type: string | null
  bedrooms: number | string | null
  bathrooms: number | string | null
  size_sqm: number | string | null
  size_sqft: number | string | null
  price_from: number | string | null
  price_to: number | string | null
}

const num = (v: unknown): number => {
  if (v == null) return 0
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function composeAddress(p: ProjectRow | null): string {
  if (!p) return ""
  const parts = [p.community, p.sub_community, p.city, p.country]
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean)
  if (parts.length) return Array.from(new Set(parts)).join(", ")
  return (p.location ?? p.region ?? "").trim()
}

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

  const row = listing as {
    id: string
    agent_id: string
    project_id: number | null
    title: string
    price: number | string | null
    currency: string | null
    listing_kind: "sale" | "rent"
    unit_type: string | null
    agent_listing_images?: { url: string; sort_order: number }[] | null
  }

  // Linked developer project (price, currency, address, photos).
  let project: ProjectRow | null = null
  if (row.project_id != null) {
    const { data: proj } = await supabase
      .from("projects")
      .select(
        "id, location, region, community, sub_community, city, country, launch_price_from, launch_price_to, currency, main_image, sales_contact_phone, sales_contact_email, project_images ( url, is_main, rank ), project_units ( unit_type, bedrooms, bathrooms, size_sqm, size_sqft, price_from, price_to )",
      )
      .eq("id", row.project_id)
      .maybeSingle()
    project = (proj as ProjectRow | null) ?? null
  }

  // Agent profile (name + avatar) for the "Listed by" bar.
  const { data: profile } = await supabase
    .from("profiles")
    .select("fname, lname, fullname, profile_url")
    .eq("id", row.agent_id)
    .maybeSingle()

  const prof = (profile as {
    fname: string | null
    lname: string | null
    fullname: string | null
    profile_url: string | null
  } | null) ?? null

  const agentName =
    prof?.fullname?.trim() ||
    [prof?.fname, prof?.lname].filter((x) => x && x.trim()).join(" ").trim() ||
    "FHI Global Agent"

  // Photos: the agent's own uploads first, then the developer project gallery.
  const agentPhotos = [...(row.agent_listing_images ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => i.url)
    .filter(Boolean)
  const projectPhotos = project ? orderedProjectGalleryUrls(project as unknown as BuyRawProject) : []
  const gallery = Array.from(new Set([...agentPhotos, ...projectPhotos]))

  // Attributes (bed/bath/area) come from the developer's project unit
  // definition. Prefer the exact unit the agent linked (matching unit_type),
  // else fall back to the project's first unit so the flyer still shows specs.
  const units = project?.project_units ?? []
  const wantType = (row.unit_type ?? "").trim().toLowerCase()
  const matchedUnit =
    (wantType ? units.find((u) => (u.unit_type ?? "").trim().toLowerCase() === wantType) : null) ??
    units[0] ??
    null

  // Currency follows the project; price prefers the matched unit, then the
  // project's launch price, then the listing's own price.
  const currency = (project?.currency ?? row.currency ?? "AED").trim() || "AED"
  const price =
    num(matchedUnit?.price_from) ||
    num(matchedUnit?.price_to) ||
    (project ? num(project.launch_price_from) || num(project.launch_price_to) : num(row.price))

  const category = row.listing_kind === "rent" ? "FOR RENT" : "FOR SALE"

  const data: FlyerData & { currency: string } = {
    id: row.id,
    title: row.title,
    price,
    currency,
    subtype: (row.unit_type ?? "").trim(),
    category,
    address: composeAddress(project),
    image: gallery[0] ?? null,
    gallery,
    specs: {
      // Sourced from the linked developer project unit (project_units).
      // Garage / lot area aren't tracked here, so they stay empty and the
      // spec cards for them are omitted gracefully.
      bedrooms: num(matchedUnit?.bedrooms) || null,
      bathrooms: num(matchedUnit?.bathrooms) || null,
      lotArea: null,
      floorArea: num(matchedUnit?.size_sqm) || null,
      garage: null,
    },
    agent: {
      name: agentName,
      phone: (project?.sales_contact_phone ?? "").trim(),
      email: (project?.sales_contact_email ?? session.context.email ?? "").trim(),
      imageUrl: prof?.profile_url?.trim() || "",
    },
  }

  return NextResponse.json({ data })
}
