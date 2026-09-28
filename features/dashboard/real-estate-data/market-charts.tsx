"use client"

// Real Estate Data → Market Charts.
//
// Two sections, both fed by /api/admin/dld/charts:
//   1. Price Index — the DLD Property Price Index (20 series, 2020 →).
//   2. Breakdowns  — per-day volume, category splits and a top-10 ranking
//      for a dataset over a user-chosen date range (server-aggregated).
//
// Chart rules followed here: one axis per chart (never a dual axis — count
// and value are two charts), a single hue for a single measure, diverging
// blue/orange for above/below zero, thin marks with rounded ends, a hover
// tooltip everywhere, and a table view behind every chart for accessibility.

import { useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCw, Search, Table2, BarChart3 } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { FilterSelect } from "@/components/ui/filter-select"
import { agoLabel, cacheGet, cacheSet } from "./client-cache"
import {
  DLD_CHART_BATCH_CHUNKS,
  DLD_CHART_FIRST_BATCH_CHUNKS,
  DLD_CHART_SPECS,
  DLD_CHART_TOP_N,
  DLD_DATASETS,
  isoToDldDate,
  missingRequired,
  resolveDefault,
  type DldBreakdownResponse,
  type DldChartBucket,
  type DldChartSpec,
  type DldCommand,
  type DldDataset,
  type DldPriceIndexResponse,
  type DldPriceIndexSeries,
} from "@/lib/dld-open-data"

// Validated categorical slots (dataviz reference palette, light mode).
const C = {
  blue: "#2a78d6",
  orange: "#eb6834",
  aqua: "#1baf7a",
  grid: "#f0f2f5",
  axis: "#e5e7eb",
  tick: "#6b7280",
} as const

const INPUT_CLS =
  "h-10 w-full rounded-xl border border-[#e5e7eb] bg-white px-3.5 text-sm text-[#0f2940] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5"

const int = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat("en-AE", { notation: "compact", maximumFractionDigits: 1 })
const pct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`
const shortDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
}
const longDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

const TOOLTIP_STYLE = { borderRadius: 12, border: "1px solid #e8eaed", fontSize: 12, boxShadow: "0 8px 24px -12px rgba(0,20,40,.25)" }

export function MarketCharts() {
  return (
    <div className="space-y-8">
      <PriceIndexSection />
      <BreakdownSection />
    </div>
  )
}

// ─── Shared card ─────────────────────────────────────────────────────────────

function ChartCard({
  title,
  subtitle,
  table,
  children,
}: {
  title: string
  subtitle?: string
  /** Rows for the table view toggle. */
  table: { head: string[]; rows: Array<Array<string | number>> }
  children: React.ReactNode
}) {
  const [showTable, setShowTable] = useState(false)
  return (
    <div className="bg-white rounded-2xl border border-[#e8eaed] p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-[15px] font-semibold text-[#0d1117]">{title}</h3>
          {subtitle && <p className="text-xs text-[#6b7280] mt-0.5">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-pressed={showTable}
          title={showTable ? "Show chart" : "Show as table"}
          className="shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-[#e5e7eb] text-xs text-[#374151] hover:border-[#001f3f]/30"
        >
          {showTable ? <BarChart3 className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}
          {showTable ? "Chart" : "Table"}
        </button>
      </div>
      {showTable ? (
        <div className="overflow-auto max-h-[320px] rounded-xl border border-[#f0f2f5]">
          <table className="min-w-full text-xs">
            <thead className="bg-[#f8fafc] text-[11px] uppercase tracking-wide text-[#6b7280] sticky top-0">
              <tr>
                {table.head.map((h, i) => (
                  <th key={h} className={`px-3 py-2 font-semibold whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f5]">
              {table.rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} className={`px-3 py-1.5 whitespace-nowrap text-[#374151] ${ci === 0 ? "" : "text-right tabular-nums"}`}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </div>
  )
}

function Skeleton({ h = 240 }: { h?: number }) {
  return <div className="rounded-xl bg-[#eef1f5] animate-pulse" style={{ height: h }} />
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      <span>{message}</span>
      <button type="button" onClick={onRetry} className="shrink-0 font-semibold underline underline-offset-2">
        Retry
      </button>
    </div>
  )
}

/** "Refresh · updated 4 min ago" — re-pulls from DLD, ignoring every cache. */
export function RefreshButton({
  onClick,
  loading,
  updatedAt,
  className = "",
}: {
  onClick: () => void
  loading: boolean
  updatedAt: number | null
  className?: string
}) {
  // Re-render the "ago" label once a minute without touching anything else.
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {updatedAt !== null && !loading && <span className="text-[11px] text-[#9ca3af]">updated {agoLabel(updatedAt)}</span>}
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        title="Pull fresh data from Dubai Land Department"
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-[#e5e7eb] bg-white text-xs font-semibold text-[#374151] hover:border-[#001f3f]/30 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        Refresh
      </button>
    </span>
  )
}

// ─── 1. Price index ──────────────────────────────────────────────────────────

const PRICE_INDEX_CACHE_KEY = "charts:price-index"

type PriceIndexState = { attempt: number; res: DldPriceIndexResponse | null; error: string | null; at: number }

function PriceIndexSection() {
  // attempt 0 = "use the cache if fresh"; each Refresh bumps it and bypasses
  // both the client cache and the server's Postgres copy.
  const [attempt, setAttempt] = useState(0)
  const [data, setData] = useState<PriceIndexState | null>(() => {
    const hit = cacheGet<DldPriceIndexResponse>(PRICE_INDEX_CACHE_KEY)
    return hit ? { attempt: 0, res: hit.data, error: null, at: hit.at } : null
  })
  const [categoryCode, setCategoryCode] = useState("")
  const [subCode, setSubCode] = useState("")
  const [period, setPeriod] = useState<"Quarterly" | "Annual">("Quarterly")

  const haveCached = data?.attempt === attempt && !!data.res
  useEffect(() => {
    if (haveCached) return
    let cancelled = false
    void (async () => {
      let next: { res: DldPriceIndexResponse | null; error: string | null }
      try {
        const r = await fetch("/api/admin/dld/charts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "price-index", refresh: attempt > 0 }),
        })
        const json = (await r.json()) as DldPriceIndexResponse & { error?: string }
        next = r.ok ? { res: json, error: null } : { res: null, error: json.error || "Request failed." }
      } catch {
        next = { res: null, error: "Could not load the price index." }
      }
      if (cancelled) return
      const at = next.res ? cacheSet(PRICE_INDEX_CACHE_KEY, next.res).at : Date.now()
      setData({ attempt, ...next, at })
    })()
    return () => {
      cancelled = true
    }
  }, [attempt, haveCached])

  const loading = data?.attempt !== attempt
  const series = useMemo(() => data?.res?.series ?? [], [data])
  const updatedAt = data?.res ? data.at : null

  const categories = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of series) m.set(s.categoryCode, s.category)
    return [...m.entries()].map(([value, label]) => ({ value, label }))
  }, [series])
  const activeCategory = categoryCode || categories[0]?.value || ""

  const subCategories = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of series) if (s.categoryCode === activeCategory) m.set(s.subCategoryCode, s.subCategory)
    return [...m.entries()].map(([value, label]) => ({ value, label }))
  }, [series, activeCategory])
  const activeSub = subCategories.some((s) => s.value === subCode) ? subCode : subCategories[0]?.value || ""

  const current: DldPriceIndexSeries | undefined = series.find(
    (s) => s.categoryCode === activeCategory && s.subCategoryCode === activeSub && s.period === period,
  )
  const points = current?.points ?? []
  const changeKey = period === "Quarterly" ? "qoq" : "yoy"
  // Diverging bars as two series on one stack: positives in blue, negatives
  // in orange (Recharts 3 has retired per-bar <Cell> colouring).
  const changePoints = points.map((p) => {
    const v = p[changeKey]
    return { x: p.x, up: v !== null && v >= 0 ? v : null, down: v !== null && v < 0 ? v : null }
  })
  const changeLabel = period === "Quarterly" ? "Quarter-on-quarter change" : "Year-on-year change"
  const xLabel = (x: string) => (period === "Quarterly" ? x.replace(/^(\d{4})\.(\d)$/, "Q$2 $1") : x)
  const latest = points.length ? points[points.length - 1] : null

  return (
    <section>
      <div className="mb-4">
        <h2 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">Property Price Index</h2>
        <p className="text-sm text-[#6b7280]">
          DLD&rsquo;s official index by property category, base 2020. Pick a category and a sub-index.
        </p>
      </div>

      {data?.error && !loading && <ErrorBox message={data.error} onRetry={() => setAttempt((a) => a + 1)} />}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {categories.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => {
              setCategoryCode(c.value)
              setSubCode("")
            }}
            className={`h-9 px-4 rounded-xl text-sm font-semibold transition-colors ${
              c.value === activeCategory ? "bg-[#001f3f] text-white" : "bg-white border border-[#e5e7eb] text-[#374151] hover:border-[#001f3f]/30"
            }`}
          >
            {c.label}
          </button>
        ))}
        {subCategories.length > 0 && (
          <FilterSelect
            value={activeSub}
            onValueChange={setSubCode}
            options={subCategories}
            ariaLabel="Sub-index"
            className="h-9 py-0 rounded-xl"
          />
        )}
        <RefreshButton onClick={() => setAttempt((a) => a + 1)} loading={loading} updatedAt={updatedAt} className="ml-auto" />
        <div className="inline-flex p-0.5 rounded-xl bg-[#eef1f5] border border-[#e8eaed]">
          {(["Quarterly", "Annual"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`h-8 px-3 rounded-[10px] text-xs font-semibold ${period === p ? "bg-white text-[#001f3f] shadow-sm" : "text-[#6b7280]"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {latest && !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <Stat label={`Latest index · ${xLabel(latest.x)}`} value={latest.actual === null ? "—" : int.format(latest.actual)} />
          <Stat label="Year-on-year" value={latest.yoy === null ? "—" : pct(latest.yoy)} tone={latest.yoy === null ? undefined : latest.yoy >= 0 ? "up" : "down"} />
          <Stat
            label="Quarter-on-quarter"
            value={latest.qoq === null ? "—" : pct(latest.qoq)}
            tone={latest.qoq === null ? undefined : latest.qoq >= 0 ? "up" : "down"}
          />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard
          title={current ? `${current.category} · ${current.subCategory}` : "Index"}
          subtitle="Index value (2020 = 100)"
          table={{ head: ["Period", "Index"], rows: points.map((p) => [xLabel(p.x), p.actual ?? "—"]) }}
        >
          {loading ? (
            <Skeleton />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={points} margin={{ top: 12, right: 12, bottom: 0, left: -16 }}>
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="x" tickFormatter={xLabel} tick={{ fontSize: 11, fill: C.tick }} tickLine={false} axisLine={{ stroke: C.axis }} minTickGap={24} />
                <YAxis tick={{ fontSize: 11, fill: C.tick }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(x) => xLabel(String(x))} formatter={(v) => [int.format(Number(v)), "Index"]} />
                <Line type="monotone" dataKey="actual" stroke={C.blue} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title={changeLabel}
          subtitle="Percent, blue above zero and orange below"
          table={{ head: ["Period", "Change %"], rows: points.map((p) => [xLabel(p.x), p[changeKey] === null ? "—" : pct(p[changeKey] as number)]) }}
        >
          {loading ? (
            <Skeleton />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={changePoints} margin={{ top: 12, right: 12, bottom: 0, left: -16 }} barCategoryGap="25%">
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="x" tickFormatter={xLabel} tick={{ fontSize: 11, fill: C.tick }} tickLine={false} axisLine={{ stroke: C.axis }} minTickGap={24} />
                <YAxis tick={{ fontSize: 11, fill: C.tick }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                <ReferenceLine y={0} stroke={C.axis} />
                <Tooltip
                  cursor={{ fill: "rgba(0,31,63,0.04)" }}
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(x) => xLabel(String(x))}
                  formatter={(v) => (v === null || v === undefined ? [] : [pct(Number(v)), changeLabel])}
                />
                <Bar dataKey="up" stackId="c" fill={C.blue} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="down" stackId="c" fill={C.orange} radius={[0, 0, 4, 4]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </section>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="bg-white rounded-2xl border border-[#e8eaed] px-5 py-4">
      <div className="text-xs text-[#6b7280]">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${tone === "up" ? "text-[#1d5fb0]" : tone === "down" ? "text-[#c2491d]" : "text-[#0d1117]"}`}>
        {value}
      </div>
    </div>
  )
}

// ─── 2. Dataset breakdowns ───────────────────────────────────────────────────

const CHARTABLE = (Object.keys(DLD_CHART_SPECS) as DldCommand[]).map((c) => ({ value: c, label: DLD_DATASETS[c].label }))

type Tally = Record<string, { count: number; value: number }>

/** Accumulated aggregates across the batches loaded so far (JSON-serializable, it's cached). */
type Accum = {
  command: DldCommand
  daily: Tally
  breakdowns: Record<string, Tally>
  top: Tally
  count: number
  value: number
  available: number
  chunkTo: number
  done: boolean
  from: string | null
  to: string | null
  cacheHits: number
}

function mergeBatch(acc: Accum | null, res: DldBreakdownResponse): Accum {
  const next: Accum = acc ?? {
    command: res.command,
    daily: {},
    breakdowns: {},
    top: {},
    count: 0,
    value: 0,
    available: res.coverage.available,
    chunkTo: 0,
    done: false,
    from: null,
    to: null,
    cacheHits: 0,
  }
  const add = (m: Tally, label: string, b: { count: number; value: number }) => {
    const cur = m[label] ?? { count: 0, value: 0 }
    m[label] = { count: cur.count + b.count, value: cur.value + b.value }
  }
  for (const d of res.daily) add(next.daily, d.date, d)
  for (const [k, buckets] of Object.entries(res.breakdowns)) {
    next.breakdowns[k] ??= {}
    for (const b of buckets) add(next.breakdowns[k], b.label, b)
  }
  for (const b of res.top) add(next.top, b.label, b)
  next.count += res.totals.count
  next.value += res.totals.value
  next.available = res.coverage.available
  next.chunkTo = res.coverage.chunkTo
  next.done = res.coverage.done
  next.cacheHits += res.coverage.cacheHits
  if (res.coverage.from && (!next.from || res.coverage.from < next.from)) next.from = res.coverage.from
  if (res.coverage.to && (!next.to || res.coverage.to > next.to)) next.to = res.coverage.to
  return next
}

const toBuckets = (m: Tally): DldChartBucket[] =>
  Object.entries(m).map(([label, v]) => ({ label, count: v.count, value: v.value })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

/** What the page remembers between visits: the last job and what it loaded. */
type BreakdownMemo = { command: DldCommand; values: Record<string, string>; acc: Accum | null }
const BREAKDOWN_CACHE_KEY = "charts:breakdown:last"

function BreakdownSection() {
  // Restore the last visit's job + charts (30-minute client cache) so coming
  // back to the page shows them instantly, with no API call.
  const [memo] = useState(() => cacheGet<BreakdownMemo>(BREAKDOWN_CACHE_KEY))
  const [command, setCommand] = useState<DldCommand>(memo?.data.command ?? CHARTABLE[0].value)
  const dataset = DLD_DATASETS[command]

  // Only the date fields are exposed here — the table tab has the full form.
  const dateFields = dataset.filters.filter((f) => f.kind === "date")
  const [values, setValues] = useState<Record<string, string>>(
    () => memo?.data.values ?? Object.fromEntries(dataset.filters.map((f) => [f.param, resolveDefault(f)])),
  )

  // One "job" per Load: batches are fetched in sequence and merged into
  // `acc`; `running` gates the loop, Stop flips it off and keeps what loaded.
  // `refresh` makes every batch of that job re-pull from DLD.
  const [job, setJob] = useState<{ id: number; command: DldCommand; values: Record<string, string>; refresh: boolean } | null>(() =>
    memo?.data.acc ? { id: 0, command: memo.data.command, values: memo.data.values, refresh: false } : null,
  )
  const [acc, setAcc] = useState<Accum | null>(memo?.data.acc ?? null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(memo?.data.acc ? memo.at : null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const switchDataset = (next: DldCommand) => {
    setCommand(next)
    setValues(Object.fromEntries(DLD_DATASETS[next].filters.map((f) => [f.param, resolveDefault(f)])))
  }

  const missing = missingRequired(dataset, values)

  const start = (refresh = false) => {
    if (missing.length) return
    setAcc(null)
    setUpdatedAt(null)
    setError(null)
    setJob({ id: Date.now(), command, values, refresh })
    setRunning(true)
  }
  // Refresh re-runs the job that is on screen, not whatever the form says now.
  const refreshJob = () => {
    if (!job) return
    setAcc(null)
    setUpdatedAt(null)
    setError(null)
    setJob({ id: Date.now(), command: job.command, values: job.values, refresh: true })
    setRunning(true)
  }
  const resume = () => {
    setError(null)
    setRunning(true)
  }

  // Batch loop: each pass fetches the next batch for the active job, merges,
  // and (via the `acc` dependency) schedules the following one until done.
  const chunkFrom = acc?.chunkTo ?? 0
  const finished = acc?.done ?? false
  useEffect(() => {
    if (!job || !running || finished) return
    let cancelled = false
    void (async () => {
      const ds = DLD_DATASETS[job.command]
      const body: Record<string, string> = {
        kind: "breakdown",
        command: job.command,
        chunkFrom: String(chunkFrom),
        // Small first batch → first paint in seconds; full batches after that.
        chunkCount: String(chunkFrom === 0 ? DLD_CHART_FIRST_BATCH_CHUNKS : DLD_CHART_BATCH_CHUNKS),
        refresh: job.refresh ? "1" : "",
      }
      for (const f of ds.filters) body[f.param] = f.kind === "date" ? isoToDldDate(job.values[f.param] ?? "") : (job.values[f.param] ?? "")
      try {
        const r = await fetch("/api/admin/dld/charts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        const json = (await r.json()) as DldBreakdownResponse & { error?: string }
        if (cancelled) return
        if (!r.ok) {
          setError(json.error || "Request failed.")
          setRunning(false)
          return
        }
        setAcc((prev) => {
          const merged = mergeBatch(prev, json)
          // Remember progress after every batch: a Stop, a tab switch or a
          // reload all come back to exactly this state.
          const entry = cacheSet<BreakdownMemo>(BREAKDOWN_CACHE_KEY, { command: job.command, values: job.values, acc: merged })
          setUpdatedAt(entry.at)
          return merged
        })
      } catch {
        if (cancelled) return
        setError("Could not load chart data.")
        setRunning(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // job.id + chunkFrom identify the batch; the rest is read from `job`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, chunkFrom, running, finished])

  const loading = running && !finished
  const appliedDataset: DldDataset = job ? DLD_DATASETS[job.command] : dataset
  const appliedSpec = (job ? DLD_CHART_SPECS[job.command] : DLD_CHART_SPECS[command]) as DldChartSpec
  const colLabel = (key: string) => appliedDataset.columns.find((c) => c.key === key)?.label ?? key

  const daily = useMemo(
    () => (acc ? Object.entries(acc.daily).map(([date, v]) => ({ date, count: v.count, value: v.value })).sort((a, b) => a.date.localeCompare(b.date)) : []),
    [acc],
  )
  const top = useMemo(() => (acc ? toBuckets(acc.top).slice(0, DLD_CHART_TOP_N) : []), [acc])
  const breakdownBuckets = useMemo(
    () => (acc ? Object.fromEntries(Object.entries(acc.breakdowns).map(([k, m]) => [k, toBuckets(m)])) : {}),
    [acc],
  )
  const progress = acc && acc.available > 0 ? Math.min(100, (acc.count / acc.available) * 100) : 0

  return (
    <section>
      <div className="mb-4">
        <h2 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">Breakdowns</h2>
        <p className="text-sm text-[#6b7280]">Daily volume, category splits and a top-10 ranking for a date range. Built from the same rows as the tables.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          start(false)
        }}
        className="bg-white rounded-2xl border border-[#e8eaed] p-5 mb-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#0d1117] mb-1.5">Dataset</label>
            <FilterSelect value={command} onValueChange={(v) => switchDataset(v as DldCommand)} options={CHARTABLE} ariaLabel="Dataset" className="w-full max-w-none h-10 rounded-xl py-0" />
          </div>
          {dateFields.map((f) => (
            <div key={f.param}>
              <label htmlFor={`chart-${f.param}`} className="block text-sm font-medium text-[#0d1117] mb-1.5">
                {f.label}
                {f.required && <span className="text-rose-600"> *</span>}
              </label>
              <input
                id={`chart-${f.param}`}
                type="date"
                value={values[f.param] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.param]: e.target.value }))}
                className={INPUT_CLS}
                required={f.required}
              />
            </div>
          ))}
          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={loading || missing.length > 0}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#0a2e57] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Load charts
            </button>
            {loading ? (
              <button type="button" onClick={() => setRunning(false)} className="h-10 px-4 rounded-xl border border-[#e5e7eb] bg-white text-sm font-semibold text-[#374151] hover:border-[#001f3f]/30">
                Stop
              </button>
            ) : (
              job && <RefreshButton onClick={refreshJob} loading={loading} updatedAt={updatedAt} />
            )}
          </div>
        </div>
        {missing.length > 0 && <p className="mt-3 text-xs text-[#6b7280]">Pick {missing.map((f) => f.label.toLowerCase()).join(" and ")} to load.</p>}
      </form>

      {error && <ErrorBox message={error} onRetry={resume} />}

      {!job && (
        <div className="rounded-2xl border border-dashed border-[#d9dde3] bg-[#fafbfc] px-6 py-12 text-center text-sm text-[#6b7280]">
          Choose a dataset and date range, then press <span className="font-semibold text-[#0d1117]">Load charts</span>.
        </div>
      )}

      {job && (
        <div className="space-y-4">
          {/* Progress / coverage line */}
          <div className="bg-white rounded-2xl border border-[#e8eaed] px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#6b7280]">
              {acc ? (
                <>
                  <span>
                    <span className="font-semibold text-[#0d1117]">{int.format(acc.count)}</span> of {int.format(acc.available)} {appliedDataset.label.toLowerCase()} rows
                    {acc.from && acc.to && (
                      <>
                        {" "}
                        · {longDate(acc.from)} – {longDate(acc.to)}
                      </>
                    )}
                    {appliedSpec.valueKey && (
                      <>
                        {" "}
                        · {appliedSpec.valueLabel?.replace(" (AED)", "")} total AED {compact.format(acc.value)}
                      </>
                    )}
                  </span>
                  {loading && (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" /> loading more…
                    </span>
                  )}
                  {!loading && !acc.done && !error && (
                    <span className="text-amber-700">
                      · stopped — charts cover the rows above.{" "}
                      <button type="button" onClick={resume} className="font-semibold underline underline-offset-2">
                        Continue
                      </button>
                    </span>
                  )}
                  {acc.done && <span className="text-[#1baf7a] font-semibold">· complete</span>}
                  {acc.cacheHits > 0 && <span className="text-[#9ca3af]">· {int.format(acc.cacheHits * 1000)} rows from cache</span>}
                </>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading the first rows…
                </span>
              )}
            </div>
            {acc && !acc.done && (
              <div className="mt-2 h-1.5 rounded-full bg-[#eef1f5] overflow-hidden" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(1, progress)}%`, background: C.blue }} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ChartCard title="Rows per day" subtitle={`Count of ${appliedDataset.label.toLowerCase()} by ${colLabel(appliedSpec.dateKey).toLowerCase()}`} table={{ head: ["Day", "Rows"], rows: daily.map((d) => [longDate(d.date), d.count]) }}>
              {!acc ? <Skeleton /> : <DailyChart data={daily} dataKey="count" color={C.blue} format={(v) => int.format(v)} label="Rows" />}
            </ChartCard>
            {appliedSpec.valueKey && (
              <ChartCard title={`${appliedSpec.valueLabel?.replace(" (AED)", "")} per day`} subtitle="Sum in AED" table={{ head: ["Day", "AED"], rows: daily.map((d) => [longDate(d.date), int.format(d.value)]) }}>
                {!acc ? <Skeleton /> : <DailyChart data={daily} dataKey="value" color={C.aqua} format={(v) => `AED ${compact.format(v)}`} label={appliedSpec.valueLabel ?? "Value"} />}
              </ChartCard>
            )}
            <ChartCard title={`Top ${DLD_CHART_TOP_N} by ${colLabel(appliedSpec.topKey).toLowerCase()}`} subtitle="Ranked by row count" table={{ head: [colLabel(appliedSpec.topKey), "Rows", "AED"], rows: top.map((b) => [b.label, b.count, int.format(b.value)]) }}>
              {!acc ? <Skeleton h={300} /> : <RankChart buckets={top} hasValue={!!appliedSpec.valueKey} />}
            </ChartCard>
            {appliedSpec.breakdowns.map((k) => (
              <ChartCard key={k} title={`By ${colLabel(k).toLowerCase()}`} subtitle="Share of rows" table={{ head: [colLabel(k), "Rows", "AED"], rows: (breakdownBuckets[k] ?? []).map((b) => [b.label, b.count, int.format(b.value)]) }}>
                {!acc ? <Skeleton h={220} /> : <ShareBars buckets={breakdownBuckets[k] ?? []} total={acc.count} />}
              </ChartCard>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function DailyChart({
  data,
  dataKey,
  color,
  format,
  label,
}: {
  data: DldBreakdownResponse["daily"]
  dataKey: "count" | "value"
  color: string
  format: (v: number) => string
  label: string
}) {
  if (data.length === 0) return <Empty />
  // A handful of days reads better as bars; a long run as a line.
  const asLine = data.length > 31
  return (
    <ResponsiveContainer width="100%" height={240}>
      {asLine ? (
        <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: C.tick }} tickLine={false} axisLine={{ stroke: C.axis }} minTickGap={28} />
          <YAxis tick={{ fontSize: 11, fill: C.tick }} tickLine={false} axisLine={false} tickFormatter={(v) => compact.format(Number(v))} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(d) => longDate(String(d))} formatter={(v) => [format(Number(v)), label]} />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} />
        </LineChart>
      ) : (
        <BarChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -8 }} barCategoryGap="25%">
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: C.tick }} tickLine={false} axisLine={{ stroke: C.axis }} minTickGap={16} />
          <YAxis tick={{ fontSize: 11, fill: C.tick }} tickLine={false} axisLine={false} tickFormatter={(v) => compact.format(Number(v))} />
          <Tooltip cursor={{ fill: "rgba(0,31,63,0.04)" }} contentStyle={TOOLTIP_STYLE} labelFormatter={(d) => longDate(String(d))} formatter={(v) => [format(Number(v)), label]} />
          <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      )}
    </ResponsiveContainer>
  )
}

function RankChart({ buckets, hasValue }: { buckets: DldChartBucket[]; hasValue: boolean }) {
  if (buckets.length === 0) return <Empty />
  const h = Math.max(200, buckets.length * 30)
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={buckets} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 8 }} barCategoryGap="30%">
        <CartesianGrid horizontal={false} stroke={C.grid} />
        <XAxis type="number" tick={{ fontSize: 11, fill: C.tick }} tickLine={false} axisLine={false} tickFormatter={(v) => compact.format(Number(v))} />
        <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 11, fill: "#374151" }} tickLine={false} axisLine={false} tickFormatter={(v) => (String(v).length > 22 ? `${String(v).slice(0, 21)}…` : String(v))} />
        <Tooltip
          cursor={{ fill: "rgba(0,31,63,0.04)" }}
          contentStyle={TOOLTIP_STYLE}
          formatter={(v, _n, item) => {
            const b = item.payload as DldChartBucket
            return [hasValue ? `${int.format(Number(v))} rows · AED ${compact.format(b.value)}` : `${int.format(Number(v))} rows`, b.label]
          }}
        />
        <Bar dataKey="count" fill={C.blue} radius={[0, 4, 4, 0]} maxBarSize={18} label={{ position: "right", fontSize: 11, fill: "#374151", formatter: (v: unknown) => int.format(Number(v)) }} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Part-to-whole as labeled horizontal bars — no pie. Tail past 6 folds into "Other". */
function ShareBars({ buckets, total }: { buckets: DldChartBucket[]; total: number }) {
  if (buckets.length === 0 || total === 0) return <Empty />
  const head = buckets.slice(0, 6)
  const tail = buckets.slice(6)
  const rows = tail.length
    ? [...head, { label: `Other (${tail.length})`, count: tail.reduce((s, b) => s + b.count, 0), value: tail.reduce((s, b) => s + b.value, 0) }]
    : head
  return (
    <ul className="space-y-2.5">
      {rows.map((b) => {
        const share = (b.count / total) * 100
        return (
          <li key={b.label} className="text-xs" title={`${b.label}: ${int.format(b.count)} rows (${share.toFixed(1)}%)`}>
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="truncate text-[#374151]">{b.label}</span>
              <span className="shrink-0 tabular-nums text-[#374151]">
                {int.format(b.count)} <span className="text-[#9ca3af]">({share.toFixed(1)}%)</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#eef1f5] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.max(1, share)}%`, background: C.blue }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function Empty() {
  return <div className="h-[200px] flex items-center justify-center text-sm text-[#9ca3af]">No rows in this range.</div>
}
