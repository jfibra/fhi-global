import type { SupabaseClient } from "@supabase/supabase-js"
import { orderedProjectGalleryUrls } from "@/lib/buy/cached-projects"
import type { BuyRawProject } from "@/lib/buy/cached-projects"
import type { FlyerData } from "@/lib/flyer/theme"

// Server-side builder for the normalized data the marketing generators
// (Flyer, Just Listed/Sold poster, share card dialog + /og/listing image)
// all render: photos (agent uploads + linked-project gallery), resolved
// price/currency, composed address, and the agent's "Listed by" details.
// The caller fetches the listing row under its own auth context (RLS-scoped
// cookie client for the dashboard API, service-role client for the OG route)
// and hands it here; this module only does the follow-up reads + shaping.

export type MarketingListingRow = {
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

export async function assembleListingMarketingData(
  supabase: SupabaseClient,
  row: MarketingListingRow,
  fallbackEmail?: string | null,
): Promise<FlyerData & { currency: string }> {
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

  return {
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
      email: (project?.sales_contact_email ?? fallbackEmail ?? "").trim(),
      imageUrl: prof?.profile_url?.trim() || "",
    },
  }
}
