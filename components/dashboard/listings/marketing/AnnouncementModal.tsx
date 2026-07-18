"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { X, Download, Loader2, Printer, Plus, Trash2, GripVertical, RotateCw } from "lucide-react"
import AnnouncementPoster, {
  POSTER_W,
  POSTER_HEIGHTS,
  ANNOUNCEMENT_TYPES,
  SKIN_LABELS,
  ACCENTS,
  BACKGROUNDS,
  RAIL_COLORS,
  LOGOS,
  resolveSkin,
  layerBase,
  type AnnouncementType,
  type PosterTheme,
  type PosterSize,
  type Layer,
} from "./AnnouncementPoster"
import { type FlyerData, proxied } from "@/lib/flyer/theme"
import { capturePng, warmFontEmbedCSS } from "@/lib/flyer/capture"

type MarketingData = FlyerData & { currency: string }

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://fhiglobal.ae").replace(/\/$/, "")
const TYPE_ORDER: AnnouncementType[] = ["just_listed", "just_sold", "officially_sold"]
const SKIN_ORDER: PosterTheme[] = ["light", "black", "green", "railnavy"]
const SIZE_ORDER: { key: PosterSize; label: string }[] = [
  { key: "default", label: "1200 × 800" },
  { key: "og", label: "Link · 1200 × 630" },
]
const MIN_SCALE = 0.4
const MAX_SCALE = 4
const HANDLES = ["nw", "ne", "sw", "se", "n", "s", "e", "w"] as const
type HandlePos = (typeof HANDLES)[number]

function Section({ label, right, children }: { label: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-wide text-[#6b7280]">{label}</p>
        {right}
      </div>
      {children}
    </div>
  )
}

function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-[11px] text-[#6b7280] mb-0.5">
        <span>{label}</span>
        <span className="font-mono text-[#9ca3af]">{Number.isInteger(value) ? value : value.toFixed(1)}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#001f3f]" />
    </div>
  )
}

function Swatches({ colors, value, auto, onPick }: { colors: string[]; value?: string; auto?: boolean; onPick: (c: string | undefined) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {auto && (
        <button type="button" onClick={() => onPick(undefined)} className={`w-6 h-6 rounded-md border-2 text-[9px] font-bold flex items-center justify-center ${value === undefined ? "border-[#001f3f] text-[#001f3f]" : "border-[#e5e5e5] text-[#9ca3af]"}`} title="Auto">A</button>
      )}
      {colors.map((c) => (
        <button key={c} type="button" onClick={() => onPick(c)} className={`w-6 h-6 rounded-md border-2 ${value === c ? "border-[#001f3f]" : "border-white shadow-sm"}`} style={{ backgroundColor: c }} title={c} />
      ))}
    </div>
  )
}

export default function AnnouncementModal({
  listingId,
  listingTitle,
  onClose,
}: {
  listingId: string
  listingTitle: string
  onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<MarketingData | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [type, setType] = useState<AnnouncementType>("just_listed")
  const [skinTheme, setSkinTheme] = useState<PosterTheme>("light")
  const [size, setSize] = useState<PosterSize>("default")
  const [accent, setAccent] = useState<string | undefined>()
  const [bgColor, setBgColor] = useState<string | undefined>()
  const [railColor, setRailColor] = useState<string | undefined>()
  const [backDark, setBackDark] = useState(35)
  // Logo / QR / text.
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoSize, setLogoSize] = useState(54)
  const [logoOutline, setLogoOutline] = useState(0)
  const [qrOn, setQrOn] = useState(true)
  const [qrSize, setQrSize] = useState(116)
  const [text, setText] = useState({ title: 100, tagline: 100, spec: 100, price: 100 })
  // Photo layers.
  const [layers, setLayers] = useState<Layer[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [scale, setScale] = useState(1)

  const posterRef = useRef<HTMLDivElement>(null)
  const scaleWrapRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const layerCounter = useRef(0)
  const dragLayerId = useRef<string | null>(null)

  const posterH = POSTER_HEIGHTS[size]
  const listingUrl = `${SITE_URL}/listings/${listingId}`
  const ratio = POSTER_W / posterH

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const res = await fetch(`/api/agent-listings/marketing-data?listingId=${encodeURIComponent(listingId)}`)
        const json = (await res.json()) as { data?: MarketingData; error?: string }
        if (cancelled) return
        if (!res.ok || !json.data) setError(json.error ?? "Could not load listing data")
        else {
          const pd: MarketingData = {
            ...json.data,
            image: json.data.image ? proxied(json.data.image) : null,
            gallery: (json.data.gallery ?? []).map(proxied),
            agent: { ...json.data.agent, imageUrl: json.data.agent.imageUrl ? proxied(json.data.agent.imageUrl) : "" },
          }
          setData(pd)
          const g = pd.gallery.length ? pd.gallery : pd.image ? [pd.image] : []
          setPhotos(g)
          // Seed the poster with the first photo as "Photo 1".
          if (g[0]) {
            layerCounter.current = 1
            setLayers([{ id: "layer-1", name: "Photo 1", url: g[0], tx: 0, ty: 0, sx: 1, sy: 1, rot: 0, aspect: ratio }])
            setSelectedId("layer-1")
          }
        }
      } catch {
        if (!cancelled) setError("Network error — please try again")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId])

  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth - 48
      const h = el.clientHeight - 72
      if (w > 0 && h > 0) setScale(Math.max(0.12, Math.min(w / POSTER_W, h / posterH)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [data, posterH])

  // Warm the cached font-embed CSS once the poster renders (fast first export).
  useEffect(() => {
    if (data) warmFontEmbedCSS(posterRef.current)
  }, [data])

  const skin = useMemo(() => resolveSkin(skinTheme, { accent, bgColor, railColor, backDark }), [skinTheme, accent, bgColor, railColor, backDark])

  const posterData: MarketingData | null = data
  const sel = layers.find((l) => l.id === selectedId) ?? null

  // ── Layer ops ──
  const patchSel = (p: Partial<Layer>) => setLayers((prev) => prev.map((l) => (l.id === selectedId ? { ...l, ...p } : l)))
  const setLayerAspect = (id: string, aspect: number) =>
    setLayers((prev) => {
      const l = prev.find((x) => x.id === id)
      if (!l || Math.abs(l.aspect - aspect) < 0.001) return prev
      return prev.map((x) => (x.id === id ? { ...x, aspect } : x))
    })
  const addLayer = (url: string) => {
    if (!url) return
    const existing = layers.find((l) => l.url === url)
    if (existing) {
      setSelectedId(existing.id)
      return
    }
    const n = (layerCounter.current += 1)
    const id = `layer-${n}`
    setLayers((prev) => [...prev, { id, name: `Photo ${n}`, url, tx: 0, ty: 0, sx: 1, sy: 1, rot: 0, aspect: ratio }])
    setSelectedId(id)
  }
  const removeLayer = (id: string) => {
    setLayers((prev) => prev.filter((l) => l.id !== id))
    setSelectedId((cur) => (cur === id ? null : cur))
  }
  const moveLayer = (fromId: string, toId: string) => {
    if (fromId === toId) return
    setLayers((prev) => {
      const from = prev.findIndex((l) => l.id === fromId)
      const to = prev.findIndex((l) => l.id === toId)
      if (from < 0 || to < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }
  const resetSel = () => patchSel({ tx: 0, ty: 0, sx: 1, sy: 1, rot: 0 })
  const clampScale = (n: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, n))

  // ── Frame geometry (poster px) ──
  const selBase = sel ? layerBase(sel.aspect || ratio, posterH) : { w: 0, h: 0 }
  const frameW = selBase.w * (sel?.sx ?? 1)
  const frameH = selBase.h * (sel?.sy ?? 1)
  const frameLeft = POSTER_W / 2 + (sel?.tx ?? 0) - frameW / 2
  const frameTop = posterH / 2 + (sel?.ty ?? 0) - frameH / 2

  // ── Move / resize / rotate ──
  // Window-listener drag: grab a layer and slide it in ONE gesture. The DOM is
  // updated directly on every pointer move (no React re-render → silky on any
  // skin), and committed to state once on release.
  const patchLayer = (id: string, patch: Partial<Layer>) =>
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))

  const beginDrag = (
    e: React.PointerEvent,
    spec: { mode: "move" | "resize" | "rotate"; layer: Layer; pos?: HandlePos },
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const { mode, layer, pos } = spec
    const startX = e.clientX
    const startY = e.clientY
    const startScale = scale || 1
    const base = layerBase(layer.aspect || ratio, posterH)
    const imgEl = posterRef.current?.querySelector(`[data-layer-id="${layer.id}"]`) as HTMLElement | null
    let pending = { tx: layer.tx, ty: layer.ty, sx: layer.sx, sy: layer.sy, rot: layer.rot }

    const apply = (t: typeof pending) => {
      pending = t
      if (imgEl) imgEl.style.transform = `translate(${t.tx}px, ${t.ty}px) rotate(${t.rot}deg) scale(${t.sx}, ${t.sy})`
      const f = frameRef.current
      if (f) {
        const fw = base.w * t.sx
        const fh = base.h * t.sy
        f.style.width = `${fw}px`
        f.style.height = `${fh}px`
        f.style.left = `${POSTER_W / 2 + t.tx - fw / 2}px`
        f.style.top = `${posterH / 2 + t.ty - fh / 2}px`
        f.style.transform = `rotate(${t.rot}deg)`
      }
    }

    const move = (ev: PointerEvent) => {
      if (ev.buttons === 0) return up()
      if (mode === "rotate") {
        const f = frameRef.current
        if (!f) return
        const r = f.getBoundingClientRect()
        let ang = (Math.atan2(ev.clientY - (r.top + r.height / 2), ev.clientX - (r.left + r.width / 2)) * 180) / Math.PI + 90
        const snap = Math.round(ang / 15) * 15
        if (Math.abs(snap - ang) < 4) ang = snap
        apply({ tx: layer.tx, ty: layer.ty, sx: layer.sx, sy: layer.sy, rot: Math.round(ang) })
        return
      }
      const dx = (ev.clientX - startX) / startScale
      const dy = (ev.clientY - startY) / startScale
      if (mode === "move") {
        apply({ tx: layer.tx + dx, ty: layer.ty + dy, sx: layer.sx, sy: layer.sy, rot: layer.rot })
        return
      }
      const rad = (layer.rot * Math.PI) / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      const ldx = dx * cos + dy * sin
      const ldy = -dx * sin + dy * cos
      let nsx = layer.sx
      let nsy = layer.sy
      let lcx = 0
      let lcy = 0
      const p = pos ?? "se"
      if (p.includes("e")) {
        nsx = clampScale(layer.sx + ldx / base.w)
        lcx = (base.w * (nsx - layer.sx)) / 2
      } else if (p.includes("w")) {
        nsx = clampScale(layer.sx - ldx / base.w)
        lcx = -(base.w * (nsx - layer.sx)) / 2
      }
      if (p.includes("s")) {
        nsy = clampScale(layer.sy + ldy / base.h)
        lcy = (base.h * (nsy - layer.sy)) / 2
      } else if (p.includes("n")) {
        nsy = clampScale(layer.sy - ldy / base.h)
        lcy = -(base.h * (nsy - layer.sy)) / 2
      }
      apply({ sx: nsx, sy: nsy, tx: layer.tx + (lcx * cos - lcy * sin), ty: layer.ty + (lcx * sin + lcy * cos), rot: layer.rot })
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      patchLayer(layer.id, pending)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  // One-gesture drag straight from the photo: select + start moving at once.
  const startLayerDrag = (id: string, e: React.PointerEvent) => {
    const layer = layers.find((l) => l.id === id)
    if (!layer) return
    setSelectedId(id)
    beginDrag(e, { mode: "move", layer })
  }
  const startMove = (e: React.PointerEvent) => {
    if (sel) beginDrag(e, { mode: "move", layer: sel })
  }
  const startResize = (pos: HandlePos) => (e: React.PointerEvent) => {
    if (sel) beginDrag(e, { mode: "resize", layer: sel, pos })
  }
  const startRotate = (e: React.PointerEvent) => {
    if (sel) beginDrag(e, { mode: "rotate", layer: sel })
  }

  const captureDataUrl = useCallback(async (): Promise<string | null> => {
    const node = posterRef.current
    if (!node) return null
    try {
      return await capturePng(node, { width: POSTER_W, height: posterH })
    } catch (e) {
      console.error("Announcement capture failed", e)
      return null
    }
  }, [posterH])

  const safeName = (listingTitle || "listing").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || listingId

  const handleDownload = useCallback(async () => {
    if (!data) return
    setDownloading(true)
    try {
      const dataUrl = await captureDataUrl()
      if (!dataUrl) return
      const a = document.createElement("a")
      a.href = dataUrl
      a.download = `${safeName}-${type}.png`
      a.click()
    } catch (e) {
      console.error("Announcement export failed", e)
      setError("Export failed — try again")
    } finally {
      setDownloading(false)
    }
  }, [data, captureDataUrl, safeName, type])

  const handlePrint = useCallback(async () => {
    if (!data) return
    setPrinting(true)
    try {
      const dataUrl = await captureDataUrl()
      if (!dataUrl) return
      const iframe = document.createElement("iframe")
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0"
      document.body.appendChild(iframe)
      const doc = iframe.contentWindow?.document
      if (!doc) return
      doc.open()
      doc.write(`<html><head><style>@page{size:${POSTER_W}px ${posterH}px;margin:0}html,body{margin:0}img{width:${POSTER_W}px;height:${posterH}px;display:block}</style></head><body><img src="${dataUrl}"/></body></html>`)
      doc.close()
      iframe.onload = () => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        setTimeout(() => document.body.removeChild(iframe), 1000)
      }
    } catch (e) {
      console.error("Announcement print failed", e)
    } finally {
      setPrinting(false)
    }
  }, [data, captureDataUrl, posterH])

  const panelSkin = skinTheme === "light" || skinTheme === "railnavy"
  const fadeSkin = skinTheme === "black" || skinTheme === "green"
  const handleStyle = (pos: HandlePos): React.CSSProperties => {
    const s: React.CSSProperties = { position: "absolute", width: 14 / scale, height: 14 / scale, borderRadius: 4 / scale, background: "#fff", border: `${2 / scale}px solid #2563eb`, boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }
    const off = -7 / scale
    if (pos.includes("n")) s.top = off
    if (pos.includes("s")) s.bottom = off
    if (pos.includes("e")) s.right = off
    if (pos.includes("w")) s.left = off
    if (pos === "n" || pos === "s") { s.left = "50%"; s.marginLeft = -7 / scale }
    if (pos === "e" || pos === "w") { s.top = "50%"; s.marginTop = -7 / scale }
    return s
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-[#e8eaed] shadow-2xl w-full max-w-6xl h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#f0f0f0] gap-3">
          <div className="min-w-0">
            <h2 className="font-['Outfit'] text-lg font-bold text-[#001f3f]">Just Listed / Sold</h2>
            <p className="text-xs text-[#6b7280] truncate max-w-md">{listingTitle}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => void handlePrint()} disabled={loading || printing || !data} title="Print" className="p-2 rounded-lg border border-[#e5e5e5] text-[#374151] hover:border-[#001f3f] disabled:opacity-50">
              {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            </button>
            <button type="button" onClick={() => void handleDownload()} disabled={loading || downloading || !data} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white text-sm font-semibold shadow-md hover:shadow-lg disabled:opacity-50 transition-all">
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloading ? "Exporting…" : "Download"}
            </button>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-[#6b7280] hover:bg-[#f5f5f5]" aria-label="Close"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-sm text-[#9ca3af]"><Loader2 className="w-5 h-5 animate-spin" /> Loading listing…</div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-sm text-rose-600">{error}</div>
        ) : data && posterData ? (
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
            {/* Center: preview */}
            <div ref={areaRef} className="flex-1 min-w-0 order-2 lg:order-1 overflow-auto p-6 bg-[#f1f2f4] flex items-center justify-center">
              <div style={{ position: "relative", width: POSTER_W * scale, height: posterH * scale, flexShrink: 0 }}>
                <div ref={scaleWrapRef} style={{ position: "absolute", top: 0, left: 0, width: POSTER_W, height: posterH, transformOrigin: "top left", transform: `scale(${scale})` }}>
                  <AnnouncementPoster
                    ref={posterRef}
                    data={posterData}
                    type={type}
                    listingUrl={listingUrl}
                    size={size}
                    skin={skin}
                    layers={layers}
                    logo={{ url: logoUrl, size: logoSize, outline: logoOutline }}
                    qr={{ on: qrOn, size: qrSize }}
                    text={text}
                    interactive
                    selectedId={selectedId}
                    onLayerPointerDown={startLayerDrag}
                    onBackgroundPointerDown={() => setSelectedId(null)}
                    onLayerAspect={setLayerAspect}
                  />
                  {/* Selection frame (preview-only; sibling of the exported poster). */}
                  {sel && (
                    <div
                      ref={frameRef}
                      onPointerDown={startMove}
                      style={{
                        position: "absolute",
                        left: frameLeft,
                        top: frameTop,
                        width: frameW,
                        height: frameH,
                        transform: `rotate(${sel.rot}deg)`,
                        transformOrigin: "center",
                        border: `${2 / scale}px dashed rgba(37,99,235,0.9)`,
                        cursor: "grab",
                        touchAction: "none",
                        zIndex: 40,
                      }}
                    >
                      {HANDLES.map((pos) => (
                        <div key={pos} onPointerDown={startResize(pos)} style={handleStyle(pos)} />
                      ))}
                      {/* Rotate handle */}
                      <div style={{ position: "absolute", left: "50%", top: -34 / scale, width: 2 / scale, height: 26 / scale, marginLeft: -1 / scale, background: "rgba(37,99,235,0.9)" }} />
                      <div
                        onPointerDown={startRotate}
                        style={{ position: "absolute", left: "50%", top: -34 / scale, width: 26 / scale, height: 26 / scale, marginLeft: -13 / scale, marginTop: -26 / scale, borderRadius: "50%", background: "#fff", border: `${2 / scale}px solid #2563eb`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
                      >
                        <RotateCw style={{ width: 14 / scale, height: 14 / scale, color: "#2563eb" }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: controls */}
            <div className="lg:w-80 shrink-0 order-1 lg:order-2 border-b lg:border-b-0 lg:border-l border-[#f0f0f0] overflow-auto p-4 space-y-5 bg-[#fafafa]">
              {/* Logo */}
              <Section label="Logo">
                <div className="flex gap-2 overflow-x-auto pb-1 mb-2">
                  {LOGOS.map((l) => {
                    const active = (l.url ?? null) === logoUrl
                    const darkTile = l.tone === "light" // white artwork → dark tile so it shows
                    return (
                      <button
                        key={l.label}
                        type="button"
                        onClick={() => setLogoUrl(l.url ?? null)}
                        title={l.label}
                        className={`shrink-0 h-12 min-w-[64px] px-2 rounded-lg border-2 flex items-center justify-center ${active ? "border-[#001f3f]" : "border-[#e5e5e5]"}`}
                        style={{ backgroundColor: l.url ? (darkTile ? "#0f2c5c" : "#ffffff") : active ? "rgba(0,31,63,0.05)" : "#ffffff" }}
                      >
                        {l.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.url} alt={l.label} className="max-h-8 max-w-[80px] object-contain" />
                        ) : (
                          <span className="text-xs font-bold text-[#001f3f]">Auto</span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <Slider label="Size" value={logoSize} min={28} max={120} step={0.01} unit="px" onChange={setLogoSize} />
                <Slider label="White outline" value={logoOutline} min={0} max={16} step={0.01} unit="px" onChange={setLogoOutline} />
              </Section>

              {/* Announcement */}
              <Section label="Announcement">
                <div className="grid grid-cols-1 gap-2">
                  {TYPE_ORDER.map((k) => (
                    <button key={k} type="button" onClick={() => setType(k)} className={`px-3 py-2 rounded-xl text-sm font-semibold text-left border ${type === k ? "border-[#001f3f] bg-[#001f3f]/5 text-[#001f3f]" : "border-[#e5e5e5] text-[#374151] hover:border-[#001f3f]/40"}`}>
                      {ANNOUNCEMENT_TYPES[k].label}
                    </button>
                  ))}
                </div>
              </Section>

              {/* Style + size */}
              <Section label="Style">
                <div className="grid grid-cols-2 gap-2">
                  {SKIN_ORDER.map((k) => (
                    <button key={k} type="button" onClick={() => setSkinTheme(k)} className={`px-3 py-2 rounded-xl text-sm font-semibold border ${skinTheme === k ? "border-[#001f3f] bg-[#001f3f]/5 text-[#001f3f]" : "border-[#e5e5e5] text-[#374151] hover:border-[#001f3f]/40"}`}>{SKIN_LABELS[k]}</button>
                  ))}
                </div>
              </Section>
              <Section label="Size">
                <div className="grid grid-cols-2 gap-2">
                  {SIZE_ORDER.map((s) => (
                    <button key={s.key} type="button" onClick={() => setSize(s.key)} className={`px-2 py-2 rounded-xl text-xs font-semibold border ${size === s.key ? "border-[#001f3f] bg-[#001f3f]/5 text-[#001f3f]" : "border-[#e5e5e5] text-[#374151] hover:border-[#001f3f]/40"}`}>{s.label}</button>
                  ))}
                </div>
              </Section>

              {/* Text sizes */}
              <Section label="Text size">
                <Slider label="Title" value={text.title} min={50} max={150} step={1} unit="%" onChange={(v) => setText((t) => ({ ...t, title: v }))} />
                <Slider label="Subtitle" value={text.tagline} min={50} max={150} step={1} unit="%" onChange={(v) => setText((t) => ({ ...t, tagline: v }))} />
                <Slider label="Attributes" value={text.spec} min={50} max={150} step={1} unit="%" onChange={(v) => setText((t) => ({ ...t, spec: v }))} />
                <Slider label="Price" value={text.price} min={50} max={150} step={1} unit="%" onChange={(v) => setText((t) => ({ ...t, price: v }))} />
              </Section>

              {/* Colors */}
              <Section label="Color" right={<input type="color" value={accent ?? "#d4af6a"} onChange={(e) => setAccent(e.target.value)} className="w-7 h-6 p-0 rounded-md border border-[#e5e5e5] bg-transparent cursor-pointer" />}>
                <Swatches colors={ACCENTS} value={accent} auto onPick={setAccent} />
              </Section>
              {fadeSkin && (
                <Section label="Background">
                  <Swatches colors={BACKGROUNDS} value={bgColor} auto onPick={setBgColor} />
                </Section>
              )}
              {panelSkin && (
                <Section label="Panel color">
                  <Swatches colors={RAIL_COLORS} value={railColor} auto onPick={setRailColor} />
                </Section>
              )}
              {skinTheme === "light" && (
                <Slider label="Back panel darkness" value={backDark} min={0} max={100} step={1} unit="%" onChange={setBackDark} />
              )}

              {/* Add photo */}
              <Section label="Add photo">
                {photos.length === 0 ? (
                  <p className="text-xs text-[#9ca3af]">No photos on this listing yet.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {photos.map((url, i) => {
                      const used = layers.some((l) => l.url === url)
                      return (
                        <button key={`${url}-${i}`} type="button" onClick={() => addLayer(url)} className={`relative aspect-square rounded-lg overflow-hidden border-2 ${used ? "border-[#d6b357]" : "border-transparent hover:border-[#e5e5e5]"}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          {!used && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20">
                              <Plus className="w-4 h-4 text-white opacity-0 hover:opacity-100" />
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </Section>

              {/* Photo layers */}
              {layers.length > 0 && (
                <Section label="Photo layers" right={sel ? <button type="button" onClick={resetSel} className="text-[10px] font-semibold text-[#2563eb]">Reset</button> : undefined}>
                  <p className="text-[10px] text-[#9ca3af] mb-2 -mt-1">Drag on the preview to move; use the handles to resize/rotate. Drag rows to reorder.</p>
                  <div className="space-y-1.5">
                    {[...layers].reverse().map((l) => (
                      <div
                        key={l.id}
                        draggable
                        onDragStart={() => { dragLayerId.current = l.id }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => { if (dragLayerId.current) moveLayer(dragLayerId.current, l.id); dragLayerId.current = null }}
                        onClick={() => setSelectedId(l.id)}
                        className={`flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer ${selectedId === l.id ? "border-[#2563eb] bg-[#2563eb]/5" : "border-[#e5e5e5] bg-white"}`}
                      >
                        <GripVertical className="w-4 h-4 text-[#c4c4c4] shrink-0" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={l.url} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
                        <span className="text-sm font-medium text-[#374151] flex-1 truncate">{l.name}</span>
                        <button type="button" onClick={(e) => { e.stopPropagation(); removeLayer(l.id) }} className="p-1 rounded text-rose-600 hover:bg-rose-50 shrink-0"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* QR */}
              <Section label="QR code" right={
                <div className="flex gap-1">
                  <button type="button" onClick={() => setQrOn(true)} className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${qrOn ? "border-[#2563eb] text-[#2563eb]" : "border-[#e5e5e5] text-[#9ca3af]"}`}>Show</button>
                  <button type="button" onClick={() => setQrOn(false)} className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${!qrOn ? "border-[#2563eb] text-[#2563eb]" : "border-[#e5e5e5] text-[#9ca3af]"}`}>Hide</button>
                </div>
              }>
                {qrOn && <Slider label="Size" value={qrSize} min={80} max={200} step={1} unit="px" onChange={setQrSize} />}
              </Section>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
