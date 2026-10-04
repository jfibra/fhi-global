// "Editorial" — a light, magazine-style invitation (the Gala flyer's
// opposite mood): ivory paper inside a double gold border, the brand up top,
// the event poster shown whole on a white mat, "You are cordially invited to"
// over a serif title, a big date block, the venue, then the registration QR
// beside its call to action and a navy footer with the address.
//
// Fixed zones (poster, text, QR, footer); the text stack is measured, shrunk
// if needed and centred in its zone, so a long title or venue never runs into
// the QR.

import {
  H,
  W,
  bigDay,
  containRect,
  dayLine,
  drawLogo,
  drawSpaced,
  fitLines,
  miniIcon,
  monthLine,
  spacedWidth,
  wrapLines,
  type FlyerScene,
} from "./shared"

const SERIF = `Georgia, 'Times New Roman', serif`
const IVORY = "#f6f1e7"
const NAVY = "#0b2140"
const GOLD = "#a8842f"
const GOLD_LIGHT = "#d6b357"
const INK = "#3a4150"

const FOOTER_H = 112
/** Bottom edge of the outer border — everything above the footer sits inside it. */
const BORDER_BOTTOM = H - FOOTER_H - 26
const POSTER = { x: 96, y: 206, w: 888, h: 660 }
const TEXT_TOP = 900
const TEXT_BOTTOM = 1452
const QR_BOX = 252
const QR_TOP = BORDER_BOTTOM - 40 - QR_BOX

export function drawEditorial(ctx: CanvasRenderingContext2D, s: FlyerScene) {
  const F = s.sans
  const { when } = s
  ctx.textBaseline = "alphabetic"

  // ── Paper, with a soft warm vignette ──
  ctx.fillStyle = IVORY
  ctx.fillRect(0, 0, W, H)
  const vg = ctx.createRadialGradient(W / 2, H * 0.42, 220, W / 2, H * 0.42, 1250)
  vg.addColorStop(0, "rgba(255,255,255,0.6)")
  vg.addColorStop(1, "rgba(184,145,63,0.10)")
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, W, H)

  // ── Double invitation border (stops above the footer band) ──
  ctx.strokeStyle = GOLD_LIGHT
  ctx.lineWidth = 3
  ctx.strokeRect(34, 34, W - 68, BORDER_BOTTOM - 34)
  ctx.lineWidth = 1.2
  ctx.strokeRect(46, 46, W - 92, BORDER_BOTTOM - 58)

  // ── Header: brand left, label right, gold rule ──
  drawLogo(ctx, s, 80, 118, 300, 76, { align: "left", plate: "dark-only" })
  ctx.fillStyle = GOLD
  ctx.font = `800 22px ${F}`
  drawSpaced(ctx, "EXCLUSIVE INVITATION", W - 82, 126, 5, "right")
  ctx.fillStyle = GOLD_LIGHT
  ctx.fillRect(80, 176, W - 160, 2)

  // ── The poster, whole, on a white mat with a gold hairline ──
  if (s.photo) {
    const pad = 22
    const inner = containRect(s.photo, POSTER.x + pad, POSTER.y + pad, POSTER.w - pad * 2, POSTER.h - pad * 2)
    const mat = { x: inner.x - pad, y: inner.y - pad, w: inner.w + pad * 2, h: inner.h + pad * 2 }
    ctx.save()
    ctx.shadowColor = "rgba(11,33,64,0.22)"
    ctx.shadowBlur = 44
    ctx.shadowOffsetY = 18
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(mat.x, mat.y, mat.w, mat.h)
    ctx.restore()
    ctx.drawImage(s.photo, inner.x, inner.y, inner.w, inner.h)
    ctx.strokeStyle = GOLD_LIGHT
    ctx.lineWidth = 2
    ctx.strokeRect(mat.x + 9, mat.y + 9, mat.w - 18, mat.h - 18)
  } else {
    // No photo: a navy plate with the brand, framed the same way
    ctx.save()
    ctx.shadowColor = "rgba(11,33,64,0.22)"
    ctx.shadowBlur = 44
    ctx.shadowOffsetY = 18
    const g = ctx.createLinearGradient(0, POSTER.y, 0, POSTER.y + POSTER.h)
    g.addColorStop(0, "#14345c")
    g.addColorStop(1, NAVY)
    ctx.fillStyle = g
    ctx.fillRect(POSTER.x, POSTER.y, POSTER.w, POSTER.h)
    ctx.restore()
    ctx.strokeStyle = GOLD_LIGHT
    ctx.lineWidth = 2
    ctx.strokeRect(POSTER.x + 14, POSTER.y + 14, POSTER.w - 28, POSTER.h - 28)
    drawLogo(ctx, s, W / 2, POSTER.y + POSTER.h / 2 - 30, 520, 200, { plate: "light-only" })
    ctx.fillStyle = GOLD_LIGHT
    ctx.font = `800 26px ${F}`
    drawSpaced(ctx, "AN EXCLUSIVE EVENT", W / 2, POSTER.y + POSTER.h - 90, 8)
  }

  // ══ Text stack: measure → shrink if needed → centre in its zone ══
  const title = s.event.title.trim()
  const layout = (f: number) => {
    const labelSize = Math.max(19, Math.round(24 * f))
    const labelH = Math.max(50, Math.round(62 * f))
    // The whole title, always — up to five lines before the stack shrinks.
    const t = fitLines(ctx, title, (z) => `700 ${z}px ${SERIF}`, 880, 5, Math.round(84 * f), Math.round(34 * f))
    const titleStep = Math.round(t.size * 1.17)
    const titleH = t.lines.length * titleStep
    const ornH = Math.round(70 * f)
    const bigSize = Math.round(136 * f)
    const dateH = when.long ? Math.round(150 * f) : Math.round(60 * f)
    const v = s.event.venue
      ? fitLines(ctx, s.event.venue, (z) => `600 ${z}px ${F}`, 800, 3, Math.round(30 * f), Math.round(24 * f), { truncate: true })
      : null
    const venueSize = v?.size ?? 0
    const venueLines = v?.lines ?? []
    const venueH = venueLines.length ? Math.round(30 * f) + venueLines.length * Math.round(venueSize * 1.42) : 0
    return { f, labelSize, labelH, t, titleStep, titleH, ornH, bigSize, dateH, venueSize, venueLines, venueH, total: labelH + titleH + ornH + dateH + venueH }
  }
  const zoneH = TEXT_BOTTOM - TEXT_TOP
  let L = layout(1)
  for (let f = 1; L.total > zoneH && f > 0.5; ) {
    f = Math.max(0.5, f * Math.min(0.96, zoneH / L.total))
    L = layout(f)
  }
  let y = TEXT_TOP + Math.max(0, (zoneH - L.total) / 2)

  // "You are cordially invited to" between two short gold rules
  ctx.font = `800 ${L.labelSize}px ${F}`
  ctx.fillStyle = GOLD
  const label = "YOU ARE CORDIALLY INVITED TO"
  const lw = spacedWidth(ctx, label, 5)
  const labelBase = y + Math.round(L.labelH * 0.55)
  drawSpaced(ctx, label, W / 2, labelBase, 5)
  ctx.fillStyle = GOLD_LIGHT
  ctx.fillRect(W / 2 - lw / 2 - 86, labelBase - L.labelSize * 0.38, 62, 2)
  ctx.fillRect(W / 2 + lw / 2 + 24, labelBase - L.labelSize * 0.38, 62, 2)
  y += L.labelH

  // Serif title, navy
  ctx.font = `700 ${L.t.size}px ${SERIF}`
  ctx.fillStyle = NAVY
  ctx.textAlign = "center"
  for (const line of L.t.lines) {
    ctx.fillText(line, W / 2, y + Math.round(L.t.size * 0.92))
    y += L.titleStep
  }

  // Ornament: a gold diamond between hairlines
  const oy = y + L.ornH / 2
  ctx.fillStyle = GOLD_LIGHT
  ctx.fillRect(W / 2 - 150, oy - 1, 120, 2)
  ctx.fillRect(W / 2 + 30, oy - 1, 120, 2)
  ctx.save()
  ctx.translate(W / 2, oy)
  ctx.rotate(Math.PI / 4)
  ctx.fillRect(-9, -9, 18, 18)
  ctx.restore()
  y += L.ornH

  // Date block: big day │ weekday / month year / time
  if (when.long) {
    const f = L.f
    const day = bigDay(when)
    ctx.font = `900 ${L.bigSize}px ${F}`
    const dayW = ctx.measureText(day).width
    const l1 = dayLine(when)
    const l2 = monthLine(when)
    const l3 = when.time ? `${when.days > 1 ? "FROM " : ""}${when.time} GST` : ""
    ctx.font = `800 ${Math.round(26 * f)}px ${F}`
    const w1 = spacedWidth(ctx, l1, 4)
    ctx.font = `800 ${Math.round(40 * f)}px ${F}`
    const w2 = ctx.measureText(l2).width
    ctx.font = `600 ${Math.round(29 * f)}px ${F}`
    const w3 = ctx.measureText(l3).width
    const colW = Math.max(w1, w2, w3)
    const gap = Math.round(38 * f)
    const groupW = dayW + gap * 2 + 3 + colW
    const x0 = W / 2 - groupW / 2
    ctx.textAlign = "left"
    ctx.fillStyle = NAVY
    ctx.font = `900 ${L.bigSize}px ${F}`
    ctx.fillText(day, x0, y + Math.round(L.dateH * 0.76))
    ctx.fillStyle = GOLD_LIGHT
    ctx.fillRect(x0 + dayW + gap, y + Math.round(16 * f), 3, L.dateH - Math.round(32 * f))
    const cx = x0 + dayW + gap * 2 + 3
    ctx.fillStyle = GOLD
    ctx.font = `800 ${Math.round(26 * f)}px ${F}`
    drawSpaced(ctx, l1, cx, y + Math.round(48 * f), 4, "left")
    ctx.fillStyle = NAVY
    ctx.font = `800 ${Math.round(40 * f)}px ${F}`
    ctx.fillText(l2, cx, y + Math.round(96 * f))
    ctx.fillStyle = INK
    ctx.font = `600 ${Math.round(29 * f)}px ${F}`
    ctx.fillText(l3, cx, y + Math.round(136 * f))
    ctx.textAlign = "center"
  } else {
    ctx.fillStyle = NAVY
    ctx.font = `800 ${Math.round(34 * L.f)}px ${F}`
    drawSpaced(ctx, "DATE TO BE ANNOUNCED", W / 2, y + Math.round(L.dateH * 0.7), 4)
  }
  y += L.dateH

  // Venue
  if (L.venueLines.length) {
    y += Math.round(30 * L.f)
    ctx.font = `600 ${L.venueSize}px ${F}`
    const step = Math.round(L.venueSize * 1.42)
    L.venueLines.forEach((line, i) => {
      const base = y + Math.round(step * 0.74)
      if (i === 0) {
        const vw = ctx.measureText(line).width
        miniIcon(ctx, "pin", W / 2 - vw / 2 - 30, base - 11, 15, GOLD)
      }
      ctx.fillStyle = INK
      ctx.fillText(line, W / 2, base)
      y += step
    })
  }

  // ══ QR: white card with a gold edge, call to action beside it ══
  ctx.save()
  ctx.shadowColor = "rgba(11,33,64,0.18)"
  ctx.shadowBlur = 30
  ctx.shadowOffsetY = 10
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(96, QR_TOP, QR_BOX, QR_BOX)
  ctx.restore()
  ctx.strokeStyle = GOLD_LIGHT
  ctx.lineWidth = 3
  ctx.strokeRect(96, QR_TOP, QR_BOX, QR_BOX)
  if (s.qr) ctx.drawImage(s.qr, 96 + 18, QR_TOP + 18, QR_BOX - 36, QR_BOX - 36)

  const tx = 96 + QR_BOX + 46
  const textW = W - 96 - tx
  ctx.textAlign = "left"
  ctx.fillStyle = NAVY
  ctx.font = `900 50px ${F}`
  ctx.fillText("Scan to register", tx, QR_TOP + 70)
  ctx.fillStyle = GOLD_LIGHT
  ctx.fillRect(tx, QR_TOP + 96, 70, 3)
  ctx.fillStyle = INK
  ctx.font = `500 30px ${F}`
  wrapLines(ctx, "Registration is free — just point your phone camera at the code.", textW, 2).forEach((line, i) => {
    ctx.fillText(line, tx, QR_TOP + 150 + i * 42)
  })
  ctx.textAlign = "center"

  // ══ Footer band: navy, gold hairline, the address ══
  ctx.fillStyle = NAVY
  ctx.fillRect(0, H - FOOTER_H, W, FOOTER_H)
  ctx.fillStyle = GOLD_LIGHT
  ctx.fillRect(0, H - FOOTER_H, W, 3)
  let siteSize = 32
  ctx.font = `800 ${siteSize}px ${F}`
  while (ctx.measureText(s.site).width + 70 > W - 120 && siteSize > 18) {
    siteSize -= 1
    ctx.font = `800 ${siteSize}px ${F}`
  }
  const sw = ctx.measureText(s.site).width
  const fy = H - FOOTER_H / 2 + 2
  miniIcon(ctx, "globe", W / 2 - (sw + 50) / 2 + 16, fy - 1, 16, GOLD_LIGHT)
  ctx.fillStyle = "#ffffff"
  ctx.textBaseline = "middle"
  ctx.fillText(s.site, W / 2 + 25, fy + 1)
  ctx.textBaseline = "alphabetic"
}
