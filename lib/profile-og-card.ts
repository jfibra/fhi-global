// Link-preview (OG card) model for a public business-card profile — shared by
// the Link Preview tab in the maker, the /og/business-card/{id} image route and
// the save path. Pure module, no framework imports, so it is safe in client
// components, API routes and the satori (ImageResponse) renderer alike.
//
// Mirrors lib/flyer/og-card.ts, which does the same job for agent listings, and
// borrows its palette so a shared listing and a shared profile look like they
// came from the same company.

import { OG_THEMES, OG_THEME_ORDER, type OgTheme } from "@/lib/flyer/og-card"
import { isDesignId, type DesignId } from "@/features/business-card/card-render"

export { OG_THEMES as PROFILE_OG_THEMES, OG_THEME_ORDER as PROFILE_OG_THEME_ORDER }
export type ProfileOgTheme = OgTheme

/** OG standard link-preview size (1.91:1) — same as every other /og route. */
export const PROFILE_OG_W = 1200
export const PROFILE_OG_H = 630

/** Gold (brand default), white, sky, mint, coral. */
export const PROFILE_OG_ACCENTS = ["#d6b357", "#ffffff", "#7dd3fc", "#6ee7b7", "#f87171"] as const

export type ProfileOgLayout = "split" | "center"
export type ProfileOgHideKey = "role" | "phone" | "email" | "tagline"

export const PROFILE_OG_HIDE_LABELS: { value: ProfileOgHideKey; label: string }[] = [
  { value: "role", label: "Job title" },
  { value: "tagline", label: "Tagline" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
]

/**
 * Facebook truncates a link title around 88 characters and the description
 * around 300, but both are cut far shorter in the mobile feed — these are the
 * lengths that survive everywhere, and the editor counts against them.
 */
export const OG_TITLE_MAX = 70
export const OG_DESCRIPTION_MAX = 160

/**
 * The title a link carries when no custom one is typed — and also what the
 * hide-title toggle resolves to, since a network always draws SOME title line.
 * The brand wordmark's own phrasing ("FHi Global Property"), not the person's
 * name: the name is already on the card image itself.
 */
export const DEFAULT_OG_TITLE = "FHI Global Property"

export type ProfileOgCard = {
  /** Schema version so stored JSON can evolve safely. */
  v: 1
  theme: ProfileOgTheme
  layout: ProfileOgLayout
  /** One of PROFILE_OG_ACCENTS. */
  accent: string
  hide: ProfileOgHideKey[]
  /** Overrides og:title. Empty = the person's name. */
  title: string
  /**
   * Whether the link carries a title at all. Off → og:title is the plain
   * "FHI Global" brand instead of the person's name; a network always renders
   * SOME title line, so the neutral brand is the closest thing to "none".
   */
  showTitle: boolean
  /** Overrides og:description. Empty = the tagline, else a generated line. */
  description: string
  /**
   * Which of the six Business Card front designs the link preview uses.
   * Empty = follow whatever is set on the Business Card page, so the two stay
   * in step unless the agent deliberately picks a different one here.
   */
  design: DesignId | ""
  /**
   * The rendered card, uploaded on save.
   *
   * The six designs are drawn to a canvas (features/business-card/card-render.ts)
   * with gradients, arcs and a skyline photo — there is no faithful way to
   * re-draw them in satori, and an approximation that looked *nearly* like the
   * agent's card would be worse than none. So the browser renders the real thing
   * at save time and uploads it, and this URL is what og:image points at.
   *
   * Null = never saved from the Link Preview tab; the page falls back to the
   * generated /og/business-card card.
   */
  image: string | null
}

export const DEFAULT_PROFILE_OG_CARD: ProfileOgCard = {
  v: 1,
  theme: "navy",
  layout: "split",
  accent: "#d6b357",
  hide: [],
  title: "",
  showTitle: true,
  description: "",
  design: "",
  image: null,
}

const HIDE_KEYS: ProfileOgHideKey[] = ["role", "phone", "email", "tagline"]

/** Collapses whitespace and clips — stored text goes straight into a meta tag. */
function oneLine(raw: unknown, max: number): string {
  if (typeof raw !== "string") return ""
  return raw.replace(/\s+/g, " ").trim().slice(0, max)
}

/**
 * Tolerant parser for stored/unknown JSON. Always returns a valid card:
 * unknown fields are dropped rather than rejected, so a half-written or
 * older-schema value degrades to the default instead of breaking the page.
 */
export function sanitizeProfileOgCard(raw: unknown): ProfileOgCard {
  const d = DEFAULT_PROFILE_OG_CARD
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return { ...d, hide: [] }
  const o = raw as Record<string, unknown>

  // Object.hasOwn (not `in`): raw JSON can name prototype keys like "toString",
  // which `in` accepts and OG_THEMES[theme] would then resolve to a function.
  const theme = (typeof o.theme === "string" && Object.hasOwn(OG_THEMES, o.theme)
    ? o.theme
    : d.theme) as ProfileOgTheme

  return {
    v: 1,
    theme,
    layout: o.layout === "center" ? "center" : "split",
    accent:
      typeof o.accent === "string" && (PROFILE_OG_ACCENTS as readonly string[]).includes(o.accent)
        ? o.accent
        : d.accent,
    hide: Array.isArray(o.hide)
      ? (o.hide.filter((h): h is ProfileOgHideKey => HIDE_KEYS.includes(h as ProfileOgHideKey)))
      : [],
    title: oneLine(o.title, OG_TITLE_MAX),
    // Only an explicit false hides it — absent (older saves) means shown.
    showTitle: o.showTitle !== false,
    description: oneLine(o.description, OG_DESCRIPTION_MAX),
    design: isDesignId(o.design) ? o.design : "",
    // Only our own bucket — this URL goes straight into a public meta tag, so a
    // stored value must never be able to point a crawler somewhere arbitrary.
    image: typeof o.image === "string" && isOwnUploadUrl(o.image) ? o.image : null,
  }
}

/**
 * The uploads this app writes, and nothing else. S3_PUBLIC_URL isn't readable
 * from a client bundle, so the shape is matched instead: our own upload route
 * is the only thing that produces this key prefix.
 */
function isOwnUploadUrl(url: string): boolean {
  return /^https:\/\/[a-z0-9.-]+\/FHI_GLOBAL\/profile-og\//i.test(url)
}

/** Read the card off a profile's metadata jsonb. */
export function readProfileOgCard(metadata: unknown): ProfileOgCard {
  const meta = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {}
  return sanitizeProfileOgCard(meta.og_card)
}

/**
 * Version stamp of a saved card, for cache-busting.
 *
 * Two places append this to a URL, and they must agree:
 *   • generateMetadata, on the fallback /og/business-card image URL;
 *   • the public page's share buttons, on the PROFILE URL itself. Facebook
 *     caches its scrape per exact URL, so a share link that changes with every
 *     save is what makes a new design show up in the composer immediately —
 *     without it, the old card sits in Facebook's cache for up to 30 days or
 *     until someone runs the Sharing Debugger by hand.
 *
 * A hash of the card (which includes the uploaded image URL) rather than a
 * timestamp: re-fetches happen when the design actually changes, and an
 * unrelated profile write doesn't churn the link.
 */
export function profileOgCardVersion(card: ProfileOgCard): string {
  const s = JSON.stringify(card)
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/**
 * The exact title and description a scraper receives for this card — THE
 * resolver, used by generateMetadata on /business-card/[id] and by the maker's
 * feed preview. One function on purpose: the preview's whole promise is
 * "identical to what a share shows", and two hand-maintained copies of this
 * logic is how previews start lying.
 */
export function resolveOgLinkText(
  card: ProfileOgCard,
  ctx: { tagline: string },
): { title: string; description: string } {
  return {
    title: card.showTitle && card.title ? card.title : DEFAULT_OG_TITLE,
    // The tagline, or nothing. An earlier fallback generated "<Name> — <Role>
    // at FHI Global…" here, which read fine for agents and absurd for members —
    // and a link with no og:description is perfectly valid: networks just draw
    // domain + title. Blank means blank.
    description: ctx.tagline.trim(),
  }
}
