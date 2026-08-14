"use client"

// Top Developer Studio — opens from the Sales Report header, next to the Top
// Seller studio. Ranks developers by validated production for the chosen
// period (/api/sales/top-developers), fills the generated poster template
// with the leader's logo, name and figures, and exports a print-ready PNG
// through the shared capture pipeline.
//
// The template is public/images/topdevelopersolo.png (1086×1448). Its blank
// zones are filled by absolutely-positioned overlays; the LAYOUT constants
// below are the placeholder coordinates measured off the design, so nudging
// the artwork only means adjusting numbers here.

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Award, Building2, Download, Loader2, X } from "lucide-react"
import { capturePng, warmFontEmbedCSS } from "@/lib/flyer/capture"
import { proxied } from "@/lib/flyer/theme"
import { sampleLogoBg } from "@/lib/logo-bg"

type Leader = {
  id: string
  name: string
  logoUrl: string | null
  slug: string | null
  deals: number
  projects: number
  value?: number
  rank: number
}

type Period = "month" | "quarter" | "year" | "all"

const PERIODS: { id: Period; label: string }[] = [
  { id: "month", label: "This month" },
  { id: "quarter", label: "This quarter" },
  { id: "year", label: "This year" },
  { id: "all", label: "All time" },
]

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const PREVIEW_MAX_H = 620

/** The month picker offers this year and the two before it. */
function selectableYears(): number[] {
  const y = new Date().getFullYear()
  return [y, y - 1, y - 2]
}

/** Compact money for the poster: 14.5M / 940K / 12,500. */
function money(value: number): string {
  const n = Number(value || 0)
  if (n >= 999_500) {
    const m = n / 1_000_000
    return `${m.toFixed(m >= 10 ? 1 : 2)}M`
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return n.toLocaleString("en-US")
}

// ── Poster ────────────────────────────────────────────────────────────────────

const TEMPLATE = "/images/topdevelopersolo.png"
const W = 1086
const H = 1448

/** Placeholder coordinates measured off the template (in template pixels). */
const LAYOUT = {
  // Gold medallion: the logo sits centred inside the white circle. `inner`
  // is the radius of the fill painted with the logo's own background color.
  logo: { cx: 306, cy: 517, box: 390, inner: 226 },
  // "DEVELOPER NAME" line — centred on the page.
  name: { cx: 543, cy: 882, maxWidth: 720 },
  // The three stat numbers inside the white card.
  stats: { cy: 1178, xs: [272, 543, 815] as const },
}

type PosterProps = {
  name: string
  logoUrl: string | null
  deals: number
  projects: number
  value: number | null
}

// ── Top-3 podium poster ───────────────────────────────────────────────────────

const TEMPLATE3 = "/images/top3developers.png"
const W3 = 1024
const H3 = 1536

/** Per-card geometry, measured off the podium template. Order: rank 1
 *  (center, gold), rank 2 (left, silver), rank 3 (right, bronze). Each card
 *  keeps its baked medal and 01/02/03 numerals; we fill the logo circle, the
 *  name line and the three stat values. `cover` patches hide the template's
 *  baked placeholders until a blank export replaces it. */
// Geometry measured off the template with a pixel scan (scripts in the
// session scratchpad): circle bounds via white-run detection, text bands via
// dark-pixel rows, cover colors sampled beside each band.
const LAYOUT3 = [
  {
    logo: { cx: 511, cy: 842, r: 107 },
    name: { cx: 511, y: 963, w: 300, size: 24, cover: { x: 393, y: 961, w: 236, h: 29, color: "rgb(248,243,235)" } },
    stats: { x: 582, w: 90, ys: [1077, 1127, 1177], size: 20 },
    colonCover: { x: 592, w: 16, color: "rgb(248,243,236)" },
    relabel: { x: 429, y: 1126, w: 182, h: 20, size: 12.5, color: "rgb(248,243,235)" },
  },
  {
    logo: { cx: 174, cy: 898, r: 99 },
    name: { cx: 174, y: 1010, w: 270, size: 19, cover: { x: 26, y: 1007, w: 246, h: 26, color: "rgb(245,245,245)" } },
    stats: { x: 204, w: 88, ys: [1101, 1142, 1184], size: 16 },
    colonCover: { x: 248, w: 20, color: "rgb(245,245,246)" },
    relabel: { x: 118, y: 1140, w: 90, h: 18, size: 10.5, color: "rgb(245,245,245)" },
  },
  {
    logo: { cx: 848, cy: 902, r: 98 },
    name: { cx: 848, y: 1011, w: 270, size: 19, cover: { x: 750, y: 1009, w: 196, h: 25, color: "rgb(248,242,237)" } },
    stats: { x: 874, w: 88, ys: [1102, 1143, 1185], size: 16 },
    colonCover: { x: 919, w: 20, color: "rgb(247,242,238)" },
    relabel: { x: 782, y: 1141, w: 96, h: 18, size: 10.5, color: "rgb(248,242,237)" },
  },
] as const

const Top3DevelopersPoster = forwardRef<HTMLDivElement, { leaders: Leader[] }>(
  function Top3DevelopersPoster({ leaders }, ref) {
    // One sampled medallion color per logo URL — stale keys are harmless.
    const [sampledByUrl, setSampledByUrl] = useState<Record<string, string | null>>({})

    return (
      <div
        ref={ref}
        className="relative overflow-hidden bg-white"
        style={{ width: W3, height: H3, fontFamily: "'Outfit', sans-serif" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={TEMPLATE3} alt="" width={W3} height={H3} className="absolute inset-0" />

        {leaders.slice(0, 3).map((l, i) => {
          const cfg = LAYOUT3[i]
          const nameSize = Math.min(cfg.name.size, Math.floor((cfg.name.w / Math.max(l.name.length, 1)) * 1.72))
          const logoBg = l.logoUrl ? sampledByUrl[l.logoUrl] ?? null : null
          const values = [
            String(l.deals),
            String(l.projects),
            typeof l.value === "number" ? money(l.value) : "—",
          ]
          return (
            <div key={l.id}>
              {/* Logo medallion — adopts the logo's own background color. */}
              {logoBg && (
                <div
                  className="absolute rounded-full"
                  style={{
                    left: cfg.logo.cx - cfg.logo.r,
                    top: cfg.logo.cy - cfg.logo.r,
                    width: cfg.logo.r * 2,
                    height: cfg.logo.r * 2,
                    backgroundColor: logoBg,
                  }}
                />
              )}
              {l.logoUrl && (
                <div
                  className="absolute flex items-center justify-center"
                  style={{
                    left: cfg.logo.cx - cfg.logo.r * 0.82,
                    top: cfg.logo.cy - cfg.logo.r * 0.82,
                    width: cfg.logo.r * 1.64,
                    height: cfg.logo.r * 1.64,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={proxied(l.logoUrl)}
                    alt=""
                    className="max-w-full max-h-full object-contain"
                    crossOrigin="anonymous"
                    onLoad={(e) => {
                      const color = sampleLogoBg(e.currentTarget, { acceptMidTones: true })
                      setSampledByUrl((m) => (m[l.logoUrl!] === color ? m : { ...m, [l.logoUrl!]: color }))
                    }}
                  />
                </div>
              )}

              {/* STOPGAP cover over the baked "DEVELOPER NAME" — the 01/02/03
                  numerals below it stay. Delete once a blank export lands. */}
              <div
                className="absolute"
                style={{
                  left: cfg.name.cover.x,
                  top: cfg.name.cover.y,
                  width: cfg.name.cover.w,
                  height: cfg.name.cover.h,
                  background: cfg.name.cover.color,
                }}
              />
              <div
                className="absolute text-center"
                style={{ left: cfg.name.cx - cfg.name.w / 2, top: cfg.name.y, width: cfg.name.w }}
              >
                <span
                  className="font-['Outfit'] font-bold uppercase text-[#16324f] leading-none whitespace-nowrap"
                  style={{ fontSize: nameSize, letterSpacing: "0.02em" }}
                >
                  {l.name}
                </span>
              </div>

              {/* Our data is deals/projects/value — repaint the template's
                  middle label ("TOTAL SALES") as TOTAL PROJECTS, keeping the
                  colon aligned with the rows above and below. */}
              <div
                className="absolute flex items-center"
                style={{
                  left: cfg.relabel.x,
                  top: cfg.relabel.y,
                  width: cfg.relabel.w,
                  height: cfg.relabel.h,
                  background: cfg.relabel.color,
                }}
              >
                <span
                  className="font-['Outfit'] font-bold uppercase text-[#24304a] whitespace-nowrap"
                  style={{ fontSize: cfg.relabel.size, letterSpacing: "0.02em" }}
                >
                  Total Projects
                </span>
              </div>

              {/* Erase the template's baked colons — values are right-aligned
                  instead, so nothing reads as filled-in-after-the-fact. */}
              {cfg.stats.ys.map((y, row) => (
                <div
                  key={`cc-${row}`}
                  className="absolute"
                  style={{
                    left: cfg.colonCover.x,
                    top: y - 3,
                    width: cfg.colonCover.w,
                    height: cfg.stats.size + 8,
                    background: cfg.colonCover.color,
                  }}
                />
              ))}

              {/* Stat values — right-aligned against the card's inner edge. */}
              {values.map((v, row) => (
                <div
                  key={row}
                  className="absolute text-right"
                  style={{ left: cfg.stats.x, top: cfg.stats.ys[row], width: cfg.stats.w }}
                >
                  <span
                    className="font-['Outfit'] font-bold text-[#16324f] leading-none whitespace-nowrap"
                    style={{ fontSize: cfg.stats.size }}
                  >
                    {v}
                  </span>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    )
  },
)

const TopDeveloperPoster = forwardRef<HTMLDivElement, PosterProps>(function TopDeveloperPoster(
  { name, logoUrl, deals, projects, value },
  ref,
) {
  // The medallion adopts the logo's own background color (sampled from its
  // corner pixels), so logos with baked white/colored rectangles blend into
  // the circle instead of floating on it like a pasted card. The sample is
  // keyed to its URL, so switching developers can't paint a stale color.
  const [sampled, setSampled] = useState<{ url: string; color: string | null } | null>(null)
  const logoBg = sampled && sampled.url === logoUrl ? sampled.color : null

  // One line, always — long names shrink instead of wrapping over the ribbon.
  const nameSize = Math.min(56, Math.floor((LAYOUT.name.maxWidth / Math.max(name.length, 1)) * 1.7))

  const stat = (v: string, x: number) => (
    <div
      key={x}
      className="absolute text-center"
      style={{ left: x - 160, top: LAYOUT.stats.cy - 34, width: 320 }}
    >
      <span
        className="font-['Outfit'] font-bold text-[#16324f] leading-none"
        style={{ fontSize: 46 }}
      >
        {v}
      </span>
    </div>
  )

  return (
    <div
      ref={ref}
      className="relative overflow-hidden bg-white"
      style={{ width: W, height: H, fontFamily: "'Outfit', sans-serif" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={TEMPLATE} alt="" width={W} height={H} className="absolute inset-0" />

      {/* STOPGAP: the current template has "DEVELOPER NAME" and "XX+" baked
          in; these patches hide them (colors sampled from the artwork).
          Delete this block once the blank export replaces the template. */}
      <div
        className="absolute"
        style={{
          left: 288,
          top: 843,
          width: 512,
          height: 76,
          background: "linear-gradient(rgb(252,251,248), rgb(251,249,246))",
        }}
      />
      {LAYOUT.stats.xs.map((x) => (
        <div
          key={x}
          className="absolute"
          style={{ left: x - 102, top: 1142, width: 204, height: 68, background: "rgb(252,251,250)" }}
        />
      ))}

      {/* Logo in the medallion */}
      {logoUrl && (
        <>
          {logoBg && (
            <div
              className="absolute rounded-full"
              style={{
                left: LAYOUT.logo.cx - LAYOUT.logo.inner,
                top: LAYOUT.logo.cy - LAYOUT.logo.inner,
                width: LAYOUT.logo.inner * 2,
                height: LAYOUT.logo.inner * 2,
                backgroundColor: logoBg,
              }}
            />
          )}
          <div
            className="absolute flex items-center justify-center"
            style={{
              left: LAYOUT.logo.cx - LAYOUT.logo.box / 2,
              top: LAYOUT.logo.cy - LAYOUT.logo.box / 2,
              width: LAYOUT.logo.box,
              height: LAYOUT.logo.box,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={proxied(logoUrl)}
              alt=""
              className="max-w-full max-h-full object-contain"
              crossOrigin="anonymous"
              onLoad={(e) =>
                setSampled({ url: logoUrl, color: sampleLogoBg(e.currentTarget, { acceptMidTones: true }) })
              }
            />
          </div>
        </>
      )}

      {/* Developer name */}
      <div
        className="absolute text-center"
        style={{ left: LAYOUT.name.cx - LAYOUT.name.maxWidth / 2, top: LAYOUT.name.cy - 36, width: LAYOUT.name.maxWidth }}
      >
        <span
          className="font-['Outfit'] font-bold uppercase text-[#16324f] leading-none whitespace-nowrap"
          style={{ fontSize: nameSize, letterSpacing: "0.02em" }}
        >
          {name}
        </span>
      </div>

      {/* Deals · Projects · Value */}
      {stat(String(deals), LAYOUT.stats.xs[0])}
      {stat(String(projects), LAYOUT.stats.xs[1])}
      {stat(value != null ? money(value) : "—", LAYOUT.stats.xs[2])}
    </div>
  )
})

// ── Studio modal ──────────────────────────────────────────────────────────────

export function TopDeveloperStudio({ onClose }: { onClose: () => void }) {
  const now = new Date()
  const [period, setPeriod] = useState<Period>("year")
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [loadedPeriod, setLoadedPeriod] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryTick, setRetryTick] = useState(0)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [kind, setKind] = useState<"solo" | "top3">("solo")
  const [exporting, setExporting] = useState(false)

  const posterRef = useRef<HTMLDivElement>(null)
  const periodKey = period === "month" ? `month:${year}-${month}` : period
  const loading = loadedPeriod !== periodKey

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const qs =
          period === "month"
            ? `scope=month&year=${year}&month=${month}`
            : `period=${period}`
        const res = await fetch(`/api/sales/top-developers?${qs}`, { cache: "no-store" })
        if (!res.ok) throw new Error(`leaderboard ${res.status}`)
        const body = (await res.json()) as { leaders?: Leader[] }
        if (!alive) return
        setLeaders(body.leaders ?? [])
        setLoadError(null)
      } catch {
        if (!alive) return
        setLeaders([])
        setLoadError("Couldn't load the developer board. Check your connection and retry.")
      } finally {
        if (alive) setLoadedPeriod(periodKey)
      }
    })()
    return () => { alive = false }
  }, [period, year, month, periodKey, retryTick])

  useEffect(() => {
    if (!loading) warmFontEmbedCSS(posterRef.current)
  }, [loading])

  const picked = useMemo(
    () => leaders.find((l) => l.id === pickedId) ?? leaders[0] ?? null,
    [leaders, pickedId],
  )

  // The podium always features ranks 1–3; it needs three developers on the board.
  const isTop3 = kind === "top3"
  const top3Ready = leaders.length >= 3
  const posterW = isTop3 ? W3 : W
  const posterH = isTop3 ? H3 : H
  const canRender = isTop3 ? top3Ready : Boolean(picked)
  const previewScale = Math.min(PREVIEW_MAX_H / posterH, 420 / posterW)

  const handleDownload = useCallback(async () => {
    const node = posterRef.current
    if (!node || exporting || !canRender) return
    setExporting(true)
    try {
      const png = await capturePng(node, { width: posterW, height: posterH, pixelRatio: 2 })
      const slug = isTop3
        ? "podium"
        : (picked?.name ?? "developer").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      const a = document.createElement("a")
      a.href = png
      a.download = `fhi-top-developer${isTop3 ? "s" : ""}-${slug}.png`
      a.click()
    } catch {
      setLoadError("Export failed — please try again.")
    } finally {
      setExporting(false)
    }
  }, [exporting, canRender, isTop3, posterW, posterH, picked])

  const pillCls = (active: boolean) =>
    `px-4 py-2 text-sm font-semibold border transition-colors ${
      active
        ? "bg-[#001f3f] border-[#001f3f] text-white"
        : "bg-white border-[#dfe3e8] text-[#5f6368] hover:border-[#001f3f] hover:text-[#001f3f]"
    }`

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-[#001f3f]/60 p-4 sm:p-8">
      <div className="w-full max-w-6xl bg-white shadow-2xl overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 bg-[#001f3f]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-[#d6b357] flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-[#001f3f]" />
            </div>
            <div className="min-w-0">
              <h2 className="font-['Outfit'] text-lg font-bold text-white truncate">Top Developer Studio</h2>
              <p className="text-xs text-[#a9b6c8] truncate">
                Developer posters built from validated sales — pick a period and download.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={exporting || !canRender}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#d6b357] text-[#1a1408] text-sm font-bold hover:brightness-95 transition-all disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? "Preparing…" : "Download PNG"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
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
              {period === "month" && (
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  <select
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    aria-label="Month"
                    className="border border-[#dfe3e8] bg-white px-3 py-2 text-sm font-semibold text-[#0d1117] focus:outline-none focus:border-[#001f3f]"
                  >
                    {MONTH_NAMES.map((m, i) => (
                      <option key={m} value={i + 1}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    aria-label="Year"
                    className="border border-[#dfe3e8] bg-white px-3 py-2 text-sm font-semibold text-[#0d1117] focus:outline-none focus:border-[#001f3f]"
                  >
                    {selectableYears().map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <span className="text-[11px] text-[#9ca3af]">Ranked on that month&apos;s production.</span>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-[#6b7280] mb-2">Poster</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setKind("solo")} className={pillCls(!isTop3)}>
                  No. 1 Solo
                </button>
                <button type="button" onClick={() => setKind("top3")} className={pillCls(isTop3)}>
                  Top 3 Podium
                </button>
              </div>
              {isTop3 && !loading && !top3Ready && (
                <p className="text-[11px] text-[#b45309] mt-1.5">
                  The podium needs three developers with validated sales — pick a wider period.
                </p>
              )}
            </div>

            {/* leaderboard */}
            <div>
              <p className="text-xs font-semibold text-[#6b7280] mb-2">
                Developer{" "}
                <span className="font-normal text-[#9ca3af]">
                  {isTop3 ? "· the podium always features ranks 1–3" : "· ranked by validated contract value"}
                </span>
              </p>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-14 bg-[#f3f4f6] animate-pulse" />
                  ))}
                </div>
              ) : loadError ? (
                <div className="border border-amber-200 bg-amber-50 p-4 text-sm text-[#92400e]">
                  {loadError}
                  <button
                    type="button"
                    onClick={() => setRetryTick((t) => t + 1)}
                    className="ml-3 px-3 py-1.5 bg-[#001f3f] text-white text-xs font-semibold"
                  >
                    Retry
                  </button>
                </div>
              ) : leaders.length === 0 ? (
                <p className="border border-[#e5e5e5] p-4 text-sm text-[#9ca3af]">
                  No validated sales in this period yet — pick a wider period.
                </p>
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {leaders.map((l) => {
                    const active = picked?.id === l.id
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setPickedId(l.id)}
                        className={`relative w-full flex items-center gap-3 border p-3 pl-4 text-left transition-colors ${
                          active ? "border-[#d6b357] bg-[#faf7ee]" : "border-[#e5e5e5] hover:border-[#c4c9d4]"
                        }`}
                      >
                        {active && (
                          <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#d6b357]" aria-hidden="true" />
                        )}
                        <span
                          className={`w-8 h-8 flex items-center justify-center text-xs font-bold shrink-0 ${
                            l.rank === 1 ? "bg-[#d6b357] text-[#1a1408]" : "bg-[#f3f4f6] text-[#6b7280]"
                          }`}
                        >
                          {l.rank}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-[#0d1117] truncate">{l.name}</span>
                          <span className="block text-xs text-[#6b7280]">
                            {l.deals} deal{l.deals === 1 ? "" : "s"} · {l.projects} project{l.projects === 1 ? "" : "s"}
                            {typeof l.value === "number" &&
                              ` · ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(l.value)} AED`}
                          </span>
                        </span>
                        {l.rank === 1 && <Award className="w-4 h-4 text-[#d6b357] shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <p className="text-[11px] text-[#9ca3af] leading-relaxed">
              The poster fills in the developer&apos;s logo, name, validated deals, live project count
              and total contract value. The wording and artwork are part of the template.
            </p>
          </div>

          {/* ── Preview ──────────────────────────────────────────────────── */}
          <div className="mx-auto lg:mx-0">
            {canRender ? (
              <>
                <div
                  className="overflow-hidden border border-[#e5e5e5] shadow-[0_12px_48px_-12px_rgba(0,31,63,0.45)]"
                  style={{ width: posterW * previewScale, height: posterH * previewScale }}
                >
                  <div style={{ transform: `scale(${previewScale})`, transformOrigin: "top left" }}>
                    {isTop3 ? (
                      <Top3DevelopersPoster ref={posterRef} leaders={leaders} />
                    ) : (
                      picked && (
                        <TopDeveloperPoster
                          ref={posterRef}
                          name={picked.name}
                          logoUrl={picked.logoUrl}
                          deals={picked.deals}
                          projects={picked.projects}
                          value={typeof picked.value === "number" ? picked.value : null}
                        />
                      )
                    )}
                  </div>
                </div>
                <p className="text-center text-[11px] text-[#9ca3af] mt-2">
                  Live preview · exports at {posterW * 2} × {posterH * 2} px
                </p>
              </>
            ) : (
              <div
                className="border border-dashed border-[#e5e5e5] flex items-center justify-center text-center p-6"
                style={{ width: 320, height: 426 }}
              >
                <p className="text-sm text-[#9ca3af]">
                  {loading
                    ? "Loading production…"
                    : isTop3
                      ? "The podium needs three developers with validated sales — pick a wider period."
                      : "Pick a period with validated sales to build a poster."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
