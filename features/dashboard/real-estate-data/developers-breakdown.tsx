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

import { useMemo, useState } from "react"
import { Loader2, Search } from "lucide-react"
import { FilterSelect } from "@/components/ui/filter-select"
import { DLD_CHART_TOP_N, DLD_DATASETS, resolveDefault, type DldChartBucket } from "@/lib/dld-open-data"
import {
  ChartCard,
  CoverageLine,
  ErrorBox,
  RankChart,
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
function last30Days(): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 29)
  return { from: isoOf(from), to: isoOf(to) }
}

/** Sales only by default — mortgages and gifts say nothing about who is selling. */
const GROUPS = [
  { value: "1", label: "Sales" },
  { value: "", label: "All transactions" },
  { value: "2", label: "Mortgages" },
  { value: "3", label: "Gifts" },
]

function jobFor(range: { from: string; to: string }, group: string): BatchJob {
  const dataset = DLD_DATASETS.transactions
  const values = Object.fromEntries(
    dataset.filters.map((f) => [f.param, f.kind === "date" ? (f.param === "P_TO_DATE" ? range.to : range.from) : resolveDefault(f)]),
  )
  values.P_GROUP_ID = group
  return { command: "transactions", values }
}

type MergedBucket = DldChartBucket & { matched: number; guessed: number }

/** Company-form abbreviations DLD writes in caps that would read wrong title-cased. */
const KEEP_UPPER = new Set(["LLC", "L.L.C", "L.L.C.", "FZE", "FZCO", "FZ-LLC", "PJSC", "PSC", "LLP", "DMCC", "JLT", "SPV", "UAE"])

/**
 * "IMTIAZ JA REAL ESTATE DEVELOPMENT L.L.C" → "Imtiaz Ja Real Estate Development L.L.C".
 * Display only — DLD and the catalogue write names in every case imaginable;
 * one case on the page also lets two spellings of the same developer merge.
 */
function titleCase(label: string): string {
  return label
    .split(/\s+/)
    .map((w) => {
      if (KEEP_UPPER.has(w.toUpperCase())) return w.toUpperCase()
      // Hyphenated / parenthesised parts each get a capital: "al-furjan" → "Al-Furjan", "(by" → "(By".
      return w.replace(/(^|[-(/])([a-z\u00e0-\u00ff])/gi, (_m, pre: string, ch: string) => pre + ch.toUpperCase()).replace(/(?<=[A-Za-z\u00c0-\u00ff])[A-Z\u00c0-\u00dd]+(?=[A-Z\u00c0-\u00dd]*(?:[-(/\s]|$))/g, (m) => m.toLowerCase())
    })
    .join(" ")
}
const relabel = (b: DldChartBucket): DldChartBucket => ({ ...b, label: titleCase(b.label) })

/** "738 matched · 332 guessed" for a merged developer bar; nothing for the Unmatched/Unknown bars. */
function splitNote(b: DldChartBucket): string | null {
  const m = b as MergedBucket
  if (!m.matched && !m.guessed) return null
  return `${int.format(m.matched)} matched · ${int.format(m.guessed)} guessed`
}

/** "17% of rows" for the tiles; undefined until there is a total. */
const pctOf = (n: number, total: number) => (total > 0 ? `${((n / total) * 100).toFixed(0)}% of rows` : undefined)

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
            <RefreshButton onClick={job.refresh} loading={loading} updatedAt={job.updatedAt} />
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
          title={`Top ${DLD_CHART_TOP_N} developers — all ${groupLabel}`}
          subtitle={`${longDate(submitted.values.P_FROM_DATE ?? "")} – ${longDate(submitted.values.P_TO_DATE ?? "")}. One bar per developer: register matches and name guesses added together (hover or open the table for the split). ${
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
          {!acc ? <Skeleton h={300} /> : <RankChart buckets={merged.slice(0, DLD_CHART_TOP_N)} hasValue labelShare={0.5} tooltipNote={splitNote} />}
        </ChartCard>

        {/* Totals at a glance — how the rows loaded so far split by how (or whether) a developer was found. */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <MiniStat label={`Total ${groupLabel}`} value={acc ? int.format(total) : null} hint={acc ? `${compact.format(acc.value)} AED` : undefined} />
          <MiniStat label="Matched" value={acc ? int.format(known) : null} hint={pctOf(known, total)} />
          <MiniStat label="Guessed" value={acc ? int.format(guessedRows) : null} hint={pctOf(guessedRows, total)} />
          <MiniStat label="Matched + guessed" value={acc ? int.format(attributedRows) : null} hint={pctOf(attributedRows, total)} />
          <MiniStat label="Unmatched project" value={acc ? int.format(unmatchedRows) : null} hint={pctOf(unmatchedRows, total)} />
          <MiniStat label="Unknown" value={acc ? int.format(unknownRows) : null} hint={pctOf(unknownRows, total)} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* 2. Register matches only — the developer comes from the project. */}
          <ChartCard
            title={`Top ${DLD_CHART_TOP_N} — matched through the project`}
            subtitle={`${sources ? `${int.format(known)} of ${int.format(total)} rows (${total ? ((known / total) * 100).toFixed(0) : 0}%). ` : ""}Developer taken from the DLD projects register or FHI's catalogue — not guessed.`}
            table={{ head: ["Developer", "Rows", "AED"], rows: matched.map((b) => [b.label, b.count, int.format(b.value)]) }}
          >
            {!acc ? <Skeleton h={300} /> : <RankChart buckets={matched.slice(0, DLD_CHART_TOP_N)} hasValue labelShare={0.5} />}
          </ChartCard>

          {/* 3. Name guesses only — clearly labelled as such. */}
          <ChartCard
            title={`Top ${DLD_CHART_TOP_N} — guessed by name only`}
            subtitle={`${sources ? `${int.format(guessedRows)} of ${int.format(total)} rows (${total ? ((guessedRows / total) * 100).toFixed(0) : 0}%). ` : ""}No register match for the project, but its first word is a developer the register or catalogue already knows — a GUESS. Treat as indicative only.`}
            table={{ head: ["Developer (guess)", "Rows", "AED"], rows: guessed.map((b) => [b.label, b.count, int.format(b.value)]) }}
          >
            {!acc ? <Skeleton h={300} /> : <RankChart buckets={guessed.slice(0, DLD_CHART_TOP_N)} hasValue labelShare={0.5} />}
          </ChartCard>

          {/* 4. The catalogue to-do list: projects nobody could attribute. */}
          <ChartCard
            title={`Top ${DLD_CHART_TOP_N} projects with no developer on record`}
            subtitle={`${sources ? `${int.format(sources.unmatched ?? 0)} of ${int.format(total)} rows (${total ? (((sources.unmatched ?? 0) / total) * 100).toFixed(0) : 0}%). ` : ""}Not in DLD's register (this year only) nor in FHI's catalogue, and no known developer in the name. Add these to the catalogue with their developer and they move into “matched”.`}
            table={{ head: ["Project", "Rows", "AED"], rows: unmatched.map((b) => [b.label, b.count, int.format(b.value)]) }}
          >
            {!acc ? <Skeleton h={300} /> : <RankChart buckets={unmatched.slice(0, DLD_CHART_TOP_N)} hasValue labelShare={0.5} />}
          </ChartCard>

          <ChartCard
            title="How the developer was found"
            subtitle="“Guessed by name” feeds the guessed card; “project not on record” is the Unmatched project bucket and the list above; “no project on the row” is Unknown."
            table={{ head: ["Source", "Rows", ""], rows: sourceBuckets.map((b) => [b.label, b.count, ""]) }}
          >
            {!acc ? <Skeleton h={160} /> : <ShareBars buckets={sourceBuckets} total={total} />}
          </ChartCard>
        </div>
      </div>
    </section>
  )
}
