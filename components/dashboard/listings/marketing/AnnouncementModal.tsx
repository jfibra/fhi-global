"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { X, Download, Loader2, ImageIcon, Printer, Link2, Check, Facebook, MessageCircle, Move, RotateCcw, ZoomIn, RotateCw } from "lucide-react"
import AnnouncementPoster, {
  POSTER_W,
  POSTER_HEIGHTS,
  ANNOUNCEMENT_TYPES,
  SKIN_LABELS,
  ACCENTS,
  BACKGROUNDS,
  RAIL_COLORS,
  resolveSkin,
  type AnnouncementType,
  type PosterTheme,
  type PosterSize,
  type PhotoTransform,
} from "./AnnouncementPoster"
import { type FlyerData, proxied } from "@/lib/flyer/theme"

type MarketingData = FlyerData & { currency: string }

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://fhiglobal.ae").replace(/\/$/, "")
const TYPE_ORDER: AnnouncementType[] = ["just_listed", "just_sold", "officially_sold"]
const SKIN_ORDER: PosterTheme[] = ["light", "black", "green", "railnavy"]
const SIZE_ORDER: { key: PosterSize; label: string }[] = [
  { key: "default", label: "1200 × 800" },
  { key: "og", label: "Link · 1200 × 630" },
]

function Swatches({ colors, value, onPick }: { colors: string[]; value?: string; onPick: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onPick(c)}
          className={`w-6 h-6 rounded-md border-2 ${value === c ? "border-[#001f3f]" : "border-white shadow-sm"}`}
          style={{ backgroundColor: c }}
          title={c}
        />
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
  const [heroIndex, setHeroIndex] = useState(0)
  const [type, setType] = useState<AnnouncementType>("just_listed")
  const [skinTheme, setSkinTheme] = useState<PosterTheme>("light")
  const [size, setSize] = useState<PosterSize>("default")
  const [accent, setAccent] = useState<string | undefined>()
  const [bgColor, setBgColor] = useState<string | undefined>()
  const [railColor, setRailColor] = useState<string | undefined>()
  const [downloading, setDownloading] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [scale, setScale] = useState(1)
  const [photoT, setPhotoT] = useState<PhotoTransform>({ tx: 0, ty: 0, scale: 1, rot: 0 })

  const posterRef = useRef<HTMLDivElement>(null)
  const scaleWrapRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)

  const posterH = POSTER_HEIGHTS[size]
  const listingUrl = `${SITE_URL}/listings/${listingId}`

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
          setPhotos(pd.gallery.length ? pd.gallery : pd.image ? [pd.image] : [])
          setHeroIndex(0)
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
  }, [listingId])

  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? POSTER_W
      setScale(w / POSTER_W)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [data, size])

  const skin = useMemo(() => resolveSkin(skinTheme, { accent, bgColor, railColor }), [skinTheme, accent, bgColor, railColor])

  // Re-center the photo transform when the chosen photo or poster size changes.
  useEffect(() => {
    setPhotoT({ tx: 0, ty: 0, scale: 1, rot: 0 })
  }, [heroIndex, size])

  const heroUrl = photos.length ? photos[Math.min(heroIndex, photos.length - 1)] : null
  const posterData: MarketingData | null = data ? { ...data, image: heroUrl } : null

  // Drag to pan the photo (Canva-style). Screen-pixel deltas are divided by the
  // preview scale to convert back to poster coordinates.
  const onPhotoPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, tx: photoT.tx, ty: photoT.ty }
  }
  const onPhotoPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d) return
    const s = scale || 1
    setPhotoT((p) => ({ ...p, tx: d.tx + (e.clientX - d.x) / s, ty: d.ty + (e.clientY - d.y) / s }))
  }
  const onPhotoPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }
  const resetPhoto = () => setPhotoT({ tx: 0, ty: 0, scale: 1, rot: 0 })

  // Rasterize via html-to-image (SVG <foreignObject>) so Tailwind v4 oklch()
  // colors, gradients and the loaded web fonts render natively; images (served
  // same-origin through /api/image-proxy) are fetched + inlined.
  const captureDataUrl = useCallback(async (): Promise<string | null> => {
    const node = posterRef.current
    if (!node) return null
    const wrap = scaleWrapRef.current
    const prev = wrap?.style.transform ?? ""
    try {
      if (wrap) wrap.style.transform = "none"
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      if (typeof document !== "undefined" && document.fonts?.ready) await document.fonts.ready
      await Promise.all(
        Array.from(node.querySelectorAll("img")).map(async (img) => {
          if (img.complete && img.naturalWidth > 0) return
          await new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true })
            img.addEventListener("error", () => resolve(), { once: true })
          })
        }),
      )
      const { toPng } = await import("html-to-image")
      return await toPng(node, {
        width: POSTER_W,
        height: posterH,
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
        style: { transform: "none", margin: "0" },
      })
    } finally {
      if (wrap) wrap.style.transform = prev
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
      doc.write(
        `<html><head><style>@page{size:${POSTER_W}px ${posterH}px;margin:0}html,body{margin:0}img{width:${POSTER_W}px;height:${posterH}px;display:block}</style></head><body><img src="${dataUrl}"/></body></html>`,
      )
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

  const copyLink = () => {
    void navigator.clipboard?.writeText(listingUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }
  const shareFacebook = () =>
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(listingUrl)}`, "_blank", "noopener,width=680,height=640")
  const shareWhatsApp = () =>
    window.open(`https://wa.me/?text=${encodeURIComponent(`${listingTitle} — ${listingUrl}`)}`, "_blank", "noopener")

  const panelSkin = skinTheme === "light" || skinTheme === "railnavy"
  const fadeSkin = skinTheme === "black" || skinTheme === "green"

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-[#e8eaed] shadow-2xl w-full max-w-6xl h-[94vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#f0f0f0] gap-3">
          <div className="min-w-0">
            <h2 className="font-['Outfit'] text-lg font-bold text-[#001f3f]">Just Listed / Sold</h2>
            <p className="text-xs text-[#6b7280] truncate max-w-md">{listingTitle}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={copyLink} title="Copy listing link" className="p-2 rounded-lg border border-[#e5e5e5] text-[#374151] hover:border-[#001f3f]">
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Link2 className="w-4 h-4" />}
            </button>
            <button type="button" onClick={shareFacebook} title="Share on Facebook" className="p-2 rounded-lg border border-[#e5e5e5] text-[#374151] hover:border-[#001f3f]">
              <Facebook className="w-4 h-4" />
            </button>
            <button type="button" onClick={shareWhatsApp} title="Share on WhatsApp" className="p-2 rounded-lg border border-[#e5e5e5] text-[#374151] hover:border-[#001f3f]">
              <MessageCircle className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => void handlePrint()} disabled={loading || printing || !data} title="Print" className="p-2 rounded-lg border border-[#e5e5e5] text-[#374151] hover:border-[#001f3f] disabled:opacity-50">
              {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={loading || downloading || !data}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white text-sm font-semibold shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloading ? "Exporting…" : "Download"}
            </button>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-[#6b7280] hover:bg-[#f5f5f5]" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-sm text-[#9ca3af]">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading listing…
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-sm text-rose-600">{error}</div>
        ) : data && posterData ? (
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
            {/* Center: preview */}
            <div className="flex-1 min-w-0 order-2 lg:order-1 overflow-auto p-5 bg-[#f1f2f4] flex items-start justify-center">
              <div ref={frameRef} className="rounded-xl overflow-hidden shadow-lg" style={{ width: "100%", maxWidth: POSTER_W }}>
                <div style={{ position: "relative", width: "100%", height: posterH * scale }}>
                  <div ref={scaleWrapRef} style={{ position: "absolute", top: 0, left: 0, width: POSTER_W, height: posterH, transformOrigin: "top left", transform: `scale(${scale})` }}>
                    <AnnouncementPoster ref={posterRef} data={posterData} type={type} listingUrl={listingUrl} size={size} skin={skin} photo={photoT} />
                  </div>
                  {/* Drag layer (preview-only) — pan the photo behind the design. */}
                  <div
                    onPointerDown={onPhotoPointerDown}
                    onPointerMove={onPhotoPointerMove}
                    onPointerUp={onPhotoPointerUp}
                    onPointerCancel={onPhotoPointerUp}
                    className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none"
                    title="Drag to reposition the photo"
                  />
                </div>
              </div>
            </div>

            {/* Right: controls */}
            <div className="lg:w-72 shrink-0 order-1 lg:order-2 border-b lg:border-b-0 lg:border-l border-[#f0f0f0] overflow-auto p-4 space-y-5 bg-[#fafafa]">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#6b7280] mb-2">Announcement</p>
                <div className="grid grid-cols-1 gap-2">
                  {TYPE_ORDER.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setType(k)}
                      className={`px-3 py-2 rounded-xl text-sm font-semibold text-left border ${type === k ? "border-[#001f3f] bg-[#001f3f]/5 text-[#001f3f]" : "border-[#e5e5e5] text-[#374151] hover:border-[#001f3f]/40"}`}
                    >
                      {ANNOUNCEMENT_TYPES[k].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#6b7280] mb-2">Style</p>
                <div className="grid grid-cols-2 gap-2">
                  {SKIN_ORDER.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSkinTheme(k)}
                      className={`px-3 py-2 rounded-xl text-sm font-semibold border ${skinTheme === k ? "border-[#001f3f] bg-[#001f3f]/5 text-[#001f3f]" : "border-[#e5e5e5] text-[#374151] hover:border-[#001f3f]/40"}`}
                    >
                      {SKIN_LABELS[k]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#6b7280] mb-2">Size</p>
                <div className="grid grid-cols-2 gap-2">
                  {SIZE_ORDER.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setSize(s.key)}
                      className={`px-2 py-2 rounded-xl text-xs font-semibold border ${size === s.key ? "border-[#001f3f] bg-[#001f3f]/5 text-[#001f3f]" : "border-[#e5e5e5] text-[#374151] hover:border-[#001f3f]/40"}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#6b7280]">Accent</p>
                  <input type="color" value={accent ?? "#d4af6a"} onChange={(e) => setAccent(e.target.value)} className="w-7 h-6 p-0 rounded-md border border-[#e5e5e5] bg-transparent cursor-pointer" />
                </div>
                <Swatches colors={ACCENTS} value={accent} onPick={setAccent} />
              </div>

              {fadeSkin && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#6b7280] mb-2">Background</p>
                  <Swatches colors={BACKGROUNDS} value={bgColor} onPick={setBgColor} />
                </div>
              )}

              {panelSkin && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#6b7280] mb-2">Panel color</p>
                  <Swatches colors={RAIL_COLORS} value={railColor} onPick={setRailColor} />
                </div>
              )}

              <div>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#6b7280] mb-2">
                  <ImageIcon className="w-3.5 h-3.5" /> Photo
                </p>
                {photos.length === 0 ? (
                  <p className="text-xs text-[#9ca3af]">No photos on this listing yet.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {photos.map((url, i) => (
                      <button
                        key={`${url}-${i}`}
                        type="button"
                        onClick={() => setHeroIndex(i)}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 ${i === heroIndex ? "border-[#d6b357]" : "border-transparent hover:border-[#e5e5e5]"}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {photos.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#6b7280]">
                      <Move className="w-3.5 h-3.5" /> Photo position
                    </p>
                    <button type="button" onClick={resetPhoto} title="Reset photo" className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#6b7280] hover:text-[#001f3f]">
                      <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                  </div>
                  <p className="text-[10px] text-[#9ca3af] mb-2 -mt-1">Drag the preview to reposition, or use the sliders.</p>
                  <label className="flex items-center gap-2 mb-2">
                    <ZoomIn className="w-4 h-4 text-[#6b7280] shrink-0" />
                    <input
                      type="range"
                      min={0.5}
                      max={3}
                      step={0.01}
                      value={photoT.scale}
                      onChange={(e) => setPhotoT((p) => ({ ...p, scale: Number(e.target.value) }))}
                      className="w-full accent-[#001f3f]"
                    />
                    <span className="text-[10px] font-mono text-[#9ca3af] w-9 text-right">{photoT.scale.toFixed(2)}×</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <RotateCw className="w-4 h-4 text-[#6b7280] shrink-0" />
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      step={1}
                      value={photoT.rot}
                      onChange={(e) => setPhotoT((p) => ({ ...p, rot: Number(e.target.value) }))}
                      className="w-full accent-[#001f3f]"
                    />
                    <span className="text-[10px] font-mono text-[#9ca3af] w-9 text-right">{photoT.rot}°</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
