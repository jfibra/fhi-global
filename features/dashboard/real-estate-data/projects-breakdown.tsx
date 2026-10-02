"use client"

// Real Estate Data → Projects Breakdown.
//
// Which projects are transacting: every DLD transaction in the range grouped
// by the project DLD names on the row (PROJECT_EN), with the developer each
// project resolved to (lib/dld-developer-lookup.ts) shown alongside — or
// "not on record" when nothing matched. Rows that name no project are
// counted separately ("no project on the row") and never ranked.
//
// Same batch loader as Breakdowns and Developers Breakdown (useBatchJob →
// /api/admin/dld/charts `kind: "breakdown"`, Transactions), its own cache
// key. The form, tiles and list layout mirror the Developers tab so the two
// read as a pair.

import { useMemo, useRef, useState } from "react"
import { ChevronDown, Loader2, Search } from "lucide-react"
import { FilterSelect } from "@/components/ui/filter-select"
import { DLD_CHART_TOP_N, type DldChartBucket } from "@/lib/dld-open-data"
import { ChartCard, CoverageLine, ErrorBox, MiniStat, RefreshButton, Skeleton, longDate, toBuckets, useBatchJob, type BatchJob } from "./market-charts"
import { GROUPS, jobFor, last30Days, pctOf, relabel, textPx, titleCase, useWidth } from "./developers-breakdown"

const int = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat("en-AE", { notation: "compact", maximumFractionDigits: 1 })

const CACHE_KEY = "charts:projects:last"

type ProjectRow = DldChartBucket & {
  /** Display label of the developer this project resolved to, or null when none is on record. */
  developer: string | null
  /** True when that developer was a "(by name)" guess rather than a register/catalogue match. */
  guessed: boolean
}

export function ProjectsBreakdownSection() {
  const [range, setRange] = useState(last30Days)
  const [group, setGroup] = useState("1")
  const [rankBy, setRankBy] = useState<"count" | "value">("count")
  const [submitted, setSubmitted] = useState<BatchJob>(() => jobFor(range, group))
  const job = useBatchJob(CACHE_KEY, submitted, true)
  const { acc, loading } = job

  const byMeasure = (a: DldChartBucket, b: DldChartBucket) => (rankBy === "value" ? b.value - a.value : b.count - a.count) || a.label.localeCompare(b.label)
  const measureWord = rankBy === "value" ? "value" : "count"
  const groupLabel = GROUPS.find((g) => g.value === group)?.label.toLowerCase() ?? "rows"

  const projects = useMemo<ProjectRow[]>(() => {
    if (!acc?.projects) return []
    const devs = acc.projectDevelopers ?? {}
    return toBuckets(acc.projects).map((b) => {
      const raw = devs[b.label]
      return {
        ...relabel(b),
        developer: raw ? titleCase(raw.replace(/ \(by name\)$/, "")) : null,
        guessed: !!raw && raw.endsWith("(by name)"),
      }
    })
  }, [acc])

  const total = acc?.count ?? 0
  const totalValue = acc?.value ?? 0
  const sources = acc?.developerSources ?? null
  const noProjectRows = sources?.unknown ?? 0
  const withProjectRows = total - noProjectRows
  const withDeveloper = projects.filter((p) => p.developer)
  const withDeveloperRows = withDeveloper.reduce((s, p) => s + p.count, 0)
  const withDeveloperValue = withDeveloper.reduce((s, p) => s + p.value, 0)
  const withProjectValue = projects.reduce((s, p) => s + p.value, 0)
  const aed = (v: number) => `AED ${compact.format(v)}`

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
        <h2 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">Projects Breakdown</h2>
        <p className="text-sm text-[#6b7280]">
          Which projects are transacting. Every DLD transaction in the range is grouped by the project DLD names on it, with the developer
          each project resolved to — or a note that none is on record yet. Rows naming no project are counted but not ranked.
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
              <label htmlFor={`prj-${k}`} className="block text-sm font-medium text-[#0d1117] mb-1.5">
                {k === "from" ? "From Date" : "To Date"} <span className="text-rose-600">*</span>
              </label>
              <input
                id={`prj-${k}`}
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
          {acc && total > 0 && (
            <span>
              · {int.format(projects.length)} projects named · value AED {compact.format(totalValue)}
            </span>
          )}
        </CoverageLine>

        <ChartCard
          title={`Top ${DLD_CHART_TOP_N} projects by ${measureWord} — ${groupLabel}`}
          subtitle={`${longDate(submitted.values.P_FROM_DATE ?? "")} – ${longDate(submitted.values.P_TO_DATE ?? "")}. One row per project as DLD names it, ranked by ${rankBy === "value" ? "total AED" : "transaction count"}; open a row for its developer. ${
            acc && total > 0 ? `Covers ${int.format(withProjectRows)} of ${int.format(total)} rows (${((withProjectRows / total) * 100).toFixed(0)}%) — the other ${int.format(noProjectRows)} name no project.` : ""
          }`}
          table={{
            head: ["Project", "Developer", "Rows", "AED"],
            rows: [...projects].sort(byMeasure).map((p) => [p.label, p.developer ? `${p.developer}${p.guessed ? " (by name)" : ""}` : "— not on record", p.count, int.format(p.value)]),
          }}
        >
          {!acc ? <Skeleton h={300} /> : <ProjectRankList rows={[...projects].sort(byMeasure).slice(0, DLD_CHART_TOP_N)} measure={rankBy} totalOf={{ count: total, value: totalValue }} />}
        </ChartCard>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <MiniStat label="Number of transactions" value={acc ? int.format(total) : null} hint={acc ? `${groupLabel} in the range` : undefined} />
          <MiniStat label="Total value (AED)" value={acc ? aed(totalValue) : null} hint={acc && total > 0 ? `${int.format(Math.round(totalValue / total))} AED per transaction` : undefined} />
          <MiniStat label="Projects named" value={acc ? int.format(projects.length) : null} hint={acc ? `${pctOf(withProjectRows, total)} · ${aed(withProjectValue)}` : undefined} />
          <MiniStat label="With a developer on record" value={acc ? int.format(withDeveloper.length) : null} hint={acc ? `${pctOf(withDeveloperRows, total)} · ${aed(withDeveloperValue)}` : undefined} />
          <MiniStat label="No project on the row" value={acc ? int.format(noProjectRows) : null} hint={acc ? `${pctOf(noProjectRows, total)} · ${aed(Math.max(0, totalValue - withProjectValue))}` : undefined} />
        </div>
      </div>
    </section>
  )
}

// ─── Expandable project ranking ──────────────────────────────────────────────
//
// Same row grammar as the Developers tab (name · bar · number · %); opening a
// row shows the developer behind the project and how it was found.

function ProjectRankList({ rows, measure, totalOf }: { rows: ProjectRow[]; measure: "count" | "value"; totalOf: { count: number; value: number } }) {
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
  const numW = Math.ceil(Math.max(0, ...rows.map((r) => textPx(`${fmt(r[measure])} · ${pctOfTotal(r[measure])}`)))) + 4
  const color = measure === "value" ? "#1baf7a" : "#2a78d6"

  return (
    <div ref={hostRef} className="w-full">
      <ul className="divide-y divide-[#f0f2f5]">
        {rows.map((r) => {
          const isOpen = open === r.label
          return (
            <li key={r.label}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : r.label)}
                aria-expanded={isOpen}
                title={`${r.label} · ${int.format(r.count)} rows · AED ${compact.format(r.value)}${r.developer ? ` · ${r.developer}${r.guessed ? " (by name)" : ""}` : " · no developer on record"}`}
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
                <div className="mb-2 rounded-xl border border-[#eef1f5] bg-[#fafbfc] px-3 py-2 text-[11px] text-[#374151]">
                  {r.developer ? (
                    <>
                      Developer: <span className="font-semibold">{r.developer}</span>{" "}
                      <span className={r.guessed ? "text-amber-700" : "text-[#9ca3af]"}>{r.guessed ? "(by name — guessed from the project's first word)" : "(matched — DLD register or FHI catalogue)"}</span>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">No developer on record.</span> Not in DLD&rsquo;s register (this year only) nor in FHI&rsquo;s catalogue, and no known developer in the name — add it to the catalogue with its developer.
                    </>
                  )}
                  <span className="text-[#9ca3af]">
                    {" "}
                    · {int.format(r.count)} rows · AED {compact.format(r.value)}
                  </span>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
