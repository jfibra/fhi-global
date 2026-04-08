import { cache } from "react"
import {
  getBuyPageProjectsCached,
  pickBuyListingImage,
  type BuyRawProject,
} from "@/lib/buy/cached-projects"
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

export function toMapMarker(p: BuyRawProject): BuyMapMarker | null {
  const lat = parseCoord(p.latitude)
  const lng = parseCoord(p.longitude)
  if (lat == null || lng == null) return null
  return {
    id: String(p.id),
    lat,
    lng,
    title: p.name,
    slug: p.slug,
    image_url: pickBuyListingImage(p) ?? p.developers?.logo_url ?? null,
  }
}

export function toCard(p: BuyRawProject): BuyPropertyCardData {
  const u = pickUnit(p.project_units)
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    main_image: pickBuyListingImage(p),
    description: p.description,
    city: p.city,
    location: p.location,
    launch_price_from: p.launch_price_from,
    launch_price_to: p.launch_price_to,
    currency: p.currency,
    developers: p.developers,
    unit_type: u?.unit_type ?? null,
    bedrooms: u?.bedrooms ?? null,
    bathrooms: u?.bathrooms ?? null,
    size_sqft: u?.size_sqft ?? null,
    size_sqm: u?.size_sqm ?? null,
  }
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

export function filterProjects(rows: BuyRawProject[], sp: Awaited<ListingSearchParams>): BuyRawProject[] {
  let list = [...rows]
  const q = (sp.q ?? "").trim().toLowerCase()
  const type = (sp.type ?? "").trim().toLowerCase()
  const minBeds = sp.beds ? Number(sp.beds) : NaN
  const minBaths = sp.minBaths ? Number(sp.minBaths) : NaN
  const minPrice = parsePriceParam(sp.minPrice)
  const maxPrice = parsePriceParam(sp.maxPrice)

  if (q) {
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.city ?? "").toLowerCase().includes(q) ||
        (p.location ?? "").toLowerCase().includes(q)
    )
  }

  if (type) {
    list = list.filter((p) => {
      const units = p.project_units ?? []
      if (units.some((u) => (u.unit_type ?? "").toLowerCase().includes(type))) return true
      const linked = (p.project_property_types ?? [])
        .map((row) => row.property_types?.name)
        .filter((n): n is string => Boolean(n?.trim()))
      return linked.some((name) => name.toLowerCase().includes(type))
    })
  }

  if (Number.isFinite(minBeds) && minBeds > 0) {
    list = list.filter((p) => {
      const units = p.project_units ?? []
      return units.some((u) => u.bedrooms != null && u.bedrooms >= minBeds)
    })
  }

  if (Number.isFinite(minBaths) && minBaths > 0) {
    list = list.filter((p) => {
      const units = p.project_units ?? []
      return units.some((u) => u.bathrooms != null && u.bathrooms >= minBaths)
    })
  }

  if (minPrice != null) {
    list = list.filter((p) => {
      const entry = listingEntryPrice(p)
      return entry != null && entry >= minPrice
    })
  }

  if (maxPrice != null) {
    list = list.filter((p) => {
      const entry = listingEntryPrice(p)
      return entry != null && entry <= maxPrice
    })
  }

  return list
}

export function sortProjects(list: BuyRawProject[], sort: string): BuyRawProject[] {
  const out = [...list]
  const t = (d: string) => {
    const x = new Date(d).getTime()
    return Number.isFinite(x) ? x : 0
  }

  switch (sort) {
    case "price_asc":
      out.sort((a, b) => (a.launch_price_from ?? 1e15) - (b.launch_price_from ?? 1e15))
      break
    case "price_desc":
      out.sort((a, b) => (b.launch_price_from ?? 0) - (a.launch_price_from ?? 0))
      break
    case "newest":
      out.sort((a, b) => t(b.created_at) - t(a.created_at))
      break
    default:
      out.sort((a, b) => {
        const fa = a.is_featured === true ? 1 : 0
        const fb = b.is_featured === true ? 1 : 0
        if (fb !== fa) return fb - fa
        return t(b.created_at) - t(a.created_at)
      })
  }

  return out
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

export const loadListingProjects = cache(getBuyPageProjectsCached)

export function deriveListings(
  sp: Awaited<ListingSearchParams>,
  rows: BuyRawProject[],
  error: boolean
) {
  const filtered = error ? [] : filterProjects(rows, sp)
  const sorted = sortProjects(filtered, sp.sort ?? "popular")
  const properties = sorted.map(toCard)
  const mapMarkers = sorted.map(toMapMarker).filter((m): m is BuyMapMarker => m != null)
  const totalLabel =
    error || rows.length === 0
      ? null
      : filtered.length === rows.length
        ? `Showing all ${filtered.length} listing${filtered.length === 1 ? "" : "s"}`
        : `Showing ${filtered.length} of ${rows.length} listing${rows.length === 1 ? "" : "s"}`
  return { filtered, sorted, properties, mapMarkers, totalLabel }
}
