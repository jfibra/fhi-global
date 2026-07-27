// Pure canvas renderer for the per-project Reels Studio: a 1080×1920 vertical
// reel — branded intro, Ken Burns photo slides with rotating caption cards,
// and a CTA outro with QR. drawReelFrame(t) is deterministic, so the same
// function drives the live preview loop AND the MediaRecorder export pass.

export const REEL_W = 1080
export const REEL_H = 1920

const GOLD = "#d6b357"
const NAVY_DEEP = "#001428"

export type ReelScene =
  | { kind: "intro"; dur: number }
  | { kind: "photo"; dur: number; photoIndex: number }
  | { kind: "outro"; dur: number }

export type ReelCaption = { title: string; sub: string }

export type ReelInputs = {
  title: string
  statusLine: string
  locationLine: string
  priceLine: string
  captions: ReelCaption[]
  contactPhone: string
  contactEmail: string
  developerName: string
}

export type ReelAssets = {
  logo: HTMLImageElement | null
  photos: HTMLImageElement[]
  qr: HTMLCanvasElement | null
  /** Resolved font stack (next/font hashed family + fallbacks). */
  font: string
}

const INTRO_S = 3.0
const PHOTO_S = 3.2
const OUTRO_S = 3.8
const XFADE_S = 0.5

export function buildReelTimeline(photoCount: number): ReelScene[] {
  const scenes: ReelScene[] = [{ kind: "intro", dur: INTRO_S }]
  for (let i = 0; i < photoCount; i++) scenes.push({ kind: "photo", dur: PHOTO_S, photoIndex: i })
  scenes.push({ kind: "outro", dur: OUTRO_S })
  return scenes
}

export function reelDuration(scenes: ReelScene[]): number {
  return scenes.reduce((a, s) => a + s.dur, 0)
}

/* ── easing ── */
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3)
const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
/** 0→1 ramp inside [a, b] of scene progress. */
const ramp = (p: number, a: number, b: number) => clamp01((p - a) / (b - a))

/* ── shared drawing helpers ── */

function fillCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  scale: number,
  panX: number,
  panY: number,
) {
  const base = Math.max(REEL_W / img.width, REEL_H / img.height) * scale
  const dw = img.width * base
  const dh = img.height * base
  const maxX = Math.max(0, (dw - REEL_W) / 2)
  const maxY = Math.max(0, (dh - REEL_H) / 2)
  ctx.drawImage(img, (REEL_W - dw) / 2 + panX * maxX, (REEL_H - dh) / 2 + panY * maxY, dw, dh)
}

function navyBackdrop(ctx: CanvasRenderingContext2D, glowY: number, glowStrength: number) {
  const g = ctx.createLinearGradient(0, 0, 0, REEL_H)
  g.addColorStop(0, "#00294f")
  g.addColorStop(0.55, NAVY_DEEP)
  g.addColorStop(1, "#000b18")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, REEL_W, REEL_H)

  const glow = ctx.createRadialGradient(REEL_W / 2, glowY, 0, REEL_W / 2, glowY, REEL_H * 0.45)
  glow.addColorStop(0, `rgba(214,179,87,${0.16 * glowStrength})`)
  glow.addColorStop(1, "rgba(214,179,87,0)")
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, REEL_W, REEL_H)
}

function goldCorners(ctx: CanvasRenderingContext2D, inset: number, len: number, alpha: number) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 6
  ctx.lineCap = "square"
  const corners: [number, number, number, number][] = [
    [inset, inset, 1, 1],
    [REEL_W - inset, inset, -1, 1],
    [inset, REEL_H - inset, 1, -1],
    [REEL_W - inset, REEL_H - inset, -1, -1],
  ]
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath()
    ctx.moveTo(cx + dx * len, cy)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx, cy + dy * len)
    ctx.stroke()
  }
  ctx.restore()
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, basePx: number, maxW: number, font: string): number {
  let size = basePx
  ctx.font = `${weight} ${size}px ${font}`
  while (ctx.measureText(text).width > maxW && size > 16) {
    size -= 2
    ctx.font = `${weight} ${size}px ${font}`
  }
  return size
}

function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, maxW: number, maxH: number, alpha = 1) {
  const s = Math.min(maxW / img.width, maxH / img.height)
  const dw = img.width * s
  const dh = img.height * s
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh)
  ctx.restore()
}

/* ── scenes ── */

function drawIntro(ctx: CanvasRenderingContext2D, p: number, inputs: ReelInputs, assets: ReelAssets) {
  navyBackdrop(ctx, REEL_H * 0.34, 0.7 + 0.3 * Math.sin(p * Math.PI))
  goldCorners(ctx, 70, 110, ramp(p, 0.1, 0.5))

  // logo
  if (assets.logo) {
    const a = ramp(p, 0.02, 0.3)
    const s = 0.92 + 0.08 * easeOutCubic(ramp(p, 0.02, 0.5))
    drawContain(ctx, assets.logo, REEL_W / 2, REEL_H * 0.36, REEL_W * 0.56 * s, 260 * s, a)
  }

  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"

  // project name
  {
    const a = ramp(p, 0.22, 0.5)
    const rise = (1 - easeOutCubic(a)) * 60
    ctx.save()
    ctx.globalAlpha = a
    ctx.fillStyle = "#ffffff"
    fitFont(ctx, inputs.title, 800, 84, REEL_W * 0.84, assets.font)
    ctx.fillText(inputs.title, REEL_W / 2, REEL_H * 0.55 + rise)
    ctx.restore()
  }

  // animated gold rule
  {
    const wRule = REEL_W * 0.32 * easeInOut(ramp(p, 0.35, 0.65))
    ctx.fillStyle = GOLD
    ctx.fillRect(REEL_W / 2 - wRule / 2, REEL_H * 0.585, wRule, 7)
  }

  // status + location
  {
    const a = ramp(p, 0.45, 0.72)
    ctx.save()
    ctx.globalAlpha = a
    ctx.fillStyle = GOLD
    fitFont(ctx, inputs.statusLine, 700, 36, REEL_W * 0.8, assets.font)
    ctx.fillText(inputs.statusLine, REEL_W / 2, REEL_H * 0.635)
    ctx.fillStyle = "rgba(255,255,255,0.85)"
    fitFont(ctx, inputs.locationLine, 500, 33, REEL_W * 0.8, assets.font)
    ctx.fillText(inputs.locationLine, REEL_W / 2, REEL_H * 0.675)
    ctx.restore()
  }
}

function drawPhoto(
  ctx: CanvasRenderingContext2D,
  p: number,
  photoIndex: number,
  photoCount: number,
  inputs: ReelInputs,
  assets: ReelAssets,
) {
  const img = assets.photos[photoIndex]
  if (img) {
    const zoomIn = photoIndex % 2 === 0
    const scale = zoomIn ? 1.05 + 0.13 * p : 1.18 - 0.13 * p
    const panDir = photoIndex % 4 < 2 ? 1 : -1
    fillCover(ctx, img, scale, panDir * (p - 0.5) * 0.5, 0)
  } else {
    navyBackdrop(ctx, REEL_H * 0.5, 0.6)
  }

  // scrims
  const scrim = ctx.createLinearGradient(0, REEL_H * 0.55, 0, REEL_H)
  scrim.addColorStop(0, "rgba(2,12,26,0)")
  scrim.addColorStop(1, "rgba(2,12,26,0.86)")
  ctx.fillStyle = scrim
  ctx.fillRect(0, REEL_H * 0.55, REEL_W, REEL_H * 0.45)
  const topScrim = ctx.createLinearGradient(0, 0, 0, 260)
  topScrim.addColorStop(0, "rgba(2,12,26,0.6)")
  topScrim.addColorStop(1, "rgba(2,12,26,0)")
  ctx.fillStyle = topScrim
  ctx.fillRect(0, 0, REEL_W, 260)

  // small logo top-left (multiply alpha so scene crossfades stay intact)
  if (assets.logo) {
    const s = Math.min(300 / assets.logo.width, 66 / assets.logo.height)
    ctx.save()
    ctx.globalAlpha *= 0.94
    ctx.drawImage(assets.logo, 64, 58, assets.logo.width * s, assets.logo.height * s)
    ctx.restore()
  }

  // caption card
  const enter = easeOutCubic(ramp(p, 0.04, 0.32))
  const caption = inputs.captions[photoIndex % Math.max(1, inputs.captions.length)]
  if (caption) {
    const cardW = REEL_W - 128
    const cardH = 240
    const cardX = 64
    const cardY = REEL_H - 176 - cardH + (1 - enter) * 90

    ctx.save()
    ctx.globalAlpha = enter
    ctx.fillStyle = "rgba(4,18,34,0.78)"
    ctx.beginPath()
    ctx.roundRect(cardX, cardY, cardW, cardH, 30)
    ctx.fill()
    ctx.fillStyle = GOLD
    ctx.beginPath()
    ctx.roundRect(cardX + 34, cardY + 46, 9, cardH - 92, 5)
    ctx.fill()

    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    ctx.fillStyle = "#ffffff"
    fitFont(ctx, caption.title, 800, 46, cardW - 140, assets.font)
    ctx.fillText(caption.title, cardX + 76, cardY + cardH * 0.4)
    ctx.fillStyle = GOLD
    fitFont(ctx, caption.sub, 600, 30, cardW - 140, assets.font)
    ctx.fillText(caption.sub, cardX + 76, cardY + cardH * 0.68)
    ctx.restore()
  }

  // progress dots
  {
    const dotsY = REEL_H - 120
    const gap = 30
    const totalW = (photoCount - 1) * gap + 44
    let x = REEL_W / 2 - totalW / 2
    for (let i = 0; i < photoCount; i++) {
      ctx.beginPath()
      if (i === photoIndex) {
        ctx.fillStyle = GOLD
        ctx.roundRect(x, dotsY - 6, 44, 12, 6)
        ctx.fill()
        x += 44 + gap - 14
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.4)"
        ctx.arc(x + 7, dotsY, 7, 0, Math.PI * 2)
        ctx.fill()
        x += gap
      }
    }
  }
}

function drawOutro(ctx: CanvasRenderingContext2D, p: number, inputs: ReelInputs, assets: ReelAssets) {
  navyBackdrop(ctx, REEL_H * 0.4, 1)
  goldCorners(ctx, 70, 110, ramp(p, 0.05, 0.35))

  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"

  {
    const a = ramp(p, 0.05, 0.3)
    ctx.save()
    ctx.globalAlpha = a
    ctx.fillStyle = GOLD
    ctx.font = `700 34px ${assets.font}`
    const spaced = "REGISTER YOUR INTEREST".split("").join("  ")
    fitFont(ctx, spaced, 700, 34, REEL_W * 0.86, assets.font)
    ctx.fillText(spaced, REEL_W / 2, REEL_H * 0.16)
    ctx.restore()
  }

  {
    const a = ramp(p, 0.15, 0.42)
    ctx.save()
    ctx.globalAlpha = a
    ctx.fillStyle = "#ffffff"
    fitFont(ctx, inputs.title, 800, 72, REEL_W * 0.84, assets.font)
    ctx.fillText(inputs.title, REEL_W / 2, REEL_H * 0.235 + (1 - easeOutCubic(a)) * 40)
    ctx.restore()
  }

  if (inputs.priceLine) {
    const a = ramp(p, 0.25, 0.5)
    ctx.save()
    ctx.globalAlpha = a
    ctx.fillStyle = GOLD
    fitFont(ctx, inputs.priceLine, 800, 48, REEL_W * 0.8, assets.font)
    ctx.fillText(inputs.priceLine, REEL_W / 2, REEL_H * 0.30)
    ctx.restore()
  }

  // QR plate
  if (assets.qr) {
    const pop = easeOutCubic(ramp(p, 0.3, 0.6))
    const plate = 460 * (0.9 + 0.1 * pop)
    const qrSize = plate - 70
    const cx = REEL_W / 2
    const cy = REEL_H * 0.52
    ctx.save()
    ctx.globalAlpha = pop
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.roundRect(cx - plate / 2, cy - plate / 2, plate, plate, 36)
    ctx.fill()
    ctx.drawImage(assets.qr, cx - qrSize / 2, cy - qrSize / 2, qrSize, qrSize)
    ctx.restore()

    ctx.save()
    ctx.globalAlpha = pop
    ctx.fillStyle = "rgba(255,255,255,0.75)"
    ctx.font = `500 30px ${assets.font}`
    ctx.fillText("Scan to view the project", cx, cy + plate / 2 + 64)
    ctx.restore()
  }

  {
    const a = ramp(p, 0.45, 0.7)
    ctx.save()
    ctx.globalAlpha = a
    ctx.fillStyle = "#ffffff"
    const contact = [inputs.contactPhone, inputs.contactEmail].filter(Boolean).join("   •   ")
    if (contact) {
      fitFont(ctx, contact, 600, 34, REEL_W * 0.86, assets.font)
      ctx.fillText(contact, REEL_W / 2, REEL_H * 0.82)
    }
    if (inputs.developerName) {
      ctx.fillStyle = GOLD
      const dev = `BY ${inputs.developerName.toUpperCase()}`
      fitFont(ctx, dev, 700, 27, REEL_W * 0.8, assets.font)
      ctx.fillText(dev, REEL_W / 2, REEL_H * 0.86)
    }
    ctx.restore()
  }

  // logo bottom
  if (assets.logo) {
    drawContain(ctx, assets.logo, REEL_W / 2, REEL_H * 0.93, REEL_W * 0.3, 90, ramp(p, 0.5, 0.75))
  }
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: ReelScene,
  p: number,
  photoCount: number,
  inputs: ReelInputs,
  assets: ReelAssets,
) {
  if (scene.kind === "intro") drawIntro(ctx, p, inputs, assets)
  else if (scene.kind === "photo") drawPhoto(ctx, p, scene.photoIndex, photoCount, inputs, assets)
  else drawOutro(ctx, p, inputs, assets)
}

/** Render the frame at absolute time t (seconds). Crossfades between scenes. */
export function drawReelFrame(
  ctx: CanvasRenderingContext2D,
  t: number,
  scenes: ReelScene[],
  inputs: ReelInputs,
  assets: ReelAssets,
) {
  const total = reelDuration(scenes)
  const time = Math.max(0, Math.min(t, total - 0.001))
  const photoCount = scenes.filter((s) => s.kind === "photo").length

  let acc = 0
  let idx = 0
  for (let i = 0; i < scenes.length; i++) {
    if (time < acc + scenes[i].dur) {
      idx = i
      break
    }
    acc += scenes[i].dur
  }
  const scene = scenes[idx]
  const local = time - acc
  const p = clamp01(local / scene.dur)

  ctx.save()
  drawScene(ctx, scene, p, photoCount, inputs, assets)
  ctx.restore()

  // crossfade into the next scene over the last XFADE_S of this one
  const remaining = scene.dur - local
  const next = scenes[idx + 1]
  if (next && remaining < XFADE_S) {
    const a = 1 - remaining / XFADE_S
    ctx.save()
    ctx.globalAlpha = easeInOut(a)
    drawScene(ctx, next, 0, photoCount, inputs, assets)
    ctx.restore()
  }
}

/** Load an image for canvas use (routed through the same-origin proxy). */
export function loadReelImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}
