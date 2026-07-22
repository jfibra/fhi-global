"use client"

/**
 * Event flyer generator — 1080×1920 (9:16, story/status-ready) luxury flyer:
 * the event poster shown whole up top, then a navy stage with golden light
 * rays and sparkles, script "You're Invited", the title with a metallic-gold
 * hero line, date/time/venue with gold icons, and the registration QR.
 *
 * Layout is two-pass: the QR block and footer are anchored to the bottom,
 * and the text stack is measured first, shrunk if needed, then vertically
 * centered in the space between the poster and the QR — so long titles or
 * two-line venues can never push content into the footer.
 *
 * Remote photos load through the same-origin image proxy so the canvas stays
 * exportable.
 */

import { useEffect, useRef, useState } from "react"
import { QRCodeCanvas } from "qrcode.react"
import { Download, Loader2, X } from "lucide-react"
import { eventBrand } from "@/lib/events/brands"

const W = 1080
const H = 1920
const PHOTO_H = 830

// Bottom-anchored geometry (independent of text length)
const PILL_H = 58
const PILL_Y = H - 96 // gold site pill
const FREE_Y = PILL_Y - 26 // "FREE REGISTRATION" baseline
const QR_CARD = 330 // white QR card (wider per feedback)
const QR_TOP = FREE_Y - 44 - QR_CARD
const SCAN_Y = QR_TOP - 26 // "SCAN TO REGISTER" baseline
const ZONE_TOP = PHOTO_H + 16
const ZONE_BOTTOM = SCAN_Y - 44 // text stack must stay above this

type FlyerEvent = {
  id: string
  slug: string | null
  title: string
  brand: string
  imageUrl: string | null
  eventDate: string | null
  venue: string | null
}

function proxied(url: string) {
  return `/api/map-marker-image?url=${encodeURIComponent(url)}`
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
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

const frac = (n: number) => n - Math.floor(n)

/** Greedy word-wrap capped at maxLines (last line ellipsized if needed). */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    const probe = line ? `${line} ${word}` : word
    if (ctx.measureText(probe).width <= maxWidth || !line) {
      line = probe
    } else {
      lines.push(line)
      line = word
      if (lines.length === maxLines - 1) break
    }
  }
  if (line) lines.push(line)
  if (lines.length === maxLines) {
    const used = lines.join(" ").split(/\s+/).length
    const rest = words.slice(used).join(" ")
    if (rest) {
      let last = lines[maxLines - 1]
      while (ctx.measureText(`${last}…`).width > maxWidth && last.includes(" ")) {
        last = last.slice(0, last.lastIndexOf(" "))
      }
      lines[maxLines - 1] = `${last}…`
    }
  }
  return lines.slice(0, maxLines)
}

/** Metallic gold gradient for text fills. */
function goldGradient(ctx: CanvasRenderingContext2D, yTop: number, yBottom: number) {
  const g = ctx.createLinearGradient(0, yTop, 0, yBottom)
  g.addColorStop(0, "#f9e9a8")
  g.addColorStop(0.35, "#f0d890")
  g.addColorStop(0.65, "#c9a449")
  g.addColorStop(1, "#f3dd89")
  return g
}

/** Tiny gold stroke icons (calendar / clock / pin / globe). */
function miniIcon(ctx: CanvasRenderingContext2D, kind: string, cx: number, cy: number, r: number, color: string) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = Math.max(2.5, r * 0.22)
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  if (kind === "calendar") {
    rr(ctx, cx - r, cy - r * 0.85, r * 2, r * 1.7, r * 0.25)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx - r, cy - r * 0.35)
    ctx.lineTo(cx + r, cy - r * 0.35)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx - r * 0.45, cy - r * 1.05)
    ctx.lineTo(cx - r * 0.45, cy - r * 0.65)
    ctx.moveTo(cx + r * 0.45, cy - r * 1.05)
    ctx.lineTo(cx + r * 0.45, cy - r * 0.65)
    ctx.stroke()
  } else if (kind === "clock") {
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.95, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx, cy - r * 0.55)
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + r * 0.42, cy + r * 0.15)
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
  } else {
    // globe
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2)
    ctx.stroke()
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(0.45, 1)
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    ctx.beginPath()
    ctx.moveTo(cx - r * 0.85, cy)
    ctx.lineTo(cx + r * 0.85, cy)
    ctx.stroke()
  }
  ctx.restore()
}

/** Four-point sparkle star. */
function sparkle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, alpha: number) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = "#f0d890"
  ctx.beginPath()
  ctx.moveTo(cx, cy - r)
  ctx.quadraticCurveTo(cx + r * 0.14, cy - r * 0.14, cx + r, cy)
  ctx.quadraticCurveTo(cx + r * 0.14, cy + r * 0.14, cx, cy + r)
  ctx.quadraticCurveTo(cx - r * 0.14, cy + r * 0.14, cx - r, cy)
  ctx.quadraticCurveTo(cx - r * 0.14, cy - r * 0.14, cx, cy - r)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

export function EventFlyerModal({
  event,
  origin,
  onClose,
}: {
  event: FlyerEvent
  origin: string
  onClose: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const qrRef = useRef<HTMLDivElement>(null)
  const [rendering, setRendering] = useState(true)

  useEffect(() => {
    let alive = true

    async function draw() {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext("2d")
      if (!canvas || !ctx) return

      await document.fonts?.ready
      const fam =
        getComputedStyle(document.documentElement).getPropertyValue("--font-outfit").trim() || "Arial"
      const F = `${fam}, Arial, sans-serif`
      const SCRIPT = `'Brush Script MT', 'Segoe Script', cursive`
      const brand = eventBrand(event.brand)

      const [photo, logo] = await Promise.all([
        event.imageUrl ? loadImage(proxied(event.imageUrl)) : Promise.resolve(null),
        loadImage(brand.logo),
      ])
      if (!alive) return

      // ── Base: deep navy ──
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, "#001f3f")
      bg.addColorStop(0.55, "#04142a")
      bg.addColorStop(1, "#02101f")
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // ── Golden light rays fanning up from below the bottom edge ──
      ctx.save()
      const rayOrigin = { x: W / 2, y: H + 260 }
      for (let i = 0; i < 22; i++) {
        const angle = Math.PI * (1.08 + (i / 21) * 0.84)
        const spread = 0.02 + frac(Math.sin(i * 91.7) * 43758.5453) * 0.03
        const len = 1500
        const grad = ctx.createLinearGradient(
          rayOrigin.x,
          rayOrigin.y,
          rayOrigin.x + Math.cos(angle) * len,
          rayOrigin.y + Math.sin(angle) * len,
        )
        grad.addColorStop(0, `rgba(214,179,87,${0.16 + frac(Math.sin(i * 3.3) * 999) * 0.1})`)
        grad.addColorStop(1, "rgba(214,179,87,0)")
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.moveTo(rayOrigin.x, rayOrigin.y)
        ctx.lineTo(rayOrigin.x + Math.cos(angle - spread) * len, rayOrigin.y + Math.sin(angle - spread) * len)
        ctx.lineTo(rayOrigin.x + Math.cos(angle + spread) * len, rayOrigin.y + Math.sin(angle + spread) * len)
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()

      // ── Sparkles across the stage ──
      for (let i = 0; i < 26; i++) {
        const sx = 40 + frac(Math.sin(i * 12.9898) * 43758.5453) * (W - 80)
        const sy = PHOTO_H + 30 + frac(Math.sin(i * 78.233) * 43758.5453) * (H - PHOTO_H - 120)
        const sr = 3 + frac(Math.sin(i * 39.4) * 43758.5453) * 9
        sparkle(ctx, sx, sy, sr, 0.25 + frac(Math.sin(i * 7.1) * 999) * 0.5)
      }

      // ── Photo band: whole poster over blurred fill ──
      if (photo) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, 0, W, PHOTO_H)
        ctx.clip()
        ctx.filter = "blur(30px)"
        ctx.globalAlpha = 0.55
        const cover = Math.max(W / photo.width, PHOTO_H / photo.height) * 1.15
        ctx.drawImage(
          photo,
          W / 2 - (photo.width * cover) / 2,
          PHOTO_H / 2 - (photo.height * cover) / 2,
          photo.width * cover,
          photo.height * cover,
        )
        ctx.filter = "none"
        ctx.globalAlpha = 1
        const scale = Math.min(W / photo.width, PHOTO_H / photo.height)
        const dw = photo.width * scale
        const dh = photo.height * scale
        ctx.drawImage(photo, (W - dw) / 2, (PHOTO_H - dh) / 2, dw, dh)
        ctx.restore()
      } else {
        // No photo: brand logo centered on a navy gradient stage
        const pg = ctx.createLinearGradient(0, 0, W, PHOTO_H)
        pg.addColorStop(0, "#003366")
        pg.addColorStop(1, "#001f3f")
        ctx.fillStyle = pg
        ctx.fillRect(0, 0, W, PHOTO_H)
        if (logo) {
          const ratio = logo.width / Math.max(1, logo.height)
          let lw = 560
          let lh = lw / ratio
          if (lh > 260) {
            lh = 260
            lw = lh * ratio
          }
          if (!brand.logoIsWhite) {
            ctx.fillStyle = "rgba(255,255,255,0.96)"
            rr(ctx, (W - lw) / 2 - 40, (PHOTO_H - lh) / 2 - 36, lw + 80, lh + 72, 30)
            ctx.fill()
          }
          ctx.drawImage(logo, (W - lw) / 2, (PHOTO_H - lh) / 2, lw, lh)
        }
      }
      // Fade the photo into the stage + gold seam
      const fade = ctx.createLinearGradient(0, PHOTO_H - 150, 0, PHOTO_H + 10)
      fade.addColorStop(0, "rgba(0,20,40,0)")
      fade.addColorStop(1, "#04142a")
      ctx.fillStyle = fade
      ctx.fillRect(0, PHOTO_H - 150, W, 170)
      ctx.fillStyle = "rgba(214,179,87,0.55)"
      ctx.fillRect(0, PHOTO_H + 4, W, 2)

      ctx.textAlign = "center"
      ctx.textBaseline = "alphabetic"

      // ══ Text stack: measure → shrink if needed → center in the zone ══
      const words = event.title.trim().split(/\s+/).filter(Boolean)
      const heroCount = words.length >= 4 ? 2 : 1 // last word(s) become the gold hero line
      const whitePart = words.slice(0, Math.max(0, words.length - heroCount)).join(" ").toUpperCase()
      const heroPart = words.slice(Math.max(0, words.length - heroCount)).join(" ").toUpperCase()

      const d = event.eventDate ? new Date(event.eventDate) : null
      const hasDate = !!d && !Number.isNaN(d.getTime())
      // Event times are Dubai time — force the zone so the flyer never bakes
      // in the generating machine's local clock.
      const dateTxt =
        hasDate && d
          ? d.toLocaleDateString("en-AE", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Dubai" }).toUpperCase()
          : ""
      const timeTxt =
        hasDate && d
          ? d.toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" }) + " (GST)"
          : ""

      // layout(f) measures all blocks at size factor f (fonts re-fitted each pass)
      const layout = (f: number) => {
        const scriptSize = Math.round(88 * f)
        const scriptH = Math.round(112 * f)

        let wSize = Math.round(66 * f)
        let wLines: string[] = []
        if (whitePart) {
          ctx.font = `900 ${wSize}px ${F}`
          wLines = wrapLines(ctx, whitePart, W - 120, 2)
          while (wLines.length === 2 && wSize > Math.round(46 * f)) {
            wSize -= 4
            ctx.font = `900 ${wSize}px ${F}`
            wLines = wrapLines(ctx, whitePart, W - 120, 2)
          }
          // A single unbreakable word can still overflow — keep shrinking until every line fits
          while (wLines.some((l) => ctx.measureText(l).width > W - 120) && wSize > 30) {
            wSize -= 4
            ctx.font = `900 ${wSize}px ${F}`
            wLines = wrapLines(ctx, whitePart, W - 120, 2)
          }
        }
        const whiteH = wLines.length * Math.round(wSize * 1.16) + (wLines.length ? 8 : 0)

        let hSize = Math.round(140 * f)
        ctx.font = `900 ${hSize}px ${F}`
        while (ctx.measureText(heroPart).width > W - 110 && hSize > 56) {
          hSize -= 6
          ctx.font = `900 ${hSize}px ${F}`
        }
        // At the 56px floor a very long hero can still overflow — ellipsize it
        let heroText = heroPart
        if (ctx.measureText(heroText).width > W - 110) {
          while (heroText.length > 2 && ctx.measureText(`${heroText}…`).width > W - 110) {
            heroText = heroText.slice(0, -1).trimEnd()
          }
          heroText += "…"
        }
        const heroH = Math.round(hSize * 1.04) + 20

        const dateH = hasDate ? Math.round(60 * f) : 0

        let venueLines: string[] = []
        const venueSize = Math.round(30 * f)
        if (event.venue) {
          ctx.font = `600 ${venueSize}px ${F}`
          venueLines = wrapLines(ctx, event.venue, W - 200, 2)
        }
        const venueH = venueLines.length * Math.round(venueSize * 1.4)

        return {
          scriptSize, scriptH, wSize, wLines, whiteH, hSize, heroText, heroH, dateH,
          venueSize, venueLines, venueH,
          total: scriptH + whiteH + heroH + dateH + venueH,
        }
      }

      const zoneH = ZONE_BOTTOM - ZONE_TOP
      let L = layout(1)
      if (L.total > zoneH) {
        L = layout(Math.max(0.72, zoneH / L.total))
      }
      let y = ZONE_TOP + Math.max(0, (zoneH - L.total) / 2)

      // Script "You're Invited"
      ctx.font = `italic 700 ${L.scriptSize}px ${SCRIPT}`
      ctx.fillStyle = goldGradient(ctx, y, y + L.scriptH)
      ctx.save()
      ctx.shadowColor = "rgba(214,179,87,0.45)"
      ctx.shadowBlur = 26
      ctx.fillText("You're Invited", W / 2, y + Math.round(L.scriptH * 0.72))
      ctx.restore()
      y += L.scriptH

      // White title lines
      if (L.wLines.length) {
        ctx.font = `900 ${L.wSize}px ${F}`
        ctx.fillStyle = "#ffffff"
        ctx.save()
        ctx.shadowColor = "rgba(0,10,30,0.8)"
        ctx.shadowBlur = 18
        for (const l of L.wLines) {
          ctx.fillText(l, W / 2, y + Math.round(L.wSize * 0.94))
          y += Math.round(L.wSize * 1.16)
        }
        ctx.restore()
        y += 8
      }

      // Metallic hero line
      ctx.font = `900 ${L.hSize}px ${F}`
      const heroBase = y + Math.round(L.hSize * 0.9)
      ctx.save()
      ctx.shadowColor = "rgba(214,179,87,0.55)"
      ctx.shadowBlur = 34
      ctx.fillStyle = goldGradient(ctx, heroBase - L.hSize, heroBase)
      ctx.fillText(L.heroText, W / 2, heroBase)
      ctx.restore()
      y += L.heroH

      // Date · time row with gold icons
      if (hasDate) {
        const rowBase = y + Math.round(L.dateH * 0.62)
        ctx.font = `800 34px ${F}`
        const dateW = ctx.measureText(dateTxt).width
        const timeW = ctx.measureText(timeTxt).width
        const iconSpace = 52
        const sepSpace = 56
        const total = iconSpace + dateW + sepSpace + iconSpace + timeW
        let x = W / 2 - total / 2
        miniIcon(ctx, "calendar", x + 18, rowBase - 12, 17, "#d6b357")
        ctx.textAlign = "left"
        ctx.fillStyle = "#ffffff"
        ctx.fillText(dateTxt, x + iconSpace, rowBase)
        x += iconSpace + dateW
        ctx.fillStyle = "#d6b357"
        ctx.fillText("|", x + sepSpace / 2 - 6, rowBase)
        x += sepSpace
        miniIcon(ctx, "clock", x + 18, rowBase - 12, 17, "#d6b357")
        ctx.fillStyle = "#ffffff"
        ctx.fillText(timeTxt, x + iconSpace, rowBase)
        ctx.textAlign = "center"
        y += L.dateH
      }

      // Venue
      if (L.venueLines.length) {
        ctx.font = `600 ${L.venueSize}px ${F}`
        const lineStep = Math.round(L.venueSize * 1.4)
        for (let i = 0; i < L.venueLines.length; i++) {
          const base = y + Math.round(lineStep * 0.72)
          if (i === 0) {
            const vw = ctx.measureText(L.venueLines[0]).width
            miniIcon(ctx, "pin", W / 2 - vw / 2 - 30, base - 11, 15, "#d6b357")
          }
          ctx.fillStyle = "rgba(255,255,255,0.92)"
          ctx.fillText(L.venueLines[i], W / 2, base)
          y += lineStep
        }
      }

      // ══ Bottom-anchored QR block (fixed positions — can't collide) ══
      const qrCanvas = qrRef.current?.querySelector("canvas")
      ctx.font = `900 34px ${F}`
      ctx.fillStyle = goldGradient(ctx, SCAN_Y - 30, SCAN_Y + 6)
      ctx.fillText("S C A N   T O   R E G I S T E R", W / 2, SCAN_Y)
      ctx.save()
      ctx.shadowColor = "rgba(214,179,87,0.35)"
      ctx.shadowBlur = 44
      ctx.fillStyle = "#ffffff"
      rr(ctx, W / 2 - QR_CARD / 2, QR_TOP, QR_CARD, QR_CARD, 26)
      ctx.fill()
      ctx.restore()
      if (qrCanvas) {
        ctx.drawImage(qrCanvas, W / 2 - QR_CARD / 2 + 22, QR_TOP + 22, QR_CARD - 44, QR_CARD - 44)
      }
      ctx.font = `900 30px ${F}`
      ctx.fillStyle = goldGradient(ctx, FREE_Y - 28, FREE_Y + 6)
      ctx.fillText("F R E E   R E G I S T R A T I O N", W / 2, FREE_Y)

      // Footer gold pill: globe + site
      ctx.font = `900 27px ${F}`
      const site = "fhiglobal.ae/events"
      const siteW = ctx.measureText(site).width
      const pillW = siteW + 118
      ctx.fillStyle = goldGradient(ctx, PILL_Y, PILL_Y + PILL_H)
      rr(ctx, W / 2 - pillW / 2, PILL_Y, pillW, PILL_H, PILL_H / 2)
      ctx.fill()
      miniIcon(ctx, "globe", W / 2 - pillW / 2 + 40, PILL_Y + PILL_H / 2, 15, "#001f3f")
      ctx.fillStyle = "#001f3f"
      ctx.textBaseline = "middle"
      ctx.fillText(site, W / 2 + 22, PILL_Y + PILL_H / 2 + 2)
      ctx.textBaseline = "alphabetic"

      if (alive) setRendering(false)
    }

    void draw()
    return () => {
      alive = false
    }
  }, [event, origin])

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement("a")
    a.href = canvas.toDataURL("image/png")
    const slug = event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40)
    a.download = `event-flyer-${slug || event.id.slice(0, 8)}.png`
    a.click()
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-[#e8eaed] shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-5">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-['Outfit'] font-bold text-[#001f3f]">Event flyer</h3>
          <button type="button" onClick={onClose} className="p-2 -mr-2 -mt-2 rounded-lg text-[#6b7280] hover:bg-[#f5f5f5]" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative rounded-xl overflow-hidden border border-[#e8eaed] bg-[#0a1220]">
          <canvas ref={canvasRef} width={W} height={H} className="w-full h-auto block" />
          {rendering && (
            <div className="absolute inset-0 bg-[#001428]/70 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Hidden QR source for the canvas composition */}
        <div ref={qrRef} className="hidden" aria-hidden>
          {origin && (
            <QRCodeCanvas
              value={`${origin}/events/${event.slug ?? event.id}?src=qr#register`}
              size={512}
              level="M"
              fgColor="#001f3f"
              marginSize={2}
            />
          )}
        </div>

        <button
          type="button"
          onClick={download}
          disabled={rendering}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#001f3f] text-white text-sm font-bold hover:bg-[#00356b] transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Download flyer (1080×1920 PNG)
        </button>
        <p className="mt-2 text-[11px] text-[#9ca3af] text-center">
          Story size — ready for WhatsApp status, Instagram, and print.
        </p>
      </div>
    </div>
  )
}
