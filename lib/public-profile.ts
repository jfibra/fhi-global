/**
 * The editable fields of a person's public profile page (app/business-card/[id]):
 * their tagline and their social links.
 *
 * Both live in `profiles.metadata` — the same jsonb column that already holds the
 * phone number and card design, so this needs no schema change.
 *
 * Everything here is shared by the API route that writes the values and the two
 * places that read them (the Digital Business Card and the page itself), so a
 * value can only ever be normalised and validated one way.
 */

// ─── Free text ────────────────────────────────────────────────────────────────

/**
 * Squeeze typed text into one clean line. Newlines and runs of whitespace
 * collapse to single spaces (the page centres text and wraps it itself) and
 * control characters are dropped. React escapes the result on render, so there
 * is nothing further to sanitise here.
 */
function oneLine(raw: unknown, max: number): string {
  if (typeof raw !== "string") return ""
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
}

// ─── Display name ─────────────────────────────────────────────────────────────

/**
 * Title-case a name for display: first letter of each word up, the rest down.
 *
 * Profiles are entered by hand and plenty arrive shouting — "LEONEL AIRWIND
 * BUSANO SABUGAA" — which looks wrong at 26px on a public page. This is a
 * DISPLAY transform only; the stored value is left exactly as typed, so nothing
 * is lost and an admin still sees what was entered.
 *
 * Word boundaries include hyphens and apostrophes, so "MARY-JANE" and "O'BRIEN"
 * come out as "Mary-Jane" and "O'Brien" rather than "Mary-jane" and "O'brien".
 */
export function titleCaseName(raw: string): string {
  return raw
    // Runs of whitespace collapse first. Stored names carry stray double spaces
    // from registration ("Mark Lawrince  SARGADO"), which show up in the page
    // heading, the og:title and the rendered link-preview card alike.
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase()
    .replace(/(^|[\s\-'\u2019])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase())
}

// ─── Tagline ──────────────────────────────────────────────────────────────────

/** Two comfortable lines on a phone. Longer and it crowds out the buttons. */
export const TAGLINE_MAX = 160

export function normalizeTagline(raw: unknown): string {
  return oneLine(raw, TAGLINE_MAX)
}

/** Read a stored tagline back out of `profiles.metadata`. */
export function readTagline(metadata: unknown): string {
  const meta = (metadata as Record<string, unknown> | null) ?? {}
  return normalizeTagline(meta.tagline)
}

// ─── Social links ─────────────────────────────────────────────────────────────

/**
 * Capped at four on purpose: the public profile shows these as one icon row, and
 * a fifth breaks the line on a narrow phone. Adding one back is a spec entry
 * here plus a glyph in features/business-card/social-icons.tsx.
 */
export type SocialPlatform =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "tiktok"

type PlatformSpec = {
  id: SocialPlatform
  label: string
  /** Shown in the input so it is obvious a bare handle is fine. */
  placeholder: string
  /** Prefix a bare handle gets turned into. */
  handleBase: string
  /** Hosts a full URL is allowed to point at — these links are rendered publicly. */
  hosts: string[]
}

export const SOCIAL_PLATFORMS: PlatformSpec[] = [
  {
    id: "facebook",
    label: "Facebook",
    placeholder: "your.name",
    handleBase: "https://www.facebook.com/",
    hosts: ["facebook.com", "www.facebook.com", "m.facebook.com", "fb.com", "www.fb.com", "fb.me"],
  },
  {
    id: "instagram",
    label: "Instagram",
    placeholder: "your.handle",
    handleBase: "https://www.instagram.com/",
    hosts: ["instagram.com", "www.instagram.com"],
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    placeholder: "your-name",
    handleBase: "https://www.linkedin.com/in/",
    hosts: ["linkedin.com", "www.linkedin.com", "ae.linkedin.com", "ph.linkedin.com"],
  },
  {
    id: "tiktok",
    label: "TikTok",
    placeholder: "@yourhandle",
    handleBase: "https://www.tiktok.com/@",
    hosts: ["tiktok.com", "www.tiktok.com", "vm.tiktok.com"],
  },
]

export const SOCIAL_PLATFORM_IDS: SocialPlatform[] = SOCIAL_PLATFORMS.map((p) => p.id)

export type SocialLinks = Partial<Record<SocialPlatform, string>>

export function isSocialPlatform(v: unknown): v is SocialPlatform {
  return typeof v === "string" && SOCIAL_PLATFORM_IDS.includes(v as SocialPlatform)
}

/**
 * Turn whatever the agent typed into a canonical https URL, or null if it can't
 * be trusted. Accepts a bare handle ("juan.delacruz"), a scheme-less URL
 * ("instagram.com/juan"), or a full URL — but the host must belong to the
 * platform, so a Facebook field can never end up pointing somewhere else.
 */
export function normalizeSocialUrl(platform: SocialPlatform, raw: string): string | null {
  const spec = SOCIAL_PLATFORMS.find((p) => p.id === platform)
  if (!spec) return null

  const value = raw.trim()
  if (!value) return null

  const looksLikeUrl = /^https?:\/\//i.test(value) || /^[\w-]+(\.[\w-]+)+\//.test(value)
  if (!looksLikeUrl) {
    // A bare handle. Strip a leading @ (the base already supplies one where the
    // platform needs it) and reject anything that isn't handle-shaped.
    const handle = value.replace(/^@+/, "")
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(handle)) return null
    return `${spec.handleBase}${handle}`
  }

  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  if (!spec.hosts.includes(url.host.toLowerCase())) return null

  url.protocol = "https:"
  return url.toString()
}

/**
 * Validate a whole `socials` payload. Unknown keys are dropped; a value that
 * fails normalisation is reported so the agent gets told which field is wrong
 * rather than silently losing it. An empty string means "remove this link".
 */
export function parseSocialLinks(
  input: unknown,
): { ok: true; value: SocialLinks } | { ok: false; invalid: SocialPlatform } {
  const out: SocialLinks = {}
  if (!input || typeof input !== "object") return { ok: true, value: out }

  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!isSocialPlatform(key)) continue
    if (typeof raw !== "string" || !raw.trim()) continue
    const url = normalizeSocialUrl(key, raw)
    if (!url) return { ok: false, invalid: key }
    out[key] = url
  }
  return { ok: true, value: out }
}

/** Read stored links back out of `profiles.metadata`, discarding anything odd. */
export function readSocialLinks(metadata: unknown): SocialLinks {
  const meta = (metadata as Record<string, unknown> | null) ?? {}
  const raw = meta.socials
  if (!raw || typeof raw !== "object") return {}
  const out: SocialLinks = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isSocialPlatform(key)) continue
    if (typeof value !== "string") continue
    // Re-validate on read: stored data can predate a tightened rule.
    const url = normalizeSocialUrl(key, value)
    if (url) out[key] = url
  }
  return out
}

// ─── Custom buttons ───────────────────────────────────────────────────────────

/** Enough for a link page without turning it into a menu. */
export const CUSTOM_LINKS_MAX = 8
/** Fits one line on a pill at the page's type size. */
export const LINK_LABEL_MAX = 40

export type CustomLink = { label: string; url: string }

/**
 * Normalise a button's destination, or null if it can't be trusted.
 *
 * Unlike the social fields, the host is the agent's own choice — these point at
 * their listings, brochures and booking forms. What is NOT their choice is the
 * scheme: anything but http/https is refused rather than coerced, so
 * `javascript:` and `data:` can never reach an href. A bare domain gets https.
 */
export function normalizeLinkUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const value = raw.trim()
  if (!value) return null

  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value)
  if (scheme && !/^https?$/i.test(scheme[1])) return null

  let url: URL
  try {
    url = new URL(scheme ? value : `https://${value}`)
  } catch {
    return null
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null
  // A hostname with no dot is a typo rather than a site — "localhost" included,
  // since this renders on a public page.
  if (!url.hostname.includes(".")) return null
  return url.toString()
}

export function normalizeLinkLabel(raw: unknown): string {
  return oneLine(raw, LINK_LABEL_MAX)
}

/**
 * Validate a whole `links` payload. Rows that fail are DROPPED rather than
 * failing the request: the maker flags them inline before sending, and one bad
 * row must never cost the agent the rest of their page.
 */
export function parseCustomLinks(input: unknown): CustomLink[] {
  if (!Array.isArray(input)) return []
  const out: CustomLink[] = []
  for (const row of input) {
    if (!row || typeof row !== "object") continue
    const { label, url } = row as Record<string, unknown>
    const cleanLabel = normalizeLinkLabel(label)
    const cleanUrl = normalizeLinkUrl(url)
    if (!cleanLabel || !cleanUrl) continue
    out.push({ label: cleanLabel, url: cleanUrl })
    if (out.length === CUSTOM_LINKS_MAX) break
  }
  return out
}

/**
 * The buttons whose destination the profile owns rather than the agent: the two
 * featured collections, and the company site at the foot of the stack.
 *
 * Only the LABEL of each is stored, and only the label can be edited. Keeping
 * the destinations out of `links` is what makes that guarantee structural —
 * there is no field to change them with.
 */
export const DEFAULT_BUTTON_URL = "https://fhiglobal.ae"

export const FIXED_BUTTONS = [
  {
    key: "featuredListings",
    metaKey: "featured_listings_label",
    fallback: "Check out my listings",
    /** Shown in the editor in place of a url. */
    destination: "Opens your featured listings",
    /** Why it might not appear yet. */
    requires: "Appears once you feature a listing below",
  },
  {
    key: "featuredProjects",
    metaKey: "featured_projects_label",
    fallback: "Featured projects",
    destination: "Opens your featured projects",
    requires: "Appears once you feature a project below",
  },
  {
    key: "default",
    metaKey: "default_button_label",
    fallback: "Visit our website",
    destination: DEFAULT_BUTTON_URL,
  },
] as const

export type FixedButtonKey = (typeof FIXED_BUTTONS)[number]["key"]

/** Every fixed button's current wording, falling back to the stock one. */
export function readFixedButtonLabels(metadata: unknown): Record<FixedButtonKey, string> {
  const meta = (metadata as Record<string, unknown> | null) ?? {}
  const out = {} as Record<FixedButtonKey, string>
  for (const b of FIXED_BUTTONS) {
    out[b.key] = normalizeLinkLabel(meta[b.metaKey]) || b.fallback
  }
  return out
}

/** Validate a submitted set. Unknown keys are dropped; a blank clears to stock. */
export function parseFixedButtonLabels(input: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!input || typeof input !== "object") return out
  const src = input as Record<string, unknown>
  for (const b of FIXED_BUTTONS) {
    if (!(b.key in src)) continue
    out[b.metaKey] = normalizeLinkLabel(src[b.key])
  }
  return out
}

export const DEFAULT_BUTTON_LABEL = FIXED_BUTTONS[2].fallback

/** Read stored buttons back out of `profiles.metadata`. */
export function readCustomLinks(metadata: unknown): CustomLink[] {
  const meta = (metadata as Record<string, unknown> | null) ?? {}
  // Re-validated on read: stored rows can predate a tightened rule.
  return parseCustomLinks(meta.links)
}

// ─── Featured projects ────────────────────────────────────────────────────────

/**
 * Projects an agent has pinned to their own profile.
 *
 * Kept in `profiles.metadata.featured_projects` as an ordered list of project
 * ids, NOT in `projects.is_featured`: that column is a single site-wide flag an
 * admin sets, so writing to it from a profile would change what every visitor
 * sees. This is one person's selection, so it belongs to that person's row.
 *
 * Featured LISTINGS need no equivalent — a listing has exactly one owner, so
 * `agent_listings.is_featured` is already per-profile.
 */
export const FEATURED_PROJECTS_MAX = 6

/** Ordered, de-duplicated, capped. Anything that isn't a positive integer id goes. */
export function parseFeaturedProjects(input: unknown): number[] {
  if (!Array.isArray(input)) return []
  const out: number[] = []
  for (const raw of input) {
    const n = typeof raw === "number" ? raw : Number(raw)
    if (!Number.isInteger(n) || n <= 0) continue
    if (out.includes(n)) continue
    out.push(n)
    if (out.length === FEATURED_PROJECTS_MAX) break
  }
  return out
}

/** Read the stored picks back out of `profiles.metadata`. */
export function readFeaturedProjects(metadata: unknown): number[] {
  const meta = (metadata as Record<string, unknown> | null) ?? {}
  return parseFeaturedProjects(meta.featured_projects)
}

// ─── Featured items, as the public profile shows them ─────────────────────────

/**
 * One pinned listing or project, flattened to just what a card needs. Both kinds
 * share a shape so the profile can render one grid instead of two.
 */
export type FeaturedItem = {
  kind: "listing" | "project"
  /** Public path — /listings/<slug> or /projects/<slug>. */
  href: string
  title: string
  /** Location for a project, unit/kind for a listing. Blank hides the line. */
  subtitle: string
  /** Already-formatted, because the currency differs per row. */
  price: string
  image: string | null
}
