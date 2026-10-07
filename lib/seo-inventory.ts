import "server-only"

import { cache } from "react"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { NON_UAE_CITIES, getSeoPage, type SeoPage, type SeoPageFilter, type SeoSort } from "@/lib/seo-pages"
import { currentQuarterRank, handoverRank, isHandoverOverdue, parseHandover } from "@/lib/project-seo"
import { emirateCodeForCity } from "@/lib/emirates"
import { ogCardImage } from "@/lib/og-url"

/**
 * The live inventory behind the SEO catalogue pages (landings, area guides, handover pages) — one query and
 * one set of stat / sort rules shared by the page, its metadata and its share card (/og/seo/<slug>), because a
 * route handler cannot import from a page module. Moved verbatim out of app/(public-page)/(header-footer)/[slug]/page.tsx.
 * Server-only: it reads Supabase; lib/seo-pages.ts must stay import-free and never imports this.
 */

/** Prices below this are placeholder rows, not real UAE property prices —
 *  never surface them as a headline stat. (Same guard in the homepage hero.) */
const MIN_REALISTIC_PRICE_AED = 50_000

/** Below this an area has too little of our own stock to headline a grid. */
export const MIN_GUIDE_INVENTORY = 3

export type SeoGridRow = {
  id: number
  name: string
  slug: string | null
  main_image: string | null
  location: string | null
  city: string | null
  community: string | null
  delivery_quarter: string | null
  /** The handover sort and the overdue rule fall back to these when delivery_quarter has no year. */
  expected_completion_date: string | null
  delivery_date: string | null
  launch_price_from: number | string | null
  launch_price_to: number | string | null
  currency: string | null
  status: string
  is_featured: boolean | null
  developers: { name: string | null; logo_url: string | null; slug: string | null } | null
  /** Unit prices, used to keep the "starting from" stat honest — see inventoryPriceFrom. */
  project_units: { price_from: number | string | null }[] | null
}

/**
 * Projects matching a SeoPageFilter, with a gallery image substituted for any
 * row whose main_image is blank and rows that still have no photo dropped.
 * Shared by the inventory landing pages and the area guides.
 */
export async function fetchSeoInventory(filter: SeoPageFilter): Promise<SeoGridRow[]> {
  const supabase = createPublicSupabaseClient()

  // Property-type pages need an inner join so only projects carrying the
  // type survive; every other page keeps the plain select.
  const baseSelect =
    "id, name, slug, main_image, location, city, community, delivery_quarter, expected_completion_date, delivery_date, launch_price_from, launch_price_to, currency, status, is_featured, developers(name, logo_url, slug), project_units(price_from)"
  // Widened to string on purpose: supabase-js's type-level parser can't read
  // the conditional embed, and these rows are consumed loosely below anyway.
  const select: string = filter.propertyTypeLike
    ? `${baseSelect}, project_property_types!inner(property_types!inner(name))`
    : baseSelect

  let query = supabase
    .from("projects")
    .select(select)
    .eq("is_active", true)
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    // Ties (a bulk import shares one created_at) must not reshuffle: rows[0] is the lead photo, and so the OG card's version.
    .order("id", { ascending: false })

  if (filter.cityLike) {
    query = query.ilike("city", `%${filter.cityLike}%`)
  } else {
    // Portfolio-wide pages say "UAE" — keep the one-off foreign projects out
    // so the claim stays true.
    for (const c of NON_UAE_CITIES) query = query.not("city", "ilike", `%${c}%`)
  }
  if (filter.statuses?.length) query = query.in("status", filter.statuses)
  if (filter.propertyTypeLike) {
    query = query.ilike("project_property_types.property_types.name", `%${filter.propertyTypeLike}%`)
  }
  if (filter.locationLike) {
    query = query.or(`location.ilike.%${filter.locationLike}%,community.ilike.%${filter.locationLike}%`)
  }
  if (filter.priceMin != null) query = query.gte("launch_price_from", filter.priceMin)
  if (filter.priceMax != null) {
    // The realistic floor keeps placeholder AED 1 rows off "budget" pages.
    query = query.gte("launch_price_from", MIN_REALISTIC_PRICE_AED).lte("launch_price_from", filter.priceMax)
  }
  if (filter.handoverYear) {
    const y = filter.handoverYear
    query = query.or(
      `delivery_quarter.ilike.%${y}%,and(expected_completion_date.gte.${y}-01-01,expected_completion_date.lte.${y}-12-31)`,
    )
  }

  const { data: projectsRaw, error } = await query
  // A failed query must not become "Nothing here right now": this is an ISR route, so an empty
  // grid would be cached (and the sitemap lists the page). Throw — ISR keeps serving the last
  // good copy, and the error is retried.
  if (error) {
    console.error("[seo-inventory] projects query error:", error.message)
    throw new Error("Failed to load SEO inventory")
  }
  const projects = (projectsRaw ?? []) as unknown as SeoGridRow[]

  const missingIds = (projects ?? []).filter((p) => !p.main_image?.trim()).map((p) => p.id)
  const galleryFallback = new Map<number, string>()
  if (missingIds.length > 0) {
    const { data: gallery, error: galleryError } = await supabase
      .from("project_images")
      .select("project_id, url, is_main, rank")
      .in("project_id", missingIds)
      .order("is_main", { ascending: false })
      .order("rank", { ascending: true })
    // Same rule: a failed photo lookup would silently drop rows from the grid and the stats.
    if (galleryError) {
      console.error("[seo-inventory] gallery query error:", galleryError.message)
      throw new Error("Failed to load SEO inventory photos")
    }
    for (const g of gallery ?? []) {
      if (g.url && !galleryFallback.has(g.project_id)) galleryFallback.set(g.project_id, g.url)
    }
  }
  return (projects ?? [])
    .map((p) => ({ ...p, main_image: p.main_image?.trim() || galleryFallback.get(p.id) || null }))
    .filter((p) => p.main_image)
    // A page about projects handing over in a YEAR must not list cards that say "handover date under
    // review" — rows whose stated quarter has already passed leave the year pages (the off-plan hub, which
    // is not about one year, keeps them, last).
    .filter((p) => !filter.handoverYear || !isHandoverOverdue(p))
}

/**
 * Lowest price actually on sale across a result set.
 *
 * launch_price_from undercuts the project's own unit table on 124 of the 174
 * projects that carry both, so a bare MIN over that column advertised prices
 * nothing was sold at (Al Jaddaf led with "AED 199,999" against a cheapest
 * real unit of AED 1,999,999). Same rule as priceFromValue on project pages.
 */
function projectFloorPrice(p: SeoGridRow): number | null {
  const head = Number(p.launch_price_from)
  const headline = Number.isFinite(head) && head >= MIN_REALISTIC_PRICE_AED ? head : null
  const units = (p.project_units ?? [])
    .map((u) => Number(u.price_from))
    .filter((n) => Number.isFinite(n) && n >= MIN_REALISTIC_PRICE_AED)
  if (units.length === 0) return headline
  const cheapestUnit = Math.min(...units)
  if (headline == null) return cheapestUnit
  return headline < cheapestUnit * 0.9 ? cheapestUnit : Math.min(headline, cheapestUnit)
}

/** Cheapest price on sale in a result set, formatted. */
export function inventoryPriceFrom(rows: SeoGridRow[]): string | null {
  const priced = rows
    .map((p) => ({ p, floor: projectFloorPrice(p) }))
    .filter((x): x is { p: SeoGridRow; floor: number } => x.floor != null)
    .sort((a, b) => a.floor - b.floor)[0]
  if (!priced) return null
  const cheapest = priced.floor
  const currency = (priced.p.currency ?? "AED").toUpperCase()
  return `${currency} ${
    cheapest >= 1_000_000
      ? `${(cheapest / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
      : cheapest.toLocaleString("en-AE", { maximumFractionDigits: 0 })
  }`
}

/**
 * "2026–2029" across the stock still being delivered. Completed projects are
 * excluded — an area guide that announced "Handover 2018–2028" was quoting a
 * building handed over years ago.
 */
export function inventoryHandoverRange(rows: SeoGridRow[]): string | null {
  const years = rows
    .filter((p) => p.status !== "completed")
    .map((p) => p.delivery_quarter?.match(/\d{4}/)?.[0])
    .filter((y): y is string => Boolean(y))
    .sort()
  if (years.length === 0) return null
  const first = years[0]
  const last = years[years.length - 1]
  return first === last ? first : `${first}–${last}`
}

/**
 * The grid's order. "handover": handovers still to come soonest first, then those already past
 * (most recently due first — they are overdue, not imminent), then undated; one rule for every
 * page that sorts by handover. A plain ascending sort would put the 18 projects whose stated
 * quarter has already passed into the first 24 cards. Any other sort keeps the query's order
 * (newest added first).
 */
export function sortInventory(rows: SeoGridRow[], sort: SeoSort | undefined, now: Date): SeoGridRow[] {
  if (sort !== "handover") return rows
  const nowRank = currentQuarterRank(now)
  const key = (p: SeoGridRow): [number, number] => {
    const h = parseHandover(p.delivery_quarter, p.expected_completion_date)
    if (!h) return [2, 0]
    const rank = handoverRank(h)
    return rank >= nowRank ? [0, rank] : [1, -rank]
  }
  return [...rows].sort((a, b) => {
    const [bucketA, rankA] = key(a)
    const [bucketB, rankB] = key(b)
    return bucketA - bucketB || rankA - rankB
  })
}

/**
 * The rows a catalogue page actually lists, in the order it lists them — once, through React's cache(), so
 * generateMetadata, the page body and the share card share one query per render (outside a render cache()
 * just calls through, so the route handler works too). A transient error throws (5xx), per the ISR rule.
 * Callers must treat the returned array as read-only.
 *  - a "projects" page: its filter, then (for an emirate hub) only rows whose city names an emirate, then its sort;
 *  - a guide: its inventoryFilter, or nothing.
 */
export const getSeoInventory = cache(async (slug: string): Promise<SeoGridRow[]> => {
  const seo = getSeoPage(slug)
  if (!seo) return []
  if (seo.kind === "projects") {
    const fetched = await fetchSeoInventory(seo.filter ?? {})
    const rows = seo.layout === "emirate-hub" ? fetched.filter((p) => emirateCodeForCity(p.city)) : fetched
    return sortInventory(rows, seo.sort, new Date())
  }
  return seo.inventoryFilter ? fetchSeoInventory(seo.inventoryFilter) : []
})

/** What the share card draws from the inventory: its lead photo and one line of stats ("42 projects · from AED 650K"). */
export function seoCardFacts(seo: SeoPage, rows: readonly SeoGridRow[]): { photo: string | null; stat: string | null } {
  // A guide shows its stats strip only from MIN_GUIDE_INVENTORY projects; the card mirrors the page.
  const statsShown = seo.kind === "projects" ? rows.length >= 1 : rows.length >= MIN_GUIDE_INVENTORY
  const from = statsShown ? inventoryPriceFrom([...rows]) : null
  const stat = statsShown ? `${rows.length} ${rows.length === 1 ? "project" : "projects"}${from ? ` · from ${from}` : ""}` : null
  return { photo: rows[0]?.main_image ?? null, stat }
}

/** The card's metadata fields for a catalogue page: the URL's ?v= covers the lead photo, the count and the price — everything the card draws. */
export function seoOgImage(seo: SeoPage, rows: readonly SeoGridRow[]): { imageUrl: string; imageWidth: 1200; imageHeight: 630 } {
  const { photo, stat } = seoCardFacts(seo, rows)
  return ogCardImage(`/og/seo/${seo.slug}`, seo.h1, photo, stat)
}
