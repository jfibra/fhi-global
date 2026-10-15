"use client"

/**
 * The company report drawn in the FHI Assistant chat (boss via Juliecor,
 * 2026-10-15: "that's the format in chat") — the same figures and sections as
 * the PDF (app/api/admin/reports/company, lib/company-report): a navy header
 * with Download PDF, the KPI tiles, the takeaways, sales by day, then teams &
 * leader networks, sales, pipeline, recruitment, leads & website, and the
 * recommendations. Tables scroll sideways on a phone; nothing is fetched here.
 */

import { useState } from "react"
import { FileDown, Loader2 } from "lucide-react"
import type { Bar, CompanyReport, ReportPeriodKey, Share } from "@/lib/company-report/data"
import type { Insights } from "@/lib/company-report/insights"
import { PieChart, StatTiles } from "./charts"
import { downloadReportPdf } from "./pdf-report-menu"

export type ChatReport = { period: ReportPeriodKey; data: CompanyReport; insights: Insights }

const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-AE")}`
const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n)))
const int = (n: number) => Math.round(n).toLocaleString("en-AE")
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AE", { day: "numeric", month: "short", timeZone: "UTC" })

/** Plain-text version of the report for Copy and for the chat history the model sees on a follow-up. */
export function reportSummaryText({ data: r, insights }: ChatReport): string {
  const lines = [
    `COMPANY REPORT — ${r.period.kind} (${r.period.label})`,
    "",
    ...r.kpis.map((k) => `- ${k.label}: ${k.value}${k.change ? ` (${k.change} vs ${r.period.versus})` : ""}`),
    "",
    "AT A GLANCE",
    ...insights.takeaways.map((t) => `- ${t}`),
    "",
    "RECOMMENDATIONS",
    ...insights.recommendations.map((x, i) => `- ${i + 1}. ${x.title}: ${x.action} (owner: ${x.owner})`),
  ]
  return lines.join("\n")
}

function Chip({ change }: { change: string | null }) {
  if (!change) return <span className="text-[#c5ccd6]">—</span>
  const down = change.startsWith("-")
  return <span className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums ${down ? "bg-[#fdecec] text-[#b91c1c]" : "bg-[#e8f5ec] text-[#15803d]"}`}>{change === "new" ? "new" : `${down ? "▼" : "▲"} ${change.replace(/^[+-]/, "")}`}</span>
}

function Section({ n, title, subtitle, children }: { n: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[#eef0f3] px-4 py-5 sm:px-5">
      <div className="mb-4 flex items-end gap-3 border-b-2 border-[#001f3f] pb-2">
        <span className="font-['Outfit'] text-[26px] font-bold leading-none text-[#d6b357]">{n}</span>
        <div className="min-w-0">
          <h3 className="font-['Outfit'] text-[17px] font-bold leading-tight text-[#001f3f]">{title}</h3>
          <p className="text-[12px] text-[#6b7280]">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
const Sub = ({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) => (
  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
    <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#9ca3af]">{children}</p>
    {right && <p className="text-[11px] text-[#9ca3af]">{right}</p>}
  </div>
)
const Empty = ({ children }: { children: React.ReactNode }) => <p className="rounded-lg bg-[#f6f7f9] px-3 py-2.5 text-[12.5px] text-[#6b7280]">{children}</p>
const Box = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <div className={`min-w-0 rounded-xl border border-[#eceef1] p-3.5 ${className}`}>{children}</div>

function MiniStats({ items }: { items: Array<{ label: string; value: string; hint?: string | null; change?: string | null }> }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="rounded-lg bg-[#f6f7f9] px-3 py-2.5">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">{it.label}</p>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
            <span className="font-['Outfit'] text-[17px] font-bold text-[#001f3f]">{it.value}</span>
            {it.change && <Chip change={it.change} />}
          </div>
          {it.hint && <p className="truncate text-[11px] text-[#6b7280]">{it.hint}</p>}
        </div>
      ))}
    </div>
  )
}

/** Day bars: the period navy, the best day gold, context days pale. */
function DayBars({ bars, format = short }: { bars: Bar[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...bars.map((b) => b.value))
  const peak = bars.reduce((best, b, i) => (b.inPeriod !== false && b.value > (best < 0 ? 0 : bars[best].value) ? i : best), -1)
  const every = Math.ceil(bars.length / 8)
  return (
    <div>
      <div className="flex h-[110px] items-end gap-[2px] border-b border-[#e5e8ec] sm:gap-[3px]">
        {bars.map((b, i) => (
          <div key={i} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${day(b.label)}: ${format(b.value)}`}>
            <div className={`w-full rounded-t-[2px] ${i === peak ? "bg-[#d6b357]" : b.inPeriod === false ? "bg-[#d5dbe3]" : "bg-[#001f3f]"}`} style={{ height: b.value > 0 ? `${Math.max(3, (100 * b.value) / max)}%` : "1px" }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px] sm:gap-[3px]">
        {bars.map((b, i) => (
          <span key={i} className={`min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-[9.5px] ${b.inPeriod === false ? "text-[#c5ccd6]" : "text-[#6b7280]"}`}>{i % every === 0 ? day(b.label) : ""}</span>
        ))}
      </div>
      {peak >= 0 && bars[peak].value > 0 && <p className="mt-1.5 text-[11px] text-[#b8913f]">Best day {day(bars[peak].label)}: {format(bars[peak].value)}</p>}
    </div>
  )
}

function HBars({ rows, format = int }: { rows: Share[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
            <span className="min-w-0 truncate text-[#111827]">{r.label}</span>
            <span className="shrink-0 font-['Outfit'] font-bold tabular-nums text-[#001f3f]">{r.display ?? format(r.value)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-[#eef0f3]"><div className={`h-full rounded-full ${i === 0 ? "bg-[#d6b357]" : "bg-[#001f3f]"}`} style={{ width: `${Math.max(2, (100 * r.value) / max)}%` }} /></div>
        </div>
      ))}
    </div>
  )
}

function Line({ points }: { points: Bar[] }) {
  if (points.length < 2) return <Empty>Not enough days to draw a trend.</Empty>
  const W = 300
  const H = 90
  const max = Math.max(1, ...points.map((p) => p.value))
  const x = (i: number) => (i / (points.length - 1)) * (W - 8) + 4
  const y = (v: number) => H - 6 - (v / max) * (H - 16)
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ")
  const peak = points.reduce((b, p, i) => (p.value > points[b].value ? i : b), 0)
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[90px] w-full" preserveAspectRatio="none" aria-hidden="true">
        <path d={`${line} L${x(points.length - 1)} ${H - 6} L${x(0)} ${H - 6} Z`} fill="#e8eef6" />
        <path d={line} stroke="#001f3f" strokeWidth={1.8} fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-[10.5px] text-[#9ca3af]">
        <span>{day(points[0].label)}</span>
        <span className="text-[#b8913f]">Peak {day(points[peak].label)}: {int(points[peak].value)}</span>
        <span>{day(points[points.length - 1].label)}</span>
      </div>
    </div>
  )
}

/** A donut when there is a split to show; one status reads as a sentence with a full ring. */
function Split({ title, rows }: { title: string; rows: Share[] }) {
  const live = rows.filter((r) => r.value > 0)
  if (live.length >= 2) return <PieChart title={title} rows={live} />
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">{title}</p>
      {live.length === 1 ? (
        <div className="flex items-center gap-4">
          <span className="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-full border-[14px] border-[#001f3f] font-['Outfit'] text-[15px] font-bold text-[#0d1117]">{int(live[0].value)}</span>
          <p className="text-[13px] text-[#374151]">All <b className="text-[#0d1117]">{int(live[0].value)}</b> are <b className="text-[#0d1117]">{live[0].label.toLowerCase()}</b>.</p>
        </div>
      ) : (
        <Empty>Nothing to show for this period.</Empty>
      )}
    </div>
  )
}

const th = "px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]"
const td = "px-3 py-2 text-[12.5px] text-[#374151]"

export default function ReportCard({ report, pdfEndpoint }: { report: ChatReport; pdfEndpoint: string }) {
  const { data: r, insights } = report
  const S = r.sales
  const P = r.pipeline
  const W = r.website
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const maxNet = Math.max(1, ...r.teams.networks.map((n) => n.network))

  const download = async () => {
    setBusy(true)
    setError(null)
    try {
      await downloadReportPdf(pdfEndpoint, report.period)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't build the PDF.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="relative overflow-hidden bg-[#001f3f] px-4 py-5 text-white sm:px-5">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full border border-[#d6b357]/25" aria-hidden="true" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.24em] text-[#f0d89b]"><span className="h-px w-6 bg-[#d6b357]" />{r.period.kind}</p>
            <p className="mt-1 font-['Outfit'] text-[22px] font-bold leading-tight">Company performance</p>
            <p className="font-['Outfit'] text-[15px] font-semibold text-[#f0d89b]">{r.period.label}</p>
            <p className="mt-1 text-[11px] text-white/55">Changes compare with {r.period.versus} · generated {r.generatedAt}</p>
          </div>
          <button type="button" onClick={() => void download()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-[#d6b357] px-3.5 py-2 text-[12px] font-bold text-[#001f3f] transition-colors hover:bg-[#c9a449] disabled:opacity-60">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />} {busy ? "Preparing PDF…" : "Download PDF"}
          </button>
        </div>
        {error && <p className="relative mt-2 text-[12px] text-rose-200">{error}</p>}
      </div>

      {/* Headline */}
      <div className="space-y-4 px-4 py-5 sm:px-5">
        <StatTiles stats={r.kpis} />
        <div className="rounded-xl border-l-[3px] border-[#d6b357] bg-[#f4f6fa] px-4 py-3">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#b8913f]">At a glance</p>
          <ol className="mt-2 space-y-1.5">
            {insights.takeaways.map((t, i) => (
              <li key={i} className="flex gap-2.5 text-[13.5px] leading-snug text-[#0d1117]"><span className="font-['Outfit'] font-bold text-[#b8913f]">{i + 1}</span>{t}</li>
            ))}
          </ol>
        </div>
        <Box>
          <Sub right={S.byDay.some((b) => b.inPeriod === false) ? "navy: this period · grey: days before" : undefined}>Validated sales by day (AED)</Sub>
          {S.byDay.some((b) => b.value > 0) ? <DayBars bars={S.byDay} /> : <Empty>No validated sales in these days.</Empty>}
        </Box>
      </div>

      <Section n="01" title="Teams & leaders" subtitle="Each team and each leader's network — validated sales, credited per share.">
        {r.teams.formal.length > 0 && (
          <div>
            <Sub>Formal teams</Sub>
            <div className="overflow-x-auto rounded-xl border border-[#eceef1]">
              <table className="w-full min-w-[560px]">
                <thead className="bg-[#f6f7f9]"><tr><th className={th}>Team</th><th className={`${th} text-right`}>Members</th><th className={`${th} text-right`}>Ever sold</th><th className={`${th} text-right`}>This period</th><th className={`${th} text-right`}>All time</th></tr></thead>
                <tbody>
                  {r.teams.formal.map((t) => (
                    <tr key={t.name} className="border-t border-[#f0f2f5]">
                      <td className={td}><p className="font-semibold text-[#0d1117]">{t.name}</p><p className="text-[11px] text-[#6b7280]">Led by {t.leaders || "—"}</p></td>
                      <td className={`${td} text-right tabular-nums`}>{int(t.members)} <span className="text-[#9ca3af]">· {int(t.active)} active</span></td>
                      <td className={`${td} text-right tabular-nums`}>{t.soldAllTime} ({t.members ? Math.round((100 * t.soldAllTime) / t.members) : 0}%)</td>
                      <td className={`${td} text-right font-semibold tabular-nums text-[#001f3f]`}>{t.dealsPeriod ? `${t.dealsPeriod} · ${aed(t.valuePeriod)}` : "—"}</td>
                      <td className={`${td} text-right tabular-nums`}>{t.dealsAllTime} · AED {short(t.valueAllTime)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div>
          <Sub right="a network includes the networks under it">Biggest leader networks</Sub>
          {r.teams.networks.length ? (
            <div className="overflow-x-auto rounded-xl border border-[#eceef1]">
              <table className="w-full min-w-[620px]">
                <thead className="bg-[#f6f7f9]"><tr><th className={th}>#</th><th className={th}>Leader</th><th className={th}>Network</th><th className={`${th} text-right`}>Joined</th><th className={`${th} text-right`}>Sold</th><th className={`${th} text-right`}>Network sales</th></tr></thead>
                <tbody>
                  {r.teams.networks.map((n, i) => (
                    <tr key={n.name} className="border-t border-[#f0f2f5]">
                      <td className={`${td} font-['Outfit'] font-bold ${i === 0 ? "text-[#b8913f]" : "text-[#c5ccd6]"}`}>{i + 1}</td>
                      <td className={td}><p className="font-semibold text-[#0d1117]">{n.name}</p><p className="text-[11px] text-[#6b7280]">{n.direct} direct recruits</p></td>
                      <td className={`${td} w-[160px]`}><p className="tabular-nums">{int(n.network)} people</p><div className="mt-1 h-1.5 rounded-full bg-[#eef0f3]"><div className="h-full rounded-full bg-[#001f3f]" style={{ width: `${Math.max(2, (100 * n.network) / maxNet)}%` }} /></div></td>
                      <td className={`${td} text-right tabular-nums`}>{n.joined ? `+${n.joined}` : "—"}</td>
                      <td className={`${td} text-right tabular-nums`}>{n.sellers} of {n.active}</td>
                      <td className={`${td} text-right font-semibold tabular-nums ${n.value ? "text-[#001f3f]" : "text-[#c5ccd6]"}`}>{n.value ? `${aed(n.value)} · ${n.deals}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No recruiter networks yet.</Empty>
          )}
        </div>
        {r.teams.noTeam.count > 0 && (
          <p className="rounded-lg border-l-[3px] border-[#d6b357] bg-[#fffaf0] px-3 py-2.5 text-[12.5px] text-[#0d1117]">
            <b>{int(r.teams.noTeam.count)} selling accounts are in no team</b> — {r.teams.noTeam.byRole.map((b) => `${b.value} ${b.label.toLowerCase()}${b.value === 1 ? "" : "s"}`).join(", ")}. Nobody coaches them and their sales don&rsquo;t roll up to a leader.
          </p>
        )}
      </Section>

      <Section n="02" title="Sales" subtitle={`Validated sales in the period, compared with ${r.period.versus}.`}>
        <MiniStats
          items={[
            { label: "Validated value", value: `AED ${short(S.validated.value)}`, change: r.kpis[0]?.change ?? null, hint: `vs AED ${short(S.previous.value)}` },
            { label: "Validated deals", value: String(S.validated.deals), change: r.kpis[1]?.change ?? null, hint: `vs ${S.previous.deals}` },
            { label: "Pending", value: String(S.pending.deals), hint: S.pending.deals ? `AED ${short(S.pending.value)}` : "nothing waiting" },
            { label: "All time", value: `AED ${short(S.allTime.value)}`, hint: `${S.allTime.deals} validated deals` },
          ]}
        />
        <div>
          <Sub>Top agents</Sub>
          {S.topAgents.length ? (
            <div className="overflow-x-auto rounded-xl border border-[#eceef1]">
              <table className="w-full min-w-[480px]">
                <thead className="bg-[#f6f7f9]"><tr><th className={th}>#</th><th className={th}>Agent</th><th className={`${th} text-right`}>Deals</th><th className={th}>Share</th><th className={`${th} text-right`}>Value</th></tr></thead>
                <tbody>
                  {S.topAgents.map((a, i) => (
                    <tr key={a.name} className="border-t border-[#f0f2f5]">
                      <td className={`${td} font-['Outfit'] font-bold ${i === 0 ? "text-[#b8913f]" : "text-[#c5ccd6]"}`}>{i + 1}</td>
                      <td className={`${td} font-semibold text-[#0d1117]`}>{a.name}</td>
                      <td className={`${td} text-right tabular-nums`}>{a.deals}</td>
                      <td className={`${td} w-[140px]`}><div className="flex items-center gap-2"><div className="h-1.5 flex-1 rounded-full bg-[#eef0f3]"><div className="h-full rounded-full bg-[#d6b357]" style={{ width: `${Math.max(2, a.share * 100)}%` }} /></div><span className="w-9 text-right text-[11px] text-[#6b7280]">{Math.round(a.share * 100)}%</span></div></td>
                      <td className={`${td} text-right font-semibold tabular-nums text-[#001f3f]`}>{aed(a.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No validated sales in this period.</Empty>
          )}
        </div>
        {(S.topDevelopers.length > 0 || S.topProjects.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Box><Sub>Top developers</Sub><HBars rows={S.topDevelopers.map((d) => ({ label: `${d.name} · ${d.deals} deal${d.deals === 1 ? "" : "s"}`, value: d.value, display: `AED ${short(d.value)}` }))} /></Box>
            <Box><Sub>Top projects</Sub><HBars rows={S.topProjects.map((p) => ({ label: `${p.name} · ${p.deals} deal${p.deals === 1 ? "" : "s"}`, value: p.value, display: `AED ${short(p.value)}` }))} /></Box>
          </div>
        )}
      </Section>

      <Section n="03" title="Pipeline & activity" subtitle="Validation, commission status and who is selling — as of today.">
        <MiniStats
          items={[
            { label: "Awaiting validation", value: String(P.awaiting), hint: P.awaiting ? `AED ${short(P.awaitingValue)}` : "all clear" },
            { label: `Waiting > ${P.staleDays} days`, value: String(P.stale) },
            { label: "Days to validate", value: P.validationDays === null ? "—" : String(P.validationDays), hint: "average" },
            { label: "Sold this period", value: `${P.soldInPeriod} / ${P.sellingActive}`, hint: `${P.neverSold} have never sold` },
          ]}
        />
        {P.oldest.length > 0 && (
          <div>
            <Sub>Waiting for validation — chase these first</Sub>
            <ul className="divide-y divide-[#f0f2f5] rounded-xl border border-[#eceef1]">
              {P.oldest.map((o, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px]"><span className="min-w-0 truncate"><b className="text-[#0d1117]">{o.agent}</b> · {o.project}</span><span className="shrink-0 tabular-nums">{aed(o.value)} · <b className={o.days > P.staleDays ? "text-[#b91c1c]" : ""}>{o.days} days</b></span></li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Box><Sub>Quiet selling accounts by role</Sub>{P.quietByRole.length ? <HBars rows={P.quietByRole} /> : <Empty>Everyone sold this period.</Empty>}</Box>
          <Box><Split title="Commission status (validated sales)" rows={P.commissions} /></Box>
        </div>
      </Section>

      <Section n="04" title="Recruitment" subtitle={`New accounts in the period, compared with ${r.period.versus}.`}>
        <MiniStats
          items={[
            { label: "New accounts", value: int(r.recruitment.total), change: r.recruitment.change, hint: `vs ${r.recruitment.previous}` },
            { label: "Recruited", value: int(r.recruitment.recruited), hint: "under someone" },
            { label: "Direct sign-ups", value: int(r.recruitment.direct), hint: "from the website" },
            { label: "Waiting approval", value: int(r.recruitment.waiting), hint: "status pending" },
          ]}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Box><Split title="New accounts by role" rows={r.recruitment.byRole} /></Box>
          <Box><Sub>Top recruiters this period</Sub>{r.recruitment.topRecruiters.length ? <HBars rows={r.recruitment.topRecruiters.map((t) => ({ label: t.name, value: t.recruits }))} /> : <Empty>No recruits this period.</Empty>}</Box>
        </div>
        <Box><Sub right="navy: this period · grey: days before">Sign-ups by day</Sub><DayBars bars={r.recruitment.byDay} format={int} /></Box>
      </Section>

      <Section n="05" title="Leads & website" subtitle="Every way a prospect reached FHI, and who visited fhiglobal.ae.">
        <div className="overflow-x-auto rounded-xl border border-[#eceef1]">
          <table className="w-full min-w-[420px]">
            <thead className="bg-[#f6f7f9]"><tr><th className={th}>Source</th><th className={`${th} text-right`}>This period</th><th className={`${th} text-right`}>Before</th><th className={`${th} text-right`}>Change</th></tr></thead>
            <tbody>
              {[...r.leads.sources, { label: "All leads", total: r.leads.total, previous: r.leads.previous, change: r.leads.change }].map((l) => (
                <tr key={l.label} className={`border-t border-[#f0f2f5] ${l.label === "All leads" ? "bg-[#fafbfc] font-semibold" : ""}`}>
                  <td className={`${td} ${l.label === "All leads" ? "text-[#0d1117]" : ""}`}>{l.label}</td>
                  <td className={`${td} text-right font-semibold tabular-nums text-[#001f3f]`}>{int(l.total)}</td>
                  <td className={`${td} text-right tabular-nums`}>{int(l.previous)}</td>
                  <td className={`${td} text-right`}><Chip change={l.change} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-[#6b7280]">{r.leads.unanswered ? `${r.leads.unanswered} still waiting for a reply. ` : "Nothing waiting for a reply. "}Website buttons: {int(r.leads.whatsappClicks)} WhatsApp clicks, {int(r.leads.inquiriesSubmitted)} inquiry forms submitted.</p>
        {W ? (
          <>
            <MiniStats
              items={[
                { label: "Visitors", value: int(W.visitors), change: W.change, hint: `vs ${int(W.previous)}` },
                { label: "Sessions", value: int(W.sessions) },
                { label: "Page views", value: int(W.pageViews) },
                { label: "Time on site", value: W.avgTime ?? "—", hint: W.engagement !== null ? `${W.engagement}% engaged` : null },
              ]}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Box><Sub right={W.trend ?? undefined}>Visitors by day</Sub><Line points={W.byDay} /></Box>
              <Box><Sub>Traffic sources (sessions)</Sub><HBars rows={W.sources} /></Box>
              <Box><Split title="Devices" rows={W.devices} /></Box>
              <Box>
                <Sub>Most viewed pages</Sub>
                <ol className="space-y-1">
                  {W.topPages.map((p, i) => (
                    <li key={p.path} className="flex gap-2 text-[12px]"><span className="w-4 text-[#9ca3af]">{i + 1}</span><span className="min-w-0 flex-1 truncate text-[#111827]" title={p.path}>{p.path}</span><b className="tabular-nums text-[#001f3f]">{int(p.views)}</b></li>
                  ))}
                </ol>
              </Box>
            </div>
          </>
        ) : (
          <Empty>Website analytics were not available when this report was generated.</Empty>
        )}
      </Section>

      <Section n="06" title="Recommendations" subtitle="What to do in the next two weeks to make the company more productive.">
        {insights.recommendations.map((rec, i) => (
          <div key={i} className="flex gap-3 rounded-xl border border-[#e8eaed] p-3.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#001f3f] font-['Outfit'] text-[13px] font-bold text-[#f0d89b]">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-['Outfit'] text-[15px] font-bold text-[#001f3f]">{rec.title}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${rec.impact === "High" ? "bg-[#001f3f] text-white" : rec.impact === "Quick win" ? "bg-[#fdf3d8] text-[#8a6d2b]" : "bg-[#eef1f5] text-[#001f3f]"}`}>{rec.impact}</span>
              </div>
              <p className="mt-1.5 text-[13px] text-[#374151]"><span className="mr-1.5 text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">What we see</span>{rec.finding}</p>
              <p className="mt-1 text-[13px] font-semibold text-[#0d1117]"><span className="mr-1.5 text-[10px] font-bold uppercase tracking-wide text-[#b8913f]">What to do</span>{rec.action}</p>
              <p className="mt-1 text-[11.5px] text-[#6b7280]">Owner: {rec.owner}</p>
            </div>
          </div>
        ))}
        <p className="text-[11px] text-[#9ca3af]">{insights.source === "ai" ? "Recommendations are drafted by FHI Assistant from the figures in this report only — review them before acting." : "Recommendations are generated from the figures in this report by fixed rules."}</p>
      </Section>
    </div>
  )
}
