/**
 * The editable fields of a person's public profile page (app/business-card/[id]):
 * their tagline and their social links.
 *
 * Both live in `profiles.metadata` — the same jsonb column that already holds the
 * phone number and card design, so this needs no schema change.
 *
 * Everything here is shared by the API route that writes the values and the two
 * places that read them (the Public Profile Maker and the page itself), so a
 * value can only ever be normalised and validated one way.
 */

// ─── Tagline ──────────────────────────────────────────────────────────────────

/** Two comfortable lines on a phone. Longer and it crowds out the buttons. */
export const TAGLINE_MAX = 160

/**
 * Squeeze a typed tagline into one clean line. Newlines and runs of whitespace
 * collapse to single spaces (the page centres it and wraps on its own) and
 * control characters are dropped. React escapes the result on render, so there
 * is nothing further to sanitise.
 */
export function normalizeTagline(raw: unknown): string {
  if (typeof raw !== "string") return ""
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TAGLINE_MAX)
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
