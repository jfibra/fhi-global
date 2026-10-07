/**
 * The campaign a visitor arrived from, kept for the length of their visit so a
 * lead form submitted several pages later can say which ad or campaign brought
 * them (GA4 knows, but it can't be joined to a lead record).
 *
 * Client-only: a landing page URL carries ?utm_source=…&utm_medium=…, UtmCapture
 * (mounted once in the root layout) remembers them in sessionStorage, and the
 * inquiry form sends them with the lead. Only the five standard utm_* fields,
 * trimmed to 100 characters, are ever kept — nothing about the visitor. Storage
 * can be unavailable (private windows, blocked cookies): every call then does
 * nothing and the form simply sends no campaign.
 */

const KEY = "fhi:utm"
const FIELDS = ["source", "medium", "campaign", "term", "content"] as const

export type Utm = Partial<Record<(typeof FIELDS)[number], string>>

/** Remember the utm_* parameters of the current URL, if it has any (the latest campaign touch wins). */
export function captureUtm(): void {
  try {
    const params = new URLSearchParams(window.location.search)
    const found: Utm = {}
    for (const field of FIELDS) {
      const value = params.get(`utm_${field}`)?.trim()
      if (value) found[field] = value.slice(0, 100)
    }
    if (Object.keys(found).length > 0) window.sessionStorage.setItem(KEY, JSON.stringify(found))
  } catch {
    // storage unavailable — no campaign is recorded
  }
}

/** The remembered campaign, or undefined when the visitor came without one. */
export function readUtm(): Utm | undefined {
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: Utm = {}
    for (const field of FIELDS) {
      const value = parsed[field]
      if (typeof value === "string" && value) out[field] = value.slice(0, 100)
    }
    return Object.keys(out).length > 0 ? out : undefined
  } catch {
    return undefined
  }
}
