import "server-only"

import type { createAdminSupabase } from "@/lib/admin-supabase"
import { SITE_URL } from "@/lib/seo"
import { businessDate, fetchAllSales, inRange, nameMaps, pctChange, previousWindow, saleCredits, type SaleRow } from "@/lib/fhi-chat-tools"
import type { AgentChatCaller } from "@/lib/fhi-agent-chat-tools"
import { BUYER_LEAD_COLUMNS, LEAD_GRADES, answerLabel, budgetLabel, leadGrade, type BuyerLead, type LeadGrade } from "@/lib/buyer-links"
import { titleCaseName } from "@/lib/public-profile"
import { sharpPhoto } from "@/lib/public-agents"

/**
 * My Performance Report — the facts (boss via Juliecor, 2026-11-06): one
 * agent's (or team leader's) period in numbers, built from the same rules
 * the dashboard pages use. Sales are validated, credited per share, dated
 * by reservation_date else created_at (the leaderboards' rule); the Top
 * Sales rank is the one the board shows; leads are the Buyers Link briefs
 * graded the same way, the person's own test briefs left out; reviews are
 * the client reviews written about them; events, listings, website and
 * recruits as their own pages show them. Other people appear only as a rank
 * and a deal count (what the public board shows everyone). lib/agent-report/
 * insights.ts turns this into coaching; pdf.tsx draws it; app/api/fhi-chat/
 * report serves the file for the caller only.
 */

type Admin = ReturnType<typeof createAdminSupabase>

export type AgentReportPeriod = {
  from: string
  /** Exclusive. */
  to: string
  label: string
  versus: string
  months: number
  prevFrom: string
  prevTo: string
}

export type AgentReport = {
  person: { id: string; name: string; roleLabel: string; photo: string | null; email: string | null; website: string | null; joined: string | null; team: string | null }
  period: AgentReportPeriod
  generatedAt: string
  kpis: Array<{ label: string; value: string; change: string | null; hint: string | null }>
  sales: {
    validated: { deals: number; value: number }
    pending: { deals: number; value: number }
    rejected: number
    previous: { deals: number; value: number }
    change: string | null
    dealsChange: string | null
    avgDeal: number
    sharedDeals: number
    byMonth: Array<{ label: string; value: number; deals: number }>
    deals: Array<{ date: string; project: string; developer: string | null; price: number; credited: number; status: string; share: number | null }>
    topProjects: Array<{ name: string; developer: string | null; deals: number; value: number }>
    allTime: { deals: number; value: number }
  }
  board: { rank: number | null; of: number; deals: number }
  leads: {
    total: number
    buyers: number
    sellers: number
    previous: number
    change: string | null
    byGrade: Array<{ label: string; value: number }>
    priority: Array<{ name: string; budget: string; goal: string; when: string }>
    ownTests: number
  }
  listings: { total: number; published: number; sale: number; rent: number }
  website: { has: boolean; live: boolean; url: string | null; lastUpdated: string | null; reviewsShown: boolean }
  reviews: { total: number; approved: number; waiting: number; average: number | null; recommendPct: number | null; byStar: Array<{ label: string; value: number }>; latest: Array<{ client: string; rating: number | null; didWell: string | null }> }
  events: { total: number; inPeriod: number; registrations: number; registrationsInPeriod: number; views: number; qrScans: number; list: Array<{ title: string; date: string | null; registrations: number }> }
  recruits: { total: number; joinedInPeriod: number; active: number; pending: number; selling: number; dealsBetween: number }
}

const base = () => SITE_URL.replace(/\/$/, "")
const ROLE_WORDS: Record<string, string> = { agent: "Property Advisor", team_leader: "Team Leader", unit_manager: "Unit Manager", global_partner: "Global Partner", admin: "Admin", super_admin: "Admin" }
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
const monthShort = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-AE", { month: "short", year: "2-digit", timeZone: "UTC" })
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

/** The period's words: "1 – 31 Oct 2026", compared with "the month before" / "the previous 90 days". */
export function agentReportPeriod(from: string, to: string): AgentReportPeriod {
  const last = addDays(to, -1)
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
  const months = Math.max(days / 30.4, 0.1)
  const prev = previousWindow(from, to)
  const wholeMonth = from.endsWith("-01") && to.endsWith("-01") && from.slice(0, 7) !== to.slice(0, 7)
  const sameMonth = from.slice(0, 7) === last.slice(0, 7)
  let label: string
  if (wholeMonth && Math.round(months) === 1) label = new Date(`${from}T00:00:00Z`).toLocaleDateString("en-AE", { month: "long", year: "numeric", timeZone: "UTC" })
  else if (sameMonth) label = `${from.slice(8).replace(/^0/, "")} – ${dayLabel(last)}`
  else label = `${dayLabel(from)} – ${dayLabel(last)}`
  const versus = wholeMonth && Math.round(months) === 1 ? "the month before" : wholeMonth && Math.round(months) === 3 ? "the quarter before" : wholeMonth && Math.round(months) === 12 ? "the year before" : `the ${days} days before`
  return { from, to, label, versus, months, prevFrom: prev.from, prevTo: prev.to }
}

export type BuildResult = { status: 200; report: AgentReport } | { status: 400 | 500; error: string }

export async function buildAgentReport(admin: Admin, caller: AgentChatCaller & { email?: string | null }, from: string, to: string): Promise<BuildResult> {
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from >= to) return { status: 400, error: "Send from and to as YYYY-MM-DD, from before to." }
  if (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 400 * 86_400_000) return { status: 400, error: "A report covers at most 13 months." }
  const period = agentReportPeriod(from, to)
  const me = caller.userId
  // Loaded here, not at the top: lib/fhi-agent-chat-tools.ts imports this module for the my_report tool.
  const { ownTestBrief, topSalesBoard } = await import("@/lib/fhi-agent-chat-tools")

  const [{ data: profile }, allSales, board, leadsNow, leadsPrev, isOwnTest, { data: listings }, { data: site }, { data: reviews }, { data: events }, { data: recruitRows }, { data: membership }, authUser] = await Promise.all([
    admin.from("profiles").select("id, fullname, fname, lname, role, profile_url, joined_at").eq("id", me).maybeSingle(),
    fetchAllSales(admin),
    topSalesBoard(admin, caller, { from_date: from, to_date: to, limit: 1 }),
    admin.from("buyer_link_leads").select(BUYER_LEAD_COLUMNS).eq("agent_id", me).gte("created_at", from).lt("created_at", to).order("created_at", { ascending: false }).limit(2000),
    admin.from("buyer_link_leads").select("id, name, email, kind").eq("agent_id", me).gte("created_at", period.prevFrom).lt("created_at", period.prevTo).limit(2000),
    ownTestBrief(admin, caller),
    admin.from("agent_listings").select("id, listing_kind, status").eq("agent_id", me).is("deleted_at", null).limit(1000),
    admin.from("website_builder").select("slug, is_published, updated_at, show_reviews").eq("agent_id", me).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("agent_feedback").select("id, client_name, overall_rating, recommend, did_well, status, created_at").eq("agent_id", me).order("created_at", { ascending: false }).limit(500),
    admin.from("events").select("id, title, event_date, view_count, qr_scan_count, created_at").eq("agent_id", me).is("deleted_at", null).order("event_date", { ascending: false }).limit(100),
    admin.from("profiles").select("id, status, joined_at").eq("metadata->>invited_by", me).is("metadata->>developer_invite_id", null).not("is_deleted", "is", true).limit(2000),
    admin.from("team_memberships").select("team_id, teams(name)").eq("user_id", me).eq("is_active", true).order("joined_at", { ascending: false }).limit(1),
    caller.email ? Promise.resolve(null) : admin.auth.admin.getUserById(me).catch(() => null),
  ])

  // ── Sales (my share of every deal I'm on) ──
  const mineOn = (s: SaleRow) => saleCredits(s).find((c) => c.agentId === me) ?? null
  const mySales = allSales.filter((s) => mineOn(s))
  const status = (s: SaleRow) => s.validation_status ?? "pending"
  const inP = mySales.filter((s) => inRange(s, from, to))
  const inPrev = mySales.filter((s) => inRange(s, period.prevFrom, period.prevTo))
  const sum = (rows: SaleRow[]) => rows.reduce((a, s) => a + (mineOn(s)?.value ?? 0), 0)
  const validated = inP.filter((s) => status(s) === "validated")
  const pending = inP.filter((s) => status(s) === "pending")
  const prevValidated = inPrev.filter((s) => status(s) === "validated")
  const allValidated = mySales.filter((s) => status(s) === "validated")
  const names = await nameMaps(admin, inP)
  const months: string[] = []
  for (const c = new Date(`${from.slice(0, 7)}-01T00:00:00Z`); c.toISOString().slice(0, 10) < to && months.length < 14; c.setUTCMonth(c.getUTCMonth() + 1)) months.push(c.toISOString().slice(0, 7))
  const byMonth = months.map((ym) => {
    const rows = validated.filter((s) => businessDate(s).startsWith(ym))
    return { label: monthShort(ym), value: sum(rows), deals: rows.length }
  })
  const projAgg = new Map<number, { name: string; developer: string | null; deals: number; value: number }>()
  for (const s of validated) {
    const cur = projAgg.get(s.project_id) ?? { name: names.proj.get(s.project_id)?.name ?? "Project", developer: names.dev.get(String(s.developer_id))?.name ?? null, deals: 0, value: 0 }
    cur.deals++
    cur.value += mineOn(s)?.value ?? 0
    projAgg.set(s.project_id, cur)
  }
  const deals = [...inP]
    .sort((a, b) => businessDate(b).localeCompare(businessDate(a)))
    .slice(0, 14)
    .map((s) => {
      const c = mineOn(s)
      const shared = saleCredits(s).length > 1
      return { date: businessDate(s), project: names.proj.get(s.project_id)?.name ?? "Project", developer: names.dev.get(String(s.developer_id))?.name ?? null, price: Number(s.contract_price ?? 0) || 0, credited: c?.value ?? 0, status: status(s), share: shared ? c?.share ?? null : null }
    })
  const vValue = sum(validated)
  const pValue = sum(prevValidated)

  // ── Leads (Buyers Link / Sellers Link briefs, own tests left out) ──
  const briefs = ((leadsNow.data ?? []) as unknown as BuyerLead[]).filter((b) => !isOwnTest(b))
  const ownTests = (leadsNow.data ?? []).length - briefs.length
  const prevBriefs = ((leadsPrev.data ?? []) as unknown as Array<{ name: string | null; email: string | null; kind: string | null }>).filter((b) => !isOwnTest({ email: b.email, name: b.name })).length
  const buyers = briefs.filter((b) => b.kind !== "seller")
  const gradeOf = (b: BuyerLead): LeadGrade => leadGrade(b)
  const byGrade = (Object.keys(LEAD_GRADES) as LeadGrade[]).map((g) => ({ label: LEAD_GRADES[g].label, value: buyers.filter((b) => gradeOf(b) === g).length })).filter((g) => g.value > 0)
  const prof = (b: BuyerLead) => (b.profile ?? {}) as Record<string, string | string[] | undefined>
  const priority = buyers
    .filter((b) => gradeOf(b) === "priority")
    .slice(0, 5)
    .map((b) => ({ name: b.name ?? "Buyer", budget: budgetLabel(b.budget) ?? "—", goal: answerLabel("goal", prof(b).goal) ?? "—", when: b.created_at.slice(0, 10) }))

  // ── Listings, website, reviews ──
  const L = (listings ?? []) as Array<{ listing_kind: string; status: string }>
  const R = (reviews ?? []) as Array<{ client_name: string | null; overall_rating: number | null; recommend: string | null; did_well: string | null; status: string | null; created_at: string }>
  const rated = R.filter((r) => r.status !== "hidden" && typeof r.overall_rating === "number")
  const average = rated.length ? Math.round((rated.reduce((a, r) => a + (r.overall_rating ?? 0), 0) / rated.length) * 10) / 10 : null
  const recommends = (r: { recommend: string | null }) => r.recommend === "definitely_yes" || r.recommend === "very_likely" || r.recommend === "likely"

  // ── Events ──
  const E = (events ?? []) as Array<{ id: string; title: string; event_date: string | null; view_count: number | null; qr_scan_count: number | null; created_at: string }>
  let regs: Array<{ event_id: string; created_at: string }> = []
  if (E.length) {
    const { data } = await admin.from("event_registrations").select("event_id, created_at").in("event_id", E.map((e) => e.id)).limit(20000)
    regs = (data ?? []) as typeof regs
  }
  const inPeriodDate = (d: string | null | undefined) => Boolean(d && d.slice(0, 10) >= from && d.slice(0, 10) < to)
  const eventsInPeriod = E.filter((e) => inPeriodDate(e.event_date) || inPeriodDate(e.created_at))

  // ── Recruits ──
  const RC = (recruitRows ?? []) as Array<{ id: string; status: string | null; joined_at: string | null }>
  const dealsBy = new Map<string, number>()
  for (const s of allSales) if (status(s) === "validated") for (const c of saleCredits(s)) dealsBy.set(c.agentId, (dealsBy.get(c.agentId) ?? 0) + 1)
  const sellingRecruits = RC.filter((r) => (dealsBy.get(r.id) ?? 0) > 0)

  const p = profile as { fullname: string | null; fname: string | null; lname: string | null; role: string | null; profile_url: string | null; joined_at: string | null } | null
  const name = titleCaseName(((p?.fullname ?? [p?.fname, p?.lname].filter(Boolean).join(" ")) || caller.name || "").trim()) || "FHI member"
  const teamRow = membership?.[0] as { teams?: { name?: string } | { name?: string }[] | null } | undefined
  const teamName = (Array.isArray(teamRow?.teams) ? teamRow?.teams[0]?.name : teamRow?.teams?.name) ?? null
  const you = (board as { you?: { rank?: number | null; deals?: number }; agents_on_board?: number }).you
  const onBoard = (board as { agents_on_board?: number }).agents_on_board ?? 0
  const rank = typeof you?.rank === "number" ? you.rank : null

  const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-AE")}`
  const leadsChange = briefs.length || prevBriefs ? pctChange(briefs.length, prevBriefs) : null
  const report: AgentReport = {
    person: {
      id: me,
      name,
      roleLabel: ROLE_WORDS[String(p?.role ?? caller.role ?? "")] ?? "Member",
      photo: p?.profile_url ? sharpPhoto(p.profile_url) : null,
      email: caller.email ?? authUser?.data?.user?.email ?? null,
      website: site?.slug && site.is_published ? `${base()}/website/${site.slug}` : null,
      joined: p?.joined_at ? String(p.joined_at).slice(0, 10) : null,
      team: teamName,
    },
    period,
    generatedAt: new Date().toLocaleString("en-AE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" }),
    kpis: [
      { label: "Validated sales", value: aed(vValue), change: vValue || pValue ? pctChange(vValue, pValue) : null, hint: `vs ${aed(pValue)} ${period.versus}` },
      { label: "Validated deals", value: String(validated.length), change: validated.length || prevValidated.length ? pctChange(validated.length, prevValidated.length) : null, hint: `vs ${prevValidated.length} ${period.versus}` },
      { label: "Top Sales rank", value: rank ? `#${rank}` : "–", change: null, hint: rank ? `of ${onBoard} on the board` : "no validated sale in the period" },
      { label: "Leads", value: String(briefs.length), change: leadsChange, hint: `${priority.length ? `${buyers.filter((b) => gradeOf(b) === "priority").length} priority` : "Buyers & Sellers Link"}${ownTests ? ` · ${ownTests} own test left out` : ""}` },
      { label: "Pending deals", value: String(pending.length), change: null, hint: pending.length ? `${aed(sum(pending))} waiting for validation` : "nothing waiting" },
      { label: "Client rating", value: average != null ? `${average} / 5` : "–", change: null, hint: rated.length ? `${rated.length} review${rated.length === 1 ? "" : "s"}${rated.length ? ` · ${Math.round((100 * rated.filter(recommends).length) / rated.length)}% recommend` : ""}` : "no reviews yet" },
    ],
    sales: {
      validated: { deals: validated.length, value: vValue },
      pending: { deals: pending.length, value: sum(pending) },
      rejected: inP.filter((s) => status(s) === "rejected").length,
      previous: { deals: prevValidated.length, value: pValue },
      change: vValue || pValue ? pctChange(vValue, pValue) : null,
      dealsChange: validated.length || prevValidated.length ? pctChange(validated.length, prevValidated.length) : null,
      avgDeal: validated.length ? vValue / validated.length : 0,
      sharedDeals: validated.filter((s) => saleCredits(s).length > 1).length,
      byMonth,
      deals,
      topProjects: [...projAgg.values()].sort((a, b) => b.value - a.value).slice(0, 5),
      allTime: { deals: allValidated.length, value: sum(allValidated) },
    },
    board: { rank, of: onBoard, deals: you?.deals ?? 0 },
    leads: { total: briefs.length, buyers: buyers.length, sellers: briefs.length - buyers.length, previous: prevBriefs, change: leadsChange, byGrade, priority, ownTests },
    listings: { total: L.length, published: L.filter((l) => l.status === "published").length, sale: L.filter((l) => l.listing_kind === "sale").length, rent: L.filter((l) => l.listing_kind === "rent").length },
    website: { has: Boolean(site), live: Boolean(site?.is_published), url: site?.slug ? `${base()}/website/${site.slug}` : null, lastUpdated: site?.updated_at ? String(site.updated_at).slice(0, 10) : null, reviewsShown: Boolean(site?.show_reviews) },
    reviews: {
      total: R.length,
      approved: R.filter((r) => r.status === "approved").length,
      waiting: R.filter((r) => r.status === "new").length,
      average,
      recommendPct: rated.length ? Math.round((100 * rated.filter(recommends).length) / rated.length) : null,
      byStar: [5, 4, 3, 2, 1].map((star) => ({ label: `${star} ★`, value: rated.filter((r) => r.overall_rating === star).length })),
      latest: R.filter((r) => r.status !== "hidden").slice(0, 3).map((r) => ({ client: r.client_name ?? "A client", rating: r.overall_rating, didWell: r.did_well ? (r.did_well.replace(/\s+/g, " ").length > 170 ? `${r.did_well.replace(/\s+/g, " ").slice(0, 170).replace(/\s+\S*$/, "")}…` : r.did_well.replace(/\s+/g, " ")) : null })),
    },
    events: {
      total: E.length,
      inPeriod: eventsInPeriod.length,
      registrations: regs.length,
      registrationsInPeriod: regs.filter((r) => inPeriodDate(r.created_at)).length,
      views: E.reduce((a, e) => a + (e.view_count ?? 0), 0),
      qrScans: E.reduce((a, e) => a + (e.qr_scan_count ?? 0), 0),
      list: E.slice(0, 5).map((e) => ({ title: e.title, date: e.event_date?.slice(0, 10) ?? null, registrations: regs.filter((r) => r.event_id === e.id).length })),
    },
    recruits: {
      total: RC.length,
      joinedInPeriod: RC.filter((r) => inPeriodDate(r.joined_at)).length,
      active: RC.filter((r) => r.status === "active").length,
      pending: RC.filter((r) => r.status === "pending").length,
      selling: sellingRecruits.length,
      dealsBetween: sellingRecruits.reduce((a, r) => a + (dealsBy.get(r.id) ?? 0), 0),
    },
  }
  return { status: 200, report }
}

/** Named periods the chat and the route accept, worked out in Dubai time. */
export function agentReportDates(period: string, today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" })): { from: string; to: string } {
  const y = Number(today.slice(0, 4))
  const m = Number(today.slice(5, 7)) - 1
  const firstOf = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 1)).toISOString().slice(0, 10)
  const tomorrow = addDays(today, 1)
  switch (period) {
    case "last_month": return { from: firstOf(y, m - 1), to: firstOf(y, m) }
    case "quarter": return { from: firstOf(y, Math.floor(m / 3) * 3), to: tomorrow }
    case "last_quarter": { const q = Math.floor(m / 3); return { from: firstOf(y, q * 3 - 3), to: firstOf(y, q * 3) } }
    case "year": return { from: `${y}-01-01`, to: tomorrow }
    case "last_90": return { from: addDays(today, -89), to: tomorrow }
    case "last_30": return { from: addDays(today, -29), to: tomorrow }
    default: return { from: firstOf(y, m), to: tomorrow }
  }
}
