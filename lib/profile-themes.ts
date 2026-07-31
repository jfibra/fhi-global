/**
 * Looks for the public profile page (app/business-card/[id]).
 *
 * A theme is a small set of tokens, not a stylesheet: the page reads them as
 * inline values so a template can be added here without touching the markup, and
 * so "Custom" can hand over tokens that were never written down at build time.
 *
 * Stored in `profiles.metadata.theme` alongside the rest of the profile content.
 */

/** Dubai skyline images already served for the public site's hero/about pages. */
const SKYLINE =
  "https://hefwmaoborpfuyhbguzv.supabase.co/storage/v1/object/public/Dubai%20Image%20Ratio%201920x1080/2.png"
const SKYLINE_DUSK =
  "https://hefwmaoborpfuyhbguzv.supabase.co/storage/v1/object/public/Dubai%20Image%20Ratio%201920x1080/8.png"

export type ProfileTheme = {
  id: string
  name: string
  blurb: string
  /** Full-bleed photo behind the scrim, or null for a painted background. */
  image: string | null
  /** Painted layer, over the photo when there is one. */
  scrim: string
  /** Primary text. */
  ink: string
  /** Secondary text — captions, hints, the QR line. */
  inkMuted: string
  /** Icons, hairlines, focus rings. */
  accent: string
  /** Action pills. */
  pillBg: string
  pillInk: string
  pillSubInk: string
  /** The square icon tile inside a pill. */
  tile: string
  tileInk: string
  tileBorder: string
  /** Glass panels — the contact card, social buttons. */
  panel: string
  panelBorder: string
  /** Button shape, from the Buttons style picker. */
  pillRadius: string
  pillBorder: string
  /** Sizing, from the sliders. All px. */
  pillPadY: number
  pillFont: number
  tileSize: number
  tileRadius: number
}

/** Slider defaults and bounds — one place, so the UI and the page agree. */
export const SIZE_LIMITS = {
  buttonSize: { min: 80, max: 130, step: 5, def: 100 },
  buttonRadius: { min: 0, max: 32, step: 2, def: 32 },
  iconSize: { min: 0, max: 48, step: 2, def: 36 },
  iconRadius: { min: 0, max: 24, step: 2, def: 12 },
  /** Scrim strength over a photo background, as a percentage. */
  overlay: { min: 0, max: 95, step: 5, def: 80 },
} as const

export type SizeKey = keyof typeof SIZE_LIMITS

function clampSize(key: SizeKey, raw: unknown): number | undefined {
  const { min, max } = SIZE_LIMITS[key]
  const n = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isFinite(n)) return undefined
  return Math.min(max, Math.max(min, Math.round(n)))
}

/**
 * A template supplies the palette only. Shape and sizing come from the Buttons
 * picker and the sliders, so a template never has an opinion about them.
 */
type ThemeBase = Omit<
  ProfileTheme,
  | "pillRadius" | "pillBorder" | "pillPadY" | "pillFont"
  | "tileSize" | "tileRadius" | "tileBorder"
>

export const PROFILE_THEMES: ThemeBase[] = [
  {
    id: "skyline",
    name: "Skyline",
    blurb: "Dubai at golden hour, navy scrim, gold accents",
    image: SKYLINE,
    scrim: "linear-gradient(180deg, rgba(0,31,63,0.85) 0%, rgba(0,31,63,0.72) 45%, rgba(0,21,43,0.97) 100%)",
    ink: "#ffffff",
    inkMuted: "rgba(255,255,255,0.62)",
    accent: "#d6b357",
    pillBg: "#ffffff",
    pillInk: "#0d1117",
    pillSubInk: "#6b7280",
    tile: "linear-gradient(180deg, #0a3d6b 0%, #001f3f 100%)",
    tileInk: "#ffffff",
    panel: "rgba(255,255,255,0.10)",
    panelBorder: "rgba(255,255,255,0.20)",
  },
  {
    id: "midnight",
    name: "Midnight",
    blurb: "No photo — deep navy, quiet and corporate",
    image: null,
    scrim: "linear-gradient(160deg, #0a1730 0%, #001f3f 55%, #00101f 100%)",
    ink: "#ffffff",
    inkMuted: "rgba(255,255,255,0.60)",
    accent: "#7fb2e5",
    pillBg: "#ffffff",
    pillInk: "#0d1117",
    pillSubInk: "#6b7280",
    tile: "linear-gradient(180deg, #14568f 0%, #0a3d6b 100%)",
    tileInk: "#ffffff",
    panel: "rgba(255,255,255,0.08)",
    panelBorder: "rgba(255,255,255,0.16)",
  },
  {
    id: "pearl",
    name: "Pearl",
    blurb: "Ivory and navy — the light one",
    image: null,
    scrim: "linear-gradient(180deg, #faf8f3 0%, #efe9dc 60%, #e4dccb 100%)",
    ink: "#16202e",
    inkMuted: "rgba(22,32,46,0.60)",
    accent: "#a8801a",
    pillBg: "#001f3f",
    pillInk: "#ffffff",
    pillSubInk: "rgba(255,255,255,0.65)",
    tile: "linear-gradient(180deg, #d6b357 0%, #a8801a 100%)",
    tileInk: "#ffffff",
    panel: "rgba(0,31,63,0.06)",
    panelBorder: "rgba(0,31,63,0.14)",
  },
  {
    id: "noir",
    name: "Noir",
    blurb: "Black-tie: near-black with a gold hairline",
    image: null,
    scrim: "linear-gradient(150deg, #08080d 0%, #14141c 55%, #1c1c26 100%)",
    ink: "#f5f2ea",
    inkMuted: "rgba(245,242,234,0.55)",
    accent: "#d6b357",
    pillBg: "#1c1c26",
    pillInk: "#f5f2ea",
    pillSubInk: "rgba(245,242,234,0.55)",
    tile: "linear-gradient(180deg, #d6b357 0%, #a8801a 100%)",
    tileInk: "#14141c",
    panel: "rgba(245,242,234,0.06)",
    panelBorder: "rgba(214,179,87,0.28)",
  },
  {
    id: "dusk",
    name: "Dusk",
    blurb: "Skyline at night, warmed by amber",
    image: SKYLINE_DUSK,
    scrim: "linear-gradient(180deg, rgba(28,16,8,0.78) 0%, rgba(48,26,10,0.66) 45%, rgba(16,9,4,0.96) 100%)",
    ink: "#fdf6ec",
    inkMuted: "rgba(253,246,236,0.60)",
    accent: "#e8a33d",
    pillBg: "#fdf6ec",
    pillInk: "#2a1a0a",
    pillSubInk: "#7a6a58",
    tile: "linear-gradient(180deg, #b9702a 0%, #7a3f12 100%)",
    tileInk: "#ffffff",
    panel: "rgba(253,246,236,0.10)",
    panelBorder: "rgba(253,246,236,0.20)",
  },
]

export const DEFAULT_THEME_ID = PROFILE_THEMES[0].id

/**
 * Button shapes. Kept separate from the template so any look can wear any
 * shape — picking Noir shouldn't force you into pills.
 */
export const BUTTON_STYLES = [
  { id: "pill", name: "Pill" },
  { id: "rounded", name: "Rounded" },
  { id: "square", name: "Square" },
  { id: "outline", name: "Outline" },
  { id: "glass", name: "Glass" },
] as const

export type ButtonStyleId = (typeof BUTTON_STYLES)[number]["id"]

export const DEFAULT_BUTTON_STYLE: ButtonStyleId = "pill"

/**
 * Icon tile treatments. Separate from the accent colour: the same gold can be a
 * solid chip, a soft wash, a hairline ring or nothing at all.
 */
export const ICON_STYLES = [
  { id: "solid", name: "Solid" },
  { id: "soft", name: "Soft" },
  { id: "outline", name: "Outline" },
  { id: "invert", name: "Invert" },
  { id: "plain", name: "Plain" },
] as const

export type IconStyleId = (typeof ICON_STYLES)[number]["id"]

export const DEFAULT_ICON_STYLE: IconStyleId = "solid"

/** Black or white, whichever stays legible on `hex`. Non-hex falls back to white. */
function readableOn(hex: string): string {
  if (!HEX.test(hex)) return "#ffffff"
  return luminance(hex) > 0.55 ? "#16202e" : "#ffffff"
}

/** hex → rgba, for the washes the Soft treatment needs. */
function alpha(hex: string, a: number): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

/** Tile fill, border and glyph colour for one treatment. */
function iconTokens(
  base: Pick<ThemeBase, "accent" | "pillBg" | "pillInk">,
  style: IconStyleId,
): Pick<ProfileTheme, "tile" | "tileInk" | "tileBorder"> {
  const { accent } = base
  switch (style) {
    case "soft":
      return { tile: alpha(accent, 0.18), tileInk: accent, tileBorder: "none" }
    case "outline":
      return { tile: "transparent", tileInk: accent, tileBorder: `1.5px solid ${alpha(accent, 0.55)}` }
    case "invert":
      // The pill's own ink becomes the chip. The glyph is then chosen AGAINST
      // that chip by luminance rather than being set to the pill's background —
      // an outline or glass button makes that background transparent, which
      // would render the glyph invisible.
      return {
        tile: base.pillInk,
        tileInk: readableOn(base.pillInk),
        tileBorder: "none",
      }
    case "plain":
      return { tile: "transparent", tileInk: accent, tileBorder: "none" }
    default:
      return {
        tile: `linear-gradient(180deg, ${accent} 0%, ${shade(accent, 0.25)} 100%)`,
        tileInk: luminance(accent) > 0.55 ? "#16202e" : "#ffffff",
        tileBorder: "none",
      }
  }
}

/** Apply the button shape, the icon treatment and the sizing to a look. */
function withControls(base: ThemeBase, choice: ThemeChoice): ProfileTheme {
  const style = choice.buttons ?? DEFAULT_BUTTON_STYLE

  // The slider wins when it has been touched; otherwise the preset decides.
  const radiusPx =
    choice.buttonRadius ??
    (style === "square" ? 10 : style === "rounded" ? 18 : SIZE_LIMITS.buttonRadius.max)
  const radius = radiusPx >= SIZE_LIMITS.buttonRadius.max ? "9999px" : `${radiusPx}px`

  const scale = (choice.buttonSize ?? SIZE_LIMITS.buttonSize.def) / 100
  const sizing = {
    pillPadY: Math.round(12 * scale),
    pillFont: Math.round(15 * scale),
    tileSize: choice.iconSize ?? SIZE_LIMITS.iconSize.def,
    tileRadius: choice.iconRadius ?? SIZE_LIMITS.iconRadius.def,
  }
  const iconStyle = choice.icons ?? DEFAULT_ICON_STYLE

  if (style === "outline" || style === "glass") {
    const pill = {
      pillBg: style === "outline" ? "transparent" : base.panel,
      pillInk: base.ink,
      pillSubInk: base.inkMuted,
    }
    return {
      ...base,
      ...sizing,
      ...pill,
      pillRadius: radius,
      pillBorder:
        style === "outline" ? `1.5px solid ${base.panelBorder}` : `1px solid ${base.panelBorder}`,
      // Computed from the pill AFTER its fill changed, so Invert stays legible.
      ...iconTokens({ accent: base.accent, ...pill }, iconStyle),
    }
  }
  return {
    ...base,
    ...sizing,
    pillRadius: radius,
    pillBorder: "none",
    ...iconTokens(base, iconStyle),
  }
}

/** Stock backdrops, for the background picker. */
export const STOCK_BACKDROPS = [
  { url: SKYLINE, name: "Skyline" },
  { url: SKYLINE_DUSK, name: "Dusk" },
  {
    url: "https://hefwmaoborpfuyhbguzv.supabase.co/storage/v1/object/public/Dubai%20Image%20Ratio%201920x1080/5.png",
    name: "Marina",
  },
  {
    url: "https://hefwmaoborpfuyhbguzv.supabase.co/storage/v1/object/public/Dubai%20Image%20Ratio%201920x800/7.png",
    name: "Coast",
  },
]

/** Custom background: a flat colour, or a photo behind a readability scrim. */
export type CustomBackground =
  | { type: "color"; color: string }
  | { type: "image"; url: string }

/**
 * A template id plus whatever the agent overrode on top of it. Every override
 * is optional and applies to ANY template, so "Noir but with my own photo and a
 * green accent" is expressible without a separate Custom mode.
 */
export type ThemeChoice = {
  id: string
  background?: CustomBackground
  accent?: string
  buttons?: ButtonStyleId
  icons?: IconStyleId
  /** Percentage of the default button height/type size. */
  buttonSize?: number
  /** Corner radius in px; the max reads as fully round. */
  buttonRadius?: number
  /** Icon tile edge in px; 0 hides the tile entirely. */
  iconSize?: number
  iconRadius?: number
  /** Only meaningful with an image background. */
  overlay?: number
}

const HEX = /^#[0-9a-f]{6}$/i

/** Hosts a custom backdrop may come from — our own S3 and the media project. */
export function isAllowedBackdrop(url: string): boolean {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return false
  }
  if (u.protocol !== "https:") return false
  const h = u.host.toLowerCase()
  return (
    h.endsWith(".supabase.co") ||
    h.endsWith(".amazonaws.com") ||
    h.endsWith(".cloudfront.net")
  )
}

/**
 * Relative luminance (WCAG). Used to pick ink for an arbitrary background
 * colour, so a light pick doesn't end up with white text on it.
 */
function luminance(hex: string): number {
  const v = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
}

/** Darken a hex by a fraction, for the two-stop background gradient. */
function shade(hex: string, amount: number): string {
  const to = (i: number) => {
    const c = Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - amount))
    return Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")
  }
  return `#${to(1)}${to(3)}${to(5)}`
}

/** The neutral base the Custom template starts from, before overrides. */
function paintBackground(
  background: CustomBackground,
  accent: string,
  overlay: number = SIZE_LIMITS.overlay.def,
): ThemeBase {
  const isImage = background.type === "image"
  // An image always gets a dark scrim, so ink is light regardless of the photo.
  const light = !isImage && luminance(background.color) > 0.45

  // Three stops derived from one number, keeping the shape of the original
  // scrim: a little lighter through the middle, near-opaque at the foot where
  // the contact card sits.
  const o = Math.min(95, Math.max(0, overlay)) / 100
  const r = (a: number) => Math.round(Math.min(1, a) * 100) / 100

  return {
    id: "custom",
    name: "Custom",
    blurb: "Your own background and accent",
    image: isImage ? background.url : null,
    scrim: isImage
      ? `linear-gradient(180deg, rgba(10,14,22,${r(o)}) 0%, rgba(10,14,22,${r(o * 0.85)}) 45%, rgba(6,9,14,${r(o * 1.2)}) 100%)`
      : `linear-gradient(170deg, ${background.color} 0%, ${shade(background.color, 0.28)} 100%)`,
    ink: light ? "#16202e" : "#ffffff",
    inkMuted: light ? "rgba(22,32,46,0.60)" : "rgba(255,255,255,0.62)",
    accent,
    pillBg: light ? "#ffffff" : "#ffffff",
    pillInk: "#0d1117",
    pillSubInk: "#6b7280",
    tile: `linear-gradient(180deg, ${accent} 0%, ${shade(accent, 0.25)} 100%)`,
    // The tile carries the accent, so its icon needs ink chosen against IT.
    tileInk: luminance(accent) > 0.55 ? "#16202e" : "#ffffff",
    panel: light ? "rgba(22,32,46,0.06)" : "rgba(255,255,255,0.10)",
    panelBorder: light ? "rgba(22,32,46,0.14)" : "rgba(255,255,255,0.20)",
  }
}

/**
 * Backdrops the agent has uploaded, kept so a second upload doesn't replace the
 * first — they build a small library and pick from it.
 *
 * Stored in `profiles.metadata.backdrops`.
 */
export const BACKDROP_LIBRARY_MAX = 12

export function parseBackdropLibrary(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const out: string[] = []
  for (const raw of input) {
    if (typeof raw !== "string") continue
    // Host-checked on the way in AND on the way out: these become css
    // backgrounds on a public page.
    if (!isAllowedBackdrop(raw)) continue
    if (out.includes(raw)) continue
    out.push(raw)
    if (out.length === BACKDROP_LIBRARY_MAX) break
  }
  return out
}

export function readBackdropLibrary(metadata: unknown): string[] {
  const meta = (metadata as Record<string, unknown> | null) ?? {}
  return parseBackdropLibrary(meta.backdrops)
}

/**
 * Validate a stored or submitted choice.
 *
 * Every field is checked independently: an unknown template falls back to the
 * default without discarding a valid background, and a rejected background
 * doesn't cost you your accent.
 */
export function parseThemeChoice(input: unknown): ThemeChoice {
  if (!input || typeof input !== "object") return { id: DEFAULT_THEME_ID }
  const raw = input as Record<string, unknown>

  const rawId = typeof raw.id === "string" ? raw.id : ""
  const id =
    rawId === "custom" || PROFILE_THEMES.some((t) => t.id === rawId) ? rawId : DEFAULT_THEME_ID

  const out: ThemeChoice = { id }

  const bg = raw.background
  if (bg && typeof bg === "object") {
    const b = bg as Record<string, unknown>
    // A url is host-checked here rather than at render: it ends up in a css
    // background on a public page.
    if (b.type === "image" && typeof b.url === "string" && isAllowedBackdrop(b.url)) {
      out.background = { type: "image", url: b.url }
    } else if (b.type === "color" && typeof b.color === "string" && HEX.test(b.color)) {
      out.background = { type: "color", color: b.color }
    }
  }

  if (typeof raw.accent === "string" && HEX.test(raw.accent)) out.accent = raw.accent
  if (BUTTON_STYLES.some((s2) => s2.id === raw.buttons)) out.buttons = raw.buttons as ButtonStyleId
  if (ICON_STYLES.some((s2) => s2.id === raw.icons)) out.icons = raw.icons as IconStyleId

  for (const key of Object.keys(SIZE_LIMITS) as SizeKey[]) {
    if (raw[key] === undefined) continue
    const v = clampSize(key, raw[key])
    if (v !== undefined) out[key] = v
  }

  return out
}

/** The choice stored on a profile. */
export function readThemeChoice(metadata: unknown): ThemeChoice {
  const meta = (metadata as Record<string, unknown> | null) ?? {}
  return parseThemeChoice(meta.theme)
}

/**
 * A choice resolved to the tokens the page renders with: the template first,
 * then any override on top, then the button shape.
 */
export function resolveTheme(choice: ThemeChoice): ProfileTheme {
  const accent =
    choice.accent ??
    PROFILE_THEMES.find((t) => t.id === choice.id)?.accent ??
    PROFILE_THEMES[0].accent

  let base: ThemeBase =
    choice.id === "custom"
      ? paintBackground(choice.background ?? { type: "color", color: "#0b1220" }, accent, choice.overlay)
      : (PROFILE_THEMES.find((t) => t.id === choice.id) ?? PROFILE_THEMES[0])

  // A background override repaints ANY template, so a stock look can carry the
  // agent's own photo.
  if (choice.id !== "custom" && choice.background) {
    base = paintBackground(choice.background, accent, choice.overlay)
  }
  if (choice.accent) base = { ...base, accent, tile: `linear-gradient(180deg, ${accent} 0%, ${shade(accent, 0.25)} 100%)`, tileInk: luminance(accent) > 0.55 ? "#16202e" : "#ffffff" }

  return withControls(base, choice)
}
