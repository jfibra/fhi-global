import "server-only"

import { runFhiChatTool, type FhiChatChart, type FhiChatStat } from "@/lib/fhi-chat-tools"
import type { DailyReportSection } from "@/lib/daily-report"

/**
 * The weekly and monthly boss reports — the same FHI Assistant tools that
 * power the chat and the daily email, over a whole week or month, with the
 * stat tiles and charts the chat shows rendered into one picture for the
 * email (lib/report-image). Built for the Monday and 1st-of-month crons
 * (app/api/cron/weekly-report, monthly-report) and sent by
 * sendPeriodicReportEmail.
 *
 * Periods are Dubai-time: the Monday email covers the previous Monday to
 * Sunday; the 1st-of-month email covers the previous calendar month.
 */

export type ReportKind = "weekly" | "monthly"

export type PeriodicReport = {
  kind: ReportKind
  /** "Weekly report" / "Monthly report" */
  title: string
  /** "22 – 28 September 2026" / "September 2026" */
  periodLabel: string
  from: string
  /** Exclusive. */
  to: string
  stats: FhiChatStat[]
  charts: FhiChatChart[]
  sections: DailyReportSection[]
  /** Plain sentences for the top of the email, in order of importance. */
  highlights: string[]
}

const dubaiToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" })

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const fmtDay = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AE", { ...opts, timeZone: "UTC" })

/** The period the report covers, ending yesterday (Dubai). */
export function periodFor(kind: ReportKind, today = dubaiToday()): { from: string; to: string; label: string } {
  if (kind === "monthly") {
    const first = `${today.slice(0, 7)}-01`
    const d = new Date(`${first}T00:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() - 1)
    const from = d.toISOString().slice(0, 10)
    return { from, to: first, label: fmtDay(from, { month: "long", year: "numeric" }) }
  }
  // Last full Monday–Sunday week before today.
  const t = new Date(`${today}T00:00:00Z`)
  const dow = (t.getUTCDay() + 6) % 7 // Monday = 0
  const thisMonday = addDays(today, -dow)
  const from = addDays(thisMonday, -7)
  const to = thisMonday
  const last = addDays(to, -1)
  const sameMonth = from.slice(0, 7) === last.slice(0, 7)
  const label = sameMonth
    ? `${fmtDay(from, { day: "numeric" })} – ${fmtDay(last, { day: "numeric", month: "long", year: "numeric" })}`
    : `${fmtDay(from, { day: "numeric", month: "long" })} – ${fmtDay(last, { day: "numeric", month: "long", year: "numeric" })}`
  return { from, to, label }
}

type Json = Record<string, unknown>
const n = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-AE") : typeof v === "string" ? v : "0")
const plural = (count: number, one: string, many: string) => (count === 1 ? one : many)
const parse = (r: { forModel: string }) => JSON.parse(r.forModel) as Json

export async function buildPeriodicReport(kind: ReportKind, today = dubaiToday()): Promise<PeriodicReport> {
  const { from, to, label } = periodFor(kind, today)
  const toInclusive = addDays(to, -1)

  const [sales, agents, developers, accounts, traffic, leads, pipeline] = await Promise.all([
    runFhiChatTool("sales_summary", { from_date: from, to_date: to }),
    runFhiChatTool("top_agents", { from_date: from, to_date: to, limit: 5 }),
    runFhiChatTool("top_developers", { from_date: from, to_date: to, limit: 5 }),
    runFhiChatTool("new_accounts", { from_date: from, to_date: to }),
    // GA ranges are inclusive.
    runFhiChatTool("website_traffic", { from_date: from, to_date: toInclusive }),
    runFhiChatTool("leads_overview", { from_date: from, to_date: to, limit: 5 }),
    runFhiChatTool("sales_pipeline", { quiet_from_date: from, quiet_to_date: to, limit: 5 }),
  ])
  const S = parse(sales)
  const A = parse(agents)
  const D = parse(developers)
  const N = parse(accounts)
  const T = parse(traffic)
  const L = parse(leads)
  const P = parse(pipeline)

  // Tiles: the eight the boss asks about first, in that order.
  const pick = (from_: FhiChatStat[], label_: string) => from_.find((s) => s.label === label_)
  const stats = [
    pick(sales.stats, "Validated deals"),
    pick(sales.stats, "Validated value"),
    pick(leads.stats, "Leads"),
    pick(accounts.stats, "New accounts"),
    pick(traffic.stats, "Visitors"),
    pick(traffic.stats, "Page views"),
    pick(pipeline.stats, "Awaiting validation"),
    pick(pipeline.stats, "Quiet agents"),
  ].filter((s): s is FhiChatStat => Boolean(s))

  // Charts: at most four, the ones that read well on paper.
  const want = ["Validated sales by month", "Sales value by agent", "Leads by source", "New accounts by role", "Visitors by day", "Visitors by week", "Sales value by developer"]
  const all = [...sales.charts, ...agents.charts, ...leads.charts, ...accounts.charts, ...traffic.charts, ...developers.charts]
  const charts: FhiChatChart[] = []
  for (const title of want) {
    const c = all.find((x) => x.title === title)
    if (c && !charts.some((x) => x.title === c.title)) charts.push(c)
    if (charts.length >= 4) break
  }

  const sections: DailyReportSection[] = []
  const bucket = (k: string) => (S[k] as { count?: number; total?: string } | undefined) ?? {}
  const change = (S.change_vs_previous as Record<string, string> | undefined) ?? {}
  const vs = (c: string | undefined) => (c && !c.includes("both periods 0") ? ` (${c} vs the ${kind === "weekly" ? "week" : "month"} before)` : "")
  sections.push({
    title: "Sales",
    rows: [
      { label: "Validated", value: `${n(bucket("validated").count ?? 0)} ${plural(Number(bucket("validated").count ?? 0), "deal", "deals")} · ${bucket("validated").total ?? "AED 0"}${vs(change.validated_value)}` },
      { label: "Pending", value: `${n(bucket("pending").count ?? 0)} ${plural(Number(bucket("pending").count ?? 0), "deal", "deals")} · ${bucket("pending").total ?? "AED 0"}` },
      ...(Number(bucket("rejected").count ?? 0) ? [{ label: "Rejected", value: n(bucket("rejected").count) }] : []),
    ],
  })

  const leaders = ((A.leaders as Array<{ rank?: number; agent?: string; deals?: number; total?: string }> | undefined) ?? []).filter((l) => l.agent)
  if (leaders.length) {
    sections.push({ title: "Top agents", rows: leaders.map((l) => ({ label: `${l.rank ?? "-"}. ${l.agent}`, value: `${n(l.deals)} ${plural(l.deals ?? 0, "deal", "deals")} · ${l.total ?? "AED 0"}` })) })
  }
  const devLeaders = ((D.leaders as Array<{ rank?: number; developer?: string; deals?: number; total?: string }> | undefined) ?? []).filter((l) => l.developer)
  if (devLeaders.length) {
    sections.push({ title: "Top developers", rows: devLeaders.slice(0, 3).map((l) => ({ label: `${l.rank ?? "-"}. ${l.developer}`, value: `${n(l.deals)} ${plural(l.deals ?? 0, "deal", "deals")} · ${l.total ?? "AED 0"}` })) })
  }

  const topRecruiter = (N.top_recruiters_in_period as Array<{ name?: string; recruits?: number }> | undefined)?.[0]
  sections.push({
    title: "New accounts",
    rows: [
      { label: "Sign-ups", value: `${n(N.new_accounts_total)} (${n(N.recruited_count)} recruited, ${n(N.organic_count)} direct)${vs((N.change_vs_previous as Record<string, string> | undefined)?.signups)}` },
      ...(topRecruiter?.name ? [{ label: "Top recruiter", value: `${topRecruiter.name} (${n(topRecruiter.recruits)} ${plural(topRecruiter.recruits ?? 0, "recruit", "recruits")})` }] : []),
    ],
  })

  const allSources = (L.all_sources as { total_leads?: number; waiting_for_a_reply?: number; change_vs_previous?: string } | undefined) ?? {}
  const src = (k: string) => ((L[k] as { total?: number } | undefined)?.total ?? 0)
  sections.push({
    title: "Leads",
    rows: [
      { label: "Total", value: `${n(allSources.total_leads ?? 0)}${vs(allSources.change_vs_previous)}` },
      { label: "By source", value: `${n(src("project_inquiries"))} inquiries · ${n(src("contact_messages"))} contact messages · ${n(src("buyers_link_briefs"))} Buyers Link briefs · ${n(src("inbox_replies"))} inbox replies` },
      { label: "Waiting for a reply", value: n(allSources.waiting_for_a_reply ?? 0) },
    ],
  })

  if (!T.error) {
    const topSource = (T.traffic_by_exact_source as Array<{ source?: string; sessions?: number }> | undefined)?.[0]
    const topCountry = (T.visitors_by_country as Array<{ country?: string; visitors?: number }> | undefined)?.[0]
    const tChange = (T.change_vs_previous as Record<string, string> | undefined) ?? {}
    sections.push({
      title: "Website",
      rows: [
        { label: "Visitors", value: `${n(T.visitors)}${vs(tChange.visitors)}` },
        { label: "Page views", value: `${n(T.page_views)} across ${n(T.sessions)} sessions` },
        { label: "Engagement", value: `${T.avg_session_duration ?? "-"} average visit · ${T.engagement_rate_percent ?? 0}% engaged` },
        ...(topSource?.source ? [{ label: "Top source", value: `${topSource.source === "direct" ? "Direct" : topSource.source} (${n(topSource.sessions)} sessions)` }] : []),
        ...(topCountry?.country ? [{ label: "Top country", value: `${topCountry.country} (${n(topCountry.visitors)} visitors)` }] : []),
      ],
    })
  }

  const awaiting = (P.awaiting_validation as { count?: number; stale_count?: number } | undefined) ?? {}
  const quiet = (P.quiet_agents as { quiet?: number; selling_accounts_active?: number; sold_in_period?: number } | undefined) ?? {}
  const commissions = (P.commissions as { by_status?: Array<{ status?: string; count?: number }> } | undefined)?.by_status ?? []
  sections.push({
    title: "Pipeline",
    rows: [
      { label: "Awaiting validation", value: `${n(awaiting.count ?? 0)}${awaiting.stale_count ? ` (${n(awaiting.stale_count)} older than a week)` : ""}` },
      { label: "Commissions", value: commissions.length ? commissions.map((c) => `${n(c.count)} ${c.status}`).join(" · ") : "—" },
      { label: "Agents who sold", value: `${n(quiet.sold_in_period ?? 0)} of ${n(quiet.selling_accounts_active ?? 0)} selling accounts · ${n(quiet.quiet ?? 0)} quiet` },
    ],
  })

  // Highlights — the sentences a busy reader stops at.
  const highlights: string[] = []
  const vCount = Number(bucket("validated").count ?? 0)
  highlights.push(
    vCount
      ? `${n(vCount)} validated ${plural(vCount, "deal", "deals")} worth ${bucket("validated").total ?? "AED 0"}${vs(change.validated_value)}.`
      : `No validated sales in the period${bucket("pending").count ? ` — ${n(bucket("pending").count)} waiting for validation` : ""}.`,
  )
  if (leaders[0]?.agent) highlights.push(`Top agent: ${leaders[0].agent} with ${n(leaders[0].deals)} ${plural(leaders[0].deals ?? 0, "deal", "deals")} (${leaders[0].total ?? "AED 0"}).`)
  highlights.push(`${n(allSources.total_leads ?? 0)} leads came in${vs(allSources.change_vs_previous)}; ${n(allSources.waiting_for_a_reply ?? 0)} still wait for a reply.`)
  highlights.push(`${n(N.new_accounts_total)} new accounts (${n(N.recruited_count)} recruited)${vs((N.change_vs_previous as Record<string, string> | undefined)?.signups)}.`)
  if (!T.error) highlights.push(`${n(T.visitors)} website visitors${vs(((T.change_vs_previous as Record<string, string> | undefined) ?? {}).visitors)}.`)
  if (awaiting.count) highlights.push(`${n(awaiting.count)} ${plural(Number(awaiting.count), "sale waits", "sales wait")} for validation.`)

  return {
    kind,
    title: kind === "weekly" ? "Weekly report" : "Monthly report",
    periodLabel: label,
    from,
    to,
    stats,
    charts,
    sections,
    highlights,
  }
}
