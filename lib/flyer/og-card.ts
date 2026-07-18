// Share-card (OG link preview) model shared by the ShareCardModal dialog,
// the /og/listing/{id} image route, and the save path. Pure module — no
// framework imports — so it is safe in client components, API routes and
// the satori (ImageResponse) renderer alike.

// OG standard link-preview size (1.91:1) — same as the other /og routes.
export const OG_CARD_W = 1200
export const OG_CARD_H = 630

export type OgTheme = "navy" | "red" | "emerald" | "charcoal"
export type OgBadgeStyle = "color" | "clear"
export type OgPeriod = "month" | "day" | "year" | null
export type OgHideKey = "price" | "specs" | "location"

export type OgCardOptions = {
  /** Schema version so stored JSON can evolve safely. */
  v: 1
  /** Raw gallery URL to feature; null = first photo of the merged gallery. */
  photo: string | null
  theme: OgTheme
  badge: OgBadgeStyle
  /** One of OG_PRICE_COLORS. */
  priceColor: string
  /** Rent listings only; null = plain price. */
  period: OgPeriod
  hide: OgHideKey[]
  /** Show the agent name + phone strip (off by default). */
  agent: boolean
  /** Photo on the left, content panel on the right. */
  flip: boolean
}

// FHI palette — navy is the brand color; every theme is dark so the white
// FHI mark always applies. `panel` is the no-photo / secondary surface.
export const OG_THEMES: Record<OgTheme, { label: string; bg: string; panel: string }> = {
  navy: { label: "Navy", bg: "#001f3f", panel: "#0a2c52" },
  red: { label: "Red", bg: "#7f1d1d", panel: "#8f2a2a" },
  emerald: { label: "Emerald", bg: "#064e3b", panel: "#0b5c47" },
  charcoal: { label: "Charcoal", bg: "#1f2937", panel: "#2a3646" },
}

export const OG_THEME_ORDER: OgTheme[] = ["navy", "red", "emerald", "charcoal"]

// Gold (brand default), white, red, green, blue.
export const OG_PRICE_COLORS = ["#d6b357", "#ffffff", "#f87171", "#6ee7b7", "#7dd3fc"] as const

export const OG_PERIOD_LABELS: { value: OgPeriod; label: string }[] = [
  { value: null, label: "Price only" },
  { value: "month", label: "Per month" },
  { value: "day", label: "Per day" },
  { value: "year", label: "Per year" },
]

export const DEFAULT_OG_CARD_OPTIONS: OgCardOptions = {
  v: 1,
  photo: null,
  theme: "navy",
  badge: "color",
  priceColor: "#d6b357",
  period: null,
  hide: [],
  agent: false,
  flip: false,
}

/**
 * Tolerant parser for stored/unknown JSON. Guarantees a valid OgCardOptions:
 * unknown fields are dropped, a saved photo that no longer exists in the
 * gallery falls back to auto, and `period` is forced null for sale listings
 * (self-heals when a listing flips rent → sale).
 */
export function sanitizeOgCardOptions(
  raw: unknown,
  ctx: { isRent: boolean; gallery: string[] },
): OgCardOptions {
  const d = DEFAULT_OG_CARD_OPTIONS
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...d, hide: [] }
  }
  const o = raw as Record<string, unknown>
  // Object.hasOwn (not `in`): raw JSON can name prototype keys like
  // "toString", which `in` would accept and OG_THEMES[theme] would then
  // resolve to a function instead of a palette.
  const theme = (typeof o.theme === "string" && Object.hasOwn(OG_THEMES, o.theme) ? o.theme : d.theme) as OgTheme
  const photo = typeof o.photo === "string" && ctx.gallery.includes(o.photo) ? o.photo : null
  const priceColor =
    typeof o.priceColor === "string" && (OG_PRICE_COLORS as readonly string[]).includes(o.priceColor)
      ? o.priceColor
      : d.priceColor
  const period: OgPeriod =
    ctx.isRent && (o.period === "month" || o.period === "day" || o.period === "year") ? o.period : null
  const hide = Array.isArray(o.hide)
    ? (o.hide.filter((h) => h === "price" || h === "specs" || h === "location") as OgHideKey[])
    : []
  return {
    v: 1,
    photo,
    theme,
    priceColor,
    period,
    hide,
    badge: o.badge === "clear" ? "clear" : "color",
    agent: o.agent === true,
    flip: o.flip === true,
  }
}
