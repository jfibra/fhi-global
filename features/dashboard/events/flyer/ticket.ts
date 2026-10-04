// "Ticket" — the event as an admission ticket: the poster shown whole as a
// slightly tilted photo print over a blurred, darkened copy of itself, a gold
// "You're invited to" over the bold white title, then a white ticket with
// notched edges and a perforation — date, time and venue on the ticket, the
// registration QR on the tear-off stub — and the address in gold.
//
// The title is measured, shrunk if needed and centred in its zone; the ticket
// and footer sit at fixed positions, so nothing can collide.

import {
  H,
  W,
  bigDay,
  containRect,
  dayLine,
  drawCover,
  drawLogo,
  drawSpaced,
  fitLines,
  miniIcon,
  monthLine,
  spacedWidth,
  type FlyerScene,
} from "./shared"

const NAVY = "#0b2140"
const GOLD = "#a8842f"
const GOLD_LIGHT = "#d6b357"
const INK = "#3a4150"

const PRINT = { cx: W / 2, cy: 572, maxW: 780, maxH: 690, pad: 18, tilt: -2.2 }
const TITLE_TOP = 984
const TITLE_BOTTOM = 1322
const T = { x: 60, y: 1360, w: W - 120, h: 430, r: 26, notch: 28 }
const STUB_W = 360
const NOTCH_X = T.x + T.w - STUB_W

/** A ticket outline: rounded corners, a half-circle bite top and bottom at the perforation. */
function ticketPath(ctx: CanvasRenderingContext2D) {
  const { x, y, w, h, r, notch: n } = T
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(NOTCH_X - n, y)
  ctx.arc(NOTCH_X, y, n, Math.PI, 0, true)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(NOTCH_X + n, y + h)
  ctx.arc(NOTCH_X, y + h, n, 0, Math.PI, true)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

export function drawTicket(ctx: CanvasRenderingContext2D, s: FlyerScene) {
  const F = s.sans
  const { when } = s
  ctx.textBaseline = "alphabetic"
  ctx.textAlign = "center"

  // ── Backdrop: the poster, blurred and darkened, with a gold glow ──
  ctx.fillStyle = "#04162e"
  ctx.fillRect(0, 0, W, H)
  if (s.photo) {
    ctx.save()
    ctx.globalAlpha = 0.55
    drawCover(ctx, s.photo, 0, 0, W, H, 42)
    ctx.restore()
  }
  const shade = ctx.createLinearGradient(0, 0, 0, H)
  shade.addColorStop(0, "rgba(2,12,26,0.55)")
  shade.addColorStop(0.5, "rgba(2,12,26,0.72)")
  shade.addColorStop(1, "rgba(2,12,26,0.94)")
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(PRINT.cx, PRINT.cy, 60, PRINT.cx, PRINT.cy, 640)
  glow.addColorStop(0, "rgba(214,179,87,0.22)")
  glow.addColorStop(1, "rgba(214,179,87,0)")
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // ── Brand ──
  drawLogo(ctx, s, W / 2, 104, 300, 70)

  // ── The poster as a tilted photo print ──
  ctx.save()
  ctx.translate(PRINT.cx, PRINT.cy)
  ctx.rotate((PRINT.tilt * Math.PI) / 180)
  if (s.photo) {
    const inner = containRect(s.photo, -PRINT.maxW / 2, -PRINT.maxH / 2, PRINT.maxW, PRINT.maxH)
    ctx.save()
    ctx.shadowColor = "rgba(0,0,0,0.55)"
    ctx.shadowBlur = 50
    ctx.shadowOffsetY = 22
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(inner.x - PRINT.pad, inner.y - PRINT.pad, inner.w + PRINT.pad * 2, inner.h + PRINT.pad * 2)
    ctx.restore()
    ctx.drawImage(s.photo, inner.x, inner.y, inner.w, inner.h)
  } else {
    const w = 700
    const h = 560
    ctx.save()
    ctx.shadowColor = "rgba(0,0,0,0.55)"
    ctx.shadowBlur = 50
    ctx.shadowOffsetY = 22
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(-w / 2 - PRINT.pad, -h / 2 - PRINT.pad, w + PRINT.pad * 2, h + PRINT.pad * 2)
    ctx.restore()
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2)
    g.addColorStop(0, "#14345c")
    g.addColorStop(1, NAVY)
    ctx.fillStyle = g
    ctx.fillRect(-w / 2, -h / 2, w, h)
    drawLogo(ctx, s, 0, -40, 460, 170, { plate: "light-only" })
    ctx.fillStyle = GOLD_LIGHT
    ctx.font = `800 24px ${F}`
    drawSpaced(ctx, "AN EXCLUSIVE EVENT", 0, h / 2 - 70, 8)
  }
  ctx.restore()

  // ══ Title: measure → shrink if needed → centre in its zone ══
  const title = s.event.title.trim().toUpperCase()
  const layout = (f: number) => {
    const labelSize = Math.max(21, Math.round(26 * f))
    const labelH = Math.max(52, Math.round(64 * f))
    // The whole title, always — up to five lines before the stack shrinks.
    const t = fitLines(ctx, title, (z) => `900 ${z}px ${F}`, 950, 5, Math.round(90 * f), Math.round(34 * f))
    const step = Math.round(t.size * 1.1)
    return { f, labelSize, labelH, t, step, total: labelH + t.lines.length * step }
  }
  const zoneH = TITLE_BOTTOM - TITLE_TOP
  let L = layout(1)
  for (let f = 1; L.total > zoneH && f > 0.5; ) {
    f = Math.max(0.5, f * Math.min(0.96, zoneH / L.total))
    L = layout(f)
  }
  let y = TITLE_TOP + Math.max(0, (zoneH - L.total) / 2)
  ctx.font = `800 ${L.labelSize}px ${F}`
  ctx.fillStyle = GOLD_LIGHT
  drawSpaced(ctx, "YOU'RE INVITED TO", W / 2, y + Math.round(L.labelH * 0.55), 8)
  y += L.labelH
  ctx.font = `900 ${L.t.size}px ${F}`
  ctx.fillStyle = "#ffffff"
  ctx.save()
  ctx.shadowColor = "rgba(0,8,20,0.75)"
  ctx.shadowBlur = 22
  for (const line of L.t.lines) {
    ctx.fillText(line, W / 2, y + Math.round(L.t.size * 0.9))
    y += L.step
  }
  ctx.restore()

  // ══ The ticket ══
  ctx.save()
  ctx.shadowColor = "rgba(0,0,0,0.5)"
  ctx.shadowBlur = 46
  ctx.shadowOffsetY = 18
  ticketPath(ctx)
  ctx.fillStyle = "#ffffff"
  ctx.fill()
  ctx.restore()
  // Gold edge on the ticket's left
  ctx.save()
  ticketPath(ctx)
  ctx.clip()
  const edge = ctx.createLinearGradient(0, T.y, 0, T.y + T.h)
  edge.addColorStop(0, "#f0d890")
  edge.addColorStop(1, "#b8913f")
  ctx.fillStyle = edge
  ctx.fillRect(T.x, T.y, 16, T.h)
  ctx.restore()
  // Perforation
  ctx.save()
  ctx.strokeStyle = "#c9ced6"
  ctx.lineWidth = 3
  ctx.setLineDash([12, 12])
  ctx.beginPath()
  ctx.moveTo(NOTCH_X, T.y + T.notch + 10)
  ctx.lineTo(NOTCH_X, T.y + T.h - T.notch - 10)
  ctx.stroke()
  ctx.restore()

  // Left part: admit line, date, time, venue
  const lx = T.x + 58
  const maxW = NOTCH_X - 44 - lx
  ctx.textAlign = "left"
  let admitSize = 21
  ctx.font = `800 ${admitSize}px ${F}`
  while (spacedWidth(ctx, "ADMIT ONE · FREE REGISTRATION", 3) > maxW && admitSize > 14) {
    admitSize -= 1
    ctx.font = `800 ${admitSize}px ${F}`
  }
  ctx.fillStyle = GOLD
  drawSpaced(ctx, "ADMIT ONE · FREE REGISTRATION", lx, T.y + 66, 3, "left")

  if (when.long) {
    const day = bigDay(when)
    const l1 = monthLine(when)
    const l2 = dayLine(when)
    let big = 128
    let mid = 40
    const fits = () => {
      ctx.font = `900 ${big}px ${F}`
      const dw = ctx.measureText(day).width
      ctx.font = `800 ${mid}px ${F}`
      const cw = Math.max(ctx.measureText(l1).width, spacedWidth(ctx, l2, 3))
      return dw + 26 + cw <= maxW
    }
    while (!fits() && big > 70) {
      big -= 6
      mid = Math.max(26, mid - 2)
    }
    ctx.font = `900 ${big}px ${F}`
    ctx.fillStyle = NAVY
    ctx.fillText(day, lx, T.y + 204)
    const cx = lx + ctx.measureText(day).width + 26
    ctx.font = `800 ${mid}px ${F}`
    ctx.fillText(l1, cx, T.y + 154)
    ctx.fillStyle = GOLD
    ctx.font = `800 ${Math.round(mid * 0.6)}px ${F}`
    drawSpaced(ctx, l2, cx, T.y + 196, 3, "left")
  } else {
    ctx.fillStyle = NAVY
    ctx.font = `800 34px ${F}`
    drawSpaced(ctx, "DATE TO BE ANNOUNCED", lx, T.y + 172, 3, "left")
  }
  ctx.fillStyle = "#e5e8ec"
  ctx.fillRect(lx, T.y + 236, maxW, 2)

  let rowY = T.y + 294
  if (when.time) {
    miniIcon(ctx, "clock", lx + 15, rowY - 11, 15, GOLD)
    ctx.fillStyle = INK
    ctx.font = `700 31px ${F}`
    ctx.fillText(`${when.days > 1 ? "From " : ""}${when.time} (GST)`, lx + 46, rowY)
    rowY += 54
  }
  if (s.event.venue) {
    // Shrinks to fit the ticket before it's ever cut.
    const v = fitLines(ctx, s.event.venue, (z) => `600 ${z}px ${F}`, maxW - 46, when.time ? 2 : 3, 29, 22, { truncate: true })
    miniIcon(ctx, "pin", lx + 15, rowY - 11, 15, GOLD)
    ctx.fillStyle = INK
    v.lines.forEach((line, i) => ctx.fillText(line, lx + 46, rowY + i * Math.round(v.size * 1.36)))
  }

  // Stub: the registration QR
  const sx = NOTCH_X + STUB_W / 2
  const qrSize = 236
  if (s.qr) ctx.drawImage(s.qr, sx - qrSize / 2, T.y + 48, qrSize, qrSize)
  ctx.textAlign = "center"
  ctx.fillStyle = NAVY
  ctx.font = `900 23px ${F}`
  drawSpaced(ctx, "SCAN TO REGISTER", sx, T.y + 334, 3)
  ctx.fillStyle = GOLD_LIGHT
  ctx.fillRect(sx - 30, T.y + 356, 60, 3)

  // ══ Footer: the address in gold ══
  let siteSize = 30
  ctx.font = `800 ${siteSize}px ${F}`
  while (ctx.measureText(s.site).width + 60 > W - 120 && siteSize > 18) {
    siteSize -= 1
    ctx.font = `800 ${siteSize}px ${F}`
  }
  const sw = ctx.measureText(s.site).width
  const fy = H - 66
  miniIcon(ctx, "globe", W / 2 - (sw + 46) / 2 + 15, fy - 10, 15, GOLD_LIGHT)
  ctx.fillStyle = GOLD_LIGHT
  ctx.fillText(s.site, W / 2 + 23, fy)
}
