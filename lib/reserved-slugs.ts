import { isKnownRoleSlug } from "@/lib/app-roles"
import { SEO_PAGES } from "@/lib/seo-pages"

/**
 * Developer profiles live at the site root — /<slug> — in the same flat
 * namespace as the app's own routes and the curated landing pages and guides
 * (lib/seo-pages.ts). A developer saved with a slug that collides with one of
 * them either shadows a hub or SEO page (the [slug] route lets developers win
 * over landing pages) or is shadowed by a real route and 404s. Nothing collides
 * today; this keeps it that way: the developer form, the browser service and the
 * two server routes that set a slug all ask here first.
 */

/** Top-level URL segments owned by routes and files: app/**, app/(public-page)/**, and what the framework serves at the root. */
const ROUTE_SEGMENTS = new Set([
  // app/(public-page)/(header-footer)
  "about", "agent-websites", "agents", "b", "buy", "buy-with", "contact", "cookies", "developers",
  "dubai-mortgage-calculator", "events", "feedback", "gallery", "news", "open-data", "privacy", "rent",
  "s", "sell-with", "terms", "verify",
  // app/(public-page)/(landing) and (auth)
  "projects", "developers-login", "developer-login", "register", "staff-login", "login",
  // app/
  "account-inactive", "api", "auth", "business-card", "complete-profile", "dashboard", "johndorf",
  "listings", "logout", "og", "owner-documents", "template", "website", "internal",
  // folders under public/ — served at the root, so a developer slug with the same name would never be reached
  "background", "certificates", "fonts", "images", "logos", "materials", "pdfjs", "reelssounds", "seals",
  // files and framework paths served at the root
  "llms.txt", "robots.txt", "sitemap.xml", "news-sitemap.xml", "indexnow.txt", "favicon.ico", "_next",
])

/**
 * Why a slug cannot be given to a developer, or null when it is free to use.
 * Case-insensitive, like the URL space itself (uppercase paths now redirect to
 * lowercase).
 */
export function reservedSlugReason(slug: string): string | null {
  const s = slug.trim().toLowerCase()
  if (!s) return null
  if (ROUTE_SEGMENTS.has(s)) return `"${s}" is the address of a page on the site and cannot be used.`
  if (isKnownRoleSlug(s)) return `"${s}" is a dashboard address and cannot be used.`
  if (SEO_PAGES.some((p) => p.slug === s)) {
    return `"${s}" is already a landing page or guide on the site and cannot be used.`
  }
  return null
}

/** The shape of a developer's address: lower-case letters and digits in hyphen-separated words. */
export const DEVELOPER_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** What an editor typed, made fit to be an address: trimmed, lower-cased, spaces and underscores → hyphens. */
export function normalizeDeveloperSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Why a developer slug cannot be saved, or null when it can: required, then the shape of an address (a slug
 * with a space or a capital would make a URL that 404s or redirects), then reserved (a page or role that
 * already lives at that address). Pass the NORMALISED slug.
 */
export function developerSlugError(slug: string): string | null {
  const s = slug.trim()
  if (!s) return "Slug is required."
  if (!DEVELOPER_SLUG_RE.test(s)) {
    return "Use lower-case letters and digits, with single hyphens between words (for example azizi-developments)."
  }
  return reservedSlugReason(s)
}
