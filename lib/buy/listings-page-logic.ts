import { cache } from "react"
import { getListingPageProjectsCached, type BuyRawProject, type ListingMarket } from "@/lib/buy/cached-projects"
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
    detail_path: `/listings/${row.slug ?? row.id}`,
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
    detail_href: `/listings/${row.slug ?? row.id}`,
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

/** Developer catalog projects for the same market — blended into /buy //rent
 *  below the curated agent listings. react.cache dedupes across the several
 *  Suspense'd components that each call this per render. */
export const loadListingPageProjects = cache((market: ListingMarket) => getListingPageProjectsCached(market))

/** Reuses the agent-row filter logic verbatim for a catalog project: the
 *  pseudo row carries the project as its embed, so q/type/beds/baths/price
 *  all read the same fields they already read for project-linked listings. */
function projectAsPseudoAgentRow(p: BuyRawProject): PublicAgentListingRow {
  return {
    id: `project:${p.id}`,
    slug: null,
    title: p.name,
    description: p.description,
    listing_kind: "sale",
    price: null,
    currency: p.currency ?? "AED",
    unit_type: null,
    created_at: p.created_at,
    updated_at: p.created_at,
    projects: p,
    agent_listing_images: null,
  }
}

/** Card for a catalog project. null when the /{developer}/{project} detail
 *  route can't be addressed (missing either slug). */
function projectToCard(p: BuyRawProject): BuyPropertyCardData | null {
  const devSlug = p.developers?.slug
  if (!p.slug || !devSlug) return null
  const u = pickUnit(p.project_units)
  const gallery = mergedListingGalleryUrls(p, null)
  return {
    id: `project:${p.id}`,
    name: p.name,
    slug: p.slug,
    detail_path: `/${devSlug}/${p.slug}`,
    main_image: p.main_image ?? gallery[0] ?? null,
    gallery_urls: gallery.length > 0 ? gallery : undefined,
    description: p.description,
    city: p.city,
    location: p.location,
    launch_price_from: p.launch_price_from,
    launch_price_to: p.launch_price_to,
    currency: p.currency ?? "AED",
    developers: p.developers,
    unit_type: u?.unit_type ?? null,
    bedrooms: u?.bedrooms ?? null,
    bathrooms: u?.bathrooms ?? null,
    size_sqft: u?.size_sqft ?? null,
    size_sqm: u?.size_sqm ?? null,
  }
}

function projectToMapMarker(p: BuyRawProject): BuyMapMarker | null {
  const devSlug = p.developers?.slug
  if (!p.slug || !devSlug) return null
  const lat = parseCoord(p.latitude)
  const lng = parseCoord(p.longitude)
  if (lat == null || lng == null) return null
  const u = pickUnit(p.project_units)
  const gallery = mergedListingGalleryUrls(p, null)
  const areaLabel =
    u?.size_sqm != null
      ? `${u.size_sqm.toLocaleString("en-AE")} sqm`
      : u?.size_sqft != null
        ? `${u.size_sqft.toLocaleString("en-AE")} sqft`
        : null
  return {
    id: `project:${p.id}`,
    lat,
    lng,
    title: p.name,
    slug: p.slug,
    detail_href: `/${devSlug}/${p.slug}`,
    image_url: p.main_image ?? gallery[0] ?? p.developers?.logo_url ?? null,
    price_label: formatPrice(p.launch_price_from, p.launch_price_to, p.currency ?? "AED"),
    bedrooms: u?.bedrooms ?? null,
    bathrooms: u?.bathrooms ?? null,
    area_label: areaLabel,
    location_label: [p.city, p.location].filter(Boolean).join(", ") || "United Arab Emirates",
  }
}

type BlendedItem = {
  card: BuyPropertyCardData
  marker: BuyMapMarker | null
  entry: number | null
  dateMs: number
  isAgent: boolean
  featured: boolean
}

/**
 * Public /buy and /rent: curated agent listings blended with the developer
 * project catalog (the actual sale inventory — /buy used to show only the
 * couple of agent listings while 180+ projects never surfaced). Projects
 * already attached to an agent listing are deduped out; default order puts
 * agent listings (exact prices) first, then featured projects, then newest.
 * Explicit price/newest sorts rank the merged set globally.
 */
export function deriveListings(
  sp: Awaited<ListingSearchParams>,
  agentRows: PublicAgentListingRow[],
  agentError: boolean,
  projectRows: BuyRawProject[] = [],
  projectError: boolean = false,
) {
  const safeAgentRows = agentError ? [] : agentRows
  const linkedProjectIds = new Set(
    safeAgentRows.map((r) => r.projects?.id).filter((id): id is string => id != null),
  )
  const dedupedProjects = projectError
    ? []
    : projectRows.filter((p) => !linkedProjectIds.has(p.id))

  const t = (d: string) => {
    const x = new Date(d).getTime()
    return Number.isFinite(x) ? x : 0
  }

  const items: BlendedItem[] = [
    ...safeAgentRows
      .filter((a) => agentMatchesFilters(a, sp))
      .map((a) => ({
        card: agentListingToCard(a),
        marker: agentListingToMapMarker(a),
        entry: agentListingEntryPrice(a),
        dateMs: t(a.updated_at || a.created_at),
        isAgent: true,
        featured: false,
      })),
    ...dedupedProjects
      .filter((p) => agentMatchesFilters(projectAsPseudoAgentRow(p), sp))
      .flatMap((p) => {
        const card = projectToCard(p)
        if (!card) return []
        return [
          {
            card,
            marker: projectToMapMarker(p),
            entry: listingEntryPrice(p),
            dateMs: t(p.created_at),
            isAgent: false,
            featured: Boolean(p.is_featured),
          },
        ]
      }),
  ]

  switch (sp.sort ?? "popular") {
    case "price_asc":
      items.sort((a, b) => (a.entry ?? 1e15) - (b.entry ?? 1e15))
      break
    case "price_desc":
      items.sort((a, b) => (b.entry ?? 0) - (a.entry ?? 0))
      break
    case "newest":
      items.sort((a, b) => b.dateMs - a.dateMs)
      break
    default:
      items.sort((a, b) => {
        if (a.isAgent !== b.isAgent) return a.isAgent ? -1 : 1
        if (!a.isAgent && a.featured !== b.featured) return a.featured ? -1 : 1
        return b.dateMs - a.dateMs
      })
  }

  const properties = items.map((i) => i.card)
  const mapMarkers = items.map((i) => i.marker).filter((m): m is BuyMapMarker => m != null)

  const rawTotal = safeAgentRows.length + dedupedProjects.length
  const shown = items.length
  const totalLabel =
    rawTotal === 0
      ? null
      : shown === rawTotal
        ? `Showing all ${shown} propert${shown === 1 ? "y" : "ies"}`
        : `Showing ${shown} of ${rawTotal} propert${rawTotal === 1 ? "y" : "ies"}`

  return { properties, mapMarkers, totalLabel }
}
