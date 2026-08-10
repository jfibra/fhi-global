"use client"

// Birthday poster studio: pick a design, drop a photo into its frame, nudge
// and zoom it, type the celebrant's name, download a print-ready PNG.
//
// The photo is masked to the artwork's own painted opening rather than to a
// circle we guess at — the openings aren't perfectly round and one is clipped
// by a ribbon, so a geometric circle would spill over the frame. Each design's
// recognition rule lives in birthday-designs.ts.
//
// Everything happens on the client; nothing is uploaded, so the photo never
// leaves the machine.

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Cake, Check, Download, ImagePlus, Loader2, Maximize2, RotateCcw, Trash2, ZoomIn,
} from "lucide-react"
import {
  BIRTHDAY_DESIGNS,
  NAME_FILL,
  TEMPLATE_H,
  TEMPLATE_W,
  type BirthdayDesign,
  isWellPixel,
} from "./birthday-designs"

type Placement = { scale: number; dx: number; dy: number }
const DEFAULT_PLACEMENT: Placement = { scale: 1, dx: 0, dy: 0 }

type Loaded = { img: HTMLImageElement; mask: HTMLCanvasElement }

export function BirthdayStudio({ defaultName }: { defaultName?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const photoRef = useRef<HTMLImageElement | null>(null)
  // Templates and their derived masks, cached per design for the session.
  const cache = useRef<Map<string, Loaded>>(new Map())

  const [design, setDesign] = useState<BirthdayDesign>(BIRTHDAY_DESIGNS[0])
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [name, setName] = useState(defaultName ?? "")
  const [placement, setPlacement] = useState<Placement>(DEFAULT_PLACEMENT)
  const [hasPhoto, setHasPhoto] = useState(false)
  // Bumped whenever the image itself changes — photoRef is a ref, so without
  // this the canvas wouldn't repaint until some other state moved.
  const [photoVersion, setPhotoVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const drag = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null)

  // ── Load the active design and derive its photo mask ─────────────────────
  useEffect(() => {
    let cancelled = false
    const cached = cache.current.get(design.id)
    if (cached) {
      setLoaded(cached)
      return
    }
    setLoaded(null)
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      const probe = document.createElement("canvas")
      probe.width = TEMPLATE_W
      probe.height = TEMPLATE_H
      const pctx = probe.getContext("2d", { willReadFrequently: true })
      if (!pctx) { setError("Canvas is unavailable in this browser."); return }
      pctx.drawImage(img, 0, 0, TEMPLATE_W, TEMPLATE_H)

      const { x0, y0, x1, y1 } = design.well
      const w = x1 - x0
      const h = y1 - y0
      const region = pctx.getImageData(x0, y0, w, h)
      const d = region.data

      // Which pixels look like the opening…
      const match = new Uint8Array(w * h)
      for (let row = 0; row < h; row++) {
        for (let col = 0; col < w; col++) {
          const i = (row * w + col) * 4
          if (isWellPixel(design.wellTest, d[i], d[i + 1], d[i + 2])) match[row * w + col] = 1
        }
      }

      // …then keep only the blob connected to the opening itself. Without
      // this, background that happens to pass the test (marble flecks beside
      // the frame) joins the mask and the photo spills outside the ring.
      let seedRow = 0
      let seedCol = -1
      let widest = 0
      for (let row = 0; row < h; row++) {
        let first = -1
        let last = -1
        let n = 0
        for (let col = 0; col < w; col++) {
          if (match[row * w + col]) { if (first < 0) first = col; last = col; n++ }
        }
        // Prefer a row that is densely matched, not one bridged by specks.
        if (n > widest && last - first < n * 1.5) { widest = n; seedRow = row; seedCol = (first + last) >> 1 }
      }

      const keep = new Uint8Array(w * h)
      if (seedCol >= 0) {
        const stack = [seedRow * w + seedCol]
        keep[stack[0]] = 1
        while (stack.length) {
          const at = stack.pop()!
          const row = (at / w) | 0
          const col = at % w
          if (col > 0 && match[at - 1] && !keep[at - 1]) { keep[at - 1] = 1; stack.push(at - 1) }
          if (col < w - 1 && match[at + 1] && !keep[at + 1]) { keep[at + 1] = 1; stack.push(at + 1) }
          if (row > 0 && match[at - w] && !keep[at - w]) { keep[at - w] = 1; stack.push(at - w) }
          if (row < h - 1 && match[at + w] && !keep[at + w]) { keep[at + w] = 1; stack.push(at + w) }
        }
      }

      // Fill each row between the kept blob's own edges — the openings are
      // convex, so this closes interior gaps (one artwork has a placeholder
      // icon inside its frame) without ever reaching past the ring.
      const filled = new Uint8Array(w * h)
      for (let row = 0; row < h; row++) {
        let first = -1
        let last = -1
        for (let col = 0; col < w; col++) {
          if (keep[row * w + col]) { if (first < 0) first = col; last = col }
        }
        if (first >= 0) {
          for (let col = first; col <= last; col++) filled[row * w + col] = 1
        }
      }
      // Second pass down the columns: a bright sparkle ON the ring makes a
      // few boundary pixels fail the colour test, which notches the row fill.
      // The opening is convex, so the union of row spans and column spans is
      // exactly the opening — the notch closes, ribbon clips stay clipped.
      for (let col = 0; col < w; col++) {
        let first = -1
        let last = -1
        for (let row = 0; row < h; row++) {
          if (filled[row * w + col]) { if (first < 0) first = row; last = row }
        }
        if (first >= 0) {
          for (let row = first; row <= last; row++) filled[row * w + col] = 1
        }
      }
      for (let k = 0; k < w * h; k++) {
        const i = k * 4
        d[i] = d[i + 1] = d[i + 2] = 255
        d[i + 3] = filled[k] ? 255 : 0
      }

      const mask = document.createElement("canvas")
      mask.width = TEMPLATE_W
      mask.height = TEMPLATE_H
      mask.getContext("2d")?.putImageData(region, x0, y0)

      const entry = { img, mask }
      cache.current.set(design.id, entry)
      setLoaded(entry)
    }
    img.onerror = () => { if (!cancelled) setError(`Could not load the ${design.label} artwork.`) }
    img.src = design.src
    return () => { cancelled = true }
  }, [design])

  // ── Paint ────────────────────────────────────────────────────────────────
  const paint = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !loaded) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, TEMPLATE_W, TEMPLATE_H)
    ctx.drawImage(loaded.img, 0, 0, TEMPLATE_W, TEMPLATE_H)

    const photo = photoRef.current
    if (photo) {
      const { x0, y0, x1, y1 } = design.well
      const wellW = x1 - x0
      const wellH = y1 - y0
      const layer = document.createElement("canvas")
      layer.width = TEMPLATE_W
      layer.height = TEMPLATE_H
      const lctx = layer.getContext("2d")
      if (lctx) {
        // Cover the opening, then apply the user's zoom and offset.
        const base = Math.max(wellW / photo.width, wellH / photo.height)
        const s = base * placement.scale
        const dw = photo.width * s
        const dh = photo.height * s
        const cx = x0 + wellW / 2 + placement.dx
        const cy = y0 + wellH / 2 + placement.dy
        lctx.drawImage(photo, cx - dw / 2, cy - dh / 2, dw, dh)
        lctx.globalCompositeOperation = "destination-in"
        lctx.drawImage(loaded.mask, 0, 0)
        ctx.drawImage(layer, 0, 0)
      }
    }

    const text = name.trim().toUpperCase()
    if (text) {
      const cfg = design.name
      let size = cfg.size
      ctx.textAlign = "center"
      ctx.textBaseline = "alphabetic"
      const setFont = (px: number) => {
        ctx.font = `600 ${px}px "Cinzel", "Trajan Pro", Georgia, "Times New Roman", serif`
        ctx.letterSpacing = cfg.tracking ? `${(cfg.tracking * px) / cfg.size}px` : "0px"
      }
      setFont(size)
      while (ctx.measureText(text).width > cfg.maxWidth && size > 20) {
        size -= 2
        setFont(size)
      }
      const fill = NAME_FILL[cfg.style]
      const grad = ctx.createLinearGradient(0, cfg.baseline - size, 0, cfg.baseline + 6)
      grad.addColorStop(0, fill.from)
      grad.addColorStop(0.5, fill.mid)
      grad.addColorStop(1, fill.to)
      ctx.fillStyle = grad
      ctx.fillText(text, cfg.cx, cfg.baseline)
      ctx.letterSpacing = "0px"
    }
  }, [design, loaded, name, placement, photoVersion])

  useEffect(() => { paint() }, [paint])

  // ── Photo input ──────────────────────────────────────────────────────────
  const loadPhoto = (file: File) => {
    setError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        photoRef.current = img
        setHasPhoto(true)
        setPlacement({ ...DEFAULT_PLACEMENT })
        setPhotoVersion((v) => v + 1)
      }
      img.onerror = () => setError("That file isn't a readable image.")
      img.src = String(reader.result)
    }
    reader.onerror = () => setError("Could not read that file.")
    reader.readAsDataURL(file)
  }

  const removePhoto = () => {
    photoRef.current = null
    setHasPhoto(false)
    setPlacement({ ...DEFAULT_PLACEMENT })
    setPhotoVersion((v) => v + 1)
  }

  // ── Drag to reposition ───────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!hasPhoto) return
    e.preventDefault()
    drag.current = { x: e.clientX, y: e.clientY, dx: placement.dx, dy: placement.dy }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current
    if (!d) return
    const canvas = canvasRef.current
    // Preview is scaled down; convert pointer travel into template pixels.
    const k = canvas ? TEMPLATE_W / canvas.getBoundingClientRect().width : 1
    setPlacement((p) => ({ ...p, dx: d.dx + (e.clientX - d.x) * k, dy: d.dy + (e.clientY - d.y) * k }))
  }
  const onPointerUp = () => { drag.current = null }

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setBusy(true)
    try {
      const a = document.createElement("a")
      a.href = canvas.toDataURL("image/png")
      a.download = `birthday-${design.id}-${(name.trim() || "poster").replace(/\s+/g, "-").toLowerCase()}.png`
      a.click()
    } finally {
      setBusy(false)
    }
  }

  const label = "block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1.5"

  return (
    <div className="w-full">
      <div className="mb-5">
        <h1 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] flex items-center gap-2">
          <Cake className="w-6 h-6 text-[#001f3f]" />
          Birthday Poster
        </h1>
        <p className="text-sm text-[#6b7280] mt-1">
          Pick a design, add a photo, position it in the frame, type the name — then download a
          print-ready poster.
        </p>
      </div>

      {error && (
        <p className="mb-4 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_330px] gap-6 items-start">
        {/* Preview */}
        <div className="bg-[#f5f6f8] border border-[#e8eaed] p-4 flex justify-center">
          <div className="relative w-full max-w-[420px]">
            <canvas
              ref={canvasRef}
              width={TEMPLATE_W}
              height={TEMPLATE_H}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className={`w-full h-auto shadow-[0_10px_40px_-12px_rgba(0,20,45,0.45)] touch-none ${
                hasPhoto ? "cursor-move" : ""
              }`}
            />
            {!loaded && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                <Loader2 className="w-6 h-6 animate-spin text-[#9ca3af]" />
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <div className="bg-white border border-[#e8eaed] p-5">
            <p className={label}>Design</p>
            <div className="grid grid-cols-2 gap-2">
              {BIRTHDAY_DESIGNS.map((d) => {
                const active = d.id === design.id
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDesign(d)}
                    title={d.hint}
                    className={`relative text-left p-3 border transition-colors ${
                      active ? "border-[#001f3f] bg-[#f7f9fc]" : "border-[#dfe3e8] hover:border-[#001f3f]"
                    }`}
                  >
                    {active && (
                      <Check className="absolute top-2 right-2 w-3.5 h-3.5 text-[#001f3f]" />
                    )}
                    <span className="block text-[13px] font-bold text-[#0d1117] pr-4">{d.label}</span>
                    <span className="block text-[11px] text-[#6b7280] leading-snug mt-1">{d.hint}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="bg-white border border-[#e8eaed] p-5">
            <label className={label}>Celebrant&apos;s name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="e.g. Maria Santos"
              className="w-full px-3 py-2.5 border border-[#dfe3e8] bg-white text-sm text-[#0d1117] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f]"
            />
            <p className="text-[11px] text-[#9ca3af] mt-2">
              Drawn in the design&apos;s own lettering; long names shrink to fit.
            </p>
          </div>

          <div className="bg-white border border-[#e8eaed] p-5 space-y-4">
            <div>
              <label className={label}>Photo</label>
              <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#001f3f] text-white text-sm font-bold hover:bg-[#0a3d6b] transition-colors cursor-pointer">
                <ImagePlus className="w-4 h-4" />
                {hasPhoto ? "Replace photo" : "Choose photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) loadPhoto(f)
                    e.target.value = ""
                  }}
                />
              </label>
            </div>

            {hasPhoto && (
              <>
                <div>
                  <label className={label}>
                    <ZoomIn className="inline w-3.5 h-3.5 mr-1" />
                    Zoom
                  </label>
                  <input
                    type="range"
                    min={0.6}
                    max={2.6}
                    step={0.02}
                    value={placement.scale}
                    onChange={(e) => setPlacement((p) => ({ ...p, scale: Number(e.target.value) }))}
                    className="w-full accent-[#001f3f]"
                  />
                </div>

                <p className="flex items-start gap-2 text-[11px] text-[#6b7280]">
                  <Maximize2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#b8913f]" />
                  Drag the photo in the preview to move it inside the frame.
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPlacement(DEFAULT_PLACEMENT)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#dfe3e8] text-xs font-semibold text-[#374151] hover:border-[#001f3f] transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Re-centre
                  </button>
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#dfe3e8] text-xs font-semibold text-rose-600 hover:border-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={download}
            disabled={busy || !loaded}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#d6b357] text-[#1a1408] text-sm font-bold hover:brightness-95 disabled:opacity-60 transition-all"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download poster
          </button>
          <p className="text-[11px] text-[#9ca3af] text-center">
            PNG at {TEMPLATE_W}×{TEMPLATE_H} — good for print and social.
          </p>
        </div>
      </div>
    </div>
  )
}
