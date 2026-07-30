"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { X, Loader2, Download, Copy, Check, Facebook, TriangleAlert } from "lucide-react"
import { type FlyerData, proxied } from "@/lib/flyer/theme"
import {
  OG_CARD_W,
  OG_CARD_H,
  OG_THEMES,
  OG_THEME_ORDER,
  OG_PRICE_COLORS,
  OG_PERIOD_LABELS,
  type OgCardOptions,
  type OgHideKey,
  sanitizeOgCardOptions,
} from "@/lib/flyer/og-card"
import { saveAgentListingOgCard, type AgentListingStatus } from "@/lib/agent-listings-service"
import ListingShareCard from "./ListingShareCard"

type MarketingData = FlyerData & { currency: string }

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://fhiglobal.ae").replace(/\/$/, "")

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-wide text-[#6b7280] mb-2">{children}</p>
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
        active
          ? "bg-[#001f3f] border-[#001f3f] text-white"
          : "bg-white border-[#e5e5e5] text-[#374151] hover:border-[#001f3f]/40"
      }`}
    >
      {children}
    </button>
  )
}

export default function ShareCardModal({
  listingId,
  listingSlug,
  listingTitle,
  listingStatus,
  listingKind,
  agentId,
  initialOptions,
  onSaved,
  onClose,
}: {
  listingId: string
  listingSlug?: string | null
  listingTitle: string
  listingStatus: AgentListingStatus
  listingKind: "sale" | "rent"
  agentId: string
  initialOptions: unknown | null
  onSaved: (options: OgCardOptions) => void
  onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<MarketingData | null>(null)
  const [rawGallery, setRawGallery] = useState<string[]>([])
  const [options, setOptions] = useState<OgCardOptions | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [scale, setScale] = useState(1)

  const cardRef = useRef<HTMLDivElement>(null)
  const scaleWrapRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  const isRent = listingKind === "rent"
  const isPublished = listingStatus === "published"
  const listingUrl = `${SITE_URL}/listings/${listingSlug ?? listingId}`

  // The modal is mounted fresh per listing (from MarketingActionsModal), so
  // loading/error start from their initial state — no synchronous reset here.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/agent-listings/marketing-data?listingId=${encodeURIComponent(listingId)}`)
        const json = (await res.json()) as { data?: MarketingData; error?: string }
        if (cancelled) return
        if (!res.ok || !json.data) {
          setError(json.error ?? "Could not load listing data")
        } else {
          // Keep RAW gallery URLs: they're what gets saved in og_card_options
          // and what the /og/listing route matches against. The preview/thumbs
          // proxy at render time.
          const gallery = json.data.gallery ?? []
          setData(json.data)
          setRawGallery(gallery)
          setOptions(sanitizeOgCardOptions(initialOptions, { isRent, gallery }))
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
    const el = frameRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? OG_CARD_W
      setScale(w / OG_CARD_W)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [data])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  useEffect(() => {
    if (!savedFlash) return
    const t = setTimeout(() => setSavedFlash(false), 1800)
    return () => clearTimeout(t)
  }, [savedFlash])

  const patch = (p: Partial<OgCardOptions>) => setOptions((o) => (o ? { ...o, ...p } : o))
  const toggleHide = (key: OgHideKey) =>
    setOptions((o) =>
      o ? { ...o, hide: o.hide.includes(key) ? o.hide.filter((h) => h !== key) : [...o.hide, key] } : o,
    )

  const photoRaw = options ? options.photo ?? rawGallery[0] ?? null : null
  const photoSrc = photoRaw ? proxied(photoRaw) : null

  const captureDataUrl = useCallback(async (): Promise<string | null> => {
    const node = cardRef.current
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
        width: OG_CARD_W,
        height: OG_CARD_H,
        pixelRatio: 2,
        cacheBust: true,
        style: { transform: "none", margin: "0" },
      })
    } finally {
      if (wrap) wrap.style.transform = prev
    }
  }, [])

  const safeName =
    (listingTitle || "listing").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || listingId

  const handleDownload = useCallback(async () => {
    setDownloading(true)
    setError(null)
    try {
      const dataUrl = await captureDataUrl()
      if (!dataUrl) return
      const a = document.createElement("a")
      a.href = dataUrl
      a.download = `ShareCard-${safeName}.png`
      a.click()
    } catch (e) {
      console.error("Share card export failed", e)
      setError("Export failed — try again")
    } finally {
      setDownloading(false)
    }
  }, [captureDataUrl, safeName])

  const handleCopyLink = useCallback(async () => {
    try {
      setError(null)
      await navigator.clipboard.writeText(listingUrl)
      setCopied(true)
    } catch {
      setError("Could not copy the link")
    }
  }, [listingUrl])

  const openShare = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const handleSave = useCallback(async () => {
    if (!options) return
    setSaving(true)
    try {
      const { error: saveError } = await saveAgentListingOgCard(listingId, agentId, options)
      if (saveError) {
        setError(saveError)
      } else {
        setError(null)
        setSavedFlash(true)
        onSaved(options)
        // The public listing page is ISR-cached (revalidate = 120), so its
        // og:image ?v= would stay stale for up to two minutes — purge it now
        // so an immediate re-share picks up the new card. Fire-and-forget.
        void fetch("/api/agent-listings/revalidate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId }),
        }).catch(() => {})
      }
    } finally {
      setSaving(false)
    }
  }, [options, listingId, agentId, onSaved])

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-[#e8eaed] shadow-2xl w-full max-w-3xl max-h-[94vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#f0f0f0] gap-3">
          <div className="min-w-0">
            <h2 className="font-['Outfit'] text-lg font-bold text-[#001f3f]">Customize the share card</h2>
            <p className="text-xs text-[#6b7280] truncate max-w-md">{listingTitle}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-[#6b7280] hover:bg-[#f5f5f5]" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center gap-2 py-24 text-sm text-[#9ca3af]">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading listing…
          </div>
        ) : error && !data ? (
          <div className="flex-1 flex items-center justify-center py-24 text-sm text-rose-600">{error}</div>
        ) : data && options ? (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
              {!isPublished && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                  <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    This listing isn&apos;t published — the public link and the social share preview won&apos;t work
                    until it is. You can still save the card and download the image.
                  </span>
                </div>
              )}

              {/* Live preview */}
              <div ref={frameRef} className="rounded-xl overflow-hidden shadow-lg border border-[#f0f0f0]" style={{ width: "100%" }}>
                <div style={{ position: "relative", width: "100%", height: OG_CARD_H * scale }}>
                  <div
                    ref={scaleWrapRef}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: OG_CARD_W,
                      height: OG_CARD_H,
                      transformOrigin: "top left",
                      transform: `scale(${scale})`,
                    }}
                  >
                    <div ref={cardRef} style={{ width: OG_CARD_W, height: OG_CARD_H, display: "flex" }}>
                      <ListingShareCard data={data} options={options} photoSrc={photoSrc} logoSrc="/FHI_Branding_White.png" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Photo */}
              <div>
                <SectionLabel>Photo</SectionLabel>
                {rawGallery.length === 0 ? (
                  <p className="text-xs text-[#9ca3af]">No photos on this listing yet.</p>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => patch({ photo: null })}
                      className={`shrink-0 w-20 h-14 rounded-lg border-2 text-[11px] font-bold text-[#001f3f] bg-[#001f3f]/5 ${
                        options.photo === null ? "border-[#d6b357]" : "border-transparent hover:border-[#e5e5e5]"
                      }`}
                      title="First photo (automatic)"
                    >
                      Auto
                    </button>
                    {rawGallery.map((url, i) => (
                      <button
                        key={`${url}-${i}`}
                        type="button"
                        onClick={() => patch({ photo: url })}
                        className={`relative shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 ${
                          options.photo === url ? "border-[#d6b357]" : "border-transparent hover:border-[#e5e5e5]"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={proxied(url)} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Theme */}
              <div>
                <SectionLabel>Theme</SectionLabel>
                <div className="flex gap-2.5">
                  {OG_THEME_ORDER.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => patch({ theme: t })}
                      title={OG_THEMES[t].label}
                      className={`w-11 h-9 rounded-lg border-2 ${
                        options.theme === t ? "border-[#d6b357] ring-2 ring-[#d6b357]/30" : "border-[#e5e5e5]"
                      }`}
                      style={{ background: OG_THEMES[t].bg }}
                    />
                  ))}
                </div>
              </div>

              {/* Category badge */}
              <div>
                <SectionLabel>Category badge</SectionLabel>
                <div className="flex gap-2">
                  <Chip active={options.badge === "color"} onClick={() => patch({ badge: "color" })}>
                    Colored
                  </Chip>
                  <Chip active={options.badge === "clear"} onClick={() => patch({ badge: "clear" })}>
                    Clear
                  </Chip>
                </div>
              </div>

              {/* Price color */}
              <div>
                <SectionLabel>Price color</SectionLabel>
                <div className="flex gap-2.5">
                  {OG_PRICE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => patch({ priceColor: c })}
                      title={c}
                      className={`w-9 h-9 rounded-full border-2 ${
                        options.priceColor === c ? "border-[#001f3f] ring-2 ring-[#001f3f]/20" : "border-[#e5e5e5]"
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Price label — rent only */}
              {isRent && (
                <div>
                  <SectionLabel>Price label</SectionLabel>
                  <div className="flex flex-wrap gap-2">
                    {OG_PERIOD_LABELS.map((p) => (
                      <Chip key={p.label} active={options.period === p.value} onClick={() => patch({ period: p.value })}>
                        {p.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {/* Options */}
              <div>
                <SectionLabel>Options</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  <Chip active={!options.hide.includes("price")} onClick={() => toggleHide("price")}>
                    Show price
                  </Chip>
                  <Chip active={!options.hide.includes("specs")} onClick={() => toggleHide("specs")}>
                    Show specs
                  </Chip>
                  <Chip active={!options.hide.includes("location")} onClick={() => toggleHide("location")}>
                    Show location
                  </Chip>
                  <Chip active={options.agent} onClick={() => patch({ agent: !options.agent })}>
                    Agent name + phone
                  </Chip>
                  <Chip active={options.flip} onClick={() => patch({ flip: !options.flip })}>
                    Photo on left
                  </Chip>
                </div>
              </div>

              {error && <p className="text-xs text-rose-600">{error}</p>}
              <p className="text-[11px] text-[#9ca3af]">
                Saving makes this card the preview shown when the listing link is shared on Facebook or WhatsApp.
                Just saved? Facebook may keep an older preview cached — refresh it at developers.facebook.com/tools/debug.
              </p>
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-[#f0f0f0] bg-[#fafafa]">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void handleCopyLink()}
                  disabled={!isPublished}
                  title={isPublished ? "Copy listing link" : "Publish the listing first"}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#e5e5e5] text-xs font-semibold text-[#374151] hover:border-[#001f3f] disabled:opacity-40"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy link"}
                </button>
                <button
                  type="button"
                  onClick={() => openShare(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(listingUrl)}`)}
                  disabled={!isPublished}
                  title={isPublished ? "Share on Facebook" : "Publish the listing first"}
                  className="p-2 rounded-lg border border-[#e5e5e5] text-[#1877f2] hover:border-[#1877f2] disabled:opacity-40"
                  aria-label="Share on Facebook"
                >
                  <Facebook className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openShare(`https://wa.me/?text=${encodeURIComponent(`${listingTitle} ${listingUrl}`)}`)
                  }
                  disabled={!isPublished}
                  title={isPublished ? "Share on WhatsApp" : "Publish the listing first"}
                  className="p-2 rounded-lg border border-[#e5e5e5] text-[#25d366] hover:border-[#25d366] disabled:opacity-40"
                  aria-label="Share on WhatsApp"
                >
                  <WhatsAppGlyph className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleDownload()}
                  disabled={downloading}
                  title="Download PNG"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#e5e5e5] text-xs font-semibold text-[#374151] hover:border-[#001f3f] disabled:opacity-40"
                >
                  {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  {downloading ? "Exporting…" : "PNG"}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:bg-[#f5f5f5]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] text-white text-sm font-semibold shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : savedFlash ? <Check className="w-4 h-4" /> : null}
                  {saving ? "Saving…" : savedFlash ? "Saved" : "Save card"}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
