"use client"

/**
 * Photo Logo — put logos on a photo and download the result.
 *
 * Nothing leaves the browser: the photo and any logo the user adds are read
 * with object URLs, edited on screen, and the download is drawn on a canvas
 * here. No upload, no API call, nothing stored.
 *
 * Every logo is kept in photo-relative units (centre x/y and width as a
 * fraction of the photo), so the on-screen preview and the full-resolution
 * download place it identically.
 */

import { useEffect, useRef, useState } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import { Check, ChevronLeft, ChevronRight, Download, GalleryHorizontal, ImagePlus, LayoutGrid, Loader2, Trash2, X } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { ROLES_PHOTO_LOGO, resolveAppRoleOrMember } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"

type Photo = { url: string; name: string; w: number; h: number }

type Logo = {
  id: string
  /** Which logo this is (its file, or "permit") — each can be on the photo only once. */
  key: string
  src: string
  name: string
  /** width / height of the logo image */
  aspect: number
  /** centre, as a fraction of the photo's width / height */
  x: number
  y: number
  /** width as a fraction of the photo's width */
  w: number
  /** The ad permit line only: its shadow strength, 0–200 (the image is redrawn when it changes). */
  shadow?: number
}

const PRESET_LOGOS = [
  { src: "/logos/FHI_Branding Set_PNG Copies-02.png", name: "FHI Global (dark)" },
  { src: "/logos/FHI_Branding_White.png", name: "FHI Global (light)", dark: true },
  { src: "/logos/global_partner.png", name: "Global Partners" },
  { src: "/logos/photo-logo/filipinohomes-dark.png", name: "Filipinohomes (dark)" },
  { src: "/logos/photo-logo/filipinohomes-light.png", name: "Filipinohomes (light)", dark: true },
  { src: "/logos/photo-logo/rent-ph.png", name: "Rent.ph" },
  { src: "/logos/photo-logo/homes-ph.png", name: "Homes.ph" },
  { src: "/logos/photo-logo/homes-ph-light.png", name: "Homes.ph (light)", dark: true },
  { src: "/logos/photo-logo/rentsouq-ae.png", name: "Rentsouq.ae" },
]

/** The company's ad permit line — fixed, not editable — drawn as white text with a shadow. */
const PERMIT_TEXT = "FHI Global Ad Permit No. 145225"
const DEFAULT_SHADOW = 100
const PERMIT_KEY = "permit"

/**
 * The permit line drawn at high resolution into a transparent PNG, so it
 * moves, resizes and downloads exactly like a logo. `shadow` 0–100 sets the
 * shadow's darkness and spread; 100–200 keeps that shadow and stacks up to two
 * more of the same on top, so it only gets denser. The canvas size doesn't
 * depend on it, so the line keeps its size and place when the shadow changes.
 */
async function textImage(text: string, shadow: number): Promise<string> {
  const family = getComputedStyle(document.body).fontFamily || "Arial, Helvetica, sans-serif"
  const size = 160
  const font = `600 ${size}px ${family}`
  await document.fonts?.load(font).catch(() => undefined)
  const pad = Math.round(size * 0.5)
  const t = clamp(shadow, 0, 100) / 100
  const extra = clamp(shadow - 100, 0, 100) / 100
  const measure = document.createElement("canvas").getContext("2d")
  if (!measure) throw new Error("Your browser couldn't draw the text.")
  measure.font = font
  const canvas = document.createElement("canvas")
  canvas.width = Math.ceil(measure.measureText(text).width) + pad * 2
  canvas.height = Math.ceil(size * 1.3) + pad * 2
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Your browser couldn't draw the text.")
  ctx.font = font
  ctx.textBaseline = "middle"
  ctx.fillStyle = "#ffffff"
  const y = canvas.height / 2
  // Shadows first, drawn alone (the text far off the canvas, its shadow shifted
  // back in), so a stacked shadow never greys the white text; the text goes on last.
  const shadowPass = (alpha: number) => {
    const away = canvas.width + 1000
    ctx.shadowColor = `rgba(0, 0, 0, ${alpha})`
    ctx.shadowBlur = size * 0.36 * t
    ctx.shadowOffsetX = away
    ctx.shadowOffsetY = size * 0.06 * t
    ctx.fillText(text, pad - away, y)
  }
  if (t > 0) {
    shadowPass(Math.min(1, 1.3 * t))
    if (extra > 0) {
      shadowPass(extra)
      shadowPass(extra)
    }
  }
  ctx.shadowColor = "transparent"
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
  ctx.fillText(text, pad, y)
  return canvas.toDataURL("image/png")
}

// Preview zoom limits (the slider runs 50%–400%; 100% = the whole photo fits).
const ZOOM_MIN = 0.5
const ZOOM_MAX = 4
// Screen height NOT available to the photo at 100% zoom: the dashboard header
// (~73), the page padding (48) and the panel's padding + border (26) — so the
// whole photo shows without scrolling the page.
const FIT_OFFSET = 150

const MARGIN = 0.04 // of the photo's width, for the quick positions
// iOS Safari refuses canvases over ~16.7 MP; bigger photos are scaled down to fit on download.
const MAX_PIXELS = 16_000_000

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const newId = () => Math.random().toString(36).slice(2, 10)

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Could not read that image."))
    img.src = src
  })
}

type Drag =
  | { kind: "move"; id: string; startX: number; startY: number; x0: number; y0: number }
  | { kind: "resize"; id: string; cx: number; cy: number }

export default function PhotoLogoPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(ROLES_PHOTO_LOGO.includes(resolveAppRoleOrMember(role)))

  const [photo, setPhoto] = useState<Photo | null>(null)
  const [logos, setLogos] = useState<Logo[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Preview zoom: 1 = the whole photo fits the panel; above it the panel scrolls.
  const [zoom, setZoom] = useState(1)
  // The logo picker: the whole grid (default) or one sliding row.
  const [logoView, setLogoView] = useState<"slide" | "grid">("grid")
  const [error, setError] = useState<string | null>(null)

  const stageRef = useRef<HTMLDivElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const logoStrip = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  // Everything this page made with createObjectURL, revoked on leaving.
  const urls = useRef<Set<string>>(new Set())

  useEffect(() => {
    const made = urls.current
    return () => made.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  // Delete / arrows on the selected logo (not while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selected) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        removeLogo(selected)
        return
      }
      const step = e.shiftKey ? 0.02 : 0.004
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
      if (!d) return
      e.preventDefault()
      setLogos((ls) => ls.map((l) => (l.id === selected ? { ...l, x: clamp(l.x + d[0], 0, 1), y: clamp(l.y + d[1], 0, 1) } : l)))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  if (!allowed) return null

  const objectUrl = (f: File) => {
    const u = URL.createObjectURL(f)
    urls.current.add(u)
    return u
  }
  const dropUrl = (u: string) => {
    if (urls.current.has(u)) {
      URL.revokeObjectURL(u)
      urls.current.delete(u)
    }
  }

  const pickPhoto = async (f: File | undefined) => {
    if (!f) return
    if (!f.type.startsWith("image/")) return setError("That file isn't a photo.")
    setError(null)
    const url = objectUrl(f)
    try {
      const img = await loadImage(url)
      if (photo) dropUrl(photo.url)
      setZoom(1)
      setPhoto({ url, name: f.name.replace(/\.[^.]+$/, "") || "photo", w: img.naturalWidth, h: img.naturalHeight })
    } catch (e) {
      dropUrl(url)
      setError(e instanceof Error ? e.message : "Could not read that photo.")
    }
  }

  const isOnPhoto = (key: string) => logos.some((l) => l.key === key)

  const addLogo = async (key: string, src: string, name: string, w = 0.25, extra: Partial<Logo> = {}, at: "top-left" | "bottom-center" = "top-left") => {
    if (isOnPhoto(key)) return
    setError(null)
    try {
      const img = await loadImage(src)
      const aspect = img.naturalWidth / Math.max(1, img.naturalHeight)
      const ph = photo ? photo.w / photo.h : 16 / 9
      const h = (w / aspect) * ph // height as a fraction of the photo's height
      const id = newId()
      // New logos land top-left, each next one a little lower so they don't stack; the ad permit lands bottom-centre.
      const n = logos.length
      // Checked again here so a quick double-click can't add it twice.
      setLogos((ls) =>
        ls.some((l) => l.key === key)
          ? ls
          : [
              ...ls,
              at === "bottom-center"
                ? { ...extra, key, id, src, name, aspect, w, x: 0.5, y: 1 - MARGIN * ph - h / 2 }
                : { ...extra, key, id, src, name, aspect, w, x: MARGIN + w / 2, y: clamp(MARGIN * ph + h / 2 + n * 0.06, 0, 1 - h / 2) },
            ],
      )
      setSelected(id)
    } catch {
      setError(`Could not read ${name}.`)
    }
  }

  function removeLogo(id: string) {
    setLogos((ls) => ls.filter((l) => l.id !== id))
    setSelected((s) => (s === id ? null : s))
  }

  const update = (id: string, patch: Partial<Logo>) => setLogos((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))

  const addPermit = () =>
    textImage(PERMIT_TEXT, DEFAULT_SHADOW)
      .then((src) => addLogo(PERMIT_KEY, src, "Ad permit", 0.5, { shadow: DEFAULT_SHADOW }, "bottom-center"))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not add the permit."))

  /** Redraw the permit with a new shadow; a slower redraw never overwrites a newer value. */
  const setShadow = (id: string, shadow: number) => {
    update(id, { shadow })
    textImage(PERMIT_TEXT, shadow)
      .then((src) => setLogos((ls) => ls.map((l) => (l.id === id && l.shadow === shadow ? { ...l, src } : l))))
      .catch(() => undefined)
  }

  /** Snap to one of six spots (top or bottom row), keeping the margin from the edges. */
  const placeAt = (l: Logo, col: 0 | 1 | 2, row: 0 | 1 | 2) => {
    if (!photo) return
    const ratio = photo.w / photo.h
    const hw = l.w / 2
    const hh = (l.w / l.aspect) * ratio / 2
    const mx = MARGIN
    const my = MARGIN * ratio
    const x = [mx + hw, 0.5, 1 - mx - hw][col]
    const y = [my + hh, 0.5, 1 - my - hh][row]
    update(l.id, { x, y })
  }

  // ─── Drag (move + corner resize) ─────────────────────────────────────────
  const stageRect = () => stageRef.current?.getBoundingClientRect()

  const startMove = (e: ReactPointerEvent, l: Logo) => {
    e.stopPropagation()
    e.preventDefault()
    setSelected(l.id)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { kind: "move", id: l.id, startX: e.clientX, startY: e.clientY, x0: l.x, y0: l.y }
  }

  const startResize = (e: ReactPointerEvent, l: Logo) => {
    e.stopPropagation()
    e.preventDefault()
    const r = stageRect()
    if (!r) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { kind: "resize", id: l.id, cx: r.left + l.x * r.width, cy: r.top + l.y * r.height }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current
    const r = stageRect()
    if (!d || !r) return
    if (d.kind === "move") {
      const x = clamp(d.x0 + (e.clientX - d.startX) / r.width, 0, 1)
      const y = clamp(d.y0 + (e.clientY - d.startY) / r.height, 0, 1)
      update(d.id, { x, y })
    } else {
      const l = logos.find((v) => v.id === d.id)
      if (!l) return
      // Centre-to-corner distance → width.
      const dist = Math.hypot(e.clientX - d.cx, e.clientY - d.cy)
      const wPx = (2 * dist) / Math.sqrt(1 + 1 / (l.aspect * l.aspect))
      update(d.id, { w: clamp(wPx / r.width, 0.03, 1.5) })
    }
  }

  const endDrag = () => { drag.current = null }

  // ─── Download ────────────────────────────────────────────────────────────
  const download = async () => {
    if (!photo || busy) return
    setBusy(true)
    setError(null)
    try {
      const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (photo.w * photo.h)))
      const W = Math.round(photo.w * scale)
      const H = Math.round(photo.h * scale)
      const canvas = document.createElement("canvas")
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Your browser couldn't draw the image.")
      ctx.imageSmoothingQuality = "high"
      // JPG has no transparency — a see-through photo gets a white background.
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, W, H)
      ctx.drawImage(await loadImage(photo.url), 0, 0, W, H)
      for (const l of logos) {
        const img = await loadImage(l.src)
        const w = l.w * W
        const h = w / l.aspect
        ctx.drawImage(img, l.x * W - w / 2, l.y * H - h / 2, w, h)
      }
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/jpeg", 0.92),
      )
      if (!blob) throw new Error("Your browser couldn't save the image.")
      const href = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = href
      a.download = `${photo.name}-logo.jpg`
      a.click()
      setTimeout(() => URL.revokeObjectURL(href), 1000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.")
    } finally {
      setBusy(false)
    }
  }

  const sel = logos.find((l) => l.id === selected) ?? null
  const label = "mb-2 text-sm font-bold text-[#0d1117]"

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = "" }} />

      {error && (
        <p className="flex items-center justify-between gap-2 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss"><X className="h-4 w-4" /></button>
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        {/* Stage — stays in view while the controls scroll (lg and up) */}
        <div className="border border-[#e5e8ec] bg-[#f4f5f7] p-3 lg:sticky lg:top-0">
          {photo ? (
            <>
            {/* The fit size: as wide as the panel, as tall as the screen allows — whichever
                is smaller (cqw = the panel's width). Zoom scales it; past the fit, it scrolls. */}
            <div className="@container">
            <div
              className="flex overflow-auto"
              style={{ height: `calc(min(100cqw, (100dvh - ${FIT_OFFSET}px) * ${photo.w / photo.h}) / ${photo.w / photo.h})` }}
            >
            <div
              className="relative m-auto shrink-0 touch-none select-none"
              style={{ aspectRatio: `${photo.w} / ${photo.h}`, width: `calc(min(100cqw, (100dvh - ${FIT_OFFSET}px) * ${photo.w / photo.h}) * ${zoom})` }}
              ref={stageRef}
              onPointerDown={() => setSelected(null)}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="Your photo" draggable={false} className="absolute inset-0 h-full w-full" />
              {logos.map((l) => {
                const active = l.id === selected
                return (
                  <div
                    key={l.id}
                    onPointerDown={(e) => startMove(e, l)}
                    className={`absolute cursor-move ${active ? "outline-2 outline-dashed outline-[#d6b357]" : "hover:outline hover:outline-1 hover:outline-white/70"}`}
                    style={{
                      left: `${l.x * 100}%`,
                      top: `${l.y * 100}%`,
                      width: `${l.w * 100}%`,
                      aspectRatio: `${l.aspect}`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={l.src} alt={l.name} draggable={false} className="block h-full w-full" />
                    {active && (
                      <span
                        onPointerDown={(e) => startResize(e, l)}
                        className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize border-2 border-white bg-[#d6b357] shadow"
                        aria-label="Resize"
                      />
                    )}
                  </div>
                )
              })}
            </div>
            </div>
            </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => photoInput.current?.click()}
              className="flex h-[360px] w-full flex-col items-center justify-center gap-2 border border-dashed border-[#c9ced6] bg-white text-[#6b7280] transition-colors hover:border-[#001f3f] hover:text-[#001f3f]"
            >
              <ImagePlus className="h-8 w-8" />
              <span className="text-sm font-semibold">Choose a photo</span>
              <span className="text-xs text-[#9ca3af]">It stays on your device — nothing is uploaded</span>
            </button>
          )}
        </div>

        {/* Controls — on the left (first on a phone too) */}
        <div className="order-first space-y-5 border border-[#e5e8ec] bg-white p-4">
          <div>
            {photo && (
              <div className="mb-3">
                <Slider label="Photo zoom" value={Math.round(zoom * 100)} min={ZOOM_MIN * 100} max={ZOOM_MAX * 100} unit="%" onChange={(v) => setZoom(v / 100)} />
              </div>
            )}
            <button
              type="button"
              onClick={() => photoInput.current?.click()}
              className="flex h-10 w-full items-center justify-center gap-2 bg-[#001f3f] text-sm font-bold text-white hover:bg-[#0a3d6b]"
            >
              <ImagePlus className="h-4 w-4" /> {photo ? "Change photo" : "Choose photo"}
            </button>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-[#0d1117]">Add a logo</p>
              <div className="flex" role="group" aria-label="How to show the logos">
                {([
                  { v: "slide", Icon: GalleryHorizontal, title: "Slide" },
                  { v: "grid", Icon: LayoutGrid, title: "Grid" },
                ] as const).map(({ v, Icon, title }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setLogoView(v)}
                    aria-pressed={logoView === v}
                    title={title}
                    aria-label={title}
                    className={`flex h-7 w-8 items-center justify-center border ${logoView === v ? "border-[#001f3f] bg-[#001f3f] text-white" : "border-[#e5e8ec] text-[#6b7280] hover:border-[#001f3f]"}`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
            <div className={logoView === "slide" ? "relative" : ""}>
            {logoView === "slide" && (
              <>
                <button
                  type="button"
                  onClick={() => logoStrip.current?.scrollBy({ left: -(logoStrip.current.clientWidth), behavior: "smooth" })}
                  aria-label="Previous logos"
                  className="absolute inset-y-0 left-0 z-10 flex w-9 items-center justify-start bg-gradient-to-r from-white via-white/80 to-transparent text-[#001f3f] hover:text-[#d6b357]"
                >
                  <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={() => logoStrip.current?.scrollBy({ left: logoStrip.current.clientWidth, behavior: "smooth" })}
                  aria-label="Next logos"
                  className="absolute inset-y-0 right-0 z-10 flex w-9 items-center justify-end bg-gradient-to-l from-white via-white/80 to-transparent text-[#001f3f] hover:text-[#d6b357]"
                >
                  <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
                </button>
              </>
            )}
            <div
              ref={logoStrip}
              className={logoView === "slide"
                ? "flex snap-x snap-mandatory gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>button]:w-[calc((100%-1rem)/3)] [&>button]:shrink-0 [&>button]:snap-start"
                : "grid grid-cols-3 gap-2"}
            >
              {PRESET_LOGOS.map((p) => {
                const added = isOnPhoto(p.src)
                return (
                  <button
                    key={p.src}
                    type="button"
                    disabled={!photo || added}
                    onClick={() => void addLogo(p.src, p.src, p.name)}
                    title={added ? `${p.name} — already on the photo` : p.name}
                    className={`relative flex h-14 items-center justify-center border border-[#e5e8ec] p-1.5 transition-colors hover:border-[#001f3f] disabled:cursor-not-allowed disabled:opacity-40 ${p.dark ? "bg-[#001f3f]" : "bg-white"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.src} alt={p.name} className="max-h-full max-w-full object-contain" />
                    {added && (
                      <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center bg-[#d6b357]">
                        <Check className="h-3 w-3 text-[#001f3f]" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            </div>
          </div>

          <div>
            <p className={label}>Add the ad permit</p>
            <div className="flex gap-2">
              <span className="flex h-10 min-w-0 flex-1 items-center truncate border border-[#e5e8ec] bg-[#f4f5f7] px-2 text-sm text-[#374151]">
                {PERMIT_TEXT}
              </span>
              <button
                type="button"
                disabled={!photo || isOnPhoto(PERMIT_KEY)}
                onClick={() => void addPermit()}
                className="h-10 shrink-0 bg-[#001f3f] px-4 text-sm font-bold text-white hover:bg-[#0a3d6b] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isOnPhoto(PERMIT_KEY) ? "Added" : "Add"}
              </button>
            </div>
          </div>

          {logos.length > 0 && (
            <div>
              <p className={label}>Logos on the photo</p>
              <div className="space-y-1">
                {logos.map((l) => (
                  <div
                    key={l.id}
                    className={`flex items-center gap-2 border px-2 py-1.5 ${l.id === selected ? "border-[#d6b357] bg-[#fdf8ec]" : "border-[#e5e8ec]"}`}
                  >
                    <button type="button" onClick={() => setSelected(l.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <span className="flex h-7 w-10 shrink-0 items-center justify-center bg-[#c9ced6]/40">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={l.src} alt="" className="max-h-full max-w-full object-contain" />
                      </span>
                      <span className="truncate text-sm text-[#0d1117]">{l.name}</span>
                    </button>
                    <button type="button" onClick={() => removeLogo(l.id)} aria-label="Remove" title="Remove" className="text-[#6b7280] hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sel && (
            <div className="space-y-3 border-t border-[#e5e8ec] pt-4">
              <p className="text-sm font-bold text-[#0d1117]">Adjust · <span className="font-normal text-[#6b7280]">{sel.name}</span></p>
              <div className="flex gap-4">
                <div className="shrink-0">
                  <p className="mb-1 text-xs font-bold text-[#374151]">Position</p>
                  <div className="grid w-[108px] grid-cols-3 gap-1">
                    {([0, 2] as const).flatMap((row) =>
                      ([0, 1, 2] as const).map((col) => (
                        <button
                          key={`${row}${col}`}
                          type="button"
                          onClick={() => placeAt(sel, col, row)}
                          aria-label={`Move to ${["top", "middle", "bottom"][row]} ${["left", "centre", "right"][col]}`}
                          className="flex h-8 items-center justify-center border border-[#e5e8ec] hover:border-[#001f3f]"
                        >
                          <span className="h-2 w-2 bg-[#001f3f]" />
                        </button>
                      )),
                    )}
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <Slider label="Size" value={Math.round(sel.w * 100)} min={3} max={100} unit="%" onChange={(v) => update(sel.id, { w: v / 100 })} />
                  {sel.shadow !== undefined && (
                    <Slider label="Shadow" value={sel.shadow} min={0} max={200} unit="%" onChange={(v) => setShadow(sel.id, v)} />
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2 border-t border-[#e5e8ec] pt-4">
            <button
              type="button"
              disabled={!photo || busy}
              onClick={() => void download()}
              className="flex h-11 w-full items-center justify-center gap-2 bg-[#d6b357] text-sm font-bold text-[#001f3f] hover:bg-[#c9a548] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Slider({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-xs font-bold text-[#374151]">
        {label} <span className="font-normal text-[#6b7280]">{value}{unit}</span>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#001f3f]" />
    </label>
  )
}
