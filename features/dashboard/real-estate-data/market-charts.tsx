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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { FilterSelect } from "@/components/ui/filter-select"
import { agoLabel, cacheDelete, cacheGet, cacheSet } from "./client-cache"
import {
  DLD_CHART_BATCH_CHUNKS,
  DLD_CHART_FIRST_BATCH_CHUNKS,
  DLD_CHART_LATEST_N,
  DLD_CHART_SPECS,
  DLD_CHART_TOP_N,
  DLD_CHUNK_SECONDS_ESTIMATE,
  DLD_DATASETS,
  DLD_SUMMARY_AUTO_EXACT_MAX,
  SQFT_PER_SQM,
  isoToDldDate,
  missingRequired,
  resolveDefault,
  type DldBreakdownResponse,
  type DldChartBucket,
  type DldChartSpec,
  type DldCommand,
  type DldDataset,
  type DldRow,
  type DldSummaryResponse,
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

// ─── 2. Dataset breakdowns ───────────────────────────────────────────────────

// The Breakdowns form only exposes date fields, so it lists the date-filtered datasets.
const CHARTABLE = (Object.keys(DLD_CHART_SPECS) as DldCommand[])
  .filter((c) => DLD_DATASETS[c].filters.some((f) => f.kind === "date" && f.required))
  .map((c) => ({ value: c, label: DLD_DATASETS[c].label }))

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
  /** Sales-style headline sums (Transactions only). */
  kpi: { count: number; valueSum: number; valueWithAreaSum: number; areaSqmSum: number; locations: Tally } | null
  /** Newest KPI rows seen so far, newest first, capped at DLD_CHART_LATEST_N. */
  latest: DldRow[]
  /** Breakdowns' own price-per-sqft sums — every row in scope, no category filter. */
  areaAgg: { valueWithAreaSum: number; areaSqmSum: number } | null
}

const addTo = (m: Tally, label: string, b: { count: number; value: number }) => {
  const cur = m[label] ?? { count: 0, value: 0 }
  m[label] = { count: cur.count + b.count, value: cur.value + b.value }
}

/**
 * Pure: returns a new Accum and never touches `acc`. It runs inside a state
 * updater, which React (in development) invokes twice with the same input to
 * catch exactly this — an in-place merge would count every batch two times.
 */
function mergeBatch(acc: Accum | null, res: DldBreakdownResponse): Accum {
  const next: Accum = acc
    ? {
        ...acc,
        daily: { ...acc.daily },
        breakdowns: Object.fromEntries(Object.entries(acc.breakdowns).map(([k, m]) => [k, { ...m }])),
        top: { ...acc.top },
        kpi: acc.kpi ? { ...acc.kpi, locations: { ...acc.kpi.locations } } : null,
        latest: [...acc.latest],
        areaAgg: acc.areaAgg ? { ...acc.areaAgg } : null,
      }
    : {
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
        kpi: null,
        latest: [],
        areaAgg: null,
      }
  for (const d of res.daily) addTo(next.daily, d.date, d)
  for (const [k, buckets] of Object.entries(res.breakdowns)) {
    next.breakdowns[k] ??= {}
    for (const b of buckets) addTo(next.breakdowns[k], b.label, b)
  }
  for (const b of res.top) addTo(next.top, b.label, b)
  next.count += res.totals.count
  next.value += res.totals.value
  next.available = res.coverage.available
  next.chunkTo = res.coverage.chunkTo
  next.done = res.coverage.done
  next.cacheHits += res.coverage.cacheHits
  if (res.coverage.from && (!next.from || res.coverage.from < next.from)) next.from = res.coverage.from
  if (res.coverage.to && (!next.to || res.coverage.to > next.to)) next.to = res.coverage.to
  if (res.kpi) {
    const k = next.kpi ?? { count: 0, valueSum: 0, valueWithAreaSum: 0, areaSqmSum: 0, locations: {} }
    for (const b of res.kpi.locations) addTo(k.locations, b.label, b)
    next.kpi = {
      ...k,
      count: k.count + res.kpi.count,
      valueSum: k.valueSum + res.kpi.valueSum,
      valueWithAreaSum: k.valueWithAreaSum + res.kpi.valueWithAreaSum,
      areaSqmSum: k.areaSqmSum + res.kpi.areaSqmSum,
    }
  }
  if (res.latest?.length) {
    // Batches arrive in date order, so the new batch's rows are the newest.
    next.latest = [...res.latest, ...next.latest].slice(0, DLD_CHART_LATEST_N)
  }
  if (res.areaAgg) {
    const a = next.areaAgg ?? { valueWithAreaSum: 0, areaSqmSum: 0 }
    next.areaAgg = {
      valueWithAreaSum: a.valueWithAreaSum + res.areaAgg.valueWithAreaSum,
      areaSqmSum: a.areaSqmSum + res.areaAgg.areaSqmSum,
    }
  }
  return next
}

const toBuckets = (m: Tally): DldChartBucket[] =>
  Object.entries(m).map(([label, v]) => ({ label, count: v.count, value: v.value })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

// ─── Batched loading hook ────────────────────────────────────────────────────

type BatchJob = { command: DldCommand; values: Record<string, string> }
/** What the page remembers between visits: the job and what it loaded. */
type BatchMemo = { jobKey: string; job: BatchJob; acc: Accum | null }

const jobKeyOf = (job: BatchJob | null) => (job ? JSON.stringify([job.command, job.values]) : null)

/**
 * Loads a breakdown job batch by batch, merging into an Accum, and remembers
 * the result in the client cache under `cacheKey`.
 *
 * Declarative: pass the job you want (`null` for none). When the job on hand
 * is a different one, loading starts from scratch; when it matches a cached
 * one, it's restored with no request. `auto` decides whether an unfinished
 * restored job resumes by itself or waits for Continue.
 */
function useBatchJob(cacheKey: string, want: BatchJob | null, auto: boolean) {
  const [memo] = useState(() => cacheGet<BatchMemo>(cacheKey))
  const wantKey = jobKeyOf(want)

  type S = { jobKey: string | null; acc: Accum | null; at: number | null; refresh: boolean; nonce: number; stopped: boolean; error: string | null }
  const [st, setSt] = useState<S>(() =>
    memo ? { jobKey: memo.data.jobKey, acc: memo.data.acc, at: memo.at, refresh: false, nonce: 0, stopped: !auto, error: null } : { jobKey: null, acc: null, at: null, refresh: false, nonce: 0, stopped: false, error: null },
  )

  // The state only counts for the job we want; anything else reads as empty.
  const current = st.jobKey === wantKey
  const acc = current ? st.acc : null
  const finished = acc?.done ?? false
  const stopped = current && st.stopped
  const error = current ? st.error : null
  const chunkFrom = acc?.chunkTo ?? 0
  const nonce = st.nonce

  useEffect(() => {
    if (!want || !wantKey || finished || stopped || error) return
    let cancelled = false
    void (async () => {
      const ds = DLD_DATASETS[want.command]
      const body: Record<string, string> = {
        kind: "breakdown",
        command: want.command,
        chunkFrom: String(chunkFrom),
        // Small first batch → first paint in seconds; full batches after that.
        chunkCount: String(chunkFrom === 0 ? DLD_CHART_FIRST_BATCH_CHUNKS : DLD_CHART_BATCH_CHUNKS),
        refresh: current && st.refresh ? "1" : "",
      }
      for (const f of ds.filters) body[f.param] = f.kind === "date" ? isoToDldDate(want.values[f.param] ?? "") : (want.values[f.param] ?? "")
      let res: DldBreakdownResponse | null = null
      let err: string | null = null
      try {
        const r = await fetch("/api/admin/dld/charts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        const json = (await r.json()) as DldBreakdownResponse & { error?: string }
        if (r.ok) res = json
        else err = json.error || "Request failed."
      } catch {
        err = "Could not load chart data."
      }
      if (cancelled) return
      setSt((prev) => {
        // A newer job or a Refresh superseded this batch — drop it.
        if (prev.nonce !== nonce) return prev
        if (err || !res) return { ...prev, jobKey: wantKey, acc: prev.jobKey === wantKey ? prev.acc : null, error: err }
        const merged = mergeBatch(prev.jobKey === wantKey ? prev.acc : null, res)
        // Remember progress after every batch: a Stop, a tab switch or a
        // reload all come back to exactly this state.
        const entry = cacheSet<BatchMemo>(cacheKey, { jobKey: wantKey, job: want, acc: merged })
        // A Refresh applies to the job it was pressed on; a new job starts clean.
        return { ...prev, jobKey: wantKey, acc: merged, at: entry.at, error: null, refresh: prev.jobKey === wantKey ? prev.refresh : false }
      })
    })()
    return () => {
      cancelled = true
    }
    // wantKey + chunkFrom + nonce identify the batch; `want` is read for its body.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantKey, chunkFrom, finished, stopped, error, nonce])

  const loading = !!want && !finished && !stopped && !error
  const refresh = () => {
    if (!wantKey) return
    setSt((prev) => ({ ...prev, jobKey: wantKey, acc: null, at: null, refresh: true, nonce: prev.nonce + 1, stopped: false, error: null }))
  }
  const stop = () => setSt((prev) => ({ ...prev, stopped: true }))
  const resume = () => setSt((prev) => ({ ...prev, jobKey: wantKey, acc: prev.jobKey === wantKey ? prev.acc : null, stopped: false, error: null, nonce: prev.nonce + 1 }))

  return { acc, loading, finished, stopped, error, updatedAt: current ? st.at : null, restored: memo?.data.job ?? null, refresh, stop, resume }
}

/** "3,412 of 9,439 rows · 01 Jan – 22 Jan · loading more…" + progress bar. */
function CoverageLine({
  acc,
  loading,
  stopped,
  error,
  label,
  onResume,
  children,
}: {
  acc: Accum | null
  loading: boolean
  stopped: boolean
  error: string | null
  label: string
  onResume: () => void
  children?: React.ReactNode
}) {
  const progress = acc && acc.available > 0 ? Math.min(100, (acc.count / acc.available) * 100) : 0
  return (
    <div className="bg-white rounded-2xl border border-[#e8eaed] px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#6b7280]">
        {acc ? (
          <>
            <span>
              <span className="font-semibold text-[#0d1117]">{int.format(acc.count)}</span> of {int.format(acc.available)} {label} rows
              {acc.from && acc.to && (
                <>
                  {" "}
                  · {longDate(acc.from)} – {longDate(acc.to)}
                </>
              )}
            </span>
            {children}
            {loading && (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> loading more…
              </span>
            )}
            {stopped && !acc.done && !error && (
              <span className="text-amber-700">
                · stopped — figures cover the rows above.{" "}
                <button type="button" onClick={onResume} className="font-semibold underline underline-offset-2">
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
  )
}

// ─── Shared date helpers (Breakdowns' last-7-days default and comparison window) ───

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const shiftDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
/** Today and the 6 days before it — "last 7 days" inclusive of today. */
const last7DaysRange = () => {
  const today = new Date()
  return { from: isoOf(shiftDays(today, -6)), to: isoOf(today) }
}

/**
 * Initial filter values for the Breakdowns tab: every date field defaults to
 * the last 7 days (unlike the raw dataset tables under Real Estate Data,
 * which start blank and require the user to pick a range) — Breakdowns is
 * meant to load something useful the moment you open it.
 */
function defaultBreakdownValues(dataset: DldDataset): Record<string, string> {
  const range = last7DaysRange()
  return Object.fromEntries(
    dataset.filters.map((f) => [f.param, f.kind === "date" ? (f.param === "P_TO_DATE" ? range.to : range.from) : resolveDefault(f)]),
  )
}

const delta = (cur: number | null, prev: number | null) => (cur === null || prev === null || prev === 0 ? null : ((cur - prev) / prev) * 100)

function KpiTile({ label, value, change, pending }: { label: string; value: string | null; change: number | null; pending: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-[#e8eaed] px-5 py-4">
      <div className="text-sm text-[#6b7280]">{label}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
        {value === null ? <div className="h-8 w-32 rounded bg-[#eef1f5] animate-pulse" /> : <span className="text-[28px] leading-none font-bold tabular-nums text-[#0d1117]">{value}</span>}
        {change !== null ? (
          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold tabular-nums ${change >= 0 ? "bg-[#e8f6ef] text-[#177a51]" : "bg-[#fdecea] text-[#b3261e]"}`}>
            {pct(change)}
            <span aria-hidden>{change >= 0 ? "↑" : "↓"}</span>
            <span className="sr-only">{change >= 0 ? "up" : "down"} versus the previous period</span>
          </span>
        ) : pending && value !== null ? (
          <span className="inline-flex items-center gap-1 text-xs text-[#9ca3af]">
            <Loader2 className="w-3 h-3 animate-spin" /> comparing
          </span>
        ) : null}
      </div>
    </div>
  )
}

const BREAKDOWN_CACHE_KEY = "charts:breakdown:last"
const BREAKDOWN_PREVIOUS_CACHE_KEY = "charts:breakdown:previous"

/**
 * The equal-length window immediately before `job`'s date range, for the
 * "compared to before" tiles — e.g. job = 14–20 Sep → previous = 7–13 Sep.
 * Null when the dataset has no date range to shift (shouldn't happen for
 * anything in CHARTABLE, which is filtered to date-required datasets).
 */
function previousWindowJob(job: BatchJob): BatchJob | null {
  const from = job.values.P_FROM_DATE
  const to = job.values.P_TO_DATE
  if (!from || !to) return null
  const fromD = new Date(`${from}T00:00:00`)
  const toD = new Date(`${to}T00:00:00`)
  if (Number.isNaN(fromD.getTime()) || Number.isNaN(toD.getTime())) return null
  const days = Math.round((toD.getTime() - fromD.getTime()) / 86_400_000) + 1
  if (days <= 0) return null
  const prevTo = shiftDays(fromD, -1)
  const prevFrom = shiftDays(prevTo, -(days - 1))
  return { command: job.command, values: { ...job.values, P_FROM_DATE: isoOf(prevFrom), P_TO_DATE: isoOf(prevTo) } }
}

export function BreakdownSection() {
  // The form; `submitted` is the job on screen (restored from the last visit).
  const restoredRef = useState(() => cacheGet<BatchMemo>(BREAKDOWN_CACHE_KEY)?.data.job ?? null)[0]
  const [command, setCommand] = useState<DldCommand>(restoredRef?.command ?? CHARTABLE[0].value)
  const dataset = DLD_DATASETS[command]
  const dateFields = dataset.filters.filter((f) => f.kind === "date")
  const [values, setValues] = useState<Record<string, string>>(() => restoredRef?.values ?? defaultBreakdownValues(dataset))
  // No earlier session to restore → load the last-7-days default right away,
  // same as the Market Charts tab, instead of sitting on an empty placeholder.
  const [submitted, setSubmitted] = useState<BatchJob | null>(() => restoredRef ?? { command, values })
  const job = useBatchJob(BREAKDOWN_CACHE_KEY, submitted, false)
  const { acc, loading } = job

  // The equal-length prior period, loaded automatically in the background —
  // this is what powers the "vs previous period" change on the tiles below.
  const previousJob = useMemo(() => (submitted ? previousWindowJob(submitted) : null), [submitted])
  const prev = useBatchJob(BREAKDOWN_PREVIOUS_CACHE_KEY, previousJob, true)
  const prevDone = !!prev.acc?.done

  const switchDataset = (next: DldCommand) => {
    setCommand(next)
    setValues(defaultBreakdownValues(DLD_DATASETS[next]))
  }
  const missing = missingRequired(dataset, values)

  const appliedDataset: DldDataset = submitted ? DLD_DATASETS[submitted.command] : dataset
  const appliedSpec = (submitted ? DLD_CHART_SPECS[submitted.command] : DLD_CHART_SPECS[command]) as DldChartSpec
  const colLabel = (key: string) => appliedDataset.columns.find((c) => c.key === key)?.label ?? key

  // "Average" and "compared to before" — the two figures Breakdowns didn't
  // have (Market Charts' Sales Overview is where they lived, sales-only).
  // Rows always compares; the average only where the dataset has a value field.
  const avgOf = (a: Accum | null) => (a && appliedSpec.valueKey && a.count > 0 ? a.value / a.count : null)
  const currentAvg = avgOf(acc)
  const previousAvg = prevDone ? avgOf(prev.acc) : null
  const countChange = prevDone && prev.acc ? delta(acc?.count ?? null, prev.acc.count) : null
  const avgChange = currentAvg !== null && previousAvg !== null ? delta(currentAvg, previousAvg) : null
  const comparisonPending = !!previousJob && !prevDone && !prev.error

  // Price per sqft — same "value ÷ size" math Market Charts used to show for
  // Sales, generalized to whatever rows are in scope for any dataset with an area field.
  const perSqftOf = (a: Accum | null) => (a?.areaAgg && a.areaAgg.areaSqmSum > 0 ? a.areaAgg.valueWithAreaSum / (a.areaAgg.areaSqmSum * SQFT_PER_SQM) : null)
  const currentPerSqft = perSqftOf(acc)
  const previousPerSqft = prevDone ? perSqftOf(prev.acc) : null
  const perSqftChange = currentPerSqft !== null && previousPerSqft !== null ? delta(currentPerSqft, previousPerSqft) : null

  const daily = useMemo(
    () => (acc ? Object.entries(acc.daily).map(([date, v]) => ({ date, count: v.count, value: v.value })).sort((a, b) => a.date.localeCompare(b.date)) : []),
    [acc],
  )
  const top = useMemo(() => (acc ? toBuckets(acc.top).slice(0, DLD_CHART_TOP_N) : []), [acc])
  const breakdownBuckets = useMemo(
    () => (acc ? Object.fromEntries(Object.entries(acc.breakdowns).map(([k, m]) => [k, toBuckets(m)])) : {}),
    [acc],
  )

  return (
    <section>
      <div className="mb-4">
        <h2 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">Breakdowns</h2>
        <p className="text-sm text-[#6b7280]">Daily volume, category splits and a top-10 ranking for a date range. Built from the same rows as the tables.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (missing.length) return
          const next = { command, values }
          // Same job again → treat as a refresh rather than a no-op.
          if (jobKeyOf(next) === jobKeyOf(submitted)) job.refresh()
          else setSubmitted(next)
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
              <button type="button" onClick={job.stop} className="h-10 px-4 rounded-xl border border-[#e5e7eb] bg-white text-sm font-semibold text-[#374151] hover:border-[#001f3f]/30">
                Stop
              </button>
            ) : (
              submitted && <RefreshButton onClick={job.refresh} loading={loading} updatedAt={job.updatedAt} />
            )}
          </div>
        </div>
        {missing.length > 0 && <p className="mt-3 text-xs text-[#6b7280]">Pick {missing.map((f) => f.label.toLowerCase()).join(" and ")} to load.</p>}
      </form>

      {job.error && <div className="mb-4"><ErrorBox message={job.error} onRetry={job.resume} /></div>}

      {!submitted && (
        <div className="rounded-2xl border border-dashed border-[#d9dde3] bg-[#fafbfc] px-6 py-12 text-center text-sm text-[#6b7280]">
          Choose a dataset and date range, then press <span className="font-semibold text-[#0d1117]">Load charts</span>.
        </div>
      )}

      {submitted && (
        <div className="space-y-4">
          <CoverageLine acc={acc} loading={loading} stopped={job.stopped} error={job.error} label={appliedDataset.label.toLowerCase()} onResume={job.resume}>
            {acc && appliedSpec.valueKey && (
              <span>
                · {appliedSpec.valueLabel?.replace(" (AED)", "")} total AED {compact.format(acc.value)}
              </span>
            )}
          </CoverageLine>

          {/* Average + "compared to before" — the previous equal-length period
              loads in the background; each tile shows its own pending state
              until that finishes, so the rest of the page never waits on it. */}
          {acc && previousJob && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              <KpiTile label={`${appliedDataset.label} (this period)`} value={int.format(acc.count)} change={countChange} pending={comparisonPending} />
              {appliedSpec.valueKey && (
                <KpiTile
                  label={`Average ${appliedSpec.valueLabel?.replace(" (AED)", "").toLowerCase()}`}
                  value={currentAvg !== null ? `${int.format(Math.round(currentAvg))}${appliedSpec.valueLabel?.includes("(AED)") ? " AED" : ""}` : "—"}
                  change={avgChange}
                  pending={comparisonPending}
                />
              )}
              {appliedSpec.areaKey && (
                <KpiTile
                  label="Average price per sqft (AED)"
                  value={currentPerSqft !== null ? `${int.format(Math.round(currentPerSqft))} / sqft` : "—"}
                  change={perSqftChange}
                  pending={comparisonPending}
                />
              )}
              <p className="sm:col-span-2 xl:col-span-3 -mt-1 text-xs text-[#9ca3af]">
                vs {longDate(previousJob.values.P_FROM_DATE)} – {longDate(previousJob.values.P_TO_DATE)}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {appliedSpec.dateKey && (
              <ChartCard title="Rows per day" subtitle={`Count of ${appliedDataset.label.toLowerCase()} by ${colLabel(appliedSpec.dateKey).toLowerCase()}`} table={{ head: ["Day", "Rows"], rows: daily.map((d) => [longDate(d.date), d.count]) }}>
                {!acc ? <Skeleton /> : <DailyChart data={daily} dataKey="count" color={C.blue} format={(v) => int.format(v)} label="Rows" />}
              </ChartCard>
            )}
            {appliedSpec.dateKey && appliedSpec.valueKey && (
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
  height = 240,
}: {
  data: DldBreakdownResponse["daily"]
  dataKey: "count" | "value"
  color: string
  format: (v: number) => string
  label: string
  height?: number
}) {
  if (data.length === 0) return <Empty height={height} />
  // A handful of days reads better as bars; a long run as a line.
  const asLine = data.length > 31
  return (
    <ResponsiveContainer width="100%" height={height}>
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

function RankChart({ buckets, hasValue, rowHeight = 30 }: { buckets: DldChartBucket[]; hasValue: boolean; rowHeight?: number }) {
  if (buckets.length === 0) return <Empty />
  const h = Math.max(160, buckets.length * rowHeight)
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

function Empty({ height = 200 }: { height?: number }) {
  return (
    <div className="flex items-center justify-center text-sm text-[#9ca3af]" style={{ height }}>
      No rows for these filters.
    </div>
  )
}

// ─── Per-tab summary strip ───────────────────────────────────────────────────

/**
 * The fast summary above each dataset table: exact total and category counts
 * from the gateway's own totals, plus headline figures from the newest 1,000
 * rows. One request, a few seconds cold, instant from the client cache.
 */
export function TabSummary({
  dataset,
  applied,
  ready,
}: {
  dataset: DldDataset
  applied: Record<string, string>
  /** False while the tab is waiting for its required filters. */
  ready: boolean
}) {
  const spec = DLD_CHART_SPECS[dataset.command]
  const key = `summary:${dataset.command}:${JSON.stringify(applied)}`
  const [attempt, setAttempt] = useState(0)
  const [fetched, setFetched] = useState<{ key: string; attempt: number; res: DldSummaryResponse | null; error: string | null; at: number } | null>(null)

  // `attempt` is deliberate: Refresh deletes the cached copy first and this must re-read (and miss).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cached = useMemo(() => cacheGet<DldSummaryResponse>(key), [key, attempt])
  const shown = fetched && fetched.key === key && fetched.attempt === attempt ? fetched : cached ? { res: cached.data, error: null, at: cached.at } : null

  useEffect(() => {
    if (!ready || shown) return
    let cancelled = false
    void (async () => {
      const body: Record<string, string> = { kind: "summary", command: dataset.command, refresh: attempt > 0 ? "1" : "" }
      for (const f of dataset.filters) body[f.param] = f.kind === "date" ? isoToDldDate(applied[f.param] ?? "") : (applied[f.param] ?? "")
      let res: DldSummaryResponse | null = null
      let error: string | null = null
      try {
        const r = await fetch("/api/admin/dld/charts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        const json = (await r.json()) as DldSummaryResponse & { error?: string }
        if (r.ok) res = json
        else error = json.error || "Request failed."
      } catch {
        error = "Could not load the summary."
      }
      if (cancelled) return
      const at = res ? cacheSet(key, res).at : Date.now()
      setFetched({ key, attempt, res, error, at })
    })()
    return () => {
      cancelled = true
    }
    // key encodes dataset + applied; `shown` gates on cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt, ready, !!shown])

  const loading = ready && !shown
  const res = shown?.res ?? null
  const colLabel = (k: string) => dataset.columns.find((c) => c.key === k)?.label ?? k
  const valueName = spec.valueLabel?.replace(" (AED)", "").replace(" (sqm)", "") ?? "Value"
  const valueUnit = spec.valueLabel?.includes("(sqm)") ? " sqm" : spec.valueLabel?.includes("(AED)") ? " AED" : ""

  // Exact figures: the same batched pull Market Charts does, in the background.
  // Starts by itself for result sets up to DLD_SUMMARY_AUTO_EXACT_MAX rows;
  // larger ones wait for the button (which states the estimated time).
  const autoExact = !!res && res.total > 0 && res.total <= DLD_SUMMARY_AUTO_EXACT_MAX
  const [manualExact, setManualExact] = useState(false)
  const wantExact = ready && !!res && (autoExact || manualExact) ? { command: dataset.command, values: applied } : null
  const exact = useBatchJob(`summary:exact:${dataset.command}`, wantExact, true)
  const acc = exact.acc
  const exactDone = !!acc?.done
  const exactMinutes = res ? Math.max(1, Math.round((Math.ceil(res.total / 1000) * DLD_CHUNK_SECONDS_ESTIMATE) / 60)) : 0

  // What the headline tiles show: exact when the full pull finished, else the sample.
  const exactAvg = acc && acc.count > 0 ? (acc.kpi ? (acc.kpi.count > 0 ? acc.kpi.valueSum / acc.kpi.count : null) : acc.value / acc.count) : null
  const exactPerSqft = acc?.kpi && acc.kpi.areaSqmSum > 0 ? acc.kpi.valueWithAreaSum / (acc.kpi.areaSqmSum * SQFT_PER_SQM) : null
  const exactTop = useMemo(() => (acc ? toBuckets(acc.top).slice(0, 5) : []), [acc])
  const useExact = exactDone
  const avg = useExact ? exactAvg : (res?.sample?.avgValue ?? null)
  const perSqft = useExact ? exactPerSqft : (res?.sample?.perSqft ?? null)
  const top = useExact ? exactTop : (res?.sample?.top ?? [])
  const topTotal = useExact ? (acc?.count ?? 0) : (res?.sample?.rows ?? 0)
  const mark = useExact ? "" : "◦ "

  const refresh = () => {
    cacheDelete(key)
    setAttempt((a) => a + 1)
    if (wantExact) exact.refresh()
  }

  if (!ready) return null

  return (
    <div className="bg-white rounded-2xl border border-[#e8eaed] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-[15px] font-semibold text-[#0d1117]">Summary for these filters</h3>
          <p className="text-xs text-[#6b7280] mt-0.5">
            {res ? (
              useExact ? (
                <>All figures cover all {int.format(res.total)} rows in your filters.</>
              ) : (
                <>
                  Total and split counts cover all {int.format(res.total)} rows in your filters.
                  {res.sample && (
                    <>
                      {" "}
                      Figures marked ◦ use only the newest {int.format(res.sample.rows)} of them
                      {res.sample.from && res.sample.to
                        ? res.sample.from === res.sample.to
                          ? `, all from ${longDate(res.sample.from)}`
                          : `, from ${longDate(res.sample.from)} to ${longDate(res.sample.to)}`
                        : ""}
                      .
                    </>
                  )}
                </>
              )
            ) : (
              "Total and split counts cover every row in your filters. Figures marked ◦ use only the newest rows."
            )}
          </p>
          {res && res.total > 0 && !useExact && (
            <p className="text-xs mt-1">
              {wantExact ? (
                exact.error ? (
                  <span className="text-rose-700">
                    Exact figures failed.{" "}
                    <button type="button" onClick={exact.resume} className="font-semibold underline underline-offset-2">
                      Retry
                    </button>
                  </span>
                ) : exact.stopped ? (
                  <span className="text-amber-700">
                    Exact figures stopped at {int.format(acc?.count ?? 0)} rows.{" "}
                    <button type="button" onClick={exact.resume} className="font-semibold underline underline-offset-2">
                      Continue
                    </button>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[#374151]">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Working out exact figures in the background: {int.format(acc?.count ?? 0)} of {int.format(res.total)} rows
                    {acc && acc.cacheHits > 0 && <span className="text-[#9ca3af]">· from cache</span>}
                    <button type="button" onClick={exact.stop} className="ml-1 font-semibold underline underline-offset-2">
                      Stop
                    </button>
                  </span>
                )
              ) : (
                <span className="text-[#374151]">
                  {int.format(res.total)} rows is a lot to pull for exact averages.{" "}
                  <button type="button" onClick={() => setManualExact(true)} className="font-semibold text-[#001f3f] underline underline-offset-2">
                    Compute exact figures anyway
                  </button>{" "}
                  <span className="text-[#9ca3af]">(about {exactMinutes} min the first time, seconds once cached)</span>
                </span>
              )}
            </p>
          )}
        </div>
        <RefreshButton onClick={refresh} loading={loading} updatedAt={shown?.res ? shown.at : null} />
      </div>

      {shown?.error && <div className="mb-4"><ErrorBox message={shown.error} onRetry={refresh} /></div>}

      {/* Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <MiniStat label="Total rows" value={res ? int.format(res.total) : null} />
        {spec.valueKey && <MiniStat label={`${mark}Average ${spec.kpi ? "sale price" : valueName.toLowerCase()}`} value={res ? (avg != null ? `${int.format(Math.round(avg))}${valueUnit}` : "—") : null} />}
        {spec.kpi && <MiniStat label={`${mark}Sale price per sqft`} value={res ? (perSqft != null ? `${int.format(Math.round(perSqft))} AED` : "—") : null} />}
        <MiniStat label={`${mark}Busiest ${colLabel(spec.topKey).toLowerCase()}`} value={res ? (top[0] ? top[0].label : "—") : null} hint={top[0] ? `${int.format(top[0].count)} of ${int.format(topTotal)}` : undefined} />
      </div>

      {/* Exact splits + sample top-5 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-5">
        {(res?.splits ?? (loading ? Array.from({ length: 3 }, () => null) : [])).map((sp, i) =>
          sp ? (
            <div key={sp.param}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[#6b7280] mb-2">By {sp.label.replace(/\?$/, "").toLowerCase()}</h4>
              <ShareBars buckets={sp.buckets} total={res?.total ?? 0} />
            </div>
          ) : (
            <Skeleton key={i} h={110} />
          ),
        )}
        {res && top.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[#6b7280] mb-2">
              {mark}Top {colLabel(spec.topKey).toLowerCase()}{useExact ? "" : " in the newest rows"}
            </h4>
            <ShareBars buckets={top} total={topTotal} />
          </div>
        )}
        {res && res.splits.length === 0 && !res.sample && <p className="text-sm text-[#9ca3af]">Nothing to summarise for these filters.</p>}
      </div>
    </div>
  )
}

function MiniStat({ label, value, hint }: { label: string; value: string | null; hint?: string }) {
  return (
    <div className="rounded-xl bg-[#f8fafc] border border-[#f0f2f5] px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-[#6b7280] truncate" title={label}>
        {label}
      </div>
      {value === null ? (
        <div className="mt-1.5 h-6 w-24 rounded bg-[#eef1f5] animate-pulse" />
      ) : (
        <div className="mt-1 text-lg font-bold tabular-nums text-[#0d1117] truncate" title={value}>
          {value}
        </div>
      )}
      {hint && <div className="text-[11px] text-[#9ca3af]">{hint}</div>}
    </div>
  )
}
