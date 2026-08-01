/**
 * Business-card canvas renderer — shared by the dashboard editor
 * (features/dashboard/business-card) and the public profile page
 * (app/(public-page)/(header-footer)/business-card/[id]).
 *
 * Browser-only: every function here touches `document`/`canvas`, so this module
 * must only be imported from client components.
 */

import { COUNTRY_CODES } from "@/lib/user-service"

// ── Constants ────────────────────────────────────────────────────────────────
export const FRONT_URL = "https://hefwmaoborpfuyhbguzv.supabase.co/storage/v1/object/public/fhi_global/business-card-front.png"
export const BACK_URL  = "https://hefwmaoborpfuyhbguzv.supabase.co/storage/v1/object/public/fhi_global/business-card-back.png"
const BRAND_STACKED = "/FHI_Branding.png"        // gold shield + white wordmark (stacked)
const BRAND_WHITE   = "/FHI_Branding_White.png"  // horizontal white lockup
// Crop of the gold shield mark inside FHI_Branding.png (source pixels)
const SHIELD_CROP = { sx: 910, sy: 0, sw: 725, sh: 885 }

export const EXPORT_W = 2100
export const EXPORT_H = 1200
/** Preview canvas size; thumbnails are half that. */
export const DISP_W  = 700
export const DISP_H  = 400
export const THUMB_W = 350
export const THUMB_H = 200

export const SUBTITLE = "INTERNATIONAL PROPERTY ENDORSER"

// ── Designs ──────────────────────────────────────────────────────────────────
export type DesignId = "classic" | "platinum" | "noir" | "arc" | "split" | "gold"

export const DESIGNS: { id: DesignId; name: string; tagline: string }[] = [
  { id: "classic",  name: "Skyline Classic", tagline: "Navy skyline with gold accents" },
  { id: "platinum", name: "Pearl Prestige",  tagline: "Ivory minimalist, framed in gold" },
  { id: "noir",     name: "Executive Noir",  tagline: "Black-tie dark, centred layout" },
  { id: "arc",      name: "Gilded Arc",      tagline: "Navy with a sweeping gold arc" },
  { id: "split",    name: "Marina Split",    tagline: "Champagne panel, navy sidebar" },
  { id: "gold",     name: "Gold Leaf",       tagline: "Brushed gold, navy type" },
]

const DESIGN_IDS = new Set<string>(DESIGNS.map((d) => d.id))

export function isDesignId(v: unknown): v is DesignId {
  return typeof v === "string" && DESIGN_IDS.has(v)
}

// ── Phone helpers ────────────────────────────────────────────────────────────
/** Strip any leading 0 from the local number (digits only). */
export function stripLocal(raw: string): string {
  let d = raw.replace(/\D/g, "")
  if (d.startsWith("0")) d = d.slice(1)
  return d
}

/** Resolve the dial code string from a country-code value (e.g. "+1-CA" → "+1"). */
export function dialFromValue(ccValue: string): string {
  const entry = COUNTRY_CODES.find((c) => c.value === ccValue)
  if (entry) return entry.dial
  // fallback: strip any suffix after a dash (e.g. "+1-CA" → "+1")
  return ccValue.includes("-") ? ccValue.split("-")[0] : ccValue
}

export function formatDisplay(dial: string, local: string): string {
  if (!local) return ""
  return `${dial} ${local}`
}

export function isPhoneOk(local: string) { return local.length >= 4 }
export function toE164(dial: string, local: string) { return `${dial}${local}` }

// ── Image loader (cached) ────────────────────────────────────────────────────
const imgCache = new Map<string, Promise<HTMLImageElement>>()

function loadImg(src: string): Promise<HTMLImageElement> {
  const cached = imgCache.get(src)
  if (cached) return cached
  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.onload  = () => resolve(img)
    img.onerror = () => {
      imgCache.delete(src) // allow retry on a later render
      reject(new Error(`Image failed: ${src}`))
    }
    img.src = src
  })
  imgCache.set(src, p)
  return p
}

// ── Canvas text/tracking helpers ─────────────────────────────────────────────
// next/font registers Outfit under a hashed family name, so a literal 'Outfit'
// in ctx.font silently falls back to Arial. Resolve the real family once.
let resolvedDisplayFont: string | null = null
function displayFont(): string {
  if (resolvedDisplayFont) return resolvedDisplayFont
  if (typeof document !== "undefined" && document.body) {
    // next/font puts the CSS variable on <body>, not <html>.
    const fam = getComputedStyle(document.body).getPropertyValue("--font-outfit").trim()
    if (fam) {
      resolvedDisplayFont = `${fam}, Arial, sans-serif`
      return resolvedDisplayFont
    }
  }
  return "Arial, sans-serif"
}

function setTracking(ctx: CanvasRenderingContext2D, px: number) {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
  try { c.letterSpacing = `${px}px` } catch { /* older browsers: no tracking */ }
}

/** Shrink font size until `text` fits within maxW. Sets ctx.font and returns the size. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  basePx: number,
  maxW: number,
  family = displayFont(),
): number {
  let size = basePx
  ctx.font = `${weight} ${size}px ${family}`
  while (ctx.measureText(text).width > maxW && size > 10) {
    size -= 1
    ctx.font = `${weight} ${size}px ${family}`
  }
  return size
}

// ── Canvas icon drawing ───────────────────────────────────────────────────────
function drawPhoneIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color = "#ca9104") {
  const s = size
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth   = s * 0.12
  ctx.lineCap     = "round"
  ctx.lineJoin    = "round"
  ctx.beginPath()
  // simplified phone handset
  ctx.roundRect(cx - s * 0.3, cy - s * 0.5, s * 0.6, s, s * 0.15)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy - s * 0.25, s * 0.1, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.restore()
}

function drawMailIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color = "#ca9104") {
  const s = size
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth   = s * 0.1
  ctx.lineCap     = "round"
  ctx.lineJoin    = "round"
  const x = cx - s * 0.5, y = cy - s * 0.35, w = s, h = s * 0.7
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, s * 0.08)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(cx, cy + s * 0.05)
  ctx.lineTo(x + w, y)
  ctx.stroke()
  ctx.restore()
}

// ── Avatar drawing ────────────────────────────────────────────────────────────
interface AvatarStyle {
  ring: string
  ringWidth: number
  outerRing?: string
  fallbackBg?: [string, string]
  fallbackText?: string
}

async function drawAvatar(
  ctx: CanvasRenderingContext2D,
  url: string | null,
  initials: string,
  cx: number, cy: number, r: number,
  style: AvatarStyle,
) {
  let img: HTMLImageElement | null = null
  if (url) {
    try { img = await loadImg(url) } catch { img = null }
  }

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  if (img) {
    // cover-fit crop
    const scale = Math.max((r * 2) / img.width, (r * 2) / img.height)
    const dw = img.width * scale, dh = img.height * scale
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh)
  } else {
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
    g.addColorStop(0, style.fallbackBg?.[0] ?? "#001f3f")
    g.addColorStop(1, style.fallbackBg?.[1] ?? "#0a3a66")
    ctx.fillStyle = g
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
    ctx.fillStyle = style.fallbackText ?? "#d6b357"
    ctx.font = `700 ${r * 0.85}px ${displayFont()}`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(initials || "?", cx, cy + r * 0.04)
  }
  ctx.restore()

  // rings
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = style.ring
  ctx.lineWidth   = style.ringWidth
  ctx.stroke()
  if (style.outerRing) {
    ctx.beginPath()
    ctx.arc(cx, cy, r + style.ringWidth * 1.8, 0, Math.PI * 2)
    ctx.strokeStyle = style.outerRing
    ctx.lineWidth   = Math.max(1, style.ringWidth * 0.35)
    ctx.stroke()
  }
  ctx.restore()
}

// ── Shared row helpers ────────────────────────────────────────────────────────
function contactRow(
  ctx: CanvasRenderingContext2D,
  kind: "phone" | "mail",
  text: string,
  x: number, y: number,
  iconSize: number,
  fontPx: number,
  iconColor: string,
  textColor: string,
  maxW: number,
) {
  if (kind === "phone") drawPhoneIcon(ctx, x + iconSize * 0.5, y, iconSize, iconColor)
  else drawMailIcon(ctx, x + iconSize * 0.5, y, iconSize, iconColor)
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  fitText(ctx, text, 400, fontPx, maxW, "Arial, sans-serif")
  ctx.fillStyle = textColor
  ctx.fillText(text, x + iconSize * 1.4, y)
}

function centeredContactRow(
  ctx: CanvasRenderingContext2D,
  kind: "phone" | "mail",
  text: string,
  cx: number, y: number,
  iconSize: number,
  fontPx: number,
  iconColor: string,
  textColor: string,
  maxW: number,
) {
  fitText(ctx, text, 400, fontPx, maxW - iconSize * 1.5, "Arial, sans-serif")
  const tw = ctx.measureText(text).width
  const gap = iconSize * 0.5
  const startX = cx - (iconSize + gap + tw) / 2
  if (kind === "phone") drawPhoneIcon(ctx, startX + iconSize * 0.5, y, iconSize, iconColor)
  else drawMailIcon(ctx, startX + iconSize * 0.5, y, iconSize, iconColor)
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillStyle = textColor
  ctx.fillText(text, startX + iconSize + gap, y)
}

// ── Card data ─────────────────────────────────────────────────────────────────
export interface CardData {
  name: string
  phoneDial: string
  phoneLocal: string
  email: string
  avatarUrl: string | null
  initials: string
}

function phoneText(data: CardData) {
  return data.phoneLocal ? formatDisplay(data.phoneDial, data.phoneLocal) : "+971 5x xxx xxxx"
}

// ── Design: Skyline Classic (image background) ───────────────────────────────
async function renderClassicFront(ctx: CanvasRenderingContext2D, data: CardData, width: number, height: number) {
  try {
    const img = await loadImg(FRONT_URL)
    ctx.drawImage(img, 0, 0, width, height)
  } catch {
    ctx.fillStyle = "#001f3f"
    ctx.fillRect(0, 0, width, height)
  }

  // Avatar on the left, over the skyline — kept below the top-left logo
  await drawAvatar(ctx, data.avatarUrl, data.initials, width * 0.19, height * 0.63, height * 0.175, {
    ring: "#d6b357",
    ringWidth: Math.max(2, height * 0.012),
    outerRing: "rgba(255,255,255,0.35)",
    fallbackBg: ["#0a3a66", "#001f3f"],
  })

  // Text region sits in the right ~55% of the card
  const textX = width * 0.40
  const maxW  = width * 0.54

  // Name – auto-shrink until it fits
  ctx.fillStyle = "#ffffff"
  ctx.textAlign  = "left"
  ctx.textBaseline = "alphabetic"
  const fontSize = fitText(ctx, data.name || "Your Name", 700, Math.round(height * 0.10), maxW)
  ctx.fillText(data.name || "Your Name", textX, height * 0.44)

  // Subtitle
  ctx.fillStyle = "#ca9104"
  const subSize = fitText(ctx, SUBTITLE, 600, Math.round(height * 0.05), maxW)
  ctx.fillText(SUBTITLE, textX, height * 0.44 + fontSize * 1.25)

  // Divider
  const divY = height * 0.44 + fontSize * 1.25 + subSize * 0.9
  ctx.strokeStyle = "rgba(255,255,255,0.25)"
  ctx.lineWidth   = 1
  ctx.beginPath()
  ctx.moveTo(textX, divY)
  ctx.lineTo(textX + maxW, divY)
  ctx.stroke()

  // Contact rows
  const rowSize   = Math.round(height * 0.046)
  const iconSize  = rowSize * 1.1
  const row1Y     = divY + height * 0.12
  const row2Y     = row1Y + height * 0.09
  contactRow(ctx, "phone", phoneText(data), textX, row1Y, iconSize, rowSize, "#ca9104", "#ffffff", maxW - iconSize * 1.5)
  contactRow(ctx, "mail", data.email || "your@email.com", textX, row2Y, iconSize, rowSize, "#ca9104", "#ffffff", maxW - iconSize * 1.5)
}

async function renderClassicBack(ctx: CanvasRenderingContext2D, width: number, height: number) {
  try {
    const img = await loadImg(BACK_URL)
    ctx.drawImage(img, 0, 0, width, height)
  } catch {
    ctx.fillStyle = "#001f3f"
    ctx.fillRect(0, 0, width, height)
  }
}

// ── Design: Pearl Prestige (ivory + gold) ────────────────────────────────────
function drawDoubleFrame(ctx: CanvasRenderingContext2D, width: number, height: number, outer: string, inner: string) {
  const inset = height * 0.035
  ctx.strokeStyle = outer
  ctx.lineWidth = Math.max(1, height * 0.006)
  ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2)
  ctx.strokeStyle = inner
  ctx.lineWidth = Math.max(1, height * 0.003)
  ctx.strokeRect(inset * 1.55, inset * 1.55, width - inset * 3.1, height - inset * 3.1)
}

async function renderPlatinumFront(ctx: CanvasRenderingContext2D, data: CardData, width: number, height: number) {
  // ivory base
  ctx.fillStyle = "#f7f4ec"
  ctx.fillRect(0, 0, width, height)

  // decorative gold arcs, top-right
  ctx.save()
  ctx.strokeStyle = "rgba(202,145,4,0.13)"
  ctx.lineWidth = Math.max(1, height * 0.005)
  for (const f of [0.5, 0.68, 0.86]) {
    ctx.beginPath()
    ctx.arc(width * 0.93, height * 0.06, height * f, 0, Math.PI * 2)
    ctx.stroke()
  }
  // soft navy wash, bottom-left
  const blot = ctx.createRadialGradient(width * 0.04, height * 1.02, 0, width * 0.04, height * 1.02, height * 0.55)
  blot.addColorStop(0, "rgba(0,31,63,0.07)")
  blot.addColorStop(1, "rgba(0,31,63,0)")
  ctx.fillStyle = blot
  ctx.fillRect(0, 0, width, height)
  ctx.restore()

  drawDoubleFrame(ctx, width, height, "rgba(202,145,4,0.55)", "rgba(0,31,63,0.10)")

  // brand lockup top-left: gold shield + navy wordmark + DUBAI badge
  const lockX = width * 0.075, lockY = height * 0.10, shieldH = height * 0.17
  let shieldW = shieldH * (SHIELD_CROP.sw / SHIELD_CROP.sh)
  try {
    const logo = await loadImg(BRAND_STACKED)
    ctx.drawImage(logo, SHIELD_CROP.sx, SHIELD_CROP.sy, SHIELD_CROP.sw, SHIELD_CROP.sh, lockX, lockY, shieldW, shieldH)
  } catch {
    shieldW = 0
  }
  const brandX = lockX + shieldW + shieldH * 0.22
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = "#0d1b2e"
  ctx.font = `700 ${shieldH * 0.38}px ${displayFont()}`
  ctx.fillText("Global Property", brandX, lockY + shieldH * 0.45)
  const dSize = shieldH * 0.24
  setTracking(ctx, dSize * 0.35)
  ctx.font = `700 ${dSize}px ${displayFont()}`
  const dW = ctx.measureText("DUBAI").width
  const padX = dSize * 0.5, badgeY = lockY + shieldH * 0.60, badgeH = dSize * 1.5
  ctx.fillStyle = "#ca9104"
  ctx.fillRect(brandX, badgeY, dW + padX * 2, badgeH)
  ctx.fillStyle = "#ffffff"
  ctx.textBaseline = "middle"
  ctx.fillText("DUBAI", brandX + padX, badgeY + badgeH / 2 + dSize * 0.06)
  setTracking(ctx, 0)

  // avatar on the right
  const avR = height * 0.21
  await drawAvatar(ctx, data.avatarUrl, data.initials, width * 0.815, height * 0.52, avR, {
    ring: "#ca9104",
    ringWidth: Math.max(2, height * 0.011),
    outerRing: "rgba(0,31,63,0.22)",
    fallbackBg: ["#001f3f", "#0a3a66"],
  })

  const textX = width * 0.075
  const maxW  = width * 0.56

  // name
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = "#0d1b2e"
  fitText(ctx, data.name || "Your Name", 700, Math.round(height * 0.10), maxW)
  ctx.fillText(data.name || "Your Name", textX, height * 0.52)

  // subtitle
  setTracking(ctx, height * 0.006)
  ctx.fillStyle = "#ca9104"
  fitText(ctx, SUBTITLE, 600, Math.round(height * 0.044), maxW)
  ctx.fillText(SUBTITLE, textX, height * 0.615)
  setTracking(ctx, 0)

  // divider with diamond
  const divY = height * 0.67
  ctx.fillStyle = "#ca9104"
  ctx.save()
  ctx.translate(textX + height * 0.012, divY)
  ctx.rotate(Math.PI / 4)
  ctx.fillRect(-height * 0.011, -height * 0.011, height * 0.022, height * 0.022)
  ctx.restore()
  const grad = ctx.createLinearGradient(textX, 0, textX + maxW * 0.8, 0)
  grad.addColorStop(0, "rgba(202,145,4,0.9)")
  grad.addColorStop(1, "rgba(202,145,4,0)")
  ctx.strokeStyle = grad
  ctx.lineWidth = Math.max(1, height * 0.004)
  ctx.beginPath()
  ctx.moveTo(textX + height * 0.04, divY)
  ctx.lineTo(textX + maxW * 0.8, divY)
  ctx.stroke()

  // contact rows
  const rowSize  = Math.round(height * 0.046)
  const iconSize = rowSize * 1.1
  contactRow(ctx, "phone", phoneText(data), textX, height * 0.765, iconSize, rowSize, "#ca9104", "#16324f", maxW - iconSize * 1.5)
  contactRow(ctx, "mail", data.email || "your@email.com", textX, height * 0.86, iconSize, rowSize, "#ca9104", "#16324f", maxW - iconSize * 1.5)
}

async function renderPlatinumBack(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = "#001f3f"
  ctx.fillRect(0, 0, width, height)
  const g = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, height * 0.75)
  g.addColorStop(0, "rgba(214,179,87,0.10)")
  g.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, width, height)

  drawDoubleFrame(ctx, width, height, "rgba(214,179,87,0.55)", "rgba(255,255,255,0.10)")

  try {
    const logo = await loadImg(BRAND_STACKED)
    const lh = height * 0.56
    const lw = lh * (logo.width / logo.height)
    ctx.drawImage(logo, (width - lw) / 2, (height - lh) / 2, lw, lh)
  } catch { /* plain navy back */ }
}

// ── Design: Executive Noir (dark + gold, centred) ────────────────────────────
function noirBase(ctx: CanvasRenderingContext2D, width: number, height: number, glowY: number) {
  const g = ctx.createLinearGradient(0, 0, width, height)
  g.addColorStop(0, "#0a0a10")
  g.addColorStop(0.55, "#12121a")
  g.addColorStop(1, "#1b1b25")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, width, height)

  const glow = ctx.createRadialGradient(width * 0.5, glowY, 0, width * 0.5, glowY, height * 0.55)
  glow.addColorStop(0, "rgba(214,179,87,0.15)")
  glow.addColorStop(1, "rgba(214,179,87,0)")
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)

  // frame
  const inset = height * 0.04
  ctx.strokeStyle = "rgba(214,179,87,0.35)"
  ctx.lineWidth = Math.max(1, height * 0.0035)
  ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2)

  // gold corner accents
  const L = width * 0.05
  ctx.strokeStyle = "#d6b357"
  ctx.lineWidth = Math.max(1.5, height * 0.008)
  ctx.lineCap = "square"
  const corners: [number, number, number, number][] = [
    [inset, inset, 1, 1], [width - inset, inset, -1, 1],
    [inset, height - inset, 1, -1], [width - inset, height - inset, -1, -1],
  ]
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath()
    ctx.moveTo(cx + dx * L, cy)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx, cy + dy * L)
    ctx.stroke()
  }
}

async function renderNoirFront(ctx: CanvasRenderingContext2D, data: CardData, width: number, height: number) {
  noirBase(ctx, width, height, height * 0.30)

  // horizontal white logo, top-left
  try {
    const logo = await loadImg(BRAND_WHITE)
    const lh = height * 0.095
    const lw = lh * (logo.width / logo.height)
    ctx.drawImage(logo, width * 0.065, height * 0.075, lw, lh)
  } catch { /* skip logo */ }

  // avatar centred
  await drawAvatar(ctx, data.avatarUrl, data.initials, width * 0.5, height * 0.315, height * 0.16, {
    ring: "#d6b357",
    ringWidth: Math.max(2, height * 0.010),
    outerRing: "rgba(255,255,255,0.18)",
    fallbackBg: ["#26261f", "#101014"],
  })

  // name centred
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = "#f5f2ea"
  fitText(ctx, data.name || "Your Name", 700, Math.round(height * 0.085), width * 0.82)
  ctx.fillText(data.name || "Your Name", width * 0.5, height * 0.585)

  // subtitle centred
  setTracking(ctx, height * 0.008)
  ctx.fillStyle = "#d6b357"
  fitText(ctx, SUBTITLE, 600, Math.round(height * 0.042), width * 0.82)
  ctx.fillText(SUBTITLE, width * 0.5, height * 0.66)
  setTracking(ctx, 0)

  // divider: line ◆ line
  const divY = height * 0.72
  ctx.strokeStyle = "rgba(214,179,87,0.45)"
  ctx.lineWidth = Math.max(1, height * 0.003)
  ctx.beginPath()
  ctx.moveTo(width * 0.32, divY)
  ctx.lineTo(width * 0.46, divY)
  ctx.moveTo(width * 0.54, divY)
  ctx.lineTo(width * 0.68, divY)
  ctx.stroke()
  ctx.fillStyle = "#d6b357"
  ctx.save()
  ctx.translate(width * 0.5, divY)
  ctx.rotate(Math.PI / 4)
  ctx.fillRect(-height * 0.010, -height * 0.010, height * 0.020, height * 0.020)
  ctx.restore()

  // contact rows centred
  const rowSize  = Math.round(height * 0.044)
  const iconSize = rowSize * 1.1
  centeredContactRow(ctx, "phone", phoneText(data), width * 0.5, height * 0.805, iconSize, rowSize, "#d6b357", "#e8e6df", width * 0.8)
  centeredContactRow(ctx, "mail", data.email || "your@email.com", width * 0.5, height * 0.89, iconSize, rowSize, "#d6b357", "#e8e6df", width * 0.8)
}

async function renderNoirBack(ctx: CanvasRenderingContext2D, width: number, height: number) {
  noirBase(ctx, width, height, height * 0.5)
  try {
    const logo = await loadImg(BRAND_STACKED)
    const lh = height * 0.52
    const lw = lh * (logo.width / logo.height)
    ctx.drawImage(logo, (width - lw) / 2, (height - lh) / 2, lw, lh)
  } catch { /* plain dark back */ }
}

// ── Design: Gilded Arc (navy + sweeping gold arc) ────────────────────────────
/** Navy field with concentric gold arcs swung from off-canvas, bottom-left. */
function arcBase(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const g = ctx.createLinearGradient(0, 0, width, height)
  g.addColorStop(0, "#012c58")
  g.addColorStop(0.55, "#001f3f")
  g.addColorStop(1, "#00142b")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, width, height)

  // Warm lift behind the portrait so the avatar doesn't sit on flat navy.
  const glow = ctx.createRadialGradient(width * 0.22, height * 0.5, 0, width * 0.22, height * 0.5, height * 0.8)
  glow.addColorStop(0, "rgba(214,179,87,0.16)")
  glow.addColorStop(1, "rgba(214,179,87,0)")
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)

  // Quarter arcs swung from the bottom-left corner. The widest is kept under
  // 0.44w so the sweep frames the portrait and never crosses the type block —
  // gold rules over a gold subtitle would be unreadable.
  ctx.save()
  ctx.lineCap = "butt"
  const bands: [number, number, string][] = [
    [height * 0.28, height * 0.006, "rgba(214,179,87,0.45)"],
    [height * 0.60, height * 0.030, "#d6b357"],
    [height * 0.70, height * 0.007, "rgba(247,227,161,0.70)"],
    [height * 0.76, height * 0.004, "rgba(214,179,87,0.35)"],
  ]
  for (const [r, w, color] of bands) {
    ctx.beginPath()
    ctx.arc(0, height, r, -Math.PI / 2, 0)
    ctx.strokeStyle = color
    ctx.lineWidth = w
    ctx.stroke()
  }
  ctx.restore()
}

async function renderArcFront(ctx: CanvasRenderingContext2D, data: CardData, width: number, height: number) {
  arcBase(ctx, width, height)

  // horizontal white lockup, top-right
  try {
    const logo = await loadImg(BRAND_WHITE)
    const lh = height * 0.10
    const lw = lh * (logo.width / logo.height)
    ctx.drawImage(logo, width - lw - width * 0.06, height * 0.085, lw, lh)
  } catch { /* skip logo */ }

  await drawAvatar(ctx, data.avatarUrl, data.initials, width * 0.215, height * 0.52, height * 0.215, {
    ring: "#d6b357",
    ringWidth: Math.max(2, height * 0.014),
    outerRing: "rgba(247,227,161,0.45)",
    fallbackBg: ["#0a3a66", "#001f3f"],
  })

  const textX = width * 0.44
  const maxW = width * 0.50

  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = "#ffffff"
  fitText(ctx, data.name || "Your Name", 700, Math.round(height * 0.105), maxW)
  ctx.fillText(data.name || "Your Name", textX, height * 0.46)

  setTracking(ctx, height * 0.007)
  ctx.fillStyle = "#e7c86a"
  fitText(ctx, SUBTITLE, 600, Math.round(height * 0.043), maxW)
  ctx.fillText(SUBTITLE, textX, height * 0.555)
  setTracking(ctx, 0)

  // gold rule that fades out to the right
  const divY = height * 0.615
  const grad = ctx.createLinearGradient(textX, 0, textX + maxW, 0)
  grad.addColorStop(0, "rgba(214,179,87,0.95)")
  grad.addColorStop(1, "rgba(214,179,87,0)")
  ctx.strokeStyle = grad
  ctx.lineWidth = Math.max(1, height * 0.004)
  ctx.beginPath()
  ctx.moveTo(textX, divY)
  ctx.lineTo(textX + maxW, divY)
  ctx.stroke()

  const rowSize = Math.round(height * 0.046)
  const iconSize = rowSize * 1.1
  contactRow(ctx, "phone", phoneText(data), textX, height * 0.735, iconSize, rowSize, "#e7c86a", "#ffffff", maxW - iconSize * 1.5)
  contactRow(ctx, "mail", data.email || "your@email.com", textX, height * 0.845, iconSize, rowSize, "#e7c86a", "#ffffff", maxW - iconSize * 1.5)
}

async function renderArcBack(ctx: CanvasRenderingContext2D, width: number, height: number) {
  arcBase(ctx, width, height)
  try {
    const logo = await loadImg(BRAND_STACKED)
    const lh = height * 0.50
    const lw = lh * (logo.width / logo.height)
    ctx.drawImage(logo, (width - lw) / 2, (height - lh) / 2, lw, lh)
  } catch { /* plain navy back */ }
}

// ── Design: Marina Split (navy sidebar + champagne panel) ────────────────────
const SPLIT_AT = 0.36

function splitBase(ctx: CanvasRenderingContext2D, width: number, height: number) {
  // champagne panel
  const panel = ctx.createLinearGradient(0, 0, width, height)
  panel.addColorStop(0, "#faf3e6")
  panel.addColorStop(1, "#efe3cb")
  ctx.fillStyle = panel
  ctx.fillRect(0, 0, width, height)

  // navy sidebar
  const bandW = width * SPLIT_AT
  const band = ctx.createLinearGradient(0, 0, bandW, height)
  band.addColorStop(0, "#00284f")
  band.addColorStop(1, "#001428")
  ctx.fillStyle = band
  ctx.fillRect(0, 0, bandW, height)

  // gold seam between the two halves
  ctx.fillStyle = "#d6b357"
  ctx.fillRect(bandW, 0, Math.max(2, width * 0.005), height)

  // hairline keyline inside the champagne side
  const inset = height * 0.055
  ctx.strokeStyle = "rgba(202,145,4,0.35)"
  ctx.lineWidth = Math.max(1, height * 0.003)
  ctx.strokeRect(bandW + inset, inset, width - bandW - inset * 2, height - inset * 2)
}

async function renderSplitFront(ctx: CanvasRenderingContext2D, data: CardData, width: number, height: number) {
  splitBase(ctx, width, height)

  const bandCx = width * SPLIT_AT * 0.5

  // stacked lockup in the sidebar, above the portrait
  try {
    const logo = await loadImg(BRAND_STACKED)
    const lh = height * 0.26
    const lw = lh * (logo.width / logo.height)
    ctx.drawImage(logo, bandCx - lw / 2, height * 0.10, lw, lh)
  } catch { /* skip logo */ }

  await drawAvatar(ctx, data.avatarUrl, data.initials, bandCx, height * 0.66, height * 0.185, {
    ring: "#d6b357",
    ringWidth: Math.max(2, height * 0.013),
    outerRing: "rgba(255,255,255,0.22)",
    fallbackBg: ["#0a3a66", "#001f3f"],
  })

  const textX = width * (SPLIT_AT + 0.075)
  const maxW = width * (1 - SPLIT_AT) * 0.82

  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = "#0d1b2e"
  fitText(ctx, data.name || "Your Name", 700, Math.round(height * 0.105), maxW)
  ctx.fillText(data.name || "Your Name", textX, height * 0.40)

  setTracking(ctx, height * 0.006)
  ctx.fillStyle = "#a8790a"
  fitText(ctx, SUBTITLE, 600, Math.round(height * 0.040), maxW)
  ctx.fillText(SUBTITLE, textX, height * 0.49)
  setTracking(ctx, 0)

  // divider with a diamond, matching Pearl's detailing
  const divY = height * 0.565
  ctx.fillStyle = "#ca9104"
  ctx.save()
  ctx.translate(textX + height * 0.012, divY)
  ctx.rotate(Math.PI / 4)
  ctx.fillRect(-height * 0.010, -height * 0.010, height * 0.020, height * 0.020)
  ctx.restore()
  const grad = ctx.createLinearGradient(textX, 0, textX + maxW, 0)
  grad.addColorStop(0, "rgba(202,145,4,0.85)")
  grad.addColorStop(1, "rgba(202,145,4,0)")
  ctx.strokeStyle = grad
  ctx.lineWidth = Math.max(1, height * 0.004)
  ctx.beginPath()
  ctx.moveTo(textX + height * 0.042, divY)
  ctx.lineTo(textX + maxW, divY)
  ctx.stroke()

  const rowSize = Math.round(height * 0.044)
  const iconSize = rowSize * 1.1
  contactRow(ctx, "phone", phoneText(data), textX, height * 0.705, iconSize, rowSize, "#ca9104", "#16324f", maxW - iconSize * 1.5)
  contactRow(ctx, "mail", data.email || "your@email.com", textX, height * 0.825, iconSize, rowSize, "#ca9104", "#16324f", maxW - iconSize * 1.5)
}

async function renderSplitBack(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const g = ctx.createLinearGradient(0, 0, width, height)
  g.addColorStop(0, "#00284f")
  g.addColorStop(1, "#001428")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, width, height)

  drawDoubleFrame(ctx, width, height, "rgba(214,179,87,0.55)", "rgba(255,255,255,0.10)")

  try {
    const logo = await loadImg(BRAND_STACKED)
    const lh = height * 0.52
    const lw = lh * (logo.width / logo.height)
    ctx.drawImage(logo, (width - lw) / 2, (height - lh) / 2, lw, lh)
  } catch { /* plain navy back */ }
}

// ── Design: Gold Leaf (brushed gold + navy type) ─────────────────────────────
const NAVY_INK = "#001f3f"

/** Brushed gold field with a soft diagonal sheen. */
function goldBase(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const g = ctx.createLinearGradient(0, 0, width, height)
  g.addColorStop(0, "#f0d894")
  g.addColorStop(0.28, "#dcb75c")
  g.addColorStop(0.52, "#c9a244")
  g.addColorStop(0.74, "#e2c477")
  g.addColorStop(1, "#bf942f")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, width, height)

  // brushed streaks, angled with the sheen
  ctx.save()
  ctx.globalAlpha = 0.10
  ctx.strokeStyle = "#fff6d8"
  ctx.lineWidth = Math.max(1, height * 0.004)
  for (let i = -6; i < 22; i++) {
    const x = (i / 16) * width
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + width * 0.16, height)
    ctx.stroke()
  }
  ctx.restore()

  // inner keyline
  const inset = height * 0.045
  ctx.strokeStyle = "rgba(0,31,63,0.28)"
  ctx.lineWidth = Math.max(1, height * 0.003)
  ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2)
}

/** Navy plate behind the white lockup — the logo can't read on gold alone. */
function navyPlate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save()
  ctx.fillStyle = NAVY_INK
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, h * 0.22)
  ctx.fill()
  ctx.strokeStyle = "rgba(255,255,255,0.22)"
  ctx.lineWidth = Math.max(1, h * 0.035)
  ctx.stroke()
  ctx.restore()
}

async function renderGoldFront(ctx: CanvasRenderingContext2D, data: CardData, width: number, height: number) {
  goldBase(ctx, width, height)

  // navy contact band across the bottom
  const bandY = height * 0.70
  ctx.fillStyle = NAVY_INK
  ctx.fillRect(0, bandY, width, height - bandY)
  ctx.fillStyle = "rgba(247,227,161,0.85)"
  ctx.fillRect(0, bandY, width, Math.max(2, height * 0.006))

  // logo plate, top-right
  try {
    const logo = await loadImg(BRAND_WHITE)
    const lh = height * 0.085
    const lw = lh * (logo.width / logo.height)
    const padX = lh * 0.55, padY = lh * 0.42
    const plateW = lw + padX * 2, plateH = lh + padY * 2
    const plateX = width - plateW - width * 0.055, plateY = height * 0.075
    navyPlate(ctx, plateX, plateY, plateW, plateH)
    ctx.drawImage(logo, plateX + padX, plateY + padY, lw, lh)
  } catch { /* skip logo */ }

  await drawAvatar(ctx, data.avatarUrl, data.initials, width * 0.185, height * 0.40, height * 0.175, {
    ring: NAVY_INK,
    ringWidth: Math.max(2, height * 0.013),
    outerRing: "rgba(255,255,255,0.45)",
    fallbackBg: ["#0a3a66", "#001f3f"],
  })

  const textX = width * 0.335
  const maxW = width * 0.44

  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = NAVY_INK
  fitText(ctx, data.name || "Your Name", 700, Math.round(height * 0.098), maxW)
  ctx.fillText(data.name || "Your Name", textX, height * 0.42)

  setTracking(ctx, height * 0.006)
  ctx.fillStyle = "#5c4407"
  fitText(ctx, SUBTITLE, 600, Math.round(height * 0.040), maxW)
  ctx.fillText(SUBTITLE, textX, height * 0.515)
  setTracking(ctx, 0)

  // contact rows sit inside the navy band
  const rowSize = Math.round(height * 0.044)
  const iconSize = rowSize * 1.1
  const rowsMaxW = width * 0.42
  contactRow(ctx, "phone", phoneText(data), width * 0.075, height * 0.80, iconSize, rowSize, "#e7c86a", "#ffffff", rowsMaxW)
  contactRow(ctx, "mail", data.email || "your@email.com", width * 0.52, height * 0.80, iconSize, rowSize, "#e7c86a", "#ffffff", rowsMaxW)
}

async function renderGoldBack(ctx: CanvasRenderingContext2D, width: number, height: number) {
  goldBase(ctx, width, height)
  try {
    const logo = await loadImg(BRAND_STACKED)
    const lh = height * 0.34
    const lw = lh * (logo.width / logo.height)
    const padX = lh * 0.30, padY = lh * 0.26
    const plateW = lw + padX * 2, plateH = lh + padY * 2
    navyPlate(ctx, (width - plateW) / 2, (height - plateH) / 2, plateW, plateH)
    ctx.drawImage(logo, (width - lw) / 2, (height - lh) / 2, lw, lh)
  } catch { /* plain gold back */ }
}

// ── Canvas renderer ───────────────────────────────────────────────────────────
export async function renderCard(
  side: "front" | "back",
  design: DesignId,
  data: CardData,
  width: number,
  height: number,
): Promise<string> {
  try {
    await document.fonts?.ready
  } catch {
    /* render with whatever fonts are available */
  }
  const canvas = document.createElement("canvas")
  canvas.width  = width
  canvas.height = height
  const ctx = canvas.getContext("2d")!

  if (design === "platinum") {
    if (side === "front") await renderPlatinumFront(ctx, data, width, height)
    else await renderPlatinumBack(ctx, width, height)
  } else if (design === "arc") {
    if (side === "front") await renderArcFront(ctx, data, width, height)
    else await renderArcBack(ctx, width, height)
  } else if (design === "split") {
    if (side === "front") await renderSplitFront(ctx, data, width, height)
    else await renderSplitBack(ctx, width, height)
  } else if (design === "gold") {
    if (side === "front") await renderGoldFront(ctx, data, width, height)
    else await renderGoldBack(ctx, width, height)
  } else if (design === "noir") {
    if (side === "front") await renderNoirFront(ctx, data, width, height)
    else await renderNoirBack(ctx, width, height)
  } else {
    if (side === "front") await renderClassicFront(ctx, data, width, height)
    else await renderClassicBack(ctx, width, height)
  }

  return canvas.toDataURL("image/png")
}

/**
 * Decode a `data:` URL from renderCard into a Blob, for uploading.
 *
 * Deliberately not `await fetch(dataUrl).blob()`, which is the obvious way and
 * fails: the app's CSP allows `data:` in img-src but not in connect-src, so
 * fetching one throws a bare "Failed to fetch" TypeError. Widening connect-src
 * to permit data: would weaken the policy for every request on the site to save
 * these six lines, which is not a trade worth making.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",")
  if (comma < 0) throw new Error("Not a data URL")
  const header = dataUrl.slice(0, comma)
  const mime = /:(.*?)[;,]/.exec(header)?.[1] || "image/png"
  const binary = atob(dataUrl.slice(comma + 1))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}
