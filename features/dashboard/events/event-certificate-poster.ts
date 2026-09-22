import QRCode from "qrcode"
import { eventBrand } from "@/lib/events/brands"

/**
 * "Scan to get your certificate" poster — a branded PNG drawn on a canvas in
 * the browser (same approach as the flyer): navy stage with gold corner
 * bands, the brand logo, a gold headline, the QR on a white card with the
 * official seal, three steps, and the event details. Three sizes: a 9:16
 * story/screen version, a 1080×1080 square for a Facebook/Instagram post,
 * and an A4 portrait for printing. The square drops the headline sub-line
 * and tightens spacing so everything still fits.
 */

export type PosterSize = "story" | "a4" | "square"

export type PosterInput = {
  url: string
  brandKey: string
  eventTitle: string
  dateLabel: string | null
  venue: string | null
  size: PosterSize
}

const NAVY = "#001f3f"
const NAVY_DEEP = "#00142b"
const GOLD = "#c9a449"
const GOLD_LIGHT = "#f0d890"
const IVORY = "#fbf8f1"
const FONT = "Outfit, 'Segoe UI', Arial, sans-serif"

// Logo, seal and QR renders are reused across previews and downloads.
const imageCache = new Map<string, Promise<HTMLImageElement | null>>()
function loadImage(src: string): Promise<HTMLImageElement | null> {
  const hit = imageCache.get(src)
  if (hit) return hit
  const p = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
  imageCache.set(src, p)
  return p
}

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

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    const probe = line ? `${line} ${word}` : word
    if (ctx.measureText(probe).width <= maxWidth || !line) line = probe
    else {
      lines.push(line)
      line = word
      if (lines.length === maxLines - 1) break
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, maxLines)
}

function gold(ctx: CanvasRenderingContext2D, y0: number, y1: number) {
  const g = ctx.createLinearGradient(0, y0, 0, y1)
  g.addColorStop(0, "#f9e9a8")
  g.addColorStop(0.4, GOLD_LIGHT)
  g.addColorStop(0.7, GOLD)
  g.addColorStop(1, "#f3dd89")
  return g
}

/** Renders the poster and returns a PNG data URL. */
export async function renderCertificateQrPoster(input: PosterInput): Promise<string> {
  const W = input.size === "a4" ? 1240 : 1080
  const H = input.size === "a4" ? 1754 : input.size === "square" ? 1080 : 1920
  const s = W / 1080 // scale factor for a4 widths
  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!
  // Square: a compact layout — QR left, headline + steps right — because the
  // vertical stack does not fit in 1080px.
  if (input.size === "square") return renderSquare(ctx, W, H, input)
  const brand = eventBrand(input.brandKey)
  await document.fonts?.ready

  // ── stage ──
  const bg = ctx.createRadialGradient(W / 2, H * 0.42, 60, W / 2, H * 0.42, H * 0.9)
  bg.addColorStop(0, "#0b3563")
  bg.addColorStop(0.55, NAVY)
  bg.addColorStop(1, NAVY_DEEP)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  // fine rays from the QR position
  ctx.save()
  ctx.globalAlpha = 0.06
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 2
  for (let i = 0; i < 36; i++) {
    const a = (Math.PI * 2 * i) / 36
    ctx.beginPath()
    ctx.moveTo(W / 2, H * 0.52)
    ctx.lineTo(W / 2 + Math.cos(a) * H, H * 0.52 + Math.sin(a) * H)
    ctx.stroke()
  }
  ctx.restore()
  // gold corner bands (top-left slim, bottom-right broad)
  const band = (pts: [number, number][], goldPts: [number, number][]) => {
    ctx.fillStyle = gold(ctx, 0, H)
    ctx.beginPath()
    goldPts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = "#062b55"
    ctx.beginPath()
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.closePath()
    ctx.fill()
  }
  band([[0, 0], [300 * s, 0], [0, 200 * s]], [[0, 0], [330 * s, 0], [0, 222 * s]])
  band([[W, H], [W, H - 360 * s], [W - 540 * s, H]], [[W, H], [W, H - 392 * s], [W - 588 * s, H]])
  // hairline frame
  ctx.strokeStyle = GOLD
  ctx.globalAlpha = 0.6
  ctx.lineWidth = 2
  ctx.strokeRect(40 * s, 40 * s, W - 80 * s, H - 80 * s)
  ctx.globalAlpha = 1

  // ── logo ──
  const logoSrc = brand.key === "fhiglobal" ? "/logos/FHI_Branding_White.png" : brand.logo
  const logo = await loadImage(logoSrc)
  let y = 120 * s
  if (logo) {
    const lh = 118 * s
    const lw = (logo.width / logo.height) * lh
    if (!brand.logoIsWhite && brand.key !== "fhiglobal") {
      ctx.fillStyle = "#fff"
      rr(ctx, W / 2 - lw / 2 - 26 * s, y - 16 * s, lw + 52 * s, lh + 32 * s, 18 * s)
      ctx.fill()
    }
    ctx.drawImage(logo, W / 2 - lw / 2, y, lw, lh)
    y += lh + 78 * s
  } else {
    y += 40 * s
  }

  // ── headline ──
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = GOLD_LIGHT
  ctx.font = `italic 600 ${Math.round(44 * s)}px 'Brush Script MT', 'Segoe Script', cursive`
  ctx.fillText("Thank you for attending", W / 2, y)
  y += 82 * s
  ctx.font = `900 ${Math.round(92 * s)}px ${FONT}`
  ctx.fillStyle = gold(ctx, y - 90 * s, y)
  ctx.fillText("GET YOUR", W / 2, y)
  y += 96 * s
  ctx.fillText("CERTIFICATE", W / 2, y)
  y += 58 * s
  ctx.fillStyle = "rgba(255,255,255,0.85)"
  ctx.font = `600 ${Math.round(28 * s)}px ${FONT}`
  ctx.letterSpacing = `${Math.round(8 * s)}px`
  ctx.fillText("OF ATTENDANCE", W / 2, y)
  ctx.letterSpacing = "0px"
  y += 70 * s

  // ── QR card with seal ──
  const card = Math.round(620 * s)
  const cx = W / 2 - card / 2
  ctx.save()
  ctx.shadowColor = "rgba(0,0,0,0.45)"
  ctx.shadowBlur = 50 * s
  ctx.shadowOffsetY = 24 * s
  ctx.fillStyle = "#fff"
  rr(ctx, cx, y, card, card, 28 * s)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 6 * s
  rr(ctx, cx + 14 * s, y + 14 * s, card - 28 * s, card - 28 * s, 18 * s)
  ctx.stroke()
  const qrSize = Math.round(card - 150 * s)
  const qrUrl = await QRCode.toDataURL(input.url, { width: qrSize * 2, margin: 0, errorCorrectionLevel: "M", color: { dark: NAVY, light: "#ffffff" } })
  const qr = await loadImage(qrUrl)
  if (qr) ctx.drawImage(qr, W / 2 - qrSize / 2, y + 44 * s, qrSize, qrSize)
  // seal overlapping the card's bottom edge
  const seal = await loadImage(`/seals/${brand.key}.png`)
  const sealSize = Math.round(230 * s)
  if (seal) ctx.drawImage(seal, W / 2 - sealSize / 2, y + card - sealSize * 0.42, sealSize, sealSize)
  y += card + sealSize * 0.62 + 40 * s

  // ── steps ──
  const steps: [string, string][] = [["1", "Scan the code"], ["2", "Type your name"], ["3", "Download your PDF"]]
  const gap = Math.round(300 * s)
  const startX = W / 2 - gap
  steps.forEach(([n, label], i) => {
    const x = startX + i * gap
    ctx.beginPath()
    ctx.arc(x, y, 30 * s, 0, Math.PI * 2)
    ctx.fillStyle = gold(ctx, y - 30 * s, y + 30 * s)
    ctx.fill()
    ctx.fillStyle = NAVY
    ctx.font = `900 ${Math.round(30 * s)}px ${FONT}`
    ctx.textBaseline = "middle"
    ctx.fillText(n, x, y + 2 * s)
    ctx.textBaseline = "alphabetic"
    ctx.fillStyle = IVORY
    ctx.font = `700 ${Math.round(24 * s)}px ${FONT}`
    ctx.fillText(label, x, y + 68 * s)
    if (i < 2) {
      ctx.strokeStyle = "rgba(201,164,73,0.45)"
      ctx.lineWidth = 2
      ctx.setLineDash([8 * s, 8 * s])
      ctx.beginPath()
      ctx.moveTo(x + 40 * s, y)
      ctx.lineTo(x + gap - 40 * s, y)
      ctx.stroke()
      ctx.setLineDash([])
    }
  })
  y += 140 * s

  // ── event details ──
  ctx.fillStyle = "#fff"
  ctx.font = `800 ${Math.round(38 * s)}px ${FONT}`
  const titleLines = wrapLines(ctx, input.eventTitle, W - 260 * s, 2)
  titleLines.forEach((l) => {
    ctx.fillText(l, W / 2, y)
    y += 48 * s
  })
  const details = [input.dateLabel, input.venue].filter(Boolean).join("   ·   ")
  if (details) {
    ctx.fillStyle = "rgba(255,255,255,0.7)"
    ctx.font = `500 ${Math.round(24 * s)}px ${FONT}`
    ctx.fillText(details, W / 2, y + 6 * s)
  }

  // ── footer ──
  ctx.fillStyle = GOLD
  ctx.font = `700 ${Math.round(20 * s)}px ${FONT}`
  ctx.letterSpacing = `${Math.round(5 * s)}px`
  ctx.fillText(new URL(input.url).host.replace(/^www\./, "").toUpperCase(), W / 2, H - 92 * s)
  ctx.letterSpacing = "0px"

  return canvas.toDataURL("image/png")
}

async function renderSquare(ctx: CanvasRenderingContext2D, W: number, H: number, input: PosterInput): Promise<string> {
  const brand = eventBrand(input.brandKey)
  await document.fonts?.ready
  // stage
  const bg = ctx.createRadialGradient(W * 0.3, H * 0.5, 40, W * 0.3, H * 0.5, W)
  bg.addColorStop(0, "#0b3563")
  bg.addColorStop(0.55, NAVY)
  bg.addColorStop(1, NAVY_DEEP)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.globalAlpha = 0.06
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 2
  for (let i = 0; i < 36; i++) {
    const a = (Math.PI * 2 * i) / 36
    ctx.beginPath()
    ctx.moveTo(W * 0.3, H * 0.55)
    ctx.lineTo(W * 0.3 + Math.cos(a) * W, H * 0.55 + Math.sin(a) * W)
    ctx.stroke()
  }
  ctx.restore()
  const band = (pts: [number, number][], goldPts: [number, number][]) => {
    ctx.fillStyle = gold(ctx, 0, H)
    ctx.beginPath()
    goldPts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = "#062b55"
    ctx.beginPath()
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.closePath()
    ctx.fill()
  }
  band([[0, 0], [240, 0], [0, 160]], [[0, 0], [266, 0], [0, 178]])
  band([[W, H], [W, H - 260], [W - 390, H]], [[W, H], [W, H - 286], [W - 428, H]])
  ctx.strokeStyle = GOLD
  ctx.globalAlpha = 0.6
  ctx.lineWidth = 2
  ctx.strokeRect(32, 32, W - 64, H - 64)
  ctx.globalAlpha = 1

  // left: QR card with seal
  const card = 470
  const cx = 80
  const cy = 150
  ctx.save()
  ctx.shadowColor = "rgba(0,0,0,0.45)"
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 18
  ctx.fillStyle = "#fff"
  rr(ctx, cx, cy, card, card, 24)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 5
  rr(ctx, cx + 12, cy + 12, card - 24, card - 24, 16)
  ctx.stroke()
  const qrSize = card - 80
  const qrUrl = await QRCode.toDataURL(input.url, { width: qrSize * 2, margin: 0, errorCorrectionLevel: "M", color: { dark: NAVY, light: "#ffffff" } })
  const qr = await loadImage(qrUrl)
  if (qr) ctx.drawImage(qr, cx + card / 2 - qrSize / 2, cy + 40, qrSize, qrSize)
  const seal = await loadImage(`/seals/${brand.key}.png`)
  const sealSize = 210
  if (seal) ctx.drawImage(seal, cx + card / 2 - sealSize / 2, cy + card - 26, sealSize, sealSize)

  // right: logo, headline, steps, event
  const rx = 620
  const rw = W - rx - 70
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  let y = 120
  const logoSrc = brand.key === "fhiglobal" ? "/logos/FHI_Branding_White.png" : brand.logo
  const logo = await loadImage(logoSrc)
  if (logo) {
    const lh = 82
    const lw = Math.min((logo.width / logo.height) * lh, rw)
    if (!brand.logoIsWhite && brand.key !== "fhiglobal") {
      ctx.fillStyle = "#fff"
      rr(ctx, rx - 16, y - 12, lw + 32, lh + 24, 14)
      ctx.fill()
    }
    ctx.drawImage(logo, rx, y, lw, lh)
    y += lh + 62
  }
  ctx.fillStyle = GOLD_LIGHT
  ctx.font = `italic 600 34px 'Brush Script MT', 'Segoe Script', cursive`
  ctx.fillText("Thank you for attending", rx, y)
  y += 70
  ctx.font = `900 58px ${FONT}`
  ctx.fillStyle = gold(ctx, y - 58, y)
  ctx.fillText("GET YOUR", rx, y)
  y += 62
  ctx.fillText("CERTIFICATE", rx, y)
  y += 40
  ctx.fillStyle = "rgba(255,255,255,0.85)"
  ctx.font = `600 20px ${FONT}`
  ctx.letterSpacing = "6px"
  ctx.fillText("OF ATTENDANCE", rx, y)
  ctx.letterSpacing = "0px"
  y += 74
  const steps: [string, string][] = [["1", "Scan the code"], ["2", "Type your name"], ["3", "Download your PDF"]]
  steps.forEach(([n, label]) => {
    ctx.beginPath()
    ctx.arc(rx + 22, y, 22, 0, Math.PI * 2)
    ctx.fillStyle = gold(ctx, y - 22, y + 22)
    ctx.fill()
    ctx.fillStyle = NAVY
    ctx.font = `900 22px ${FONT}`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(n, rx + 22, y + 1)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    ctx.fillStyle = IVORY
    ctx.font = `700 24px ${FONT}`
    ctx.fillText(label, rx + 62, y + 9)
    y += 60
  })
  y += 30
  ctx.fillStyle = "#fff"
  ctx.font = `800 28px ${FONT}`
  wrapLines(ctx, input.eventTitle, rw, 2).forEach((l) => {
    ctx.fillText(l, rx, y)
    y += 36
  })
  const details = [input.dateLabel, input.venue].filter(Boolean)
  ctx.fillStyle = "rgba(255,255,255,0.7)"
  ctx.font = `500 19px ${FONT}`
  details.forEach((d) => {
    ctx.fillText(d as string, rx, y + 2)
    y += 28
  })
  // footer
  ctx.textAlign = "center"
  ctx.fillStyle = GOLD
  ctx.font = `700 17px ${FONT}`
  ctx.letterSpacing = "5px"
  ctx.fillText(new URL(input.url).host.replace(/^www\./, "").toUpperCase(), cx + card / 2, H - 60)
  ctx.letterSpacing = "0px"
  return ctx.canvas.toDataURL("image/png")
}
