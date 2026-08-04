"use client"

// Poster Studio — per-project marketing poster generator. Live DOM preview in
// three designs × three formats, exported as a print-ready PNG via the shared
// html-to-image capture pipeline (lib/flyer/capture.ts).

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Download, Image as ImageIcon, Loader2, QrCode, Sparkles, LayoutTemplate,
} from "lucide-react"
import type { Project } from "@/lib/project-service"
import { capturePng, warmFontEmbedCSS } from "@/lib/flyer/capture"
import { proxied, formatPrice } from "@/lib/flyer/theme"
import {
  assembleProjectMarketing,
  type ProjectMarketingData,
} from "./marketing/marketing-data"
import {
  ProjectPoster,
  POSTER_DESIGNS,
  POSTER_FORMATS,
  type PosterDesignId,
  type PosterFormatId,
} from "./marketing/poster-designs"

interface Props {
  project: Project
  showToast: (variant: "success" | "error", message: string) => void
}

const PREVIEW_MAX_H = 640
const PREVIEW_MAX_W = 520

export function ProjectPosterTab({ project, showToast }: Props) {
  const [data, setData] = useState<ProjectMarketingData | null>(null)
  const [loading, setLoading] = useState(true)

  const [design, setDesign] = useState<PosterDesignId>("goldenhour")
  const [format, setFormat] = useState<PosterFormatId>("story")
  const [heroUrl, setHeroUrl] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [price, setPrice] = useState("")
  const [headline, setHeadline] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [showQr, setShowQr] = useState(true)

  const [aiBusy, setAiBusy] = useState(false)
  const [exporting, setExporting] = useState(false)

  const posterRef = useRef<HTMLDivElement>(null)

  // ── Assemble marketing data on project change ────────────────────────────
  useEffect(() => {
    let alive = true
    setLoading(true)
    void assembleProjectMarketing(project).then((d) => {
      if (!alive) return
      setData(d)
      setHeroUrl(d.gallery[0] ?? null)
      setTitle(d.name)
      setPrice(d.priceFrom ? Number(d.priceFrom).toLocaleString("en-US") : "")
      setHeadline(d.tagline)
      setPhone(d.contactPhone ?? "")
      setEmail(d.contactEmail ?? "")
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [project])

  // Warm the font-embed CSS so the first download is instant.
  useEffect(() => {
    if (!loading) warmFontEmbedCSS(posterRef.current)
  }, [loading])

  const posterProps = useMemo(
    () =>
      data
        ? {
            // Editable overrides: project name and the AED price line
            // (empty price deliberately hides the line).
            data: {
              ...data,
              name: title.trim() || data.name,
              priceLabel: price.trim() ? `AED ${price.trim()}` : "",
            },
            design,
            format,
            headline,
            heroUrl,
            showQr,
            phone,
            email,
          }
        : null,
    [data, design, format, title, price, headline, heroUrl, showQr, phone, email],
  )

  const fmt = POSTER_FORMATS[format]
  const previewScale = Math.min(PREVIEW_MAX_H / fmt.h, PREVIEW_MAX_W / fmt.w)

  // ── AI headline ──────────────────────────────────────────────────────────
  const generateHeadline = useCallback(async () => {
    if (aiBusy) return
    setAiBusy(true)
    try {
      const res = await fetch("/api/ai/project-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: "description",
          name: project.name,
          status: project.status,
          location: project.location ?? project.community ?? "",
          city: project.city ?? "Dubai",
          country: project.country ?? "UAE",
          developerName: project.developers?.name ?? "",
          customPrompt:
            "Write ONE luxurious poster description for this development — a single sentence under 20 words, no quotes, no emojis, confident and premium in tone.",
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.text) throw new Error(body.error ?? "Generation failed")
      setHeadline(String(body.text).trim().replace(/^"|"$/g, ""))
      showToast("success", "Headline generated")
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "AI generation failed")
    } finally {
      setAiBusy(false)
    }
  }, [aiBusy, project, showToast])

  // ── Export ───────────────────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    const node = posterRef.current
    if (!node || exporting) return
    setExporting(true)
    try {
      const png = await capturePng(node, { width: fmt.w, height: fmt.h, pixelRatio: 2 })
      const a = document.createElement("a")
      a.href = png
      a.download = `${project.slug}-poster-${design}-${format}.png`
      a.click()
      showToast("success", "Poster downloaded")
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Export failed")
    } finally {
      setExporting(false)
    }
  }, [exporting, fmt, project.slug, design, format, showToast])

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading || !data || !posterProps) {
    return (
      <div className="max-w-5xl space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`rounded-2xl bg-[#f3f4f6] animate-pulse ${i === 0 ? "h-24" : "h-40"}`} />
        ))}
      </div>
    )
  }

  const inputCls =
    "w-full border border-[#e5e5e5] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f]"
  const labelCls = "block text-xs font-semibold text-[#6b7280] mb-1.5"

  return (
    <div className="max-w-6xl space-y-5">
      {/* heading */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-['Outfit'] text-lg font-bold text-[#001f3f] flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-[#d6b357]" /> Poster Studio
          </h3>
          <p className="text-xs text-[#9ca3af] mt-0.5">
            Branded posters auto-filled from this project — pick a design, tweak the copy, download print-ready PNG.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={exporting}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#001f3f]/90 transition-all disabled:opacity-50 flex-shrink-0"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? "Preparing…" : "Download PNG"}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-5 items-start">
        {/* ── Controls column ─────────────────────────────────────────────── */}
        <div className="space-y-5 min-w-0">
          {/* Design picker */}
          <div className="bg-white rounded-2xl border border-[#e5e5e5] p-5">
            <p className={labelCls}>Design</p>
            <div className="grid grid-cols-3 gap-3">
              {POSTER_DESIGNS.map((d) => {
                const active = design === d.id
                const thumbScale = 132 / fmt.h
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDesign(d.id)}
                    aria-pressed={active}
                    className={`text-left rounded-xl border-2 p-2 transition-all ${
                      active
                        ? "border-[#d6b357] bg-[#fffdf3] shadow-[0_4px_16px_-6px_rgba(214,179,87,0.5)]"
                        : "border-[#e5e5e5] hover:border-[#c4c9d4]"
                    }`}
                  >
                    <div
                      className="rounded-lg overflow-hidden border border-[#f0f0f0] mx-auto"
                      style={{ width: fmt.w * thumbScale, height: 132 }}
                    >
                      <div style={{ transform: `scale(${thumbScale})`, transformOrigin: "top left" }}>
                        <ProjectPoster {...posterProps} design={d.id} />
                      </div>
                    </div>
                    <p className={`mt-2 text-xs font-bold ${active ? "text-[#8a6a10]" : "text-[#374151]"}`}>{d.name}</p>
                    <p className="text-[10px] text-[#9ca3af] leading-snug">{d.tagline}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Format + QR */}
          <div className="bg-white rounded-2xl border border-[#e5e5e5] p-5 space-y-4">
            <div>
              <p className={labelCls}>Format</p>
              <div className="flex gap-2">
                {(Object.keys(POSTER_FORMATS) as PosterFormatId[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                      format === f
                        ? "bg-[#001f3f] text-white"
                        : "bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e8eaee]"
                    }`}
                  >
                    {POSTER_FORMATS[f].label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[#9ca3af] mt-1.5">{fmt.hint}</p>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showQr}
                onChange={(e) => setShowQr(e.target.checked)}
                className="w-4 h-4 accent-[#001f3f]"
              />
              <QrCode className="w-4 h-4 text-[#d6b357]" />
              <span className="text-sm font-semibold text-[#374151]">
                QR code to the public project page
              </span>
            </label>
          </div>

          {/* Hero image picker */}
          <div className="bg-white rounded-2xl border border-[#e5e5e5] p-5">
            <p className={labelCls}>
              <ImageIcon className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              Hero image
            </p>
            {data.gallery.length === 0 ? (
              <p className="text-sm text-[#9ca3af] py-3">
                No images yet — add photos in the Images tab and they will appear here.
              </p>
            ) : (
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {data.gallery.slice(0, 12).map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setHeroUrl(url)}
                    className={`flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                      heroUrl === url ? "border-[#d6b357] shadow-md" : "border-transparent hover:border-[#c4c9d4]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={proxied(url)} alt="" className="w-24 h-16 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Copy + contact */}
          <div className="bg-white rounded-2xl border border-[#e5e5e5] p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="poster-title" className={labelCls}>Project name</label>
                <input
                  id="poster-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={data.name}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="poster-price" className={labelCls}>Price (AED)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#6b7280] pointer-events-none">
                    AED
                  </span>
                  <input
                    id="poster-price"
                    type="text"
                    inputMode="numeric"
                    value={price}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "")
                      setPrice(digits ? Number(digits).toLocaleString("en-US") : "")
                    }}
                    placeholder="1,200,000 — clear to hide"
                    className={`${inputCls} pl-12`}
                  />
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="poster-headline" className="text-xs font-semibold text-[#6b7280]">
                  Description
                </label>
                <button
                  type="button"
                  onClick={() => void generateHeadline()}
                  disabled={aiBusy}
                  className="flex items-center gap-1 text-xs font-bold text-[#8a6a10] bg-[#fdf6e3] border border-[#f0e8c8] rounded-full px-3 py-1 hover:bg-[#faedc8] transition-all disabled:opacity-50"
                >
                  {aiBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  AI Generate
                </button>
              </div>
              <textarea
                id="poster-headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                rows={3}
                placeholder="A short premium description for the poster…"
                className={`${inputCls} resize-none`}
              />
              {format === "square" && (
                <p className="text-[11px] text-[#9ca3af] mt-1">
                  The Square format keeps the layout compact and doesn&apos;t show the description.
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="poster-phone" className={labelCls}>Contact phone</label>
                <input id="poster-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 …" className={inputCls} />
              </div>
              <div>
                <label htmlFor="poster-email" className={labelCls}>Contact email</label>
                <input id="poster-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sales@…" className={inputCls} />
              </div>
            </div>
            <p className="text-[11px] text-[#9ca3af]">
              Starting price {formatPrice(data.priceFrom ?? 0, data.currency)} · {data.amenities.length} amenities ·{" "}
              {data.features.length} features pulled automatically from the project.
            </p>
          </div>
        </div>

        {/* ── Preview column ──────────────────────────────────────────────── */}
        <div className="mx-auto xl:mx-0">
          <div
            className="rounded-2xl overflow-hidden shadow-[0_12px_48px_-12px_rgba(0,31,63,0.45)] border border-[#e5e5e5] bg-white"
            style={{ width: fmt.w * previewScale, height: fmt.h * previewScale }}
          >
            <div style={{ transform: `scale(${previewScale})`, transformOrigin: "top left" }}>
              <ProjectPoster ref={posterRef} {...posterProps} />
            </div>
          </div>
          <p className="text-center text-[11px] text-[#9ca3af] mt-2">
            Live preview · exports at {fmt.w * 2} × {fmt.h * 2} px
          </p>
        </div>
      </div>
    </div>
  )
}
