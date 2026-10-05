"use client"

// Real Estate Data → Developers Breakdown.
//
// Who is selling: DLD transactions for a date range, each row credited to
// the developer behind its project. A transaction row names its project but
// never its developer, so the server resolves it in three layers
// (lib/dld-developer-lookup.ts): the archived DLD projects register, FHI's
// own projects + developers catalogue, then — only when the project's
// leading word is also the leading word of a developer those two already
// know — a guess labelled "(by name)". A project nobody recognises is
// "Unmatched project" (listed by name below, as the catalogue to-do list); a
// row with no project name is "Unknown". Both counted, never dropped.
//
// Same batch loader as Breakdowns (useBatchJob → /api/admin/dld/charts
// `kind: "breakdown"`, Transactions): the ranking fills in batch by batch and
// the coverage line says how much of the range it has reached. Its own cache
// keys, so it never disturbs the Breakdowns tab's remembered job.

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, Loader2, Search } from "lucide-react"
import { FilterSelect } from "@/components/ui/filter-select"
import { DLD_CHART_TOP_N, DLD_DATASETS, resolveDefault, type DldChartBucket } from "@/lib/dld-open-data"
import {
  ChartCard,
  CoverageLine,
  ErrorBox,
  RefreshButton,
  ShareBars,
  Skeleton,
  longDate,
  toBuckets,
  useBatchJob,
  type BatchJob,
} from "./market-charts"

const int = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat("en-AE", { notation: "compact", maximumFractionDigits: 1 })

const CACHE_KEY = "charts:developers:last"

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
/** Last 30 days inclusive of today. */
export function last30Days(): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 29)
  return { from: isoOf(from), to: isoOf(to) }
}

/** Sales only by default — mortgages and gifts say nothing about who is selling. */
const MEASURES = ["count", "value"] as const

/** Tile colours: one per meaning, reused on the Projects tab so the two read alike. */
export const TILE = {
  navy: "#001f3f",
  gold: "#b8913f",
  green: "#177a51",
  amber: "#b45309",
  slate: "#64748b",
} as const

export type TileChart =
  | { kind: "area"; values: number[] }
  | { kind: "bars"; values: number[] }
  /** Bars with a smooth line over their tops. */
  | { kind: "combo"; values: number[] }
  | { kind: "curve"; values: number[] }
  | { kind: "dots"; values: number[] }
  | { kind: "ring"; share: number }
  | { kind: "pie"; share: number }
  /** One point per day: x = that day's count, y = that day's AED — a real scatter, not a line of dots. */
  | { kind: "scatter"; x: number[]; y: number[] }
  /** A radar: one spoke per value (3 or more), e.g. transactions by day of the week. */
  | { kind: "radar"; values: number[] }
  /** A polar area chart: equal-angle wedges whose radius grows with the value (3 or more). */
  | { kind: "polar"; values: number[] }

/** Points in a 100 × 32 box for a daily series (oldest first); null below two points. */
function sparkPoints(values: number[]): Array<readonly [number, number]> | null {
  const pts = values.filter((v) => Number.isFinite(v))
  if (pts.length < 2) return null
  const max = Math.max(...pts, 1)
  const step = 100 / (pts.length - 1)
  return pts.map((v, i) => [i * step, 32 - (v / max) * 28] as const)
}

/** A smooth path through the points (Catmull-Rom → cubic Béziers), so the line bends instead of zig-zagging. */
function smoothPath(pts: Array<readonly [number, number]>): string {
  if (pts.length < 2) return ""
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d
}

/** The faint chart behind a tile — one kind per tile so the row reads as five different things, not one shape repeated. */
function TileBackground({ chart, color }: { chart: TileChart; color: string }) {
  if (chart.kind === "ring") {
    // Share as a ring, tucked into the tile's right edge.
    const r = 13
    const c = 2 * Math.PI * r
    const share = Math.min(100, Math.max(0, chart.share))
    return (
      <svg className="pointer-events-none absolute right-3 top-1/2 h-16 w-16 -translate-y-1/2" viewBox="0 0 36 36" aria-hidden>
        <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeOpacity={0.12} strokeWidth={5} />
        <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeOpacity={0.4} strokeWidth={5} strokeDasharray={`${(share / 100) * c} ${c}`} strokeLinecap="butt" transform="rotate(-90 18 18)" />
      </svg>
    )
  }
  if (chart.kind === "pie") {
    // Share as a solid wedge — no hole, unlike the ring.
    const share = Math.min(100, Math.max(0, chart.share))
    const a = (share / 100) * 2 * Math.PI
    const r = 15
    const x = 18 + r * Math.sin(a)
    const y = 18 - r * Math.cos(a)
    const wedge = share >= 100 ? null : `M18,18 L18,${18 - r} A${r},${r} 0 ${a > Math.PI ? 1 : 0} 1 ${x.toFixed(2)},${y.toFixed(2)} Z`
    return (
      <svg className="pointer-events-none absolute right-3 top-1/2 h-16 w-16 -translate-y-1/2" viewBox="0 0 36 36" aria-hidden>
        <circle cx="18" cy="18" r={r} fill={color} fillOpacity={0.12} />
        {wedge ? <path d={wedge} fill={color} fillOpacity={0.4} /> : <circle cx="18" cy="18" r={r} fill={color} fillOpacity={0.4} />}
      </svg>
    )
  }
  if (chart.kind === "radar") {
    const vals = chart.values.filter((v) => Number.isFinite(v))
    if (vals.length < 3) return null
    const max = Math.max(...vals, 1)
    const R = 15
    const pt = (i: number, r: number) => {
      const a = (i / vals.length) * 2 * Math.PI - Math.PI / 2
      return [18 + r * Math.cos(a), 18 + r * Math.sin(a)] as const
    }
    const poly = (r: (i: number) => number) => vals.map((_, i) => pt(i, r(i)).map((n) => n.toFixed(2)).join(",")).join(" ")
    return (
      <svg className="pointer-events-none absolute right-3 top-1/2 h-16 w-16 -translate-y-1/2" viewBox="0 0 36 36" aria-hidden>
        {[1 / 3, 2 / 3, 1].map((f) => (
          <polygon key={f} points={poly(() => R * f)} fill="none" stroke={color} strokeOpacity={0.15} strokeWidth={0.6} />
        ))}
        {vals.map((_, i) => {
          const [x, y] = pt(i, R)
          return <line key={i} x1="18" y1="18" x2={x.toFixed(2)} y2={y.toFixed(2)} stroke={color} strokeOpacity={0.15} strokeWidth={0.6} />
        })}
        <polygon points={poly((i) => (vals[i] / max) * R)} fill={color} fillOpacity={0.2} stroke={color} strokeOpacity={0.5} strokeWidth={0.9} />
      </svg>
    )
  }
  if (chart.kind === "polar") {
    const vals = chart.values.filter((v) => Number.isFinite(v))
    if (vals.length < 3) return null
    const max = Math.max(...vals, 1)
    const R = 15
    const step = (2 * Math.PI) / vals.length
    const wedge = (i: number, r: number) => {
      const a0 = i * step - Math.PI / 2
      const a1 = a0 + step
      const x0 = 18 + r * Math.cos(a0)
      const y0 = 18 + r * Math.sin(a0)
      const x1 = 18 + r * Math.cos(a1)
      const y1 = 18 + r * Math.sin(a1)
      return `M18,18 L${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`
    }
    return (
      <svg className="pointer-events-none absolute right-3 top-1/2 h-16 w-16 -translate-y-1/2" viewBox="0 0 36 36" aria-hidden>
        {[1 / 3, 2 / 3, 1].map((f) => (
          <circle key={f} cx="18" cy="18" r={R * f} fill="none" stroke={color} strokeOpacity={0.15} strokeWidth={0.6} />
        ))}
        {vals.map((v, i) => (
          <path key={i} d={wedge(i, Math.max(1.5, (v / max) * R))} fill={color} fillOpacity={0.12 + 0.25 * (v / max)} stroke="#fff" strokeOpacity={0.8} strokeWidth={0.5} />
        ))}
      </svg>
    )
  }
  if (chart.kind === "scatter") {
    const n = Math.min(chart.x.length, chart.y.length)
    if (n < 2) return null
    const maxX = Math.max(...chart.x.slice(0, n), 1)
    const maxY = Math.max(...chart.y.slice(0, n), 1)
    return (
      <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-14 w-full" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden>
        {Array.from({ length: n }, (_, i) => (
          <circle key={i} cx={4 + (chart.x[i] / maxX) * 92} cy={30 - (chart.y[i] / maxY) * 26} r={1.3} fill={color} fillOpacity={0.35} />
        ))}
      </svg>
    )
  }
  const pts = sparkPoints(chart.values)
  if (!pts) return null
  const common = { className: "pointer-events-none absolute inset-x-0 bottom-0 h-14 w-full", viewBox: "0 0 100 32", preserveAspectRatio: "none" as const, "aria-hidden": true as const }
  if (chart.kind === "bars" || chart.kind === "combo") {
    const w = Math.max(0.6, 100 / pts.length - 1.2)
    return (
      <svg {...common}>
        {pts.map(([x, y], i) => (
          <rect key={i} x={x - w / 2} y={y} width={w} height={32 - y} fill={color} fillOpacity={chart.kind === "combo" ? 0.12 : 0.16} />
        ))}
        {chart.kind === "combo" && <path d={smoothPath(pts)} fill="none" stroke={color} strokeOpacity={0.5} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />}
      </svg>
    )
  }
  if (chart.kind === "dots") {
    return (
      <svg {...common} preserveAspectRatio="none">
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.1} fill={color} fillOpacity={0.35} />
        ))}
      </svg>
    )
  }
  // "area" and "curve" both bend smoothly; area fills under the line, curve is the line alone (a touch heavier).
  const line = smoothPath(pts)
  return (
    <svg {...common}>
      {chart.kind === "area" && <path d={`${line} L100,32 L0,32 Z`} fill={color} fillOpacity={0.09} />}
      <path d={line} fill="none" stroke={color} strokeOpacity={chart.kind === "curve" ? 0.45 : 0.35} strokeWidth={chart.kind === "curve" ? 1.2 : 0.8} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/**
 * A stat tile with a colour accent: a tinted top edge and label, the figure
 * large, a one-line hint, (when `share` is given) a thin bar showing the
 * figure's share of the whole, and (when `spark` is given) a faint area
 * chart of the range's daily series behind everything — decoration that
 * still means something. Replaces the plain MiniStat on these tabs.
 */
export function StatTile({
  label,
  value,
  hint,
  color,
  share,
  chart,
}: {
  label: string
  value: string | null
  hint?: string
  color: string
  /** 0–100; draws the share bar. */
  share?: number | null
  /** The faint chart behind the tile (see TileChart) — a different kind per tile. */
  chart?: TileChart
}) {
  return (
    <div className="relative overflow-hidden border border-[#e8eaed] bg-white px-4 pb-3.5 pt-3" style={{ borderTop: `3px solid ${color}` }}>
      {chart && <TileBackground chart={chart} color={color} />}
      <div className="relative flex items-center gap-2">
        <span className="h-2 w-2 shrink-0" style={{ background: color }} aria-hidden />
        <span className="truncate text-[11px] font-bold uppercase tracking-wider" style={{ color }} title={label}>
          {label}
        </span>
      </div>
      {value === null ? (
        <div className="relative mt-2.5 h-7 w-28 animate-pulse bg-[#eef1f5]" />
      ) : (
        <div className="relative mt-2 truncate font-['Outfit'] text-[26px] font-bold leading-none tabular-nums text-[#0d1117]" title={value}>
          {value}
        </div>
      )}
      {hint && (
        <div className="relative mt-1.5 truncate text-[11px] text-[#6b7280]" title={hint}>
          {hint}
        </div>
      )}
      {typeof share === "number" && Number.isFinite(share) && (
        <div className="relative mt-2 h-1 w-full bg-[#eef1f5]">
          <div className="h-full" style={{ width: `${Math.min(100, Math.max(0, share))}%`, background: color }} />
        </div>
      )}
    </div>
  )
}

export const GROUPS = [
  { value: "1", label: "Sales" },
  { value: "", label: "All transactions" },
  { value: "2", label: "Mortgages" },
  { value: "3", label: "Gifts" },
]

export function jobFor(range: { from: string; to: string }, group: string): BatchJob {
  const dataset = DLD_DATASETS.transactions
  const values = Object.fromEntries(
    dataset.filters.map((f) => [f.param, f.kind === "date" ? (f.param === "P_TO_DATE" ? range.to : range.from) : resolveDefault(f)]),
  )
  values.P_GROUP_ID = group
  return { command: "transactions", values }
}

type MergedBucket = DldChartBucket & { matched: number; guessed: number }
export type ProjectRow = DldChartBucket & { guessed: boolean }
const tagOf = (p: ProjectRow) => (p.guessed ? "(by name)" : "(matched)")



/** Company-form abbreviations DLD writes in caps that would read wrong title-cased. */
const KEEP_UPPER = new Set(["LLC", "L.L.C", "L.L.C.", "FZE", "FZCO", "FZ-LLC", "PJSC", "PSC", "LLP", "DMCC", "JLT", "SPV", "UAE", "AED", "(AED)", "DLD"])

/**
 * "IMTIAZ JA REAL ESTATE DEVELOPMENT L.L.C" → "Imtiaz Ja Real Estate Development L.L.C".
 * Display only — DLD and the catalogue write names in every case imaginable;
 * one case on the page also lets two spellings of the same developer merge.
 */
export function titleCase(label: string): string {
  return label
    .split(/\s+/)
    .map((w) => {
      if (KEEP_UPPER.has(w.toUpperCase())) return w.toUpperCase()
      // Hyphenated / parenthesised parts each get a capital: "al-furjan" → "Al-Furjan", "(by" → "(By".
      return w.replace(/(^|[-(/])([a-z\u00e0-\u00ff])/gi, (_m, pre: string, ch: string) => pre + ch.toUpperCase()).replace(/(?<=[A-Za-z\u00c0-\u00ff])[A-Z\u00c0-\u00dd]+(?=[A-Z\u00c0-\u00dd]*(?:[-(/\s]|$))/g, (m) => m.toLowerCase())
    })
    .join(" ")
}
export const relabel = (b: DldChartBucket): DldChartBucket => ({ ...b, label: titleCase(b.label) })

/** "738 matched · 332 guessed" for a merged developer bar; nothing for the Unmatched/Unknown bars. */
function splitNote(b: DldChartBucket): string | null {
  const m = b as MergedBucket
  if (!m.matched && !m.guessed) return null
  return `${int.format(m.matched)} matched · ${int.format(m.guessed)} guessed`
}

/** "17% of rows" for the tiles; undefined until there is a total. */
export const pctOf = (n: number, total: number) => (total > 0 ? `${((n / total) * 100).toFixed(0)}% of rows` : undefined)

const SOURCE_LABEL: Record<string, string> = {
  dld: "DLD register",
  fhi: "FHI catalogue",
  name: "guessed by name",
  unmatched: "project not on record",
  unknown: "no project on the row",
}

export function DevelopersBreakdownSection() {
  const [range, setRange] = useState(last30Days)
  const [group, setGroup] = useState("1")
  // Every ranking is shown twice — by row count and by AED — so there is no
  // toggle to flip between them.
  const byCount = (a: DldChartBucket, b: DldChartBucket) => b.count - a.count || a.label.localeCompare(b.label)
  const byValue = (a: DldChartBucket, b: DldChartBucket) => b.value - a.value || a.label.localeCompare(b.label)
  const sorter = (m: "count" | "value") => (m === "value" ? byValue : byCount)
  // Plain-language names for the two measures, used in every title.
  const measureTitle = (m: "count" | "value") => (m === "value" ? `by ${groupLabel} value (AED)` : `by number of ${groupLabel}`)
  const [submitted, setSubmitted] = useState<BatchJob>(() => jobFor(range, group))
  const job = useBatchJob(CACHE_KEY, submitted, true)
  const { acc, loading } = job

  const buckets = useMemo(() => (acc?.developers ? toBuckets(acc.developers) : []), [acc])
  const matched = useMemo(() => (acc?.developersMatched ? toBuckets(acc.developersMatched).map(relabel) : []), [acc])
  // The guessed card is already titled as guesses, so the "(by name)" suffix
  // the server puts on these labels is redundant there — strip it for display.
  const guessed = useMemo(
    () => (acc?.developersGuessed ? toBuckets(acc.developersGuessed).map((b) => relabel({ ...b, label: b.label.replace(/ \(by name\)$/, "") })) : []),
    [acc],
  )
  const unmatched = useMemo(() => (acc?.projectsUnmatched ? toBuckets(acc.projectsUnmatched).map(relabel) : []), [acc])
  // developer (display label) → its projects, each flagged guessed or not, for
  // the expandable rows of the three developer lists.
  const projectsByDeveloper = useMemo(() => {
    const out = new Map<string, ProjectRow[]>()
    if (!acc?.projects) return out
    const devs = acc.projectDevelopers ?? {}
    for (const b of toBuckets(acc.projects)) {
      const raw = devs[b.label]
      if (!raw) continue
      const guessedDev = raw.endsWith("(by name)")
      const dev = titleCase(raw.replace(/ \(by name\)$/, ""))
      const list = out.get(dev) ?? []
      list.push({ label: titleCase(b.label), count: b.count, value: b.value, guessed: guessedDev })
      out.set(dev, list)
    }
    return out
  }, [acc])
  const projectsFor = (developer: string, which: "all" | "matched" | "guessed", m: "count" | "value") =>
    (projectsByDeveloper.get(developer) ?? []).filter((p) => (which === "all" ? true : which === "guessed" ? p.guessed : !p.guessed)).sort(sorter(m))


  // Combined card: ONE bar per developer — its register matches and its
  // "(by name)" guesses added together, with the split kept for the tooltip
  // and the table. "Unmatched project" and "Unknown" have no developer, so
  // they are not bars; their counts go in the subtitle instead, so the chart
  // ranks developers only while still saying how much of the month it covers.
  const merged = useMemo<MergedBucket[]>(() => {
    const byDev = new Map<string, MergedBucket>()
    const add = (label: string, b: DldChartBucket, kind: "matched" | "guessed") => {
      const cur = byDev.get(label) ?? { label, count: 0, value: 0, matched: 0, guessed: 0 }
      cur.count += b.count
      cur.value += b.value
      cur[kind] += b.count
      byDev.set(label, cur)
    }
    for (const b of matched) add(b.label, b, "matched")
    for (const b of guessed) add(b.label, b, "guessed")
    return [...byDev.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }, [matched, guessed])
  const sources = acc?.developerSources ?? null
  const total = acc?.count ?? 0
  const known = sources ? (sources.dld ?? 0) + (sources.fhi ?? 0) : 0
  const guessedRows = sources?.name ?? 0
  const unmatchedRows = sources?.unmatched ?? 0
  const unknownRows = sources?.unknown ?? 0
  const attributedRows = total - unmatchedRows - unknownRows
  // AED behind each group, from the buckets (every bucket carries its value sum).
  const sumValue = (bs: DldChartBucket[]) => bs.reduce((s, b) => s + b.value, 0)
  const matchedValue = sumValue(matched)
  const guessedValue = sumValue(guessed)
  const unmatchedValue = sumValue(unmatched)
  const totalValue = acc?.value ?? 0
  const unknownValue = Math.max(0, totalValue - matchedValue - guessedValue - unmatchedValue)
  const aed = (v: number) => `AED ${compact.format(v)}`
  // Daily series across the range (oldest first) — the tiles' background charts.
  const dailyCounts = useMemo(() => (acc ? Object.entries(acc.daily).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v.count) : []), [acc])
  const dailyValues = useMemo(() => (acc ? Object.entries(acc.daily).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v.value) : []), [acc])
  // Transactions by weekday, Monday first — the radar's seven spokes.
  const weekdayCounts = useMemo(() => {
    const out = [0, 0, 0, 0, 0, 0, 0]
    for (const [day, v] of Object.entries(acc?.daily ?? {})) out[(new Date(`${day}T00:00:00`).getDay() + 6) % 7] += v.count
    return out
  }, [acc])
  const groupLabel = GROUPS.find((g) => g.value === group)?.label.toLowerCase() ?? "rows"
  const rangeText = `${longDate(submitted.values.P_FROM_DATE ?? "")} – ${longDate(submitted.values.P_TO_DATE ?? "")}`

  const sourceBuckets: DldChartBucket[] = sources
    ? (["dld", "fhi", "name", "unmatched", "unknown"] as const).filter((k) => (sources[k] ?? 0) > 0).map((k) => ({ label: SOURCE_LABEL[k], count: sources[k] ?? 0, value: 0 }))
    : []

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!range.from || !range.to) return
    const next = jobFor(range, group)
    if (JSON.stringify(next) === JSON.stringify(submitted)) job.refresh()
    else setSubmitted(next)
  }

  return (
    <section className="fhi-no-radius">

      <form onSubmit={submit} className="bg-white rounded-2xl border border-[#e8eaed] p-5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-[200px] sm:shrink-0">
            <label className="block text-sm font-medium text-[#0d1117] mb-1.5">Transaction type</label>
            <FilterSelect value={group} onValueChange={setGroup} options={GROUPS} ariaLabel="Transaction type" className="w-full max-w-none h-10 rounded-xl py-0" />
          </div>
          {(["from", "to"] as const).map((k) => (
            <div key={k} className="w-full sm:w-[160px] sm:shrink-0">
              <label htmlFor={`dev-${k}`} className="block text-sm font-medium text-[#0d1117] mb-1.5">
                {k === "from" ? "From Date" : "To Date"} <span className="text-rose-600">*</span>
              </label>
              <input
                id={`dev-${k}`}
                type="date"
                value={range[k]}
                onChange={(e) => setRange((r) => ({ ...r, [k]: e.target.value }))}
                required
                className="h-10 w-full rounded-xl border border-[#e5e7eb] bg-white px-3 text-sm text-[#0f2940] focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5"
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={loading || !range.from || !range.to}
            className="inline-flex shrink-0 items-center gap-2 h-10 whitespace-nowrap px-5 rounded-xl bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#0a2e57] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Load
          </button>
          {loading ? (
            <button type="button" onClick={job.stop} className="h-10 shrink-0 whitespace-nowrap px-4 rounded-xl border border-[#e5e7eb] bg-white text-sm font-semibold text-[#374151] hover:border-[#001f3f]/30">
              Stop
            </button>
          ) : (
            <RefreshButton onClick={job.refresh} loading={loading} updatedAt={null} />
          )}
        </div>
      </form>

      {job.error && (
        <div className="mb-4">
          <ErrorBox message={job.error} onRetry={job.resume} />
        </div>
      )}

      <div className="space-y-4">
        <CoverageLine acc={acc} loading={loading} stopped={job.stopped} error={job.error} label={groupLabel} onResume={job.resume}>
          {acc && total > 0 && sources && (
            <span>
              · developer known for {int.format(known)} ({((known / total) * 100).toFixed(0)}%) · {int.format(buckets.length)} developer labels · value AED{" "}
              {compact.format(acc.value)}
            </span>
          )}
        </CoverageLine>

        {/* Totals at a glance — how the rows loaded so far split by how (or whether) a developer was found. */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <StatTile color={TILE.navy} label="Transactions" value={acc ? int.format(total) : null} hint={acc ? `${groupLabel}, ${rangeText}` : undefined} chart={{ kind: "combo", values: dailyCounts }} />
          <StatTile
            color={TILE.gold}
            label="Total Value"
            value={acc ? aed(totalValue) : null}
            hint={acc && total > 0 ? `${int.format(Math.round(totalValue / total))} AED per transaction` : undefined}
            chart={{ kind: "bars", values: dailyValues }}
          />
          <StatTile color={TILE.green} label="Confirmed" value={acc ? int.format(known) : null} hint={acc ? `${pctOf(known, total)} · ${aed(matchedValue)}` : undefined} share={total ? (known / total) * 100 : null} chart={{ kind: "ring", share: total ? (known / total) * 100 : 0 }} />
          <StatTile color={TILE.amber} label="Guessed" value={acc ? int.format(guessedRows) : null} hint={acc ? `${pctOf(guessedRows, total)} · ${aed(guessedValue)}` : undefined} share={total ? (guessedRows / total) * 100 : null} chart={{ kind: "pie", share: total ? (guessedRows / total) * 100 : 0 }} />
          <StatTile
            color={TILE.slate}
            label="No Developer"
            value={acc ? int.format(unmatchedRows + unknownRows) : null}
            hint={acc && total > 0 ? `${pctOf(unmatchedRows + unknownRows, total)} · ${aed(unmatchedValue + unknownValue)}` : undefined}
            share={total ? ((unmatchedRows + unknownRows) / total) * 100 : null}
            chart={{ kind: "polar", values: weekdayCounts }}
          />
        </div>

        {/* 1. Combined — every source together, one developer per bar; by count on the left, by AED on the right. */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {MEASURES.map((m) => (
            <ChartCard
              key={m}
              title={titleCase(`Top ${DLD_CHART_TOP_N} developers ${measureTitle(m)}`)}
              subtitle={`Confirmed + guessed, ${rangeText}. Open a developer for the split and its projects.${
                sources && total > 0 ? ` Covers ${((attributedRows / total) * 100).toFixed(0)}% of ${groupLabel}.` : ""
              }`}
              table={{
                head: ["Developer", "Rows", "Matched", "Guessed", "AED"],
                rows: [...merged].sort(sorter(m)).map((b) => [b.label, b.count, b.matched, b.guessed, int.format(b.value)]),
              }}
            >
              {!acc ? (
                <Skeleton h={300} />
              ) : (
                <DeveloperRankList rows={[...merged].sort(sorter(m)).slice(0, DLD_CHART_TOP_N)} measure={m} note={splitNote} projectsFor={(d) => projectsFor(d, "all", m)} totalOf={{ count: total, value: totalValue }} />
              )}
            </ChartCard>
          ))}
        </div>


        {/* Full width, on its own row — one share bar per source. */}
        <ChartCard
          title="Where Each Developer Name Came From"
          subtitle="Share of all transactions by how the developer was identified."
          table={{ head: ["Source", "Rows", ""], rows: sourceBuckets.map((b) => [b.label, b.count, ""]) }}
        >
          {!acc ? <Skeleton h={160} /> : <ShareBars buckets={sourceBuckets} total={total} />}
        </ChartCard>

        {/* 2. Register matches only — the developer comes from the project. */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {MEASURES.map((m) => (
            <ChartCard
              key={m}
              title={titleCase(`Confirmed developers ${measureTitle(m)}`)}
              subtitle={`Project found in DLD's register or our catalogue.${sources ? ` ${total ? ((known / total) * 100).toFixed(0) : 0}% of ${groupLabel}.` : ""}`}
              table={{ head: ["Developer", "Rows", "AED"], rows: [...matched].sort(sorter(m)).map((b) => [b.label, b.count, int.format(b.value)]) }}
            >
              {!acc ? <Skeleton h={300} /> : <DeveloperRankList rows={[...matched].sort(sorter(m)).slice(0, DLD_CHART_TOP_N)} measure={m} projectsFor={(d) => projectsFor(d, "matched", m)} totalOf={{ count: total, value: totalValue }} />}
            </ChartCard>
          ))}
        </div>

        {/* 3. Name guesses only — clearly labelled as such. */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {MEASURES.map((m) => (
            <ChartCard
              key={m}
              title={titleCase(`Guessed developers ${measureTitle(m)}`)}
              subtitle={`Developer read from the project name, e.g. “Arian by Azizi”. An estimate.${sources ? ` ${total ? ((guessedRows / total) * 100).toFixed(0) : 0}% of ${groupLabel}.` : ""}`}
              table={{ head: ["Developer (guess)", "Rows", "AED"], rows: [...guessed].sort(sorter(m)).map((b) => [b.label, b.count, int.format(b.value)]) }}
            >
              {!acc ? <Skeleton h={300} /> : <DeveloperRankList rows={[...guessed].sort(sorter(m)).slice(0, DLD_CHART_TOP_N)} measure={m} projectsFor={(d) => projectsFor(d, "guessed", m)} totalOf={{ count: total, value: totalValue }} />}
            </ChartCard>
          ))}
        </div>

      </div>
    </section>
  )
}

// ─── Expandable developer ranking ────────────────────────────────────────────
//
// Same reading as RankChart (one line per developer: name, a bar, the number)
// but as a list, so a row can open: the chevron reveals the developer's
// projects underneath, each with its own share of the developer's total.
// The name column is as wide as the longest name needs, capped at half the
// card (names past that truncate on one line), and the bars share one scale.

export const LIST_FONT = "12px Inter, ui-sans-serif, system-ui, sans-serif"
let listMeasure: CanvasRenderingContext2D | null | undefined
export function textPx(text: string): number {
  const ctx = listMeasure ?? (listMeasure = document.createElement("canvas").getContext("2d"))
  if (!ctx) return text.length * 6.5
  ctx.font = LIST_FONT
  return ctx.measureText(text).width
}

export function useWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      setWidth((prev) => (Math.abs(prev - w) < 1 ? prev : w))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return width
}

export function DeveloperRankList({
  rows,
  measure,
  note,
  projectsFor,
  totalOf,
  showTags = true,
}: {
  rows: DldChartBucket[]
  measure: "count" | "value"
  /** Extra text after the number (e.g. the matched/guessed split). */
  note?: (b: DldChartBucket) => string | null
  projectsFor: (developer: string) => ProjectRow[]
  /** What each row's percentage is of — the whole range's row count and AED. */
  totalOf: { count: number; value: number }
  /** Show the "(matched)" / "(by name)" tag on each opened project (off for lists where it doesn't apply, e.g. areas). */
  showTags?: boolean
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const width = useWidth(hostRef)
  const [open, setOpen] = useState<string | null>(null)
  if (rows.length === 0) return <div className="flex items-center justify-center text-sm text-[#9ca3af]" style={{ height: 200 }}>No rows for these filters.</div>

  const chevronPx = 22
  const cap = width > 0 ? Math.floor(width * 0.5) : 220
  const longest = Math.ceil(Math.max(0, ...rows.map((r) => textPx(r.label))))
  const labelW = Math.min(cap, longest + chevronPx + 12)
  const max = Math.max(1, ...rows.map((r) => r[measure]))
  const fmt = (v: number) => (measure === "value" ? `AED ${compact.format(v)}` : int.format(v))
  const pctOfTotal = (v: number) => (totalOf[measure] > 0 ? `${((v / totalOf[measure]) * 100).toFixed(1)}%` : "—")
  const numText = (r: DldChartBucket) => `${fmt(r[measure])} · ${pctOfTotal(r[measure])}`
  // One width for the number column — the longest "1,070 · 9.8%" — so every
  // bar track spans exactly the same range and their ends line up.
  const shownTotal = rows.reduce((sum, r) => sum + r[measure], 0)
  const numW = Math.ceil(Math.max(0, ...rows.map((r) => textPx(numText(r))), textPx(`${fmt(shownTotal)} · ${pctOfTotal(shownTotal)}`))) + 4
  const color = measure === "value" ? "#1baf7a" : "#2a78d6"

  return (
    <div ref={hostRef} className="w-full">
      <ul className="divide-y divide-[#f0f2f5]">
        {rows.map((r) => {
          const isOpen = open === r.label
          const projects = isOpen ? projectsFor(r.label) : []
          const extra = note?.(r)
          // The opened list follows the same rule as the rows: name column as
          // wide as the longest "Project (tag)" needs, capped at half the card.
          const innerCap = Math.max(80, cap - 12)
          const innerLongest = Math.ceil(Math.max(0, ...projects.map((pr) => textPx(showTags ? `${pr.label} ${tagOf(pr)}` : pr.label))))
          const innerLabelW = Math.min(innerCap, innerLongest + 8)
          const innerNumW = Math.ceil(Math.max(0, ...projects.map((pr) => textPx(`${fmt(pr[measure])} · ${(r[measure] > 0 ? (pr[measure] / r[measure]) * 100 : 0).toFixed(0)}%`)))) + 4
          return (
            <li key={r.label}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : r.label)}
                aria-expanded={isOpen}
                title={`${r.label} · ${int.format(r.count)} rows · AED ${compact.format(r.value)}${extra ? ` · ${extra}` : ""}`}
                className="group grid w-full items-center gap-3 py-2 text-left hover:bg-[#f8fafc] rounded-lg -mx-1 px-1"
                style={{ gridTemplateColumns: `${labelW}px minmax(0,1fr) ${numW}px` }}
              >
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-[#374151]">
                  <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-[#9ca3af] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  <span className="truncate">{r.label}</span>
                </span>
                <span className="h-[14px] bg-[#eef1f5] overflow-hidden">
                  <span className="block h-full" style={{ width: `${Math.max(1, (r[measure] / max) * 100)}%`, background: color }} />
                </span>
                <span className="text-xs tabular-nums text-[#374151] whitespace-nowrap text-right">
                  {fmt(r[measure])} <span className="text-[#9ca3af]">· {pctOfTotal(r[measure])}</span>
                </span>
              </button>

              {isOpen && (
                <div
                  // Full row width — both edges line up with the rows above — with equal padding inside.
                  className="mb-2 rounded-xl border border-[#eef1f5] bg-[#fafbfc] px-3 py-2"
                >
                  {(extra || projects.length > 10) && (
                    <p className="mb-1 text-[11px] text-[#9ca3af]">
                      {extra}
                      {extra && projects.length > 10 && " · "}
                      {projects.length > 10 && `${int.format(projects.length)} projects — scroll for the rest`}
                    </p>
                  )}
                  {projects.length === 0 ? (
                    <p className="py-1 text-xs text-[#9ca3af]">No project names on these rows.</p>
                  ) : (
                    // Roughly 10 rows tall; longer lists scroll inside the panel.
                    <ul className="space-y-1 overflow-y-auto pr-1" style={{ maxHeight: 10 * 22 }}>
                      {projects.map((pr) => {
                        const share = r[measure] > 0 ? (pr[measure] / r[measure]) * 100 : 0
                        return (
                          <li key={pr.label} className="grid items-center gap-3 text-[11px]" style={{ gridTemplateColumns: `${innerLabelW}px minmax(0,1fr) ${innerNumW}px` }}>
                            <span className="truncate text-[#374151]" title={showTags ? `${pr.label} ${tagOf(pr)}` : pr.label}>
                              {pr.label}
                              {showTags && <span className={pr.guessed ? "text-amber-700" : "text-[#9ca3af]"}> {tagOf(pr)}</span>}
                            </span>
                            <span className="h-[8px] bg-white border border-[#eef1f5] overflow-hidden">
                              <span className="block h-full opacity-70" style={{ width: `${Math.max(1, share)}%`, background: color }} />
                            </span>
                            <span className="tabular-nums text-[#6b7280] whitespace-nowrap text-right">
                              {fmt(pr[measure])} <span className="text-[#9ca3af]">· {share.toFixed(0)}%</span>
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {/* Total of the rows shown, in the same columns as the rows. */}
      <div className="mt-1 grid items-center gap-3 border-t border-[#e5e7eb] pt-2 -mx-1 px-1" style={{ gridTemplateColumns: `${labelW}px minmax(0,1fr) ${numW}px` }}>
        <span className="text-xs font-semibold text-[#0d1117]">Total of top {rows.length}</span>
        <span />
        <span className="text-xs font-semibold tabular-nums text-[#0d1117] whitespace-nowrap text-right">
          {fmt(shownTotal)} <span className="font-normal text-[#9ca3af]">· {pctOfTotal(shownTotal)}</span>
        </span>
      </div>
    </div>
  )
}
