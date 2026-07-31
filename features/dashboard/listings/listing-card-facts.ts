// Card facts for the agent "My listings" page.
//
// Everything a listing card shows is derived here from real columns. Deliberately
// mirrors the public listing page (app/listings/[id]/page.tsx + lib/buy/
// listings-page-logic.ts) so the dashboard never claims something the public page
// doesn't show.
//
// Where the data simply doesn't exist, these return null and the card renders a
// dash — nothing here invents a value:
//   • location, beds, baths, size and project pricing live on the PROJECT, so a
//     standalone listing (project_id null) has none of them,
//   • agent_listings has no rent period, so a rent price carries no "/ year",
//   • agent_listings has no expiry, sold or pending state — the status CHECK
//     allows only draft | published | archived.

import type { ProjectUnitFacts } from "@/lib/agent-listings-service"

/**
 * The minimum shape these helpers need. Both `AgentListing` (agent page, browser
 * client + RLS) and `AdminListingRow` (admin page, service-role API) satisfy it
 * structurally, so the two listing pages derive location, pricing and unit facts
 * from exactly the same code and can never disagree.
 */
export type ListingFacts = {
  id: string
  slug?: string | null
  title: string
  status: "draft" | "published" | "archived"
  /** Migration 019. Optional so the admin row type, which doesn't select it, still fits. */
  is_featured?: boolean | null
  updated_at: string
  description: string | null
  listing_kind: "sale" | "rent"
  price: number | null
  currency: string
  unit_type: string | null
  project_id: number | null
  projects?: {
    name: string
    city?: string | null
    location?: string | null
    community?: string | null
    main_image?: string | null
    launch_price_from?: number | string | null
    launch_price_to?: number | string | null
    currency?: string | null
    developers?: { name?: string | null } | null
    project_units?: ProjectUnitFacts[] | null
    project_property_types?: { property_types?: { name?: string | null } | null }[] | null
  } | null
  agent_listing_images?: { url: string; sort_order: number }[] | null
}

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function text(v: string | null | undefined): string | null {
  const t = (v ?? "").trim()
  return t === "" ? null : t
}

// ─── Location ─────────────────────────────────────────────────────────────────

/** "Downtown Dubai, Dubai" from the linked project. Real data often repeats the
 *  same name across city/location/community (e.g. both "Dubai Marina"), so parts
 *  are de-duplicated case-insensitively before joining. */
export function locationLabel(row: ListingFacts): string | null {
  const p = row.projects
  if (!p) return null
  const parts = [text(p.community), text(p.location), text(p.city)].filter(
    (v): v is string => v != null,
  )
  const seen = new Set<string>()
  const unique = parts.filter((part) => {
    const key = part.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return unique.length > 0 ? unique.join(", ") : null
}

// ─── Unit facts (beds / baths / size) ─────────────────────────────────────────

/** Prefer the developer unit line the agent actually picked; otherwise fall back
 *  the same way the public page does (first unit that has a bedroom count). */
export function resolveUnit(row: ListingFacts): ProjectUnitFacts | null {
  const units = row.projects?.project_units
  if (!units?.length) return null
  const wanted = text(row.unit_type)?.toLowerCase()
  if (wanted) {
    const exact = units.find((u) => text(u.unit_type)?.toLowerCase() === wanted)
    if (exact) return exact
  }
  return units.find((u) => u.bedrooms != null) ?? units[0] ?? null
}

export type UnitFacts = {
  beds: number | null
  baths: number | null
  /** Rounded, with the unit it was stored in — sqft is preferred when present,
   *  matching the public listing page. */
  size: { value: number; unit: "sqft" | "sqm" } | null
}

export function unitFacts(row: ListingFacts): UnitFacts {
  const u = resolveUnit(row)
  if (!u) return { beds: null, baths: null, size: null }
  const sqft = num(u.size_sqft)
  const sqm = num(u.size_sqm)
  return {
    beds: u.bedrooms,
    baths: u.bathrooms,
    size:
      sqft != null
        ? { value: Math.round(sqft), unit: "sqft" }
        : sqm != null
          ? { value: Math.round(sqm), unit: "sqm" }
          : null,
  }
}

// ─── Price ────────────────────────────────────────────────────────────────────

function formatMoney(from: number, to: number | null, currency: string): string {
  const code = (currency || "AED").toUpperCase()
  const locale = code === "AED" ? "en-AE" : "en-US"
  const fmt = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 0 })
  const lead = code === "USD" ? "$" : `${code} `
  if (to != null && to !== from) {
    return code === "USD" ? `$${fmt(from)} – $${fmt(to)}` : `${lead}${fmt(from)} – ${fmt(to)}`
  }
  return `${lead}${fmt(from)}`
}

export type PriceLine = {
  text: string
  /** true when the figure came from the developer's project, not the listing. */
  fromProject: boolean
  known: boolean
}

/** The listing's own price wins; otherwise the picked unit's range, then the
 *  project's launch range — the same precedence the public page uses. No rent
 *  period is appended: agent_listings stores no period. */
export function priceLine(row: ListingFacts): PriceLine {
  const own = num(row.price)
  if (own != null) {
    return { text: formatMoney(own, null, row.currency), fromProject: false, known: true }
  }

  const p = row.projects
  const currency = text(p?.currency) ?? row.currency ?? "AED"
  const unit = resolveUnit(row)
  const unitFrom = num(unit?.price_from ?? null)
  if (unitFrom != null) {
    return {
      text: formatMoney(unitFrom, num(unit?.price_to ?? null), currency),
      fromProject: true,
      known: true,
    }
  }

  const launchFrom = num(p?.launch_price_from ?? null)
  if (launchFrom != null) {
    return {
      text: formatMoney(launchFrom, num(p?.launch_price_to ?? null), currency),
      fromProject: true,
      known: true,
    }
  }

  return { text: "Price on request", fromProject: false, known: false }
}

// ─── Cover image ──────────────────────────────────────────────────────────────

/** The agent's own first photo, else the developer project's main image. */
export function coverImage(row: ListingFacts): string | null {
  const own = row.agent_listing_images?.[0]?.url
  if (text(own)) return own as string
  return text(row.projects?.main_image)
}

export function photoCount(row: ListingFacts): number {
  return row.agent_listing_images?.length ?? 0
}

// ─── Labels ───────────────────────────────────────────────────────────────────

export function developerName(row: ListingFacts): string | null {
  return text(row.projects?.developers?.name)
}

export function projectName(row: ListingFacts): string | null {
  return text(row.projects?.name)
}

/** Public URL for a listing (slug from migration 013; the id still resolves). */
export function publicPath(row: ListingFacts): string {
  return `/listings/${text(row.slug) ?? row.id}`
}

export function unitTypeLabel(row: ListingFacts): string | null {
  return text(row.unit_type) ?? text(resolveUnit(row)?.unit_type ?? null)
}

/** Property types the linked project is tagged with (Apartment / Penthouse /
 *  Townhouse / Villa). Empty for standalone listings — agent_listings itself has
 *  no property-type column. */
export function propertyTypes(row: ListingFacts): string[] {
  const links = row.projects?.project_property_types
  if (!links?.length) return []
  const names = links
    .map((l) => text(l.property_types?.name))
    .filter((v): v is string => v != null)
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))
}

/** Everything the search box matches. `slug` is included so pasting the tail of a
 *  public link finds the listing — agent_listings has no reference/code column. */
export function searchHaystack(row: ListingFacts): string {
  return [
    row.title,
    row.slug,
    row.unit_type,
    row.description,
    projectName(row),
    developerName(row),
    locationLabel(row),
    ...propertyTypes(row),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}
