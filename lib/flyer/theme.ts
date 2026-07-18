// Pure, framework-agnostic helpers shared by the Flyer + Announcement
// marketing generators. Ported verbatim from the filipinohomes-final flyer
// templates so the exported artwork renders identically here.

export type FlyerMode = "light" | "dark"

export type FlyerTheme = {
  /** Highlight / "pop" color: price tag, category pills, icons, QR frame. */
  accent: string
  /** Dominant brand surface: dark panel, header bar, or base background. */
  bg: string
  /** Primary headline text color (used on light/solid areas). */
  text: string
  /** light|dark hint so templates pick correct scrims/shadows. */
  mode: FlyerMode
}

export type FlyerData = {
  id: string
  title: string
  price: number
  subtype: string
  category: string
  address: string
  image: string | null
  gallery: string[]
  specs: {
    bedrooms?: number | string | null
    bathrooms?: number | string | null
    lotArea?: number | string | null
    floorArea?: number | string | null
    garage?: number | string | null
  }
  agent: {
    name: string
    phone: string
    email: string
    imageUrl: string
  }
}

// Facebook feed post size for the flyer.
export const FLYER_W = 940
export const FLYER_H = 788

// Peso/Dirham-agnostic price formatting. The linked project's currency is
// baked into the value on the server; here we just group digits.
export const formatPrice = (p: number, currency = "AED") => {
  if (!p || isNaN(p)) return "Price on request"
  const sym = currency === "PHP" ? "₱" : `${currency} `
  return `${sym}${Number(p).toLocaleString("en-US")}`
}

export const getAgentInitials = (name: string) =>
  (name || "A")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

// Return black or white — whichever stays readable ON the given hex color.
export const readableOn = (hex: string): string => {
  const c = (hex || "").replace("#", "")
  const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c
  const r = parseInt(full.slice(0, 2), 16) || 0
  const g = parseInt(full.slice(2, 4), 16) || 0
  const b = parseInt(full.slice(4, 6), 16) || 0
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return L > 0.6 ? "#141821" : "#ffffff"
}

// Mix a hex toward white (pct>0) or black (pct<0), pct in -1..1.
export const shade = (hex: string, pct: number): string => {
  const c = (hex || "").replace("#", "")
  const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c
  let r = parseInt(full.slice(0, 2), 16) || 0
  let g = parseInt(full.slice(2, 4), 16) || 0
  let b = parseInt(full.slice(4, 6), 16) || 0
  const t = pct < 0 ? 0 : 255
  const p = Math.min(Math.abs(pct), 1)
  r = Math.round((t - r) * p) + r
  g = Math.round((t - g) * p) + g
  b = Math.round((t - b) * p) + b
  const h = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0")
  return `#${h(r)}${h(g)}${h(b)}`
}

// rgba() from a hex + alpha — for scrims/overlays derived from theme colors.
export const withAlpha = (hex: string, a: number): string => {
  const c = (hex || "").replace("#", "")
  const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c
  const r = parseInt(full.slice(0, 2), 16) || 0
  const g = parseInt(full.slice(2, 4), 16) || 0
  const b = parseInt(full.slice(4, 6), 16) || 0
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

// Fit the centre logo inside a QR code (error-correction level H) without
// covering so many modules that it stops scanning. Preserves aspect ratio.
export const fitQrLogo = (qrSize: number, aspect: number) => {
  const maxH = qrSize * 0.2
  const maxW = qrSize * 0.26
  let height = maxH
  let width = height * (aspect || 1)
  if (width > maxW) {
    width = maxW
    height = width / (aspect || 1)
  }
  return { width: Math.round(width), height: Math.round(height) }
}

// Route remote images through our own same-origin proxy so html2canvas can
// draw them onto the canvas without tainting it (the export would otherwise
// throw a SecurityError). data/blob/relative URLs pass through untouched.
export const proxied = (url: string | null | undefined): string => {
  if (!url) return ""
  if (url.startsWith("data:") || url.startsWith("blob:")) return url
  if (url.startsWith("/")) return url
  return `/api/image-proxy?url=${encodeURIComponent(url)}`
}

// Curated one-click palettes for the flyer color customizer.
export type FlyerPreset = { id: string; name: string; swatch: string; theme: FlyerTheme }

export const FLYER_PRESETS: FlyerPreset[] = [
  { id: "gold", name: "Navy & Gold", swatch: "#d4af37", theme: { accent: "#d4af37", bg: "#0c1422", text: "#0c1422", mode: "dark" } },
  { id: "crimson", name: "Crimson", swatch: "#e11d48", theme: { accent: "#e11d48", bg: "#201018", text: "#201018", mode: "dark" } },
  { id: "emerald", name: "Emerald", swatch: "#10b981", theme: { accent: "#10b981", bg: "#0b1f1a", text: "#0b1f1a", mode: "dark" } },
  { id: "ocean", name: "Ocean Blue", swatch: "#2563eb", theme: { accent: "#2563eb", bg: "#0b1830", text: "#0b1830", mode: "dark" } },
  { id: "sunset", name: "Sunset", swatch: "#f97316", theme: { accent: "#f97316", bg: "#1c1410", text: "#1c1410", mode: "dark" } },
  { id: "violet", name: "Royal Violet", swatch: "#7c3aed", theme: { accent: "#7c3aed", bg: "#160f28", text: "#160f28", mode: "dark" } },
  { id: "ivory", name: "Ivory & Gold", swatch: "#c9a24b", theme: { accent: "#c9a24b", bg: "#f4efe6", text: "#1c2333", mode: "light" } },
  { id: "mono", name: "Charcoal", swatch: "#334155", theme: { accent: "#334155", bg: "#111827", text: "#111827", mode: "dark" } },
]

// Default theme for the Classic flyer (navy + gold — the fhiglobal palette).
export const CLASSIC_DEFAULT_THEME: FlyerTheme = {
  accent: "#d6b357",
  bg: "#001f3f",
  text: "#001f3f",
  mode: "dark",
}
