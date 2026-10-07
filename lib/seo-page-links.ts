import { EMIRATES, emirateCodeForCity } from "@/lib/emirates"
import { SEO_PAGES, type SeoPage, type SeoPageFilter } from "@/lib/seo-pages"

/**
 * Helpers that tie a landing page's filter to what the rest of the site can express —
 * the /projects browser and the other landing pages. They live apart from
 * lib/seo-pages.ts because that file must stay import-free (the footer reads it on every
 * public page).
 */

const short = (aed: number): string => (aed >= 1_000_000 ? `${aed / 1_000_000}M` : `${Math.round(aed / 1000)}K`)

/**
 * Where "Browse all" should go for a landing page's filter: /projects with the nearest filters
 * the browser supports (emirate, off-plan vs ready, price bounds). The page's location, property
 * type and handover year are not expressible there and are left out, so the label says only what
 * the destination shows — and carries no count, because /projects counts differently (exact city
 * match, "off-plan" = every status but completed, no AED 50k price floor).
 */
export function projectsBrowseTarget(filter: SeoPageFilter = {}): { href: string; label: string } {
  const emirate = EMIRATES.find((e) => e.code === emirateCodeForCity(filter.cityLike))
  const statuses = filter.statuses ?? []
  const ready = statuses.length > 0 && statuses.every((s) => s === "completed")
  const offPlan = statuses.length > 0 && !statuses.includes("completed")

  const params = new URLSearchParams()
  if (emirate) params.set("city", emirate.cityParam)
  if (ready) params.set("status", "completed")
  else if (offPlan) params.set("status", "off_plan")
  if (filter.priceMin) params.set("price_min", String(filter.priceMin))
  if (filter.priceMax) params.set("price_max", String(filter.priceMax))

  const price = filter.priceMax
    ? ` under AED ${short(filter.priceMax)}`
    : filter.priceMin
      ? ` from AED ${short(filter.priceMin)}`
      : ""
  const what = ready ? "ready projects" : offPlan ? "off-plan projects" : "projects"
  const query = params.toString()
  return { href: query ? `/projects?${query}` : "/projects", label: `Browse all ${emirate?.name ?? "UAE"} ${what}${price}` }
}

/**
 * The regulator chip for a landing page — only where the claim is true. Dubai inventory is
 * RERA-regulated; Abu Dhabi and UAE-wide pages are not, so they carry no chip.
 */
export function regulatorLine(filter?: SeoPageFilter): string | null {
  return (filter?.cityLike ?? "").toLowerCase().includes("dubai") ? "RERA-registered developers" : null
}

const sameSet = (a: string[] | undefined, b: string[] | undefined) => {
  const x = new Set(a ?? [])
  const y = new Set(b ?? [])
  return x.size === y.size && [...x].every((v) => y.has(v))
}

/**
 * The landing page whose inventory is EXACTLY this filter (same city, same statuses, nothing else
 * narrowing it), or undefined. A hub's "See all" link uses it so it never points at a page with a
 * different grid.
 */
export function landingPageForFilter(filter: SeoPageFilter): SeoPage | undefined {
  const city = (filter.cityLike ?? "").toLowerCase()
  return SEO_PAGES.find((page) => {
    const f = page.filter
    return (
      page.kind === "projects" &&
      !page.layout &&
      f !== undefined &&
      (f.cityLike ?? "").toLowerCase() === city &&
      sameSet(f.statuses, filter.statuses) &&
      !f.propertyTypeLike &&
      !f.locationLike &&
      f.priceMin === undefined &&
      f.priceMax === undefined &&
      !f.handoverYear
    )
  })
}
