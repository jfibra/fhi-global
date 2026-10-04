// Shared pieces of the event flyers (event-flyer-modal.tsx): the canvas size,
// the event fields a flyer prints, the assets every design gets, and the small
// drawing helpers. Each design is its own file — gala.ts, editorial.ts,
// ticket.ts — drawing the same 1080×1920 story-size canvas.

import type { EventBrand } from "@/lib/events/brands"
import { eventDateRangeLabel, eventStartTime, normalizeEventDays } from "@/lib/events/dates"

export const W = 1080
export const H = 1920

export type FlyerEvent = {
  id: string
  slug: string | null
  title: string
  brand: string
  imageUrl: string | null
  eventDate: string | null
  /** Consecutive days (migration 071); 1 or missing for a one-day event. */
  eventDays?: number | null
  venue: string | null
  /** Where the event lives — /events/<slug>, or an agent's website (migration 057). */
  publicPath?: string
}

/** Everything a design draws from — loaded once, shared by all three. */
export type FlyerScene = {
  event: FlyerEvent
  brand: EventBrand
  /** The event poster (through the image proxy), or null. */
  photo: HTMLImageElement | null
  logo: HTMLImageElement | null
  /** The registration QR, drawn by qrcode.react. */
  qr: HTMLCanvasElement | null
  /** Outfit with fallbacks. */
  sans: string
  /** The short address printed in the footer. */
  site: string
  when: FlyerWhen
}

/** The event's dates, all in Dubai time. Null fields when it has no date yet. */
export type FlyerWhen = {
  /** "Monday, 5 October 2026" / "Friday 10 – Sunday 12 October 2026". */
  long: string | null
  /** "02:00 PM". */
  time: string | null
  days: number
  /** First day, for date tiles: "05", "OCT", "OCTOBER", "MONDAY", "2026". */
  day: string | null
  month: string | null
  monthLong: string | null
  weekday: string | null
  year: string | null
  /** Last day of a multi-day event, for "05–07". */
  lastDay: string | null
  /** A multi-day event that stays inside one month ("05–07 OCTOBER"). */
  sameMonth: boolean
  /** "5 – 7 October 2026" — the plain span. */
  plain: string | null
}

export function flyerWhen(event: FlyerEvent): FlyerWhen {
  const days = normalizeEventDays(event.eventDays ?? 1)
  const start = event.eventDate ? new Date(event.eventDate) : null
  if (!start || Number.isNaN(start.getTime())) {
    return { long: null, time: null, days, day: null, month: null, monthLong: null, weekday: null, year: null, lastDay: null, sameMonth: true, plain: null }
  }
  const part = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", { ...o, timeZone: "Asia/Dubai" })
  const last = new Date(start.getTime() + (days - 1) * 86_400_000)
  return {
    long: eventDateRangeLabel(event.eventDate, days, "long"),
    time: eventStartTime(event.eventDate),
    days,
    day: part(start, { day: "2-digit" }),
    month: part(start, { month: "short" }).toUpperCase().slice(0, 3),
    monthLong: part(start, { month: "long" }).toUpperCase(),
    weekday: part(start, { weekday: "long" }).toUpperCase(),
    year: part(start, { year: "numeric" }),
    lastDay: days > 1 ? part(last, { day: "2-digit" }) : null,
    sameMonth: part(start, { month: "numeric", year: "numeric" }) === part(last, { month: "numeric", year: "numeric" }),
    plain: eventDateRangeLabel(event.eventDate, days, "plain"),
  }
}

/** The big date of a tile — "05", or "05–07" for a multi-day event within one month. */
export function bigDay(w: FlyerWhen): string {
  return w.days > 1 && w.sameMonth && w.lastDay ? `${w.day}–${w.lastDay}` : (w.day ?? "")
}

/** The line under/next to the big date — "OCTOBER 2026", or the whole span when it crosses months. */
export function monthLine(w: FlyerWhen): string {
  return w.days > 1 && !w.sameMonth && w.plain ? w.plain.toUpperCase() : `${w.monthLong ?? ""} ${w.year ?? ""}`.trim()
}

/** "MONDAY", or "3-DAY EVENT". */
export function dayLine(w: FlyerWhen): string {
  return w.days > 1 ? `${w.days}-DAY EVENT` : (w.weekday ?? "")
}

/** Letter-spaced caps, drawn char by char (canvas letterSpacing isn't everywhere yet). */
export function drawSpaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
  align: "center" | "left" | "right" = "center",
) {
  const chars = [...text]
  const widths = chars.map((c) => ctx.measureText(c).width)
  const total = widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, chars.length - 1)
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x
  const prev = ctx.textAlign
  ctx.textAlign = "left"
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y)
    cx += widths[i] + tracking
  })
  ctx.textAlign = prev
  return total
}

/** Width drawSpaced would take. */
export function spacedWidth(ctx: CanvasRenderingContext2D, text: string, tracking: number) {
  const chars = [...text]
  return chars.reduce((a, c) => a + ctx.measureText(c).width, 0) + tracking * Math.max(0, chars.length - 1)
}

/** The event's page, and the short address printed in the flyer's footer. */
export function flyerTarget(event: FlyerEvent) {
  const path = event.publicPath ?? `/events/${event.slug ?? event.id}`
  const site = path.match(/^\/website\/([^/]+)/)
  return { path, label: site ? `fhiglobal.ae/website/${site[1]}` : "fhiglobal.ae/events" }
}

/** Remote photos load through the same-origin proxy so the canvas stays exportable. */
export function proxied(url: string) {
  return `/api/map-marker-image?url=${encodeURIComponent(url)}`
}

export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

export const frac = (n: number) => n - Math.floor(n)

/**
 * Greedy word-wrap capped at maxLines. The last allowed line is filled as far
 * as it goes; only words that still don't fit are cut, with "…".
 */
export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ""
  let i = 0
  for (; i < words.length; i++) {
    const probe = line ? `${line} ${words[i]}` : words[i]
    if (ctx.measureText(probe).width <= maxWidth || !line) {
      line = probe
    } else {
      if (lines.length === maxLines - 1) break // the last allowed line is full
      lines.push(line)
      line = words[i]
    }
  }
  if (line) lines.push(line)
  if (i < words.length && lines.length) {
    let last = lines[lines.length - 1]
    while (ctx.measureText(`${last}…`).width > maxWidth && last.includes(" ")) {
      last = last.slice(0, last.lastIndexOf(" "))
    }
    lines[lines.length - 1] = `${last}…`
  }
  return lines
}

/**
 * The text, wrapped, at the largest size from `start` down to `min` that fits
 * within maxLines and maxWidth. If even `min` can't: a title keeps every line
 * (agents complained about "…" on long titles — the design's layout scales the
 * stack down to fit instead); with `truncate` (venues), the last line is cut
 * with "…". Sets ctx.font to the result.
 */
export function fitLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: (size: number) => string,
  maxWidth: number,
  maxLines: number,
  start: number,
  min: number,
  opts: { truncate?: boolean } = {},
): { size: number; lines: string[] } {
  for (let size = start; size >= min; size -= 2) {
    ctx.font = font(size)
    const lines = wrapLines(ctx, text, maxWidth, Infinity)
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxWidth)) return { size, lines }
  }
  ctx.font = font(min)
  return { size: min, lines: wrapLines(ctx, text, maxWidth, opts.truncate ? maxLines : Infinity) }
}

/** Metallic gold gradient for text fills. */
export function goldGradient(ctx: CanvasRenderingContext2D, yTop: number, yBottom: number) {
  const g = ctx.createLinearGradient(0, yTop, 0, yBottom)
  g.addColorStop(0, "#f9e9a8")
  g.addColorStop(0.35, "#f0d890")
  g.addColorStop(0.65, "#c9a449")
  g.addColorStop(1, "#f3dd89")
  return g
}

/** Tiny stroke icons (calendar / clock / pin / globe). */
export function miniIcon(ctx: CanvasRenderingContext2D, kind: string, cx: number, cy: number, r: number, color: string) {
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
export function sparkle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, alpha: number) {
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

/** Where an image sits shown WHOLE inside a box, centred (no drawing). */
export function containRect(img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.min(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  return { x: x + (w - dw) / 2, y: y + (h - dh) / 2, w: dw, h: dh }
}

/** The image covering a box (cropped to fill), optionally blurred — for backdrops only. */
export function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, blur = 0) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  if (blur) ctx.filter = `blur(${blur}px)`
  const scale = Math.max(w / img.width, h / img.height) * (blur ? 1.15 : 1)
  ctx.drawImage(img, x + w / 2 - (img.width * scale) / 2, y + h / 2 - (img.height * scale) / 2, img.width * scale, img.height * scale)
  ctx.restore()
}

/**
 * The brand logo fitted into maxW × maxH, centred on x (or starting at x).
 * plate: "always" backs it — navy for white logos, white for the rest;
 * "dark-only" backs only white logos (on light paper); "light-only" backs
 * only coloured logos (on a navy panel, where a white logo needs nothing).
 * Returns the width taken.
 */
export function drawLogo(
  ctx: CanvasRenderingContext2D,
  s: FlyerScene,
  x: number,
  cy: number,
  maxW: number,
  maxH: number,
  opts: { align?: "center" | "left"; plate?: "always" | "dark-only" | "light-only" } = {},
): number {
  if (!s.logo) return 0
  const ratio = s.logo.width / Math.max(1, s.logo.height)
  let lw = maxW
  let lh = lw / ratio
  if (lh > maxH) {
    lh = maxH
    lw = lh * ratio
  }
  const plate = opts.plate ?? "always"
  const plated = plate === "always" || (plate === "dark-only" ? s.brand.logoIsWhite : !s.brand.logoIsWhite)
  const padX = plated ? 26 : 0
  const padY = plated ? 16 : 0
  const left = opts.align === "left" ? x + padX : x - lw / 2
  if (plated) {
    ctx.fillStyle = s.brand.logoIsWhite ? "#001f3f" : "#ffffff"
    rr(ctx, left - padX, cy - lh / 2 - padY, lw + padX * 2, lh + padY * 2, 14)
    ctx.fill()
  }
  ctx.drawImage(s.logo, left, cy - lh / 2, lw, lh)
  return lw + padX * 2
}
