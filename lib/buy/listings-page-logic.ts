import { cache } from "react"
import type { BuyRawProject, ListingMarket } from "@/lib/buy/cached-projects"
import { getPublicAgentListingsCached, type PublicAgentListingRow } from "@/lib/buy/agent-listings-public"
import { mergedListingGalleryUrls } from "@/lib/listing-gallery-urls"
import type { BuyPropertyCardData } from "@/components/buy/buy-property-card"
import type { BuyMapMarker } from "@/components/buy/buy-google-map"

export type ListingSearchParams = Promise<{
  q?: string
  type?: string
  beds?: string
  minPrice?: string
  maxPrice?: string
  minBaths?: string
  sort?: string
  view?: string
}>

type RawUnit = NonNullable<BuyRawProject["project_units"]>[number]

export function pickUnit(units: BuyRawProject["project_units"]): RawUnit | null {
  if (!units?.length) return null
  return units.find((u) => u.bedrooms != null) ?? units[0]
}

function parseCoord(v: string | null | undefined): number | null {
  if (v == null) return null
  const t = String(v).trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function formatPrice(from: number | null, to: number | null, currency = "AED") {
  if (from == null) return "Price on request"
  const code = (currency || "AED").toUpperCase()
  const locale = code === "AED" ? "en-AE" : "en-US"
  const fmt = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 0 })
  if (code === "USD") {
    if (to != null && to !== from) return `$${fmt(from)} - $${fmt(to)}`
    return `$${fmt(from)}`
  }
  if (code === "AED") {
    if (to != null && to !== from) return `AED ${fmt(from)} - ${fmt(to)}`
    return `AED ${fmt(from)}`
  }
  const prefix = code === "PHP" ? "Php" : code
  if (to != null && to !== from) return `${prefix} ${fmt(from)} - ${fmt(to)}`
  return `${prefix} ${fmt(from)}`
}

export function parsePriceParam(v: string | undefined): number | null {
  if (v == null) return null
  const t = String(v).trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function listingEntryPrice(p: BuyRawProject): number | null {
  if (p.launch_price_from != null) return p.launch_price_from
  if (p.launch_price_to != null) return p.launch_price_to
  return null
}

function agentListingNumericPrice(row: PublicAgentListingRow): number | null {
  if (row.price == null) return null
  const n = typeof row.price === "number" ? row.price : Number(row.price)
  return Number.isFinite(n) ? n : null
}

export function agentListingEntryPrice(row: PublicAgentListingRow): number | null {
  const own = agentListingNumericPrice(row)
  if (own != null) return own
  if (row.projects) return listingEntryPrice(row.projects)
  return null
}

function agentMatchesFilters(row: PublicAgentListingRow, sp: Awaited<ListingSearchParams>): boolean {
  const proj = row.projects
  const q = (sp.q ?? "").trim().toLowerCase()
  if (q) {
    const blob = [
      row.title,
      row.description ?? "",
      proj?.name ?? "",
      proj?.city ?? "",
      proj?.location ?? "",
    ]
      .join(" ")
      .toLowerCase()
    if (!blob.includes(q)) return false
  }

  const type = (sp.type ?? "").trim().toLowerCase()
  if (type) {
    const agentUnit = (row.unit_type ?? "").toLowerCase().includes(type)
    if (proj) {
      const units = proj.project_units ?? []
      const matchUnit = units.some((u) => (u.unit_type ?? "").toLowerCase().includes(type))
      const linked = (proj.project_property_types ?? [])
        .map((r) => r.property_types?.name)
        .filter((n): n is string => Boolean(n?.trim()))
      const matchPt = linked.some((name) => name.toLowerCase().includes(type))
      if (!matchUnit && !matchPt && !agentUnit) return false
    } else {
      if (!agentUnit) {
        const blob = `${row.title} ${row.description ?? ""}`.toLowerCase()
        if (!blob.includes(type)) return false
      }
    }
  }

  const minBeds = sp.beds ? Number(sp.beds) : NaN
  if (Number.isFinite(minBeds) && minBeds > 0) {
    const units = proj?.project_units ?? []
    if (!units.some((u) => u.bedrooms != null && u.bedrooms >= minBeds)) return false
  }

  const minBaths = sp.minBaths ? Number(sp.minBaths) : NaN
  if (Number.isFinite(minBaths) && minBaths > 0) {
    const units = proj?.project_units ?? []
    if (!units.some((u) => u.bathrooms != null && u.bathrooms >= minBaths)) return false
  }

  const minPrice = parsePriceParam(sp.minPrice)
  const maxPrice = parsePriceParam(sp.maxPrice)
  const entry = agentListingEntryPrice(row)
  if (minPrice != null) {
    if (entry == null || entry < minPrice) return false
  }
  if (maxPrice != null) {
    if (entry == null || entry > maxPrice) return false
  }

  return true
}

function sortPublicAgentRows(rows: PublicAgentListingRow[], sort: string): PublicAgentListingRow[] {
  const out = [...rows]
  const t = (d: string) => {
    const x = new Date(d).getTime()
    return Number.isFinite(x) ? x : 0
  }
  const dateIso = (r: PublicAgentListingRow) => r.updated_at || r.created_at

  switch (sort) {
    case "price_asc":
      out.sort((a, b) => (agentListingEntryPrice(a) ?? 1e15) - (agentListingEntryPrice(b) ?? 1e15))
      break
    case "price_desc":
      out.sort((a, b) => (agentListingEntryPrice(b) ?? 0) - (agentListingEntryPrice(a) ?? 0))
      break
    case "newest":
      out.sort((a, b) => t(dateIso(b)) - t(dateIso(a)))
      break
    default:
      out.sort((a, b) => t(dateIso(b)) - t(dateIso(a)))
  }

  return out
}

function agentListingToCard(row: PublicAgentListingRow): BuyPropertyCardData {
  const proj = row.projects
  const u = proj ? pickUnit(proj.project_units) : null
  const own = agentListingNumericPrice(row)
  const fromPrice = own ?? proj?.launch_price_from ?? null
  const toPrice = own ?? proj?.launch_price_to ?? null
  const gallery = mergedListingGalleryUrls(proj, row.agent_listing_images)
  const unitLabel = row.unit_type?.trim() || u?.unit_type || null
  return {
    id: `agent:${row.id}`,
    name: row.title,
    slug: proj?.slug ?? "",
    detail_path: `/listings/${row.id}`,
    main_image: gallery[0] ?? null,
    gallery_urls: gallery.length > 0 ? gallery : undefined,
    description: row.description ?? proj?.description ?? null,
    city: proj?.city ?? null,
    location: proj?.location ?? null,
    launch_price_from: fromPrice,
    launch_price_to: toPrice,
    currency: row.currency?.trim() || proj?.currency || "AED",
    developers: proj?.developers ?? null,
    unit_type: unitLabel,
    bedrooms: u?.bedrooms ?? null,
    bathrooms: u?.bathrooms ?? null,
    size_sqft: u?.size_sqft ?? null,
    size_sqm: u?.size_sqm ?? null,
  }
}

function agentListingToMapMarker(row: PublicAgentListingRow): BuyMapMarker | null {
  const proj = row.projects
  if (!proj) return null
  const lat = parseCoord(proj.latitude)
  const lng = parseCoord(proj.longitude)
  if (lat == null || lng == null) return null
  const u = pickUnit(proj.project_units)
  const locationLabel = [proj.city, proj.location].filter(Boolean).join(", ") || "United Arab Emirates"
  const areaLabel =
    u?.size_sqm != null
      ? `${u.size_sqm.toLocaleString("en-AE")} sqm`
      : u?.size_sqft != null
        ? `${u.size_sqft.toLocaleString("en-AE")} sqft`
        : null
  const own = agentListingNumericPrice(row)
  const pf = own ?? proj.launch_price_from
  const pt = own ?? proj.launch_price_to
  const gallery = mergedListingGalleryUrls(proj, row.agent_listing_images)
  const firstImg = gallery[0]
  return {
    id: `agent:${row.id}`,
    lat,
    lng,
    title: row.title,
    slug: proj.slug,
    detail_href: `/listings/${row.id}`,
    image_url: firstImg ?? proj.developers?.logo_url ?? null,
    price_label: formatPrice(pf, pt, row.currency?.trim() || proj.currency || "AED"),
    bedrooms: u?.bedrooms ?? null,
    bathrooms: u?.bathrooms ?? null,
    area_label: areaLabel,
    location_label: locationLabel,
  }
}

export function listViewHrefFromSp(sp: Awaited<ListingSearchParams>, basePath: "/buy" | "/rent"): string {
  const p = new URLSearchParams()
  if (sp.q) p.set("q", sp.q)
  if (sp.type) p.set("type", sp.type)
  if (sp.beds) p.set("beds", sp.beds)
  if (sp.minPrice) p.set("minPrice", sp.minPrice)
  if (sp.maxPrice) p.set("maxPrice", sp.maxPrice)
  if (sp.minBaths) p.set("minBaths", sp.minBaths)
  if (sp.sort) p.set("sort", sp.sort)
  const qs = p.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

export type { ListingMarket }

export const loadPublicAgentListings = cache((market: ListingMarket) => getPublicAgentListingsCached(market))

/** Public /buy and /rent: published sales-pipeline listings only (no developer project catalog). */
export function deriveListings(
  sp: Awaited<ListingSearchParams>,
  agentRows: PublicAgentListingRow[],
  agentError: boolean,
) {
  const filtered = agentError ? [] : agentRows.filter((a) => agentMatchesFilters(a, sp))
  const sorted = sortPublicAgentRows(filtered, sp.sort ?? "popular")
  const properties = sorted.map(agentListingToCard)
  const mapMarkers = sorted.map(agentListingToMapMarker).filter((m): m is BuyMapMarker => m != null)

  const rawTotal = agentError ? 0 : agentRows.length
  const shown = sorted.length
  const totalLabel =
    agentError || rawTotal === 0
      ? null
      : shown === rawTotal
        ? `Showing all ${shown} listing${shown === 1 ? "" : "s"}`
        : `Showing ${shown} of ${rawTotal} listing${rawTotal === 1 ? "" : "s"}`

  return { properties, mapMarkers, totalLabel }
}
