"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { X, Download, Loader2, ImageIcon } from "lucide-react"
import AnnouncementPoster, {
  POSTER_W,
  POSTER_H,
  ANNOUNCEMENT_TYPES,
  type AnnouncementType,
} from "./AnnouncementPoster"
import type { FlyerData } from "@/lib/flyer/theme"

type MarketingData = FlyerData & { currency: string }

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://fhiglobal.ae").replace(/\/$/, "")
const TYPE_ORDER: AnnouncementType[] = ["just_listed", "just_sold", "officially_sold"]

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
  const [heroIndex, setHeroIndex] = useState(0)
  const [type, setType] = useState<AnnouncementType>("just_listed")
  const [downloading, setDownloading] = useState(false)
  const [scale, setScale] = useState(1)

  const posterRef = useRef<HTMLDivElement>(null)
  const scaleWrapRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)

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
          setData(json.data)
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
  }, [data])

  const gallery = data?.gallery ?? []
  const heroUrl = gallery.length ? gallery[Math.min(heroIndex, gallery.length - 1)] : null
  const listingUrl = `${SITE_URL}/listings/${listingId}`

  const handleDownload = useCallback(async () => {
    const node = posterRef.current
    if (!node || !data) return
    setDownloading(true)
    const wrap = scaleWrapRef.current
    const prev = wrap?.style.transform ?? ""
    try {
      if (wrap) wrap.style.transform = "none"
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      if (typeof document !== "undefined" && document.fonts?.ready) await document.fonts.ready
      const html2canvas = (await import("html2canvas")).default
      const canvas = await html2canvas(node, {
        scale: 1,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        width: POSTER_W,
        height: POSTER_H,
        windowWidth: POSTER_W,
        windowHeight: POSTER_H,
        imageTimeout: 0,
      })
      const url = canvas.toDataURL("image/png")
      const a = document.createElement("a")
      const safe = (listingTitle || "listing").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60)
      a.href = url
      a.download = `${safe || listingId}-${type}.png`
      a.click()
    } catch (e) {
      console.error("Announcement export failed", e)
      setError("Export failed — try again")
    } finally {
      if (wrap) wrap.style.transform = prev
      setDownloading(false)
    }
  }, [data, listingId, listingTitle, type])

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-[#e8eaed] shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
          <div>
            <h2 className="font-['Outfit'] text-lg font-bold text-[#001f3f]">Just Listed / Sold</h2>
            <p className="text-xs text-[#6b7280] mt-0.5 truncate max-w-md">{listingTitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={loading || downloading || !data}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white text-sm font-semibold shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloading ? "Exporting…" : "Download PNG"}
            </button>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-[#6b7280] hover:bg-[#f5f5f5]" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto flex flex-col lg:flex-row gap-6 p-6 bg-[#fafafa]">
          {/* Controls */}
          <div className="w-full lg:w-64 shrink-0 space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#6b7280] mb-2">Announcement</p>
              <div className="flex flex-col gap-2">
                {TYPE_ORDER.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setType(k)}
                    className={`px-3 py-2 rounded-xl text-sm font-semibold text-left border ${
                      type === k
                        ? "border-[#001f3f] bg-[#001f3f]/5 text-[#001f3f]"
                        : "border-[#e5e5e5] text-[#374151] hover:border-[#001f3f]/40"
                    }`}
                  >
                    {ANNOUNCEMENT_TYPES[k].label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#6b7280] mb-2">
                <ImageIcon className="w-3.5 h-3.5" /> Photo
              </p>
              {gallery.length === 0 ? (
                <p className="text-xs text-[#9ca3af]">No photos on this listing yet.</p>
              ) : (
                <div className="grid grid-cols-4 lg:grid-cols-3 gap-2">
                  {gallery.map((url, i) => (
                    <button
                      key={`${url}-${i}`}
                      type="button"
                      onClick={() => setHeroIndex(i)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 ${
                        i === heroIndex ? "border-[#d6b357]" : "border-transparent hover:border-[#e5e5e5]"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="flex-1 min-w-0 flex items-start justify-center">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-[#9ca3af] py-20">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading listing…
              </div>
            ) : error ? (
              <div className="text-sm text-rose-600 py-20">{error}</div>
            ) : data ? (
              <div ref={frameRef} className="rounded-xl overflow-hidden shadow-lg" style={{ width: "100%", maxWidth: POSTER_W }}>
                <div style={{ position: "relative", width: "100%", height: POSTER_H * scale }}>
                  <div
                    ref={scaleWrapRef}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: POSTER_W,
                      height: POSTER_H,
                      transformOrigin: "top left",
                      transform: `scale(${scale})`,
                    }}
                  >
                    <AnnouncementPoster ref={posterRef} data={data} type={type} listingUrl={listingUrl} heroUrl={heroUrl} />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
