"use client"

// Top Seller Studio — opens from the Sales Report header. Ranks agents by real
// production for the chosen period, auto-fills the poster with the leader, and
// exports a print-ready PNG through the shared capture pipeline.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Award, Crown, Download, Loader2, X } from "lucide-react"
import { capturePng, warmFontEmbedCSS } from "@/lib/flyer/capture"
import {
  AWARDS,
  POSTER_FORMATS,
  TopSellerPoster,
  roleTitleFor,
  type AwardId,
  type PosterFormatId,
} from "./top-seller-poster"

type Leader = {
  id: string
  name: string | null
  role: string | null
  profileUrl: string | null
  deals: number
  value: number
  rank: number
}

type Period = "month" | "quarter" | "year" | "all"

const PERIODS: { id: Period; label: string }[] = [
  { id: "month", label: "This month" },
  { id: "quarter", label: "This quarter" },
  { id: "year", label: "This year" },
  { id: "all", label: "All time" },
]

const PREVIEW_MAX_H = 620
const DEFAULT_MESSAGE =
  "Thank you for your outstanding performance and dedication. You make a difference!"

function periodLabel(period: Period): string {
  const now = new Date()
  if (period === "all") return "ALL TIME"
  if (period === "year") return String(now.getFullYear())
  if (period === "quarter") return `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`
  return now.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase()
}

export function TopSellerStudio({ onClose }: { onClose: () => void }) {
  const [period, setPeriod] = useState<Period>("year")
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [loadedPeriod, setLoadedPeriod] = useState<Period | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryTick, setRetryTick] = useState(0)

  const [pickedId, setPickedId] = useState<string | null>(null)
  const [award, setAward] = useState<AwardId>("top-seller")
  const [format, setFormat] = useState<PosterFormatId>("portrait")
  const [showStats, setShowStats] = useState(true)
  const [message, setMessage] = useState(DEFAULT_MESSAGE)
  const [exporting, setExporting] = useState(false)

  const posterRef = useRef<HTMLDivElement>(null)
  const loading = loadedPeriod !== period

  // Leaderboard for the chosen period.
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = await fetch(`/api/sales/top-sellers?period=${period}`, { cache: "no-store" })
        if (!res.ok) throw new Error(`leaderboard ${res.status}`)
        const body = (await res.json()) as { leaders?: Leader[] }
        if (!alive) return
        setLeaders(body.leaders ?? [])
        setLoadError(null)
      } catch {
        if (!alive) return
        setLeaders([])
        setLoadError("Couldn't load the leaderboard. Check your connection and retry.")
      } finally {
        if (alive) setLoadedPeriod(period)
      }
    })()
    return () => { alive = false }
  }, [period, retryTick])

  useEffect(() => {
    if (!loading) warmFontEmbedCSS(posterRef.current)
  }, [loading])

  // The picked agent, falling back to the current leader whenever the previous
  // pick isn't in this period's board.
  const picked = useMemo(
    () => leaders.find((l) => l.id === pickedId) ?? leaders[0] ?? null,
    [leaders, pickedId],
  )

  const fmt = POSTER_FORMATS[format]
  const previewScale = Math.min(PREVIEW_MAX_H / fmt.h, 420 / fmt.w)

  const handleDownload = useCallback(async () => {
    const node = posterRef.current
    if (!node || exporting || !picked) return
    setExporting(true)
    try {
      const png = await capturePng(node, { width: fmt.w, height: fmt.h, pixelRatio: 2 })
      const slug = (picked.name ?? "agent").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      const a = document.createElement("a")
      a.href = png
      a.download = `fhi-${award}-${slug}-${format}.png`
      a.click()
    } catch {
      setLoadError("Export failed — please try again.")
    } finally {
      setExporting(false)
    }
  }, [exporting, fmt, picked, award, format])

  const posterProps = picked
    ? {
        format,
        award,
        name: picked.name ?? "Top Performer",
        roleTitle: roleTitleFor(picked.role),
        photoUrl: picked.profileUrl,
        deals: picked.deals,
        value: picked.value,
        periodLabel: periodLabel(period),
        showStats,
        message,
      }
    : null

  const pillCls = (active: boolean) =>
    `px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
      active ? "bg-[#001f3f] text-white" : "bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e8eaee]"
    }`

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-[#001f3f]/60 p-4 sm:p-8">
      <div className="w-full max-w-6xl rounded-3xl bg-white shadow-2xl overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 bg-[#001f3f]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#d6b357] flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-[#001f3f]" />
            </div>
            <div className="min-w-0">
              <h2 className="font-['Outfit'] text-lg font-bold text-white truncate">Top Seller Studio</h2>
              <p className="text-xs text-[#a9b6c8] truncate">
                Award posters built from real production — pick a period and download.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={exporting || !picked}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#d6b357] text-[#001f3f] text-sm font-bold hover:bg-[#c8a544] transition-colors disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? "Preparing…" : "Download PNG"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 p-6">
          {/* ── Controls ─────────────────────────────────────────────────── */}
          <div className="space-y-5 min-w-0">
            <div>
              <p className="text-xs font-semibold text-[#6b7280] mb-2">Period</p>
              <div className="flex flex-wrap gap-2">
                {PERIODS.map((p) => (
                  <button key={p.id} type="button" onClick={() => setPeriod(p.id)} className={pillCls(period === p.id)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* leaderboard */}
            <div>
              <p className="text-xs font-semibold text-[#6b7280] mb-2">
                Honoree <span className="font-normal text-[#9ca3af]">· ranked by contract value</span>
              </p>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-14 rounded-2xl bg-[#f3f4f6] animate-pulse" />
                  ))}
                </div>
              ) : loadError ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-[#92400e]">
                  {loadError}
                  <button
                    type="button"
                    onClick={() => setRetryTick((t) => t + 1)}
                    className="ml-3 px-3 py-1.5 rounded-lg bg-[#001f3f] text-white text-xs font-semibold"
                  >
                    Retry
                  </button>
                </div>
              ) : leaders.length === 0 ? (
                <p className="rounded-2xl border border-[#e5e5e5] p-4 text-sm text-[#9ca3af]">
                  No sales recorded in this period yet — pick a wider period.
                </p>
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {leaders.map((l) => {
                    const active = picked?.id === l.id
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setPickedId(l.id)}
                        className={`w-full flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-colors ${
                          active ? "border-[#d6b357] bg-[#fffdf3]" : "border-[#e5e5e5] hover:border-[#c4c9d4]"
                        }`}
                      >
                        <span
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            l.rank === 1 ? "bg-[#d6b357] text-[#001f3f]" : "bg-[#f3f4f6] text-[#6b7280]"
                          }`}
                        >
                          {l.rank}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-[#0d1117] truncate">
                            {l.name ?? "Unnamed agent"}
                          </span>
                          <span className="block text-xs text-[#6b7280]">
                            {l.deals} deal{l.deals === 1 ? "" : "s"} ·{" "}
                            {new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(l.value)} AED
                          </span>
                        </span>
                        {l.rank === 1 && <Award className="w-4 h-4 text-[#d6b357] shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-[#6b7280] mb-2">Award</p>
              <div className="flex flex-wrap gap-2">
                {AWARDS.map((a) => (
                  <button key={a.id} type="button" onClick={() => setAward(a.id)} className={pillCls(award === a.id)}>
                    {a.line1} {a.line2}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-[#6b7280] mb-2">Format</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(POSTER_FORMATS) as PosterFormatId[]).map((f) => (
                  <button key={f} type="button" onClick={() => setFormat(f)} className={pillCls(format === f)}>
                    {POSTER_FORMATS[f].label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[#9ca3af] mt-1.5">{fmt.hint}</p>
            </div>

            <div>
              <label htmlFor="ts-message" className="block text-xs font-semibold text-[#6b7280] mb-1.5">
                Message
              </label>
              <textarea
                id="ts-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                className="w-full border border-[#e5e5e5] rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5"
              />
              <label className="flex items-center gap-2.5 mt-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showStats}
                  onChange={(e) => setShowStats(e.target.checked)}
                  className="w-4 h-4 accent-[#001f3f]"
                />
                <span className="text-sm font-semibold text-[#374151]">Show the production numbers on the poster</span>
              </label>
            </div>
          </div>

          {/* ── Preview ──────────────────────────────────────────────────── */}
          <div className="mx-auto lg:mx-0">
            {posterProps ? (
              <>
                <div
                  className="rounded-2xl overflow-hidden border border-[#e5e5e5] shadow-[0_12px_48px_-12px_rgba(0,31,63,0.45)]"
                  style={{ width: fmt.w * previewScale, height: fmt.h * previewScale }}
                >
                  <div style={{ transform: `scale(${previewScale})`, transformOrigin: "top left" }}>
                    <TopSellerPoster ref={posterRef} {...posterProps} />
                  </div>
                </div>
                <p className="text-center text-[11px] text-[#9ca3af] mt-2">
                  Live preview · exports at {fmt.w * 2} × {fmt.h * 2} px
                </p>
              </>
            ) : (
              <div
                className="rounded-2xl border border-dashed border-[#e5e5e5] flex items-center justify-center text-center p-6"
                style={{ width: 320, height: 480 }}
              >
                <p className="text-sm text-[#9ca3af]">
                  {loading ? "Loading production…" : "Pick a period with recorded sales to build a poster."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
