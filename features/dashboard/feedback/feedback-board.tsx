"use client"

// Customer Feedback board: the agent's personal share link + QR code, the
// aggregate picture (overall average, recommend rate, per-category bars), and
// every review as a card. Reads live under RLS via lib/feedback-service.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import QRCode from "qrcode"
import {
  Check, Copy, Download, ExternalLink, Eye, Loader2, MessageSquareQuote,
  QrCode, Star, ThumbsUp, Users, X,
} from "lucide-react"
import { buildFeedbackPoster } from "./feedback-poster"
import {
  type AgentFeedback,
  RECOMMEND_LABELS,
  SCORE_CATEGORIES,
  fetchMyFeedback,
} from "@/lib/feedback-service"

const TYPE_LABELS: Record<string, string> = { sale: "Sale", rent: "Rent", purchase: "Purchase" }

export function FeedbackBoard({ agentId, agentName }: { agentId: string; agentName: string }) {
  const [rows, setRows] = useState<AgentFeedback[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // The link is origin-dependent (localhost in dev, fhiglobal.ae in prod).
  const [link, setLink] = useState("")
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // The printable poster is generated on demand (canvas work is wasted if
  // nobody opens it) and cached for the session.
  const [poster, setPoster] = useState<string | null>(null)
  const [posterOpen, setPosterOpen] = useState(false)
  const [posterBusy, setPosterBusy] = useState(false)
  const [posterError, setPosterError] = useState<string | null>(null)

  useEffect(() => {
    const url = `${window.location.origin}/feedback/${agentId}`
    const load = async () => {
      setLink(url)
      try {
        // Navy-on-white so a printed QR still scans cleanly.
        setQr(await QRCode.toDataURL(url, { width: 480, margin: 2, color: { dark: "#001f3f", light: "#ffffff" } }))
      } catch {
        setQr(null) // link + copy still work without the QR
      }
      const { data, error: err } = await fetchMyFeedback(agentId)
      if (err) setError(err)
      else setRows(data)
    }
    const t = setTimeout(() => { void load() }, 0)
    return () => clearTimeout(t)
  }, [agentId])

  useEffect(() => () => clearTimeout(copyTimer.current), [])

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked — the input below is selectable by hand.
    }
  }, [link])

  const ensurePoster = useCallback(async (): Promise<string | null> => {
    if (poster) return poster
    if (!qr) return null
    setPosterBusy(true)
    setPosterError(null)
    try {
      const url = await buildFeedbackPoster({
        qrDataUrl: qr,
        agentName,
        siteLabel: window.location.host.replace(/^www\./, ""),
      })
      setPoster(url)
      return url
    } catch (err) {
      setPosterError((err as Error).message)
      return null
    } finally {
      setPosterBusy(false)
    }
  }, [poster, qr, agentName])

  const posterFileName = `fhi-feedback-poster-${agentName.replace(/\s+/g, "-").toLowerCase()}.png`

  const downloadPoster = useCallback(async () => {
    const url = await ensurePoster()
    if (!url) return
    const a = document.createElement("a")
    a.href = url
    a.download = posterFileName
    a.click()
  }, [ensurePoster, posterFileName])

  // Escape closes the preview, matching every other overlay in the dashboard.
  useEffect(() => {
    if (!posterOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPosterOpen(false) }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [posterOpen])

  const stats = useMemo(() => {
    if (!rows || rows.length === 0) return null
    const n = rows.length
    const avg = (pick: (r: AgentFeedback) => number) =>
      rows.reduce((sum, r) => sum + pick(r), 0) / n
    const overall = avg((r) => r.overall_rating)
    const wouldRecommend =
      rows.filter((r) => r.recommend === "definitely_yes" || r.recommend === "very_likely" || r.recommend === "likely").length / n
    const categories = SCORE_CATEGORIES.map((c) => ({
      label: c.label,
      value: avg((r) => r[c.key as keyof AgentFeedback] as number),
    }))
    return { n, overall, wouldRecommend, categories }
  }, [rows])

  return (
    <div className="space-y-5 pb-12">
      {/* ── Share card ── */}
      <div className="bg-[#001f3f] p-6 sm:p-8 flex flex-col lg:flex-row gap-8 lg:items-center">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6b357] mb-2">
            Customer Feedback
          </p>
          <h1 className="font-['Outfit'] text-2xl font-bold text-white tracking-tight">
            Your personal review link
          </h1>
          <p className="text-white/65 text-sm leading-relaxed mt-2 max-w-lg">
            Send this link to a client — or let them scan the QR code — and their review lands
            here automatically. No login needed on their side.
          </p>

          <div className="mt-5 flex flex-col sm:flex-row gap-2 max-w-xl">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
              aria-label="Your feedback link"
              className="flex-1 min-w-0 bg-white/10 border border-white/20 px-3.5 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[#d6b357]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void copyLink()}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#d6b357] text-[#1a1408] text-sm font-bold hover:brightness-95 transition-all shrink-0"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy"}
              </button>
              <a
                href={link || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-white/25 text-white text-sm font-semibold hover:bg-white/10 transition-colors shrink-0"
              >
                <ExternalLink className="w-4 h-4" /> Open
              </a>
            </div>
          </div>
        </div>

        {/* QR block */}
        <div className="shrink-0 text-center">
          {qr ? (
            <>
              <div className="inline-block bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR code for your feedback link" className="w-56 h-56" />
              </div>
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => { setPosterOpen(true); void ensurePoster() }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-white/25 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" /> Preview poster
                </button>
                <button
                  type="button"
                  onClick={() => void downloadPoster()}
                  disabled={posterBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#d6b357] text-[#1a1408] text-xs font-bold hover:brightness-95 disabled:opacity-60 transition-all"
                >
                  {posterBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Download
                </button>
              </div>
              {posterError && <p className="mt-2 text-xs text-rose-300">{posterError}</p>}
            </>
          ) : (
            <div className="w-56 h-56 bg-white/10 border border-white/20 flex items-center justify-center">
              <QrCode className="w-8 h-8 text-white/40" />
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      )}

      {/* ── Stats ── */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-[#e8eaed] p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6b7280] mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-[#b8913f]" /> Overall Rating
            </p>
            <div className="flex items-baseline gap-2">
              <span className="font-['Outfit'] text-[34px] leading-none font-bold text-[#001f3f]">
                {stats.overall.toFixed(1)}
              </span>
              <span className="text-sm text-[#9ca3af]">/ 5</span>
            </div>
            <div className="flex gap-0.5 mt-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${i <= Math.round(stats.overall) ? "fill-[#d6b357] text-[#d6b357]" : "text-[#dfe3e8]"}`}
                />
              ))}
            </div>
          </div>

          <div className="bg-white border border-[#e8eaed] p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6b7280] mb-3 flex items-center gap-2">
              <ThumbsUp className="w-4 h-4 text-[#b8913f]" /> Would Recommend
            </p>
            <div className="flex items-baseline gap-2">
              <span className="font-['Outfit'] text-[34px] leading-none font-bold text-[#001f3f]">
                {Math.round(stats.wouldRecommend * 100)}%
              </span>
            </div>
            <p className="text-xs text-[#9ca3af] mt-2">Likely, Very Likely or Definitely Yes</p>
          </div>

          <div className="bg-white border border-[#e8eaed] p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6b7280] mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#b8913f]" /> Total Reviews
            </p>
            <span className="font-['Outfit'] text-[34px] leading-none font-bold text-[#001f3f]">
              {stats.n}
            </span>
            <p className="text-xs text-[#9ca3af] mt-2">From your clients</p>
          </div>
        </div>
      )}

      {/* ── Per-category averages ── */}
      {stats && (
        <div className="bg-white border border-[#e8eaed] p-6">
          <h2 className="font-['Outfit'] text-base font-bold text-[#0d1117] mb-5">
            Performance by Category
          </h2>
          <div className="space-y-3.5">
            {stats.categories.map((c) => (
              <div key={c.label} className="flex items-center gap-4">
                <span className="w-44 shrink-0 text-[13px] text-[#374151]">{c.label}</span>
                <div className="flex-1 h-2 bg-[#eef0f3]">
                  <div
                    className="h-full bg-[#001f3f]"
                    style={{ width: `${(c.value / 5) * 100}%` }}
                  />
                </div>
                <span className="w-9 shrink-0 text-right text-[13px] font-bold text-[#001f3f]">
                  {c.value.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Reviews ── */}
      <div>
        <h2 className="font-['Outfit'] text-base font-bold text-[#0d1117] mb-4">
          {rows && rows.length > 0 ? `Reviews (${rows.length})` : "Reviews"}
        </h2>

        {rows === null && !error && (
          <div className="flex items-center justify-center py-16 bg-white border border-[#e8eaed]">
            <Loader2 className="w-6 h-6 animate-spin text-[#9ca3af]" />
          </div>
        )}

        {rows !== null && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 bg-white border border-[#e8eaed] text-center px-6">
            <MessageSquareQuote className="w-9 h-9 text-[#cdd2d9] mb-3" />
            <p className="font-semibold text-sm text-[#0d1117] mb-1">No reviews yet</p>
            <p className="text-xs text-[#6b7280] max-w-sm">
              Share your link or QR code with a client after closing — their feedback will show
              up here the moment they submit it.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {(rows ?? []).map((r) => (
            <article key={r.id} className="bg-white border border-[#e8eaed] p-5">
              <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${i <= r.overall_rating ? "fill-[#d6b357] text-[#d6b357]" : "text-[#dfe3e8]"}`}
                    />
                  ))}
                </div>
                <span className="text-sm font-bold text-[#0d1117]">{r.client_name}</span>
                {r.transaction_type && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#f3f4f6] text-[#374151]">
                    {TYPE_LABELS[r.transaction_type]}
                  </span>
                )}
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#eef4ff] text-[#1d4ed8]">
                  {RECOMMEND_LABELS[r.recommend]}
                </span>
                <time className="ml-auto text-xs text-[#9ca3af]">
                  {new Date(r.created_at).toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric" })}
                </time>
              </header>

              {r.property_ref && (
                <p className="text-xs text-[#6b7280] mt-2">Ref: {r.property_ref}</p>
              )}

              {(r.did_well || r.to_improve || r.other_comments) && (
                <div className="mt-3 pt-3 border-t border-[#f0f2f5] space-y-2.5">
                  {r.did_well && (
                    <p className="text-sm text-[#374151] leading-relaxed">
                      <span className="font-semibold text-[#0d1117]">Did well: </span>
                      {r.did_well}
                    </p>
                  )}
                  {r.to_improve && (
                    <p className="text-sm text-[#374151] leading-relaxed">
                      <span className="font-semibold text-[#0d1117]">Could improve: </span>
                      {r.to_improve}
                    </p>
                  )}
                  {r.other_comments && (
                    <p className="text-sm text-[#374151] leading-relaxed">
                      <span className="font-semibold text-[#0d1117]">Comments: </span>
                      {r.other_comments}
                    </p>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>

      {/* ── Poster preview ── */}
      {posterOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPosterOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Feedback poster preview"
        >
          <div
            className="bg-white max-w-[440px] w-full max-h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#eef0f3]">
              <p className="text-sm font-bold text-[#0d1117]">Printable poster</p>
              <button
                type="button"
                onClick={() => setPosterOpen(false)}
                aria-label="Close preview"
                className="p-1.5 text-[#6b7280] hover:text-[#0d1117] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-[#f5f6f8]">
              {poster ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={poster} alt="Feedback poster preview" className="w-full border border-[#e5e8ec]" />
              ) : (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="w-6 h-6 animate-spin text-[#9ca3af]" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 px-4 py-3 border-t border-[#eef0f3]">
              <button
                type="button"
                onClick={() => void downloadPoster()}
                disabled={!poster}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#001f3f] text-white text-sm font-bold hover:bg-[#0a3d6b] disabled:opacity-60 transition-colors"
              >
                <Download className="w-4 h-4" /> Download PNG
              </button>
              <span className="text-xs text-[#9ca3af]">Prints cleanly at A5 or A4.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
