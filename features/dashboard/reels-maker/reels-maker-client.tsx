"use client"

/**
 * Reels Maker — generates 9:16 (1080×1920) animated video reels for the four
 * house brands. The intro slide recreates the approved poster formats in
 * public/images (logo, "LOOKING FOR HOMES?/RENT?", feature rows, hero photo
 * blob, CTA bar), followed by Ken Burns photo slides and a branded outro.
 * Logos live in public/logos, jingles in public/reelssounds.
 *
 * Export uses canvas.captureStream + MediaRecorder (MP4 where the browser
 * supports it, WebM otherwise) with the brand jingle mixed in via WebAudio.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Clapperboard, Download, ImagePlus, Loader2, Music, Pause, Play,
  RotateCcw, Trash2, ArrowLeft, ArrowRight,
} from "lucide-react"
import { fetchMyAgentListings, type AgentListing } from "@/lib/agent-listings-service"

// ─── Canvas + timeline constants ───────────────────────────────────────────────

const W = 1080
const H = 1920
const INTRO_S = 5.5
const PHOTO_S = 3.5
const OUTRO_S = 5

// ─── Brands ────────────────────────────────────────────────────────────────────

type Market = "sale" | "rent"

type Brand = {
  key: string
  name: string
  logoSrc: string
  /** White logo art — draw it on a deep-colored chip when the page is light. */
  logoIsWhite: boolean
  jingleSrc: string
  site: string
  /** Deep brand color (headline "LOOKING FOR", panels, footer). */
  primary: string
  /** Loud accent ("HOMES?", CTA pill, price chip). */
  accent: string
  /** Third color used for icon variety (posters use a 3-color icon set). */
  third: string
  /** Light page background for the intro poster. */
  paper: string
  tagline: string
  defaultMarket: Market
}

const BRANDS: Brand[] = [
  {
    key: "filipinohomes",
    name: "Filipino Homes",
    logoSrc: "/logos/Filipinohomes-logo-side-left-white.png",
    logoIsWhite: true,
    jingleSrc: "/reelssounds/filipinohomes-jingle.mp3",
    site: "www.filipinohomes.com",
    primary: "#16337f",
    accent: "#d62828",
    third: "#f2b705",
    paper: "#f7f6f2",
    tagline: "YOUR TRUSTED PARTNER IN REAL ESTATE",
    defaultMarket: "sale",
  },
  {
    key: "homesph",
    name: "Homes PH",
    logoSrc: "/logos/homesph-logo.png",
    logoIsWhite: false,
    jingleSrc: "/reelssounds/homes-ph-jingle.mp3",
    site: "www.homes.ph",
    primary: "#2b35aa",
    accent: "#f5a623",
    third: "#2b35aa",
    paper: "#f6f7fb",
    tagline: "REAL HOMES. REAL POSSIBILITIES.",
    defaultMarket: "sale",
  },
  {
    key: "rentph",
    name: "Rent PH",
    logoSrc: "/logos/RentPh new colored logo.png",
    logoIsWhite: false,
    jingleSrc: "/reelssounds/rent-ph-jingle.mp3",
    site: "www.rent.ph",
    primary: "#2f6fe4",
    accent: "#f7941d",
    third: "#12203c",
    paper: "#f4f7fd",
    tagline: "RENT SMART. LIVE BETTER.",
    defaultMarket: "rent",
  },
  {
    key: "fhipartners",
    name: "FH Global Partners",
    logoSrc: "/logos/global_partner.png",
    logoIsWhite: false,
    jingleSrc: "/reelssounds/fh-global-partners-jingle.mp3",
    site: "www.filipinohomes.com",
    primary: "#001f3f",
    accent: "#d6b357",
    third: "#8b1e1e",
    paper: "#f7f5f0",
    tagline: "YOUR TRUSTED PARTNER IN REAL ESTATE",
    defaultMarket: "sale",
  },
  {
    key: "fhiglobal",
    name: "FHI Global Property",
    logoSrc: "/FHI_Branding_White.png",
    logoIsWhite: true,
    // No dedicated FHI jingle in public/reelssounds yet — reusing the FH
    // Global Partners track; swap the path here when an FHI jingle lands.
    jingleSrc: "/reelssounds/fh-global-partners-jingle.mp3",
    site: "www.fhiglobal.ae",
    primary: "#001f3f",
    accent: "#d6b357",
    third: "#4a6a8f",
    // Used as the DARK page base by this brand's intro (the one dark design).
    paper: "#0b1524",
    tagline: "DUBAI'S PREMIER REAL ESTATE PORTAL",
    defaultMarket: "sale",
  },
  {
    key: "rentsouq",
    name: "Rentsouq AE",
    logoSrc: "/logos/RENTSOUQ_AE LOGO.png",
    logoIsWhite: false,
    // No dedicated Rentsouq jingle yet — reusing the sister brand Rent PH
    // track; swap the path here when a Rentsouq jingle lands.
    jingleSrc: "/reelssounds/rent-ph-jingle.mp3",
    site: "www.rentsouq.ae",
    primary: "#2b6be4",
    accent: "#f7941d",
    third: "#1c355e",
    paper: "#fdf6ec",
    tagline: "UAE'S HOME RENTAL MARKETPLACE",
    defaultMarket: "rent",
  },
]

const SAMPLE_PHOTOS = ["/images/house.jpg", "/images/house 2.jpg", "/images/properties.jpg"]

// ─── Small drawing helpers ─────────────────────────────────────────────────────

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

function easeOutCubic(t: number) {
  const c = Math.max(0, Math.min(1, t))
  return 1 - Math.pow(1 - c, 3)
}

function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  baseSize: number,
  family: string,
  maxWidth: number,
): number {
  let size = baseSize
  ctx.font = `${weight} ${size}px ${family}`
  const w = ctx.measureText(text).width
  if (w > maxWidth) size = Math.max(18, baseSize * (maxWidth / w))
  return size
}

/** Draw an image so it covers the rect (like CSS object-fit: cover). */
function coverImg(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  zoom = 1,
  panX = 0,
  panY = 0,
) {
  const ir = img.width / Math.max(1, img.height)
  const rr2 = w / h
  let dw = w
  let dh = h
  if (ir > rr2) dw = h * ir
  else dh = w / ir
  dw *= zoom
  dh *= zoom
  const dx = x - (dw - w) / 2 + panX
  const dy = y - (dh - h) / 2 + panY
  ctx.drawImage(img, dx, dy, dw, dh)
}

/** Minimal stroke icons (house / shield / search / pin / phone / globe / building / key). */
function miniIcon(
  ctx: CanvasRenderingContext2D,
  kind: string,
  cx: number,
  cy: number,
  r: number,
  color: string,
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = Math.max(3, r * 0.3)
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  if (kind === "house") {
    ctx.beginPath()
    ctx.moveTo(cx - r, cy)
    ctx.lineTo(cx, cy - r)
    ctx.lineTo(cx + r, cy)
    ctx.stroke()
    ctx.strokeRect(cx - r * 0.62, cy - r * 0.05, r * 1.24, r * 1.02)
  } else if (kind === "shield") {
    ctx.beginPath()
    ctx.moveTo(cx, cy - r)
    ctx.lineTo(cx + r * 0.85, cy - r * 0.55)
    ctx.quadraticCurveTo(cx + r * 0.85, cy + r * 0.55, cx, cy + r)
    ctx.quadraticCurveTo(cx - r * 0.85, cy + r * 0.55, cx - r * 0.85, cy - r * 0.55)
    ctx.closePath()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx - r * 0.35, cy)
    ctx.lineTo(cx - r * 0.05, cy + r * 0.3)
    ctx.lineTo(cx + r * 0.42, cy - r * 0.3)
    ctx.stroke()
  } else if (kind === "search") {
    ctx.beginPath()
    ctx.arc(cx - r * 0.15, cy - r * 0.15, r * 0.62, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx + r * 0.35, cy + r * 0.35)
    ctx.lineTo(cx + r * 0.85, cy + r * 0.85)
    ctx.stroke()
  } else if (kind === "pin") {
    ctx.beginPath()
    ctx.arc(cx, cy - r * 0.25, r * 0.6, Math.PI * 0.95, Math.PI * 2.05)
    ctx.lineTo(cx, cy + r * 0.85)
    ctx.closePath()
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy - r * 0.28, r * 0.2, 0, Math.PI * 2)
    ctx.fill()
  } else if (kind === "phone") {
    rr(ctx, cx - r * 0.45, cy - r * 0.85, r * 0.9, r * 1.7, r * 0.22)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx - r * 0.16, cy + r * 0.55)
    ctx.lineTo(cx + r * 0.16, cy + r * 0.55)
    ctx.stroke()
  } else if (kind === "globe") {
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2)
    ctx.stroke()
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(0.45, 1)
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    ctx.beginPath()
    ctx.moveTo(cx - r * 0.8, cy)
    ctx.lineTo(cx + r * 0.8, cy)
    ctx.stroke()
  } else if (kind === "building") {
    ctx.strokeRect(cx - r * 0.55, cy - r * 0.85, r * 1.1, r * 1.7)
    for (let ry = 0; ry < 3; ry++)
      for (let cxi = 0; cxi < 2; cxi++) {
        ctx.strokeRect(
          cx - r * 0.32 + cxi * r * 0.4,
          cy - r * 0.6 + ry * r * 0.45,
          r * 0.22,
          r * 0.22,
        )
      }
  } else {
    // key
    ctx.beginPath()
    ctx.arc(cx - r * 0.35, cy, r * 0.42, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx + r * 0.05, cy)
    ctx.lineTo(cx + r * 0.85, cy)
    ctx.moveTo(cx + r * 0.55, cy)
    ctx.lineTo(cx + r * 0.55, cy + r * 0.35)
    ctx.moveTo(cx + r * 0.85, cy)
    ctx.lineTo(cx + r * 0.85, cy + r * 0.35)
    ctx.stroke()
  }
  ctx.restore()
}

/** Draw the brand logo inside a max box, on a deep chip if the art is white. */
function drawLogo(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement | null,
  brand: Brand,
  x: number,
  y: number,
  maxW: number,
  maxH: number,
  onLightPage: boolean,
) {
  if (!logo) return
  const ratio = logo.width / Math.max(1, logo.height)
  let lw = maxW
  let lh = lw / ratio
  if (lh > maxH) {
    lh = maxH
    lw = lh * ratio
  }
  if (brand.logoIsWhite && onLightPage) {
    const pad = 26
    ctx.save()
    ctx.fillStyle = brand.primary
    rr(ctx, x - pad, y - pad, lw + pad * 2, lh + pad * 2, 22)
    ctx.fill()
    ctx.restore()
  }
  ctx.drawImage(logo, x, y, lw, lh)
}

// ─── Slide renderers ───────────────────────────────────────────────────────────

type ReelInputs = {
  market: Market
  title: string
  location: string
  price: string
  agentName: string
  phone: string
}

type ReelAssets = {
  logo: HTMLImageElement | null
  photos: HTMLImageElement[]
  font: string
}

const FEATURES_SALE = [
  { icon: "house", title: "WIDE SELECTION", body: "Homes, condos & lots nationwide." },
  { icon: "shield", title: "TRUSTED & SECURE", body: "Verified listings, safe transactions." },
  { icon: "search", title: "EASY TO SEARCH", body: "By location, price, or type." },
]

const FEATURES_RENT = [
  { icon: "house", title: "WIDE CHOICES", body: "Apartments, houses, condos & more." },
  { icon: "shield", title: "TRUSTED & SECURE", body: "Verified listings, peace of mind." },
  { icon: "pin", title: "EASY TO FIND", body: "By location, price, or type." },
]

const CATEGORIES = [
  { icon: "house", label: "HOUSES" },
  { icon: "building", label: "APARTMENTS" },
  { icon: "building", label: "CONDOS" },
  { icon: "pin", label: "LOTS & LANDS" },
]

/** Filipino Homes intro — circle-blob poster (filipino homes poster.png). */
function drawIntroFilipinoHomes(
  ctx: CanvasRenderingContext2D,
  t01: number,
  brand: Brand,
  inputs: ReelInputs,
  assets: ReelAssets,
) {
  const F = assets.font
  const isRent = inputs.market === "rent"
  const ink = "#1c2430"

  // Paper background with a soft top-to-bottom tint + dot grid accent.
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, "#ffffff")
  g.addColorStop(1, brand.paper)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = "rgba(110,116,130,0.22)"
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 6; c++) {
      ctx.beginPath()
      ctx.arc(46 + c * 24, H - 200 + r * 24, 4, 0, Math.PI * 2)
      ctx.fill()
    }

  // ── Hero photo in a big rounded blob on the right (like the posters). ──
  const he = easeOutCubic((t01 - 0.02) / 0.26)
  if (he > 0) {
    const ox = (1 - he) * 300
    const cx = W - 150 + ox
    const cy = 630
    const rad = 585
    // Accent ring arcs behind the blob.
    ctx.save()
    ctx.globalAlpha = Math.min(1, he * 1.2)
    ctx.strokeStyle = brand.accent
    ctx.lineWidth = 40
    ctx.beginPath()
    ctx.arc(cx, cy, rad + 34, Math.PI * 0.62, Math.PI * 1.25)
    ctx.stroke()
    ctx.strokeStyle = brand.third
    ctx.lineWidth = 46
    ctx.beginPath()
    ctx.arc(cx, cy, rad + 40, Math.PI * 0.28, Math.PI * 0.58)
    ctx.stroke()
    // Photo clipped in the circle with a white rim.
    ctx.beginPath()
    ctx.arc(cx, cy, rad, 0, Math.PI * 2)
    ctx.save()
    ctx.clip()
    const photo = assets.photos[0]
    if (photo) {
      coverImg(ctx, photo, cx - rad, cy - rad, rad * 2, rad * 2, 1 + 0.05 * t01)
    } else {
      const pg = ctx.createLinearGradient(cx - rad, cy - rad, cx + rad, cy + rad)
      pg.addColorStop(0, brand.primary)
      pg.addColorStop(1, brand.accent)
      ctx.fillStyle = pg
      ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2)
    }
    ctx.restore()
    ctx.strokeStyle = "#ffffff"
    ctx.lineWidth = 14
    ctx.beginPath()
    ctx.arc(cx, cy, rad - 5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  // ── Logo, top-left. ──
  ctx.save()
  ctx.globalAlpha = Math.min(1, t01 / 0.18)
  drawLogo(ctx, assets.logo, brand, 66, 70, 400, 130, true)
  ctx.restore()

  // ── Headline: LOOKING / FOR / HOMES? (or RENT?). ──
  const words: Array<{ text: string; color: string; y: number; size: number; delay: number }> = [
    { text: "LOOKING", color: brand.primary, y: 470, size: 128, delay: 0.14 },
    { text: "FOR", color: brand.primary, y: 610, size: 128, delay: 0.22 },
    {
      text: isRent ? "RENT?" : "HOMES?",
      color: brand.accent,
      y: 775,
      size: 150,
      delay: 0.3,
    },
  ]
  for (const wd of words) {
    const we = easeOutCubic((t01 - wd.delay) / 0.24)
    if (we <= 0) continue
    ctx.save()
    ctx.globalAlpha = Math.min(1, we * 1.4)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    const size = fitFont(ctx, wd.text, 900, wd.size, F, 470)
    ctx.font = `900 ${size}px ${F}`
    ctx.fillStyle = wd.color
    ctx.fillText(wd.text, 66 - (1 - we) * 60, wd.y)
    ctx.restore()
  }
  // Small two-tone divider under the headline.
  const de = easeOutCubic((t01 - 0.38) / 0.2)
  if (de > 0) {
    ctx.fillStyle = brand.primary
    ctx.fillRect(70, 815, 62 * de, 10)
    ctx.fillStyle = brand.accent
    ctx.fillRect(70 + 62 * de, 815, 62 * de, 10)
  }

  // ── Subtitle. ──
  const se = easeOutCubic((t01 - 0.42) / 0.22)
  if (se > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, se * 1.4)
    ctx.textAlign = "left"
    ctx.font = `600 47px ${F}`
    ctx.fillStyle = ink
    const sub1 = isRent ? "Find your next home" : "Discover places you'll"
    const sub2 = isRent ? "easily and securely." : "love to live in."
    ctx.fillText(sub1, 70, 910)
    ctx.fillText(sub2, 70, 972)
    ctx.restore()
  }

  // ── Badge chip riding the photo blob's lower edge. ──
  const bce = easeOutCubic((t01 - 0.5) / 0.22)
  if (bce > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, bce * 1.4)
    const bw = 470
    const bx = W - bw - 46
    const by = 1108 + (1 - bce) * 36
    ctx.shadowColor = "rgba(15,23,42,0.35)"
    ctx.shadowBlur = 18
    ctx.fillStyle = brand.primary
    rr(ctx, bx, by, bw, 104, 26)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = "#ffffff"
    rr(ctx, bx + 16, by + 18, 68, 68, 16)
    ctx.fill()
    miniIcon(ctx, "house", bx + 50, by + 52, 18, brand.primary)
    ctx.textAlign = "left"
    ctx.font = `700 33px ${F}`
    ctx.fillStyle = "#ffffff"
    ctx.fillText("Your next home is", bx + 104, by + 46)
    const part1 = "just a "
    ctx.fillText(part1, bx + 104, by + 86)
    ctx.fillStyle = brand.logoIsWhite ? brand.third : brand.accent
    ctx.fillText("search away.", bx + 104 + ctx.measureText(part1).width, by + 86)
    ctx.restore()
  }

  // ── Feature rows (big titles — no tiny copy). ──
  const feats = isRent ? FEATURES_RENT : FEATURES_SALE
  const featColors = [brand.primary, brand.accent, brand.third]
  feats.forEach((f, i) => {
    const fe = easeOutCubic((t01 - 0.54 - i * 0.07) / 0.22)
    if (fe <= 0) return
    ctx.save()
    ctx.globalAlpha = Math.min(1, fe * 1.4)
    const fy = 1268 + i * 156 + (1 - fe) * 30
    ctx.fillStyle = featColors[i % featColors.length]
    ctx.beginPath()
    ctx.arc(120, fy, 52, 0, Math.PI * 2)
    ctx.fill()
    miniIcon(ctx, f.icon, 120, fy, 24, "#ffffff")
    ctx.textAlign = "left"
    ctx.font = `800 45px ${F}`
    ctx.fillStyle = brand.primary
    ctx.fillText(f.title, 208, fy - 6)
    ctx.font = `500 33px ${F}`
    ctx.fillStyle = "#4b5563"
    ctx.fillText(f.body, 208, fy + 42)
    if (i < feats.length - 1) {
      ctx.strokeStyle = "rgba(100,110,125,0.25)"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(208, fy + 74)
      ctx.lineTo(620, fy + 74)
      ctx.stroke()
    }
    ctx.restore()
  })

  // ── Category strip (white card). ──
  const ce = easeOutCubic((t01 - 0.68) / 0.24)
  if (ce > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, ce * 1.3)
    const cy0 = 1478 + (1 - ce) * 40
    ctx.shadowColor = "rgba(15,23,42,0.16)"
    ctx.shadowBlur = 22
    ctx.fillStyle = "#ffffff"
    rr(ctx, 44, cy0, W - 88, 250, 30)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.textAlign = "center"
    ctx.font = `800 33px ${F}`
    ctx.fillStyle = brand.primary
    ctx.fillText("EXPLORE PROPERTIES THAT FIT YOUR LIFESTYLE", W / 2, cy0 + 60)
    const colW = (W - 88) / 4
    CATEGORIES.forEach((c, i) => {
      const ccx = 44 + colW * i + colW / 2
      ctx.fillStyle = `${brand.primary}18`
      ctx.beginPath()
      ctx.arc(ccx, cy0 + 128, 40, 0, Math.PI * 2)
      ctx.fill()
      miniIcon(ctx, c.icon, ccx, cy0 + 128, 19, brand.primary)
      ctx.font = `800 27px ${F}`
      ctx.fillStyle = "#1c2430"
      ctx.fillText(c.label, ccx, cy0 + 212)
      if (i < CATEGORIES.length - 1) {
        ctx.strokeStyle = "rgba(100,110,125,0.2)"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(44 + colW * (i + 1), cy0 + 96)
        ctx.lineTo(44 + colW * (i + 1), cy0 + 220)
        ctx.stroke()
      }
    })
    ctx.restore()
  }

  // ── Footer CTA bar. ──
  const fe2 = easeOutCubic((t01 - 0.78) / 0.2)
  if (fe2 > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, fe2 * 1.3)
    const fy = 1772 + (1 - fe2) * 50
    ctx.fillStyle = brand.primary
    rr(ctx, 0, fy, W, H - fy + 40, 0)
    ctx.fill()
    // Accent pill on the left.
    ctx.fillStyle = brand.accent
    rr(ctx, 44, fy + 26, 500, 96, 48)
    ctx.fill()
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.arc(104, fy + 74, 34, 0, Math.PI * 2)
    ctx.fill()
    miniIcon(ctx, "search", 104, fy + 74, 16, brand.accent)
    ctx.textAlign = "left"
    ctx.font = `800 31px ${F}`
    ctx.fillStyle = "#ffffff"
    ctx.fillText("FIND YOUR NEXT", 156, fy + 64)
    ctx.fillText(isRent ? "RENTAL TODAY!" : "HOME TODAY!", 156, fy + 102)
    // Website on the right.
    ctx.beginPath()
    ctx.arc(608, fy + 74, 34, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(255,255,255,0.16)"
    ctx.fill()
    miniIcon(ctx, "globe", 608, fy + 74, 17, "#ffffff")
    ctx.font = `600 26px ${F}`
    ctx.fillStyle = "rgba(255,255,255,0.85)"
    ctx.fillText("VISIT US NOW", 660, fy + 58)
    const siteSize = fitFont(ctx, brand.site, 800, 40, F, W - 660 - 40)
    ctx.font = `800 ${siteSize}px ${F}`
    ctx.fillStyle = "#ffffff"
    ctx.fillText(brand.site, 660, fy + 106)
    ctx.restore()
  }
}

/** Photo slide — full-bleed Ken Burns with big listing text. */
function drawPhoto(
  ctx: CanvasRenderingContext2D,
  t01: number,
  brand: Brand,
  inputs: ReelInputs,
  assets: ReelAssets,
  photoIdx: number,
) {
  const F = assets.font
  const img = assets.photos[photoIdx]
  const isRent = inputs.market === "rent"

  ctx.fillStyle = "#0b0f16"
  ctx.fillRect(0, 0, W, H)
  if (img) {
    const zoom = 1.06 + 0.1 * t01
    const panX = (photoIdx % 2 === 0 ? -1 : 1) * 40 * t01
    coverImg(ctx, img, 0, 0, W, H, zoom, panX, 0)
  }

  // Bottom gradient for legibility.
  const grad = ctx.createLinearGradient(0, H - 760, 0, H)
  grad.addColorStop(0, "rgba(8,12,20,0)")
  grad.addColorStop(1, "rgba(8,12,20,0.88)")
  ctx.fillStyle = grad
  ctx.fillRect(0, H - 760, W, 760)

  // Hook badge, top-left.
  const be = easeOutCubic(t01 / 0.2)
  ctx.save()
  ctx.globalAlpha = Math.min(1, be * 1.5)
  ctx.fillStyle = brand.accent
  const hook = isRent ? "FOR RENT" : "FOR SALE"
  ctx.font = `900 44px ${F}`
  const hw = ctx.measureText(hook).width
  rr(ctx, 56, 70 + (1 - be) * -30, hw + 76, 92, 46)
  ctx.fill()
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillStyle = "#ffffff"
  ctx.fillText(hook, 94, 118 + (1 - be) * -30)
  ctx.restore()
  ctx.textBaseline = "alphabetic"

  // Logo chip, top-right.
  ctx.save()
  ctx.globalAlpha = Math.min(1, t01 / 0.2)
  if (assets.logo) {
    const boxW = 300
    const ratio = assets.logo.width / Math.max(1, assets.logo.height)
    let lw = boxW
    let lh = lw / ratio
    if (lh > 100) {
      lh = 100
      lw = lh * ratio
    }
    if (brand.logoIsWhite) {
      ctx.drawImage(assets.logo, W - lw - 56, 70, lw, lh)
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.94)"
      rr(ctx, W - lw - 88, 62, lw + 48, lh + 40, 20)
      ctx.fill()
      ctx.drawImage(assets.logo, W - lw - 64, 82, lw, lh)
    }
  }
  ctx.restore()

  // Listing text block.
  const te = easeOutCubic((t01 - 0.14) / 0.26)
  if (te > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, te * 1.4)
    ctx.textAlign = "left"
    const baseY = H - 190 + (1 - te) * 60

    if (inputs.price.trim()) {
      ctx.fillStyle = brand.accent
      ctx.font = `900 60px ${F}`
      const pw = ctx.measureText(inputs.price.trim()).width
      rr(ctx, 56, baseY - 336, pw + 72, 108, 24)
      ctx.fill()
      ctx.fillStyle = "#ffffff"
      ctx.fillText(inputs.price.trim(), 92, baseY - 260)
    }

    const title = inputs.title.trim() || (isRent ? "Your Next Rental" : "Your Dream Home")
    const tSize = fitFont(ctx, title, 900, 76, F, W - 120)
    ctx.font = `900 ${tSize}px ${F}`
    ctx.fillStyle = "#ffffff"
    ctx.fillText(title, 56, baseY - 120)

    if (inputs.location.trim()) {
      miniIcon(ctx, "pin", 78, baseY - 40, 24, brand.accent)
      const lSize = fitFont(ctx, inputs.location.trim(), 600, 44, F, W - 200)
      ctx.font = `600 ${lSize}px ${F}`
      ctx.fillStyle = "rgba(255,255,255,0.92)"
      ctx.fillText(inputs.location.trim(), 120, baseY - 26)
    }
    ctx.restore()
  }

  // Photo counter dots.
  const total = assets.photos.length
  if (total > 1) {
    ctx.save()
    for (let i = 0; i < total; i++) {
      ctx.fillStyle = i === photoIdx ? brand.accent : "rgba(255,255,255,0.4)"
      ctx.beginPath()
      ctx.arc(W / 2 - ((total - 1) * 34) / 2 + i * 34, H - 60, i === photoIdx ? 11 : 8, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
}

/** Outro — deep brand page with logo, CTA, agent contact and website. */
function drawOutro(
  ctx: CanvasRenderingContext2D,
  t01: number,
  brand: Brand,
  inputs: ReelInputs,
  assets: ReelAssets,
) {
  const F = assets.font
  const isRent = inputs.market === "rent"

  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, brand.primary)
  g.addColorStop(1, "#060b14")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = "rgba(255,255,255,0.1)"
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 6; c++) {
      ctx.beginPath()
      ctx.arc(46 + c * 24, 90 + r * 24, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  ctx.strokeStyle = "rgba(255,255,255,0.08)"
  ctx.lineWidth = 3
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(W + 40, H - 120, 220 + i * 90, Math.PI * 0.6, Math.PI * 1.45)
    ctx.stroke()
  }

  // Logo.
  const le = easeOutCubic(t01 / 0.24)
  if (le > 0 && assets.logo) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, le * 1.3)
    const ratio = assets.logo.width / Math.max(1, assets.logo.height)
    let lw = 620
    let lh = lw / ratio
    if (lh > 300) {
      lh = 300
      lw = lh * ratio
    }
    const ly = 300 + (1 - le) * 40
    if (!brand.logoIsWhite) {
      ctx.fillStyle = "rgba(255,255,255,0.96)"
      rr(ctx, (W - lw) / 2 - 40, ly - 36, lw + 80, lh + 72, 34)
      ctx.fill()
    }
    ctx.drawImage(assets.logo, (W - lw) / 2, ly, lw, lh)
    ctx.restore()
  }

  // CTA headline.
  const ce = easeOutCubic((t01 - 0.2) / 0.26)
  if (ce > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, ce * 1.4)
    ctx.textAlign = "center"
    ctx.font = `900 96px ${F}`
    ctx.fillStyle = "#ffffff"
    ctx.fillText("FIND YOUR NEXT", W / 2, 850 + (1 - ce) * 50)
    ctx.fillStyle = brand.accent
    ctx.fillText(isRent ? "RENTAL TODAY!" : "HOME TODAY!", W / 2, 970 + (1 - ce) * 50)
    ctx.restore()
  }

  // Agent contact card.
  const ae = easeOutCubic((t01 - 0.36) / 0.26)
  if (ae > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, ae * 1.4)
    const cy0 = 1120 + (1 - ae) * 50
    ctx.fillStyle = "rgba(255,255,255,0.08)"
    rr(ctx, 90, cy0, W - 180, 330, 36)
    ctx.fill()
    ctx.strokeStyle = "rgba(255,255,255,0.18)"
    ctx.lineWidth = 2
    rr(ctx, 90, cy0, W - 180, 330, 36)
    ctx.stroke()
    ctx.textAlign = "center"
    if (inputs.agentName.trim()) {
      const nSize = fitFont(ctx, inputs.agentName.trim(), 800, 58, F, W - 300)
      ctx.font = `800 ${nSize}px ${F}`
      ctx.fillStyle = "#ffffff"
      ctx.fillText(inputs.agentName.trim(), W / 2, cy0 + 108)
      ctx.font = `600 30px ${F}`
      ctx.fillStyle = "rgba(255,255,255,0.65)"
      ctx.fillText(isRent ? "YOUR RENTAL SPECIALIST" : "YOUR REAL ESTATE PARTNER", W / 2, cy0 + 160)
    }
    if (inputs.phone.trim()) {
      const py = cy0 + 250
      const pSize = fitFont(ctx, inputs.phone.trim(), 900, 66, F, W - 420)
      ctx.font = `900 ${pSize}px ${F}`
      const pw = ctx.measureText(inputs.phone.trim()).width
      const startX = W / 2 - (pw + 90) / 2
      ctx.fillStyle = brand.accent
      ctx.beginPath()
      ctx.arc(startX + 34, py - 22, 34, 0, Math.PI * 2)
      ctx.fill()
      miniIcon(ctx, "phone", startX + 34, py - 22, 16, "#ffffff")
      ctx.textAlign = "left"
      ctx.fillStyle = brand.accent
      ctx.fillText(inputs.phone.trim(), startX + 90, py)
    }
    ctx.restore()
  }

  // Website + tagline.
  const we = easeOutCubic((t01 - 0.5) / 0.24)
  if (we > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, we * 1.4)
    ctx.textAlign = "center"
    ctx.font = `600 32px ${F}`
    ctx.fillStyle = "rgba(255,255,255,0.7)"
    ctx.fillText("VISIT US NOW", W / 2, 1580)
    const sSize = fitFont(ctx, brand.site, 900, 72, F, W - 160)
    ctx.font = `900 ${sSize}px ${F}`
    ctx.fillStyle = "#ffffff"
    ctx.fillText(brand.site, W / 2, 1668)
    const spaced = brand.tagline.split("").join(" ")
    const tSize = fitFont(ctx, spaced, 700, 30, F, W - 140)
    ctx.font = `700 ${tSize}px ${F}`
    ctx.fillStyle = brand.accent
    ctx.fillText(spaced, W / 2, 1790)
    ctx.restore()
  }
}

/** Intro — Homes PH poster: angular hero on blue corner wedges, amber dots, blue "REAL HOMES." panel. */
function drawIntroHomesPh(
  ctx: CanvasRenderingContext2D,
  t01: number,
  brand: Brand,
  inputs: ReelInputs,
  assets: ReelAssets,
) {
  const F = assets.font
  const isRent = inputs.market === "rent"

  // Paper background with a soft top-to-bottom tint.
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, "#ffffff")
  g.addColorStop(1, brand.paper)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // ── Hero shape geometry (rounded pentagon on the right, poster-style). ──
  const hx0 = 585 // left edge — everything left of this (minus rim) is text-safe
  const hx1 = 1036
  const hyTL = 545 // left-top corner y
  const hyTR = 285 // right-top corner y (diagonal top edge)
  const hyB = 1120 // where the sides start curving to the bottom apex
  const hay = 1330 // bottom apex y
  const hax = (hx0 + hx1) / 2
  const heroPath = () => {
    ctx.beginPath()
    ctx.moveTo(hx0, hyTL + 46)
    ctx.quadraticCurveTo(hx0, hyTL, hx0 + 52, hyTL - 30) // rounded left-top corner
    ctx.lineTo(hx1 - 56, hyTR + 33) // diagonal top edge
    ctx.quadraticCurveTo(hx1, hyTR, hx1, hyTR + 52) // rounded top-right corner
    ctx.lineTo(hx1, hyB)
    ctx.quadraticCurveTo(hx1, hay, hax, hay) // rounded bottom apex
    ctx.quadraticCurveTo(hx0, hay, hx0, hyB)
    ctx.closePath()
  }
  const dotGrid = (x0: number, y0: number, cols: number, rows: number) => {
    ctx.fillStyle = brand.accent
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        ctx.beginPath()
        ctx.arc(x0 + c * 26, y0 + r * 26, 5, 0, Math.PI * 2)
        ctx.fill()
      }
  }

  // ── Blue corner wedges + amber dot grids (poster backdrop). ──
  const we0 = easeOutCubic(t01 / 0.18)
  if (we0 > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, we0 * 1.2)
    ctx.fillStyle = brand.primary
    ctx.beginPath() // top-right wedge
    ctx.moveTo(598, 0)
    ctx.lineTo(W, 0)
    ctx.lineTo(W, 642)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath() // bottom-right wedge (sits behind panel-side photo cards)
    ctx.moveTo(W, 1012)
    ctx.lineTo(W, 1706)
    ctx.lineTo(510, 1706)
    ctx.closePath()
    ctx.fill()
    dotGrid(886, 84, 4, 4) // amber dots on the top-right wedge
    dotGrid(52, 1702, 5, 3) // amber dots near the bottom-left
    ctx.restore()
  }

  // ── Hero photo in the angular shape, sliding in from the right. ──
  const he = easeOutCubic((t01 - 0.04) / 0.26)
  if (he > 0) {
    ctx.save()
    ctx.translate((1 - he) * 260, 0)
    ctx.globalAlpha = Math.min(1, he * 1.2)
    ctx.shadowColor = "rgba(15,23,42,0.3)"
    ctx.shadowBlur = 30
    ctx.fillStyle = "#ffffff"
    heroPath()
    ctx.fill()
    ctx.shadowBlur = 0
    heroPath()
    ctx.save()
    ctx.clip()
    const hero = assets.photos[0]
    if (hero) {
      coverImg(ctx, hero, hx0 - 4, 272, hx1 - hx0 + 8, hay - 268, 1 + 0.05 * t01)
    } else {
      const pg = ctx.createLinearGradient(hx0, 272, hx1, hay)
      pg.addColorStop(0, brand.primary)
      pg.addColorStop(1, brand.accent)
      ctx.fillStyle = pg
      ctx.fillRect(hx0 - 4, 268, hx1 - hx0 + 8, hay - 264)
    }
    ctx.restore()
    ctx.strokeStyle = "#ffffff"
    ctx.lineWidth = 14
    heroPath()
    ctx.stroke()
    ctx.restore()
  }

  // ── Logo, top-left, drawn large on the light page. ──
  ctx.save()
  ctx.globalAlpha = Math.min(1, t01 / 0.16)
  drawLogo(ctx, assets.logo, brand, 66, 74, 430, 150, true)
  ctx.restore()

  // ── Headline: LOOKING / FOR in blue, HOMES?/RENT? in amber. ──
  const lookSize = fitFont(ctx, "LOOKING", 900, 118, F, 495)
  const bigWord = isRent ? "RENT?" : "HOMES?"
  const bigSize = fitFont(ctx, bigWord, 900, 142, F, 495)
  const words: Array<{ text: string; color: string; y: number; size: number; delay: number }> = [
    { text: "LOOKING", color: brand.primary, y: 430, size: lookSize, delay: 0.14 },
    { text: "FOR", color: brand.primary, y: 560, size: lookSize, delay: 0.21 },
    { text: bigWord, color: brand.accent, y: 724, size: bigSize, delay: 0.28 },
  ]
  for (const wd of words) {
    const we = easeOutCubic((t01 - wd.delay) / 0.22)
    if (we <= 0) continue
    ctx.save()
    ctx.globalAlpha = Math.min(1, we * 1.4)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    ctx.font = `900 ${wd.size}px ${F}`
    ctx.fillStyle = wd.color
    ctx.fillText(wd.text, 66 - (1 - we) * 60, wd.y)
    ctx.restore()
  }
  // Two-tone divider under the headline.
  const de = easeOutCubic((t01 - 0.36) / 0.18)
  if (de > 0) {
    ctx.fillStyle = brand.primary
    ctx.fillRect(70, 758, 64 * de, 10)
    ctx.fillStyle = brand.accent
    ctx.fillRect(70 + 64 * de, 758, 64 * de, 10)
  }

  // ── Subtitle (two big lines, poster copy). ──
  const se = easeOutCubic((t01 - 0.4) / 0.2)
  if (se > 0) {
    const sub1 = isRent ? "Find your next home." : "Find the right place."
    const sub2 = "Live the life you deserve."
    const sSize = Math.min(
      fitFont(ctx, sub1, 600, 42, F, 495),
      fitFont(ctx, sub2, 600, 42, F, 495),
    )
    ctx.save()
    ctx.globalAlpha = Math.min(1, se * 1.4)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    ctx.font = `600 ${sSize}px ${F}`
    ctx.fillStyle = brand.primary
    const sy = (1 - se) * 24
    ctx.fillText(sub1, 66, 832 + sy)
    ctx.fillText(sub2, 66, 888 + sy)
    ctx.restore()
  }

  // ── Feature rows with alternating blue/amber icon circles. ──
  const splitBody = (body: string): [string, string] => {
    const parts = body.split(" ")
    const mid = Math.ceil(parts.length / 2)
    return [parts.slice(0, mid).join(" "), parts.slice(mid).join(" ")]
  }
  const feats = isRent ? FEATURES_RENT : FEATURES_SALE
  const featColors = [brand.primary, brand.accent, brand.primary]
  feats.forEach((f, i) => {
    const fe = easeOutCubic((t01 - 0.48 - i * 0.06) / 0.2)
    if (fe <= 0) return
    ctx.save()
    ctx.globalAlpha = Math.min(1, fe * 1.4)
    const fy = 985 + i * 150 + (1 - fe) * 30
    ctx.fillStyle = featColors[i % featColors.length]
    ctx.beginPath()
    ctx.arc(118, fy, 48, 0, Math.PI * 2)
    ctx.fill()
    miniIcon(ctx, f.icon, 118, fy, 22, "#ffffff")
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    const tSize = fitFont(ctx, f.title, 800, 40, F, 352) // 352 keeps text clear of the hero edge
    ctx.font = `800 ${tSize}px ${F}`
    ctx.fillStyle = brand.primary
    ctx.fillText(f.title, 208, fy - 12)
    const [b1, b2] = splitBody(f.body)
    const bSize = Math.min(
      fitFont(ctx, b1, 500, 29, F, 352),
      fitFont(ctx, b2, 500, 29, F, 352),
    )
    ctx.font = `500 ${bSize}px ${F}`
    ctx.fillStyle = "#4b5563"
    ctx.fillText(b1, 208, fy + 28)
    ctx.fillText(b2, 208, fy + 62)
    if (i < feats.length - 1) {
      ctx.strokeStyle = "rgba(100,110,125,0.25)"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(208, fy + 92)
      ctx.lineTo(560, fy + 92)
      ctx.stroke()
    }
    ctx.restore()
  })

  // ── Signature blue panel: REAL HOMES. REAL POSSIBILITIES. + categories. ──
  const pe = easeOutCubic((t01 - 0.58) / 0.22)
  if (pe > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, pe * 1.3)
    const py = 1395 + (1 - pe) * 40
    ctx.shadowColor = "rgba(15,23,42,0.22)"
    ctx.shadowBlur = 24
    ctx.fillStyle = brand.primary
    rr(ctx, 44, py, 670, 295, 34)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    ctx.font = `900 46px ${F}`
    ctx.fillStyle = "#ffffff"
    ctx.fillText("REAL HOMES.", 84, py + 70)
    const pSize = fitFont(ctx, "REAL POSSIBILITIES.", 900, 46, F, 586)
    ctx.font = `900 ${pSize}px ${F}`
    const prefix = "REAL "
    ctx.fillText(prefix, 84, py + 128)
    ctx.fillStyle = brand.accent
    ctx.fillText("POSSIBILITIES.", 84 + ctx.measureText(prefix).width, py + 128)
    ctx.fillRect(84, py + 146, 150, 7) // small amber underline
    // 4 white icon+label categories in a 2×2 grid (labels stay >= 26px).
    const catLabels = ["APARTMENTS", "HOUSES", "CONDOS", "LOTS & SPACES"]
    ctx.textBaseline = "middle"
    CATEGORIES.forEach((c, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const bx = 84 + col * 290
      const bcy = py + 200 + row * 58
      ctx.fillStyle = "rgba(255,255,255,0.18)"
      ctx.beginPath()
      ctx.arc(bx + 24, bcy, 24, 0, Math.PI * 2)
      ctx.fill()
      miniIcon(ctx, c.icon, bx + 24, bcy, 13, "#ffffff")
      const lSize = fitFont(ctx, catLabels[i], 800, 27, F, col === 0 ? 200 : 246)
      ctx.font = `800 ${lSize}px ${F}`
      ctx.fillStyle = "#ffffff"
      ctx.fillText(catLabels[i], bx + 62, bcy)
    })
    ctx.textBaseline = "alphabetic"
    ctx.restore()
  }

  // ── Up to 2 white-rimmed photo cards to the panel's right. ──
  const extras = [assets.photos[1], assets.photos[2]].filter(
    (p): p is HTMLImageElement => Boolean(p),
  )
  const cardH = extras.length === 1 ? 293 : 139
  extras.forEach((photo, idx) => {
    const ce = easeOutCubic((t01 - 0.61 - idx * 0.05) / 0.18)
    if (ce <= 0) return
    ctx.save()
    ctx.globalAlpha = Math.min(1, ce * 1.4)
    const cx = 736 + (1 - ce) * 70
    const cy0 = 1395 + idx * (cardH + 15)
    ctx.shadowColor = "rgba(15,23,42,0.3)"
    ctx.shadowBlur = 18
    ctx.fillStyle = "#ffffff"
    rr(ctx, cx, cy0, 300, cardH, 24)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.save()
    rr(ctx, cx + 9, cy0 + 9, 282, cardH - 18, 16)
    ctx.clip()
    coverImg(ctx, photo, cx + 9, cy0 + 9, 282, cardH - 18, 1.02 + 0.04 * t01)
    ctx.restore()
    ctx.restore()
  })

  // ── Footer: amber CTA pill + website on the light page. ──
  const fe2 = easeOutCubic((t01 - 0.66) / 0.19)
  if (fe2 > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, fe2 * 1.3)
    const fy = 1770 + (1 - fe2) * 46
    ctx.shadowColor = "rgba(15,23,42,0.18)"
    ctx.shadowBlur = 16
    ctx.fillStyle = brand.accent
    rr(ctx, 44, fy, 560, 100, 50)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.arc(108, fy + 50, 36, 0, Math.PI * 2)
    ctx.fill()
    miniIcon(ctx, "search", 108, fy + 50, 17, brand.accent)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    ctx.font = `800 31px ${F}`
    ctx.fillStyle = "#ffffff"
    ctx.fillText("FIND YOUR NEXT", 160, fy + 42)
    ctx.fillText(isRent ? "RENTAL TODAY!" : "HOME TODAY!", 160, fy + 82)
    // Website, right side, big blue on the light page.
    ctx.fillStyle = brand.primary
    ctx.beginPath()
    ctx.arc(672, fy + 50, 34, 0, Math.PI * 2)
    ctx.fill()
    miniIcon(ctx, "globe", 672, fy + 50, 16, "#ffffff")
    ctx.font = `700 26px ${F}`
    ctx.fillStyle = "#5b6472"
    ctx.fillText("VISIT US NOW", 724, fy + 34)
    const siteSize = fitFont(ctx, brand.site, 900, 46, F, W - 724 - 36)
    ctx.font = `900 ${siteSize}px ${F}`
    ctx.fillStyle = brand.primary
    ctx.fillText(brand.site, 724, fy + 88)
    ctx.restore()
  }
}

/** Intro (Rent PH) — animated recreation of the rent.ph poster: centered logo,
 *  tall organic photo blob upper-right with blue quarter-round + orange swoosh,
 *  "LOOKING FOR RENT?" left column, squircle feature rows, tilted polaroids over
 *  a blue bottom-right wave, orange CTA and site row bottom-left. */
function drawIntroRentPh(
  ctx: CanvasRenderingContext2D,
  t01: number,
  brand: Brand,
  inputs: ReelInputs,
  assets: ReelAssets,
) {
  const F = assets.font
  const isRent = inputs.market === "rent"
  const ink = brand.third // #12203c
  const hero = assets.photos[0]

  // ── Paper background (white → paper tint, like the poster's airy page). ──
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, "#ffffff")
  g.addColorStop(1, brand.paper)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // ── Blue wave panel filling the bottom-right corner (behind polaroids). ──
  const pe = easeOutCubic((t01 - 0.04) / 0.22)
  if (pe > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, pe * 1.3)
    ctx.translate(0, (1 - pe) * 160)
    ctx.fillStyle = brand.primary
    ctx.beginPath()
    ctx.moveTo(0, H)
    ctx.lineTo(0, H - 44)
    ctx.quadraticCurveTo(300, H - 60, 520, H - 110)
    ctx.quadraticCurveTo(690, H - 150, 720, 1380)
    ctx.quadraticCurveTo(750, 1080, W, 930)
    ctx.lineTo(W, H)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  // ── Hero photo in a tall organic blob, upper right (asymmetric radii). ──
  const he = easeOutCubic((t01 - 0.08) / 0.26)
  if (he > 0) {
    const bx = 560
    const by = 310
    const bw = 470
    const bh = 880
    ctx.save()
    ctx.globalAlpha = Math.min(1, he * 1.25)
    ctx.translate((1 - he) * 260, 0)
    // Blue diagonal band tucked behind the blob's top-right corner.
    ctx.save()
    ctx.translate(1035, 345)
    ctx.rotate(-0.6)
    ctx.fillStyle = brand.primary
    rr(ctx, -46, -150, 92, 300, 46)
    ctx.fill()
    ctx.restore()
    // Big blue quarter-round behind the blob's rounded bottom-left.
    ctx.fillStyle = brand.primary
    ctx.beginPath()
    ctx.arc(760, 1210, 170, 0, Math.PI * 2)
    ctx.fill()
    // Orange swoosh arc sweeping under the photo.
    ctx.strokeStyle = brand.accent
    ctx.lineWidth = 48
    ctx.lineCap = "round"
    ctx.beginPath()
    ctx.arc(900, 1150, 310, Math.PI * 0.55, Math.PI)
    ctx.stroke()
    // Blob path: rounded rect with very large asymmetric corner radii.
    const blobPath = () => {
      ctx.beginPath()
      ctx.moveTo(bx + 210, by)
      ctx.arcTo(bx + bw, by, bx + bw, by + bh, 64)
      ctx.arcTo(bx + bw, by + bh, bx, by + bh, 130)
      ctx.arcTo(bx, by + bh, bx, by, 230)
      ctx.arcTo(bx, by, bx + bw, by, 210)
      ctx.closePath()
    }
    blobPath()
    ctx.save()
    ctx.clip()
    if (hero) {
      coverImg(ctx, hero, bx, by, bw, bh, 1 + 0.05 * t01)
    } else {
      const pg = ctx.createLinearGradient(bx, by, bx + bw, by + bh)
      pg.addColorStop(0, brand.primary)
      pg.addColorStop(1, brand.accent)
      ctx.fillStyle = pg
      ctx.fillRect(bx, by, bw, bh)
    }
    ctx.restore()
    blobPath()
    ctx.strokeStyle = "#ffffff"
    ctx.lineWidth = 14
    ctx.stroke()
    ctx.restore()
  }

  // ── Centered logo up top + orange slogan line (Rent.ph signature). ──
  const le = Math.min(1, t01 / 0.16)
  if (le > 0) {
    ctx.save()
    ctx.globalAlpha = le
    let lx = (W - 460) / 2
    if (assets.logo) {
      const ratio = assets.logo.width / Math.max(1, assets.logo.height)
      let lw = 460
      let lh = lw / ratio
      if (lh > 130) {
        lh = 130
        lw = lh * ratio
      }
      lx = (W - lw) / 2
    }
    drawLogo(ctx, assets.logo, brand, lx, 64, 460, 130, true)
    ctx.textAlign = "center"
    ctx.textBaseline = "alphabetic"
    const slogan = "PHILIPPINES  #1  PROPERTY  RENTAL  WEBSITE"
    const ss = fitFont(ctx, slogan, 800, 28, F, 920)
    ctx.font = `800 ${ss}px ${F}`
    ctx.fillStyle = brand.accent
    ctx.fillText(slogan, W / 2, 258)
    ctx.restore()
  }

  // ── Headline: LOOKING / FOR in ink, RENT? (or HOMES?) in orange. ──
  const words: Array<{ text: string; color: string; y: number; size: number; delay: number }> = [
    { text: "LOOKING", color: ink, y: 440, size: 130, delay: 0.16 },
    { text: "FOR", color: ink, y: 570, size: 130, delay: 0.24 },
    { text: isRent ? "RENT?" : "HOMES?", color: brand.accent, y: 730, size: 160, delay: 0.32 },
  ]
  for (const wd of words) {
    const we = easeOutCubic((t01 - wd.delay) / 0.24)
    if (we <= 0) continue
    ctx.save()
    ctx.globalAlpha = Math.min(1, we * 1.4)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    const size = fitFont(ctx, wd.text, 900, wd.size, F, 470)
    ctx.font = `900 ${size}px ${F}`
    ctx.fillStyle = wd.color
    ctx.fillText(wd.text, 66 - (1 - we) * 60, wd.y)
    ctx.restore()
  }
  // Short blue divider bar under the headline.
  const de = easeOutCubic((t01 - 0.4) / 0.18)
  if (de > 0) {
    ctx.fillStyle = brand.primary
    ctx.fillRect(70, 772, 120 * de, 10)
  }

  // ── Subtitle. ──
  const se = easeOutCubic((t01 - 0.44) / 0.2)
  if (se > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, se * 1.4)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    const sub1 = isRent ? "Find your next home" : "Discover places you'll"
    const sub2 = isRent ? "easily and securely." : "love to live in."
    const sSize = Math.min(
      fitFont(ctx, sub1, 600, 43, F, 460),
      fitFont(ctx, sub2, 600, 43, F, 460),
    )
    ctx.font = `600 ${sSize}px ${F}`
    ctx.fillStyle = ink
    ctx.fillText(sub1, 70, 850)
    ctx.fillText(sub2, 70, 906)
    ctx.restore()
  }

  // ── Feature rows with blue/orange icon squircles (rounded squares). ──
  const feats = isRent ? FEATURES_RENT : FEATURES_SALE
  const rowColors = [brand.primary, brand.accent, brand.primary]
  feats.forEach((f, i) => {
    const fe = easeOutCubic((t01 - 0.46 - i * 0.06) / 0.2)
    if (fe <= 0) return
    ctx.save()
    ctx.globalAlpha = Math.min(1, fe * 1.4)
    const fy = 1080 + i * 152 + (1 - fe) * 30
    const col = rowColors[i % rowColors.length]
    ctx.fillStyle = col
    rr(ctx, 66, fy - 46, 92, 92, 26)
    ctx.fill()
    miniIcon(ctx, f.icon, 112, fy, 26, "#ffffff")
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    const tSize = fitFont(ctx, f.title, 800, 40, F, 350)
    ctx.font = `800 ${tSize}px ${F}`
    ctx.fillStyle = col
    ctx.fillText(f.title, 186, fy - 16)
    // Body: keep >=29px by wrapping to two lines instead of shrinking.
    ctx.font = `500 29px ${F}`
    let line1 = f.body
    let line2 = ""
    if (ctx.measureText(f.body).width > 350) {
      const cutAt = f.body.indexOf(" ", Math.floor(f.body.length / 2))
      const cut = cutAt === -1 ? f.body.lastIndexOf(" ") : cutAt
      if (cut > 0) {
        line1 = f.body.slice(0, cut)
        line2 = f.body.slice(cut + 1)
      }
    }
    ctx.fillStyle = "#4b5563"
    if (line2) {
      ctx.fillText(line1, 186, fy + 20)
      ctx.fillText(line2, 186, fy + 54)
    } else {
      ctx.fillText(line1, 186, fy + 30)
    }
    ctx.restore()
  })

  // ── Tilted polaroid cards stacked over the blue wave (poster signature). ──
  const cards: Array<{ img: HTMLImageElement | null; cx: number; cy: number; rot: number }> = [
    { img: assets.photos[1] ?? hero ?? null, cx: 742, cy: 1318, rot: -0.105 },
    { img: assets.photos[2] ?? hero ?? null, cx: 886, cy: 1468, rot: 0.1 },
    { img: hero ?? null, cx: 798, cy: 1628, rot: -0.07 },
  ]
  cards.forEach((card, i) => {
    const ce = easeOutCubic((t01 - 0.52 - i * 0.06) / 0.2)
    if (ce <= 0) return
    ctx.save()
    ctx.globalAlpha = Math.min(1, ce * 1.4)
    ctx.translate(card.cx, card.cy + (1 - ce) * 70)
    ctx.rotate(card.rot)
    ctx.shadowColor = "rgba(15,23,42,0.3)"
    ctx.shadowBlur = 22
    ctx.fillStyle = "#ffffff"
    rr(ctx, -160, -125, 320, 250, 14)
    ctx.fill()
    ctx.shadowBlur = 0
    rr(ctx, -144, -109, 288, 172, 8)
    ctx.save()
    ctx.clip()
    if (card.img) {
      coverImg(ctx, card.img, -144, -109, 288, 172)
    } else {
      const cg = ctx.createLinearGradient(-144, -109, 144, 63)
      cg.addColorStop(0, brand.primary)
      cg.addColorStop(1, brand.accent)
      ctx.fillStyle = cg
      ctx.fillRect(-144, -109, 288, 172)
    }
    ctx.restore()
    ctx.restore()
  })

  // ── Solid orange CTA button, bottom-left. ──
  const ce2 = easeOutCubic((t01 - 0.62) / 0.18)
  if (ce2 > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, ce2 * 1.4)
    const cy0 = 1470 + (1 - ce2) * 40
    ctx.shadowColor = "rgba(18,32,60,0.3)"
    ctx.shadowBlur = 20
    ctx.fillStyle = brand.accent
    rr(ctx, 66, cy0, 470, 150, 34)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    const l1 = "FIND YOUR NEXT"
    const l2 = isRent ? "RENTAL TODAY!" : "HOME TODAY!"
    const bSize = Math.min(
      fitFont(ctx, l1, 800, 38, F, 400),
      fitFont(ctx, l2, 800, 38, F, 400),
    )
    ctx.font = `800 ${bSize}px ${F}`
    ctx.fillStyle = "#ffffff"
    ctx.fillText(l1, 66 + 235, cy0 + 53)
    ctx.fillText(l2, 66 + 235, cy0 + 99)
    ctx.textBaseline = "alphabetic"
    ctx.restore()
  }

  // ── Globe + VISIT US NOW + big site, below the CTA. ──
  const ve = easeOutCubic((t01 - 0.68) / 0.16)
  if (ve > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, ve * 1.4)
    ctx.fillStyle = brand.primary
    ctx.beginPath()
    ctx.arc(112, 1756, 40, 0, Math.PI * 2)
    ctx.fill()
    miniIcon(ctx, "globe", 112, 1756, 19, "#ffffff")
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    ctx.font = `700 27px ${F}`
    ctx.fillStyle = ink
    ctx.fillText("VISIT US NOW", 176, 1724)
    const wSize = fitFont(ctx, brand.site, 900, 58, F, 300)
    ctx.font = `900 ${wSize}px ${F}`
    ctx.fillStyle = brand.primary
    ctx.fillText(brand.site, 176, 1792)
    ctx.restore()
  }

  // ── Tagline + orange check circle, bottom-right over the blue panel. ──
  const te = easeOutCubic((t01 - 0.7) / 0.14)
  if (te > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, te * 1.5)
    ctx.fillStyle = brand.accent
    ctx.beginPath()
    ctx.arc(696, 1836, 32, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = "#ffffff"
    ctx.lineWidth = 7
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.beginPath()
    ctx.moveTo(682, 1838)
    ctx.lineTo(692, 1848)
    ctx.lineTo(712, 1826)
    ctx.stroke()
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    ctx.font = `800 33px ${F}`
    ctx.fillStyle = "#ffffff"
    ctx.fillText("RENT SMART.", 744, 1824)
    ctx.fillText("LIVE BETTER.", 744, 1864)
    ctx.restore()
  }
}

/**
 * Intro — FH Global Partners "luxury split" poster: cinematic full-width hero
 * band up top (gold-framed, navy gradient rising from its base), a centered
 * navy/gold headline stack on ivory paper, three gold-ringed feature
 * medallions, a world-dots motif, and a navy footer with a gold site pill.
 */
function drawIntroFhPartners(
  ctx: CanvasRenderingContext2D,
  t01: number,
  brand: Brand,
  inputs: ReelInputs,
  assets: ReelAssets,
) {
  const F = assets.font
  const isRent = inputs.market === "rent"
  const HERO_H = 846
  const goldDeep = "#a8853b"
  const ink = "#3c4350"

  // Ivory paper background (white easing into brand paper down the page).
  const pg = ctx.createLinearGradient(0, HERO_H, 0, H)
  pg.addColorStop(0, "#ffffff")
  pg.addColorStop(1, brand.paper)
  ctx.fillStyle = pg
  ctx.fillRect(0, 0, W, H)

  // ── Cinematic hero band across the top (photo or brand gradient). ──
  const he = easeOutCubic(t01 / 0.22)
  if (he > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, he * 1.3)
    const hero = assets.photos[0]
    if (hero) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, W, HERO_H)
      ctx.clip()
      coverImg(ctx, hero, 0, 0, W, HERO_H, 1.05 + 0.07 * t01)
      ctx.restore()
    } else {
      const fg = ctx.createLinearGradient(0, 0, W, HERO_H)
      fg.addColorStop(0, brand.primary)
      fg.addColorStop(1, brand.accent)
      ctx.fillStyle = fg
      ctx.fillRect(0, 0, W, HERO_H)
    }
    // Navy gradient rising from the band's bottom edge.
    const ng = ctx.createLinearGradient(0, HERO_H - 330, 0, HERO_H)
    ng.addColorStop(0, "rgba(0,31,63,0)")
    ng.addColorStop(1, "rgba(0,31,63,0.82)")
    ctx.fillStyle = ng
    ctx.fillRect(0, HERO_H - 330, W, 330)
    // Thin inset gold frame + gold seam under the band.
    ctx.strokeStyle = brand.accent
    ctx.lineWidth = 3
    ctx.globalAlpha = Math.min(1, he * 1.3) * 0.9
    ctx.strokeRect(28, 28, W - 56, HERO_H - 56)
    ctx.globalAlpha = Math.min(1, he * 1.3)
    ctx.fillStyle = brand.accent
    ctx.fillRect(0, HERO_H - 6, W, 6)
    ctx.restore()
  }

  // ── Small ivory-framed gallery cards on the hero's lower right (optional). ──
  const cardSpots = [
    { img: assets.photos[1], x: 548, y: 660, delay: 0.5 },
    { img: assets.photos[2], x: 796, y: 630, delay: 0.58 },
  ]
  for (const c of cardSpots) {
    if (!c.img) continue
    const e = easeOutCubic((t01 - c.delay) / 0.22)
    if (e <= 0) continue
    const cw = 224
    const chh = 158
    const cx0 = c.x + (1 - e) * 90
    ctx.save()
    ctx.globalAlpha = Math.min(1, e * 1.4)
    ctx.shadowColor = "rgba(0,10,25,0.4)"
    ctx.shadowBlur = 18
    ctx.fillStyle = "#f7f5f0"
    rr(ctx, cx0 - 7, c.y - 7, cw + 14, chh + 14, 16)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = brand.accent
    ctx.lineWidth = 2
    rr(ctx, cx0 - 7, c.y - 7, cw + 14, chh + 14, 16)
    ctx.stroke()
    ctx.save()
    rr(ctx, cx0, c.y, cw, chh, 10)
    ctx.clip()
    coverImg(ctx, c.img, cx0, c.y, cw, chh)
    ctx.restore()
    ctx.restore()
  }

  // ── Logo on an ivory chip, top-left over the photo. ──
  const le = easeOutCubic((t01 - 0.08) / 0.2)
  if (le > 0 && assets.logo) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, le * 1.4)
    const ratio = assets.logo.width / Math.max(1, assets.logo.height)
    let lw = 320
    let lh = lw / ratio
    if (lh > 104) {
      lh = 104
      lw = lh * ratio
    }
    const pad = 22
    ctx.fillStyle = brand.logoIsWhite ? brand.primary : "rgba(255,255,255,0.95)"
    rr(ctx, 64 - pad, 64 - pad, lw + pad * 2, lh + pad * 2, 18)
    ctx.fill()
    drawLogo(ctx, assets.logo, brand, 64, 64, lw, lh, false)
    ctx.restore()
  }

  // ── Gold letterspaced eyebrow. ──
  const ee = easeOutCubic((t01 - 0.18) / 0.2)
  if (ee > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, ee * 1.4)
    ctx.textAlign = "center"
    ctx.textBaseline = "alphabetic"
    const spaced = "GLOBAL PARTNERS NETWORK".split("").join(" ")
    const eSize = fitFont(ctx, spaced, 700, 34, F, 940)
    ctx.font = `700 ${eSize}px ${F}`
    ctx.fillStyle = goldDeep
    ctx.fillText(spaced, W / 2, 930 + (1 - ee) * 26)
    ctx.restore()
  }

  // ── Headline: LOOKING FOR (navy) / HOMES? or RENT? (gold, huge). ──
  const h1e = easeOutCubic((t01 - 0.24) / 0.22)
  if (h1e > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, h1e * 1.4)
    ctx.textAlign = "center"
    ctx.textBaseline = "alphabetic"
    const s1 = fitFont(ctx, "LOOKING FOR", 900, 102, F, 940)
    ctx.font = `900 ${s1}px ${F}`
    ctx.fillStyle = brand.primary
    ctx.fillText("LOOKING FOR", W / 2, 1044 + (1 - h1e) * 40)
    ctx.restore()
  }
  const h2e = easeOutCubic((t01 - 0.32) / 0.24)
  if (h2e > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, h2e * 1.4)
    ctx.textAlign = "center"
    ctx.textBaseline = "alphabetic"
    const big = isRent ? "RENT?" : "HOMES?"
    const s2 = fitFont(ctx, big, 900, 178, F, 940)
    ctx.font = `900 ${s2}px ${F}`
    ctx.fillStyle = brand.accent
    ctx.fillText(big, W / 2, 1212 + (1 - h2e) * 46)
    ctx.restore()
  }

  // ── Thin gold rule with a navy diamond, growing from center. ──
  const re = easeOutCubic((t01 - 0.4) / 0.18)
  if (re > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, re * 1.4)
    const rw = 170 * re
    ctx.fillStyle = brand.accent
    ctx.fillRect(W / 2 - rw / 2, 1248, rw, 4)
    ctx.fillStyle = brand.primary
    ctx.translate(W / 2, 1250)
    ctx.rotate(Math.PI / 4)
    ctx.fillRect(-8, -8, 16, 16)
    ctx.restore()
  }

  // ── Subtitle — one large fitted line. ──
  const se = easeOutCubic((t01 - 0.44) / 0.2)
  if (se > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, se * 1.4)
    ctx.textAlign = "center"
    ctx.textBaseline = "alphabetic"
    const sub = "World-class Philippine real estate, wherever you are."
    const sSize = fitFont(ctx, sub, 600, 46, F, 920)
    ctx.font = `600 ${sSize}px ${F}`
    ctx.fillStyle = ink
    ctx.fillText(sub, W / 2, 1322 + (1 - se) * 26)
    ctx.restore()
  }

  // ── Three gold-haloed feature medallions with big titles (no body copy). ──
  const meds = [
    { icon: "house", title: isRent ? "WIDE CHOICES" : "WIDE SELECTION", ring: brand.primary },
    { icon: "shield", title: "TRUSTED & SECURE", ring: brand.accent },
    { icon: "globe", title: "GLOBAL REACH", ring: brand.third },
  ]
  let medSize = 33
  for (const m of meds) medSize = Math.min(medSize, fitFont(ctx, m.title, 800, 33, F, 296))
  meds.forEach((m, i) => {
    const me = easeOutCubic((t01 - 0.48 - i * 0.06) / 0.2)
    if (me <= 0) return
    const mcx = W / 2 + (i - 1) * 330
    const mcy = 1452 + (1 - me) * 34
    ctx.save()
    ctx.globalAlpha = Math.min(1, me * 1.4) * 0.45
    ctx.strokeStyle = brand.accent
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(mcx, mcy, 100, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = Math.min(1, me * 1.4)
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.arc(mcx, mcy, 86, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = m.ring
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.arc(mcx, mcy, 86, 0, Math.PI * 2)
    ctx.stroke()
    miniIcon(ctx, m.icon, mcx, mcy, 38, m.ring)
    ctx.textAlign = "center"
    ctx.textBaseline = "alphabetic"
    ctx.font = `800 ${medSize}px ${F}`
    ctx.fillStyle = brand.primary
    ctx.fillText(m.title, mcx, mcy + 148)
    ctx.restore()
  })

  // ── World-dots motif fading upward, above the footer panel. ──
  const de = easeOutCubic((t01 - 0.62) / 0.18)
  if (de > 0) {
    ctx.save()
    const rowAlpha = [0.12, 0.22, 0.34]
    ctx.fillStyle = brand.accent
    for (let r = 0; r < 3; r++) {
      ctx.globalAlpha = rowAlpha[r] * Math.min(1, de * 1.4)
      for (let c = 0; c < 15; c++) {
        ctx.beginPath()
        ctx.arc(W / 2 - (14 * 36) / 2 + c * 36, 1632 + r * 24, 4, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()
  }

  // ── Navy footer with gold top border: big CTA + gold site pill. ──
  const fe = easeOutCubic((t01 - 0.66) / 0.19)
  if (fe > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, fe * 1.3)
    const fy = 1704 + (1 - fe) * 70
    ctx.fillStyle = brand.primary
    ctx.fillRect(0, fy, W, H - fy + 80)
    ctx.fillStyle = brand.accent
    ctx.fillRect(0, fy, W, 6)
    // Two-tone CTA rendered as one centered line.
    const part1 = "FIND YOUR NEXT "
    const part2 = isRent ? "RENTAL TODAY!" : "HOME TODAY!"
    const ctaSize = fitFont(ctx, part1 + part2, 900, 54, F, 960)
    ctx.font = `900 ${ctaSize}px ${F}`
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    const startX = W / 2 - ctx.measureText(part1 + part2).width / 2
    ctx.fillStyle = "#ffffff"
    ctx.fillText(part1, startX, fy + 92)
    ctx.fillStyle = brand.accent
    ctx.fillText(part2, startX + ctx.measureText(part1).width, fy + 92)
    // Gold pill: globe icon + site in navy.
    const siteSize = fitFont(ctx, brand.site, 800, 34, F, 560)
    ctx.font = `800 ${siteSize}px ${F}`
    const tw = ctx.measureText(brand.site).width
    const pw = tw + 148
    const px = W / 2 - pw / 2
    const py = fy + 122
    ctx.fillStyle = brand.accent
    rr(ctx, px, py, pw, 76, 38)
    ctx.fill()
    miniIcon(ctx, "globe", px + 46, py + 38, 19, brand.primary)
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    ctx.fillStyle = brand.primary
    ctx.fillText(brand.site, px + 84, py + 40)
    ctx.textBaseline = "alphabetic"
    ctx.restore()
  }
}

/** Intro (FHI Global Property Dubai) — the set's ONLY dark page: deep-navy
 *  luxury poster with gold dust and thin gold arcs, a Moorish-arch hero window
 *  (double gold rim + soft glow) on the right, a white/gold "LOOKING FOR
 *  HOMES?" column with an underline swash, gold-diamond feature rows divided
 *  by gold hairlines, a gold-framed stat chip, and a navy footer with double
 *  gold borders. */
function drawIntroFhiGlobal(
  ctx: CanvasRenderingContext2D,
  t01: number,
  brand: Brand,
  inputs: ReelInputs,
  assets: ReelAssets,
) {
  const F = assets.font
  const isRent = inputs.market === "rent"

  // ── Full-page deep navy gradient (the dark luxury base). ──
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, brand.primary)
  g.addColorStop(1, "#060d18")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // Deterministic gold dust (no Math.random — frames must be stable).
  const frac = (n: number) => n - Math.floor(n)
  const dustE = Math.min(1, t01 / 0.3)
  ctx.save()
  ctx.fillStyle = brand.accent
  for (let i = 0; i < 46; i++) {
    const rx = frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453)
    const ry = frac(Math.sin(i * 78.233 + 2.3) * 43758.5453)
    const rs = frac(Math.sin(i * 39.425 + 1.2) * 43758.5453)
    ctx.globalAlpha = (0.08 + rs * 0.18) * dustE
    ctx.beginPath()
    ctx.arc(40 + rx * (W - 80), 60 + ry * (H - 240), 1.6 + rs * 2.6, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // Two thin gold arcs, faint, top-right and bottom-left.
  const arcE = easeOutCubic(t01 / 0.26)
  if (arcE > 0) {
    ctx.save()
    ctx.globalAlpha = 0.26 * arcE
    ctx.strokeStyle = brand.accent
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(W + 60, 210, 430, Math.PI * 0.52, Math.PI * 1.18)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(-70, 1980, 430, Math.PI * 1.52, Math.PI * 1.98)
    ctx.stroke()
    ctx.restore()
  }

  // ── Moorish arch geometry (pointed-top arched window, rounded base). ──
  const archPath = (x: number, top: number, w: number, bottom: number) => {
    const cx = x + w / 2
    const sh = top + w * 0.62
    const br = Math.min(46, w * 0.12)
    ctx.beginPath()
    ctx.moveTo(cx, top)
    ctx.quadraticCurveTo(x + w, top + w * 0.12, x + w, sh)
    ctx.lineTo(x + w, bottom - br)
    ctx.quadraticCurveTo(x + w, bottom, x + w - br, bottom)
    ctx.lineTo(x + br, bottom)
    ctx.quadraticCurveTo(x, bottom, x, bottom - br)
    ctx.lineTo(x, sh)
    ctx.quadraticCurveTo(x, top + w * 0.12, cx, top)
    ctx.closePath()
  }

  // ── Hero photo inside the big arch, right side, sliding in from the right. ──
  const he = easeOutCubic((t01 - 0.03) / 0.26)
  if (he > 0) {
    const ax = 530
    const ayT = 250
    const aw = 492
    const ayB = 1180
    ctx.save()
    ctx.globalAlpha = Math.min(1, he * 1.25)
    ctx.translate((1 - he) * 280, 0)
    // Outer gold rim with a soft glow.
    ctx.save()
    ctx.shadowColor = "rgba(214,179,87,0.55)"
    ctx.shadowBlur = 38
    ctx.strokeStyle = brand.accent
    ctx.lineWidth = 4
    archPath(ax, ayT, aw, ayB)
    ctx.stroke()
    ctx.restore()
    // Photo (or brand-gradient fallback) clipped inside the inset arch.
    archPath(ax + 26, ayT + 30, aw - 52, ayB - 24)
    ctx.save()
    ctx.clip()
    const hero = assets.photos[0]
    if (hero) {
      coverImg(ctx, hero, ax + 26, ayT + 30, aw - 52, ayB - 24 - (ayT + 30), 1.03 + 0.06 * t01)
    } else {
      const pg = ctx.createLinearGradient(ax, ayT, ax + aw, ayB)
      pg.addColorStop(0, brand.third)
      pg.addColorStop(0.55, brand.primary)
      pg.addColorStop(1, brand.accent)
      ctx.fillStyle = pg
      ctx.fillRect(ax + 26, ayT + 30, aw - 52, ayB - 24 - (ayT + 30))
    }
    ctx.restore()
    // Second thin gold rim between the outer rim and the photo.
    ctx.strokeStyle = "rgba(214,179,87,0.6)"
    ctx.lineWidth = 2
    archPath(ax + 13, ayT + 15, aw - 26, ayB - 12)
    ctx.stroke()
    ctx.restore()
  }

  // ── Optional small arch (photos[1]) straddling the big arch's lower-left. ──
  const small = assets.photos[1]
  if (small) {
    const sme = easeOutCubic((t01 - 0.48) / 0.22)
    if (sme > 0) {
      const sx = 470
      const st = 968
      const sw = 176
      const sb = 1238
      ctx.save()
      ctx.globalAlpha = Math.min(1, sme * 1.4)
      ctx.translate(0, (1 - sme) * 60)
      // Navy separation halo so it reads apart from the big photo.
      archPath(sx, st, sw, sb)
      ctx.strokeStyle = brand.paper
      ctx.lineWidth = 16
      ctx.stroke()
      ctx.fillStyle = brand.paper
      ctx.fill()
      archPath(sx + 9, st + 11, sw - 18, sb - 9)
      ctx.save()
      ctx.clip()
      coverImg(ctx, small, sx + 9, st + 11, sw - 18, sb - 9 - (st + 11), 1.02 + 0.04 * t01)
      ctx.restore()
      archPath(sx, st, sw, sb)
      ctx.strokeStyle = brand.accent
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.restore()
    }
  }

  // ── White+gold logo, top-left, drawn large directly on the navy. ──
  ctx.save()
  ctx.globalAlpha = Math.min(1, t01 / 0.18)
  drawLogo(ctx, assets.logo, brand, 66, 72, 460, 150, false)
  ctx.restore()

  // ── Gold letterspaced eyebrow. ──
  const ee = easeOutCubic((t01 - 0.12) / 0.2)
  if (ee > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, ee * 1.4)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    const spaced = "DUBAI • UAE".split("").join(" ")
    const eSize = fitFont(ctx, spaced, 700, 32, F, 430)
    ctx.font = `700 ${eSize}px ${F}`
    ctx.fillStyle = brand.accent
    ctx.fillText(spaced, 66, 332 + (1 - ee) * 24)
    ctx.restore()
  }

  // ── Headline: LOOKING / FOR in white 900, HOMES?/RENT? in gold. ──
  const lookSize = fitFont(ctx, "LOOKING", 900, 118, F, 430)
  const bigWord = isRent ? "RENT?" : "HOMES?"
  const bigSize = fitFont(ctx, bigWord, 900, 150, F, 430)
  const words: Array<{ text: string; color: string; y: number; size: number; delay: number }> = [
    { text: "LOOKING", color: "#ffffff", y: 476, size: lookSize, delay: 0.16 },
    { text: "FOR", color: "#ffffff", y: 606, size: lookSize, delay: 0.23 },
    { text: bigWord, color: brand.accent, y: 772, size: bigSize, delay: 0.3 },
  ]
  for (const wd of words) {
    const we = easeOutCubic((t01 - wd.delay) / 0.22)
    if (we <= 0) continue
    ctx.save()
    ctx.globalAlpha = Math.min(1, we * 1.4)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    ctx.font = `900 ${wd.size}px ${F}`
    ctx.fillStyle = wd.color
    ctx.fillText(wd.text, 66 - (1 - we) * 60, wd.y)
    ctx.restore()
  }

  // Thin gold underline swash growing beneath the gold word.
  const swe = easeOutCubic((t01 - 0.38) / 0.18)
  if (swe > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, swe * 1.4)
    ctx.font = `900 ${bigSize}px ${F}`
    const uw = Math.min(430, ctx.measureText(bigWord).width) * swe
    ctx.strokeStyle = brand.accent
    ctx.lineWidth = 6
    ctx.lineCap = "round"
    ctx.beginPath()
    ctx.moveTo(70, 800)
    ctx.quadraticCurveTo(70 + uw * 0.5, 822, 70 + uw, 796)
    ctx.stroke()
    ctx.restore()
  }

  // ── Subtitle — two big soft-white lines. ──
  const se = easeOutCubic((t01 - 0.42) / 0.2)
  if (se > 0) {
    const sub1 = isRent ? "Premium Dubai rentals," : "Premium Dubai properties"
    const sub2 = isRent ? "easy and secure." : "from trusted developers."
    const sSize = Math.min(
      fitFont(ctx, sub1, 600, 42, F, 430),
      fitFont(ctx, sub2, 600, 42, F, 430),
    )
    ctx.save()
    ctx.globalAlpha = Math.min(1, se * 1.4)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    ctx.font = `600 ${sSize}px ${F}`
    ctx.fillStyle = "rgba(255,255,255,0.85)"
    const sy = (1 - se) * 24
    ctx.fillText(sub1, 66, 886 + sy)
    ctx.fillText(sub2, 66, 942 + sy)
    ctx.restore()
  }

  // ── Feature rows: gold-outlined diamond icons, big white titles, gold body. ──
  const feats = isRent ? FEATURES_RENT : FEATURES_SALE
  feats.forEach((f, i) => {
    const fe = easeOutCubic((t01 - 0.52 - i * 0.06) / 0.2)
    if (fe <= 0) return
    ctx.save()
    ctx.globalAlpha = Math.min(1, fe * 1.4)
    const fy = 1298 + i * 138 + (1 - fe) * 30
    // Diamond (rotated squircle) outline in gold.
    ctx.save()
    ctx.translate(122, fy)
    ctx.rotate(Math.PI / 4)
    ctx.strokeStyle = brand.accent
    ctx.lineWidth = 3
    rr(ctx, -34, -34, 68, 68, 12)
    ctx.stroke()
    ctx.restore()
    miniIcon(ctx, f.icon, 122, fy, 24, brand.accent)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    const tSize = fitFont(ctx, f.title, 800, 46, F, 700)
    ctx.font = `800 ${tSize}px ${F}`
    ctx.fillStyle = "#ffffff"
    ctx.fillText(f.title, 210, fy - 6)
    const bSize = fitFont(ctx, f.body, 500, 31, F, 780)
    ctx.font = `500 ${bSize}px ${F}`
    ctx.fillStyle = "rgba(214,179,87,0.9)"
    ctx.fillText(f.body, 210, fy + 44)
    if (i < feats.length - 1) {
      ctx.strokeStyle = "rgba(214,179,87,0.3)"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(210, fy + 70)
      ctx.lineTo(1000, fy + 70)
      ctx.stroke()
    }
    ctx.restore()
  })

  // ── Gold-framed dark stat chip, centered above the footer. ──
  const che = easeOutCubic((t01 - 0.62) / 0.2)
  if (che > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, che * 1.4)
    const cy0 = 1656 + (1 - che) * 34
    const p1 = "45,000+ "
    const p2 = isRent ? "RENTALS ACROSS DUBAI" : "HOMES ACROSS DUBAI"
    const stSize = fitFont(ctx, p1 + p2, 800, 36, F, 720)
    ctx.font = `800 ${stSize}px ${F}`
    const tw = ctx.measureText(p1 + p2).width
    const chipW = tw + 150
    const chipX = W / 2 - chipW / 2
    ctx.fillStyle = brand.paper
    rr(ctx, chipX, cy0, chipW, 88, 44)
    ctx.fill()
    ctx.strokeStyle = brand.accent
    ctx.lineWidth = 2
    rr(ctx, chipX, cy0, chipW, 88, 44)
    ctx.stroke()
    miniIcon(ctx, "building", chipX + 56, cy0 + 44, 20, brand.third)
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    ctx.fillStyle = brand.accent
    ctx.fillText(p1, chipX + 96, cy0 + 46)
    ctx.fillStyle = "#ffffff"
    ctx.fillText(p2, chipX + 96 + ctx.measureText(p1).width, cy0 + 46)
    ctx.textBaseline = "alphabetic"
    ctx.restore()
  }

  // ── Footer: navy bar with double gold borders, CTA left, site right. ──
  const fe2 = easeOutCubic((t01 - 0.66) / 0.19)
  if (fe2 > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, fe2 * 1.3)
    const fy = 1768 + (1 - fe2) * 60
    ctx.fillStyle = brand.primary
    ctx.fillRect(0, fy, W, H - fy + 80)
    ctx.fillStyle = brand.accent
    ctx.fillRect(0, fy, W, 5)
    ctx.fillRect(0, fy + 12, W, 2)
    // CTA, left: gold-ringed search icon + two big lines.
    ctx.strokeStyle = brand.accent
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(110, fy + 92, 36, 0, Math.PI * 2)
    ctx.stroke()
    miniIcon(ctx, "search", 110, fy + 92, 17, brand.accent)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    ctx.font = `800 31px ${F}`
    ctx.fillStyle = "#ffffff"
    ctx.fillText("FIND YOUR NEXT", 168, fy + 82)
    ctx.fillStyle = brand.accent
    ctx.fillText(isRent ? "RENTAL TODAY!" : "HOME TODAY!", 168, fy + 122)
    // Site, right: globe + VISIT US NOW + big gold site.
    ctx.fillStyle = "rgba(214,179,87,0.14)"
    ctx.beginPath()
    ctx.arc(606, fy + 92, 34, 0, Math.PI * 2)
    ctx.fill()
    miniIcon(ctx, "globe", 606, fy + 92, 17, brand.accent)
    ctx.font = `700 26px ${F}`
    ctx.fillStyle = "rgba(214,179,87,0.85)"
    ctx.fillText("VISIT US NOW", 658, fy + 76)
    const siteSize = fitFont(ctx, brand.site, 800, 42, F, W - 658 - 36)
    ctx.font = `800 ${siteSize}px ${F}`
    ctx.fillStyle = brand.accent
    ctx.fillText(brand.site, 658, fy + 126)
    ctx.restore()
  }
}

/**
 * Intro (Rentsouq AE) — "marketplace mosaic" poster: warm sand page with sparse
 * orange diamond accents, a full-width left-aligned headline stack, then the
 * signature asymmetric rounded-tile gallery (photo tiles plus solid blue/orange
 * icon tiles on a white grout panel) with a price-tag chip riding the hero
 * tile's bottom edge, a 3-column feature band, and a night-blue footer bar.
 */
function drawIntroRentsouq(
  ctx: CanvasRenderingContext2D,
  t01: number,
  brand: Brand,
  inputs: ReelInputs,
  assets: ReelAssets,
) {
  const F = assets.font
  const isRent = inputs.market === "rent"
  const night = brand.third // #1c355e deep night-blue

  // ── Warm sand page (white → paper). ──
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, "#ffffff")
  g.addColorStop(1, brand.paper)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const diamond = (cx: number, cy: number, s: number) => {
    ctx.beginPath()
    ctx.moveTo(cx, cy - s)
    ctx.lineTo(cx + s, cy)
    ctx.lineTo(cx, cy + s)
    ctx.lineTo(cx - s, cy)
    ctx.closePath()
    ctx.fill()
  }

  // ── Sparse orange diamond accents (souq motif), kept clear of all text. ──
  const de = easeOutCubic((t01 - 0.05) / 0.2)
  if (de > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, de * 1.3) * 0.8
    ctx.fillStyle = brand.accent
    diamond(996, 150, 14)
    diamond(940, 224, 8)
    diamond(1006, 560, 11)
    diamond(44, 736, 9)
    diamond(1024, 1664, 10)
    ctx.restore()
  }

  // ── Logo top-left (colored art, fine on the light page). ──
  ctx.save()
  ctx.globalAlpha = Math.min(1, t01 / 0.14)
  drawLogo(ctx, assets.logo, brand, 66, 70, 360, 132, true)
  ctx.restore()

  // ── Blue letterspaced eyebrow to the logo's right. ──
  const ee = easeOutCubic((t01 - 0.06) / 0.18)
  if (ee > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, ee * 1.4)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    const line1 = "UAE RENTAL".split("").join(" ")
    const line2 = "MARKETPLACE".split("").join(" ")
    const eSize = Math.min(
      fitFont(ctx, line1, 800, 27, F, 566),
      fitFont(ctx, line2, 800, 27, F, 566),
    )
    ctx.font = `800 ${eSize}px ${F}`
    ctx.fillStyle = brand.primary
    const ex = 490 + (1 - ee) * 40
    ctx.fillText(line1, ex, 118)
    ctx.fillText(line2, ex, 158)
    ctx.fillStyle = brand.accent
    diamond(ex - 24, 110, 8)
    ctx.restore()
  }

  // ── Headline — left-aligned but full width (nothing beside it). ──
  const h1 = easeOutCubic((t01 - 0.1) / 0.22)
  if (h1 > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, h1 * 1.4)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    const s1 = fitFont(ctx, "LOOKING FOR", 900, 112, F, 948)
    ctx.font = `900 ${s1}px ${F}`
    ctx.fillStyle = night
    ctx.fillText("LOOKING FOR", 66 - (1 - h1) * 70, 372)
    ctx.restore()
  }
  const big = isRent ? "RENT?" : "HOMES?"
  const h2 = easeOutCubic((t01 - 0.18) / 0.24)
  if (h2 > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, h2 * 1.4)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    const s2 = fitFont(ctx, big, 900, 168, F, 850)
    ctx.font = `900 ${s2}px ${F}`
    ctx.fillStyle = brand.accent
    const bx = 66 - (1 - h2) * 70
    ctx.fillText(big, bx, 552)
    // Blue dot accent chasing the question mark.
    ctx.fillStyle = brand.primary
    ctx.beginPath()
    ctx.arc(bx + ctx.measureText(big).width + 42, 532, 18, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // ── Subtitle — one big fitted line. ──
  const se = easeOutCubic((t01 - 0.26) / 0.2)
  if (se > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, se * 1.4)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    const sub = "Every home in the souq, one search away."
    const sSize = fitFont(ctx, sub, 600, 46, F, 948)
    ctx.font = `600 ${sSize}px ${F}`
    ctx.fillStyle = night
    ctx.fillText(sub, 66, 652 + (1 - se) * 26)
    ctx.restore()
  }

  // ── Mosaic gallery — white grout panel behind an asymmetric tile grid. ──
  const pe = easeOutCubic((t01 - 0.3) / 0.2)
  if (pe > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, pe * 1.3)
    ctx.shadowColor = "rgba(28,53,94,0.16)"
    ctx.shadowBlur = 26
    ctx.fillStyle = "#ffffff"
    rr(ctx, 24, 762 + (1 - pe) * 30, 1032, 690, 36)
    ctx.fill()
    ctx.restore()
  }

  // Tiles: big hero + two photo tiles right, two solid icon tiles bottom-left,
  // laid with ~18px white grout gaps. Missing photos become solid icon tiles;
  // a missing hero becomes a brand gradient in the same rounded shape.
  const hero = assets.photos[0] ?? null
  const tiles: Array<{
    x: number
    y: number
    w: number
    h: number
    r: number
    img: HTMLImageElement | null
    solid: string
    icon: string
    grad: boolean
    delay: number
  }> = [
    { x: 38, y: 776, w: 606, h: 470, r: 28, img: hero, solid: brand.primary, icon: "", grad: true, delay: 0.34 },
    { x: 662, y: 776, w: 380, h: 306, r: 24, img: assets.photos[1] ?? null, solid: night, icon: "building", grad: false, delay: 0.39 },
    { x: 662, y: 1100, w: 380, h: 338, r: 24, img: assets.photos[2] ?? null, solid: brand.primary, icon: "pin", grad: false, delay: 0.44 },
    { x: 38, y: 1264, w: 294, h: 174, r: 24, img: null, solid: brand.primary, icon: "house", grad: false, delay: 0.49 },
    { x: 350, y: 1264, w: 294, h: 174, r: 24, img: null, solid: brand.accent, icon: "key", grad: false, delay: 0.54 },
  ]
  tiles.forEach((tl) => {
    const te = easeOutCubic((t01 - tl.delay) / 0.2)
    if (te <= 0) return
    const tcx = tl.x + tl.w / 2
    const tcy = tl.y + tl.h / 2
    ctx.save()
    ctx.globalAlpha = Math.min(1, te * 1.35)
    const pop = 0.88 + 0.12 * te
    ctx.translate(tcx, tcy + (1 - te) * 26)
    ctx.scale(pop, pop)
    ctx.translate(-tcx, -tcy)
    ctx.shadowColor = "rgba(28,53,94,0.2)"
    ctx.shadowBlur = 18
    ctx.fillStyle = tl.img ? "#ffffff" : tl.solid
    rr(ctx, tl.x, tl.y, tl.w, tl.h, tl.r)
    ctx.fill()
    ctx.shadowBlur = 0
    if (tl.img) {
      ctx.save()
      rr(ctx, tl.x, tl.y, tl.w, tl.h, tl.r)
      ctx.clip()
      coverImg(ctx, tl.img, tl.x, tl.y, tl.w, tl.h, 1.02 + 0.05 * t01)
      ctx.restore()
    } else if (tl.grad) {
      ctx.save()
      rr(ctx, tl.x, tl.y, tl.w, tl.h, tl.r)
      ctx.clip()
      const tg = ctx.createLinearGradient(tl.x, tl.y, tl.x + tl.w, tl.y + tl.h)
      tg.addColorStop(0, brand.primary)
      tg.addColorStop(1, brand.accent)
      ctx.fillStyle = tg
      ctx.fillRect(tl.x, tl.y, tl.w, tl.h)
      ctx.restore()
    } else {
      const ir = Math.min(56, Math.min(tl.w, tl.h) * 0.26)
      miniIcon(ctx, tl.icon, tcx, tcy, ir, "#ffffff")
    }
    ctx.restore()
  })

  // ── White price-tag chip riding the hero tile's bottom edge. ──
  const che = easeOutCubic((t01 - 0.58) / 0.18)
  if (che > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, che * 1.4)
    const label = "FIND IT IN THE SOUQ"
    const cSize = fitFont(ctx, label, 800, 30, F, 400)
    ctx.font = `800 ${cSize}px ${F}`
    const tw = ctx.measureText(label).width
    const chy = 1202 + (1 - che) * 30
    ctx.shadowColor = "rgba(28,53,94,0.3)"
    ctx.shadowBlur = 18
    ctx.fillStyle = "#ffffff"
    rr(ctx, 66, chy, tw + 114, 88, 44)
    ctx.fill()
    ctx.shadowBlur = 0
    miniIcon(ctx, "pin", 112, chy + 44, 19, brand.accent)
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    ctx.fillStyle = night
    ctx.fillText(label, 148, chy + 46)
    ctx.textBaseline = "alphabetic"
    ctx.restore()
  }

  // ── Feature band — one white card, 3 columns, big titles only. ──
  const be = easeOutCubic((t01 - 0.6) / 0.18)
  if (be > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, be * 1.3)
    const by = 1482 + (1 - be) * 36
    ctx.shadowColor = "rgba(28,53,94,0.16)"
    ctx.shadowBlur = 22
    ctx.fillStyle = "#ffffff"
    rr(ctx, 44, by, W - 88, 156, 30)
    ctx.fill()
    ctx.shadowBlur = 0
    const feats = isRent ? FEATURES_RENT : FEATURES_SALE
    const colColors = [brand.primary, brand.accent, night]
    let tSize = 35
    for (const f of feats) tSize = Math.min(tSize, fitFont(ctx, f.title, 800, 35, F, 316))
    const colW = (W - 88) / 3
    feats.forEach((f, i) => {
      const ce = easeOutCubic((t01 - 0.64 - i * 0.03) / 0.15)
      if (ce <= 0) return
      ctx.save()
      ctx.globalAlpha = Math.min(1, be * 1.3) * Math.min(1, ce * 1.4)
      const ccx = 44 + colW * i + colW / 2
      ctx.fillStyle = colColors[i % colColors.length]
      rr(ctx, ccx - 32, by + 20, 64, 64, 20)
      ctx.fill()
      miniIcon(ctx, f.icon, ccx, by + 52, 17, "#ffffff")
      ctx.textAlign = "center"
      ctx.textBaseline = "alphabetic"
      ctx.font = `800 ${tSize}px ${F}`
      ctx.fillStyle = night
      ctx.fillText(f.title, ccx, by + 130)
      if (i < feats.length - 1) {
        ctx.strokeStyle = "rgba(28,53,94,0.15)"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(44 + colW * (i + 1), by + 30)
        ctx.lineTo(44 + colW * (i + 1), by + 126)
        ctx.stroke()
      }
      ctx.restore()
    })
    ctx.restore()
  }

  // ── Night-blue footer bar: orange CTA pill left, site right. ──
  const fe = easeOutCubic((t01 - 0.68) / 0.17)
  if (fe > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, fe * 1.3)
    const fy = 1690 + (1 - fe) * 60
    ctx.fillStyle = night
    ctx.fillRect(0, fy, W, H - fy + 60)
    ctx.fillStyle = brand.accent
    rr(ctx, 44, fy + 36, 508, 96, 48)
    ctx.fill()
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.arc(108, fy + 84, 34, 0, Math.PI * 2)
    ctx.fill()
    miniIcon(ctx, "search", 108, fy + 84, 16, brand.accent)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    const l1 = "FIND YOUR NEXT"
    const l2 = isRent ? "RENTAL TODAY!" : "HOME TODAY!"
    const pSize = Math.min(
      fitFont(ctx, l1, 800, 30, F, 372),
      fitFont(ctx, l2, 800, 30, F, 372),
    )
    ctx.font = `800 ${pSize}px ${F}`
    ctx.fillStyle = "#ffffff"
    ctx.fillText(l1, 160, fy + 74)
    ctx.fillText(l2, 160, fy + 114)
    ctx.fillStyle = "rgba(255,255,255,0.16)"
    ctx.beginPath()
    ctx.arc(616, fy + 84, 34, 0, Math.PI * 2)
    ctx.fill()
    miniIcon(ctx, "globe", 616, fy + 84, 17, "#ffffff")
    ctx.font = `700 26px ${F}`
    ctx.fillStyle = "rgba(255,255,255,0.85)"
    ctx.fillText("VISIT US NOW", 668, fy + 66)
    const sSize = fitFont(ctx, brand.site, 900, 42, F, W - 668 - 36)
    ctx.font = `900 ${sSize}px ${F}`
    ctx.fillStyle = brand.accent
    ctx.fillText(brand.site, 668, fy + 116)
    ctx.restore()
  }
}

/** Each brand has its own poster design — dispatch to the matching layout. */
function drawIntroForBrand(
  ctx: CanvasRenderingContext2D,
  t01: number,
  brand: Brand,
  inputs: ReelInputs,
  assets: ReelAssets,
) {
  switch (brand.key) {
    case "fhiglobal":
      drawIntroFhiGlobal(ctx, t01, brand, inputs, assets)
      return
    case "rentsouq":
      drawIntroRentsouq(ctx, t01, brand, inputs, assets)
      return
    case "homesph":
      drawIntroHomesPh(ctx, t01, brand, inputs, assets)
      return
    case "rentph":
      drawIntroRentPh(ctx, t01, brand, inputs, assets)
      return
    case "fhipartners":
      drawIntroFhPartners(ctx, t01, brand, inputs, assets)
      return
    default:
      drawIntroFilipinoHomes(ctx, t01, brand, inputs, assets)
  }
}

// ─── Timeline ──────────────────────────────────────────────────────────────────

type Slide = { kind: "intro" | "photo" | "outro"; dur: number; photoIdx?: number }

function buildTimeline(photoCount: number): Slide[] {
  const slides: Slide[] = [{ kind: "intro", dur: INTRO_S }]
  for (let i = 0; i < photoCount; i++) slides.push({ kind: "photo", dur: PHOTO_S, photoIdx: i })
  slides.push({ kind: "outro", dur: OUTRO_S })
  return slides
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  timeS: number,
  slides: Slide[],
  brand: Brand,
  inputs: ReelInputs,
  assets: ReelAssets,
) {
  let acc = 0
  for (const s of slides) {
    if (timeS < acc + s.dur || s === slides[slides.length - 1]) {
      const t01 = Math.max(0, Math.min(1, (timeS - acc) / s.dur))
      if (s.kind === "intro") drawIntroForBrand(ctx, t01, brand, inputs, assets)
      else if (s.kind === "photo") drawPhoto(ctx, t01, brand, inputs, assets, s.photoIdx ?? 0)
      else drawOutro(ctx, t01, brand, inputs, assets)
      return
    }
    acc += s.dur
  }
}

// ─── Image loading ─────────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

type PhotoItem = { id: string; src: string; name: string }

let idCounter = 0
function nextId() {
  idCounter += 1
  return `p${idCounter}-${idCounter * 7919}`
}

/**
 * Listing photos live on S3/Supabase; drawing them straight onto the canvas
 * would taint it and break video export. The existing same-origin image proxy
 * (built for map markers, host-allowlisted) solves that.
 */
function proxiedListingPhoto(url: string) {
  return `/api/map-marker-image?url=${encodeURIComponent(url)}`
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ReelsMakerClient({
  userId,
  userName,
  currentRole,
  initialListingId,
}: {
  userId: string
  userName: string
  currentRole: string
  initialListingId?: string | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef<number>(0)
  const playStartRef = useRef<number>(0)
  const pausedAtRef = useRef<number>(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const [brandKey, setBrandKey] = useState<string>(BRANDS[0].key)
  const brand = useMemo(() => BRANDS.find((b) => b.key === brandKey) ?? BRANDS[0], [brandKey])

  const [market, setMarket] = useState<Market>("sale")
  const [title, setTitle] = useState("")
  const [location, setLocation] = useState("")
  const [price, setPrice] = useState("")
  const [agentName, setAgentName] = useState(userName)
  const [phone, setPhone] = useState("")
  const [musicOn, setMusicOn] = useState(true)

  const [photos, setPhotos] = useState<PhotoItem[]>(() =>
    SAMPLE_PHOTOS.map((src, i) => ({ id: nextId(), src, name: `Sample house ${i + 1}` })),
  )
  const [photoImgs, setPhotoImgs] = useState<HTMLImageElement[]>([])
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null)
  const [fontFamily, setFontFamily] = useState<string>("Arial, sans-serif")

  const [playing, setPlaying] = useState(false)
  const [recording, setRecording] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [myListings, setMyListings] = useState<AgentListing[]>([])
  const [listingsLoading, setListingsLoading] = useState(true)
  const [selectedListingId, setSelectedListingId] = useState<string>("")
  const appliedInitialRef = useRef(false)

  const slides = useMemo(() => buildTimeline(photos.length), [photos.length])
  const totalS = useMemo(() => slides.reduce((a, s) => a + s.dur, 0), [slides])

  const inputs: ReelInputs = useMemo(
    () => ({ market, title, location, price, agentName, phone }),
    [market, title, location, price, agentName, phone],
  )
  const assets: ReelAssets = useMemo(
    () => ({ logo: logoImg, photos: photoImgs, font: fontFamily }),
    [logoImg, photoImgs, fontFamily],
  )

  // Resolve the Outfit font family that next/font registered, for canvas use.
  useEffect(() => {
    const fam = getComputedStyle(document.documentElement).getPropertyValue("--font-outfit").trim()
    if (fam) setFontFamily(`${fam}, Arial, sans-serif`)
    void document.fonts?.ready
  }, [])

  // Brand switch: load logo, follow the brand's natural market, reset audio.
  useEffect(() => {
    let alive = true
    void loadImage(brand.logoSrc).then((img) => {
      if (alive) setLogoImg(img)
    })
    setMarket(brand.defaultMarket)
    return () => {
      alive = false
    }
  }, [brand])

  // (Re)load photo images whenever the list changes.
  useEffect(() => {
    let alive = true
    void Promise.all(photos.map((p) => loadImage(p.src))).then((imgs) => {
      if (alive) setPhotoImgs(imgs.filter(Boolean) as HTMLImageElement[])
    })
    return () => {
      alive = false
    }
  }, [photos])

  const stopPlayback = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    setPlaying(false)
    if (audioRef.current) {
      audioRef.current.pause()
    }
  }, [])

  // ── One-click reel from the agent's own listings. ──
  useEffect(() => {
    let alive = true
    void fetchMyAgentListings(userId).then(({ data }) => {
      if (!alive) return
      setMyListings((data ?? []).filter((l) => l.status !== "archived"))
      setListingsLoading(false)
    })
    return () => {
      alive = false
    }
  }, [userId])

  const applyListing = useCallback(
    (listing: AgentListing) => {
      stopPlayback()
      pausedAtRef.current = 0
      setProgress(0)
      setSelectedListingId(listing.id)
      setMarket(listing.listing_kind)
      setTitle(listing.title)
      setLocation(listing.projects?.name ?? "")
      if (listing.price != null) {
        const amount = Number(listing.price).toLocaleString()
        setPrice(`${listing.currency} ${amount}${listing.listing_kind === "rent" ? " / month" : ""}`)
      } else {
        setPrice("")
      }
      const imgs = (listing.agent_listing_images ?? []).slice(0, 8)
      setPhotos((prev) => {
        for (const p of prev) if (p.src.startsWith("blob:")) URL.revokeObjectURL(p.src)
        if (imgs.length === 0) {
          // Listing has no photos yet — fall back to the sample set so the reel still renders.
          return SAMPLE_PHOTOS.map((src, i) => ({ id: nextId(), src, name: `Sample house ${i + 1}` }))
        }
        return imgs.map((im, i) => ({
          id: nextId(),
          src: proxiedListingPhoto(im.url),
          name: `Listing photo ${i + 1}`,
        }))
      })
    },
    [stopPlayback],
  )

  // Deep link from My listings: /dashboard/reels-maker?listing=<id>
  useEffect(() => {
    if (appliedInitialRef.current || !initialListingId || listingsLoading) return
    const match = myListings.find((l) => l.id === initialListingId)
    if (match) {
      appliedInitialRef.current = true
      applyListing(match)
    }
  }, [initialListingId, listingsLoading, myListings, applyListing])

  // Draw a static frame whenever anything changes and we're idle.
  useEffect(() => {
    if (playing || recording) return
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    drawFrame(ctx, pausedAtRef.current, slides, brand, inputs, assets)
  }, [playing, recording, slides, brand, inputs, assets])

  const runLoop = useCallback(
    (onDone?: () => void) => {
      const ctx = canvasRef.current?.getContext("2d")
      if (!ctx) return
      const tick = () => {
        const elapsed = (performance.now() - playStartRef.current) / 1000
        if (elapsed >= totalS) {
          drawFrame(ctx, totalS, slides, brand, inputs, assets)
          setProgress(1)
          onDone?.()
          return
        }
        drawFrame(ctx, elapsed, slides, brand, inputs, assets)
        setProgress(elapsed / totalS)
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    },
    [slides, brand, inputs, assets, totalS],
  )

  const handlePlayPause = useCallback(() => {
    if (recording) return
    if (playing) {
      pausedAtRef.current = (performance.now() - playStartRef.current) / 1000
      stopPlayback()
      return
    }
    const resumeFrom = pausedAtRef.current >= totalS ? 0 : pausedAtRef.current
    playStartRef.current = performance.now() - resumeFrom * 1000
    setPlaying(true)
    if (musicOn) {
      if (!audioRef.current) audioRef.current = new Audio()
      const a = audioRef.current
      if (!a.src.endsWith(brand.jingleSrc)) a.src = brand.jingleSrc
      a.loop = true
      a.currentTime = resumeFrom % 60
      void a.play().catch(() => {})
    }
    runLoop(() => {
      pausedAtRef.current = 0
      stopPlayback()
    })
  }, [playing, recording, totalS, musicOn, brand.jingleSrc, runLoop, stopPlayback])

  const handleRestart = useCallback(() => {
    if (recording) return
    stopPlayback()
    pausedAtRef.current = 0
    setProgress(0)
    const ctx = canvasRef.current?.getContext("2d")
    if (ctx) drawFrame(ctx, 0, slides, brand, inputs, assets)
  }, [recording, stopPlayback, slides, brand, inputs, assets])

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current)
    audioRef.current?.pause()
    try {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop()
    } catch {
      // already stopped
    }
    void audioCtxRef.current?.close().catch(() => {})
  }, [])

  // ── Export ──
  const handleGenerate = useCallback(async () => {
    if (recording) return
    const canvas = canvasRef.current
    if (!canvas) return
    setError(null)
    stopPlayback()
    setRecording(true)
    setProgress(0)

    try {
      await document.fonts?.ready
      const stream = canvas.captureStream(30)

      // Mix the jingle in via WebAudio (export stays silent on speakers).
      if (musicOn) {
        try {
          const actx = new AudioContext()
          audioCtxRef.current = actx
          const res = await fetch(brand.jingleSrc)
          const buf = await actx.decodeAudioData(await res.arrayBuffer())
          const src = actx.createBufferSource()
          src.buffer = buf
          src.loop = true
          const dest = actx.createMediaStreamDestination()
          src.connect(dest)
          src.start()
          for (const track of dest.stream.getAudioTracks()) stream.addTrack(track)
        } catch {
          // No audio if the jingle fails to decode — video still exports.
        }
      }

      const candidates = [
        "video/mp4;codecs=avc1",
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm",
      ]
      const mime = candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? ""
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 9_000_000 } : undefined)
      recorderRef.current = recorder
      const chunks: BlobPart[] = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      const done = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve()
      })
      recorder.start(250)

      // Real-time render pass drives the recording.
      playStartRef.current = performance.now()
      await new Promise<void>((resolve) => {
        runLoop(() => resolve())
      })

      recorder.stop()
      await done
      for (const track of stream.getTracks()) track.stop()
      void audioCtxRef.current?.close().catch(() => {})
      audioCtxRef.current = null

      const ext = mime.startsWith("video/mp4") ? "mp4" : "webm"
      const blob = new Blob(chunks, { type: mime || "video/webm" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${brand.key}-${market}-reel.${ext}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recording failed — try Chrome or Edge.")
    } finally {
      setRecording(false)
      setProgress(0)
      pausedAtRef.current = 0
    }
  }, [recording, stopPlayback, musicOn, brand, market, runLoop])

  // ── Photo management ──
  const handleAddPhotos = useCallback((files: FileList | null) => {
    if (!files?.length) return
    const items: PhotoItem[] = []
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue
      items.push({ id: nextId(), src: URL.createObjectURL(f), name: f.name })
    }
    if (items.length) setPhotos((prev) => [...prev, ...items].slice(0, 8))
  }, [])

  const movePhoto = useCallback((idx: number, dir: -1 | 1) => {
    setPhotos((prev) => {
      const next = [...prev]
      const to = idx + dir
      if (to < 0 || to >= next.length) return prev
      const [it] = next.splice(idx, 1)
      next.splice(to, 0, it)
      return next
    })
  }, [])

  const removePhoto = useCallback((idx: number) => {
    setPhotos((prev) => {
      const it = prev[idx]
      if (it?.src.startsWith("blob:")) URL.revokeObjectURL(it.src)
      return prev.filter((_, i) => i !== idx)
    })
  }, [])

  const roleValue = currentRole.toLowerCase().trim()
  const inputCls =
    "w-full px-4 py-3 rounded-xl border border-[#e5e5e5] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] transition-colors"
  const labelCls = "block text-xs font-bold uppercase tracking-wide text-[#6b7280] mb-1.5"

  return (
    <>
      <div className="w-full space-y-6">
        <div>
          <h1 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] flex items-center gap-2">
            <Clapperboard className="w-6 h-6 text-[#001f3f]" />
            Reels Maker
          </h1>
          <p className="text-sm text-[#6b7280] mt-1">
            Create branded 9:16 video reels for Facebook and Instagram. Pick a brand, add your
            property photos and details, preview, then download — the brand jingle is included.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6 items-start">
          {/* ── Controls ── */}
          <div className="space-y-5">
            {/* One-click reel from a listing */}
            <div className="bg-white rounded-2xl border border-[#e8eaed] p-5">
              <p className={labelCls}>One-click reel — pick one of my listings</p>
              {listingsLoading ? (
                <p className="text-sm text-[#9ca3af] flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading your listings…
                </p>
              ) : myListings.length === 0 ? (
                <p className="text-sm text-[#9ca3af]">
                  No listings yet — create one in <span className="font-semibold">My listings</span>, or build a
                  reel manually below.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {myListings.map((l) => {
                      const cover = l.agent_listing_images?.[0]?.url ?? null
                      const selected = l.id === selectedListingId
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => applyListing(l)}
                          className={`text-left rounded-xl border-2 overflow-hidden transition-all ${
                            selected ? "border-[#001f3f] shadow-md" : "border-[#e5e5e5] hover:border-[#9ca3af]"
                          }`}
                        >
                          <div className="relative h-20 bg-[#eef1f5]">
                            {cover ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={cover} alt={l.title} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-[#b8bfc9]">
                                <ImagePlus className="w-5 h-5" />
                              </div>
                            )}
                            <span
                              className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold text-white ${
                                l.listing_kind === "rent" ? "bg-[#2f6fe4]" : "bg-[#d6b357]"
                              }`}
                            >
                              {l.listing_kind === "rent" ? "RENT" : "SALE"}
                            </span>
                            {selected && (
                              <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-[#001f3f] text-white text-[9px] font-bold">
                                SELECTED
                              </span>
                            )}
                          </div>
                          <div className="p-2">
                            <p className="text-xs font-bold text-[#111827] truncate">{l.title}</p>
                            <p className="text-[10px] text-[#6b7280] truncate">
                              {(l.agent_listing_images?.length ?? 0) > 0
                                ? `${l.agent_listing_images?.length} photo${(l.agent_listing_images?.length ?? 0) > 1 ? "s" : ""}`
                                : "no photos"}
                              {l.status === "draft" ? " · draft" : ""}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-2 text-[11px] text-[#9ca3af]">
                    Click a listing — photos, title, price, and sale/rent fill in automatically and stay editable below.
                  </p>
                </>
              )}
            </div>

            {/* Brand picker */}
            <div className="bg-white rounded-2xl border border-[#e8eaed] p-5">
              <p className={labelCls}>Brand</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {BRANDS.map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => setBrandKey(b.key)}
                    className={`rounded-xl border-2 p-3 text-left transition-all ${
                      b.key === brandKey
                        ? "border-[#001f3f] shadow-md"
                        : "border-[#e5e5e5] hover:border-[#9ca3af]"
                    }`}
                  >
                    <div
                      className="h-14 rounded-lg flex items-center justify-center px-2"
                      style={{ backgroundColor: b.logoIsWhite ? b.primary : "#f6f7f9" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.logoSrc} alt={b.name} className="max-h-10 max-w-full object-contain" />
                    </div>
                    <p className="mt-2 text-xs font-bold text-[#111827]">{b.name}</p>
                    <div className="mt-1.5 flex gap-1">
                      <span className="h-2 w-6 rounded-full" style={{ backgroundColor: b.primary }} />
                      <span className="h-2 w-6 rounded-full" style={{ backgroundColor: b.accent }} />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Listing details */}
            <div className="bg-white rounded-2xl border border-[#e8eaed] p-5 space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className={`${labelCls} mb-0`}>Listing details</p>
                <div className="inline-flex rounded-xl border border-[#e5e5e5] overflow-hidden">
                  {(["sale", "rent"] as Market[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMarket(m)}
                      className={`px-4 py-2 text-sm font-bold transition-colors ${
                        market === m ? "bg-[#001f3f] text-white" : "bg-white text-[#374151] hover:bg-[#f3f4f6]"
                      }`}
                    >
                      {m === "sale" ? "For Sale" : "For Rent"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Property title</label>
                  <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Modern 3BR Family Home" maxLength={60} />
                </div>
                <div>
                  <label className={labelCls}>Location</label>
                  <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Cebu City, Philippines" maxLength={60} />
                </div>
                <div>
                  <label className={labelCls}>Price text</label>
                  <input className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} placeholder={market === "rent" ? "₱25,000 / month" : "₱4,500,000"} maxLength={30} />
                </div>
                <div>
                  <label className={labelCls}>Agent name</label>
                  <input className={inputCls} value={agentName} onChange={(e) => setAgentName(e.target.value)} maxLength={50} />
                </div>
                <div>
                  <label className={labelCls}>Contact number</label>
                  <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0917 123 4567" maxLength={30} />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setMusicOn((v) => !v)}
                    className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                      musicOn
                        ? "border-[#001f3f] bg-[#001f3f]/5 text-[#001f3f]"
                        : "border-[#e5e5e5] text-[#6b7280]"
                    }`}
                  >
                    <Music className="w-4 h-4" />
                    Brand jingle: {musicOn ? "On" : "Off"}
                  </button>
                </div>
              </div>
            </div>

            {/* Photos */}
            <div className="bg-white rounded-2xl border border-[#e8eaed] p-5">
              <div className="flex items-center justify-between mb-3">
                <p className={`${labelCls} mb-0`}>Photos ({photos.length}/8) — first photo is the poster hero</p>
                <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#001f3f] text-white text-sm font-semibold cursor-pointer hover:bg-[#00356b] transition-colors">
                  <ImagePlus className="w-4 h-4" />
                  Add photos
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleAddPhotos(e.target.files)
                      e.target.value = ""
                    }}
                  />
                </label>
              </div>
              {photos.length === 0 ? (
                <p className="text-sm text-[#9ca3af] py-6 text-center">
                  Add at least one photo — it becomes the poster hero image.
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {photos.map((p, i) => (
                    <div key={p.id} className="relative group rounded-xl overflow-hidden border border-[#e5e5e5]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.src} alt={p.name} className="h-24 w-full object-cover" />
                      {i === 0 && (
                        <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-[#001f3f] text-white text-[10px] font-bold">
                          HERO
                        </span>
                      )}
                      <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 p-1.5 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => movePhoto(i, -1)} className="p-1 rounded bg-white/90 hover:bg-white" title="Move left">
                          <ArrowLeft className="w-3.5 h-3.5 text-[#111827]" />
                        </button>
                        <button type="button" onClick={() => removePhoto(i)} className="p-1 rounded bg-white/90 hover:bg-white" title="Remove">
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </button>
                        <button type="button" onClick={() => movePhoto(i, 1)} className="p-1 rounded bg-white/90 hover:bg-white" title="Move right">
                          <ArrowRight className="w-3.5 h-3.5 text-[#111827]" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Preview + export ── */}
          <div className="bg-white rounded-2xl border border-[#e8eaed] p-5 xl:sticky xl:top-6">
            <div className="flex items-center justify-between mb-3">
              <p className={`${labelCls} mb-0`}>Preview</p>
              <span className="text-xs font-semibold text-[#6b7280]">
                {Math.round(totalS)}s · 1080×1920
              </span>
            </div>
            <div className="relative mx-auto w-full max-w-[300px] rounded-[28px] overflow-hidden border-4 border-[#0d1117] bg-black shadow-xl">
              <canvas ref={canvasRef} width={W} height={H} className="w-full h-auto block" />
              {recording && (
                <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                  <p className="text-white text-sm font-bold">Recording… {Math.round(progress * 100)}%</p>
                </div>
              )}
            </div>
            {/* Progress bar */}
            <div className="mt-3 h-1.5 rounded-full bg-[#eceef1] overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-150"
                style={{ width: `${Math.round(progress * 100)}%`, backgroundColor: brand.accent }}
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handlePlayPause}
                disabled={recording || photos.length === 0}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#001f3f] text-sm font-bold text-[#001f3f] hover:bg-[#001f3f]/5 transition-colors disabled:opacity-40"
              >
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {playing ? "Pause" : "Preview"}
              </button>
              <button
                type="button"
                onClick={handleRestart}
                disabled={recording}
                className="inline-flex items-center justify-center px-4 py-3 rounded-xl border border-[#e5e5e5] text-[#374151] hover:border-[#001f3f] transition-colors disabled:opacity-40"
                title="Restart"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={recording || photos.length === 0}
              className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-40"
              style={{ backgroundColor: brand.primary }}
            >
              {recording ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {recording ? "Recording reel…" : "Generate & download"}
            </button>
            <p className="mt-2 text-[11px] leading-relaxed text-[#9ca3af]">
              Recording runs in real time ({Math.round(totalS)}s) — keep this tab open. Downloads as
              MP4 when the browser supports it, otherwise WebM. Best in Chrome or Edge.
            </p>
            {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
          </div>
        </div>
      </div>
    </>
  )
}
