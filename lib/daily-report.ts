import "server-only"

import { runFhiChatTool } from "@/lib/fhi-chat-tools"

/**
 * The daily boss report — assembled from the same FHI Assistant tools that
 * power the chat (sales, accounts, traffic, activity feed), so every number
 * matches what the dashboard and the assistant say. Built for the 8AM cron
 * (app/api/cron/daily-report) and rendered by sendDailyReportEmail.
 *
 * "Yesterday" is a Dubai-time day: the report sent on the morning of the 2nd
 * covers the 1st, plus month-to-date context.
 */

export type DailyReportRow = { label: string; value: string }
export type DailyReportSection = { title: string; rows: DailyReportRow[] }
export type DailyReport = {
  /** e.g. "Monday, 1 September 2026" — the day the report covers. */
  dateLabel: string
  sections: DailyReportSection[]
  /** "What happened" lines from the activity feed, newest first. */
  activity: string[]
}

const dubaiToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" })

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function labelFor(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })
}

// The tool results cross a JSON boundary — narrow, permissive shapes.
type Bucket = { count?: number; total?: string }
type SalesJson = {
  validated?: Bucket
  pending?: Bucket
  change_vs_previous?: { validated_deals?: string; validated_value?: string }
}
type AccountsJson = {
  new_accounts_total?: number
  recruited_count?: number
  organic_count?: number
  change_vs_previous?: { signups?: string }
  top_recruiters_in_period?: Array<{ name?: string; recruits?: number }>
}
type TrafficJson = {
  error?: string
  visitors?: number
  sessions?: number
  page_views?: number
  new_visitors?: number
  avg_session_duration?: string
  engagement_rate_percent?: number
  change_vs_previous?: { visitors?: string }
  traffic_by_exact_source?: Array<{ source?: string; sessions?: number }>
  visitors_by_country?: Array<{ country?: string; visitors?: number }>
  visitors_by_device?: Array<{ device?: string; visitors?: number; percent?: number }>
  lead_clicks?: { whatsapp?: number; phone?: number; email?: number; inquiries_submitted?: number }
}
type FeedJson = { activity?: Array<{ at?: string; happened?: string }> }
type LeadersJson = { leaders?: Array<{ rank?: number; agent?: string; deals?: number; total?: string }> }

const n = (v: number | undefined) => (v ?? 0).toLocaleString("en-AE")
const plural = (c: number, one: string, many: string) => (c === 1 ? one : many)

export async function buildDailyReport(): Promise<DailyReport> {
  const today = dubaiToday()
  const yday = addDays(today, -1)
  const monthStart = `${today.slice(0, 7)}-01`

  const [salesRes, accountsRes, trafficRes, feedRes, mtdSalesRes, mtdAgentsRes] = await Promise.all([
    runFhiChatTool("sales_summary", { from_date: yday, to_date: today }),
    runFhiChatTool("new_accounts", { from_date: yday, to_date: today }),
    // GA date ranges are inclusive — [yday, yday] is exactly yesterday.
    runFhiChatTool("website_traffic", { from_date: yday, to_date: yday }),
    runFhiChatTool("activity_feed", { from_date: yday, to_date: today }),
    runFhiChatTool("sales_summary", { from_date: monthStart, to_date: addDays(today, 1) }),
    runFhiChatTool("top_agents", { from_date: monthStart, to_date: addDays(today, 1), limit: 3 }),
  ])
  const sales = JSON.parse(salesRes.forModel) as SalesJson
  const accounts = JSON.parse(accountsRes.forModel) as AccountsJson
  const traffic = JSON.parse(trafficRes.forModel) as TrafficJson
  const feed = JSON.parse(feedRes.forModel) as FeedJson
  const mtdSales = JSON.parse(mtdSalesRes.forModel) as SalesJson
  const mtdAgents = JSON.parse(mtdAgentsRes.forModel) as LeadersJson

  const delta = (s: string | undefined) => (s && !s.includes("both periods 0") ? ` (${s} vs the day before)` : "")

  const sections: DailyReportSection[] = []

  sections.push({
    title: "Sales",
    rows: [
      {
        label: "Validated",
        value: `${n(sales.validated?.count)} ${plural(sales.validated?.count ?? 0, "deal", "deals")} · ${sales.validated?.total ?? "AED 0"}${delta(sales.change_vs_previous?.validated_deals)}`,
      },
      { label: "Pending", value: `${n(sales.pending?.count)} ${plural(sales.pending?.count ?? 0, "deal", "deals")} · ${sales.pending?.total ?? "AED 0"}` },
    ],
  })

  const topRecruiter = accounts.top_recruiters_in_period?.[0]
  sections.push({
    title: "New accounts",
    rows: [
      {
        label: "Signups",
        value: `${n(accounts.new_accounts_total)} (${n(accounts.recruited_count)} recruited, ${n(accounts.organic_count)} organic)${delta(accounts.change_vs_previous?.signups)}`,
      },
      ...(topRecruiter?.name
        ? [{ label: "Top recruiter", value: `${topRecruiter.name} (${n(topRecruiter.recruits)} ${plural(topRecruiter.recruits ?? 0, "recruit", "recruits")})` }]
        : []),
    ],
  })

  if (!traffic.error) {
    const topSource = traffic.traffic_by_exact_source?.[0]
    const topCountry = traffic.visitors_by_country?.[0]
    const topDevice = traffic.visitors_by_device?.[0]
    const leads = traffic.lead_clicks
    const leadTotal = (leads?.whatsapp ?? 0) + (leads?.phone ?? 0) + (leads?.email ?? 0) + (leads?.inquiries_submitted ?? 0)
    sections.push({
      title: "Website",
      rows: [
        { label: "Visitors", value: `${n(traffic.visitors)}${delta(traffic.change_vs_previous?.visitors)}` },
        { label: "Page views", value: `${n(traffic.page_views)} across ${n(traffic.sessions)} sessions` },
        { label: "Engagement", value: `${traffic.avg_session_duration ?? "-"} average visit · ${traffic.engagement_rate_percent ?? 0}% engaged` },
        ...(topSource?.source ? [{ label: "Top source", value: `${topSource.source === "direct" ? "Direct" : topSource.source} (${n(topSource.sessions)} sessions)` }] : []),
        ...(topCountry?.country ? [{ label: "Top country", value: `${topCountry.country} (${n(topCountry.visitors)} visitors)` }] : []),
        ...(topDevice?.device ? [{ label: "Devices", value: `${topDevice.device} first — ${topDevice.percent ?? 0}% of visitors` }] : []),
        {
          label: "Leads",
          value: leadTotal
            ? `${n(leads?.whatsapp)} WhatsApp · ${n(leads?.phone)} calls · ${n(leads?.email)} emails · ${n(leads?.inquiries_submitted)} inquiries`
            : "No lead clicks yesterday",
        },
      ],
    })
  }

  const leaders = (mtdAgents.leaders ?? []).filter((l) => l.agent)
  sections.push({
    title: "Month to date",
    rows: [
      {
        label: "Validated",
        value: `${n(mtdSales.validated?.count)} ${plural(mtdSales.validated?.count ?? 0, "deal", "deals")} · ${mtdSales.validated?.total ?? "AED 0"}`,
      },
      ...leaders.map((l) => ({
        label: `${l.rank ?? "-"}. ${l.agent ?? ""}`,
        value: `${n(l.deals)} ${plural(l.deals ?? 0, "deal", "deals")} · ${l.total ?? "AED 0"}`,
      })),
    ],
  })

  const activity = (feed.activity ?? [])
    .slice(0, 12)
    .map((a) => `${a.at ?? ""} — ${a.happened ?? ""}`.trim())
    .filter((l) => l !== "—")

  return { dateLabel: labelFor(yday), sections, activity }
}
