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
  MiniStat,
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
const KEEP_UPPER = new Set(["LLC", "L.L.C", "L.L.C.", "FZE", "FZCO", "FZ-LLC", "PJSC", "PSC", "LLP", "DMCC", "JLT", "SPV", "UAE"])

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
  // Rank by how many rows a developer has, or by how much AED they add up to.
  const [rankBy, setRankBy] = useState<"count" | "value">("count")
  const byMeasure = (a: DldChartBucket, b: DldChartBucket) => (rankBy === "value" ? b.value - a.value : b.count - a.count) || a.label.localeCompare(b.label)
  const measureWord = rankBy === "value" ? "value" : "count"
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
  const projectsFor = (developer: string, which: "all" | "matched" | "guessed") =>
    (projectsByDeveloper.get(developer) ?? []).filter((p) => (which === "all" ? true : which === "guessed" ? p.guessed : !p.guessed)).sort(byMeasure)


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
  const groupLabel = GROUPS.find((g) => g.value === group)?.label.toLowerCase() ?? "rows"

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
    <section>
      <div className="mb-4">
        <h2 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">Developers Breakdown</h2>
        <p className="text-sm text-[#6b7280]">
          Which developers&rsquo; projects are transacting. Every DLD transaction in the range is credited to the developer behind its project —
          from DLD&rsquo;s register or FHI&rsquo;s catalogue, or — only when the project&rsquo;s first word is a developer those already know — a
          guess marked &ldquo;(by name)&rdquo;. Projects nobody recognises are &ldquo;Unmatched project&rdquo;; rows naming no project are
          &ldquo;Unknown&rdquo;.
        </p>
      </div>

      <form onSubmit={submit} className="bg-white rounded-2xl border border-[#e8eaed] p-5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-[200px] sm:shrink-0">
            <label className="block text-sm font-medium text-[#0d1117] mb-1.5">Transaction type</label>
            <FilterSelect value={group} onValueChange={setGroup} options={GROUPS} ariaLabel="Transaction type" className="w-full max-w-none h-10 rounded-xl py-0" />
          </div>
          <div className="w-full sm:w-auto sm:shrink-0">
            <span className="block text-sm font-medium text-[#0d1117] mb-1.5">Rank by</span>
            <div className="inline-flex h-10 rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-1" role="group" aria-label="Rank by">
              {(["count", "value"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRankBy(m)}
                  aria-pressed={rankBy === m}
                  className={`px-3 rounded-lg text-xs font-semibold transition-colors ${rankBy === m ? "bg-white text-[#001f3f] shadow-sm" : "text-[#6b7280] hover:text-[#001f3f]"}`}
                >
                  {m === "count" ? "Sales count" : "Sales value (AED)"}
                </button>
              ))}
            </div>
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

        {/* 1. Combined — the whole row, every source together, full width. */}
        <ChartCard
          title={`Top ${DLD_CHART_TOP_N} developers by ${measureWord} — all ${groupLabel}`}
          subtitle={`${longDate(submitted.values.P_FROM_DATE ?? "")} – ${longDate(submitted.values.P_TO_DATE ?? "")}. One bar per developer: register matches and name guesses added together (hover or open the table for the split), ranked by ${rankBy === "value" ? "total AED" : "sales count"}. ${
            sources && total > 0
              ? `Covers ${int.format(attributedRows)} of ${int.format(total)} rows (${((attributedRows / total) * 100).toFixed(0)}%) — the other ${int.format(unmatchedRows)} name a project nobody has on record and ${int.format(unknownRows)} name no project.`
              : ""
          }`}
          table={{
            head: ["Developer", "Rows", "Matched", "Guessed", "AED"],
            rows: merged.map((b) => [b.label, b.count, b.matched, b.guessed, int.format(b.value)]),
          }}
        >
          {/* Full-width card: names get half the width on one line, bars the other half. */}
          {!acc ? (
            <Skeleton h={300} />
          ) : (
            <DeveloperRankList rows={[...merged].sort(byMeasure).slice(0, DLD_CHART_TOP_N)} measure={rankBy} note={splitNote} projectsFor={(d) => projectsFor(d, "all")} totalOf={{ count: total, value: totalValue }} />
          )}
        </ChartCard>

        {/* Totals at a glance — how the rows loaded so far split by how (or whether) a developer was found. */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <MiniStat label="Number of transactions" value={acc ? int.format(total) : null} hint={acc ? `${groupLabel} in the range` : undefined} />
          <MiniStat
            label="Total value (AED)"
            value={acc ? aed(totalValue) : null}
            hint={acc && total > 0 ? `${int.format(Math.round(totalValue / total))} AED per transaction` : undefined}
          />
          <MiniStat label="Matched" value={acc ? int.format(known) : null} hint={acc ? `${pctOf(known, total)} · ${aed(matchedValue)}` : undefined} />
          <MiniStat label="Guessed by name" value={acc ? int.format(guessedRows) : null} hint={acc ? `${pctOf(guessedRows, total)} · ${aed(guessedValue)}` : undefined} />
          <MiniStat
            label="No developer"
            value={acc ? int.format(unmatchedRows + unknownRows) : null}
            hint={acc && total > 0 ? `${pctOf(unmatchedRows + unknownRows, total)} · ${aed(unmatchedValue + unknownValue)} · ${int.format(unmatchedRows)} unmatched project, ${int.format(unknownRows)} no project` : undefined}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* 2. Register matches only — the developer comes from the project. */}
          <ChartCard
            title={`Top ${DLD_CHART_TOP_N} by ${measureWord} — matched through the project`}
            subtitle={`${sources ? `${int.format(known)} of ${int.format(total)} rows (${total ? ((known / total) * 100).toFixed(0) : 0}%). ` : ""}Developer taken from the DLD projects register or FHI's catalogue — not guessed.`}
            table={{ head: ["Developer", "Rows", "AED"], rows: matched.map((b) => [b.label, b.count, int.format(b.value)]) }}
          >
            {!acc ? <Skeleton h={300} /> : <DeveloperRankList rows={[...matched].sort(byMeasure).slice(0, DLD_CHART_TOP_N)} measure={rankBy} projectsFor={(d) => projectsFor(d, "matched")} totalOf={{ count: total, value: totalValue }} />}
          </ChartCard>

          {/* 3. Name guesses only — clearly labelled as such. */}
          <ChartCard
            title={`Top ${DLD_CHART_TOP_N} by ${measureWord} — guessed by name only`}
            subtitle={`${sources ? `${int.format(guessedRows)} of ${int.format(total)} rows (${total ? ((guessedRows / total) * 100).toFixed(0) : 0}%). ` : ""}No register match for the project, but its first word is a developer the register or catalogue already knows — a GUESS. Treat as indicative only.`}
            table={{ head: ["Developer (guess)", "Rows", "AED"], rows: guessed.map((b) => [b.label, b.count, int.format(b.value)]) }}
          >
            {!acc ? <Skeleton h={300} /> : <DeveloperRankList rows={[...guessed].sort(byMeasure).slice(0, DLD_CHART_TOP_N)} measure={rankBy} projectsFor={(d) => projectsFor(d, "guessed")} totalOf={{ count: total, value: totalValue }} />}
          </ChartCard>

        </div>

        {/* Full width, on its own row — one share bar per source. */}
        <ChartCard
          title="How the developer was found"
          subtitle="“Guessed by name” feeds the guessed card; “project not on record” is the Unmatched project bucket; “no project on the row” is Unknown."
          table={{ head: ["Source", "Rows", ""], rows: sourceBuckets.map((b) => [b.label, b.count, ""]) }}
        >
          {!acc ? <Skeleton h={160} /> : <ShareBars buckets={sourceBuckets} total={total} />}
        </ChartCard>
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
  const numW = Math.ceil(Math.max(0, ...rows.map((r) => textPx(numText(r))))) + 4
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
                <span className="h-[14px] rounded-r bg-[#eef1f5] overflow-hidden">
                  <span className="block h-full rounded-r" style={{ width: `${Math.max(1, (r[measure] / max) * 100)}%`, background: color }} />
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
                            <span className="h-[8px] rounded-r bg-white border border-[#eef1f5] overflow-hidden">
                              <span className="block h-full rounded-r opacity-70" style={{ width: `${Math.max(1, share)}%`, background: color }} />
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
    </div>
  )
}
