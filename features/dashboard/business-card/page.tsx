"use client"
import { useRouter } from "next/navigation"

import React, {
  useState, useEffect, useRef, useCallback, ChangeEvent,
} from "react"
import { useAuth } from "@/context/auth-context"
import { COUNTRY_CODES } from "@/lib/user-service"
import { PhoneCountrySelect } from "@/components/phone-country-select"
import {
  Phone, Mail, Save, Loader2, CheckCircle2, AlertCircle,
  RefreshCcw, Info, CreditCard, Download, Palette,
} from "lucide-react"

// ── Constants ────────────────────────────────────────────────────────────────
const FRONT_URL = "https://hefwmaoborpfuyhbguzv.supabase.co/storage/v1/object/public/fhi_global/business-card-front.png"
const BACK_URL  = "https://hefwmaoborpfuyhbguzv.supabase.co/storage/v1/object/public/fhi_global/business-card-back.png"
const BRAND_STACKED = "/FHI_Branding.png"        // gold shield + white wordmark (stacked)
const BRAND_WHITE   = "/FHI_Branding_White.png"  // horizontal white lockup
// Crop of the gold shield mark inside FHI_Branding.png (source pixels)
const SHIELD_CROP = { sx: 910, sy: 0, sw: 725, sh: 885 }
const EXPORT_W  = 2100
const EXPORT_H  = 1200
const API_BASE  = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

const SUBTITLE = "INTERNATIONAL PROPERTY ENDORSER"

// ── Designs ──────────────────────────────────────────────────────────────────
export type DesignId = "classic" | "platinum" | "noir"

const DESIGNS: { id: DesignId; name: string; tagline: string }[] = [
  { id: "classic",  name: "Skyline Classic", tagline: "Navy skyline with gold accents" },
  { id: "platinum", name: "Pearl Prestige",  tagline: "Ivory minimalist, framed in gold" },
  { id: "noir",     name: "Executive Noir",  tagline: "Black-tie dark, centred layout" },
]

function isDesignId(v: unknown): v is DesignId {
  return v === "classic" || v === "platinum" || v === "noir"
}

// ── Phone helpers ────────────────────────────────────────────────────────────
/** Strip any leading 0 from the local number (digits only). */
function stripLocal(raw: string): string {
  let d = raw.replace(/\D/g, "")
  if (d.startsWith("0")) d = d.slice(1)
  return d
}

/** Resolve the dial code string from a country-code value (e.g. "+1-CA" → "+1"). */
function dialFromValue(ccValue: string): string {
  const entry = COUNTRY_CODES.find((c) => c.value === ccValue)
  if (entry) return entry.dial
  // fallback: strip any suffix after a dash (e.g. "+1-CA" → "+1")
  return ccValue.includes("-") ? ccValue.split("-")[0] : ccValue
}

function formatDisplay(dial: string, local: string): string {
  if (!local) return ""
  return `${dial} ${local}`
}

function isPhoneOk(local: string) { return local.length >= 4 }
function toE164(dial: string, local: string) { return `${dial}${local}` }

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
  family = "'Outfit', Arial, sans-serif",
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
    ctx.font = `700 ${r * 0.85}px 'Outfit', Arial, sans-serif`
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
interface CardData {
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
  ctx.font = `700 ${shieldH * 0.38}px 'Outfit', Arial, sans-serif`
  ctx.fillText("Global Property", brandX, lockY + shieldH * 0.45)
  const dSize = shieldH * 0.24
  setTracking(ctx, dSize * 0.35)
  ctx.font = `700 ${dSize}px 'Outfit', Arial, sans-serif`
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

// ── Canvas renderer ───────────────────────────────────────────────────────────
async function renderCard(
  side: "front" | "back",
  design: DesignId,
  data: CardData,
  width: number,
  height: number,
): Promise<string> {
  const canvas = document.createElement("canvas")
  canvas.width  = width
  canvas.height = height
  const ctx = canvas.getContext("2d")!

  if (design === "platinum") {
    if (side === "front") await renderPlatinumFront(ctx, data, width, height)
    else await renderPlatinumBack(ctx, width, height)
  } else if (design === "noir") {
    if (side === "front") await renderNoirFront(ctx, data, width, height)
    else await renderNoirBack(ctx, width, height)
  } else {
    if (side === "front") await renderClassicFront(ctx, data, width, height)
    else await renderClassicBack(ctx, width, height)
  }

  return canvas.toDataURL("image/png")
}

// ── Preview at display size ───────────────────────────────────────────────────
// Display canvas is 700×400 rendered at devicePixelRatio for crispness
const DISP_W = 700
const DISP_H = 400
const THUMB_W = 350
const THUMB_H = 200

// ── Main component ────────────────────────────────────────────────────────────
export default function BusinessCardPage() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const role = (profile?.role ?? "agent") as string

  const fullName = profile?.fullname ?? user?.email?.split("@")[0] ?? ""
  // Cross-origin avatars (S3, Google) usually lack the CORS headers canvas
  // export needs, so remote URLs go through our same-origin proxy instead.
  const rawAvatar = profile?.profile_url?.trim() ?? ""
  const avatarUrl = rawAvatar
    ? (rawAvatar.startsWith("/") ? rawAvatar : `${API_BASE}/api/me/avatar`)
    : null
  const initials = [profile?.fname, profile?.lname]
    .map((p) => (p ?? "").trim().charAt(0).toUpperCase())
    .join("") || fullName.trim().charAt(0).toUpperCase()

  // phone/email state
  const [countryCode, setCountryCode] = useState("+971") // country-code value (e.g. "+63")
  const [localNumber, setLocalNumber] = useState("")     // local number digits
  const [email,       setEmail]       = useState("")

  // design + card side
  const [design,  setDesign]  = useState<DesignId>("classic")
  const [flipped, setFlipped] = useState(false)

  // canvas preview data URLs
  const [frontDataUrl, setFrontDataUrl] = useState("")
  const [backDataUrl,  setBackDataUrl]  = useState("")
  const [thumbs, setThumbs] = useState<Record<DesignId, string>>({ classic: "", platinum: "", noir: "" })
  const [previewLoading, setPreviewLoading] = useState(false)

  // save state
  type SaveState = "idle" | "saving" | "success" | "error"
  const [saveState, setSaveState]   = useState<SaveState>("idle")
  const [saveError, setSaveError]   = useState("")

  // pre-fill from profile on mount
  useEffect(() => {
    if (profile?.metadata) {
      const meta = profile.metadata as Record<string, unknown>
      // country code stored as phone_country_code in the metadata JSON column
      const cc = typeof meta.phone_country_code === "string" ? meta.phone_country_code : "+971"
      setCountryCode(cc)
      // local number stored as phone_number in the metadata JSON column
      const raw = typeof meta.phone_number === "string" ? meta.phone_number : ""
      if (raw) {
        setLocalNumber(stripLocal(raw))
      }
      // previously chosen card design
      if (isDesignId(meta.business_card_design)) {
        setDesign(meta.business_card_design)
      }
    }
    if (user?.email) setEmail(user.email.toLowerCase())
  }, [profile, user])

  // ── phone input handler ──────────────────────────────────────────────────
  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    setLocalNumber(e.target.value.replace(/\D/g, ""))
  }

  // resolved dial code for display (e.g. "+63")
  const phoneDial = dialFromValue(countryCode)

  // ── regenerate canvas preview ────────────────────────────────────────────
  const regeneratePreview = useCallback(async () => {
    setPreviewLoading(true)
    const data: CardData = { name: fullName, phoneDial, phoneLocal: localNumber, email, avatarUrl, initials }
    const [f, b, ...thumbUrls] = await Promise.all([
      renderCard("front", design, data, DISP_W, DISP_H),
      renderCard("back",  design, data, DISP_W, DISP_H),
      ...DESIGNS.map((d) => renderCard("front", d.id, data, THUMB_W, THUMB_H)),
    ])
    setFrontDataUrl(f)
    setBackDataUrl(b)
    setThumbs({ classic: thumbUrls[0], platinum: thumbUrls[1], noir: thumbUrls[2] })
    setPreviewLoading(false)
  }, [fullName, phoneDial, localNumber, email, avatarUrl, initials, design])

  // regenerate whenever inputs change (debounced 400ms)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(regeneratePreview, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [regeneratePreview])

  // ── design selection (persisted best-effort) ─────────────────────────────
  const selectDesign = (id: DesignId) => {
    if (id === design) return
    setDesign(id)
    // fire-and-forget: remember the choice across devices
    fetch(`${API_BASE}/api/me/contact`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ business_card_design: id }),
    }).catch(() => { /* preview still works locally */ })
  }

  // ── download ─────────────────────────────────────────────────────────────
  const download = async (side: "front" | "back") => {
    const safeName = fullName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "")
    const filename  = `business-card-${design}-${side}-${safeName}-${EXPORT_W}x${EXPORT_H}.png`
    const data: CardData = { name: fullName, phoneDial, phoneLocal: localNumber, email, avatarUrl, initials }
    const url = await renderCard(side, design, data, EXPORT_W, EXPORT_H)
    const a = document.createElement("a")
    a.href     = url
    a.download = filename
    a.click()
  }

  // ── save contact info ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user?.id) return
    setSaveState("saving")
    setSaveError("")
    try {
      const res = await fetch(`${API_BASE}/api/me/contact`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: toE164(phoneDial, localNumber),
          phone_country_code: countryCode,
          phone_number: localNumber,
          business_card_design: design,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Error ${res.status}`)
      }
      setSaveState("success")
      router.refresh()
      setTimeout(() => setSaveState("idle"), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed")
      setSaveState("error")
    }
  }

  const phoneOk   = isPhoneOk(localNumber)
  const canSave   = phoneOk && saveState !== "saving"
  const inputBase = "w-full px-4 py-3 rounded-xl border text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:ring-4 transition-all duration-200"
  const inputIdle = "border-[#e5e7eb] bg-[#f9fafb] focus:border-[#001f3f] focus:bg-white focus:ring-[#001f3f]/6"
  const inputErr  = "border-rose-300 bg-rose-50 focus:border-rose-500 focus:ring-rose-500/10"
  const inputOk   = "border-emerald-300 bg-white focus:border-emerald-500 focus:ring-emerald-500/10"

  function phoneState()  { if (!localNumber) return "idle"; return phoneOk ? "ok" : "err" }
  function inputCls(st: "idle"|"ok"|"err") {
    if (st === "ok")  return `${inputBase} ${inputOk}`
    if (st === "err") return `${inputBase} ${inputErr}`
    return `${inputBase} ${inputIdle}`
  }

  const shownCard = flipped ? backDataUrl : frontDataUrl

  return (
    <>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="mb-7">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#001f3f] flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-[#d6b357]" />
          </div>
          <div>
            <h1 className="font-['Outfit'] text-xl font-bold text-[#0d1117]">My Business Card</h1>
            <p className="text-sm text-[#9ca3af]">Edit your contact details, pick a design, and download your personalised card</p>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ══ LEFT – Contact form ══════════════════════════════════════════ */}
        <div className="space-y-5">

          {/* Contact details card */}
          <div className="bg-white rounded-2xl border border-[#e4e7ec] shadow-[0_2px_16px_-4px_rgba(0,31,63,0.08)] overflow-hidden">
            <div className="px-6 pt-6 pb-2 border-b border-[#f0f2f5]">
              <h2 className="font-['Outfit'] text-base font-bold text-[#0d1117]">Contact Information</h2>
              <p className="text-xs text-[#9ca3af] mt-0.5">Your name is synced from your profile. Phone and email can be updated.</p>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Full name — read-only */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#374151]">Full Name</label>
                <div className="relative">
                  <input
                    readOnly
                    value={fullName}
                    className={`${inputBase} border-[#e5e7eb] bg-[#f4f6f9] text-[#6b7280] cursor-default`}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider text-[#c4c9d4] bg-[#f0f2f5] rounded px-1.5 py-0.5">
                    Read-only
                  </span>
                </div>
                <p className="text-[11px] text-[#9ca3af]">Change your name in Profile settings.</p>
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label htmlFor="bc-phone" className="text-xs font-semibold uppercase tracking-wider text-[#374151]">
                  Phone Number
                </label>
                <div className="flex gap-2">
                  <PhoneCountrySelect
                    value={countryCode}
                    onChange={setCountryCode}
                    ariaLabel="Phone country calling code"
                    className="px-3 py-3"
                    style={{ minWidth: 90 }}
                  />
                  <div className="relative flex-1">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                    <input
                      id="bc-phone"
                      type="tel"
                      inputMode="numeric"
                      value={localNumber}
                      onChange={handlePhoneChange}
                      placeholder="5xxxxxxxx"
                      className={`${inputCls(phoneState())} pl-10`}
                    />
                    {phoneState() === "ok"  && <CheckCircle2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 pointer-events-none" />}
                    {phoneState() === "err" && <AlertCircle  className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-400   pointer-events-none" />}
                  </div>
                </div>
                {phoneState() === "err" && (
                  <p className="text-xs text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Enter at least 4 digits for the local number
                  </p>
                )}
              </div>

              {/* Email — read-only */}
              <div className="space-y-1.5">
                <label htmlFor="bc-email" className="text-xs font-semibold uppercase tracking-wider text-[#374151]">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                  <input
                    id="bc-email"
                    type="email"
                    readOnly
                    value={email}
                    className={`${inputBase} border-[#e5e7eb] bg-[#f4f6f9] text-[#6b7280] cursor-default pl-10`}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider text-[#c4c9d4] bg-[#f0f2f5] rounded px-1.5 py-0.5">
                    Read-only
                  </span>
                </div>
                <p className="text-[11px] text-[#9ca3af]">Contact support to change your email address.</p>
              </div>
            </div>

            {/* Save footer */}
            <div className="px-6 py-4 border-t border-[#f0f2f5] flex items-center justify-between gap-4">
              {saveState === "success" && (
                <span className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Saved successfully
                </span>
              )}
              {saveState === "error" && (
                <span className="text-sm text-rose-600 flex items-center gap-1.5 truncate">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {saveError}
                </span>
              )}
              {(saveState === "idle" || saveState === "saving") && <span />}

              <button
                onClick={handleSave}
                disabled={!canSave}
                className="ml-auto flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#001f3f] hover:bg-[#002952] text-white text-sm font-bold shadow-[0_4px_12px_-2px_rgba(0,31,63,0.35)] hover:shadow-[0_6px_18px_-2px_rgba(0,31,63,0.45)] hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none transition-all duration-200"
              >
                {saveState === "saving"
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  : <><Save className="w-4 h-4" /> Save Changes</>
                }
              </button>
            </div>
          </div>

          {/* Tips panel */}
          <div className="bg-[#fffdf3] border border-[#f0e8c8] rounded-2xl px-5 py-4 flex gap-3">
            <Info className="w-4 h-4 text-[#d6b357] shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-[#374151]">Tips</p>
              <ul className="text-xs text-[#6b7280] space-y-1 list-disc list-inside">
                <li>Pick a card design — each thumbnail shows exactly how yours will look.</li>
                <li>Your profile photo appears on the card; update it in Profile settings.</li>
                <li>Click the card on the right to flip it and preview the back.</li>
                <li>The preview updates live as you type — no need to save first.</li>
                <li>Downloads are exported at 2100 × 1200 px (print quality).</li>
              </ul>
            </div>
          </div>
        </div>

        {/* ══ RIGHT – Design picker + card preview ═════════════════════════ */}
        <div className="space-y-5">

          {/* Design picker */}
          <div className="bg-white rounded-2xl border border-[#e4e7ec] shadow-[0_2px_16px_-4px_rgba(0,31,63,0.08)] overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-[#f0f2f5] flex items-center gap-2.5">
              <Palette className="w-4 h-4 text-[#d6b357]" />
              <div>
                <h2 className="font-['Outfit'] text-base font-bold text-[#0d1117]">Card Design</h2>
                <p className="text-xs text-[#9ca3af] mt-0.5">Choose a style — the preview and downloads use it</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4">
              {DESIGNS.map((d) => {
                const selected = design === d.id
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => selectDesign(d.id)}
                    aria-pressed={selected}
                    className={`group relative text-left rounded-xl border-2 p-2 transition-all duration-200 ${
                      selected
                        ? "border-[#d6b357] bg-[#fffdf3] shadow-[0_4px_16px_-4px_rgba(214,179,87,0.45)]"
                        : "border-[#e4e7ec] bg-white hover:border-[#c4c9d4] hover:shadow-[0_2px_12px_-4px_rgba(0,31,63,0.15)]"
                    }`}
                  >
                    <div className="rounded-lg overflow-hidden border border-[#eef0f4]" style={{ aspectRatio: "1.75 / 1" }}>
                      {thumbs[d.id] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbs[d.id]} alt={`${d.name} design preview`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#f4f6f9] flex items-center justify-center">
                          <Loader2 className="w-4 h-4 text-[#c4c9d4] animate-spin" />
                        </div>
                      )}
                    </div>
                    <p className={`mt-2 text-xs font-bold ${selected ? "text-[#8a6a10]" : "text-[#374151]"}`}>{d.name}</p>
                    <p className="text-[10px] text-[#9ca3af] leading-snug">{d.tagline}</p>
                    {selected && (
                      <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#d6b357] flex items-center justify-center shadow">
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Flip container */}
          <div className="bg-white rounded-2xl border border-[#e4e7ec] shadow-[0_2px_16px_-4px_rgba(0,31,63,0.08)] overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-[#f0f2f5] flex items-center justify-between">
              <div>
                <h2 className="font-['Outfit'] text-base font-bold text-[#0d1117]">
                  Card Preview — {flipped ? "Back" : "Front"}
                </h2>
                <p className="text-xs text-[#9ca3af] mt-0.5">Click the card or press Flip to see the other side</p>
              </div>
              <button
                onClick={() => setFlipped(f => !f)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#e4e7ec] bg-[#f9fafb] hover:bg-[#f0f4f8] text-sm font-semibold text-[#374151] hover:text-[#001f3f] transition-all"
              >
                <RefreshCcw className="w-4 h-4" /> Flip
              </button>
            </div>

            {/* Perspective scene */}
            <div className="p-5">
              <div
                className="bc-scene w-full cursor-pointer select-none"
                style={{ aspectRatio: "1.75 / 1" }}
                onClick={() => setFlipped(f => !f)}
                role="button"
                aria-label={`Business card, showing ${flipped ? "back" : "front"}. Click to flip.`}
              >
                <div className={`bc-card w-full h-full ${flipped ? "bc-card--flipped" : ""}`}>
                  {/* Front face */}
                  <div className="bc-face bc-face--front w-full h-full rounded-xl overflow-hidden shadow-[0_8px_32px_-4px_rgba(0,31,63,0.20)]">
                    {previewLoading || !frontDataUrl ? (
                      <div className="w-full h-full bg-[#001f3f] rounded-xl flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-[#d6b357] animate-spin" />
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={frontDataUrl} alt="Business card front" className="w-full h-full object-cover rounded-xl" />
                    )}
                  </div>
                  {/* Back face */}
                  <div className="bc-face bc-face--back w-full h-full rounded-xl overflow-hidden shadow-[0_8px_32px_-4px_rgba(0,31,63,0.20)]">
                    {previewLoading || !backDataUrl ? (
                      <div className="w-full h-full bg-[#001428] rounded-xl flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-[#d6b357] animate-spin" />
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={backDataUrl} alt="Business card back" className="w-full h-full object-cover rounded-xl" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Download buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => download("front")}
              disabled={!frontDataUrl}
              className="group flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border-2 border-[#001f3f] text-[#001f3f] text-sm font-bold hover:bg-[#001f3f] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            >
              <Download className="w-4 h-4" />
              Download Front
            </button>
            <button
              onClick={() => download("back")}
              disabled={!backDataUrl}
              className="group flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border-2 border-[#001f3f] text-[#001f3f] text-sm font-bold hover:bg-[#001f3f] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            >
              <Download className="w-4 h-4" />
              Download Back
            </button>
          </div>

          {/* Export quality note */}
          <div className="flex items-start gap-2 bg-[#f8faff] border border-[#e0e7ff] rounded-xl px-4 py-3">
            <Info className="w-4 h-4 text-[#6366f1] shrink-0 mt-0.5" />
            <p className="text-xs text-[#6b7280] leading-relaxed">
              Downloads are exported at <strong className="text-[#374151]">2100 × 1200 px</strong> (print-ready PNG). The preview is lower resolution for performance.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
