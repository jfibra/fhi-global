"use client"

import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { X, Download, Loader2, ImageIcon, Palette, Printer, RotateCcw } from "lucide-react"
import {
  type FlyerData,
  type FlyerTheme,
  type FlyerThemeOverride,
  FLYER_W,
  FLYER_H,
  FLYER_PRESETS,
  TEMPLATE_META,
  resolveFlyerTheme,
  proxied,
} from "@/lib/flyer/theme"
import { LOGOS } from "@/lib/flyer/logos"
import { capturePng, warmFontEmbedCSS } from "@/lib/flyer/capture"
import Template1Classic from "./flyer-templates/Template1Classic"
import Template2Modern from "./flyer-templates/Template2Modern"
import Template3Magazine from "./flyer-templates/Template3Magazine"
import Template4Mosaic from "./flyer-templates/Template4Mosaic"
import Template5Luxury from "./flyer-templates/Template5Luxury"
import Template6Editorial from "./flyer-templates/Template6Editorial"
import Template7Duotone from "./flyer-templates/Template7Duotone"
import Template8Portrait from "./flyer-templates/Template8Portrait"
import Template9Luxe from "./flyer-templates/Template9Luxe"

type MarketingData = FlyerData & { currency: string }

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://fhiglobal.ae").replace(/\/$/, "")

const TEMPLATE_COMPONENTS: Record<number, typeof Template1Classic> = {
  1: Template1Classic,
  2: Template2Modern,
  3: Template3Magazine,
  4: Template4Mosaic,
  5: Template5Luxury,
  6: Template6Editorial,
  7: Template7Duotone,
  8: Template8Portrait,
  9: Template9Luxe,
}

// Debounced color picker — the swatch updates instantly, the (expensive) live
// preview commit is debounced so dragging the OS picker stays smooth.
const THUMB_SCALE = 0.19
const sameGallery = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])
const sameTheme = (a: FlyerTheme, b: FlyerTheme) => a.accent === b.accent && a.bg === b.bg && a.text === b.text && a.mode === b.mode

type PreviewProps = {
  Comp: typeof Template1Classic
  data: MarketingData
  listingUrl: string
  theme: FlyerTheme
  logoUrl: string | null
  logoSize: number
  logoOutline: number
}

// Main preview, memoized so only a change that alters the flyer's OUTPUT
// re-renders the (heavy) template — not unrelated state like the active photo
// slot, download/print flags, etc.
const FlyerPreview = memo(
  forwardRef<HTMLDivElement, PreviewProps>(function FlyerPreview({ Comp, data, listingUrl, theme, logoUrl, logoSize, logoOutline }, ref) {
    return <Comp ref={ref} data={data} listingUrl={listingUrl} theme={theme} logoUrl={logoUrl} logoSize={logoSize} logoOutline={logoOutline} />
  }),
  (a, b) =>
    a.Comp === b.Comp &&
    a.listingUrl === b.listingUrl &&
    a.logoUrl === b.logoUrl &&
    a.logoSize === b.logoSize &&
    a.logoOutline === b.logoOutline &&
    sameTheme(a.theme, b.theme) &&
    a.data.image === b.data.image &&
    sameGallery(a.data.gallery, b.data.gallery),
)

// One template thumbnail, memoized so a control change only re-renders the
// thumbnail(s) that actually changed — not all nine. Thumbnails deliberately
// ignore the logo controls (Auto logo) so logo sliders re-render only the main
// preview, keeping dragging smooth.
const TemplateThumb = memo(
  function TemplateThumb({
    id,
    name,
    selected,
    Comp,
    data,
    listingUrl,
    theme,
    onSelect,
  }: {
    id: number
    name: string
    selected: boolean
    Comp: typeof Template1Classic
    data: MarketingData
    listingUrl: string
    theme: FlyerTheme
    onSelect: (id: number) => void
  }) {
    return (
      <button
        type="button"
        onClick={() => onSelect(id)}
        className={`relative shrink-0 rounded-lg overflow-hidden border-2 ${selected ? "border-[#d6b357]" : "border-[#e5e5e5] hover:border-[#001f3f]/40"}`}
        style={{ width: FLYER_W * THUMB_SCALE, height: FLYER_H * THUMB_SCALE }}
        title={name}
      >
        <div style={{ width: FLYER_W, height: FLYER_H, transform: `scale(${THUMB_SCALE})`, transformOrigin: "top left", pointerEvents: "none" }}>
          <Comp data={data} listingUrl={listingUrl} theme={theme} />
        </div>
        <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[9px] font-semibold text-center py-0.5">{name}</span>
      </button>
    )
  },
  (a, b) =>
    a.id === b.id &&
    a.selected === b.selected &&
    a.Comp === b.Comp &&
    a.listingUrl === b.listingUrl &&
    a.theme.accent === b.theme.accent &&
    a.theme.bg === b.theme.bg &&
    a.theme.text === b.theme.text &&
    a.theme.mode === b.theme.mode &&
    a.data.image === b.data.image &&
    sameGallery(a.data.gallery, b.data.gallery),
)

function ColorField({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState(value)
  const draggingRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!draggingRef.current) setLocal(value)
  }, [value])
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])
  const handleChange = (v: string) => {
    setLocal(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onCommit(v), 70)
  }
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-mono text-[#9ca3af]">{local.toUpperCase()}</span>
        <input
          type="color"
          value={local.toLowerCase()}
          onFocus={() => { draggingRef.current = true }}
          onBlur={() => { draggingRef.current = false; setLocal(value) }}
          onChange={(e) => handleChange(e.target.value)}
          className="w-8 h-7 p-0 rounded-md border border-[#e5e5e5] bg-transparent cursor-pointer"
        />
      </div>
    </div>
  )
}

export default function FlyerModal({
  listingId,
  listingSlug,
  listingTitle,
  onClose,
}: {
  listingId: string
  listingSlug?: string | null
  listingTitle: string
  onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<MarketingData | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState(1)
  const [selectedPhotos, setSelectedPhotos] = useState<Record<number, number[]>>({})
  const [activeSlot, setActiveSlot] = useState(0)
  const [themeByTemplate, setThemeByTemplate] = useState<Record<number, FlyerThemeOverride>>({})
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoSize, setLogoSize] = useState(46)
  const [logoOutline, setLogoOutline] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [scale, setScale] = useState(1)

  const flyerRef = useRef<HTMLDivElement>(null)
  const scaleWrapRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  const listingUrl = `${SITE_URL}/listings/${listingSlug ?? listingId}`

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const res = await fetch(`/api/agent-listings/marketing-data?listingId=${encodeURIComponent(listingId)}`)
        const json = (await res.json()) as { data?: MarketingData; error?: string }
        if (cancelled) return
        if (!res.ok || !json.data) {
          setError(json.error ?? "Could not load listing data")
        } else {
          // Proxy every remote image up-front so html2canvas never taints.
          const proxiedData: MarketingData = {
            ...json.data,
            image: json.data.image ? proxied(json.data.image) : null,
            gallery: (json.data.gallery ?? []).map(proxied),
            agent: { ...json.data.agent, imageUrl: json.data.agent.imageUrl ? proxied(json.data.agent.imageUrl) : "" },
          }
          setData(proxiedData)
          setPhotos(proxiedData.gallery.length ? proxiedData.gallery : proxiedData.image ? [proxiedData.image] : [])
          setSelectedPhotos({})
          setActiveSlot(0)
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
      const w = entries[0]?.contentRect.width ?? FLYER_W
      setScale(w / FLYER_W)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [data])

  useEffect(() => {
    setActiveSlot(0)
  }, [selectedTemplate])

  // Warm the (cached) font-embed CSS once the flyer has rendered, so the first
  // Download/Print doesn't pay the font-inlining cost.
  useEffect(() => {
    if (data) warmFontEmbedCSS(flyerRef.current)
  }, [data])

  const slotsForCurrent = useMemo(
    () => TEMPLATE_META.find((t) => t.id === selectedTemplate)?.slots ?? 1,
    [selectedTemplate],
  )

  // Resolve per-slot photo indices for a template (explicit picks, else first-in-order).
  const getSel = useCallback(
    (tplId: number): number[] => {
      const slots = TEMPLATE_META.find((t) => t.id === tplId)?.slots ?? 1
      const explicit = selectedPhotos[tplId]
      const sel: number[] = []
      for (let s = 0; s < slots; s++) {
        const v = explicit?.[s]
        sel.push(typeof v === "number" && v < photos.length ? v : Math.min(s, Math.max(0, photos.length - 1)))
      }
      return sel
    },
    [selectedPhotos, photos.length],
  )

  // Build per-template data using that template's slot picks (hero + gallery).
  const dataForTemplate = useCallback(
    (tplId: number): MarketingData | null => {
      if (!data) return null
      if (photos.length === 0) return data
      const sel = getSel(tplId)
      const hero = photos[sel[0]] ?? data.image
      const rest = sel.slice(1).map((i) => photos[i]).filter(Boolean)
      return { ...data, image: hero, gallery: rest.length ? rest : data.gallery }
    },
    [data, photos, getSel],
  )

  const resolveTheme = useCallback(
    (tplId: number): FlyerTheme => {
      const meta = TEMPLATE_META.find((t) => t.id === tplId) ?? TEMPLATE_META[0]
      return resolveFlyerTheme(meta, themeByTemplate[tplId])
    },
    [themeByTemplate],
  )

  const currentSel = getSel(selectedTemplate)
  const assignPhoto = (photoIdx: number) =>
    setSelectedPhotos((prev) => {
      const sel = [...getSel(selectedTemplate)]
      sel[activeSlot] = photoIdx
      return { ...prev, [selectedTemplate]: sel }
    })

  const applyPreset = (theme: FlyerTheme) =>
    setThemeByTemplate((prev) => ({ ...prev, [selectedTemplate]: { ...theme } }))
  const setThemeColor = (key: "accent" | "bg" | "text", val: string) =>
    setThemeByTemplate((prev) => ({ ...prev, [selectedTemplate]: { ...(prev[selectedTemplate] ?? {}), [key]: val } }))
  const resetTheme = () =>
    setThemeByTemplate((prev) => {
      const next = { ...prev }
      delete next[selectedTemplate]
      return next
    })

  // Rasterize the flyer to a PNG data URL via the shared capture helper
  // (cached font-embed CSS + no cacheBust → fast and no partial-render race).
  const captureDataUrl = useCallback(async (): Promise<string | null> => {
    const node = flyerRef.current
    if (!node) return null
    try {
      return await capturePng(node, { width: FLYER_W, height: FLYER_H })
    } catch (e) {
      console.error("Flyer capture failed", e)
      return null
    }
  }, [])

  const safeName = (listingTitle || "listing").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || listingId

  const handleDownload = useCallback(async () => {
    if (!data) return
    setDownloading(true)
    try {
      const dataUrl = await captureDataUrl()
      if (!dataUrl) return
      const a = document.createElement("a")
      a.href = dataUrl
      a.download = `Flyer-${safeName}.png`
      a.click()
    } catch (e) {
      console.error("Flyer export failed", e)
      setError("Export failed — try again")
    } finally {
      setDownloading(false)
    }
  }, [data, captureDataUrl, safeName])

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
        `<html><head><style>@page{size:${FLYER_W}px ${FLYER_H}px;margin:0}html,body{margin:0}img{width:${FLYER_W}px;height:${FLYER_H}px;display:block}</style></head><body><img src="${dataUrl}"/></body></html>`,
      )
      doc.close()
      iframe.onload = () => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        setTimeout(() => document.body.removeChild(iframe), 1000)
      }
    } catch (e) {
      console.error("Flyer print failed", e)
    } finally {
      setPrinting(false)
    }
  }, [data, captureDataUrl])

  const currentTheme = resolveTheme(selectedTemplate)
  const currentData = dataForTemplate(selectedTemplate)
  const CurrentTemplate = TEMPLATE_COMPONENTS[selectedTemplate]

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-[#e8eaed] shadow-2xl w-full max-w-6xl h-[94vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#f0f0f0] gap-3">
          <div className="min-w-0">
            <h2 className="font-['Outfit'] text-lg font-bold text-[#001f3f]">Flyer</h2>
            <p className="text-xs text-[#6b7280] truncate max-w-md">{listingTitle}</p>
          </div>
          <div className="flex items-center gap-1.5">
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
        ) : data && currentData ? (
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
            {/* Left: templates */}
            <div className="lg:w-52 shrink-0 border-b lg:border-b-0 lg:border-r border-[#f0f0f0] overflow-auto p-3 bg-[#fafafa]">
              <p className="text-xs font-bold uppercase tracking-wide text-[#6b7280] mb-2">Templates</p>
              <div className="flex lg:flex-col gap-2">
                {TEMPLATE_META.map((meta) => {
                  const Comp = TEMPLATE_COMPONENTS[meta.id]
                  const td = dataForTemplate(meta.id)
                  if (!Comp || !td) return null
                  return (
                    <TemplateThumb
                      key={meta.id}
                      id={meta.id}
                      name={meta.name}
                      selected={selectedTemplate === meta.id}
                      Comp={Comp}
                      data={td}
                      listingUrl={listingUrl}
                      theme={resolveTheme(meta.id)}
                      onSelect={setSelectedTemplate}
                    />
                  )
                })}
              </div>
            </div>

            {/* Center: preview */}
            <div className="flex-1 min-w-0 overflow-auto p-5 bg-[#f1f2f4] flex items-start justify-center">
              <div ref={frameRef} className="rounded-xl overflow-hidden shadow-lg" style={{ width: "100%", maxWidth: FLYER_W }}>
                <div style={{ position: "relative", width: "100%", height: FLYER_H * scale }}>
                  <div ref={scaleWrapRef} style={{ position: "absolute", top: 0, left: 0, width: FLYER_W, height: FLYER_H, transformOrigin: "top left", transform: `scale(${scale})` }}>
                    <FlyerPreview ref={flyerRef} Comp={CurrentTemplate} data={currentData} listingUrl={listingUrl} theme={currentTheme} logoUrl={logoUrl} logoSize={logoSize} logoOutline={logoOutline} />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: controls */}
            <div className="lg:w-64 shrink-0 border-t lg:border-t-0 lg:border-l border-[#f0f0f0] overflow-auto p-4 space-y-5 bg-[#fafafa]">
              {/* Logo picker (same lineup as the Reel Maker) */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#6b7280] mb-2">Logo</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {LOGOS.map((l) => {
                    const active = (l.url ?? null) === logoUrl
                    const darkTile = l.tone === "light"
                    return (
                      <button
                        key={l.label}
                        type="button"
                        onClick={() => setLogoUrl(l.url ?? null)}
                        title={l.label}
                        className={`shrink-0 h-11 min-w-[60px] px-2 rounded-lg border-2 flex items-center justify-center ${active ? "border-[#001f3f]" : "border-[#e5e5e5]"}`}
                        style={{ backgroundColor: l.url ? (darkTile ? "#0f2c5c" : "#ffffff") : active ? "rgba(0,31,63,0.05)" : "#ffffff" }}
                      >
                        {l.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.url} alt={l.label} className="max-h-7 max-w-[72px] object-contain" />
                        ) : (
                          <span className="text-xs font-bold text-[#001f3f]">Auto</span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[11px] text-[#6b7280] mb-0.5">
                    <span>Size</span>
                    <span className="font-mono text-[#9ca3af]">{Math.round(logoSize)}px</span>
                  </div>
                  <input type="range" min={24} max={110} step={0.01} value={logoSize} onChange={(e) => setLogoSize(Number(e.target.value))} className="w-full accent-[#001f3f]" />
                </div>
                <div className="mt-1.5">
                  <div className="flex items-center justify-between text-[11px] text-[#6b7280] mb-0.5">
                    <span>White outline</span>
                    <span className="font-mono text-[#9ca3af]">{logoOutline === 0 ? "Off" : `${logoOutline.toFixed(1)}px`}</span>
                  </div>
                  <input type="range" min={0} max={16} step={0.01} value={logoOutline} onChange={(e) => setLogoOutline(Number(e.target.value))} className="w-full accent-[#001f3f]" />
                </div>
              </div>

              {/* Photo slots */}
              <div>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#6b7280] mb-2">
                  <ImageIcon className="w-3.5 h-3.5" /> Photos
                </p>
                {photos.length === 0 ? (
                  <p className="text-xs text-[#9ca3af]">No photos on this listing yet.</p>
                ) : (
                  <>
                    {slotsForCurrent > 1 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {Array.from({ length: slotsForCurrent }).map((_, s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setActiveSlot(s)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                              activeSlot === s ? "border-[#001f3f] bg-[#001f3f]/5 text-[#001f3f]" : "border-[#e5e5e5] text-[#6b7280]"
                            }`}
                          >
                            {s === 0 ? "Main" : `Photo ${s + 1}`}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      {photos.map((url, i) => (
                        <button
                          key={`${url}-${i}`}
                          type="button"
                          onClick={() => assignPhoto(i)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 ${
                            currentSel[activeSlot] === i ? "border-[#d6b357]" : "border-transparent hover:border-[#e5e5e5]"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Color customizer */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#6b7280]">
                    <Palette className="w-3.5 h-3.5" /> Colors
                  </p>
                  <button type="button" onClick={resetTheme} title="Reset colors" className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#6b7280] hover:text-[#001f3f]">
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {FLYER_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(p.theme)}
                      title={p.name}
                      className="h-8 rounded-lg border border-[#e5e5e5]"
                      style={{ background: `linear-gradient(135deg, ${p.theme.bg} 50%, ${p.swatch} 50%)` }}
                    />
                  ))}
                </div>
                <div className="space-y-2">
                  <ColorField label="Accent" value={currentTheme.accent} onCommit={(v) => setThemeColor("accent", v)} />
                  <ColorField label="Background" value={currentTheme.bg} onCommit={(v) => setThemeColor("bg", v)} />
                  <ColorField label="Text" value={currentTheme.text} onCommit={(v) => setThemeColor("text", v)} />
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
