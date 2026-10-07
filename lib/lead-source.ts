/**
 * Where a public lead came from — the vocabulary of `inquiries.source`.
 *
 * The column is free text (migration 028: NOT NULL DEFAULT 'project_page', no
 * CHECK), so page attribution travels in it without a migration:
 *   · "project_page"        — the Inquire Now form on a project page (every lead before landing and
 *                              developer pages got the same form)
 *   · "landing:<slug>"      — a search landing page, e.g. "landing:off-plan-projects-in-dubai"
 *   · "developer:<slug>"    — a developer's page, e.g. "developer:azizi-developments"
 *   · "website"             — a submission whose page could not be established
 *
 * The API route writes these (after validating the slug server-side — a caller
 * never supplies a label), and the Leads dashboard, the notifications bell and
 * the FHI Assistant read them back through leadSourceLabel(), so they cannot
 * drift apart. Pure and dependency-free: safe in API routes and client bundles.
 */

export const PROJECT_PAGE_SOURCE = "project_page"
export const WEBSITE_SOURCE = "website"

export type LeadContextKind = "landing" | "developer"

export function leadSource(kind: LeadContextKind, slug: string): string {
  return `${kind}:${slug}`
}

/** "/off-plan-projects-in-dubai" for a landing- or developer-page lead; null for every other source. */
export function leadSourcePath(source: string | null | undefined): string | null {
  const value = (source ?? "").trim()
  const colon = value.indexOf(":")
  if (colon <= 0) return null
  const kind = value.slice(0, colon)
  const slug = value.slice(colon + 1)
  return (kind === "landing" || kind === "developer") && slug ? `/${slug}` : null
}

/** A human label for a stored source, for lists, threads and bell items. Unknown values are shown as stored. */
export function leadSourceLabel(source: string | null | undefined): string {
  const value = (source ?? "").trim()
  if (!value) return "Unknown source"
  if (value === PROJECT_PAGE_SOURCE) return "Project page — Inquire Now"
  if (value === WEBSITE_SOURCE) return "Website"
  const colon = value.indexOf(":")
  if (colon > 0) {
    const kind = value.slice(0, colon)
    const slug = value.slice(colon + 1)
    if (kind === "landing" && slug) return `Landing page — /${slug}`
    if (kind === "developer" && slug) return `Developer page — /${slug}`
  }
  return value
}
