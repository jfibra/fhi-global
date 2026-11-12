import "server-only"

import type { createAdminSupabase } from "@/lib/admin-supabase"
import { findBrochureProject, loadBrochure, type Brochure } from "@/lib/brochure/data"
import { parseHandover } from "@/lib/project-seo"
import { SITE_URL } from "@/lib/seo"

/**
 * The project comparison sheet an agent sends a client (boss via Juliecor,
 * 2026-11-12 — the fourth premium output of the agents' FHI Assistant):
 * "compare Azizi Ruby and Samana Greenfield" → two or three projects side by
 * side on one landscape page — price, homes, handover, payment plan, area,
 * amenities — with the AGENT'S OWN contact card and QR code, so the client
 * comes back to them. Every project column is the brochure's data
 * (lib/brochure/data.ts), so the two documents never disagree; this file only
 * lines the columns up and marks which project wins each row.
 */

type Admin = ReturnType<typeof createAdminSupabase>

const base = () => SITE_URL.replace(/\/$/, "")

export const COMPARISON_MIN = 2
export const COMPARISON_MAX = 3

/** One row of the sheet: a label and one cell per project; `best` = the column that wins the row (index), when a row can be won. */
export type ComparisonRow = { label: string; cells: string[]; best: number | null; small?: boolean }

export type Comparison = {
  projects: Brochure["project"][]
  rows: ComparisonRow[]
  /** The one-line verdicts the chat and the sheet both print. */
  verdicts: string[]
  agent: Brochure["agent"]
  company: Brochure["company"]
  qr: { url: string; caption: string }
  generatedOn: string
}

const idxOfMin = (values: Array<number | null>): number | null => {
  let best: number | null = null
  values.forEach((v, i) => {
    if (v == null) return
    if (best === null || v < (values[best] as number)) best = i
  })
  // A tie is nobody's win.
  return best !== null && values.filter((v) => v === values[best as number]).length > 1 ? null : best
}

/** "Q4 2027" → 2027.75, "2028" → 2028.5, a completed project → 0 (already here). */
function handoverPoint(p: Brochure["project"]): number | null {
  if (!p.offPlan) return 0
  if (!p.handover) return null
  const parsed = parseHandover(p.handover)
  if (parsed) return parsed.year + (parsed.quarter - 1) / 4
  const year = p.handover.match(/(20\d{2})/)
  return year ? Number(year[1]) + 0.5 : null
}

const priceOf = (b: Brochure): number | null => {
  const m = (b.project.priceFrom ?? "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*([MK])?/i)
  if (!m) return null
  const n = Number(m[1]) * (m[2]?.toUpperCase() === "M" ? 1e6 : m[2]?.toUpperCase() === "K" ? 1e3 : 1)
  return Number.isFinite(n) && n > 0 ? n : null
}

const cheapestOf = (b: Brochure, beds: string): string | null => {
  const u = b.units.find((x) => x.beds === beds && x.price)
  return u ? `${u.price}${u.size ? ` · ${u.size}` : ""}` : null
}

const planOf = (b: Brochure): string =>
  b.plan.milestones.length >= 2
    ? b.plan.milestones.map((m) => `${Math.round(m.percent)}% ${m.label}`.trim()).join(" · ")
    : b.plan.downPayment
      ? `${Math.round(b.plan.downPayment)}% down payment`
      : b.plan.note ?? "On request"

export function buildComparison(brochures: Brochure[]): Comparison {
  const B = brochures
  const P = B.map((b) => b.project)
  const prices = B.map(priceOf)
  const handovers = P.map(handoverPoint)
  const downs = B.map((b) => (b.plan.milestones[0]?.percent ?? b.plan.downPayment ?? null))
  const bedTypes = ["Studio", "1 BR", "2 BR", "3 BR"].filter((t) => B.some((b) => cheapestOf(b, t)))

  const allRows: ComparisonRow[] = [
    { label: "From price", cells: P.map((p) => p.priceFrom ?? "On request"), best: idxOfMin(prices) },
    // Only when at least one project publishes a real range beyond its from-price.
    { label: "Price range", cells: P.map((p) => (p.priceRange && p.priceRange !== p.priceFrom ? p.priceRange : "—")), best: null, small: true },
    { label: "Developer", cells: P.map((p) => `${p.developer ?? "—"}${p.developerVerified ? " ✓" : ""}`), best: null },
    { label: "Area", cells: P.map((p) => p.area ?? "—"), best: null },
    { label: "Status", cells: P.map((p) => p.status), best: null },
    { label: "Handover", cells: P.map((p) => (p.offPlan ? p.handover ?? "—" : "Ready")), best: idxOfMin(handovers) },
    { label: "Homes", cells: P.map((p) => p.mix ?? (p.propertyTypes.length ? p.propertyTypes.join(", ") : "—")), best: null },
    { label: "Sizes", cells: P.map((p) => p.sizes ?? "—"), best: null, small: true },
    ...bedTypes.map((t) => ({ label: `${t} from`, cells: B.map((b) => cheapestOf(b, t) ?? "—"), best: null })),
    { label: "Payment plan", cells: B.map(planOf), best: null, small: true },
    { label: "Down payment", cells: downs.map((d) => (d != null ? `${Math.round(d)}%` : "—")), best: idxOfMin(downs) },
    { label: "Ownership", cells: P.map((p) => (p.freehold ? "Freehold" : p.ownership ?? "—")), best: null },
    { label: "Homes in project", cells: P.map((p) => (p.totalUnits ? p.totalUnits.toLocaleString("en-AE") : "—")), best: null },
    { label: "Amenities", cells: B.map((b) => (b.amenities.length ? b.amenities.slice(0, 5).join(", ") + (b.amenities.length > 5 ? ` +${b.amenities.length - 5}` : "") : "—")), best: null, small: true },
    { label: "Highlights", cells: B.map((b) => (b.highlights.length ? b.highlights.slice(0, 2).join(" · ") : "—")), best: null, small: true },
    { label: "Nearby", cells: B.map((b) => (b.nearby.length ? b.nearby.slice(0, 2).join(" · ") : "—")), best: null, small: true },
  ]
  // A row nobody publishes says nothing — and the sheet must stay one page.
  const rows = allRows.filter((r) => r.cells.some((c) => c !== "—"))

  const verdicts: string[] = []
  const cheapest = idxOfMin(prices)
  if (cheapest !== null) verdicts.push(`${P[cheapest].name} is the lowest entry price at ${P[cheapest].priceFrom}`)
  const soonest = idxOfMin(handovers)
  if (soonest !== null) verdicts.push(P[soonest].offPlan ? `${P[soonest].name} hands over first (${P[soonest].handover})` : `${P[soonest].name} is ready now`)
  const lightest = idxOfMin(downs)
  if (lightest !== null) verdicts.push(`${P[lightest].name} asks the smallest first payment (${Math.round(downs[lightest] as number)}%)`)

  const agent = B[0].agent
  const whatsappUrl = agent.whatsappDigits ? `https://wa.me/${agent.whatsappDigits}?text=${encodeURIComponent(`Hi ${agent.name.split(" ")[0]}, I'm comparing ${P.map((p) => p.name).join(" and ")}.`)}` : null
  const qr = agent.website ? { url: agent.website, caption: "Scan for my website" } : whatsappUrl ? { url: whatsappUrl, caption: "Scan to message me on WhatsApp" } : { url: `${base()}/projects`, caption: "Scan for all projects" }

  return { projects: P, rows, verdicts, agent, company: B[0].company, qr, generatedOn: B[0].generatedOn }
}

/** The brochures of 2–3 published projects for the caller, in the order asked; null when any is missing. */
export async function loadComparison(admin: Admin, ids: number[], who: { userId: string; email: string | null }): Promise<Comparison | null> {
  const unique = [...new Set(ids)].slice(0, COMPARISON_MAX)
  if (unique.length < COMPARISON_MIN) return null
  const brochures = await Promise.all(unique.map((id) => loadBrochure(admin, id, who)))
  if (brochures.some((b) => !b)) return null
  return buildComparison(brochures as Brochure[])
}

/** The chat tool's lookup: each name → a published project (the brochure's rule), with what was not found. */
export async function findComparisonProjects(admin: Admin, names: string[]): Promise<{ found: Array<Awaited<ReturnType<typeof findBrochureProject>> & object>; missing: string[] }> {
  const asked = names.map((n) => n.trim()).filter(Boolean).slice(0, COMPARISON_MAX)
  const results = await Promise.all(asked.map((n) => findBrochureProject(admin, n)))
  const found: Array<NonNullable<Awaited<ReturnType<typeof findBrochureProject>>>> = []
  const missing: string[] = []
  const seen = new Set<number>()
  results.forEach((r, i) => {
    if (!r) missing.push(asked[i])
    else if (!seen.has(r.id)) {
      seen.add(r.id)
      found.push(r)
    }
  })
  return { found, missing }
}
