import "server-only"

import { createAdminSupabase } from "@/lib/admin-supabase"
import { businessDate, fetchAllSales, nameMaps, runFhiChatTool, saleCredits, type SaleRow } from "@/lib/fhi-chat-tools"
import { titleCaseName } from "@/lib/public-profile"

/**
 * The company performance report (boss via Juliecor, 2026-10-15) — the
 * figures behind the downloadable PDF (lib/company-report/pdf.tsx). Sales come
 * straight from the shared sales helpers (validated = the headline, a sale's
 * date = reservation_date else created_at, shared deals credit each agent
 * their share); recruitment, pipeline, leads and website reuse the FHI
 * Assistant tools, so the PDF and the chat always agree. "Teams" are the
 * formal teams plus the biggest recruiters' networks (the genealogy rule:
 * metadata.invited_by, developer-invite sign-ups excluded) — the same
 * networks My Team and Team Performance show.
 */

export type ReportPeriodKey = "today" | "last7" | "month" | "last_month"
export const REPORT_PERIOD_KEYS: readonly ReportPeriodKey[] = ["today", "last7", "month", "last_month"]

export type ReportPeriod = {
  key: ReportPeriodKey
  /** "Daily report" … */
  kind: string
  /** "9 – 15 October 2026" */
  label: string
  /** "previous 7 days" — what the changes compare against. */
  versus: string
  from: string
  /** Exclusive. */
  to: string
  prevFrom: string
  prevTo: string
}

export type Kpi = { label: string; value: string; change: string | null; tone: "up" | "down" | "flat"; hint: string | null }
export type Bar = { label: string; value: number; display?: string; inPeriod?: boolean }
export type Share = { label: string; value: number; display?: string }

export type NetworkRow = {
  name: string
  role: string | null
  direct: number
  network: number
  active: number
  joined: number
  sellers: number
  deals: number
  value: number
}

export type CompanyReport = {
  period: ReportPeriod
  generatedAt: string
  kpis: Kpi[]
  sales: {
    validated: { deals: number; value: number }
    previous: { deals: number; value: number }
    pending: { deals: number; value: number }
    rejected: number
    allTime: { deals: number; value: number }
    byDay: Bar[]
    topAgents: Array<{ name: string; deals: number; value: number; share: number }>
    topDevelopers: Array<{ name: string; deals: number; value: number }>
    topProjects: Array<{ name: string; developer: string; deals: number; value: number }>
    partnerDeals: number
  }
  teams: {
    formal: Array<{ name: string; leaders: string; members: number; active: number; soldAllTime: number; valueAllTime: number; dealsAllTime: number; valuePeriod: number; dealsPeriod: number }>
    networks: NetworkRow[]
    noTeam: { count: number; byRole: Share[] }
  }
  recruitment: {
    total: number
    previous: number
    change: string | null
    recruited: number
    direct: number
    waiting: number
    byRole: Share[]
    topRecruiters: Array<{ name: string; recruits: number }>
    byDay: Bar[]
  }
  pipeline: {
    awaiting: number
    awaitingValue: number
    stale: number
    staleDays: number
    oldest: Array<{ agent: string; project: string; value: number; days: number }>
    validationDays: number | null
    commissions: Share[]
    sellingActive: number
    soldInPeriod: number
    neverSold: number
    quietByRole: Share[]
  }
  leads: {
    total: number
    previous: number
    change: string | null
    unanswered: number
    sources: Array<{ label: string; total: number; previous: number; change: string | null }>
    whatsappClicks: number
    inquiriesSubmitted: number
  }
  website: {
    visitors: number
    previous: number
    change: string | null
    sessions: number
    pageViews: number
    avgTime: string | null
    engagement: number | null
    trend: string | null
    byDay: Bar[]
    sources: Share[]
    devices: Share[]
    countries: Share[]
    topPages: Array<{ path: string; views: number }>
  } | null
}

// ─── Periods (Dubai time) ────────────────────────────────────────────────────

export const dubaiToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" })
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400e3)
const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AE", { ...opts, timeZone: "UTC" })

function rangeLabel(from: string, toExclusive: string): string {
  const last = addDays(toExclusive, -1)
  if (from === last) return fmt(from, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  if (from.slice(0, 7) === last.slice(0, 7)) return `${fmt(from, { day: "numeric" })} – ${fmt(last, { day: "numeric", month: "long", year: "numeric" })}`
  return `${fmt(from, { day: "numeric", month: "short" })} – ${fmt(last, { day: "numeric", month: "short", year: "numeric" })}`
}

export function reportPeriod(key: ReportPeriodKey, today = dubaiToday()): ReportPeriod {
  const tomorrow = addDays(today, 1)
  let from: string
  let to: string
  let kind: string
  let label: string
  let versus: string
  if (key === "today") {
    from = today
    to = tomorrow
    kind = "Daily report"
    label = rangeLabel(from, to)
    versus = "the day before"
  } else if (key === "last7") {
    from = addDays(today, -6)
    to = tomorrow
    kind = "Weekly report"
    label = rangeLabel(from, to)
    versus = "the 7 days before"
  } else if (key === "month") {
    from = `${today.slice(0, 7)}-01`
    to = tomorrow
    kind = "Monthly report"
    label = `${fmt(from, { month: "long", year: "numeric" })} · 1 – ${fmt(today, { day: "numeric", month: "short" })}`
    versus = `the ${daysBetween(from, to)} days before`
  } else {
    to = `${today.slice(0, 7)}-01`
    const d = new Date(`${to}T00:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() - 1)
    from = d.toISOString().slice(0, 10)
    kind = "Monthly report"
    label = fmt(from, { month: "long", year: "numeric" })
    versus = "the month before"
  }
  const len = daysBetween(from, to)
  let prevFrom = addDays(from, -len)
  let prevTo = from
  if (key === "last_month") {
    const d = new Date(`${from}T00:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() - 1)
    prevFrom = d.toISOString().slice(0, 10)
    prevTo = from
  }
  return { key, kind, label, versus, from, to, prevFrom, prevTo }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {})
const arr = (v: unknown): Json[] => (Array.isArray(v) ? v.filter((x): x is Json => !!x && typeof x === "object") : [])
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v.replace(/[^\d.-]/g, ""))) ? Number(v.replace(/[^\d.-]/g, "")) : 0)
const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)
const roleLabel = (r: string) => r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

export function pctChange(cur: number, prev: number): string | null {
  if (prev === 0) return cur === 0 ? null : "new"
  const p = Math.round(((cur - prev) / prev) * 100)
  return `${p > 0 ? "+" : ""}${p}%`
}
const toneOf = (change: string | null): Kpi["tone"] => (!change || change === "0%" ? "flat" : change.startsWith("-") ? "down" : "up")
const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n)))

async function tool(name: string, args: Record<string, unknown>): Promise<{ data: Json; stats: Array<{ label: string; value: string; change?: string | null; hint?: string | null }> } | null> {
  try {
    const r = await runFhiChatTool(name, args)
    return { data: JSON.parse(r.forModel) as Json, stats: r.stats }
  } catch {
    return null
  }
}

/** Day bars over at least 14 days ending with the period, the period's own days marked. */
function dayBars(from: string, to: string, values: Map<string, number>): Bar[] {
  const len = Math.max(14, daysBetween(from, to))
  const start = addDays(to, -Math.min(len, 62))
  const out: Bar[] = []
  for (let d = start; d < to; d = addDays(d, 1)) out.push({ label: d, value: values.get(d) ?? 0, inPeriod: d >= from })
  return out
}

// ─── Leader networks ─────────────────────────────────────────────────────────

const PAGE = 1000
const MAX_DEPTH = 12

async function leaderNetworks(admin: ReturnType<typeof createAdminSupabase>, sales: SaleRow[], period: ReportPeriod, limit = 8): Promise<NetworkRow[]> {
  const rows: Json[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, fullname, fname, lname, role, status, joined_at, metadata")
      .not("is_deleted", "is", true)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as Json[]))
    if (!data || data.length < PAGE) break
  }
  const byId = new Map(rows.map((p) => [String(p.id), p]))
  const kids = new Map<string, string[]>()
  for (const p of rows) {
    const meta = obj(p.metadata)
    const by = text(meta.invited_by)
    if (!by || text(meta.developer_invite_id)) continue
    kids.set(by, [...(kids.get(by) ?? []), String(p.id)])
  }
  const networkOf = (root: string): string[] => {
    const seen = new Set([root])
    const out: string[] = []
    let frontier = [root]
    for (let depth = 0; depth < MAX_DEPTH && frontier.length; depth++) {
      const next: string[] = []
      for (const id of frontier) for (const c of kids.get(id) ?? []) if (!seen.has(c)) { seen.add(c); out.push(c); next.push(c) }
      frontier = next
    }
    return out
  }

  // Validated sales in the period, credited per share.
  const periodSales = sales.filter((s) => s.validation_status === "validated" && businessDate(s) >= period.from && businessDate(s) < period.to)

  const candidates = [...kids.keys()].filter((id) => byId.has(id)).map((id) => ({ id, members: networkOf(id) }))
  candidates.sort((a, b) => b.members.length - a.members.length)
  return candidates.slice(0, limit).map(({ id, members }) => {
    const p = byId.get(id)!
    const set = new Set(members)
    let deals = 0
    let value = 0
    const sellers = new Set<string>()
    for (const s of periodSales) {
      const mine = saleCredits(s).filter((c) => set.has(c.agentId))
      if (!mine.length) continue
      deals++
      for (const c of mine) { value += c.value; sellers.add(c.agentId) }
    }
    const joined = members.filter((m) => {
      const j = text(byId.get(m)?.joined_at)
      const d = j ? new Date(j).toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" }) : null
      return !!d && d >= period.from && d < period.to
    }).length
    return {
      name: titleCaseName(text(p.fullname) ?? [p.fname, p.lname].filter((v) => typeof v === "string" && v).join(" ")) || "Unnamed account",
      role: text(p.role),
      direct: (kids.get(id) ?? []).length,
      network: members.length,
      active: members.filter((m) => String(byId.get(m)?.status ?? "").toLowerCase() === "active").length,
      joined,
      sellers: sellers.size,
      deals,
      value: Math.round(value),
    }
  })
}

// ─── Build ───────────────────────────────────────────────────────────────────

export async function buildCompanyReport(key: ReportPeriodKey): Promise<CompanyReport> {
  const period = reportPeriod(key)
  const admin = createAdminSupabase()
  const range = { from_date: period.from, to_date: period.to }

  const [sales, accounts, pipelineR, leadsR, trafficR, teamsR, topTeamsR] = await Promise.all([
    fetchAllSales(admin),
    tool("new_accounts", range),
    tool("sales_pipeline", { quiet_from_date: period.from, quiet_to_date: period.to, limit: 8 }),
    tool("leads_overview", range),
    // GA ranges are inclusive.
    tool("website_traffic", { from_date: period.from, to_date: addDays(period.to, -1) }),
    tool("teams_detail", { include_members: false }),
    tool("top_teams", { ...range, limit: 10 }),
  ])

  // ── Sales ──
  const inWin = (s: SaleRow, a: string, b: string) => businessDate(s) >= a && businessDate(s) < b
  const cur = sales.filter((s) => inWin(s, period.from, period.to))
  const prev = sales.filter((s) => inWin(s, period.prevFrom, period.prevTo))
  const v = cur.filter((s) => s.validation_status === "validated")
  const pv = prev.filter((s) => s.validation_status === "validated")
  const price = (s: SaleRow) => Number(s.contract_price ?? 0)
  const sum = (list: SaleRow[]) => list.reduce((a, s) => a + price(s), 0)
  const pend = cur.filter((s) => s.validation_status !== "validated" && s.validation_status !== "rejected")
  const allV = sales.filter((s) => s.validation_status === "validated")
  const names = await nameMaps(admin, v)

  const agentT = new Map<string, { deals: number; value: number }>()
  for (const s of v) for (const c of saleCredits(s)) {
    const t = agentT.get(c.agentId) ?? { deals: 0, value: 0 }
    t.deals++
    t.value += c.value
    agentT.set(c.agentId, t)
  }
  const vValue = sum(v)
  const topAgents = [...agentT.entries()]
    .map(([id, t]) => ({ name: titleCaseName(names.agent.get(id)?.name ?? "Unknown agent"), deals: t.deals, value: Math.round(t.value), share: vValue ? t.value / vValue : 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
  const devT = new Map<string, { deals: number; value: number }>()
  const projT = new Map<number, { deals: number; value: number; dev: string }>()
  for (const s of v) {
    const d = devT.get(s.developer_id) ?? { deals: 0, value: 0 }
    d.deals++
    d.value += price(s)
    devT.set(s.developer_id, d)
    const p = projT.get(s.project_id) ?? { deals: 0, value: 0, dev: names.dev.get(s.developer_id)?.name ?? "—" }
    p.deals++
    p.value += price(s)
    projT.set(s.project_id, p)
  }
  const dayV = new Map<string, number>()
  for (const s of sales) if (s.validation_status === "validated") dayV.set(businessDate(s), (dayV.get(businessDate(s)) ?? 0) + price(s))

  // ── Tools ──
  const A = accounts?.data ?? {}
  const P = pipelineR?.data ?? {}
  const Lr = leadsR?.data ?? {}
  const T = trafficR?.data ?? null
  const TD = teamsR?.data ?? {}
  const TT = topTeamsR?.data ?? {}

  const signupDays = new Map<string, number>()
  // new_accounts lists only the newest few, so the by-day bars come from profiles directly.
  {
    const { data } = await admin.from("profiles").select("joined_at").not("is_deleted", "is", true).gte("joined_at", `${addDays(period.to, -63)}T00:00:00+04:00`).lt("joined_at", `${period.to}T00:00:00+04:00`).limit(10000)
    for (const r of (data ?? []) as Json[]) {
      if (!r.joined_at) continue
      const d = new Date(String(r.joined_at)).toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" })
      signupDays.set(d, (signupDays.get(d) ?? 0) + 1)
    }
  }

  const accountsTotal = num(A.new_accounts_total)
  const accountsPrev = num(obj(A.previous_period).total)
  const awaiting = obj(P.awaiting_validation)
  const quiet = obj(P.quiet_agents)
  const leadsAll = obj(Lr.all_sources)
  const sourceOf = (k: string, label: string) => {
    const s = obj(Lr[k])
    return { label, total: num(s.total), previous: num(s.previous_period_total), change: pctChange(num(s.total), num(s.previous_period_total)) }
  }
  const leadSources = [
    sourceOf("project_inquiries", "Project inquiries"),
    sourceOf("buyers_link_briefs", "Buyers Link briefs"),
    sourceOf("contact_messages", "Contact messages"),
    sourceOf("inbox_replies", "Inbox replies"),
  ]
  const leadsTotal = num(leadsAll.total) || leadSources.reduce((a, s) => a + s.total, 0)
  const leadsPrev = num(leadsAll.previous_period_total) || leadSources.reduce((a, s) => a + s.previous, 0)
  const unanswered = num(obj(Lr.project_inquiries).unanswered_still_new) + num(obj(Lr.contact_messages).unread) + num(obj(Lr.inbox_replies).unread)

  const formalTeams = arr(TD.team_list).map((t) => {
    const name = text(t.team) ?? "Team"
    const pt = arr(TT.leaders).find((x) => text(x.team) === name)
    return {
      name,
      leaders: Array.isArray(t.leaders) ? (t.leaders as unknown[]).map(String).map(titleCaseName).join(", ") : "",
      members: num(t.members),
      active: num(t.active_members),
      soldAllTime: num(t.members_who_sold),
      dealsAllTime: num(t.validated_deals),
      valueAllTime: num(t.validated_value_aed),
      dealsPeriod: pt ? num(pt.deals ?? pt.validated_deals) : 0,
      valuePeriod: pt ? num(pt.total ?? pt.value_aed) : 0,
    }
  })
  const noTeam = obj(TD.selling_accounts_without_a_team)

  const website: CompanyReport["website"] = T
    ? {
        visitors: num(T.visitors),
        previous: num(obj(T.previous_period).visitors),
        change: text(obj(T.change_vs_previous).visitors),
        sessions: num(T.sessions),
        pageViews: num(T.page_views),
        avgTime: text(T.avg_session_duration),
        engagement: typeof T.engagement_rate_percent === "number" ? T.engagement_rate_percent : null,
        trend: text(obj(T.visitors_trend).direction),
        byDay: arr(obj(T.visitors_trend).by_day).map((d) => ({ label: String(d.date ?? d.week ?? ""), value: num(d.visitors), inPeriod: true })),
        sources: arr(T.traffic_sources).slice(0, 6).map((s) => ({ label: String(s.channel), value: num(s.sessions) })),
        devices: arr(T.visitors_by_device).map((s) => ({ label: roleLabel(String(s.device)), value: num(s.visitors) })),
        countries: arr(T.visitors_by_country).slice(0, 6).map((s) => ({ label: String(s.country), value: num(s.visitors) })),
        topPages: arr(T.top_pages).slice(0, 6).map((p) => ({ path: String(p.path), views: num(p.views) })),
      }
    : null

  const report: CompanyReport = {
    period,
    generatedAt: new Date().toLocaleString("en-AE", { timeZone: "Asia/Dubai", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    kpis: [],
    sales: {
      validated: { deals: v.length, value: Math.round(vValue) },
      previous: { deals: pv.length, value: Math.round(sum(pv)) },
      pending: { deals: pend.length, value: Math.round(sum(pend)) },
      rejected: cur.filter((s) => s.validation_status === "rejected").length,
      allTime: { deals: allV.length, value: Math.round(sum(allV)) },
      byDay: dayBars(period.from, period.to, dayV),
      topAgents,
      topDevelopers: [...devT.entries()].map(([id, t]) => ({ name: names.dev.get(id)?.name ?? "Unknown developer", deals: t.deals, value: Math.round(t.value) })).sort((a, b) => b.value - a.value).slice(0, 6),
      topProjects: [...projT.entries()].map(([id, t]) => ({ name: names.proj.get(id)?.name ?? "Unknown project", developer: t.dev, deals: t.deals, value: Math.round(t.value) })).sort((a, b) => b.value - a.value).slice(0, 6),
      partnerDeals: v.filter((s) => Array.isArray(s.partners) && s.partners.length > 1).length,
    },
    teams: {
      formal: formalTeams,
      networks: await leaderNetworks(admin, sales, period).catch(() => []),
      noTeam: { count: num(noTeam.count), byRole: arr(noTeam.by_role).map((r) => ({ label: roleLabel(String(r.name)), value: num(r.count) })) },
    },
    recruitment: {
      total: accountsTotal,
      previous: accountsPrev,
      change: pctChange(accountsTotal, accountsPrev),
      recruited: num(A.recruited_count),
      direct: num(A.organic_count),
      waiting: num(obj(A.by_status).pending),
      byRole: Object.entries(obj(A.by_role)).map(([k, n]) => ({ label: roleLabel(k), value: num(n) })).sort((a, b) => b.value - a.value),
      topRecruiters: arr(A.top_recruiters_in_period).slice(0, 6).map((r) => ({ name: titleCaseName(String(r.name)), recruits: num(r.recruits) })),
      byDay: dayBars(period.from, period.to, signupDays),
    },
    pipeline: {
      awaiting: num(awaiting.count),
      awaitingValue: num(awaiting.value_aed),
      stale: num(awaiting.stale_count),
      staleDays: num(awaiting.waiting_more_than_days) || 7,
      oldest: arr(awaiting.oldest_first).slice(0, 6).map((s) => ({ agent: titleCaseName(String(s.agent ?? "")), project: String(s.project ?? ""), value: num(s.contract_price_aed), days: num(s.days_waiting ?? s.days_since_submitted) })),
      validationDays: typeof obj(P.validation_speed).average_days_submit_to_validation === "number" ? (obj(P.validation_speed).average_days_submit_to_validation as number) : null,
      commissions: arr(obj(P.commissions).by_status).map((s) => ({ label: roleLabel(String(s.status)), value: num(s.count) })),
      sellingActive: num(quiet.selling_accounts_active),
      soldInPeriod: num(quiet.sold_in_period),
      neverSold: num(quiet.never_sold_at_all),
      quietByRole: Object.entries(obj(quiet.quiet_by_role)).map(([k, n]) => ({ label: roleLabel(k), value: num(n) })).sort((a, b) => b.value - a.value),
    },
    leads: {
      total: leadsTotal,
      previous: leadsPrev,
      change: pctChange(leadsTotal, leadsPrev),
      unanswered,
      sources: leadSources,
      whatsappClicks: num(obj(T?.lead_clicks).whatsapp),
      inquiriesSubmitted: num(obj(T?.lead_clicks).inquiries_submitted),
    },
    website,
  }

  const k = (label: string, value: string, change: string | null, hint: string | null): Kpi => ({ label, value, change, tone: toneOf(change), hint })
  report.kpis = [
    k("Validated sales", `AED ${short(report.sales.validated.value)}`, pctChange(report.sales.validated.value, report.sales.previous.value), `vs AED ${short(report.sales.previous.value)} before`),
    k("Validated deals", String(report.sales.validated.deals), pctChange(report.sales.validated.deals, report.sales.previous.deals), `vs ${report.sales.previous.deals} before`),
    k("Pending deals", String(report.sales.pending.deals), null, report.sales.pending.deals ? `AED ${short(report.sales.pending.value)} waiting` : "nothing waiting"),
    k("Active sellers", `${report.pipeline.soldInPeriod} of ${report.pipeline.sellingActive}`, null, "selling accounts who closed a deal"),
    k("New accounts", report.recruitment.total.toLocaleString("en-AE"), report.recruitment.change, `vs ${report.recruitment.previous} before`),
    k("Recruited", report.recruitment.recruited.toLocaleString("en-AE"), null, `${report.recruitment.waiting} waiting for approval`),
    k("Leads", report.leads.total.toLocaleString("en-AE"), report.leads.change, `vs ${report.leads.previous} before`),
    k("Visitors", website ? website.visitors.toLocaleString("en-AE") : "—", website?.change ?? null, website ? `vs ${website.previous.toLocaleString("en-AE")} before` : "Analytics unavailable"),
  ]
  return report
}
