import "server-only"

import { createAdminSupabase } from "@/lib/admin-supabase"
import { eventIsPast, eventWhenLabel } from "@/lib/events/dates"
import { gaConfigured, gaRunRealtime, gaRunReport, gscQuery } from "@/lib/ga-data"
import { DEFAULT_POSTER_DESIGN, posterDesignIds, posterDesignLabel, renderBirthdayPosterPng } from "@/lib/birthday-poster"
import { renderMeetingPosterPng, type MeetingPosterData } from "@/lib/meeting-poster"
import { SITE_URL } from "@/lib/seo"
import { DESIGNS as CARD_DESIGNS, isDesignId as isCardDesignId } from "@/features/business-card/card-render"
import { sendAdminDirectEmail, sendCongratsEmail } from "@/lib/mailer"
import { renderTopSellerCertificatePng } from "@/lib/congrats-poster"
import { formatPrice, handoverLabel, isOffPlan, parsePaymentPlan, priceFromValue, priceToValue, statusLabel, unitsSummary, type ProjectSeoInput } from "@/lib/project-seo"
import { ROLES_SALES_PIPELINE } from "@/lib/app-roles"
import { MIN_LISTING_DESCRIPTION, PLACEHOLDER_WORDS, isLiveProject, isTestRecord, type ProjectLiveFlags } from "@/lib/listing-publish-checks"
import { isDubaiCity } from "@/lib/permit-rules"
import { leadSourceLabel } from "@/lib/lead-source"
import { RECOMMEND_LABELS, type RecommendValue } from "@/lib/feedback-service"
import { fetchArticlesList, isIndexableNewsArticle, type NewsArticle } from "@/lib/news-service"
import { BUYER_LEAD_COLUMNS, LEAD_GRADES, answerLabel, budgetLabel, leadGrade, sellerAnswerLabel, waDigits, type BuyerLead, type LeadGrade } from "@/lib/buyer-links"

/**
 * FHI Assistant's toolbox — the predefined, parameterized queries the assistant is
 * allowed to run. The model never writes SQL and never sees the database; it
 * picks a tool, we execute it on the service-role client, and it answers from
 * the returned JSON. That is what keeps the numbers exact.
 *
 * Tools may attach a `_cards` array (people/projects/developers with images).
 * The route strips it before the JSON reaches the model — cards are rendered
 * by the UI from OUR query results, so a picture can never be hallucinated.
 *
 * Sales rules mirror the dashboard leaderboards: only VALIDATED sales count,
 * a sale's business date is coalesce(reservation_date, created_at::date),
 * and period bounds are half-open [from, to).
 */

type Admin = ReturnType<typeof createAdminSupabase>

export type FhiChatCard = {
  kind: "agent" | "developer" | "project" | "poster"
  title: string
  subtitle?: string
  image?: string | null
  rank?: number
}

type SaleRow = {
  id: string
  agent_id: string
  developer_id: string
  project_id: number
  contract_price: number | string | null
  validation_status: string | null
  reservation_date: string | null
  created_at: string
  /** Shared sale (migration 055): every agent on it with their share; [] for a solo sale. */
  partners: unknown
}

/**
 * Who a sale counts for, and how much — the same rule as the SQL totals
 * (migration 056): a solo sale credits its agent in full; a shared sale credits
 * each agent on it their share of the contract price. Company-level figures
 * still count every sale once, in full.
 */
export function saleCredits(s: SaleRow): Array<{ agentId: string; share: number; value: number }> {
  const price = Number(s.contract_price ?? 0)
  const shared = (Array.isArray(s.partners) ? s.partners : []).flatMap((p) => {
    const r = (p ?? {}) as { agent_id?: unknown; share?: unknown }
    return typeof r.agent_id === "string" ? [{ agentId: r.agent_id, share: Number(r.share) || 0 }] : []
  })
  const credits = shared.length ? shared : [{ agentId: String(s.agent_id), share: 100 }]
  return credits.map((c) => ({ ...c, value: (price * c.share) / 100 }))
}

const AED = (n: number) => `AED ${Math.round(n).toLocaleString("en-AE")}`

// ─── Stat tiles: a tool's headline figures, drawn big above the answer ───────
export type FhiChatStat = {
  label: string
  value: string
  /** "+33%", "-8%", "new (previous period was 0)", "n/a…" — shown as a small chip. */
  change?: string | null
  tone?: "up" | "down" | "flat" | "neutral"
  /** One short line under the value, e.g. "vs 2 last month". */
  hint?: string | null
}
function toneOf(change: string | null | undefined): FhiChatStat["tone"] {
  if (!change) return "neutral"
  if (change.startsWith("+") || change.startsWith("new")) return "up"
  if (change.startsWith("-")) return "down"
  if (change.startsWith("0%")) return "flat"
  return "neutral"
}
function stat(label: string, value: string | number | null | undefined, change?: string | null, hint?: string | null): FhiChatStat {
  const v = value == null || value === "" ? "–" : typeof value === "number" ? value.toLocaleString("en-AE") : value
  return { label, value: v, change: change ?? null, tone: toneOf(change), hint: hint ?? null }
}

// ─── Chart helpers: tools attach these as `_charts`; the UI draws them ───────
type ChartCount = { name: string; count: number }
/** A donut from name/count rows (by status, by role, by source…). Nothing is drawn for fewer than two non-zero slices. */
function pieChart(title: string, rows: ChartCount[], display?: (n: number) => string): FhiChatChart[] {
  const live = rows.filter((r) => r.count > 0)
  return live.length >= 2 ? [{ kind: "pie", title, rows: live.map((r) => ({ label: r.name, value: r.count, display: display ? display(r.count) : undefined })) }] : []
}
/** Ranked horizontal bars from name/count rows. */
function sharesChart(title: string, rows: ChartCount[], display?: (n: number) => string): FhiChatChart[] {
  const live = rows.filter((r) => r.count > 0)
  return live.length >= 2 ? [{ kind: "shares", title, rows: live.map((r) => ({ label: r.name, value: r.count, display: display ? display(r.count) : undefined })) }] : []
}
/** Labelled vertical bars — months, stars, statuses. Drawn when at least two points exist. */
function barsChart(title: string, points: FhiChatBarPoint[]): FhiChatChart[] {
  return points.length >= 2 ? [{ kind: "bars", title, points }] : []
}
const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-AE", { month: "short", year: "2-digit", timeZone: "UTC" })
const objCounts = (o: Record<string, number>): ChartCount[] => Object.entries(o).map(([name, count]) => ({ name: name.replace(/_/g, " "), count }))

function businessDate(s: SaleRow): string {
  return s.reservation_date ?? s.created_at.slice(0, 10)
}

function inRange(s: SaleRow, from: string | null, to: string | null): boolean {
  const d = businessDate(s)
  if (from && d < from) return false
  if (to && d >= to) return false
  return true
}

/** Half-open [from, to) for a period — same shape as the leaderboard APIs. */
function periodRange(
  scope: "month" | "quarter" | "year" | "all",
  year: number,
  month: number,
): { from: string | null; to: string | null } {
  if (scope === "all") return { from: null, to: null }
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  if (scope === "year")
    return { from: iso(new Date(Date.UTC(year, 0, 1))), to: iso(new Date(Date.UTC(year + 1, 0, 1))) }
  if (scope === "quarter") {
    const q = Math.floor((month - 1) / 3) * 3
    return { from: iso(new Date(Date.UTC(year, q, 1))), to: iso(new Date(Date.UTC(year, q + 3, 1))) }
  }
  return {
    from: iso(new Date(Date.UTC(year, month - 1, 1))),
    to: iso(new Date(Date.UTC(year, month, 1))),
  }
}

/** "+25%" / "-8%" vs the previous period; special-cased when it was empty. */
function pctChange(cur: number, prev: number): string {
  if (prev === 0) return cur === 0 ? "0% (both periods 0)" : "new (previous period was 0)"
  const p = Math.round(((cur - prev) / prev) * 100)
  return `${p >= 0 ? "+" : ""}${p}%`
}

/** The equal-length window immediately before [from, to) — what "vs previous
 *  period" compares against. A missing `to` means "through today". */
function previousWindow(from: string, to: string | null): { from: string; to: string } {
  const DAY = 86400e3
  const f = Date.parse(`${from}T00:00:00Z`)
  const t = to ? Date.parse(`${to}T00:00:00Z`) : Date.now() + DAY
  const len = Math.max(t - f, DAY)
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
  return { from: iso(f - len), to: iso(f) }
}

function normScope(raw: string | undefined): "month" | "quarter" | "year" | "all" {
  return (["month", "quarter", "year", "all"].includes(raw ?? "") ? raw : "year") as
    | "month" | "quarter" | "year" | "all"
}

/** Page through sales_reports (PostgREST caps a single select at 1000 rows). */
export async function fetchAllSales(admin: Admin): Promise<SaleRow[]> {
  const out: SaleRow[] = []
  for (let page = 0; page < 10; page++) {
    const { data, error } = await admin
      .from("sales_reports")
      .select("id, agent_id, developer_id, project_id, contract_price, validation_status, reservation_date, created_at, partners")
      .order("created_at", { ascending: true })
      .range(page * 1000, page * 1000 + 999)
    if (error) throw new Error(error.message)
    out.push(...((data ?? []) as SaleRow[]))
    if (!data || data.length < 1000) break
  }
  return out
}

type Entity = { name: string; image: string | null }

async function nameMaps(admin: Admin, sales: SaleRow[]) {
  // Partners too, so a shared sale's other agents resolve to names.
  const agentIds = [...new Set(sales.flatMap((s) => [s.agent_id, ...saleCredits(s).map((c) => c.agentId)]))]
  const devIds = [...new Set(sales.map((s) => s.developer_id))]
  const projIds = [...new Set(sales.map((s) => s.project_id))]
  const [agents, devs, projs] = await Promise.all([
    agentIds.length
      ? admin.from("profiles").select("id, fullname, profile_url").in("id", agentIds)
      : Promise.resolve({ data: [] as { id: string; fullname: string | null; profile_url: string | null }[] }),
    devIds.length
      ? admin.from("developers").select("id, name, logo_url").in("id", devIds)
      : Promise.resolve({ data: [] as { id: string; name: string; logo_url: string | null }[] }),
    projIds.length
      ? admin.from("projects").select("id, name, main_image").in("id", projIds)
      : Promise.resolve({ data: [] as { id: number; name: string; main_image: string | null }[] }),
  ])
  return {
    agent: new Map<string, Entity>(
      (agents.data ?? []).map((a) => [String(a.id), { name: a.fullname ?? "Unknown agent", image: a.profile_url ?? null }]),
    ),
    dev: new Map<string, Entity>(
      (devs.data ?? []).map((d) => [String(d.id), { name: d.name, image: d.logo_url ?? null }]),
    ),
    proj: new Map<number, Entity>(
      (projs.data ?? []).map((p) => [Number(p.id), { name: p.name, image: p.main_image ?? null }]),
    ),
  }
}

/** Small Levenshtein for typo-tolerant name matching ("quinto" → "Guinto"). */
function lev(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n]
}

/** Fuzzy person lookup: exact substring first, then word-level matches with
 *  1–2 edits of tolerance. Returns the best matches, best first. */
async function findProfiles(admin: Admin, q: string): Promise<Array<{ id: string; fullname: string | null }>> {
  const { data: all, error } = await admin
    .from("profiles")
    .select("id, fullname")
    .neq("is_deleted", true)
    .limit(2000)
  if (error) throw new Error(error.message)
  const query = q.toLowerCase()
  const qWords = query.split(/\s+/).filter((w) => w.length >= 2)
  const scored = (all ?? [])
    .map((p) => {
      const fl = (p.fullname ?? "").toLowerCase()
      if (!fl) return { p, score: 0 }
      let score = fl.includes(query) ? 100 : 0
      const fWords: string[] = fl.split(/\s+/).filter(Boolean)
      for (const w of qWords) {
        if (fWords.some((f: string) => f.includes(w) || (w.includes(f) && f.length >= 3))) score += 10
        else {
          const d = Math.min(...fWords.map((f: string) => lev(w, f)))
          if (d <= 1) score += 8
          else if (d === 2 && w.length >= 5) score += 4
        }
      }
      return { p, score }
    })
    .filter((x) => x.score >= 8)
    .sort((a, b) => b.score - a.score)
  return scored.slice(0, 5).map((x) => ({ id: String(x.p.id), fullname: x.p.fullname }))
}

// ─── The tools ───────────────────────────────────────────────────────────────

async function topAgents(
  admin: Admin,
  args: {
    scope?: string; year?: number; month?: number; limit?: number; from_date?: string; to_date?: string
    developer_name?: string; project_name?: string
  },
) {
  const now = new Date()
  const scope = normScope(args.scope)
  let { from, to } = periodRange(scope, args.year ?? now.getUTCFullYear(), args.month ?? now.getUTCMonth() + 1)
  // Explicit dates beat the scope shorthand ("today", "May-August").
  if (args.from_date?.trim()) from = args.from_date.trim()
  if (args.to_date?.trim()) to = args.to_date.trim()
  let sales = (await fetchAllSales(admin)).filter(
    (s) => s.validation_status === "validated" && inRange(s, from, to),
  )
  // "Which agents sold Azizi deals?" — narrow to one developer's or one
  // project's sales before ranking.
  const devFilter = (args.developer_name ?? "").trim()
  if (devFilter) {
    const { data } = await admin.from("developers").select("id").ilike("name", `%${devFilter}%`)
    const ids = new Set((data ?? []).map((d) => String(d.id)))
    sales = sales.filter((s) => ids.has(String(s.developer_id)))
    if (!ids.size) return { error: `No developer matches "${devFilter}".` }
  }
  const projFilter = (args.project_name ?? "").trim()
  if (projFilter) {
    const { data } = await admin.from("projects").select("id").ilike("name", `%${projFilter}%`)
    const ids = new Set((data ?? []).map((p) => Number(p.id)))
    sales = sales.filter((s) => ids.has(Number(s.project_id)))
    if (!ids.size) return { error: `No project matches "${projFilter}".` }
  }
  const byAgent = new Map<string, { deals: number; value: number }>()
  for (const s of sales) {
    // A shared sale counts for each agent on it, at their share.
    for (const c of saleCredits(s)) {
      const t = byAgent.get(c.agentId) ?? { deals: 0, value: 0 }
      t.deals += 1
      t.value += c.value
      byAgent.set(c.agentId, t)
    }
  }
  const names = await nameMaps(admin, sales)
  const ranked = [...byAgent.entries()]
    .map(([id, t]) => ({ id, deals: t.deals, value: t.value }))
    .sort((a, b) => b.value - a.value || b.deals - a.deals)
    .slice(0, Math.min(args.limit ?? 10, 25))
  return {
    period: { scope, from, to },
    note: "validated sales only; a shared (partnership) sale counts for each agent on it at their agreed share of the contract price",
    ...(devFilter ? { filtered_to_developer: devFilter } : {}),
    ...(projFilter ? { filtered_to_project: projFilter } : {}),
    leaders: ranked.map((l, i) => ({
      rank: i + 1,
      agent: names.agent.get(l.id)?.name ?? l.id,
      deals: l.deals,
      total: AED(l.value),
    })),
    _cards: ranked.slice(0, 8).map((l, i): FhiChatCard => ({
      kind: "agent",
      rank: i + 1,
      title: names.agent.get(l.id)?.name ?? "Agent",
      subtitle: `${l.deals} deal${l.deals === 1 ? "" : "s"} · ${AED(l.value)}`,
      image: names.agent.get(l.id)?.image ?? null,
    })),
    _charts: (ranked.length > 1
      ? [{
          kind: "shares" as const,
          title: "Sales value by agent",
          rows: ranked.slice(0, 8).map((l) => ({
            label: names.agent.get(l.id)?.name ?? "Agent",
            value: l.value,
            display: AED(l.value),
          })),
        }]
      : []) satisfies FhiChatChart[],
  }
}

async function topDevelopers(
  admin: Admin,
  args: { scope?: string; year?: number; month?: number; from_date?: string; to_date?: string },
) {
  const now = new Date()
  const scope = normScope(args.scope)
  let { from, to } = periodRange(scope, args.year ?? now.getUTCFullYear(), args.month ?? now.getUTCMonth() + 1)
  if (args.from_date?.trim()) from = args.from_date.trim()
  if (args.to_date?.trim()) to = args.to_date.trim()
  const sales = (await fetchAllSales(admin)).filter(
    (s) => s.validation_status === "validated" && inRange(s, from, to),
  )
  const byDev = new Map<string, { deals: number; value: number }>()
  for (const s of sales) {
    const t = byDev.get(s.developer_id) ?? { deals: 0, value: 0 }
    t.deals += 1
    t.value += Number(s.contract_price ?? 0)
    byDev.set(s.developer_id, t)
  }
  const names = await nameMaps(admin, sales)
  const ranked = [...byDev.entries()]
    .map(([id, t]) => ({ id, deals: t.deals, value: t.value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
  return {
    period: { scope, from, to },
    note: "by validated sales",
    leaders: ranked.map((l, i) => ({
      rank: i + 1,
      developer: names.dev.get(l.id)?.name ?? l.id,
      deals: l.deals,
      total: AED(l.value),
    })),
    _cards: ranked.slice(0, 8).map((l, i): FhiChatCard => ({
      kind: "developer",
      rank: i + 1,
      title: names.dev.get(l.id)?.name ?? "Developer",
      subtitle: `${l.deals} deal${l.deals === 1 ? "" : "s"} · ${AED(l.value)}`,
      image: names.dev.get(l.id)?.image ?? null,
    })),
    _charts: (ranked.length > 1
      ? [{
          kind: "shares" as const,
          title: "Sales value by developer",
          rows: ranked.slice(0, 8).map((l) => ({
            label: names.dev.get(l.id)?.name ?? "Developer",
            value: l.value,
            display: AED(l.value),
          })),
        }]
      : []) satisfies FhiChatChart[],
  }
}

async function topTeams(
  admin: Admin,
  args: { scope?: string; year?: number; month?: number; from_date?: string; to_date?: string },
) {
  const now = new Date()
  const scope = normScope(args.scope ?? "all")
  let { from, to } = periodRange(scope, args.year ?? now.getUTCFullYear(), args.month ?? now.getUTCMonth() + 1)
  if (args.from_date?.trim()) from = args.from_date.trim()
  if (args.to_date?.trim()) to = args.to_date.trim()
  const [{ data: teams, error: teamErr }, { data: memberships, error: memErr }] = await Promise.all([
    admin.from("teams").select("id, name, logo_url, is_active, parent_id").eq("is_active", true).limit(500),
    admin.from("team_memberships").select("user_id, team_id").eq("is_active", true).limit(10000),
  ])
  if (teamErr) throw new Error(teamErr.message)
  if (memErr) throw new Error(memErr.message)

  // A member counts for their own team AND every team above it: a subteam
  // (e.g. a leader inside CMG Properties with their own team) rolls up into
  // its parent. Each team's figure is its whole tree.
  const parentOf = new Map((teams ?? []).map((t) => [String(t.id), t.parent_id ? String(t.parent_id) : null]))
  const chain = (tid: string): string[] => {
    const out: string[] = []
    for (let cur: string | null = tid; cur && !out.includes(cur) && out.length < 12; cur = parentOf.get(cur) ?? null) out.push(cur)
    return out
  }
  const teamsOf = new Map<string, string[]>()
  const memberCount = new Map<string, number>()
  for (const m of memberships ?? []) {
    const uid = String(m.user_id)
    const tids = chain(String(m.team_id))
    teamsOf.set(uid, [...(teamsOf.get(uid) ?? []), ...tids])
    for (const tid of tids) memberCount.set(tid, (memberCount.get(tid) ?? 0) + 1)
  }

  const sales = (await fetchAllSales(admin)).filter(
    (s) => s.validation_status === "validated" && inRange(s, from, to),
  )
  const byTeam = new Map<string, { deals: number; value: number }>()
  for (const s of sales) {
    // Each team is credited its members' shares of the sale; a deal two
    // members of the same team shared still counts once for that team.
    const teamValue = new Map<string, number>()
    for (const c of saleCredits(s)) {
      // Set: a duplicate active membership must not credit the same team twice.
      for (const tid of new Set(teamsOf.get(c.agentId) ?? [])) teamValue.set(tid, (teamValue.get(tid) ?? 0) + c.value)
    }
    for (const [tid, value] of teamValue) {
      const t = byTeam.get(tid) ?? { deals: 0, value: 0 }
      t.deals += 1
      t.value += value
      byTeam.set(tid, t)
    }
  }
  const teamById = new Map((teams ?? []).map((t) => [String(t.id), t]))
  const isTop = (id: string) => !parentOf.get(id) || !teamById.has(parentOf.get(id) as string)
  // The ranking is of top-level teams (each including its subteams), so no
  // sale is counted twice in one list; subteams are listed on their own.
  const ranked = [...byTeam.entries()]
    .filter(([id]) => teamById.has(id) && isTop(id))
    .map(([id, t]) => ({ id, ...t }))
    .sort((a, b) => b.value - a.value || b.deals - a.deals)
    .slice(0, 10)
  const subteamRows = [...byTeam.entries()]
    .filter(([id]) => teamById.has(id) && !isTop(id))
    .map(([id, t]) => ({ team: teamById.get(id)?.name ?? id, part_of: teamById.get(parentOf.get(id) as string)?.name ?? null, members: memberCount.get(id) ?? 0, deals: t.deals, total: AED(t.value), _v: t.value }))
    .sort((a, b) => b._v - a._v)
    .map(({ _v, ...rest }) => { void _v; return rest })
  return {
    period: { scope, from, to },
    note: "top-level teams ranked by their members' validated sales, each INCLUDING its subteams; shared sales credit each member's share, and a deal shared inside one team counts once. Subteams are listed separately under subteams (their sales are already inside their parent's total — never add them again).",
    teams_total: (teams ?? []).length,
    leaders: ranked.map((t, i) => ({
      rank: i + 1,
      team: teamById.get(t.id)?.name ?? t.id,
      members: memberCount.get(t.id) ?? 0,
      deals: t.deals,
      total: AED(t.value),
    })),
    ...(subteamRows.length ? { subteams: subteamRows } : {}),
    _cards: ranked.slice(0, 8).map((t, i): FhiChatCard => ({
      kind: "developer",
      rank: i + 1,
      title: teamById.get(t.id)?.name ?? "Team",
      subtitle: `${t.deals} deal${t.deals === 1 ? "" : "s"} · ${AED(t.value)} · ${memberCount.get(t.id) ?? 0} members`,
      image: teamById.get(t.id)?.logo_url ?? null,
    })),
  }
}

async function salesSummary(admin: Admin, args: { from_date?: string; to_date?: string }) {
  const from = args.from_date ?? null
  const to = args.to_date ?? null
  const all = await fetchAllSales(admin)
  const sales = all.filter((s) => inRange(s, from, to))
  const bucket = (rows: SaleRow[], status: string) => {
    const b = rows.filter((s) => (s.validation_status ?? "pending") === status)
    return {
      count: b.length,
      total: AED(b.reduce((a, s) => a + Number(s.contract_price ?? 0), 0)),
      raw_total: b.reduce((a, s) => a + Number(s.contract_price ?? 0), 0),
    }
  }
  const cur = { validated: bucket(sales, "validated"), pending: bucket(sales, "pending"), rejected: bucket(sales, "rejected") }
  // Professional reports show context: compare against the equal-length
  // window immediately before (only meaningful when a period was given).
  let comparison: Record<string, unknown> = {}
  if (from) {
    const prev = previousWindow(from, to)
    const prevSales = all.filter((s) => inRange(s, prev.from, prev.to))
    const pv = bucket(prevSales, "validated")
    comparison = {
      previous_period: {
        from: prev.from,
        to: prev.to,
        validated: { count: pv.count, total: pv.total },
        pending_count: bucket(prevSales, "pending").count,
      },
      change_vs_previous: {
        validated_deals: pctChange(cur.validated.count, pv.count),
        validated_value: pctChange(cur.validated.raw_total, pv.raw_total),
      },
    }
  }
  // The month-by-month picture of the window (or the last 12 months when no
  // period was given) — one call answers "how are sales growing".
  const months: string[] = []
  {
    const lastDay = to ? new Date(Date.parse(`${to}T00:00:00Z`) - 86400e3) : new Date()
    const first = from ? new Date(`${from}T00:00:00Z`) : new Date(Date.UTC(lastDay.getUTCFullYear(), lastDay.getUTCMonth() - 11, 1))
    const cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1))
    while (cursor <= lastDay && months.length < 36) {
      months.push(cursor.toISOString().slice(0, 7))
      cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    }
  }
  const monthSource = from ? sales : all
  const byMonth = months.map((ym) => {
    const rows = monthSource.filter((s) => s.validation_status === "validated" && businessDate(s).startsWith(ym))
    return { month: ym, validated_deals: rows.length, validated_value: rows.reduce((a, s) => a + Number(s.contract_price ?? 0), 0) }
  })
  return {
    period: { from: from ?? "beginning", to: to ?? "no upper bound" },
    _stats: [
      stat("Validated deals", cur.validated.count, (comparison.change_vs_previous as Record<string, string> | undefined)?.validated_deals, from ? `vs ${(comparison.previous_period as { validated?: { count?: number } } | undefined)?.validated?.count ?? 0} before` : "all time"),
      stat("Validated value", cur.validated.total, (comparison.change_vs_previous as Record<string, string> | undefined)?.validated_value, from ? `vs ${(comparison.previous_period as { validated?: { total?: string } } | undefined)?.validated?.total ?? "AED 0"} before` : "all time"),
      stat("Pending", cur.pending.count, null, cur.pending.count ? cur.pending.total : "nothing waiting"),
      ...(cur.rejected.count ? [stat("Rejected", cur.rejected.count)] : []),
    ],
    ...(months.length >= 2 ? { by_month: byMonth.map((m) => ({ month: m.month, validated_deals: m.validated_deals, validated_value: AED(m.validated_value) })) } : {}),
    _charts: [
      ...(months.length >= 2 ? barsChart("Validated sales by month", byMonth.map((m) => ({ label: monthLabel(m.month), value: m.validated_value, display: m.validated_value ? `${(m.validated_value / 1e6).toFixed(2)}M` : "0" }))) : []),
      ...(months.length >= 2 ? barsChart("Validated deals by month", byMonth.map((m) => ({ label: monthLabel(m.month), value: m.validated_deals, display: String(m.validated_deals) }))) : []),
      ...pieChart("Sales by status", [
        { name: "validated", count: cur.validated.count },
        { name: "pending", count: cur.pending.count },
        { name: "rejected", count: cur.rejected.count },
      ]),
    ],
    validated: { count: cur.validated.count, total: cur.validated.total },
    pending: { count: cur.pending.count, total: cur.pending.total },
    rejected: { count: cur.rejected.count, total: cur.rejected.total },
    all_statuses_count: sales.length,
    ...comparison,
  }
}

/**
 * Everyone under a person, level by level (recruits of recruits…), with the
 * validated sales of the whole network — the "how much did Michelle's whole
 * team sell, all in all" question. Recruits are profiles whose
 * metadata.invited_by is the person (developer-invite registrations excluded,
 * as everywhere else). Cycle-safe, capped at 12 levels.
 */
async function agentNetwork(admin: Admin, args: { name?: string; from_date?: string; to_date?: string }) {
  const q = (args.name ?? "").trim()
  if (!q) return { error: "Provide the person's name." }
  const candidates = await findProfiles(admin, q)
  if (!candidates.length) {
    return { error: `No account matches "${q}" (checked with typo tolerance). This is a failed LOOKUP — do not describe it as the person having no network.` }
  }
  const root = candidates[0]

  type Person = { id: string; fullname: string | null; role: string | null; status: string | null; joined_at: string | null; profile_url: string | null; invited_by: string | null }
  const people: Person[] = []
  for (let page = 0; page < 20; page++) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, fullname, role, status, joined_at, profile_url, metadata")
      .not("is_deleted", "is", true)
      .range(page * 1000, page * 1000 + 999)
    if (error) throw new Error(error.message)
    for (const p of (data ?? []) as Array<Record<string, unknown>>) {
      const meta = (p.metadata ?? {}) as Record<string, unknown>
      people.push({
        id: String(p.id), fullname: (p.fullname as string | null) ?? null, role: (p.role as string | null) ?? null,
        status: (p.status as string | null) ?? null, joined_at: (p.joined_at as string | null) ?? null, profile_url: (p.profile_url as string | null) ?? null,
        invited_by: typeof meta.invited_by === "string" && !meta.developer_invite_id ? meta.invited_by : null,
      })
    }
    if (!data || data.length < 1000) break
  }
  const byId = new Map(people.map((p) => [p.id, p]))
  const children = new Map<string, Person[]>()
  for (const p of people) if (p.invited_by && byId.has(p.invited_by)) children.set(p.invited_by, [...(children.get(p.invited_by) ?? []), p])

  // Validated sales per agent (partner shares respected), optionally in a period.
  const from = (args.from_date ?? "").trim() || null
  const to = (args.to_date ?? "").trim() || null
  const sold = new Map<string, { deals: number; value: number }>()
  const allSales = await fetchAllSales(admin)
  const validSales = allSales.filter((s) => s.validation_status === "validated" && inRange(s, from, to))
  for (const s of validSales) {
    for (const c of saleCredits(s)) {
      const t = sold.get(c.agentId) ?? { deals: 0, value: 0 }
      t.deals += 1
      t.value += c.value
      sold.set(c.agentId, t)
    }
  }

  // Walk the tree.
  type Node = { p: Person; level: number; via: string }
  const nodes: Node[] = []
  const seen = new Set<string>([root.id])
  const walk = (id: string, level: number, via: string) => {
    for (const c of children.get(id) ?? []) {
      if (seen.has(c.id) || level > 12) continue
      seen.add(c.id)
      nodes.push({ p: c, level, via })
      walk(c.id, level + 1, c.fullname ?? "")
    }
  }
  walk(root.id, 1, root.fullname ?? "")
  const branchSize = (id: string): number => (children.get(id) ?? []).reduce((a, c) => (seen.has(c.id) ? a + 1 + branchSize(c.id) : a), 0)
  const branchSales = (id: string): { deals: number; value: number } =>
    (children.get(id) ?? []).reduce((a, c) => {
      const own = sold.get(c.id) ?? { deals: 0, value: 0 }
      const sub = branchSales(c.id)
      return { deals: a.deals + own.deals + sub.deals, value: a.value + own.value + sub.value }
    }, { deals: 0, value: 0 })

  const levels = nodes.reduce((m, n) => Math.max(m, n.level), 0)
  const perLevel = Array.from({ length: levels }, (_, i) => nodes.filter((n) => n.level === i + 1).length)
  const netSales = nodes.reduce((a, n) => { const t = sold.get(n.p.id); return { deals: a.deals + (t?.deals ?? 0), value: a.value + (t?.value ?? 0) } }, { deals: 0, value: 0 })
  const own = sold.get(root.id) ?? { deals: 0, value: 0 }
  const sellers = nodes.filter((n) => (sold.get(n.p.id)?.deals ?? 0) > 0).sort((a, b) => (sold.get(b.p.id)?.value ?? 0) - (sold.get(a.p.id)?.value ?? 0))
  const direct = (children.get(root.id) ?? []).map((c) => ({ ...c, branch: branchSize(c.id), branchSales: branchSales(c.id) })).sort((a, b) => b.branchSales.value - a.branchSales.value || b.branch - a.branch)
  const rootProfile = byId.get(root.id)

  // The deals themselves — "which projects did the network sell": one line per
  // credited network member, newest first, named through the same maps the
  // sales tools use.
  const levelOf = new Map(nodes.map((n) => [n.p.id, n]))
  const names = await nameMaps(admin, validSales)
  const networkDeals = validSales
    .flatMap((s) => saleCredits(s).filter((c) => levelOf.has(c.agentId)).map((c) => ({ s, c })))
    .sort((a, b) => businessDate(b.s).localeCompare(businessDate(a.s)))
    .map(({ s, c }) => {
      const n = levelOf.get(c.agentId) as Node
      return {
        date: businessDate(s),
        agent: n.p.fullname,
        level: n.level,
        recruited_by: n.via,
        project: names.proj.get(Number(s.project_id))?.name ?? null,
        developer: names.dev.get(String(s.developer_id))?.name ?? null,
        credited: AED(c.value),
        ...(c.share !== 100 ? { share: `${c.share}% of ${AED(Number(s.contract_price ?? 0))}` } : {}),
      }
    })
  const byProject = new Map<string, { deals: number; value: number }>()
  for (const d of networkDeals) {
    const k = d.project ?? "Other"
    const t = byProject.get(k) ?? { deals: 0, value: 0 }
    t.deals += 1
    t.value += Number(String(d.credited).replace(/[^0-9]/g, ""))
    byProject.set(k, t)
  }

  return {
    person: root.fullname,
    other_name_matches: candidates.slice(1).map((m) => m.fullname),
    sales_period: { from: from ?? "all time", to: to ?? "today" },
    own_validated_sales: { deals: own.deals, total: AED(own.value) },
    direct_recruits: direct.length,
    whole_network: {
      people: nodes.length,
      levels,
      per_level: perLevel,
      by_status: Object.fromEntries([...nodes.reduce((m, n) => m.set(n.p.status ?? "unknown", (m.get(n.p.status ?? "unknown") ?? 0) + 1), new Map<string, number>())]),
      validated_sales: { sellers: sellers.length, deals: netSales.deals, total: AED(netSales.value) },
      including_own_sales: { deals: netSales.deals + own.deals, total: AED(netSales.value + own.value) },
    },
    branches: direct.slice(0, 15).map((c) => ({
      direct_recruit: c.fullname, role: c.role, status: c.status,
      people_under_them: c.branch,
      branch_validated_sales: { deals: c.branchSales.deals, total: AED(c.branchSales.value) },
    })),
    network_deals_by_project: [...byProject].sort((a, b) => b[1].value - a[1].value).map(([project, t]) => ({ project, deals: t.deals, total: AED(t.value) })),
    network_deals: networkDeals.slice(0, 40),
    network_deals_listed: Math.min(40, networkDeals.length),
    top_sellers_in_network: sellers.slice(0, 15).map((n) => ({
      name: n.p.fullname, level: n.level, recruited_by: n.via, role: n.p.role,
      deals: sold.get(n.p.id)?.deals ?? 0, total: AED(sold.get(n.p.id)?.value ?? 0),
    })),
    _cards: [
      ...(rootProfile ? [{ kind: "agent" as const, title: rootProfile.fullname ?? "Agent", subtitle: `${nodes.length} in network · ${levels} level${levels === 1 ? "" : "s"} · ${AED(netSales.value)} network sales`, image: rootProfile.profile_url }] : []),
      ...sellers.slice(0, 7).map((n): FhiChatCard => ({ kind: "agent", title: n.p.fullname ?? "Member", subtitle: `Level ${n.level} · ${sold.get(n.p.id)?.deals ?? 0} deal${(sold.get(n.p.id)?.deals ?? 0) === 1 ? "" : "s"} · ${AED(sold.get(n.p.id)?.value ?? 0)}`, image: n.p.profile_url })),
    ],
    _names: [root.fullname, ...nodes.map((n) => n.p.fullname)].filter((n): n is string => Boolean(n)),
  }
}

async function agentSales(admin: Admin, args: { name?: string }) {
  const q = (args.name ?? "").trim()
  if (!q) return { error: "Provide the agent's name." }
  const candidates = await findProfiles(admin, q)
  if (!candidates.length) {
    return {
      error: `No account matches "${q}" (checked with typo tolerance). This is a failed LOOKUP — do not describe it as the person having no sales.`,
    }
  }
  const { data: agent, error } = await admin
    .from("profiles")
    .select("id, fullname, role, status, profile_url, metadata")
    .eq("id", candidates[0].id)
    .single()
  if (error || !agent) throw new Error(error?.message ?? "Profile fetch failed")
  // Contact numbers live inside profiles.metadata (phone_number + country code).
  const meta = (agent.metadata ?? {}) as Record<string, unknown>
  const composePhone = (num: unknown, cc: unknown): string | null => {
    const n = typeof num === "string" ? num.trim() : ""
    if (!n) return null
    const c = typeof cc === "string" ? cc.trim() : ""
    return c ? `${c} ${n}` : n
  }
  const phone = composePhone(meta.phone_number, meta.phone_country_code)
  const whatsapp = composePhone(meta.whatsapp_number, meta.whatsapp_country_code)
  // Email lives in auth.users — same admin lookup the listing pages use.
  const email = await admin.auth.admin
    .getUserById(String(agent.id))
    .then((r) => r.data?.user?.email?.trim() ?? null)
    .catch(() => null)
  // Sales they recorded or partnered on; totals count their share of each.
  const agentId = String(agent.id)
  const shareOf = (s: SaleRow) => saleCredits(s).find((c) => c.agentId === agentId)
  const sales = (await fetchAllSales(admin)).filter((s) => shareOf(s))
  const names = await nameMaps(admin, sales)
  const validated = sales.filter((s) => s.validation_status === "validated")
  const totalValidated = validated.reduce((a, s) => a + (shareOf(s)?.value ?? 0), 0)
  // The FULL record (newest first, sane cap) — an admin asking about one
  // agent expects every sale listed, not a teaser.
  const list = sales.sort((a, b) => businessDate(b).localeCompare(businessDate(a))).slice(0, 30)
  const seenProj = new Set<number>()
  return {
    agent: {
      name: agent.fullname,
      role: agent.role,
      status: agent.status,
      phone,
      whatsapp,
      email,
    },
    other_name_matches: candidates.slice(1).map((m) => m.fullname),
    _stats: [
      stat("Validated deals", validated.length),
      stat("Validated value", AED(totalValidated), null, sales.some((s) => saleCredits(s).length > 1) ? "own share of shared deals" : null),
      stat("Pending", sales.filter((s) => (s.validation_status ?? "pending") === "pending").length),
    ],
    validated: { count: validated.length, total: AED(totalValidated) },
    ...(sales.some((s) => saleCredits(s).length > 1)
      ? { note: "Totals count this agent's share of shared (partnership) sales; each listed sale shows its full contract price." }
      : {}),
    pending_count: sales.filter((s) => (s.validation_status ?? "pending") === "pending").length,
    sales: list.map((s) => {
      const credits = saleCredits(s)
      const mine = credits.find((c) => c.agentId === agentId)
      return {
        date: businessDate(s),
        project: names.proj.get(s.project_id)?.name ?? "?",
        developer: names.dev.get(String(s.developer_id))?.name ?? "?",
        price: AED(Number(s.contract_price ?? 0)),
        status: s.validation_status,
        ...(credits.length > 1
          ? {
              shared: `${mine?.share ?? 0}% share (${AED(mine?.value ?? 0)}) with ${credits
                .filter((c) => c.agentId !== agentId)
                .map((c) => `${names.agent.get(c.agentId)?.name ?? "another agent"} ${c.share}%`)
                .join(", ")}`,
            }
          : {}),
      }
    }),
    sales_listed: list.length,
    _cards: [
      {
        kind: "agent" as const,
        title: agent.fullname ?? "Agent",
        subtitle: `${validated.length} validated deal${validated.length === 1 ? "" : "s"} · ${AED(totalValidated)}`,
        image: agent.profile_url ?? null,
      },
      ...list
        .filter((s) => {
          if (seenProj.has(s.project_id) || !names.proj.get(s.project_id)?.image) return false
          seenProj.add(s.project_id)
          return true
        })
        .slice(0, 6)
        .map((s): FhiChatCard => ({
          kind: "project",
          title: names.proj.get(s.project_id)?.name ?? "Project",
          subtitle: `${AED(Number(s.contract_price ?? 0))} · ${businessDate(s)}`,
          image: names.proj.get(s.project_id)?.image ?? null,
        })),
    ],
  }
}

async function agentRecruits(
  admin: Admin,
  args: { name?: string; from_date?: string; to_date?: string; days?: number },
) {
  const q = (args.name ?? "").trim()
  if (!q) return { error: "Provide the recruiter's name." }
  const candidates = await findProfiles(admin, q)
  if (!candidates.length) {
    return {
      error: `No account matches "${q}" (checked with typo tolerance). This is a failed LOOKUP — do not describe it as the person having no recruits.`,
    }
  }
  const recruiter = candidates[0]
  const { data: agent } = await admin
    .from("profiles")
    .select("id, fullname, profile_url")
    .eq("id", recruiter.id)
    .single()
  // Optional period — "recruits of Michelle this month".
  let from = (args.from_date ?? "").trim()
  if (!from && args.days != null) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - Math.min(Math.max(args.days, 1), 3650))
    from = d.toISOString().slice(0, 10)
  }
  const to = (args.to_date ?? "").trim()

  // Recruits = accounts whose registration was attributed to this person
  // (profiles.metadata.invited_by holds the recruiter's profile id).
  let recruitQuery = admin
    .from("profiles")
    .select("id, fullname, role, status, joined_at, profile_url")
    .eq("metadata->>invited_by", recruiter.id)
    .neq("is_deleted", true)
    .order("joined_at", { ascending: false })
    .limit(200)
  if (from) recruitQuery = recruitQuery.gte("joined_at", from)
  if (to) recruitQuery = recruitQuery.lt("joined_at", to)
  const { data: recruits, error } = await recruitQuery
  if (error) throw new Error(error.message)
  const rows = recruits ?? []

  // The tool answers the GROUP questions itself (how many sell, how much) —
  // otherwise the model spot-checks a few members and generalizes wrongly.
  const validatedByAgent = new Map<string, { deals: number; value: number }>()
  for (const s of await fetchAllSales(admin)) {
    if (s.validation_status !== "validated") continue
    for (const c of saleCredits(s)) {
      const t = validatedByAgent.get(c.agentId) ?? { deals: 0, value: 0 }
      t.deals += 1
      t.value += c.value
      validatedByAgent.set(c.agentId, t)
    }
  }
  const enriched = rows.map((r) => {
    const t = validatedByAgent.get(String(r.id))
    return { ...r, deals: t?.deals ?? 0, value: t?.value ?? 0 }
  })
  const sellers = enriched.filter((r) => r.deals > 0).sort((a, b) => b.value - a.value)
  // Sellers lead the list so the interesting recruits are never cut off.
  const listed = [...sellers, ...enriched.filter((r) => r.deals === 0)].slice(0, 40)

  return {
    recruiter: recruiter.fullname,
    other_name_matches: candidates.slice(1).map((m) => m.fullname),
    period: { from: from || "all time", to: to || "today" },
    recruits_total: rows.length,
    by_status: Object.fromEntries(
      [...rows.reduce((m, r) => m.set(r.status ?? "unknown", (m.get(r.status ?? "unknown") ?? 0) + 1), new Map<string, number>())],
    ),
    recruits_with_validated_sales: {
      count: sellers.length,
      combined_deals: sellers.reduce((a, r) => a + r.deals, 0),
      combined_value: AED(sellers.reduce((a, r) => a + r.value, 0)),
      sellers: sellers.slice(0, 15).map((r) => ({
        name: r.fullname,
        deals: r.deals,
        total: AED(r.value),
      })),
    },
    recruits: listed.map((r) => ({
      name: r.fullname,
      role: r.role,
      status: r.status,
      joined: r.joined_at ? String(r.joined_at).slice(0, 10) : null,
      validated_deals: r.deals,
      validated_total: r.deals > 0 ? AED(r.value) : undefined,
    })),
    _cards: [
      ...(agent
        ? [{
            kind: "agent" as const,
            title: agent.fullname ?? "Agent",
            subtitle: `${rows.length} recruit${rows.length === 1 ? "" : "s"} · ${sellers.length} selling`,
            image: agent.profile_url ?? null,
          }]
        : []),
      ...listed.slice(0, 7).map((r): FhiChatCard => ({
        kind: "agent",
        title: r.fullname ?? "Member",
        subtitle:
          r.deals > 0
            ? `${r.deals} deal${r.deals === 1 ? "" : "s"} · ${AED(r.value)}`
            : [r.role, r.status].filter(Boolean).join(" · "),
        image: r.profile_url ?? null,
      })),
    ],
    _names: listed.map((r) => r.fullname).filter((n): n is string => Boolean(n)),
  }
}

async function developerOverview(admin: Admin, args: { name?: string }) {
  const q = (args.name ?? "").trim()
  const { data: projRows, error: projErr } = await admin
    .from("projects")
    .select("id, name, status, developer_id, is_published, main_image")
    .is("deleted_at", null)
    .eq("is_active", true)
  if (projErr) throw new Error(projErr.message)
  const projects = projRows ?? []

  if (!q) {
    const { data: devs, error } = await admin
      .from("developers")
      .select("id, name, is_active, is_verified, logo_url")
      .is("deleted_at", null)
      .order("name")
    if (error) throw new Error(error.message)
    const counts = new Map<string, number>()
    for (const p of projects) counts.set(String(p.developer_id), (counts.get(String(p.developer_id)) ?? 0) + 1)
    const rows = (devs ?? [])
      .map((d) => ({ name: d.name, projects: counts.get(String(d.id)) ?? 0, verified: d.is_verified === true, logo: d.logo_url ?? null }))
      .sort((a, b) => b.projects - a.projects)
    return {
      total_developers: rows.length,
      developers: rows.map(({ logo: _logo, ...r }) => r),
      _cards: rows.slice(0, 8).map((d): FhiChatCard => ({
        kind: "developer",
        title: d.name,
        subtitle: `${d.projects} project${d.projects === 1 ? "" : "s"}`,
        image: d.logo,
      })),
    }
  }

  const { data: devs, error } = await admin
    .from("developers")
    .select("id, name, is_active, is_verified, website_url, logo_url")
    .ilike("name", `%${q}%`)
    .is("deleted_at", null)
    .limit(3)
  if (error) throw new Error(error.message)
  if (!devs?.length) return { error: `No developer matches "${q}".` }
  const dev = devs[0]
  const own = projects.filter((p) => String(p.developer_id) === String(dev.id))
  const sales = (await fetchAllSales(admin)).filter(
    (s) => String(s.developer_id) === String(dev.id) && s.validation_status === "validated",
  )
  return {
    developer: { name: dev.name, verified: dev.is_verified === true, website: dev.website_url ?? null },
    other_name_matches: devs.slice(1).map((d) => d.name),
    projects_total: own.length,
    projects_published: own.filter((p) => p.is_published).length,
    projects_by_status: Object.fromEntries(
      [...own.reduce((m, p) => m.set(p.status ?? "unknown", (m.get(p.status ?? "unknown") ?? 0) + 1), new Map<string, number>())],
    ),
    project_names: own.slice(0, 15).map((p) => p.name),
    validated_sales: { count: sales.length, total: AED(sales.reduce((a, s) => a + Number(s.contract_price ?? 0), 0)) },
    _cards: [
      { kind: "developer" as const, title: dev.name, subtitle: `${own.length} projects`, image: dev.logo_url ?? null },
      ...own
        .filter((p) => p.main_image)
        .slice(0, 6)
        .map((p): FhiChatCard => ({
          kind: "project",
          title: p.name,
          subtitle: (p.status ?? "").replace(/_/g, " "),
          image: p.main_image,
        })),
    ],
  }
}

async function projectsStats(admin: Admin, args: { developer_name?: string; status?: string; city?: string }) {
  let query = admin
    .from("projects")
    .select("id, name, status, city, is_published, main_image, developers(name)")
    .is("deleted_at", null)
    .eq("is_active", true)
  if (args.status) query = query.eq("status", args.status)
  if (args.city) query = query.ilike("city", `%${args.city}%`)
  const { data, error } = await query.limit(1000)
  if (error) throw new Error(error.message)
  let rows = data ?? []
  if (args.developer_name) {
    const n = args.developer_name.toLowerCase()
    rows = rows.filter((p) => ((p.developers as unknown as { name?: string } | null)?.name ?? "").toLowerCase().includes(n))
  }
  return {
    filters: args,
    total: rows.length,
    published: rows.filter((p) => p.is_published).length,
    by_status: Object.fromEntries(
      [...rows.reduce((m, p) => m.set(p.status ?? "unknown", (m.get(p.status ?? "unknown") ?? 0) + 1), new Map<string, number>())],
    ),
    sample_names: rows.slice(0, 12).map((p) => p.name),
    _charts: [
      ...pieChart("Projects by status", objCounts(Object.fromEntries([...rows.reduce((m, p) => m.set(p.status ?? "unknown", (m.get(p.status ?? "unknown") ?? 0) + 1), new Map<string, number>())]))),
      ...sharesChart("Projects by developer", [...rows.reduce((m, p) => { const n = (p.developers as unknown as { name?: string } | null)?.name ?? "Unknown"; return m.set(n, (m.get(n) ?? 0) + 1) }, new Map<string, number>())].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10)),
    ],
    _cards: rows
      .filter((p) => p.main_image)
      .slice(0, 8)
      .map((p): FhiChatCard => ({
        kind: "project",
        title: p.name,
        subtitle: [(p.developers as unknown as { name?: string } | null)?.name, (p.status ?? "").replace(/_/g, " ")]
          .filter(Boolean)
          .join(" · "),
        image: p.main_image,
      })),
  }
}

async function platformCounts(admin: Admin) {
  const [{ count: users }, { count: activeUsers }, { count: devs }, { count: projects }, { count: listings }, { count: clients }] =
    await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }).neq("is_deleted", true),
      admin.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active").neq("is_deleted", true),
      admin.from("developers").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("is_active", true),
      admin.from("projects").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("is_published", true),
      admin.from("agent_listings").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "published"),
      admin.from("clients").select("id", { count: "exact", head: true }),
    ])
  const { data: tickets } = await admin.from("support_tickets").select("status").limit(1000)
  const ticketCounts = Object.fromEntries(
    [...(tickets ?? []).reduce((m, t) => m.set(t.status ?? "unknown", (m.get(t.status ?? "unknown") ?? 0) + 1), new Map<string, number>())],
  )
  return {
    _stats: [
      stat("Accounts", users ?? 0, null, `${(activeUsers ?? 0).toLocaleString("en-AE")} active`),
      stat("Developers", devs ?? 0, null, "active"),
      stat("Projects", projects ?? 0, null, "published"),
      stat("Listings", listings ?? 0, null, "published"),
      stat("Clients", clients ?? 0),
      stat("Open tickets", (ticketCounts.open ?? 0) + (ticketCounts.in_progress ?? 0)),
    ],
    accounts_total: users ?? 0,
    accounts_active: activeUsers ?? 0,
    developers_active: devs ?? 0,
    projects_published: projects ?? 0,
    listings_published: listings ?? 0,
    clients_total: clients ?? 0,
    support_tickets_by_status: ticketCounts,
  }
}

async function recentSales(admin: Admin, args: { limit?: number }) {
  const sales = (await fetchAllSales(admin))
    .sort((a, b) => businessDate(b).localeCompare(businessDate(a)))
    .slice(0, Math.min(args.limit ?? 8, 20))
  const names = await nameMaps(admin, sales)
  const seen = new Set<number>()
  return {
    sales: sales.map((s) => ({
      date: businessDate(s),
      agent: names.agent.get(s.agent_id)?.name ?? "?",
      ...(saleCredits(s).length > 1
        ? {
            shared_with: saleCredits(s)
              .filter((c) => c.agentId !== s.agent_id)
              .map((c) => `${names.agent.get(c.agentId)?.name ?? "another agent"} ${c.share}%`)
              .join(", "),
          }
        : {}),
      project: names.proj.get(s.project_id)?.name ?? "?",
      developer: names.dev.get(String(s.developer_id))?.name ?? "?",
      price: AED(Number(s.contract_price ?? 0)),
      status: s.validation_status ?? "pending",
    })),
    _names: [
      ...new Set(
        sales.flatMap((s) => [names.agent.get(s.agent_id)?.name, names.dev.get(String(s.developer_id))?.name]),
      ),
    ].filter((n): n is string => Boolean(n)),
    _cards: sales
      .filter((s) => {
        if (seen.has(s.project_id) || !names.proj.get(s.project_id)?.image) return false
        seen.add(s.project_id)
        return true
      })
      .slice(0, 6)
      .map((s): FhiChatCard => ({
        kind: "project",
        title: names.proj.get(s.project_id)?.name ?? "Project",
        subtitle: `${AED(Number(s.contract_price ?? 0))} · ${businessDate(s)}`,
        image: names.proj.get(s.project_id)?.image ?? null,
      })),
  }
}

async function eventsOverview(admin: Admin) {
  const { data: events, error } = await admin
    .from("events")
    .select("id, title, event_date, event_days, venue, status, registration_open, image_url")
    .is("deleted_at", null)
    .order("event_date", { ascending: false })
    .limit(12)
  if (error) throw new Error(error.message)
  const ids = (events ?? []).map((e) => e.id)
  const { data: regs } = ids.length
    ? await admin.from("event_registrations").select("event_id").in("event_id", ids).limit(5000)
    : { data: [] as { event_id: string }[] }
  const regCount = new Map<string, number>()
  for (const r of regs ?? []) regCount.set(String(r.event_id), (regCount.get(String(r.event_id)) ?? 0) + 1)
  return {
    events: (events ?? []).map((e) => ({
      title: e.title,
      date: e.event_date,
      days: e.event_days ?? 1,
      when: eventWhenLabel(e.event_date, e.event_days, "short"),
      venue: e.venue,
      status: e.status,
      registration_open: e.registration_open,
      registrations: regCount.get(String(e.id)) ?? 0,
    })),
    _charts: sharesChart("Registrations by event", (events ?? []).map((e) => ({ name: e.title, count: regCount.get(String(e.id)) ?? 0 })).sort((a, b) => b.count - a.count).slice(0, 8)),
  }
}

async function newAccounts(admin: Admin, args: { from_date?: string; to_date?: string; days?: number }) {
  // Default window: the last 7 days ("new users this week").
  let from = (args.from_date ?? "").trim()
  if (!from) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - Math.min(Math.max(args.days ?? 7, 1), 365))
    from = d.toISOString().slice(0, 10)
  }
  const to = (args.to_date ?? "").trim()
  let query = admin
    .from("profiles")
    .select("id, fullname, role, status, joined_at, profile_url, metadata")
    .neq("is_deleted", true)
    .gte("joined_at", from)
    .order("joined_at", { ascending: false })
    .limit(500)
  if (to) query = query.lt("joined_at", to)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  const rows = data ?? []
  const group = (key: "role" | "status") =>
    Object.fromEntries(
      [...rows.reduce((m, r) => m.set(r[key] ?? "unknown", (m.get(r[key] ?? "unknown") ?? 0) + 1), new Map<string, number>())],
    )

  // Recruits = the subset whose registration is attributed to a recruiter
  // (metadata.invited_by). Company-wide "new recruits this week/month" is
  // exactly this number.
  const recruiterOf = (r: { metadata: unknown }) => {
    const v = (r.metadata as Record<string, unknown> | null)?.invited_by
    return typeof v === "string" && v ? v : null
  }
  const recruited = rows.filter((r) => recruiterOf(r))
  const byRecruiter = new Map<string, number>()
  for (const r of recruited) {
    const id = recruiterOf(r) as string
    byRecruiter.set(id, (byRecruiter.get(id) ?? 0) + 1)
  }
  const recruiterIds = [...byRecruiter.keys()].slice(0, 50)
  const { data: recruiters } = recruiterIds.length
    ? await admin.from("profiles").select("id, fullname").in("id", recruiterIds)
    : { data: [] as { id: string; fullname: string | null }[] }
  const recruiterName = new Map((recruiters ?? []).map((p) => [String(p.id), p.fullname ?? "Unknown"]))
  const topRecruiters = [...byRecruiter.entries()]
    .map(([id, n]) => ({ name: recruiterName.get(id) ?? "Unknown", recruits: n }))
    .sort((a, b) => b.recruits - a.recruits)
    .slice(0, 8)

  // Same-length previous window for "up/down vs last period" context.
  const prev = previousWindow(from, to || null)
  const { data: prevRows } = await admin
    .from("profiles")
    .select("id, metadata")
    .neq("is_deleted", true)
    .gte("joined_at", prev.from)
    .lt("joined_at", prev.to)
    .limit(1000)
  const prevAll = prevRows ?? []
  const prevRecruited = prevAll.filter((r) => recruiterOf(r)).length

  return {
    period: { from, to: to || "today" },
    new_accounts_total: rows.length,
    recruited_count: recruited.length,
    organic_count: rows.length - recruited.length,
    previous_period: { from: prev.from, to: prev.to, total: prevAll.length, recruited: prevRecruited },
    change_vs_previous: { signups: pctChange(rows.length, prevAll.length) },
    top_recruiters_in_period: topRecruiters,
    by_role: group("role"),
    by_status: group("status"),
    _stats: [
      stat("New accounts", rows.length, pctChange(rows.length, prevAll.length), `vs ${prevAll.length} before`),
      stat("Recruited", recruited.length, pctChange(recruited.length, prevRecruited), "registered under someone"),
      stat("Direct sign-ups", rows.length - recruited.length, null, "from the website"),
      stat("Waiting for approval", rows.filter((r) => r.status === "pending").length, null, "status pending"),
    ],
    _charts: [
      ...pieChart("New accounts by role", objCounts(group("role"))),
      ...pieChart("Recruited vs direct", [{ name: "recruited", count: recruited.length }, { name: "direct sign-up", count: rows.length - recruited.length }]),
      ...(() => {
        const days = new Map<string, number>()
        for (const r of rows) {
          const d = String(r.joined_at ?? "").slice(0, 10)
          if (d) days.set(d, (days.get(d) ?? 0) + 1)
        }
        const sorted = [...days.entries()].sort((a, b) => a[0].localeCompare(b[0]))
        return sorted.length >= 2 && sorted.length <= 31
          ? barsChart("Sign-ups by day", sorted.map(([d, n]) => ({ label: new Date(`${d}T00:00:00Z`).toLocaleDateString("en-AE", { month: "short", day: "numeric", timeZone: "UTC" }), value: n, display: String(n) })))
          : []
      })(),
    ],
    newest: rows.slice(0, 20).map((r) => ({
      name: r.fullname?.trim() || "Unnamed account",
      role: r.role,
      status: r.status,
      joined: r.joined_at ? String(r.joined_at).slice(0, 10) : null,
      // The upline — who this account registered under (transparency).
      recruited_by: recruiterOf(r) ? recruiterName.get(recruiterOf(r) as string) ?? "Unknown" : null,
    })),
    _cards: rows.slice(0, 6).map((r): FhiChatCard => {
      const upline = recruiterOf(r) ? recruiterName.get(recruiterOf(r) as string) : null
      return {
        kind: "agent",
        title: r.fullname?.trim() || "Unnamed account",
        subtitle: [
          r.joined_at ? String(r.joined_at).slice(0, 10) : null,
          upline ? `via ${upline}` : r.role,
        ]
          .filter(Boolean)
          .join(" · "),
        image: r.profile_url ?? null,
      }
    }),
    _names: rows.slice(0, 20).map((r) => r.fullname).filter((n): n is string => Boolean(n)),
  }
}

async function eventAttendees(admin: Admin, args: { event_title?: string }) {
  const q = (args.event_title ?? "").trim()
  let query = admin
    .from("events")
    .select("id, title, event_date, venue")
    .is("deleted_at", null)
    .order("event_date", { ascending: false })
    .limit(1)
  if (q) query = admin
    .from("events")
    .select("id, title, event_date, venue")
    .is("deleted_at", null)
    .ilike("title", `%${q}%`)
    .order("event_date", { ascending: false })
    .limit(1)
  const { data: events, error } = await query
  if (error) throw new Error(error.message)
  const event = events?.[0]
  if (!event) return { error: q ? `No event matches "${q}".` : "No events found." }
  const { data: regs, error: regErr } = await admin
    .from("event_registrations")
    .select("full_name, email, whatsapp, created_at")
    .eq("event_id", event.id)
    .order("created_at", { ascending: false })
    .limit(500)
  if (regErr) throw new Error(regErr.message)
  const rows = regs ?? []
  return {
    event: { title: event.title, date: event.event_date, venue: event.venue },
    registrations_total: rows.length,
    attendees: rows.slice(0, 60).map((r) => ({
      name: r.full_name,
      email: r.email,
      whatsapp: r.whatsapp || null,
      registered: r.created_at ? String(r.created_at).slice(0, 10) : null,
    })),
    attendees_listed: Math.min(rows.length, 60),
    _names: rows.slice(0, 60).map((r) => r.full_name).filter((n): n is string => Boolean(n)),
  }
}

/** Chronological "what happened" feed — sales submitted, signups, listings and
 *  projects added, event registrations. Timestamps are created_at (when it was
 *  entered into the system), NOT the deal's business date: this answers
 *  "how's the update today", not "which period does this sale count in". */
async function activityFeed(admin: Admin, args: { from_date?: string; to_date?: string; days?: number }) {
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  let from = (args.from_date ?? "").trim()
  if (!from) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - Math.min(Math.max(args.days ?? 1, 0), 90))
    from = iso(d)
  }
  const to = (args.to_date ?? "").trim()

  let salesQ = admin
    .from("sales_reports")
    .select("id, agent_id, developer_id, project_id, contract_price, validation_status, reservation_date, created_at")
    .gte("created_at", from)
    .order("created_at", { ascending: false })
    .limit(200)
  if (to) salesQ = salesQ.lt("created_at", to)

  let signupsQ = admin
    .from("profiles")
    .select("id, fullname, role, metadata, joined_at, profile_url")
    .neq("is_deleted", true)
    .gte("joined_at", from)
    .order("joined_at", { ascending: false })
    .limit(200)
  if (to) signupsQ = signupsQ.lt("joined_at", to)

  let listingsQ = admin
    .from("agent_listings")
    .select("id, title, agent_id, status, created_at")
    .is("deleted_at", null)
    .gte("created_at", from)
    .order("created_at", { ascending: false })
    .limit(100)
  if (to) listingsQ = listingsQ.lt("created_at", to)

  let projectsQ = admin
    .from("projects")
    .select("id, name, developer_id, is_published, created_at")
    .is("deleted_at", null)
    .gte("created_at", from)
    .order("created_at", { ascending: false })
    .limit(100)
  if (to) projectsQ = projectsQ.lt("created_at", to)

  let regsQ = admin
    .from("event_registrations")
    .select("full_name, event_id, created_at")
    .gte("created_at", from)
    .order("created_at", { ascending: false })
    .limit(100)
  if (to) regsQ = regsQ.lt("created_at", to)

  const [salesRes, signupsRes, listingsRes, projectsRes, regsRes] = await Promise.all([
    salesQ, signupsQ, listingsQ, projectsQ, regsQ,
  ])
  for (const r of [salesRes, signupsRes, listingsRes, projectsRes, regsRes]) {
    if (r.error) throw new Error(r.error.message)
  }
  const sales = (salesRes.data ?? []) as SaleRow[]
  const signups = signupsRes.data ?? []
  const listings = listingsRes.data ?? []
  const projectsAdded = projectsRes.data ?? []
  const regs = regsRes.data ?? []

  // Names for everything the feed mentions: sale entities via nameMaps, then
  // listing agents, project developers, recruiters and event titles on top.
  const names = await nameMaps(admin, sales)
  const recruiterOf = (m: unknown) => {
    const v = (m as Record<string, unknown> | null)?.invited_by
    return typeof v === "string" && v ? v : null
  }
  const extraAgentIds = [...new Set(listings.map((l) => String(l.agent_id)))].filter((id) => !names.agent.has(id))
  const recruiterIds = [...new Set(signups.map((s) => recruiterOf(s.metadata)).filter((v): v is string => Boolean(v)))]
  const extraDevIds = [...new Set(projectsAdded.map((p) => String(p.developer_id)))].filter((id) => !names.dev.has(id))
  const eventIds = [...new Set(regs.map((r) => String(r.event_id)))]
  const [extraAgents, recruiters, extraDevs, eventRows] = await Promise.all([
    extraAgentIds.length
      ? admin.from("profiles").select("id, fullname").in("id", extraAgentIds)
      : Promise.resolve({ data: [] as { id: string; fullname: string | null }[] }),
    recruiterIds.length
      ? admin.from("profiles").select("id, fullname").in("id", recruiterIds)
      : Promise.resolve({ data: [] as { id: string; fullname: string | null }[] }),
    extraDevIds.length
      ? admin.from("developers").select("id, name").in("id", extraDevIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    eventIds.length
      ? admin.from("events").select("id, title").in("id", eventIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ])
  const agentName = (id: string) =>
    names.agent.get(id)?.name ?? (extraAgents.data ?? []).find((a) => String(a.id) === id)?.fullname ?? "Unknown agent"
  const recruiterName = new Map((recruiters.data ?? []).map((p) => [String(p.id), p.fullname ?? "Unknown"]))
  const devName = (id: string) =>
    names.dev.get(id)?.name ?? (extraDevs.data ?? []).find((d) => String(d.id) === id)?.name ?? "Unknown developer"
  const eventTitle = new Map((eventRows.data ?? []).map((e) => [String(e.id), e.title]))

  const when = (v: string | null | undefined) => (v ? String(v).slice(0, 16).replace("T", " ") : "")
  const feed: Array<{ at: string; happened: string }> = []
  for (const s of sales)
    feed.push({
      at: when(s.created_at),
      happened: `${agentName(s.agent_id)} submitted a sale: ${names.proj.get(s.project_id)?.name ?? "?"} (${devName(String(s.developer_id))}) — ${AED(Number(s.contract_price ?? 0))}, ${s.validation_status ?? "pending"}`,
    })
  for (const s of signups) {
    const upline = recruiterOf(s.metadata)
    feed.push({
      at: when(s.joined_at as string | null),
      happened: `${s.fullname?.trim() || "Unnamed account"} created an account${upline ? ` (recruited by ${recruiterName.get(upline) ?? "Unknown"})` : ""}`,
    })
  }
  for (const l of listings)
    feed.push({ at: when(l.created_at), happened: `${agentName(String(l.agent_id))} added a listing: ${l.title} (${l.status})` })
  for (const p of projectsAdded)
    feed.push({
      at: when(p.created_at),
      happened: `New project added: ${p.name} by ${devName(String(p.developer_id))}${p.is_published ? "" : " (not yet published)"}`,
    })
  for (const r of regs)
    feed.push({ at: when(r.created_at), happened: `${r.full_name} registered for the event ${eventTitle.get(String(r.event_id)) ?? "?"}` })
  feed.sort((a, b) => b.at.localeCompare(a.at))

  return {
    period: { from, to: to || "now" },
    note: "Times are when each entry was submitted into the system (UTC), not the deal's business date.",
    summary: {
      sales_submitted: sales.length,
      sales_value_submitted: AED(sales.reduce((a, s) => a + Number(s.contract_price ?? 0), 0)),
      new_accounts: signups.length,
      listings_added: listings.length,
      projects_added: projectsAdded.length,
      event_registrations: regs.length,
    },
    activity: feed.slice(0, 40),
    activity_total: feed.length,
    _names: [
      ...new Set([
        ...sales.map((s) => agentName(s.agent_id)),
        ...sales.map((s) => names.proj.get(s.project_id)?.name),
        ...signups.map((s) => s.fullname?.trim()),
      ]),
    ].filter((n): n is string => Boolean(n) && n !== "Unknown agent"),
    _cards: [
      ...sales.slice(0, 4).map((s): FhiChatCard => ({
        kind: "agent",
        title: agentName(s.agent_id),
        subtitle: `${AED(Number(s.contract_price ?? 0))} · ${names.proj.get(s.project_id)?.name ?? ""}`,
        image: names.agent.get(s.agent_id)?.image ?? null,
      })),
      ...signups.slice(0, 3).map((s): FhiChatCard => ({
        kind: "agent",
        title: s.fullname?.trim() || "Unnamed account",
        subtitle: `new account · ${when(s.joined_at as string | null).slice(0, 10)}`,
        image: (s.profile_url as string | null) ?? null,
      })),
    ].slice(0, 6),
  }
}

/** Upcoming birthdays of active members — "whose birthday is next?" Sorted
 *  soonest first; Dubai-time days. Matches the birthday-greetings cron rules
 *  (active, not deleted, birthday saved). */
async function upcomingBirthdays(admin: Admin, args: { days?: number; limit?: number }) {
  const windowDays = Math.min(Math.max(args.days ?? 30, 0), 366)
  const limit = Math.min(Math.max(args.limit ?? 15, 1), 60)
  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" })
  const base = new Date(`${todayIso}T00:00:00Z`)

  const { data, error } = await admin
    .from("profiles")
    .select("id, fullname, fname, role, birthday, profile_url")
    .eq("status", "active")
    .neq("is_deleted", true)
    .not("birthday", "is", null)
    .limit(3000)
  if (error) throw new Error(error.message)

  const upcoming = (data ?? [])
    .map((p) => {
      const bday = String(p.birthday)
      const month = Number(bday.slice(5, 7))
      const day = Number(bday.slice(8, 10))
      if (!month || !day) return null
      // Next occurrence (Feb 29 rolls to Mar 1 in non-leap years).
      let next = new Date(Date.UTC(base.getUTCFullYear(), month - 1, day))
      if (next.getTime() < base.getTime()) next = new Date(Date.UTC(base.getUTCFullYear() + 1, month - 1, day))
      const daysUntil = Math.round((next.getTime() - base.getTime()) / 86400e3)
      return {
        name: (p.fullname ?? p.fname ?? "").trim().replace(/\s+/g, " ") || "Unnamed account",
        role: p.role ?? null,
        image: (p.profile_url as string | null) ?? null,
        dateLabel: next.toLocaleDateString("en-AE", { month: "short", day: "numeric", timeZone: "UTC" }),
        daysUntil,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null && r.daysUntil <= windowDays)
    .sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name))

  const whenLabel = (d: number) => (d === 0 ? "TODAY" : d === 1 ? "tomorrow" : `in ${d} days`)
  const listed = upcoming.slice(0, limit)
  return {
    window_days: windowDays,
    total_in_window: upcoming.length,
    note: "Active accounts with a saved birthday only. Each of them automatically receives the FHI birthday greeting email (with their poster) on their day at 8:30 AM Dubai.",
    birthdays: listed.map((r) => ({ name: r.name, role: r.role, date: r.dateLabel, when: whenLabel(r.daysUntil) })),
    _names: listed.map((r) => r.name),
    _cards: listed.slice(0, 8).map((r): FhiChatCard => ({
      kind: "agent",
      title: r.name,
      subtitle: `🎂 ${r.dateLabel} · ${whenLabel(r.daysUntil)}`,
      image: r.image,
    })),
  }
}

/** Make a birthday poster on demand — for a named member, or for today's
 *  celebrant(s), in any of the studio's designs (or all of them). The card
 *  points at the admin-guarded poster route; the browser (already logged in)
 *  fetches the image itself. */
async function birthdayPoster(admin: Admin, args: { name?: string; design?: string }) {
  const q = (args.name ?? "").trim()
  let people: Array<{ id: string; name: string }> = []
  if (q) {
    const matches = await findProfiles(admin, q)
    if (!matches.length) {
      return { error: `No account matches "${q}" (checked with typo tolerance).` }
    }
    people = [{ id: matches[0].id, name: matches[0].fullname?.trim() || "Member" }]
  } else {
    const todayMd = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" }).slice(5)
    const { data, error } = await admin
      .from("profiles")
      .select("id, fullname, birthday")
      .eq("status", "active")
      .neq("is_deleted", true)
      .not("birthday", "is", null)
      .limit(3000)
    if (error) throw new Error(error.message)
    people = (data ?? [])
      .filter((p) => String(p.birthday).slice(5, 10) === todayMd)
      .slice(0, 3)
      .map((p) => ({ id: String(p.id), name: p.fullname?.trim() || "Member" }))
    if (!people.length) {
      return {
        error:
          "No active member has a birthday today. Ask for a specific person instead — e.g. 'make a birthday poster for Michelle'.",
      }
    }
  }
  // Which artwork(s): one named design, "all" of them, or the default.
  const requested = (args.design ?? "").trim().toLowerCase()
  const allIds = posterDesignIds()
  let designs: string[]
  if (requested === "all") designs = allIds
  else if (allIds.includes(requested)) designs = [requested]
  else if (requested) {
    const byLabel = allIds.find((id) => posterDesignLabel(id).toLowerCase().includes(requested))
    designs = [byLabel ?? DEFAULT_POSTER_DESIGN]
  } else designs = [DEFAULT_POSTER_DESIGN]
  // All designs for several people would flood the chat — one person keeps it tidy.
  if (designs.length > 1) people = people.slice(0, 1)

  return {
    posters_created_for: people.map((p) => p.name),
    designs_used: designs.map((id) => posterDesignLabel(id)),
    available_designs: allIds.map((id) => `${id} (${posterDesignLabel(id)})`),
    // To email one of these posters, echo its ref into send_email.
    email_attachment_refs: people.flatMap((p) =>
      designs.map((id) => ({
        label: `${p.name} — ${posterDesignLabel(id)}`,
        birthday_poster_uid: p.id,
        birthday_poster_design: id,
      })),
    ),
    note: "The poster(s) render below this reply — the admin can click one to open the full-size PNG and download or share it. The Midnight Skyline design is the one the automatic birthday emails use.",
    _names: people.map((p) => p.name),
    _cards: people.flatMap((p) =>
      designs.map((id): FhiChatCard => ({
        kind: "poster",
        title: designs.length > 1 ? `${p.name} — ${posterDesignLabel(id)}` : p.name,
        subtitle: `🎂 ${posterDesignLabel(id)} · click to open full size`,
        image: `/api/admin/birthday-poster?uid=${encodeURIComponent(p.id)}&design=${encodeURIComponent(id)}`,
      })),
    ),
  }
}

/** Make a meeting poster from chat — the model gathers title/date/time/venue
 *  (and optional speakers) from the admin, then this packs the payload into a
 *  stateless admin-guarded render URL. FHI member speakers get their photo. */
async function meetingPoster(
  admin: Admin,
  args: {
    title?: string
    subtitle?: string
    tagline?: string
    date?: string
    time?: string
    venue?: string
    speakers?: Array<{ name?: string; role?: string; topic?: string }>
  },
) {
  const required: Record<string, string | undefined> = {
    title: args.title, date: args.date, time: args.time, venue: args.venue,
  }
  const missing = Object.entries(required)
    .filter(([, v]) => !(v ?? "").trim())
    .map(([k]) => k)
  if (missing.length) {
    return {
      need_more_info: true,
      missing_fields: missing,
      optional_fields: [
        "subtitle",
        "tagline (e.g. YOU'RE INVITED)",
        "speakers — names (FHI members get their photo automatically), each with optional role and topic",
      ],
      note: "Ask the admin for the missing details in ONE friendly question, then call this tool again with everything provided.",
    }
  }

  const speakers: Array<{ name: string; role?: string; topic?: string; photo: string | null }> = []
  for (const sp of (args.speakers ?? []).slice(0, 6)) {
    const nm = (sp?.name ?? "").trim()
    if (!nm) continue
    const match = (await findProfiles(admin, nm))[0]
    let photo: string | null = null
    let name = nm
    if (match) {
      const { data } = await admin.from("profiles").select("fullname, profile_url").eq("id", match.id).maybeSingle()
      photo = (data?.profile_url as string | null) ?? null
      name = data?.fullname?.trim().replace(/\s+/g, " ") || nm
    }
    speakers.push({ name, role: sp?.role?.trim() || undefined, topic: sp?.topic?.trim() || undefined, photo })
  }

  const payload = {
    title: (args.title ?? "").trim(),
    subtitle: (args.subtitle ?? "").trim(),
    tagline: (args.tagline ?? "").trim(),
    date: (args.date ?? "").trim(),
    time: (args.time ?? "").trim(),
    venue: (args.venue ?? "").trim(),
    speakers,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return {
    poster_ready: true,
    title: payload.title,
    // To email this poster, echo this ref into send_email.
    email_attachment_ref: { meeting_poster_payload: encoded },
    speakers_on_poster: speakers.map((sp) => `${sp.name}${sp.photo ? "" : " (no photo — shown with initial)"}`),
    note: "The meeting poster renders below this reply — the admin can click it to open the full-size PNG for download or sharing.",
    _names: speakers.map((sp) => sp.name),
    _cards: [
      {
        kind: "poster" as const,
        title: payload.title,
        subtitle: "📋 Meeting poster · click to open full size",
        image: `/api/admin/meeting-poster?d=${encoded}`,
      },
    ],
  }
}

/** Business cards — every member already has a share card at
 *  /og/business-card/[id] (the design they customized on their profile).
 *  The chat resolves names and hands back the card image + public link. */
async function businessCard(admin: Admin, args: { names?: string[] | string }) {
  const raw = Array.isArray(args.names)
    ? args.names
    : typeof args.names === "string"
      ? args.names.split(/,|\band\b/i)
      : []
  const queries = raw.map((n) => (n ?? "").trim()).filter(Boolean).slice(0, 6)
  if (!queries.length) return { error: "Give at least one member name." }

  const found: Array<{ id: string; name: string; role: string | null }> = []
  const misses: string[] = []
  for (const q of queries) {
    const m = (await findProfiles(admin, q))[0]
    if (!m) {
      misses.push(q)
      continue
    }
    const { data } = await admin
      .from("profiles")
      .select("id, fullname, role, is_deleted")
      .eq("id", m.id)
      .maybeSingle()
    if (!data || data.is_deleted === true) {
      misses.push(q)
      continue
    }
    found.push({ id: String(data.id), name: data.fullname?.trim().replace(/\s+/g, " ") || q, role: data.role ?? null })
  }
  if (!found.length) {
    return { error: `No account matches ${misses.map((m) => `"${m}"`).join(", ")} (checked with typo tolerance).` }
  }
  return {
    business_cards: found.map((p) => ({
      name: p.name,
      public_profile_link: `${SITE_URL}/business-card/${p.id}`,
      // To email this card, echo business_card_uid into send_email.
      business_card_uid: p.id,
      ...(p.role === "developer" ? { note: "internal partner account — shows the brand card, not a personal one" } : {}),
    })),
    ...(misses.length ? { not_found: misses } : {}),
    note: "Each business card renders below this reply — click one to open the full-size image. The public profile link can be shared with clients directly.",
    _names: found.map((p) => p.name),
    _cards: found.map((p): FhiChatCard => ({
      kind: "poster",
      title: p.name,
      subtitle: "💼 Business card · click to open full size",
      image: `/og/business-card/${p.id}`,
    })),
  }
}

export type FhiChatPrintCard = {
  member: { name: string; phoneDial: string; phoneLocal: string; email: string; avatarUrl: string | null; initials: string }
  designs: string[]
}

/** Printable business card (front + back) — the chat UI renders it with the
 *  SAME canvas renderer as the Business Card maker, so every design is
 *  pixel-identical and downloads at print size. This tool only gathers the
 *  member's card data and which design(s) to draw. */
async function printBusinessCard(admin: Admin, args: { name?: string; design?: string }) {
  const q = (args.name ?? "").trim()
  if (!q) return { error: "Give the member's name." }
  const m = (await findProfiles(admin, q))[0]
  if (!m) return { error: `No account matches "${q}" (checked with typo tolerance).` }
  const { data: p, error } = await admin
    .from("profiles")
    .select("id, fullname, profile_url, metadata")
    .eq("id", m.id)
    .maybeSingle()
  if (error || !p) throw new Error(error?.message ?? "Profile fetch failed")

  const meta = (p.metadata ?? {}) as Record<string, unknown>
  const email = await admin.auth.admin
    .getUserById(String(p.id))
    .then((r) => r.data?.user?.email?.trim() ?? "")
    .catch(() => "")
  // metadata stores the picker value ("+971" or "+971-AE") — the dial is the
  // part before the dash, same rule as the maker's dialFromValue.
  const ccRaw = typeof meta.phone_country_code === "string" ? meta.phone_country_code.trim() : ""
  const phoneDial = ccRaw ? ccRaw.split("-")[0] : "+971"
  const phoneLocal = typeof meta.phone_number === "string" ? meta.phone_number.replace(/\D/g, "") : ""
  const name = (p.fullname ?? "").trim().replace(/\s+/g, " ") || q
  const parts = name.split(/\s+/).filter(Boolean)
  const initials = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?"

  const saved =
    typeof meta.business_card_design === "string" && isCardDesignId(meta.business_card_design)
      ? meta.business_card_design
      : "classic"
  const req = (args.design ?? "").trim().toLowerCase()
  const designs: string[] = req === "all" ? CARD_DESIGNS.map((d) => d.id) : isCardDesignId(req) ? [req] : [saved]

  return {
    print_card_for: name,
    designs_used: designs.map((id) => CARD_DESIGNS.find((d) => d.id === id)?.name ?? id),
    available_designs: CARD_DESIGNS.map((d) => `${d.id} (${d.name})`),
    contact_on_card: { phone: phoneLocal ? `${phoneDial} ${phoneLocal}` : "none saved", email: email || "none" },
    note: "The printable card renders below this reply — FRONT and BACK for each design, each with a Download button that produces the print-ready 2100×1200 PNG, exactly like the Business Card maker.",
    _names: [name],
    _printCards: [
      {
        member: { name, phoneDial, phoneLocal, email, avatarUrl: (p.profile_url as string | null) ?? null, initials },
        designs,
      },
    ] satisfies FhiChatPrintCard[],
  }
}

/** Who is asking the chat — used by send_email ("me") and the signature. */
export type FhiChatSender = { email: string | null; name: string | null }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Send an email straight from the chat — "email me this report", "send this
 *  to Michelle". Composed by the model from the conversation, delivered
 *  through the same branded mailer as the admin Emails page, signed by the
 *  admin who asked. One recipient per call. */
async function sendChatEmail(
  admin: Admin,
  args: {
    to?: string
    subject?: string
    message?: string
    /** Poster references echoed from a poster tool's result — attached inline. */
    birthday_poster_uid?: string
    birthday_poster_design?: string
    meeting_poster_payload?: string
    business_card_uid?: string
  },
  sender?: FhiChatSender,
) {
  const subject = (args.subject ?? "").trim().slice(0, 150)
  const message = (args.message ?? "").trim()
  if (!subject || !message) return { error: "Both subject and message are required." }
  if (message.length > 8000) return { error: "Message too long — keep it under 8000 characters." }

  const toRaw = (args.to ?? "").trim()
  let to: string | null = null
  let toLabel = toRaw
  if (!toRaw || /^me$/i.test(toRaw)) {
    to = sender?.email ?? null
    toLabel = "you"
    if (!to) return { error: "Couldn't determine your own email — give the address explicitly." }
  } else if (EMAIL_RE.test(toRaw)) {
    to = toRaw
  } else {
    const m = (await findProfiles(admin, toRaw))[0]
    if (!m) return { error: `No member matches "${toRaw}" — give an email address or a member's name.` }
    toLabel = m.fullname?.trim() || toRaw
    to = await admin.auth.admin
      .getUserById(m.id)
      .then((r) => r.data?.user?.email?.trim() ?? null)
      .catch(() => null)
    if (!to) return { error: `${toLabel} has no email on file.` }
  }

  // Attach a just-generated visual when the admin asked to email it: the
  // renderers run in-process (no session-guarded HTTP hop).
  let inlineImage: { content: Buffer; filename: string; alt: string } | null = null
  try {
    if (args.birthday_poster_uid?.trim()) {
      const { data: p } = await admin
        .from("profiles")
        .select("fullname, fname, profile_url")
        .eq("id", args.birthday_poster_uid.trim())
        .maybeSingle()
      if (p) {
        const png = await renderBirthdayPosterPng({
          name: (p.fullname ?? p.fname ?? "You").trim().replace(/\s+/g, " "),
          photoUrl: p.profile_url ?? null,
          designId: args.birthday_poster_design?.trim() || undefined,
        })
        if (png) inlineImage = { content: png, filename: "happy-birthday.png", alt: "Birthday poster" }
      }
    } else if (args.meeting_poster_payload?.trim()) {
      const raw = JSON.parse(Buffer.from(args.meeting_poster_payload.trim(), "base64url").toString("utf8")) as MeetingPosterData
      const png = await renderMeetingPosterPng(raw)
      if (png) inlineImage = { content: png, filename: "meeting-poster.png", alt: "Meeting poster" }
    } else if (args.business_card_uid?.trim()) {
      const res = await fetch(`${SITE_URL}/og/business-card/${encodeURIComponent(args.business_card_uid.trim())}`, { cache: "no-store" })
      if (res.ok) {
        inlineImage = { content: Buffer.from(await res.arrayBuffer()), filename: "business-card.png", alt: "Business card" }
      }
    }
  } catch {
    // A failed attachment must not block the email — it goes out as text.
  }

  await sendAdminDirectEmail({
    to,
    subject,
    message,
    senderName: sender?.name?.trim() || "The FHI Global Team",
    inlineImage,
  })
  return {
    sent: true,
    to,
    recipient: toLabel,
    subject,
    attachment_included: Boolean(inlineImage),
    note: "Delivered from info@fhiglobal.ae in the FHI brand shell, signed with the admin's name. Confirm to the admin what was sent and to whom" +
      (inlineImage ? ", including that the image is embedded in the email." : "."),
  }
}

/** Bulk congratulations for the period's top sellers. Two modes:
 *  send_directly=true → each agent receives their email (with certificate) at
 *  their own address; otherwise every email is a labeled PREVIEW delivered to
 *  the asking admin's inbox. The model sets the mode from the admin's words. */
async function congratulateTopAgents(
  admin: Admin,
  args: {
    scope?: string; year?: number; month?: number; from_date?: string; to_date?: string
    limit?: number; custom_note?: string; send_directly?: boolean
  },
  sender?: FhiChatSender,
) {
  if (!sender?.email) return { error: "Couldn't determine your email to deliver the previews." }
  const now = new Date()
  const scope = normScope(args.scope)
  let { from, to } = periodRange(scope, args.year ?? now.getUTCFullYear(), args.month ?? now.getUTCMonth() + 1)
  if (args.from_date?.trim()) from = args.from_date.trim()
  if (args.to_date?.trim()) to = args.to_date.trim()
  const periodLabel =
    args.from_date || args.to_date
      ? `${from ?? "…"} to ${to ?? "today"}`
      : scope === "all" ? "all-time" : scope

  const sales = (await fetchAllSales(admin)).filter(
    (s) => s.validation_status === "validated" && inRange(s, from, to),
  )
  const byAgent = new Map<string, { deals: number; value: number }>()
  for (const s of sales) {
    // A shared sale counts for each agent on it, at their share.
    for (const c of saleCredits(s)) {
      const t = byAgent.get(c.agentId) ?? { deals: 0, value: 0 }
      t.deals += 1
      t.value += c.value
      byAgent.set(c.agentId, t)
    }
  }
  const ranked = [...byAgent.entries()]
    .map(([id, t]) => ({ id, deals: t.deals, value: t.value }))
    .sort((a, b) => b.value - a.value || b.deals - a.deals)
    .slice(0, Math.min(Math.max(args.limit ?? 3, 1), 8))
  if (!ranked.length) return { error: `No validated sales in that period (${periodLabel}) — nobody to congratulate.` }

  const direct = args.send_directly === true
  const names = await nameMaps(admin, sales)
  const results: Array<{ rank: number; agent: string; total: string; recipient: string }> = []
  const skipped: string[] = []
  for (const [i, l] of ranked.entries()) {
    const agentName = names.agent.get(l.id)?.name ?? "Agent"
    const agentEmail = await admin.auth.admin
      .getUserById(l.id)
      .then((r) => r.data?.user?.email?.trim() ?? null)
      .catch(() => null)
    if (direct && !agentEmail) {
      skipped.push(`${agentName} (no email on file)`)
      continue
    }
    // Their personalized Top Seller certificate — a render failure never
    // blocks the congratulation itself.
    const certificatePng = await renderTopSellerCertificatePng({
      name: agentName,
      photoUrl: names.agent.get(l.id)?.image ?? null,
      totalLabel: AED(l.value),
      dealsLabel: `${l.deals} ${l.deals === 1 ? "deal" : "deals"}`,
      periodLabel,
    }).catch(() => null)
    await sendCongratsEmail({
      to: direct ? (agentEmail as string) : sender.email,
      agentName,
      rank: i + 1,
      deals: l.deals,
      totalLabel: AED(l.value),
      periodLabel,
      senderName: sender.name ?? null,
      customNote: args.custom_note ?? null,
      previewFor: direct ? null : { name: agentName, email: agentEmail ?? "no email on file" },
      certificatePng,
    })
    results.push({
      rank: i + 1,
      agent: agentName,
      total: AED(l.value),
      recipient: direct ? (agentEmail as string) : `${sender.email} (preview)`,
    })
  }
  return {
    period: periodLabel,
    mode: direct ? "SENT DIRECTLY to each agent's own email" : "previews delivered to the admin's inbox only",
    congratulated: results,
    ...(skipped.length ? { skipped } : {}),
    note: direct
      ? "The congratulation emails (with each agent's Top Seller certificate) were sent DIRECTLY to the agents. Confirm to the admin exactly who received one."
      : "All congratulation emails were delivered to the ADMIN'S OWN inbox as labeled previews — none were sent to the agents.",
    _names: results.map((p) => p.agent),
    _cards: ranked.map((l, i): FhiChatCard => ({
      kind: "agent",
      rank: i + 1,
      title: names.agent.get(l.id)?.name ?? "Agent",
      subtitle: `🏆 ${AED(l.value)} · ${direct ? "emailed 🎉" : "preview in your inbox"}`,
      image: names.agent.get(l.id)?.image ?? null,
    })),
  }
}

/** Internal dashboard/auth paths — excluded from public traffic answers. */
const INTERNAL_PATH_RE =
  /^\/(admin|superadmin|agent|teamleader|unitmanager|member|secretary|teamsecretary|developer|editor|dashboard|login|staff-login|register|account-inactive)(\/|$)/

async function websiteTraffic(args: { days?: number; from_date?: string; to_date?: string; country?: string }) {
  if (!gaConfigured()) {
    return { error: "Google Analytics is not connected on this server." }
  }
  const startDate = (args.from_date ?? "").trim() || `${Math.min(Math.max(args.days ?? 7, 1), 365)}daysAgo`
  const endDate = (args.to_date ?? "").trim() || "today"
  const dateRanges = [{ startDate, endDate }]

  // The equal-length window right before this one, for "vs previous period"
  // context (GA date ranges are inclusive on both ends).
  let prevRange: { startDate: string; endDate: string }
  if ((args.from_date ?? "").trim()) {
    const DAY = 86400e3
    const f = Date.parse(`${startDate}T00:00:00Z`)
    const e = Date.parse(`${(args.to_date ?? "").trim() || new Date().toISOString().slice(0, 10)}T00:00:00Z`)
    const len = Math.max(e - f, 0) + DAY
    const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
    prevRange = { startDate: iso(f - len), endDate: iso(f - DAY) }
  } else {
    const n = Math.min(Math.max(args.days ?? 7, 1), 365)
    prevRange = { startDate: `${2 * n + 1}daysAgo`, endDate: `${n + 1}daysAgo` }
  }

  const [totals, pages, channels, countries, sources, cities, devices, leadEvents, realtime, prevTotals, daily] = await Promise.all([
    gaRunReport({
      dateRanges,
      metrics: [
        { name: "activeUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "newUsers" },
        { name: "averageSessionDuration" },
        { name: "engagementRate" },
      ],
    }),
    gaRunReport({
      dateRanges,
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 40,
    }),
    gaRunReport({
      dateRanges,
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 10,
    }),
    gaRunReport({
      dateRanges,
      dimensions: [{ name: "country" }, { name: "countryId" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 12,
    }),
    gaRunReport({
      dateRanges,
      dimensions: [{ name: "sessionSource" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 20,
    }),
    gaRunReport({
      dateRanges,
      dimensions: [{ name: "city" }, { name: "country" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: args.country?.trim() ? 50 : 30,
      ...(args.country?.trim()
        ? {
            dimensionFilter: {
              filter: {
                fieldName: "country",
                stringFilter: { matchType: "CONTAINS", value: args.country.trim(), caseSensitive: false },
              },
            },
          }
        : {}),
    }),
    gaRunReport({
      dateRanges,
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 5,
    }),
    gaRunReport({
      dateRanges,
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          inListFilter: { values: ["click_whatsapp", "click_phone", "click_email", "submit_inquiry"] },
        },
      },
    }).catch(() => null),
    gaRunRealtime({ metrics: [{ name: "activeUsers" }] }).catch(() => null),
    gaRunReport({
      dateRanges: [prevRange],
      metrics: [
        { name: "activeUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "newUsers" },
      ],
    }).catch(() => null),
    gaRunReport({
      dateRanges,
      dimensions: [{ name: "date" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
      limit: 366,
    }).catch(() => null),
  ])

  // Day-by-day visitors — the trend. GA returns dates as "20260827"; long
  // ranges collapse into weeks so the answer stays readable.
  let byDay = (daily?.rows ?? []).map((r) => {
    const raw = r.dimensionValues?.[0]?.value ?? ""
    return {
      date: `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`,
      visitors: Number(r.metricValues?.[0]?.value ?? 0),
    }
  })
  let trendGranularity: "day" | "week" = "day"
  if (byDay.length > 45) {
    trendGranularity = "week"
    const weeks = new Map<string, number>()
    for (const d of byDay) {
      const dt = new Date(`${d.date}T00:00:00Z`)
      dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7)) // Monday start
      const key = dt.toISOString().slice(0, 10)
      weeks.set(key, (weeks.get(key) ?? 0) + d.visitors)
    }
    byDay = [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, visitors]) => ({ date, visitors }))
  }
  // Simple direction: average of the second half vs the first half.
  let trendDirection = "not enough data"
  if (byDay.length >= 4) {
    const half = Math.floor(byDay.length / 2)
    const avg = (rows: typeof byDay) => rows.reduce((a, r) => a + r.visitors, 0) / Math.max(rows.length, 1)
    const a = avg(byDay.slice(0, half))
    const b = avg(byDay.slice(byDay.length - half))
    trendDirection = a === 0 ? (b > 0 ? "rising" : "flat") : `${b >= a * 1.1 ? "rising" : b <= a * 0.9 ? "falling" : "flat"} (${pctChange(Math.round(b * 10), Math.round(a * 10))} second half vs first half)`
  }

  const countryRows = (countries.rows ?? [])
    .map((r) => ({
      country: r.dimensionValues?.[0]?.value ?? "",
      iso: (r.dimensionValues?.[1]?.value ?? "").toLowerCase(),
      visitors: Number(r.metricValues?.[0]?.value ?? 0),
    }))
    .filter((c) => c.country && c.country !== "(not set)" && c.visitors > 0)

  // Exact origins ("google", "facebook.com", "bing") — variants of the same
  // platform merge into one row, so facebook.com + m.facebook.com = facebook.
  const sourceTotals = new Map<string, number>()
  for (const r of sources.rows ?? []) {
    let s = (r.dimensionValues?.[0]?.value ?? "").toLowerCase().replace(/^www\./, "")
    if (!s || s === "(not set)") continue
    if (s === "(direct)") s = "direct"
    s = s.replace(/^(m|l|lm|web)\.facebook\.com$/, "facebook.com")
    if (s.includes("instagram")) s = "instagram.com"
    sourceTotals.set(s, (sourceTotals.get(s) ?? 0) + Number(r.metricValues?.[0]?.value ?? 0))
  }
  const sourceRows = [...sourceTotals.entries()]
    .map(([source, sessions]) => ({ source, sessions }))
    .sort((a, b) => b.sessions - a.sessions)

  const t = totals.rows?.[0]?.metricValues ?? []
  const num = (i: number) => Number(t[i]?.value ?? 0)
  const pt = prevTotals?.rows?.[0]?.metricValues ?? []
  const pnum = (i: number) => Number(pt[i]?.value ?? 0)
  const deviceRows = (devices.rows ?? []).map((r) => {
    const v = Number(r.metricValues?.[0]?.value ?? 0)
    return {
      device: r.dimensionValues?.[0]?.value ?? "?",
      visitors: v,
      percent: num(0) > 0 ? Math.round((v / num(0)) * 100) : 0,
    }
  })
  const leadCounts = Object.fromEntries(
    (leadEvents?.rows ?? []).map((r) => [
      r.dimensionValues?.[0]?.value ?? "?",
      Number(r.metricValues?.[0]?.value ?? 0),
    ]),
  )
  return {
    period: { from: startDate, to: endDate },
    note: "public website only (internal dashboard pages excluded from top pages); GA data can lag up to 24-48h",
    _stats: [
      stat("Visitors", num(0), prevTotals ? pctChange(num(0), pnum(0)) : null, prevTotals ? `vs ${pnum(0).toLocaleString("en-AE")} before` : null),
      stat("Sessions", num(1), prevTotals ? pctChange(num(1), pnum(1)) : null),
      stat("Page views", num(2), prevTotals ? pctChange(num(2), pnum(2)) : null),
      stat("New visitors", num(3), null, `${Math.max(0, num(0) - num(3)).toLocaleString("en-AE")} returning`),
      stat("Avg. time on site", `${Math.floor(num(4) / 60)}m ${Math.round(num(4) % 60)}s`, null, `${Math.round(num(5) * 100)}% engaged`),
    ],
    visitors: num(0),
    sessions: num(1),
    page_views: num(2),
    new_visitors: num(3),
    returning_visitors: Math.max(0, num(0) - num(3)),
    ...(byDay.length
      ? {
          visitors_trend: {
            granularity: trendGranularity,
            direction: trendDirection,
            [trendGranularity === "week" ? "by_week" : "by_day"]: byDay,
          },
        }
      : {}),
    ...(prevTotals
      ? {
          previous_period: {
            from: prevRange.startDate,
            to: prevRange.endDate,
            visitors: pnum(0),
            sessions: pnum(1),
            page_views: pnum(2),
            new_visitors: pnum(3),
          },
          change_vs_previous: {
            visitors: pctChange(num(0), pnum(0)),
            sessions: pctChange(num(1), pnum(1)),
            page_views: pctChange(num(2), pnum(2)),
          },
        }
      : {}),
    avg_session_duration: `${Math.floor(num(4) / 60)}m ${Math.round(num(4) % 60)}s`,
    engagement_rate_percent: Math.round(num(5) * 100),
    visitors_by_device: deviceRows,
    lead_clicks: {
      whatsapp: leadCounts["click_whatsapp"] ?? 0,
      phone: leadCounts["click_phone"] ?? 0,
      email: leadCounts["click_email"] ?? 0,
      inquiries_submitted: leadCounts["submit_inquiry"] ?? 0,
      note: "tracked since 1 Sep 2026 when lead tracking went live",
    },
    active_right_now: realtime ? Number(realtime.rows?.[0]?.metricValues?.[0]?.value ?? 0) : null,
    top_pages: (pages.rows ?? [])
      .map((r) => ({ path: r.dimensionValues?.[0]?.value ?? "", views: Number(r.metricValues?.[0]?.value ?? 0) }))
      .filter((p) => p.path && !INTERNAL_PATH_RE.test(p.path))
      .slice(0, 10),
    traffic_sources: (channels.rows ?? []).map((r) => ({
      channel: r.dimensionValues?.[0]?.value ?? "?",
      sessions: Number(r.metricValues?.[0]?.value ?? 0),
    })),
    visitors_by_country: countryRows.map(({ country, visitors }) => ({ country, visitors })),
    visitors_by_city: (cities.rows ?? [])
      .map((r) => ({
        city: r.dimensionValues?.[0]?.value ?? "",
        country: r.dimensionValues?.[1]?.value ?? "",
        visitors: Number(r.metricValues?.[0]?.value ?? 0),
      }))
      .filter((c) => c.city && c.city !== "(not set)" && c.visitors > 0)
      .slice(0, 20),
    traffic_by_exact_source: sourceRows.slice(0, 10),
    _cards: [
      // Where from — real site icons (Google's favicon service; *.google.com
      // is an allowed image host site-wide).
      ...sourceRows.slice(0, 4).map((s): FhiChatCard => ({
        kind: "developer",
        title: s.source === "direct" ? "Direct / typed the address" : s.source.replace(/\.(com|net|org|ae)$/, ""),
        subtitle: `${s.sessions} session${s.sessions === 1 ? "" : "s"}`,
        image: s.source.includes(".")
          ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(s.source)}&sz=64`
          : s.source === "google"
            ? "https://www.google.com/s2/favicons?domain=google.com&sz=64"
            : null,
      })),
      ...countryRows.slice(0, 6).map((c): FhiChatCard => ({
        kind: "project",
        title: c.country,
        subtitle: `${c.visitors} visitor${c.visitors === 1 ? "" : "s"}`,
        // flagcdn.com is already an allowed image host site-wide.
        image: c.iso && /^[a-z]{2}$/.test(c.iso) ? `https://flagcdn.com/w80/${c.iso}.png` : null,
      })),
    ],
    _names: [...sourceRows.slice(0, 10).map((s) => s.source), ...countryRows.map((c) => c.country)],
    _charts: [
      ...(byDay.length > 1
        ? [{ kind: "trend" as const, title: `Visitors by ${trendGranularity}`, points: byDay }]
        : []),
      ...(deviceRows.length
        ? [{
            kind: "shares" as const,
            title: "Devices",
            rows: deviceRows.map((d) => ({ label: d.device, value: d.visitors, display: `${d.visitors} · ${d.percent}%` })),
          }]
        : []),
      ...(sourceRows.length
        ? [{
            kind: "shares" as const,
            title: "Traffic sources",
            rows: sourceRows.slice(0, 6).map((s) => ({
              label: s.source === "direct" ? "Direct" : s.source.replace(/\.(com|net|org|ae)$/, ""),
              value: s.sessions,
              display: `${s.sessions}`,
              // Real site icon, like the source cards ("bing" → bing.com).
              icon:
                s.source === "direct"
                  ? null
                  : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(s.source.includes(".") ? s.source : `${s.source}.com`)}&sz=64`,
            })),
          }]
        : []),
      ...(countryRows.length
        ? [{
            kind: "shares" as const,
            title: "Visitors by country",
            rows: countryRows.slice(0, 6).map((c) => ({
              label: c.country,
              value: c.visitors,
              display: `${c.visitors}`,
              iso: /^[a-z]{2}$/.test(c.iso) ? c.iso : null,
            })),
          }]
        : []),
    ] satisfies FhiChatChart[],
  }
}

async function searchKeywords(args: { days?: number; from_date?: string; to_date?: string; limit?: number }) {
  // GSC wants explicit dates and its data lags ~2 days behind.
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const end = (args.to_date ?? "").trim() || iso(new Date())
  let start = (args.from_date ?? "").trim()
  if (!start) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - Math.min(Math.max(args.days ?? 28, 1), 480))
    start = iso(d)
  }
  const limit = Math.min(Math.max(args.limit ?? 15, 1), 50)

  const [queries, pages] = await Promise.all([
    gscQuery({ startDate: start, endDate: end, dimensions: ["query"], rowLimit: limit }),
    gscQuery({ startDate: start, endDate: end, dimensions: ["page"], rowLimit: 10 }),
  ])

  const totals = (queries.rows ?? []).reduce<{ clicks: number; impressions: number }>(
    (a, r) => ({ clicks: a.clicks + (r.clicks ?? 0), impressions: a.impressions + (r.impressions ?? 0) }),
    { clicks: 0, impressions: 0 },
  )
  return {
    period: { from: start, to: end },
    note: "Google Search performance (Search Console); data lags ~2 days",
    top_search_keywords: (queries.rows ?? []).map((r) => ({
      keyword: r.keys?.[0] ?? "?",
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      avg_position: r.position != null ? Math.round(r.position * 10) / 10 : null,
    })),
    top_pages_in_google: (pages.rows ?? []).map((r) => ({
      page: (r.keys?.[0] ?? "").replace(/^https?:\/\/[^/]+/, "") || "/",
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
    })),
    keyword_totals: totals,
    _names: (queries.rows ?? []).map((r) => r.keys?.[0]).filter((k): k is string => Boolean(k)),
  }
}

// ─── Leads: inquiries, contact messages, Buyers Link briefs, inbox replies ───

type LeadsArgs = {
  from_date?: string
  to_date?: string
  days?: number
  source?: "all" | "inquiries" | "contact" | "buyers_link" | "inbox"
  agent_name?: string
  project_name?: string
  developer_name?: string
  only_unanswered?: boolean
  limit?: number
}

/**
 * Every way a prospect reaches the company, in one answer: project inquiries
 * (the Inquire forms on project, landing and developer pages), contact messages (/contact), Buyers
 * Link and Sellers Link briefs (each agent's own link — graded like the
 * dashboard: priority / qualified / nurture / info) and replies that landed in
 * the company inbox. Counts per source with the previous period for context,
 * the breakdowns an admin asks for (which project, which agent, which grade)
 * and the newest entries with contact details for follow-up. "Unanswered"
 * means: an inquiry still marked new, a contact message not yet read, an
 * inbound reply not yet read.
 */
async function leadsOverview(admin: Admin, args: LeadsArgs) {
  let from = (args.from_date ?? "").trim()
  if (!from) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - Math.min(Math.max(args.days ?? 30, 1), 730))
    from = d.toISOString().slice(0, 10)
  }
  const to = (args.to_date ?? "").trim() || null
  const source = args.source ?? "all"
  const want = (s: LeadsArgs["source"]) => source === "all" || source === s
  const limit = Math.min(Math.max(args.limit ?? 15, 1), 60)
  const unansweredOnly = args.only_unanswered === true
  const prev = previousWindow(from, to)
  const contains = (hay: string | null | undefined, needle: string | undefined) =>
    !needle?.trim() || (hay ?? "").toLowerCase().includes(needle.trim().toLowerCase())

  // Buyers Link briefs can be narrowed to the agent whose link they came through.
  let agentIds: string[] | null = null
  let agentMatch: string[] | null = null
  if (args.agent_name?.trim()) {
    const found = await findProfiles(admin, args.agent_name)
    if (found.length === 0) return { error: `No FHI member matching "${args.agent_name}"` }
    agentIds = found.map((p) => p.id)
    // Several members can share a first name; the briefs of all of them are
    // included and by_agent says whose link each came through.
    agentMatch = found.map((p) => p.fullname ?? "Unknown")
  }

  const inRange = <T extends { created_at: string }>(rows: T[], f: string, t: string | null) =>
    rows.filter((r) => r.created_at >= f && (!t || r.created_at < `${t}T00:00:00Z`))

  type Inq = { id: string; name: string | null; email: string | null; phone_country_code: string | null; phone: string | null; looking_for: string | null; property_category: string | null; project_name: string | null; developer_name: string | null; source: string | null; status: string | null; created_at: string }
  type Contact = { id: string; name: string | null; email: string | null; phone: string | null; company: string | null; subject: string | null; message: string | null; status: string | null; read_at: string | null; created_at: string }
  type Reply = { id: string; inquiry_id: string | null; from_name: string | null; from_email: string | null; subject: string | null; read_at: string | null; created_at: string }

  const [inqRes, contactRes, briefRes, replyRes] = await Promise.all([
    want("inquiries")
      ? admin.from("inquiries").select("id, name, email, phone_country_code, phone, looking_for, property_category, project_name, developer_name, source, status, created_at").is("deleted_at", null).gte("created_at", prev.from).order("created_at", { ascending: false }).limit(3000)
      : Promise.resolve({ data: [] as Inq[], error: null }),
    want("contact")
      ? admin.from("contact_submissions").select("id, name, email, phone, company, subject, message, status, read_at, created_at").is("deleted_at", null).gte("created_at", prev.from).order("created_at", { ascending: false }).limit(3000)
      : Promise.resolve({ data: [] as Contact[], error: null }),
    want("buyers_link")
      ? (() => {
          let q = admin.from("buyer_link_leads").select(BUYER_LEAD_COLUMNS).gte("created_at", prev.from).order("created_at", { ascending: false }).limit(3000)
          if (agentIds) q = q.in("agent_id", agentIds)
          return q
        })()
      : Promise.resolve({ data: [] as BuyerLead[], error: null }),
    want("inbox")
      ? admin.from("inquiry_emails").select("id, inquiry_id, from_name, from_email, subject, read_at, created_at").eq("direction", "inbound").is("owner_id", null).gte("created_at", prev.from).order("created_at", { ascending: false }).limit(3000)
      : Promise.resolve({ data: [] as Reply[], error: null }),
  ])
  for (const r of [inqRes, contactRes, briefRes, replyRes]) if (r.error) throw new Error(r.error.message)

  const count = <T,>(rows: T[], key: (r: T) => string | null | undefined, top = 8) => {
    const m = new Map<string, number>()
    for (const r of rows) {
      const k = (key(r) ?? "").trim() || "Not given"
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([name, n]) => ({ name, count: n }))
  }
  const phone = (code: string | null | undefined, num: string | null | undefined) => {
    const d = waDigits(code, num)
    return d ? `+${d}` : null
  }
  const when = (iso: string) => iso.slice(0, 16).replace("T", " ")

  const out: Record<string, unknown> = {
    period: { from, to: to ?? "today" },
    previous_period: { from: prev.from, to: prev.to },
    filters: { source, agent_name_matched: agentMatch, project: args.project_name ?? null, developer: args.developer_name ?? null, only_unanswered: unansweredOnly },
  }
  let total = 0
  let prevTotal = 0
  let unanswered = 0

  if (want("inquiries")) {
    const all = ((inqRes.data ?? []) as Inq[]).filter((r) => contains(r.project_name, args.project_name) && contains(r.developer_name, args.developer_name))
    const cur = inRange(all, from, to)
    const prv = inRange(all, prev.from, prev.to)
    const open = cur.filter((r) => (r.status ?? "new") === "new")
    const list = (unansweredOnly ? open : cur).slice(0, limit)
    total += cur.length; prevTotal += prv.length; unanswered += open.length
    out.project_inquiries = {
      total: cur.length,
      previous_period_total: prv.length,
      change_vs_previous: pctChange(cur.length, prv.length),
      unanswered_still_new: open.length,
      by_status: count(cur, (r) => r.status ?? "new"),
      by_project: count(cur, (r) => r.project_name),
      by_developer: count(cur, (r) => r.developer_name),
      // Which kind of page the lead came from: a project page, a search landing page ("landing:<slug>"), a developer page.
      by_page: count(cur, (r) => leadSourceLabel(r.source)),
      by_looking_for: count(cur, (r) => r.looking_for),
      newest: list.map((r) => ({ when: when(r.created_at), name: r.name, project: r.project_name, developer: r.developer_name, page: leadSourceLabel(r.source), looking_for: r.looking_for, phone: phone(r.phone_country_code, r.phone), email: r.email, status: r.status ?? "new" })),
      where_in_dashboard: "Leads (Communication) — each inquiry opens with its email thread",
    }
  }

  if (want("contact")) {
    const all = (contactRes.data ?? []) as Contact[]
    const cur = inRange(all, from, to)
    const prv = inRange(all, prev.from, prev.to)
    const unread = cur.filter((r) => !r.read_at && (r.status ?? "new") === "new")
    const list = (unansweredOnly ? unread : cur).slice(0, limit)
    total += cur.length; prevTotal += prv.length; unanswered += unread.length
    out.contact_messages = {
      total: cur.length,
      previous_period_total: prv.length,
      change_vs_previous: pctChange(cur.length, prv.length),
      unread: unread.length,
      by_status: count(cur, (r) => r.status ?? "new"),
      newest: list.map((r) => ({ when: when(r.created_at), name: r.name, subject: r.subject, company: r.company, phone: r.phone, email: r.email, status: r.status ?? "new", read: Boolean(r.read_at), message_preview: (r.message ?? "").slice(0, 160) })),
      where_in_dashboard: "Communication → Contact Inbox",
    }
  }

  if (want("buyers_link")) {
    const all = (briefRes.data ?? []) as BuyerLead[]
    const cur = inRange(all, from, to)
    const prv = inRange(all, prev.from, prev.to)
    total += cur.length; prevTotal += prv.length
    const ids = [...new Set(cur.map((b) => String(b.agent_id)))]
    const names = new Map<string, string>()
    if (ids.length) {
      const { data } = await admin.from("profiles").select("id, fullname").in("id", ids)
      for (const p of (data ?? []) as { id: string; fullname: string | null }[]) names.set(String(p.id), p.fullname ?? "Unknown")
    }
    const graded = cur.map((b) => ({ b, grade: b.kind === "seller" ? null : leadGrade(b), agent: names.get(String(b.agent_id)) ?? "Unknown" }))
    const byAgent = new Map<string, { briefs: number; buyers: number; sellers: number; priority: number; qualified: number }>()
    for (const g of graded) {
      const a = byAgent.get(g.agent) ?? { briefs: 0, buyers: 0, sellers: 0, priority: 0, qualified: 0 }
      a.briefs++
      if (g.b.kind === "seller") a.sellers++
      else a.buyers++
      if (g.grade === "priority") a.priority++
      if (g.grade === "qualified") a.qualified++
      byAgent.set(g.agent, a)
    }
    const prof = (b: BuyerLead) => (b.profile ?? {}) as Record<string, string | string[] | undefined>
    const label = (b: BuyerLead, key: string) => {
      const v = prof(b)[key]
      if (b.kind === "seller") return sellerAnswerLabel(key as Parameters<typeof sellerAnswerLabel>[0], v)
      return answerLabel(key as Parameters<typeof answerLabel>[0], v)
    }
    out.buyers_link_briefs = {
      total: cur.length,
      previous_period_total: prv.length,
      change_vs_previous: pctChange(cur.length, prv.length),
      buyers: cur.filter((b) => b.kind !== "seller").length,
      sellers: cur.filter((b) => b.kind === "seller").length,
      by_grade_buyers_only: count(graded.filter((g) => g.grade), (g) => LEAD_GRADES[g.grade as LeadGrade].label),
      grade_meaning: Object.fromEntries(Object.values(LEAD_GRADES).map((v) => [v.label, v.why])),
      by_agent: [...byAgent.entries()].map(([name, a]) => ({ agent: name, ...a })).sort((a, b) => b.briefs - a.briefs).slice(0, 15),
      by_budget: count(cur.filter((b) => b.kind !== "seller"), (b) => budgetLabel(b.budget)),
      by_goal: count(cur.filter((b) => b.kind !== "seller"), (b) => label(b, "goal")),
      by_readiness: count(cur.filter((b) => b.kind !== "seller"), (b) => label(b, "readiness")),
      newest: graded.slice(0, limit).map(({ b, grade, agent }) => ({
        when: when(b.created_at),
        kind: b.kind === "seller" ? "seller" : "buyer",
        grade: grade ? LEAD_GRADES[grade].label : null,
        name: b.name,
        agent,
        whatsapp: phone(b.whatsapp_code, b.whatsapp),
        email: b.email,
        budget: budgetLabel(b.budget),
        ...(b.kind === "seller"
          ? { property: label(b, "property_type"), completion: label(b, "completion"), sell_timeline: label(b, "sell_timeline") }
          : {
              goal: label(b, "goal"),
              timeline: label(b, "buy_timeline"),
              readiness: label(b, "readiness"),
              reach_by: label(b, "contact_channel"),
              lives: label(b, "residence"),
              income: label(b, "income_source"),
              profession: typeof prof(b).profession === "string" ? (prof(b).profession as string) : null,
              position: typeof prof(b).position === "string" ? (prof(b).position as string) : null,
            }),
        message: (b.message ?? "").slice(0, 160) || null,
      })),
      where_in_dashboard: "Communication → Buyer Leads (admins see every agent's briefs, read-only)",
    }
  }

  if (want("inbox")) {
    const all = (replyRes.data ?? []) as Reply[]
    const cur = inRange(all, from, to)
    const prv = inRange(all, prev.from, prev.to)
    const unread = cur.filter((r) => !r.read_at)
    const list = (unansweredOnly ? unread : cur).slice(0, limit)
    total += cur.length; prevTotal += prv.length; unanswered += unread.length
    out.inbox_replies = {
      total: cur.length,
      previous_period_total: prv.length,
      change_vs_previous: pctChange(cur.length, prv.length),
      unread: unread.length,
      newest: list.map((r) => ({ when: when(r.created_at), from: r.from_name || r.from_email, email: r.from_email, subject: r.subject, read: Boolean(r.read_at), tied_to_inquiry: Boolean(r.inquiry_id) })),
      where_in_dashboard: "Leads → Inbox",
    }
  }

  out.all_sources = {
    total_leads: total,
    previous_period_total: prevTotal,
    change_vs_previous: pctChange(total, prevTotal),
    waiting_for_a_reply: unanswered,
    note: "Buyers Link briefs have no read/answered state — they go straight to the agent's WhatsApp",
  }
  const srcCount = (k: string) => Number((out[k] as { total?: number } | undefined)?.total ?? 0)
  const grades = ((out.buyers_link_briefs as { by_grade_buyers_only?: ChartCount[] } | undefined)?.by_grade_buyers_only ?? [])
  const inqProjects = ((out.project_inquiries as { by_project?: ChartCount[] } | undefined)?.by_project ?? [])
  out._stats = [
    stat("Leads", total, pctChange(total, prevTotal), `vs ${prevTotal} before`),
    stat("Waiting for a reply", unanswered, null, "inquiries, messages, replies"),
    ...(want("inquiries") ? [stat("Project inquiries", srcCount("project_inquiries"))] : []),
    ...(want("buyers_link") ? [stat("Buyers Link briefs", srcCount("buyers_link_briefs"), null, `${grades.find((g) => g.name === "Priority")?.count ?? 0} priority`)] : []),
    ...(want("contact") ? [stat("Contact messages", srcCount("contact_messages"))] : []),
    ...(want("inbox") ? [stat("Inbox replies", srcCount("inbox_replies"))] : []),
  ]
  out._charts = [
    ...pieChart("Leads by source", [
      { name: "project inquiries", count: srcCount("project_inquiries") },
      { name: "contact messages", count: srcCount("contact_messages") },
      { name: "Buyers Link briefs", count: srcCount("buyers_link_briefs") },
      { name: "inbox replies", count: srcCount("inbox_replies") },
    ]),
    ...barsChart("Briefs by grade", ["Priority", "Qualified", "Nurture", "Information"].map((g) => ({ label: g, value: grades.find((x) => x.name === g)?.count ?? 0, display: String(grades.find((x) => x.name === g)?.count ?? 0) })).filter((p, _i, arr) => arr.some((x) => x.value > 0) && (p.value > 0 || true))),
    ...sharesChart("Inquiries by project", inqProjects),
  ]
  return out
}

// ─── Project knowledge: find projects by what a buyer wants; one project in depth ───

type ProjectRow = {
  id: number
  name: string
  slug: string
  status: string | null
  city: string | null
  region: string | null
  community: string | null
  sub_community: string | null
  location: string | null
  launch_price_from: number | string | null
  launch_price_to: number | string | null
  currency: string | null
  delivery_quarter: string | null
  expected_completion_date: string | null
  delivery_date: string | null
  down_payment_percentage: number | string | null
  payment_plan_details: string | null
  installment_available: boolean | null
  total_units: number | null
  main_image: string | null
  is_published: boolean | null
  developers: { name: string; slug: string | null } | { name: string; slug: string | null }[] | null
  project_property_types: { property_types: { name: string } | null }[] | null
  project_units: { unit_type: string | null; bedrooms: number | null; size_sqft: number | string | null; price_from: number | string | null; price_to: number | string | null }[] | null
}

const PROJECT_FIND_COLUMNS =
  "id, name, slug, status, city, region, community, sub_community, location, launch_price_from, launch_price_to, currency, delivery_quarter, expected_completion_date, delivery_date, down_payment_percentage, payment_plan_details, installment_available, total_units, main_image, is_published, developers(name, slug), project_property_types(property_types(name)), project_units(unit_type, bedrooms, size_sqft, price_from, price_to)"

/** Abbreviations agents and buyers use for Dubai areas. */
const AREA_ALIASES: Record<string, string> = {
  jvc: "jumeirah village circle",
  jvt: "jumeirah village triangle",
  jlt: "jumeirah lakes towers",
  jbr: "jumeirah beach residence",
  mbr: "mohammed bin rashid",
  "mbr city": "mohammed bin rashid",
  difc: "dubai international financial centre",
  dso: "dubai silicon oasis",
  "the palm": "palm jumeirah",
  marina: "dubai marina",
  downtown: "downtown dubai",
}

const numOf = (v: number | string | null | undefined): number | null => {
  if (v == null || v === "") return null
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}
const oneRel = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

function unitBeds(u: { unit_type: string | null; bedrooms: number | null }): number | null {
  if (u.bedrooms != null && Number.isFinite(u.bedrooms)) return u.bedrooms
  const t = (u.unit_type ?? "").toLowerCase()
  if (/studio/.test(t)) return 0
  const m = /(\d)\s*(?:br\b|bhk|bed)/.exec(t)
  return m ? Number(m[1]) : null
}

function seoInputOf(p: ProjectRow): ProjectSeoInput {
  const dev = oneRel(p.developers)
  return {
    name: p.name,
    status: p.status,
    community: p.community,
    location: p.location,
    city: p.city,
    launch_price_from: p.launch_price_from,
    launch_price_to: p.launch_price_to,
    currency: p.currency,
    delivery_quarter: p.delivery_quarter,
    expected_completion_date: p.expected_completion_date,
    delivery_date: p.delivery_date,
    total_units: p.total_units,
    down_payment_percentage: p.down_payment_percentage,
    payment_plan_details: p.payment_plan_details,
    installment_available: p.installment_available,
    developer: dev ? { name: dev.name } : null,
    propertyTypes: (p.project_property_types ?? []).map((t) => t.property_types?.name).filter((n): n is string => Boolean(n)),
    units: (p.project_units ?? []).map((u) => ({ unit_type: u.unit_type, bedrooms: u.bedrooms, size_sqft: u.size_sqft, price_from: u.price_from })),
  }
}

function projectUrl(p: ProjectRow): string | null {
  const dev = oneRel(p.developers)
  return dev?.slug && p.slug ? `${SITE_URL.replace(/\/$/, "")}/${dev.slug}/${p.slug}` : null
}

const handoverYear = (label: string | null): number | null => {
  const m = /(20\d{2})/.exec(label ?? "")
  return m ? Number(m[1]) : null
}

const areaOf = (p: ProjectRow) => [p.community, p.sub_community, p.location, p.region, p.city].filter(Boolean).join(", ")

/** A one-line payment plan for lists: milestones when they read as a schedule, else the sentence. */
function paymentPlanShort(p: ProjectRow): string | null {
  const plan = parsePaymentPlan(p.payment_plan_details, p.down_payment_percentage)
  if (plan.milestones.length >= 2) return plan.milestones.map((m) => `${m.percent}% ${m.label}`.trim()).join(" / ")
  return plan.note ?? (plan.milestones[0] ? `${plan.milestones[0].percent}% down payment` : null)
}

type FindProjectsArgs = {
  area?: string
  developer_name?: string
  bedrooms?: number
  property_type?: string
  status?: string
  off_plan_only?: boolean
  ready_only?: boolean
  min_price?: number
  max_price?: number
  handover_year?: number
  handover_by_year?: number
  name_contains?: string
  sort?: "price_asc" | "price_desc" | "handover" | "name"
  limit?: number
}

/**
 * The buyer's question turned into a shortlist: "1-bedroom in JVC under AED
 * 1M", "Azizi projects handing over 2027", "ready villas". Every published
 * project is loaded with its unit table and filtered here. Prices follow the
 * public pages' rule (lib/project-seo.ts): the advertised "from" price can
 * never undercut the cheapest real unit, and sub-AED 50K values are data slips.
 * When bedrooms are asked for, the price is the cheapest unit OF THAT SIZE and
 * projects whose unit table doesn't list that size are left out (and counted,
 * so the answer can say so).
 */
async function findProjects(admin: Admin, args: FindProjectsArgs) {
  const { data, error } = await admin
    .from("projects")
    .select(PROJECT_FIND_COLUMNS)
    .is("deleted_at", null)
    .eq("is_active", true)
    .eq("is_published", true)
    .limit(1000)
  if (error) throw new Error(error.message)
  let rows = (data ?? []) as unknown as ProjectRow[]
  const lc = (s: string | null | undefined) => (s ?? "").toLowerCase()

  if (args.area?.trim()) {
    const raw = args.area.trim().toLowerCase()
    const needle = AREA_ALIASES[raw] ?? raw
    rows = rows.filter((p) => lc(areaOf(p)).includes(needle) || lc(areaOf(p)).includes(raw))
  }
  if (args.developer_name?.trim()) {
    const n = args.developer_name.trim().toLowerCase()
    rows = rows.filter((p) => lc(oneRel(p.developers)?.name).includes(n))
  }
  if (args.name_contains?.trim()) {
    const n = args.name_contains.trim().toLowerCase()
    rows = rows.filter((p) => lc(p.name).includes(n))
  }
  if (args.status) rows = rows.filter((p) => p.status === args.status)
  if (args.off_plan_only) rows = rows.filter((p) => isOffPlan(p.status))
  if (args.ready_only) rows = rows.filter((p) => !isOffPlan(p.status))
  if (args.property_type?.trim()) {
    const t = args.property_type.trim().toLowerCase().replace(/s$/, "")
    rows = rows.filter((p) => {
      const types = seoInputOf(p).propertyTypes ?? []
      const units = (p.project_units ?? []).map((u) => lc(u.unit_type))
      return types.some((x) => x.toLowerCase().includes(t)) || units.some((x) => x.includes(t))
    })
  }

  const beds = typeof args.bedrooms === "number" && Number.isFinite(args.bedrooms) ? args.bedrooms : null
  const typeNeedle = args.property_type?.trim() ? args.property_type.trim().toLowerCase().replace(/s$/, "") : null
  let withoutUnitRows = 0
  const scored = rows
    .map((p) => {
      const seo = seoInputOf(p)
      let price: number | null
      let priceNote: string
      if (beds != null) {
        const matching = (p.project_units ?? []).filter((u) => unitBeds(u) === beds)
        if (matching.length === 0) return null
        const prices = matching.map((u) => numOf(u.price_from)).filter((n): n is number => n != null && n >= 50_000)
        price = prices.length ? Math.min(...prices) : null
        priceNote = price != null ? `cheapest ${beds === 0 ? "studio" : `${beds}-bedroom`} unit` : "no unit price listed"
      } else {
        // "Villas under 3M" on a mixed project: price the villa rows, not the
        // apartments the headline price describes — when the unit table has them.
        const typed = typeNeedle ? (p.project_units ?? []).filter((u) => lc(u.unit_type).includes(typeNeedle)) : []
        const typedPrices = typed.map((u) => numOf(u.price_from)).filter((n): n is number => n != null && n >= 50_000)
        if (typedPrices.length) {
          price = Math.min(...typedPrices)
          priceNote = `cheapest ${typeNeedle} unit`
        } else {
          price = priceFromValue(seo)
          priceNote = price != null ? (typeNeedle ? "project from price (no per-type unit price listed)" : "from price") : "no price listed"
        }
      }
      const handover = handoverLabel(seo)
      return { p, seo, price, priceNote, handover, year: handoverYear(handover) }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
  if (beds != null) withoutUnitRows = rows.length - scored.length

  let list = scored
  if (typeof args.min_price === "number") list = list.filter((x) => x.price != null && x.price >= args.min_price!)
  if (typeof args.max_price === "number") list = list.filter((x) => x.price != null && x.price <= args.max_price!)
  if (typeof args.handover_year === "number") list = list.filter((x) => x.year === args.handover_year)
  if (typeof args.handover_by_year === "number") list = list.filter((x) => x.year != null && x.year <= args.handover_by_year!)

  const sort = args.sort ?? (args.max_price != null || args.min_price != null || beds != null ? "price_asc" : "name")
  const byPrice = (a: { price: number | null }, b: { price: number | null }) => (a.price ?? Infinity) - (b.price ?? Infinity)
  if (sort === "price_asc") list.sort(byPrice)
  else if (sort === "price_desc") list.sort((a, b) => byPrice(b, a))
  else if (sort === "handover") list.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999))
  else list.sort((a, b) => a.p.name.localeCompare(b.p.name))

  const limit = Math.min(Math.max(args.limit ?? 12, 1), 40)
  const shown = list.slice(0, limit)
  const countBy = (key: (x: (typeof list)[number]) => string | null) => {
    const m = new Map<string, number>()
    for (const x of list) m.set(key(x) ?? "Not given", (m.get(key(x) ?? "Not given") ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, n]) => ({ name, count: n }))
  }

  return {
    filters: args,
    matched: list.length,
    shown: shown.length,
    ...(beds != null ? { left_out_no_unit_table_for_that_size: withoutUnitRows } : {}),
    by_developer: countBy((x) => oneRel(x.p.developers)?.name ?? null),
    by_area: countBy((x) => x.p.community || x.p.location || x.p.city),
    by_handover_year: countBy((x) => (x.year ? String(x.year) : null)),
    _stats: [
      stat("Matching projects", list.length, null, beds != null && withoutUnitRows ? `+${withoutUnitRows} without unit data for that size` : null),
      stat("Cheapest", shown[0]?.price != null ? formatPrice(shown[0].price, null, shown[0].p.currency) ?? "–" : "–", null, shown[0] ? shown[0].p.name : null),
      stat("Developers", countBy((x) => oneRel(x.p.developers)?.name ?? null).length),
      ...(list.some((x) => x.year) ? [stat("Earliest handover", String(Math.min(...list.map((x) => x.year ?? 9999))))] : []),
    ],
    price_rule: "Prices are what the public page shows: a from-price never below the cheapest listed unit; values under AED 50K ignored as data slips",
    _charts: [
      ...sharesChart("Matching projects by developer", countBy((x) => oneRel(x.p.developers)?.name ?? null)),
      ...barsChart("Matching projects by handover year", countBy((x) => (x.year ? String(x.year) : null)).filter((c) => c.name !== "Not given").sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ label: c.name, value: c.count, display: String(c.count) }))),
    ],
    projects: shown.map((x) => {
      const mix = unitsSummary(x.seo)
      return {
        name: x.p.name,
        developer: oneRel(x.p.developers)?.name ?? null,
        area: areaOf(x.p) || null,
        status: statusLabel(x.p.status),
        price_aed: x.price,
        price_label: x.price != null ? formatPrice(x.price, beds != null ? null : priceToValue(x.seo), x.p.currency) : null,
        price_basis: x.priceNote,
        handover: x.handover,
        unit_mix: mix.mix,
        sizes: mix.sizes,
        property_types: x.seo.propertyTypes?.length ? x.seo.propertyTypes : null,
        payment_plan: paymentPlanShort(x.p),
        page: projectUrl(x.p),
      }
    }),
    _cards: shown
      .filter((x) => x.p.main_image)
      .slice(0, 8)
      .map((x): FhiChatCard => ({
        kind: "project",
        title: x.p.name,
        subtitle: [oneRel(x.p.developers)?.name, x.price != null ? formatPrice(x.price, null, x.p.currency) : null, x.handover].filter(Boolean).join(" · "),
        image: x.p.main_image,
      })),
  }
}

/**
 * Everything the site knows about ONE project — the facts an agent needs on a
 * call: price range and every unit type with size and price, handover, the
 * payment plan read into milestones, amenities, what's nearby, the developer's
 * contacts, permit number, and how many validated FHI sales it has.
 */
async function projectDetails(admin: Admin, args: { name?: string }) {
  const q = (args.name ?? "").trim()
  if (!q) return { error: "Which project? Give its name." }
  const { data, error } = await admin
    .from("projects")
    .select(
      "*, developers(name, slug, phone, email, website_url, is_verified), project_property_types(property_types(name)), project_units(unit_type, layout_name, bedrooms, bathrooms, size_sqft, size_sqm, price_from, price_to, available_units, is_available), project_amenities(amenities(name)), project_neighbors(category, description), project_points(category, description), project_features(description)",
    )
    .is("deleted_at", null)
    .eq("is_active", true)
    .ilike("name", `%${q.replace(/[%_]/g, "")}%`)
    .order("is_published", { ascending: false })
    .limit(5)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as Array<ProjectRow & Record<string, unknown> & {
    project_amenities: { amenities: { name: string } | null }[] | null
    project_neighbors: { category: string | null; description: string }[] | null
    project_points: { category: string | null; description: string }[] | null
    project_features: { description: string }[] | null
    developers: { name: string; slug: string | null; phone: string | null; email: string | null; website_url: string | null; is_verified: boolean | null } | null
  }>
  if (rows.length === 0) return { error: `No project matching "${q}"` }
  // Exact name first, otherwise the shortest name containing the query.
  const exact = rows.find((r) => r.name.toLowerCase() === q.toLowerCase())
  const p = exact ?? [...rows].sort((a, b) => a.name.length - b.name.length)[0]
  const seo = seoInputOf(p)
  const plan = parsePaymentPlan(p.payment_plan_details, p.down_payment_percentage)
  const dev = p.developers

  const { data: sales } = await admin
    .from("sales_reports")
    .select("contract_price, validation_status")
    .eq("project_id", p.id)
    .limit(1000)
  const validated = (sales ?? []).filter((s) => s.validation_status === "validated")
  const pending = (sales ?? []).filter((s) => s.validation_status === "pending").length

  const str = (k: string) => (typeof p[k] === "string" && (p[k] as string).trim() ? (p[k] as string).trim() : null)
  const mix = unitsSummary(seo)
  return {
    ...(rows.length > 1 ? { other_matches: rows.filter((r) => r.id !== p.id).map((r) => r.name) } : {}),
    name: p.name,
    published_on_site: Boolean(p.is_published),
    page: projectUrl(p),
    developer: dev ? { name: dev.name, verified: Boolean(dev.is_verified), phone: dev.phone, email: dev.email, website: dev.website_url } : null,
    status: statusLabel(p.status),
    off_plan: isOffPlan(p.status),
    area: { community: p.community, sub_community: p.sub_community, location: p.location, city: p.city, region: p.region },
    price: {
      from_aed: priceFromValue(seo),
      to_aed: priceToValue(seo),
      label: formatPrice(priceFromValue(seo), priceToValue(seo), p.currency),
      headline_as_entered: numOf(p.launch_price_from),
      note: "from/to follow the public page rule: never below the cheapest listed unit; sub-AED 50K values ignored",
    },
    handover: handoverLabel(seo),
    dates: { booking: str("booking_date"), construction_start: str("construction_start_date"), expected_completion: str("expected_completion_date"), delivery: str("delivery_date"), delivery_quarter: str("delivery_quarter") },
    payment_plan: {
      milestones: plan.milestones,
      fees: plan.fees,
      as_written: plan.note ?? p.payment_plan_details ?? null,
      down_payment_percent: numOf(p.down_payment_percentage),
      installments_available: p.installment_available,
      government_fee_percent: numOf(p.government_fee_percentage as number | string | null),
    },
    unit_mix: mix.mix,
    sizes: mix.sizes,
    units: (p.project_units ?? [])
      .map((u) => ({
        type: u.unit_type,
        layout: (u as { layout_name?: string | null }).layout_name ?? null,
        bedrooms: unitBeds(u),
        bathrooms: (u as { bathrooms?: number | null }).bathrooms ?? null,
        size_sqft: numOf(u.size_sqft),
        price_from_aed: numOf(u.price_from),
        price_to_aed: numOf(u.price_to),
        available_units: (u as { available_units?: number | null }).available_units ?? null,
      }))
      .sort((a, b) => (a.price_from_aed ?? Infinity) - (b.price_from_aed ?? Infinity)),
    property_types: seo.propertyTypes ?? [],
    building: { total_units: p.total_units, floors: p.floors ?? null, buildings: p.number_of_buildings ?? null },
    ownership: { freehold: p.freehold ?? null, type: str("ownership_type") },
    returns: { expected_roi_percent: numOf(p.expected_roi as number | string | null), rental_yield_percent: numOf(p.rental_yield as number | string | null) },
    amenities: (p.project_amenities ?? []).map((a) => a.amenities?.name).filter(Boolean),
    nearby: (p.project_neighbors ?? []).map((n) => n.description),
    highlights: [...(p.project_points ?? []).map((n) => n.description), ...(p.project_features ?? []).map((n) => n.description)].slice(0, 20),
    permit: { trakheesi_number: str("trakheesi_permit_number"), link: str("trakheesi_permit_link") ?? str("trakheesi_permit_url") },
    sales_contact: { phone: str("sales_contact_phone"), email: str("sales_contact_email") },
    description: (str("description") ?? str("about_project") ?? "").slice(0, 600) || null,
    _stats: [
      stat("From price", formatPrice(priceFromValue(seo), null, p.currency) ?? "–", null, priceToValue(seo) ? `to ${formatPrice(priceToValue(seo), null, p.currency)}` : null),
      stat("Handover", handoverLabel(seo) ?? "–", null, statusLabel(p.status)),
      stat("Unit types", (p.project_units ?? []).length, null, mix.mix),
      stat("FHI validated deals", validated.length, null, validated.length ? AED(validated.reduce((s2, r) => s2 + (numOf(r.contract_price) ?? 0), 0)) : null),
    ],
    fhi_sales: { validated_deals: validated.length, validated_value_aed: validated.reduce((s, r) => s + (numOf(r.contract_price) ?? 0), 0), pending_deals: pending, note: "For who sold it, use top_agents with project_name" },
    _cards: p.main_image ? [{ kind: "project", title: p.name, subtitle: [dev?.name, formatPrice(priceFromValue(seo), null, p.currency), handoverLabel(seo)].filter(Boolean).join(" · "), image: p.main_image } as FhiChatCard] : [],
  }
}

// ─── Sales pipeline health + quiet agents ────────────────────────────────────

type PipelineArgs = {
  stale_days?: number
  quiet_scope?: "month" | "quarter" | "year"
  quiet_from_date?: string
  quiet_to_date?: string
  include_quiet_agents?: boolean
  limit?: number
}

type PipelineSale = SaleRow & {
  commission_status: string | null
  validation_changed_at: string | null
  validation_changed_by_name: string | null
  sale_type: string | null
  property_address: string | null
  unit_number: string | null
  remarks: string | null
}

/**
 * The state of the sales pipeline as it stands NOW (not a period): what waits
 * for validation and for how long, what was rejected, how fast validation has
 * been, where commissions stand (status only — the amount isn't stored),
 * shared/partner deals — plus the "quiet agents": accounts in a selling role
 * that are active but have no validated sale in the period (this quarter by
 * default). Every list is oldest-first so the answer names what to chase.
 */
async function salesPipeline(admin: Admin, args: PipelineArgs) {
  const staleDays = Math.min(Math.max(args.stale_days ?? 7, 1), 365)
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 60)
  const now = Date.now()
  const daysSince = (iso: string | null) => (iso ? Math.max(0, Math.floor((now - Date.parse(iso)) / 86400e3)) : null)

  const sales: PipelineSale[] = []
  for (let page = 0; page < 10; page++) {
    const { data, error } = await admin
      .from("sales_reports")
      .select("id, agent_id, developer_id, project_id, contract_price, validation_status, reservation_date, created_at, partners, commission_status, validation_changed_at, validation_changed_by_name, sale_type, property_address, unit_number, remarks")
      .order("created_at", { ascending: true })
      .range(page * 1000, page * 1000 + 999)
    if (error) throw new Error(error.message)
    sales.push(...((data ?? []) as PipelineSale[]))
    if (!data || data.length < 1000) break
  }
  const names = await nameMaps(admin, sales)
  const aed = (n: number) => Math.round(n)
  const price = (s: SaleRow) => Number(s.contract_price ?? 0) || 0
  const line = (s: PipelineSale) => ({
    sale_id: s.id,
    agent: names.agent.get(String(s.agent_id))?.name ?? "Unknown",
    partners: saleCredits(s).filter((c) => c.agentId !== s.agent_id).map((c) => `${names.agent.get(c.agentId)?.name ?? "Unknown"} (${Math.round(c.share * 100)}%)`),
    project: s.sale_type && s.sale_type !== "project" ? s.property_address ?? s.sale_type : names.proj.get(Number(s.project_id))?.name ?? "Unknown project",
    developer: names.dev.get(String(s.developer_id))?.name ?? null,
    unit: s.unit_number,
    contract_price_aed: aed(price(s)),
    reservation_date: s.reservation_date,
    submitted: s.created_at.slice(0, 10),
    days_since_submitted: daysSince(s.created_at),
    validation_status: s.validation_status ?? "pending",
    commission_status: s.commission_status ?? "pending",
    validated_on: s.validation_changed_at?.slice(0, 10) ?? null,
    validated_by: s.validation_changed_by_name,
    remarks: s.remarks ? s.remarks.slice(0, 140) : null,
  })

  const pending = sales.filter((s) => (s.validation_status ?? "pending") === "pending").sort((a, b) => a.created_at.localeCompare(b.created_at))
  const rejected = sales.filter((s) => s.validation_status === "rejected").sort((a, b) => b.created_at.localeCompare(a.created_at))
  const validated = sales.filter((s) => s.validation_status === "validated")
  const stale = pending.filter((s) => (daysSince(s.created_at) ?? 0) >= staleDays)
  const turnaround = validated
    .map((s) => (s.validation_changed_at ? (Date.parse(s.validation_changed_at) - Date.parse(s.created_at)) / 86400e3 : null))
    .filter((d): d is number => d != null && d >= 0)
  const avgTurnaround = turnaround.length ? Math.round((turnaround.reduce((a, b) => a + b, 0) / turnaround.length) * 10) / 10 : null

  const byCommission = new Map<string, { count: number; value: number }>()
  for (const s of validated) {
    const k = s.commission_status ?? "pending"
    const cur = byCommission.get(k) ?? { count: 0, value: 0 }
    cur.count++
    cur.value += price(s)
    byCommission.set(k, cur)
  }
  const commissionPending = validated
    .filter((s) => (s.commission_status ?? "pending") === "pending")
    .sort((a, b) => (a.validation_changed_at ?? a.created_at).localeCompare(b.validation_changed_at ?? b.created_at))
  const shared = sales.filter((s) => saleCredits(s).length > 1)

  const out: Record<string, unknown> = {
    as_of: new Date(now).toISOString().slice(0, 10),
    _stats: [
      stat("Awaiting validation", pending.length, null, pending.length ? `oldest ${daysSince(pending[0].created_at)} days` : "queue is clear"),
      stat(`Stale (> ${staleDays} days)`, stale.length),
      stat("Commissions pending", commissionPending.length, null, `of ${validated.length} validated`),
      stat("Validation time", avgTurnaround != null ? `${avgTurnaround} days` : "–", null, "average, submit to validated"),
    ],
    _charts: [
      ...pieChart("Sales by validation status", [{ name: "validated", count: validated.length }, { name: "pending", count: pending.length }, { name: "rejected", count: rejected.length }]),
      ...pieChart("Commission status (validated sales)", [...byCommission.entries()].map(([name, v]) => ({ name, count: v.count }))),
    ],
    all_time: { sales_submitted: sales.length, validated: validated.length, pending: pending.length, rejected: rejected.length, validated_value_aed: aed(validated.reduce((a, s) => a + price(s), 0)) },
    awaiting_validation: {
      count: pending.length,
      value_aed: aed(pending.reduce((a, s) => a + price(s), 0)),
      oldest_days_waiting: pending.length ? daysSince(pending[0].created_at) : null,
      waiting_more_than_days: staleDays,
      stale_count: stale.length,
      oldest_first: pending.slice(0, limit).map(line),
      where_in_dashboard: "Sales → filter Pending; each row opens the sale to validate or reject",
    },
    rejected: { count: rejected.length, most_recent: rejected.slice(0, Math.min(limit, 10)).map(line) },
    validation_speed: { average_days_submit_to_validation: avgTurnaround, based_on_sales: turnaround.length, note: turnaround.length ? null : "No validation timestamps recorded yet" },
    commissions: {
      note: "Only the commission STATUS is stored per sale — no amounts or payout dates",
      by_status: [...byCommission.entries()].map(([status, v]) => ({ status, count: v.count, contract_value_aed: aed(v.value) })),
      pending_oldest_first: commissionPending.slice(0, limit).map((s) => ({ ...line(s), days_since_validated: daysSince(s.validation_changed_at ?? s.created_at) })),
    },
    partner_deals: {
      count: shared.length,
      value_aed: aed(shared.reduce((a, s) => a + price(s), 0)),
      note: "Shared sales credit each agent their share; company totals count the sale once",
      list: shared.slice(-limit).reverse().map(line),
    },
  }

  if (args.include_quiet_agents !== false) {
    // Selling roles, active accounts, no validated credit in the period.
    const scope = args.quiet_scope ?? "quarter"
    const today = new Date(now)
    let from = (args.quiet_from_date ?? "").trim()
    let to = (args.quiet_to_date ?? "").trim() || null
    if (!from) {
      const r = periodRange(scope, today.getUTCFullYear(), today.getUTCMonth() + 1)
      from = r.from ?? "1970-01-01"
      to = null
    }
    const { data: sellers, error } = await admin
      .from("profiles")
      .select("id, fullname, role, status, joined_at, profile_url")
      .in("role", [...ROLES_SALES_PIPELINE])
      .eq("status", "active")
      .neq("is_deleted", true)
      .limit(5000)
    if (error) throw new Error(error.message)
    const inPeriod = (s: SaleRow) => {
      const d = (s.reservation_date ?? s.created_at).slice(0, 10)
      return d >= from && (!to || d < to)
    }
    const soldInPeriod = new Set<string>()
    for (const s of validated.filter(inPeriod)) for (const c of saleCredits(s)) soldInPeriod.add(c.agentId)
    const lastSale = new Map<string, string>()
    for (const s of validated) for (const c of saleCredits(s)) {
      const d = (s.reservation_date ?? s.created_at).slice(0, 10)
      if ((lastSale.get(c.agentId) ?? "") < d) lastSale.set(c.agentId, d)
    }
    const rows = (sellers ?? []) as { id: string; fullname: string | null; role: string; status: string; joined_at: string | null; profile_url: string | null }[]
    const quiet = rows.filter((p) => !soldInPeriod.has(String(p.id)))
    const byRole = (list: typeof rows) => Object.fromEntries([...list.reduce((m, p) => m.set(p.role, (m.get(p.role) ?? 0) + 1), new Map<string, number>())])
    const neverSold = quiet.filter((p) => !lastSale.has(String(p.id)))
    out.quiet_agents = {
      period: { from, to: to ?? "today", scope: args.quiet_from_date ? "custom" : scope },
      definition: "Active accounts in a selling role (agent, team leader, unit manager, global partner) with no validated sale credited in the period. Members are not counted — they have no selling role yet.",
      selling_accounts_active: rows.length,
      sold_in_period: rows.length - quiet.length,
      quiet: quiet.length,
      quiet_by_role: byRole(quiet),
      never_sold_at_all: neverSold.length,
      sold_before_but_not_this_period: quiet.length - neverSold.length,
      list: quiet
        .sort((a, b) => (lastSale.get(String(b.id)) ?? "").localeCompare(lastSale.get(String(a.id)) ?? "") || (a.fullname ?? "").localeCompare(b.fullname ?? ""))
        .slice(0, Math.max(limit, 40))
        .map((p) => ({ name: p.fullname, role: p.role, joined: p.joined_at?.slice(0, 10) ?? null, last_validated_sale: lastSale.get(String(p.id)) ?? "never" })),
      list_note: quiet.length > Math.max(limit, 40) ? `Showing ${Math.max(limit, 40)} of ${quiet.length}: those who sold before are listed first, then those who never sold` : null,
    }
    ;(out._stats as FhiChatStat[]).push(stat("Quiet agents", quiet.length, null, `of ${rows.length} selling accounts, ${args.quiet_from_date ? "in the period" : scope === "month" ? "this month" : scope === "year" ? "this year" : "this quarter"}`))
    ;(out._charts as FhiChatChart[]).push(
      ...pieChart("Selling accounts: sold vs quiet", [{ name: "sold this period", count: rows.length - quiet.length }, { name: "quiet", count: quiet.length }]),
      ...pieChart("Quiet agents by role", objCounts(byRole(quiet))),
    )
  }
  return out
}

// ─── Support tickets, purchases, agent websites, listings, clients ───────────

async function profileNames(admin: Admin, ids: Array<string | null | undefined>): Promise<Map<string, string>> {
  const clean = [...new Set(ids.filter((v): v is string => typeof v === "string" && v.length > 0))]
  const m = new Map<string, string>()
  if (!clean.length) return m
  const { data } = await admin.from("profiles").select("id, fullname").in("id", clean)
  for (const p of (data ?? []) as { id: string; fullname: string | null }[]) m.set(String(p.id), p.fullname ?? "Unknown")
  return m
}

const dayAge = (iso: string | null | undefined) => (iso ? Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86400e3)) : null)

const tally = <T,>(rows: T[], key: (r: T) => string | null | undefined, top = 10) => {
  const m = new Map<string, number>()
  for (const r of rows) {
    const k = (key(r) ?? "").toString().trim() || "Not given"
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([name, count]) => ({ name, count }))
}

/** Every support ticket that still needs someone, oldest first; resolved ones on request. */
async function supportTickets(admin: Admin, args: { status?: string; limit?: number }) {
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 60)
  const status = (args.status ?? "open").trim()
  let q = admin
    .from("support_tickets")
    .select("id, reported_by, ticket_type, priority, status, title, description, page_url, module, device_type, browser, assigned_to, resolved_at, created_at, updated_at")
    .order("created_at", { ascending: true })
    .limit(2000)
  if (status === "open") q = q.in("status", ["open", "in_progress"])
  else if (status !== "all") q = q.eq("status", status)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  type Ticket = { id: string; reported_by: string | null; ticket_type: string | null; priority: string | null; status: string; title: string | null; description: string | null; page_url: string | null; module: string | null; device_type: string | null; browser: string | null; assigned_to: string | null; resolved_at: string | null; created_at: string; updated_at: string | null }
  const rows = (data ?? []) as Ticket[]
  const { data: all } = await admin.from("support_tickets").select("status, priority")
  const names = await profileNames(admin, rows.flatMap((t) => [t.reported_by, t.assigned_to]))
  const { data: comments } = rows.length ? await admin.from("support_ticket_comments").select("ticket_id").in("ticket_id", rows.map((t) => t.id)) : { data: [] }
  const commentCount = new Map<string, number>()
  for (const c of (comments ?? []) as { ticket_id: string }[]) commentCount.set(c.ticket_id, (commentCount.get(c.ticket_id) ?? 0) + 1)
  const open = rows.filter((t) => t.status === "open" || t.status === "in_progress")
  return {
    filter: status,
    all_tickets_by_status: tally((all ?? []) as { status: string }[], (t) => t.status),
    all_tickets_by_priority: tally((all ?? []) as { priority: string | null }[], (t) => t.priority),
    matching: rows.length,
    unassigned_open: open.filter((t) => !t.assigned_to).length,
    oldest_open_days: open.length ? dayAge(open[0].created_at) : null,
    by_module: tally(rows, (t) => t.module),
    by_type: tally(rows, (t) => t.ticket_type),
    _stats: [
      stat(status === "open" ? "Open tickets" : "Tickets", rows.length),
      stat("Unassigned", open.filter((t) => !t.assigned_to).length),
      stat("Oldest open", open.length ? `${dayAge(open[0].created_at)} days` : "–"),
    ],
    _charts: [
      ...pieChart("Tickets by status", tally((all ?? []) as { status: string }[], (t) => t.status)),
      ...sharesChart("Open tickets by module", tally(rows, (t) => t.module)),
    ],
    tickets_oldest_first: rows.slice(0, limit).map((t) => ({
      ticket_id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      type: t.ticket_type,
      module: t.module,
      reported_by: names.get(String(t.reported_by)) ?? "Unknown",
      assigned_to: t.assigned_to ? names.get(String(t.assigned_to)) ?? "Unknown" : null,
      opened: t.created_at.slice(0, 10),
      days_open: t.resolved_at ? null : dayAge(t.created_at),
      resolved_on: t.resolved_at?.slice(0, 10) ?? null,
      comments: commentCount.get(t.id) ?? 0,
      page: t.page_url,
      device: [t.device_type, t.browser].filter(Boolean).join(" · ") || null,
      description: (t.description ?? "").slice(0, 200) || null,
    })),
    where_in_dashboard: "Communication → Support; each ticket opens with its comment thread",
  }
}

/** Company purchases (the tax ledger): totals by category, entity, month and tax type, plus the invoices. */
async function companyPurchases(admin: Admin, args: { from_date?: string; to_date?: string; year?: number; category?: string; entity?: string; limit?: number }) {
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100)
  const year = args.year ?? new Date().getUTCFullYear()
  const from = (args.from_date ?? "").trim() || `${year}-01-01`
  const to = (args.to_date ?? "").trim() || `${year + 1}-01-01`
  const { data, error } = await admin
    .from("purchases")
    .select("id, tax_entity_id, tax_month, tax_type, invoice_number, gross_taxable, total_actual_amount, category_id, currency_code, notes, created_by, created_at")
    .is("deleted_at", null)
    .gte("tax_month", from)
    .lt("tax_month", to)
    .order("tax_month", { ascending: false })
    .limit(5000)
  if (error) throw new Error(error.message)
  type Purchase = { id: string; tax_entity_id: string | null; tax_month: string; tax_type: string | null; invoice_number: string | null; gross_taxable: number | string | null; total_actual_amount: number | string | null; category_id: string | null; currency_code: string | null; notes: string | null; created_by: string | null; created_at: string }
  let rows = (data ?? []) as Purchase[]
  const [{ data: cats }, { data: ents }] = await Promise.all([
    admin.from("purchase_categories").select("id, category_name, category_type"),
    admin.from("company_tax_entities").select("id, registered_name, trade_name, currency_code"),
  ])
  const catName = new Map(((cats ?? []) as { id: string; category_name: string; category_type: string | null }[]).map((c) => [c.id, c.category_name]))
  const entName = new Map(((ents ?? []) as { id: string; registered_name: string; trade_name: string | null }[]).map((e) => [e.id, e.trade_name || e.registered_name]))
  if (args.category?.trim()) rows = rows.filter((r) => (catName.get(String(r.category_id)) ?? "").toLowerCase().includes(args.category!.trim().toLowerCase()))
  if (args.entity?.trim()) rows = rows.filter((r) => (entName.get(String(r.tax_entity_id)) ?? "").toLowerCase().includes(args.entity!.trim().toLowerCase()))
  const num = (v: number | string | null) => Number(v ?? 0) || 0
  const sumBy = (key: (r: Purchase) => string) => {
    const m = new Map<string, { count: number; gross_taxable: number; total_actual: number }>()
    for (const r of rows) {
      const k = key(r)
      const cur = m.get(k) ?? { count: 0, gross_taxable: 0, total_actual: 0 }
      cur.count++
      cur.gross_taxable += num(r.gross_taxable)
      cur.total_actual += num(r.total_actual_amount)
      m.set(k, cur)
    }
    return [...m.entries()].map(([name, v]) => ({ name, count: v.count, gross_taxable: Math.round(v.gross_taxable), total_actual: Math.round(v.total_actual) })).sort((a, b) => b.total_actual - a.total_actual)
  }
  const creators = await profileNames(admin, rows.map((r) => r.created_by))
  const currency = rows[0]?.currency_code?.trim() || "AED"
  return {
    period: { from, to_exclusive: to },
    filters: { category: args.category ?? null, entity: args.entity ?? null },
    currency,
    totals: { purchases: rows.length, gross_taxable: Math.round(rows.reduce((a, r) => a + num(r.gross_taxable), 0)), total_actual_amount: Math.round(rows.reduce((a, r) => a + num(r.total_actual_amount), 0)) },
    by_category: sumBy((r) => catName.get(String(r.category_id)) ?? "Uncategorised"),
    by_entity: sumBy((r) => entName.get(String(r.tax_entity_id)) ?? "No entity"),
    by_month: sumBy((r) => r.tax_month.slice(0, 7)).sort((a, b) => a.name.localeCompare(b.name)),
    by_tax_type: sumBy((r) => r.tax_type ?? "Not given"),
    _stats: [
      stat("Purchases", rows.length),
      stat("Total spend", `${currency} ${Math.round(rows.reduce((a, r) => a + num(r.total_actual_amount), 0)).toLocaleString("en-AE")}`, null, "total actual amount"),
      stat("Gross taxable", `${currency} ${Math.round(rows.reduce((a, r) => a + num(r.gross_taxable), 0)).toLocaleString("en-AE")}`),
    ],
    _charts: [
      ...sharesChart("Spend by category", sumBy((r) => catName.get(String(r.category_id)) ?? "Uncategorised").map((x) => ({ name: x.name, count: x.total_actual })), (n) => `${currency} ${n.toLocaleString("en-AE")}`),
      ...barsChart("Spend by month", sumBy((r) => r.tax_month.slice(0, 7)).sort((a, b) => a.name.localeCompare(b.name)).map((x) => ({ label: monthLabel(x.name), value: x.total_actual, display: x.total_actual.toLocaleString("en-AE") }))),
    ],
    newest: rows.slice(0, limit).map((r) => ({
      tax_month: r.tax_month.slice(0, 7),
      invoice: r.invoice_number,
      category: catName.get(String(r.category_id)) ?? null,
      entity: entName.get(String(r.tax_entity_id)) ?? null,
      tax_type: r.tax_type,
      gross_taxable: Math.round(num(r.gross_taxable)),
      total_actual_amount: Math.round(num(r.total_actual_amount)),
      notes: (r.notes ?? "").slice(0, 120) || null,
      recorded_by: creators.get(String(r.created_by)) ?? null,
      recorded_on: r.created_at.slice(0, 10),
    })),
    where_in_dashboard: "Purchases (with Purchase Categories and Tax Entities alongside)",
  }
}

/** Who has an agent website, whether it is live, and its address. */
async function agentWebsites(admin: Admin, args: { agent_name?: string; published_only?: boolean; limit?: number }) {
  const limit = Math.min(Math.max(args.limit ?? 40, 1), 200)
  const { data, error } = await admin
    .from("website_builder")
    .select("id, agent_id, title, slug, is_published, created_at, updated_at, contact, show_reviews")
    .order("updated_at", { ascending: false })
    .limit(1000)
  if (error) throw new Error(error.message)
  type Site = { id: string; agent_id: string; title: string | null; slug: string | null; is_published: boolean | null; created_at: string; updated_at: string | null; contact: Record<string, unknown> | null; show_reviews: boolean | null }
  let rows = (data ?? []) as Site[]
  const names = await profileNames(admin, rows.map((s) => s.agent_id))
  let agentMatches: string[] | null = null
  if (args.agent_name?.trim()) {
    const found = await findProfiles(admin, args.agent_name)
    if (!found.length) return { error: `No FHI member matching "${args.agent_name}"` }
    const ids = new Set(found.map((p) => p.id))
    agentMatches = found.map((p) => p.fullname ?? "Unknown")
    rows = rows.filter((s) => ids.has(String(s.agent_id)))
  }
  if (args.published_only) rows = rows.filter((s) => s.is_published)
  const [{ count: events }, { count: listings }] = await Promise.all([
    admin.from("events").select("id", { count: "exact", head: true }).not("agent_id", "is", null),
    admin.from("agent_listings").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "published"),
  ])
  const base = SITE_URL.replace(/\/$/, "")
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)
  return {
    filters: { agent_name_matched: agentMatches, published_only: Boolean(args.published_only) },
    total_websites: rows.length,
    published: rows.filter((s) => s.is_published).length,
    drafts_not_live: rows.filter((s) => !s.is_published).length,
    agent_run_events_total: events ?? 0,
    published_listings_total: listings ?? 0,
    websites: rows.slice(0, limit).map((s) => ({
      agent: names.get(String(s.agent_id)) ?? "Unknown",
      title: s.title,
      live: Boolean(s.is_published),
      url: s.slug ? `${base}/website/${s.slug}` : null,
      phone: str(s.contact?.phone) ?? str(s.contact?.whatsapp) ?? null,
      email: str(s.contact?.email),
      reviews_shown: Boolean(s.show_reviews),
      created: s.created_at.slice(0, 10),
      last_updated: s.updated_at?.slice(0, 10) ?? null,
    })),
    where_in_dashboard: "Each agent edits theirs under Website Builder; admins see all under Agent Websites",
  }
}

/** Agents' own listings (sale and rent): who lists what, at what price, live or draft. */
async function listingsOverview(admin: Admin, args: { agent_name?: string; kind?: "sale" | "rent"; status?: string; project_name?: string; min_price?: number; max_price?: number; search?: string; limit?: number }) {
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100)
  let q = admin
    .from("agent_listings")
    .select("id, agent_id, project_id, title, description, listing_kind, price, currency, status, unit_type, slug, is_featured, created_at, updated_at, projects(name, community, city)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(2000)
  const status = (args.status ?? "published").trim()
  if (status !== "all") q = q.eq("status", status)
  if (args.kind) q = q.eq("listing_kind", args.kind)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  type Listing = { id: string; agent_id: string; project_id: number | null; title: string | null; description: string | null; listing_kind: string; price: number | string | null; currency: string | null; status: string; unit_type: string | null; slug: string | null; is_featured: boolean | null; created_at: string; updated_at: string | null; projects: { name: string; community: string | null; city: string | null } | { name: string; community: string | null; city: string | null }[] | null }
  let rows = (data ?? []) as Listing[]
  const proj = (l: Listing) => (Array.isArray(l.projects) ? l.projects[0] ?? null : l.projects)
  const lc = (s: string | null | undefined) => (s ?? "").toLowerCase()
  let agentMatches: string[] | null = null
  if (args.agent_name?.trim()) {
    const found = await findProfiles(admin, args.agent_name)
    if (!found.length) return { error: `No FHI member matching "${args.agent_name}"` }
    const ids = new Set(found.map((p) => p.id))
    agentMatches = found.map((p) => p.fullname ?? "Unknown")
    rows = rows.filter((l) => ids.has(String(l.agent_id)))
  }
  if (args.project_name?.trim()) rows = rows.filter((l) => lc(proj(l)?.name).includes(args.project_name!.trim().toLowerCase()))
  if (args.search?.trim()) {
    const n = args.search.trim().toLowerCase()
    rows = rows.filter((l) => lc(l.title).includes(n) || lc(l.description).includes(n) || lc(proj(l)?.community).includes(n) || lc(proj(l)?.name).includes(n))
  }
  const price = (l: Listing) => Number(l.price ?? 0) || null
  if (typeof args.min_price === "number") rows = rows.filter((l) => (price(l) ?? 0) >= args.min_price!)
  if (typeof args.max_price === "number") rows = rows.filter((l) => price(l) != null && price(l)! <= args.max_price!)
  const names = await profileNames(admin, rows.map((l) => l.agent_id))
  const base = SITE_URL.replace(/\/$/, "")
  const { data: all } = await admin.from("agent_listings").select("status, listing_kind").is("deleted_at", null)
  return {
    filters: { agent_name_matched: agentMatches, kind: args.kind ?? "both", status, project: args.project_name ?? null, search: args.search ?? null },
    all_listings_by_status: tally((all ?? []) as { status: string }[], (l) => l.status),
    all_listings_by_kind: tally((all ?? []) as { listing_kind: string }[], (l) => l.listing_kind),
    matching: rows.length,
    by_agent: tally(rows, (l) => names.get(String(l.agent_id)) ?? "Unknown", 15),
    by_project: tally(rows, (l) => proj(l)?.name),
    by_unit_type: tally(rows, (l) => l.unit_type),
    _stats: [
      stat(status === "published" ? "Published listings" : "Listings", rows.length),
      stat("For sale", rows.filter((l) => l.listing_kind === "sale").length),
      stat("For rent", rows.filter((l) => l.listing_kind === "rent").length),
      stat("Agents listing", tally(rows, (l) => names.get(String(l.agent_id)) ?? "Unknown", 100).length),
    ],
    _charts: [
      ...pieChart("Listings: sale vs rent", tally(rows, (l) => l.listing_kind)),
      ...sharesChart("Listings by agent", tally(rows, (l) => names.get(String(l.agent_id)) ?? "Unknown", 8)),
    ],
    listings: rows.slice(0, limit).map((l) => ({
      title: l.title,
      kind: l.listing_kind,
      status: l.status,
      price: price(l),
      price_label: price(l) != null ? `${l.currency ?? "AED"} ${price(l)!.toLocaleString("en-AE")}${l.listing_kind === "rent" ? " / year" : ""}` : null,
      unit_type: l.unit_type,
      project: proj(l)?.name ?? null,
      area: [proj(l)?.community, proj(l)?.city].filter(Boolean).join(", ") || null,
      agent: names.get(String(l.agent_id)) ?? "Unknown",
      featured: Boolean(l.is_featured),
      url: l.status === "published" ? `${base}/listings/${l.slug ?? l.id}` : null,
      created: l.created_at.slice(0, 10),
    })),
    where_in_dashboard: "Listings (admins see every agent's; agents their own)",
  }
}

/** The client book: buyers recorded on sales, who brought them, where they are from. */
async function clientsOverview(admin: Admin, args: { agent_name?: string; search?: string; country?: string; limit?: number }) {
  const limit = Math.min(Math.max(args.limit ?? 25, 1), 100)
  const { data, error } = await admin
    .from("clients")
    .select("id, first_name, middle_name, last_name, email, phone, age, gender, occupation, city, state_province, country, created_at, created_by")
    .order("created_at", { ascending: false })
    .limit(5000)
  if (error) throw new Error(error.message)
  type Client = { id: string; first_name: string | null; middle_name: string | null; last_name: string | null; email: string | null; phone: string | null; age: number | null; gender: string | null; occupation: string | null; city: string | null; state_province: string | null; country: string | null; created_at: string; created_by: string | null }
  let rows = (data ?? []) as Client[]
  const total = rows.length
  const lc = (s: string | null | undefined) => (s ?? "").toLowerCase()
  const fullName = (c: Client) => [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ").trim() || "Unnamed"
  let agentMatches: string[] | null = null
  if (args.agent_name?.trim()) {
    const found = await findProfiles(admin, args.agent_name)
    if (!found.length) return { error: `No FHI member matching "${args.agent_name}"` }
    const ids = new Set(found.map((p) => p.id))
    agentMatches = found.map((p) => p.fullname ?? "Unknown")
    rows = rows.filter((c) => ids.has(String(c.created_by)))
  }
  if (args.country?.trim()) rows = rows.filter((c) => lc(c.country).includes(args.country!.trim().toLowerCase()))
  if (args.search?.trim()) {
    const n = args.search.trim().toLowerCase()
    rows = rows.filter((c) => lc(fullName(c)).includes(n) || lc(c.email).includes(n) || (c.phone ?? "").replace(/\D/g, "").includes(n.replace(/\D/g, "") || "§"))
  }
  const [{ data: sales }, names] = await Promise.all([
    admin.from("sales_reports").select("client_id, contract_price, validation_status, project_id, projects(name)").in("client_id", rows.map((c) => c.id).slice(0, 1000)),
    profileNames(admin, rows.map((c) => c.created_by)),
  ])
  const byClient = new Map<string, { deals: number; validated_value: number; projects: string[] }>()
  for (const s of (sales ?? []) as { client_id: string; contract_price: number | string | null; validation_status: string | null; projects: { name: string } | { name: string }[] | null }[]) {
    const cur = byClient.get(s.client_id) ?? { deals: 0, validated_value: 0, projects: [] }
    cur.deals++
    if (s.validation_status === "validated") cur.validated_value += Number(s.contract_price ?? 0) || 0
    const p = Array.isArray(s.projects) ? s.projects[0] : s.projects
    if (p?.name && !cur.projects.includes(p.name)) cur.projects.push(p.name)
    byClient.set(s.client_id, cur)
  }
  return {
    filters: { agent_name_matched: agentMatches, country: args.country ?? null, search: args.search ?? null },
    clients_total: total,
    matching: rows.length,
    by_country: tally(rows, (c) => c.country),
    by_city: tally(rows, (c) => c.city),
    by_agent: tally(rows, (c) => names.get(String(c.created_by)) ?? "Unknown", 15),
    by_gender: tally(rows, (c) => c.gender),
    _stats: [
      stat("Clients", rows.length, null, rows.length !== total ? `of ${total} in the book` : "in the book"),
      stat("Countries", tally(rows, (c) => c.country, 50).filter((x) => x.name !== "Not given").length),
      stat("Recorded by", tally(rows, (c) => names.get(String(c.created_by)) ?? "Unknown", 100).length, null, "agents"),
    ],
    _charts: [
      ...pieChart("Clients by country", tally(rows, (c) => c.country, 6)),
      ...sharesChart("Clients by agent", tally(rows, (c) => names.get(String(c.created_by)) ?? "Unknown", 8)),
    ],
    newest: rows.slice(0, limit).map((c) => ({
      name: fullName(c),
      email: c.email,
      phone: c.phone,
      age: c.age,
      occupation: c.occupation,
      from: [c.city, c.state_province, c.country].filter(Boolean).join(", ") || null,
      recorded_by: names.get(String(c.created_by)) ?? null,
      recorded_on: c.created_at.slice(0, 10),
      deals: byClient.get(c.id)?.deals ?? 0,
      validated_value_aed: Math.round(byClient.get(c.id)?.validated_value ?? 0),
      projects: byClient.get(c.id)?.projects ?? [],
    })),
    note: "Clients are the buyers recorded on Record Your Sale — one row per buyer, linked to their sales",
  }
}

// ─── Agent reviews (client feedback) ─────────────────────────────────────────

type ReviewRow = {
  id: string
  agent_id: string | null
  agent_name: string | null
  client_name: string | null
  property_ref: string | null
  transaction_type: string | null
  transaction_date: string | null
  overall_rating: number | null
  score_communication: number | null
  score_market: number | null
  score_understanding: number | null
  score_professionalism: number | null
  score_negotiation: number | null
  score_process: number | null
  score_experience: number | null
  recommend: string | null
  did_well: string | null
  to_improve: string | null
  other_comments: string | null
  status: string | null
  created_at: string
}

const SCORE_LABELS: Array<[keyof ReviewRow, string]> = [
  ["score_communication", "Communication"],
  ["score_market", "Market knowledge"],
  ["score_understanding", "Understanding needs"],
  ["score_professionalism", "Professionalism"],
  ["score_negotiation", "Negotiation"],
  ["score_process", "Process handling"],
  ["score_experience", "Overall experience"],
]

/**
 * What clients say about agents (the feedback form): a leaderboard by review
 * count and average rating — with a minimum-reviews rule so one 5-star review
 * doesn't outrank twenty 4.8s — one agent's reviews in full (the seven scores,
 * recommend answers, what went well / to improve), and the reviews still
 * waiting for approval. Only approved reviews show on an agent's website.
 */
async function agentReviews(admin: Admin, args: { agent_name?: string; status?: string; min_reviews?: number; limit?: number }) {
  const limit = Math.min(Math.max(args.limit ?? 15, 1), 60)
  const minReviews = Math.max(args.min_reviews ?? 3, 1)
  const status = (args.status ?? "all").trim()
  let q = admin
    .from("agent_feedback")
    .select("id, agent_id, agent_name, client_name, property_ref, transaction_type, transaction_date, overall_rating, score_communication, score_market, score_understanding, score_professionalism, score_negotiation, score_process, score_experience, recommend, did_well, to_improve, other_comments, status, created_at")
    .order("created_at", { ascending: false })
    .limit(5000)
  if (status !== "all") q = q.eq("status", status)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  let rows = (data ?? []) as ReviewRow[]
  const all = rows

  let agentMatches: string[] | null = null
  if (args.agent_name?.trim()) {
    const found = await findProfiles(admin, args.agent_name)
    if (!found.length) return { error: `No FHI member matching "${args.agent_name}"` }
    const ids = new Set(found.map((p) => p.id))
    agentMatches = found.map((p) => p.fullname ?? "Unknown")
    rows = rows.filter((r) => ids.has(String(r.agent_id)))
  }

  const { data: profiles } = rows.length
    ? await admin.from("profiles").select("id, fullname, profile_url").in("id", [...new Set(rows.map((r) => String(r.agent_id)).filter((v) => v && v !== "null"))])
    : { data: [] }
  const prof = new Map(((profiles ?? []) as { id: string; fullname: string | null; profile_url: string | null }[]).map((p) => [String(p.id), p]))
  const nameOf = (r: ReviewRow) => prof.get(String(r.agent_id))?.fullname ?? r.agent_name ?? "Unknown agent"
  const avg = (ns: Array<number | null>) => {
    const v = ns.filter((n): n is number => typeof n === "number" && Number.isFinite(n))
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null
  }
  const recommendLabel = (v: string | null) => (v && v in RECOMMEND_LABELS ? RECOMMEND_LABELS[v as RecommendValue] : v ?? "Not answered")
  const wouldRecommend = (r: ReviewRow) => r.recommend === "definitely_yes" || r.recommend === "very_likely" || r.recommend === "likely"

  // Leaderboard over the (possibly filtered) rows, approved + new both count as
  // client voices; hidden ones are excluded from ratings.
  const rated = rows.filter((r) => r.status !== "hidden")
  const byAgent = new Map<string, ReviewRow[]>()
  for (const r of rated) {
    const k = String(r.agent_id ?? r.agent_name ?? "unknown")
    byAgent.set(k, [...(byAgent.get(k) ?? []), r])
  }
  const board = [...byAgent.entries()]
    .map(([id, list]) => ({
      agent: nameOf(list[0]),
      reviews: list.length,
      approved: list.filter((r) => r.status === "approved").length,
      average_rating: avg(list.map((r) => r.overall_rating)),
      five_star: list.filter((r) => r.overall_rating === 5).length,
      would_recommend_percent: Math.round((100 * list.filter(wouldRecommend).length) / list.length),
      latest_review: list[0].created_at.slice(0, 10),
      image: prof.get(id)?.profile_url ?? null,
    }))
    .sort((a, b) => b.reviews - a.reviews || (b.average_rating ?? 0) - (a.average_rating ?? 0))
  const withoutImage = (b: (typeof board)[number]) => {
    const copy: Partial<typeof b> = { ...b }
    delete copy.image
    return copy
  }
  const eligible = board.filter((b) => b.reviews >= minReviews)
  const bestRated = [...eligible].sort((a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0) || b.reviews - a.reviews)

  const pending = all.filter((r) => r.status === "new")
  const scoreAverages = Object.fromEntries(SCORE_LABELS.map(([key, label]) => [label, avg(rated.map((r) => r[key] as number | null))]))

  return {
    filters: { agent_name_matched: agentMatches, status, min_reviews_for_best_rated: minReviews },
    totals: {
      reviews: rows.length,
      approved_shown_on_websites: rows.filter((r) => r.status === "approved").length,
      waiting_for_approval: rows.filter((r) => r.status === "new").length,
      hidden: rows.filter((r) => r.status === "hidden").length,
      agents_reviewed: byAgent.size,
      average_rating: avg(rated.map((r) => r.overall_rating)),
      would_recommend_percent: rated.length ? Math.round((100 * rated.filter(wouldRecommend).length) / rated.length) : null,
    },
    average_scores_out_of_5: scoreAverages,
    rating_distribution: [5, 4, 3, 2, 1].map((star) => ({ stars: star, count: rated.filter((r) => r.overall_rating === star).length })),
    _stats: [
      stat("Reviews", rows.length, null, `${byAgent.size} agent${byAgent.size === 1 ? "" : "s"} reviewed`),
      stat("Average rating", avg(rated.map((r) => r.overall_rating)) != null ? `${avg(rated.map((r) => r.overall_rating))} / 5` : "–"),
      stat("Would recommend", rated.length ? `${Math.round((100 * rated.filter(wouldRecommend).length) / rated.length)}%` : "–"),
      stat("Waiting for approval", rows.filter((r) => r.status === "new").length),
    ],
    _charts: [
      ...barsChart("Ratings given", [1, 2, 3, 4, 5].map((star) => ({ label: `${star} ★`, value: rated.filter((r) => r.overall_rating === star).length, display: String(rated.filter((r) => r.overall_rating === star).length) }))),
      ...barsChart("Average score by area (out of 5)", SCORE_LABELS.map(([key, label]) => ({ label, value: avg(rated.map((r) => r[key] as number | null)) ?? 0, display: String(avg(rated.map((r) => r[key] as number | null)) ?? "–") }))),
      ...pieChart("Would recommend", tally(rated, (r) => recommendLabel(r.recommend))),
      ...sharesChart("Reviews by agent", board.map((b) => ({ name: b.agent, count: b.reviews }))),
    ],
    recommend_answers: tally(rated, (r) => recommendLabel(r.recommend)),
    most_reviewed: board.slice(0, limit).map((b) => withoutImage(b)),
    best_rated: bestRated.slice(0, limit).map((b) => withoutImage(b)),
    best_rated_note: eligible.length < board.length ? `${board.length - eligible.length} agent(s) with fewer than ${minReviews} reviews are left out of best_rated (they are in most_reviewed)` : null,
    waiting_for_approval: pending.slice(0, limit).map((r) => ({ review_id: r.id, agent: nameOf(r), client: r.client_name, rating: r.overall_rating, recommend: recommendLabel(r.recommend), submitted: r.created_at.slice(0, 10), did_well: (r.did_well ?? "").slice(0, 160) || null })),
    reviews: rows.slice(0, limit).map((r) => ({
      agent: nameOf(r),
      client: r.client_name,
      rating: r.overall_rating,
      scores: Object.fromEntries(SCORE_LABELS.map(([key, label]) => [label, r[key]])),
      recommend: recommendLabel(r.recommend),
      property: r.property_ref,
      transaction: [r.transaction_type, r.transaction_date].filter(Boolean).join(" · ") || null,
      did_well: r.did_well,
      to_improve: r.to_improve,
      other_comments: r.other_comments,
      status: r.status,
      submitted: r.created_at.slice(0, 10),
    })),
    where_in_dashboard: "Communication → Feedback (approve or hide each review); approved ones appear on the agent's website",
    _cards: board
      .filter((b) => b.image)
      .slice(0, 8)
      .map((b, i): FhiChatCard => ({ kind: "agent", title: b.agent, subtitle: `${b.reviews} review${b.reviews === 1 ? "" : "s"} · ${b.average_rating ?? "–"} / 5`, image: b.image, rank: i + 1 })),
  }
}

// ─── Activity log, member lookup, owner documents, teams, event engagement ───

const isoDay = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : null)
const isoMinute = (iso: string | null | undefined) => (iso ? iso.slice(0, 16).replace("T", " ") : null)

/** The audit trail: who did what, when — every write on the platform plus logins. */
async function activityLog(admin: Admin, args: { category?: string; event?: string; actor_name?: string; search?: string; days?: number; from_date?: string; to_date?: string; limit?: number }) {
  const limit = Math.min(Math.max(args.limit ?? 30, 1), 100)
  let from = (args.from_date ?? "").trim()
  if (!from) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - Math.min(Math.max(args.days ?? 7, 1), 365))
    from = d.toISOString().slice(0, 10)
  }
  const to = (args.to_date ?? "").trim() || null
  type Log = { id: string; occurred_at: string; category: string; event: string; source: string | null; actor_id: string | null; actor_name: string | null; actor_role: string | null; subject_type: string | null; subject_id: string | null; subject_label: string | null; description: string | null; changed_keys: string[] | null; ip_address: string | null; url: string | null }
  // PostgREST hands back at most 1000 rows per call: page up to 5000.
  const MAX = 5000
  let rows: Log[] = []
  for (let page = 0; page * 1000 < MAX; page++) {
    let q = admin
      .from("audit_logs")
      .select("id, occurred_at, category, event, source, actor_id, actor_name, actor_role, subject_type, subject_id, subject_label, description, changed_keys, ip_address, url")
      .gte("occurred_at", from)
      .order("occurred_at", { ascending: false })
      .range(page * 1000, page * 1000 + 999)
    if (to) q = q.lt("occurred_at", `${to}T00:00:00Z`)
    if (args.category?.trim()) q = q.eq("category", args.category.trim())
    if (args.event?.trim()) q = q.eq("event", args.event.trim())
    if (args.actor_name?.trim()) q = q.ilike("actor_name", `%${args.actor_name.trim().replace(/[%_]/g, "")}%`)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as Log[]))
    if (!data || data.length < 1000) break
  }
  if (args.search?.trim()) {
    const n = args.search.trim().toLowerCase()
    rows = rows.filter((r) => `${r.subject_label ?? ""} ${r.description ?? ""} ${r.actor_name ?? ""}`.toLowerCase().includes(n))
  }
  const failed = rows.filter((r) => r.event === "login_failed")
  const logins = rows.filter((r) => r.event === "login")
  return {
    period: { from, to: to ?? "today" },
    filters: { category: args.category ?? null, event: args.event ?? null, actor: args.actor_name ?? null, search: args.search ?? null },
    matching: rows.length,
    truncated: rows.length >= MAX ? `Only the newest ${MAX} entries were read — narrow the period or category` : null,
    by_category: tally(rows, (r) => r.category, 20),
    by_event: tally(rows, (r) => `${r.category}.${r.event}`, 20),
    most_active_people: tally(rows.filter((r) => r.actor_name), (r) => `${r.actor_name} (${r.actor_role ?? "automatic"})`, 10),
    _stats: [
      stat("Entries", rows.length),
      stat("Logins", logins.length, null, `${new Set(logins.map((r) => r.actor_id ?? r.actor_name)).size} people`),
      stat("Failed logins", failed.length),
    ],
    _charts: [
      ...pieChart("Activity by category", tally(rows, (r) => r.category, 8)),
      ...sharesChart("Most active people", tally(rows.filter((r) => r.actor_name && r.actor_name !== "System"), (r) => r.actor_name, 8)),
      ...(failed.length + logins.length > 0 ? pieChart("Sign-ins", [{ name: "successful", count: logins.length }, { name: "failed", count: failed.length }]) : []),
    ],
    security: {
      logins: logins.length,
      distinct_people_logged_in: new Set(logins.map((r) => r.actor_id ?? r.actor_name)).size,
      failed_logins: failed.length,
      failed_login_targets: tally(failed, (r) => r.subject_label ?? r.description, 8),
      failed_login_ips: tally(failed, (r) => r.ip_address, 5),
    },
    newest: rows.slice(0, limit).map((r) => ({
      when: isoMinute(r.occurred_at),
      who: r.actor_name ?? (r.source === "system" || !r.actor_id ? "System" : "Unknown"),
      role: r.actor_role,
      did: `${r.category}.${r.event}`,
      what: r.subject_label ?? r.subject_type,
      description: (r.description ?? "").slice(0, 200) || null,
      changed: r.changed_keys?.length ? r.changed_keys.slice(0, 12) : null,
      ip: r.ip_address,
    })),
    categories_available: ["projects", "mailer", "auth", "user_management", "teams", "security", "developers", "listings", "sales", "inquiry", "events", "finance", "website", "owner_documents", "feedback", "contact", "support"],
    where_in_dashboard: "System Logs",
  }
}

/** One member, everything in one place: identity, contacts, team, recruiter, website, listings, reviews, sales, recruits, last login. */
async function memberLookup(admin: Admin, args: { query?: string; limit?: number }) {
  const query = (args.query ?? "").trim()
  if (!query) return { error: "Who? Give a name, email, phone number or username." }
  const limit = Math.min(Math.max(args.limit ?? 5, 1), 10)
  type Prof = { id: string; role: string; fname: string | null; lname: string | null; fullname: string | null; status: string; joined_at: string | null; profile_url: string | null; username: string | null; birthday: string | null; gender: string | null; mailbox_address: string | null; metadata: Record<string, unknown> | null }
  const cols = "id, role, fname, lname, fullname, status, joined_at, profile_url, username, birthday, gender, mailbox_address, metadata"
  let matches: Prof[] = []
  const digits = query.replace(/\D/g, "")
  if (query.includes("@")) {
    // Emails live in Auth, not on the profile: walk the user list once.
    const wanted = query.toLowerCase()
    const ids: string[] = []
    // Walk every page: an exact address may sit behind partial matches.
    for (let page = 1; page <= 25; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error) throw new Error(error.message)
      for (const u of data.users) {
        const e = (u.email ?? "").toLowerCase()
        if (e === wanted) ids.unshift(u.id)
        else if (e.includes(wanted)) ids.push(u.id)
      }
      if (data.users.length < 200) break
    }
    if (ids.length) {
      const { data } = await admin.from("profiles").select(cols).in("id", ids.slice(0, limit)).neq("is_deleted", true)
      const order = new Map(ids.map((id, i) => [id, i]))
      matches = ((data ?? []) as Prof[]).sort((a, b) => (order.get(String(a.id)) ?? 99) - (order.get(String(b.id)) ?? 99))
    }
  } else if (digits.length >= 6 && digits.length >= query.replace(/\s/g, "").length - 2) {
    const tail = digits.slice(-7)
    const { data } = await admin.from("profiles").select(cols).neq("is_deleted", true).or(`metadata->>phone_number.ilike.%${tail}%,metadata->>whatsapp_number.ilike.%${tail}%`).limit(limit)
    matches = (data ?? []) as Prof[]
  } else {
    const { data: byUser } = await admin.from("profiles").select(cols).neq("is_deleted", true).ilike("username", query.replace(/[%_]/g, "")).limit(2)
    matches = (byUser ?? []) as Prof[]
    if (!matches.length) {
      const found = await findProfiles(admin, query)
      if (found.length) {
        const { data } = await admin.from("profiles").select(cols).in("id", found.map((p) => p.id))
        const order = new Map(found.map((p, i) => [p.id, i]))
        matches = ((data ?? []) as Prof[]).sort((a, b) => (order.get(String(a.id)) ?? 99) - (order.get(String(b.id)) ?? 99))
      }
    }
  }
  if (!matches.length) {
    // Not a member — maybe a client (buyer recorded on a sale) or an event registrant.
    const tail = digits.length >= 6 ? digits.slice(-7) : null
    const clientQ = admin.from("clients").select("id, first_name, last_name, email, phone, country, created_by, created_at").limit(5)
    const { data: clients } = query.includes("@")
      ? await clientQ.ilike("email", `%${query.replace(/[%_]/g, "")}%`)
      : tail
        ? await clientQ.ilike("phone", `%${tail}%`)
        : await clientQ.or(`first_name.ilike.%${query.replace(/[%_]/g, "")}%,last_name.ilike.%${query.replace(/[%_]/g, "")}%`)
    const cl = (clients ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null; country: string | null; created_by: string | null; created_at: string }[]
    if (cl.length) {
      const agents = await profileNames(admin, cl.map((c) => c.created_by))
      return {
        query,
        matches: 0,
        not_a_member: `No FHI member matches "${query}" — but the client book does.`,
        clients: cl.map((c) => ({ client: [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed", email: c.email, phone: c.phone, country: c.country, recorded_by: agents.get(String(c.created_by)) ?? "Unknown", recorded_on: isoDay(c.created_at) })),
        hint: "For the client's deals use clients_overview with search",
      }
    }
    return { error: `No FHI member, and no client, matching "${query}"` }
  }
  matches = matches.slice(0, limit)
  const ids = matches.map((m) => String(m.id))

  const sales = await fetchAllSales(admin)
  const [memberships, teams, sites, listings, reviews, recruits, logins, auth] = await Promise.all([
    admin.from("team_memberships").select("user_id, team_id, role_in_team, joined_at").in("user_id", ids).eq("is_active", true),
    admin.from("teams").select("id, name").eq("is_active", true),
    admin.from("website_builder").select("agent_id, slug, is_published, title").in("agent_id", ids),
    admin.from("agent_listings").select("agent_id, status").in("agent_id", ids).is("deleted_at", null),
    admin.from("agent_feedback").select("agent_id, overall_rating, status").in("agent_id", ids),
    admin.from("profiles").select("id, metadata").neq("is_deleted", true).limit(5000),
    admin.from("audit_logs").select("actor_id, occurred_at").eq("event", "login").in("actor_id", ids).order("occurred_at", { ascending: false }).limit(200),
    Promise.all(ids.map((id) => admin.auth.admin.getUserById(id).then((r) => [id, r.data.user] as const).catch(() => [id, null] as const))),
  ])
  const teamName = new Map(((teams.data ?? []) as { id: string; name: string }[]).map((t) => [String(t.id), t.name]))
  const inviterIds = matches.map((m) => (m.metadata?.invited_by as string | undefined) ?? null)
  const inviterNames = await profileNames(admin, inviterIds)
  const recruitCount = new Map<string, number>()
  for (const p of (recruits.data ?? []) as { id: string; metadata: Record<string, unknown> | null }[]) {
    const by = p.metadata?.invited_by
    if (typeof by === "string" && ids.includes(by) && !p.metadata?.developer_invite_id) recruitCount.set(by, (recruitCount.get(by) ?? 0) + 1)
  }
  const lastLogin = new Map<string, string>()
  for (const l of (logins.data ?? []) as { actor_id: string; occurred_at: string }[]) if (!lastLogin.has(l.actor_id)) lastLogin.set(l.actor_id, l.occurred_at)
  const authById = new Map(auth.map(([id, u]) => [id, u]))
  const phone = (m: Prof, kind: "phone" | "whatsapp") => {
    const d = waDigits(m.metadata?.[`${kind}_country_code`] as string | undefined, m.metadata?.[`${kind}_number`] as string | undefined)
    return d ? `+${d}` : null
  }
  const base = SITE_URL.replace(/\/$/, "")

  const people = matches.map((m) => {
    const id = String(m.id)
    const credits = sales.filter((s) => s.validation_status === "validated").flatMap((s) => saleCredits(s).filter((c) => c.agentId === id).map((c) => ({ ...c, date: (s.reservation_date ?? s.created_at).slice(0, 10) })))
    const pendingCount = sales.filter((s) => (s.validation_status ?? "pending") === "pending" && saleCredits(s).some((c) => c.agentId === id)).length
    const myTeams = ((memberships.data ?? []) as { user_id: string; team_id: string; role_in_team: string | null; joined_at: string | null }[]).filter((t) => String(t.user_id) === id)
    const site = ((sites.data ?? []) as { agent_id: string; slug: string | null; is_published: boolean | null; title: string | null }[]).find((s) => String(s.agent_id) === id)
    const myListings = ((listings.data ?? []) as { agent_id: string; status: string }[]).filter((l) => String(l.agent_id) === id)
    const myReviews = ((reviews.data ?? []) as { agent_id: string; overall_rating: number | null; status: string }[]).filter((r) => String(r.agent_id) === id && r.status !== "hidden")
    const u = authById.get(id)
    const inviter = m.metadata?.invited_by as string | undefined
    return {
      name: m.fullname,
      role: m.role,
      status: m.status,
      username: m.username,
      email: u?.email ?? null,
      phone: phone(m, "phone"),
      whatsapp: phone(m, "whatsapp"),
      company_mailbox: m.mailbox_address,
      nationality: (m.metadata?.nationality as string | undefined) ?? null,
      license_number: (m.metadata?.license_number as string | undefined) ?? null,
      birthday: m.birthday,
      joined: isoDay(m.joined_at),
      last_login: isoMinute(lastLogin.get(id) ?? u?.last_sign_in_at ?? null),
      invited_by: inviter ? inviterNames.get(inviter) ?? "Unknown" : null,
      auto_approves_recruits: m.metadata?.auto_approve_recruits === true,
      recruits: recruitCount.get(id) ?? 0,
      teams: myTeams.map((t) => ({ team: teamName.get(String(t.team_id)) ?? "Unknown team", role: t.role_in_team ?? "member", since: isoDay(t.joined_at) })),
      website: site ? { live: Boolean(site.is_published), url: site.slug ? `${base}/website/${site.slug}` : null, title: site.title } : null,
      listings: { total: myListings.length, published: myListings.filter((l) => l.status === "published").length },
      reviews: { count: myReviews.length, average_rating: myReviews.length ? Math.round((myReviews.reduce((a, r) => a + (r.overall_rating ?? 0), 0) / myReviews.length) * 100) / 100 : null },
      sales: { validated_deals: credits.length, validated_value_aed: Math.round(credits.reduce((a, c) => a + c.value, 0)), pending_deals: pendingCount, last_validated_sale: credits.map((c) => c.date).sort().pop() ?? null },
      dashboard_link: `/dashboard/superadmin/accounts/users?account=${id}`,
    }
  })
  return {
    query,
    matches: people.length,
    people,
    _cards: matches.filter((m) => m.profile_url).slice(0, 5).map((m): FhiChatCard => ({ kind: "agent", title: m.fullname ?? "Member", subtitle: `${m.role.replace(/_/g, " ")} · ${m.status}`, image: m.profile_url })),
  }
}

/** Owner document requests: the title-deed / NOC collection links agents send to property owners. */
async function ownerDocuments(admin: Admin, args: { status?: string; agent_name?: string; limit?: number }) {
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 60)
  let q = admin
    .from("owner_document_requests")
    .select("id, agent_id, label, status, owner_name, owner_email, owner_mobile, property_building, unit_number, community_area, title_deed_number, noc_valid_until, submitted_at, expires_at, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(2000)
  const status = (args.status ?? "all").trim()
  if (status !== "all") q = q.eq("status", status)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  type Req = { id: string; agent_id: string | null; label: string | null; status: string; owner_name: string | null; owner_email: string | null; owner_mobile: string | null; property_building: string | null; unit_number: string | null; community_area: string | null; title_deed_number: string | null; noc_valid_until: string | null; submitted_at: string | null; expires_at: string | null; created_at: string }
  let rows = (data ?? []) as Req[]
  let agentMatches: string[] | null = null
  if (args.agent_name?.trim()) {
    const found = await findProfiles(admin, args.agent_name)
    if (!found.length) return { error: `No FHI member matching "${args.agent_name}"` }
    const ids = new Set(found.map((p) => p.id))
    agentMatches = found.map((p) => p.fullname ?? "Unknown")
    rows = rows.filter((r) => ids.has(String(r.agent_id)))
  }
  const names = await profileNames(admin, rows.map((r) => r.agent_id))
  const { data: files } = rows.length ? await admin.from("owner_document_files").select("request_id").in("request_id", rows.map((r) => r.id)) : { data: [] }
  const fileCount = new Map<string, number>()
  for (const f of (files ?? []) as { request_id: string }[]) fileCount.set(f.request_id, (fileCount.get(f.request_id) ?? 0) + 1)
  const now = Date.now()
  const pending = rows.filter((r) => r.status === "pending")
  const expired = pending.filter((r) => r.expires_at && Date.parse(r.expires_at) < now)
  return {
    filters: { status, agent_name_matched: agentMatches },
    matching: rows.length,
    by_status: tally(rows, (r) => r.status),
    pending_links_open: pending.length,
    pending_but_link_expired: expired.length,
    submitted_waiting_review: rows.filter((r) => r.status === "submitted").length,
    by_agent: tally(rows, (r) => names.get(String(r.agent_id)) ?? "Unknown"),
    requests: rows.slice(0, limit).map((r) => ({
      agent: names.get(String(r.agent_id)) ?? "Unknown",
      label: r.label && !/^https?:/.test(r.label) ? r.label : null,
      status: r.status,
      owner: r.owner_name,
      owner_email: r.owner_email,
      owner_mobile: r.owner_mobile,
      property: [r.property_building, r.unit_number ? `Unit ${r.unit_number}` : null, r.community_area].filter(Boolean).join(", ") || null,
      title_deed: r.title_deed_number,
      noc_valid_until: isoDay(r.noc_valid_until),
      sent: isoDay(r.created_at),
      submitted: isoDay(r.submitted_at),
      link_expires: isoDay(r.expires_at),
      link_expired: Boolean(r.expires_at && Date.parse(r.expires_at) < now && r.status === "pending"),
      files_uploaded: fileCount.get(r.id) ?? 0,
    })),
    meaning: "pending = link sent, owner hasn't submitted; submitted = owner filled it in, agent/admin to review; cancelled = withdrawn",
    where_in_dashboard: "Owner Documents (admins see every agent's requests)",
  }
}

/** Teams in detail: rosters, leaders, validated sales per team, and selling accounts with no team. */
async function teamsDetail(admin: Admin, args: { team_name?: string; include_members?: boolean; limit?: number }) {
  const limit = Math.min(Math.max(args.limit ?? 60, 1), 300)
  const [{ data: teams, error }, { data: memberships }, sales] = await Promise.all([
    admin.from("teams").select("id, name, slug, description, team_type, parent_id, is_active, created_at").eq("is_active", true).order("name"),
    admin.from("team_memberships").select("user_id, team_id, role_in_team, joined_at").eq("is_active", true).limit(10000),
    fetchAllSales(admin),
  ])
  if (error) throw new Error(error.message)
  type Team = { id: string; name: string; slug: string | null; description: string | null; team_type: string | null; parent_id: string | null; is_active: boolean; created_at: string }
  type Mem = { user_id: string; team_id: string; role_in_team: string | null; joined_at: string | null }
  let list = (teams ?? []) as Team[]
  const mems = (memberships ?? []) as Mem[]
  if (args.team_name?.trim()) {
    const n = args.team_name.trim().toLowerCase()
    list = list.filter((t) => t.name.toLowerCase().includes(n))
    if (!list.length) return { error: `No team matching "${args.team_name}"`, teams_available: ((teams ?? []) as Team[]).map((t) => t.name) }
  }
  const memberIds = [...new Set(mems.map((m) => String(m.user_id)))]
  const { data: profiles } = memberIds.length ? await admin.from("profiles").select("id, fullname, role, status, joined_at").in("id", memberIds) : { data: [] }
  const prof = new Map(((profiles ?? []) as { id: string; fullname: string | null; role: string; status: string; joined_at: string | null }[]).map((p) => [String(p.id), p]))
  const validated = sales.filter((s) => s.validation_status === "validated")
  const creditByAgent = new Map<string, { deals: number; value: number }>()
  for (const s of validated) for (const c of saleCredits(s)) {
    const cur = creditByAgent.get(c.agentId) ?? { deals: 0, value: 0 }
    cur.deals++
    cur.value += c.value
    creditByAgent.set(c.agentId, cur)
  }
  const teamName = new Map(((teams ?? []) as Team[]).map((t) => [String(t.id), t.name]))
  // A team includes its subteams at any depth (a leader inside CMG with their own team still counts for CMG).
  const allTeamRows = (teams ?? []) as Team[]
  const treeOf = (rootId: string): Set<string> => {
    const ids = new Set<string>([rootId])
    for (let grew = true; grew; ) {
      grew = false
      for (const x of allTeamRows) if (x.parent_id && ids.has(String(x.parent_id)) && !ids.has(String(x.id))) { ids.add(String(x.id)); grew = true }
    }
    return ids
  }
  const out = list.map((t) => {
    const tree = treeOf(String(t.id))
    const members = mems.filter((m) => tree.has(String(m.team_id)))
    // Leaders of THIS team only; subteam leaders show under their own team.
    const leaders = members.filter((m) => String(m.team_id) === String(t.id) && /lead|head|manager/i.test(m.role_in_team ?? ""))
    const value = members.reduce((a, m) => a + (creditByAgent.get(String(m.user_id))?.value ?? 0), 0)
    const deals = members.reduce((a, m) => a + (creditByAgent.get(String(m.user_id))?.deals ?? 0), 0)
    return {
      team: t.name,
      type: t.team_type,
      parent_team: t.parent_id ? teamName.get(String(t.parent_id)) ?? null : null,
      subteams: [...tree].filter((id) => id !== String(t.id)).map((id) => teamName.get(id) ?? id),
      totals_include_subteams: tree.size > 1,
      created: isoDay(t.created_at),
      members: members.length,
      active_members: members.filter((m) => prof.get(String(m.user_id))?.status === "active").length,
      leaders: leaders.map((m) => prof.get(String(m.user_id))?.fullname ?? "Unknown"),
      roles_in_team: tally(members, (m) => m.role_in_team ?? "member"),
      validated_deals: deals,
      validated_value_aed: Math.round(value),
      members_who_sold: members.filter((m) => creditByAgent.has(String(m.user_id))).length,
      ...(args.include_members !== false
        ? {
            roster: members
              .map((m) => ({ name: prof.get(String(m.user_id))?.fullname ?? "Unknown", account_role: prof.get(String(m.user_id))?.role ?? null, status: prof.get(String(m.user_id))?.status ?? null, role_in_team: m.role_in_team ?? "member", since: isoDay(m.joined_at), validated_deals: creditByAgent.get(String(m.user_id))?.deals ?? 0, validated_value_aed: Math.round(creditByAgent.get(String(m.user_id))?.value ?? 0) }))
              .sort((a, b) => b.validated_value_aed - a.validated_value_aed || a.name.localeCompare(b.name))
              .slice(0, limit),
          }
        : {}),
    }
  }).sort((a, b) => b.validated_value_aed - a.validated_value_aed || b.members - a.members)

  // Selling accounts that belong to no active team.
  const { data: sellers } = await admin.from("profiles").select("id, fullname, role, joined_at").in("role", [...ROLES_SALES_PIPELINE]).eq("status", "active").neq("is_deleted", true).limit(5000)
  const inTeam = new Set(mems.map((m) => String(m.user_id)))
  const noTeam = ((sellers ?? []) as { id: string; fullname: string | null; role: string; joined_at: string | null }[]).filter((p) => !inTeam.has(String(p.id)))
  return {
    filters: { team_name: args.team_name ?? null },
    teams: out.length,
    ...(out.length === 0 && !args.team_name ? { note: "There are NO active teams right now — none have been created since the team structure was cleared; every selling account is currently without a team." } : {}),
    total_memberships: mems.length,
    people_in_teams: memberIds.length,
    selling_accounts_without_a_team: { count: noTeam.length, by_role: tally(noTeam, (p) => p.role), names: noTeam.sort((a, b) => (b.joined_at ?? "").localeCompare(a.joined_at ?? "")).slice(0, 40).map((p) => `${p.fullname ?? "Unknown"} (${p.role.replace(/_/g, " ")}, joined ${isoDay(p.joined_at) ?? "?"})`) },
    team_list: out,
    _stats: [
      stat("Active teams", out.length),
      stat("People in teams", memberIds.length),
      stat("Selling accounts without a team", noTeam.length),
    ],
    _charts: [
      ...sharesChart("Validated sales value by team", out.map((t) => ({ name: t.team, count: t.validated_value_aed })), AED),
      ...pieChart("Selling accounts: in a team vs none", [{ name: "in a team", count: memberIds.length }, { name: "no team", count: noTeam.length }]),
    ],
    where_in_dashboard: "Teams (rosters, transfers) and Team Sales",
  }
}

/** How each event did: registrations, certificate downloads, views, QR scans, who invited whom. */
async function eventEngagement(admin: Admin, args: { event_title?: string; limit?: number }) {
  const limit = Math.min(Math.max(args.limit ?? 12, 1), 50)
  let q = admin
    .from("events")
    .select("id, title, event_date, event_days, venue, status, agent_id, show_on_main, show_on_website, registration_open, certificate, view_count, qr_scan_count, created_at")
    .is("deleted_at", null)
    .order("event_date", { ascending: false })
    .limit(200)
  if (args.event_title?.trim()) q = q.ilike("title", `%${args.event_title.trim().replace(/[%_]/g, "")}%`)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  type Ev = { id: string; title: string; event_date: string | null; event_days: number | null; venue: string | null; status: string | null; agent_id: string | null; show_on_main: boolean | null; show_on_website: boolean | null; registration_open: boolean | null; certificate: unknown; view_count: number | null; qr_scan_count: number | null; created_at: string }
  const events = (data ?? []) as Ev[]
  if (!events.length) return { error: args.event_title ? `No event matching "${args.event_title}"` : "No events yet" }
  const ids = events.map((e) => e.id)
  const [{ data: regs }, { data: downloads }, owners] = await Promise.all([
    admin.from("event_registrations").select("event_id, invited_by, certificate_sent_at, created_at").in("event_id", ids).limit(20000),
    admin.from("event_certificate_downloads").select("event_id, registration_id, full_name, email, ip, created_at").in("event_id", ids).limit(20000),
    profileNames(admin, events.map((e) => e.agent_id)),
  ])
  type Reg = { event_id: string; invited_by: string | null; certificate_sent_at: string | null; created_at: string }
  type Dl = { event_id: string; registration_id: string | null; full_name: string | null; email: string | null; ip: string | null; created_at: string }
  const R = (regs ?? []) as Reg[]
  const D = (downloads ?? []) as Dl[]
  const now = Date.now()
  const list = events.slice(0, limit).map((e) => {
    const r = R.filter((x) => x.event_id === e.id)
    const d = D.filter((x) => x.event_id === e.id)
    // Most download rows carry only the name typed on the certificate page.
    const uniq = new Set(d.map((x) => x.registration_id ?? x.email?.toLowerCase() ?? x.full_name?.trim().toLowerCase() ?? x.ip ?? "")).size
    const days = r.map((x) => x.created_at.slice(0, 10))
    return {
      event: e.title,
      date: isoDay(e.event_date),
      days: e.event_days ?? 1,
      when: eventWhenLabel(e.event_date, e.event_days, "short"),
      venue: e.venue,
      status: e.status,
      past: e.event_date ? eventIsPast(e.event_date, e.event_days, now) : null,
      run_by: e.agent_id ? owners.get(String(e.agent_id)) ?? "An agent" : "FHI (company event)",
      on_main_events_page: e.agent_id ? Boolean(e.show_on_main) : true,
      on_agent_website: e.agent_id ? e.show_on_website !== false : false,
      registration_open: Boolean(e.registration_open),
      registrations: r.length,
      registrations_by_day_peak: days.length ? tally(days, (x) => x, 1)[0] : null,
      certificates_sent: r.filter((x) => x.certificate_sent_at).length,
      certificate_downloads: d.length,
      unique_downloaders: uniq,
      download_rate_percent: r.length ? Math.round((100 * uniq) / r.length) : null,
      page_views: e.view_count ?? 0,
      qr_scans: e.qr_scan_count ?? 0,
      views_to_registration_percent: e.view_count ? Math.round((100 * r.length) / e.view_count) : null,
      top_inviters: tally(r.filter((x) => x.invited_by?.trim()), (x) => x.invited_by, 5),
    }
  })
  return {
    filters: { event_title: args.event_title ?? null },
    events: events.length,
    totals: { registrations: R.length, certificate_downloads: D.length, page_views: events.reduce((a, e) => a + (e.view_count ?? 0), 0), qr_scans: events.reduce((a, e) => a + (e.qr_scan_count ?? 0), 0) },
    event_list: list,
    _stats:
      list.length === 1
        ? [
            stat("Registrations", list[0].registrations),
            stat("Certificate downloads", list[0].certificate_downloads, null, `${list[0].unique_downloaders} people · ${list[0].download_rate_percent ?? 0}% of registrants`),
            stat("Page views", list[0].page_views, null, list[0].views_to_registration_percent != null ? `${list[0].views_to_registration_percent}% registered` : null),
            stat("QR scans", list[0].qr_scans),
          ]
        : [
            stat("Events", events.length),
            stat("Registrations", R.length),
            stat("Certificate downloads", D.length),
            stat("Page views", events.reduce((a, e) => a + (e.view_count ?? 0), 0)),
          ],
    _charts: [
      ...(list.length > 1 ? sharesChart("Registrations by event", list.map((e) => ({ name: e.event, count: e.registrations }))) : []),
      ...(list.length > 1 ? sharesChart("Certificate downloads by event", list.map((e) => ({ name: e.event, count: e.certificate_downloads }))) : []),
      ...(list.length === 1
        ? barsChart("Registrations by day", [...R.filter((x) => x.event_id === events[0].id).reduce((m, x) => m.set(x.created_at.slice(0, 10), (m.get(x.created_at.slice(0, 10)) ?? 0) + 1), new Map<string, number>()).entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14).map(([d, n]) => ({ label: new Date(`${d}T00:00:00Z`).toLocaleDateString("en-AE", { month: "short", day: "numeric", timeZone: "UTC" }), value: n, display: String(n) })))
        : []),
      ...(list.length === 1 ? pieChart("Registrants who downloaded a certificate", [{ name: "downloaded", count: list[0].unique_downloaders }, { name: "not yet", count: Math.max(0, list[0].registrations - list[0].unique_downloaders) }]) : []),
    ],
    note: "Registrant NAMES are in event_attendees; this is the engagement picture per event",
  }
}

// ─── Website news + data health ──────────────────────────────────────────────

/** The news feed as the public site shows it: latest stories, most read, by category. */
async function newsOverview(_admin: Admin, args: { limit?: number; search?: string; category?: string }) {
  const limit = Math.min(Math.max(args.limit ?? 8, 1), 25)
  const pages = await Promise.all([1, 2, 3].map((page) => fetchArticlesList({ page, perPage: 50, search: args.search?.trim() || undefined }).catch(() => null)))
  const seen = new Set<string>()
  let articles = pages.flatMap((p) => p?.articles ?? []).filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)))
  if (args.category?.trim()) {
    const c = args.category.trim().toLowerCase()
    articles = articles.filter((a) => (a.category ?? "").toLowerCase().includes(c) || (a.categorySlug ?? "").includes(c))
  }
  if (!articles.length) return { error: pages.every((p) => p === null) ? "The news feed is unavailable right now" : "No articles match" }
  const base = SITE_URL.replace(/\/$/, "")
  const line = (a: NewsArticle) => ({
    title: a.title,
    published: (a.publishedAt ?? a.date ?? "").slice(0, 10) || null,
    category: a.category ?? null,
    views: a.viewsCount ?? null,
    author: a.author ?? null,
    indexable_for_google: isIndexableNewsArticle(a),
    url: a.slug ? `${base}/news/${a.slug}` : null,
  })
  const byDate = [...articles].sort((a, b) => (b.publishedAt ?? b.date ?? "").localeCompare(a.publishedAt ?? a.date ?? ""))
  const withViews = articles.filter((a) => typeof a.viewsCount === "number")
  const mostRead = [...withViews].sort((a, b) => (b.viewsCount ?? 0) - (a.viewsCount ?? 0))
  const last7 = byDate.filter((a) => Date.parse(a.publishedAt ?? a.date ?? "") > Date.now() - 7 * 86400e3)
  return {
    source: "HomesPH news feed as shown on fhiglobal.ae/news (views counted on our site)",
    articles_checked: articles.length,
    total_in_feed: pages[0]?.total ?? null,
    published_last_7_days: last7.length,
    published_last_30_days: byDate.filter((a) => Date.parse(a.publishedAt ?? a.date ?? "") > Date.now() - 30 * 86400e3).length,
    total_views_on_checked: withViews.reduce((s, a) => s + (a.viewsCount ?? 0), 0),
    by_category: tally(articles, (a) => a.category),
    latest: byDate.slice(0, limit).map(line),
    most_read: mostRead.slice(0, limit).map(line),
    _stats: [
      stat("Articles in feed", pages[0]?.total ?? articles.length),
      stat("Published last 7 days", last7.length),
      stat("Most read", mostRead[0] ? `${(mostRead[0].viewsCount ?? 0).toLocaleString("en-AE")} views` : "–", null, mostRead[0]?.title ?? null),
      stat("Categories", tally(articles, (a) => a.category, 50).filter((c) => c.name !== "Not given").length),
    ],
    _charts: [
      ...sharesChart("Most read articles", mostRead.slice(0, 8).map((a) => ({ name: a.title.length > 48 ? `${a.title.slice(0, 46)}…` : a.title, count: a.viewsCount ?? 0 }))),
      ...pieChart("Articles by category", tally(articles, (a) => a.category, 6)),
    ],
    where_on_site: "/news (homepage carousel shows the newest)",
  }
}

/**
 * What is missing on the site's own records — the gaps that make other
 * answers weaker: projects without a price, payment plan, photo, handover,
 * map pin or permit; listings without a price; clients sharing one contact.
 */
async function dataHealth(admin: Admin, args: { area?: "projects" | "listings" | "clients" | "all"; limit?: number }) {
  const area = args.area ?? "all"
  const limit = Math.min(Math.max(args.limit ?? 15, 1), 60)
  const out: Record<string, unknown> = { checked_on: new Date().toISOString().slice(0, 10) }
  const stats: FhiChatStat[] = []
  const charts: FhiChatChart[] = []

  if (area === "all" || area === "projects") {
    const { data, error } = await admin
      .from("projects")
      .select("id, name, slug, launch_price_from, payment_plan_details, main_image, delivery_quarter, expected_completion_date, delivery_date, latitude, longitude, trakheesi_permit_number, trakheesi_permit_url, trakheesi_permit_link, community, location, city, description, developers(name, slug), project_units(id)")
      .is("deleted_at", null)
      .eq("is_active", true)
      .eq("is_published", true)
      .limit(1000)
    if (error) throw new Error(error.message)
    type P = { id: number; name: string; slug: string; launch_price_from: number | string | null; payment_plan_details: string | null; main_image: string | null; delivery_quarter: string | null; expected_completion_date: string | null; delivery_date: string | null; latitude: string | null; longitude: string | null; trakheesi_permit_number: string | null; trakheesi_permit_url: string | null; trakheesi_permit_link: string | null; community: string | null; location: string | null; city: string | null; description: string | null; developers: { name: string; slug: string | null } | { name: string; slug: string | null }[] | null; project_units: { id: number }[] | null }
    const rows = (data ?? []) as P[]
    const blank = (v: unknown) => v == null || (typeof v === "string" && v.trim() === "")
    const checks: Array<[string, (p: P) => boolean]> = [
      ["no price", (p) => blank(p.launch_price_from) && !(p.project_units ?? []).length],
      ["no payment plan", (p) => blank(p.payment_plan_details)],
      ["no photo", (p) => blank(p.main_image)],
      ["no handover date", (p) => blank(p.delivery_quarter) && blank(p.expected_completion_date) && blank(p.delivery_date)],
      ["no map pin", (p) => blank(p.latitude) || blank(p.longitude)],
      // Trakheesi (the DLD's advertising permit) applies to Dubai only — Abu Dhabi and the northern
      // emirates have their own regimes. A Dubai project advertised without a permit number is the
      // compliance gap; a QR image with no decoded DLD link can't be verified by a buyer (the admin's
      // "Re-read" on the permit tab fills it in).
      ["no permit number (Dubai)", (p) => isDubaiCity(p.city) && blank(p.trakheesi_permit_number)],
      ["permit QR without a verify link", (p) => !blank(p.trakheesi_permit_url) && blank(p.trakheesi_permit_link)],
      ["no unit table", (p) => !(p.project_units ?? []).length],
      ["no area", (p) => blank(p.community) && blank(p.location)],
      ["no description", (p) => blank(p.description)],
    ]
    const gaps = rows.map((p) => ({ p, missing: checks.filter(([, f]) => f(p)).map(([k]) => k) }))
    const counts = checks.map(([k]) => ({ name: k, count: gaps.filter((g) => g.missing.includes(k)).length }))
    const complete = gaps.filter((g) => g.missing.length === 0).length
    const base = SITE_URL.replace(/\/$/, "")
    const url = (p: P) => {
      const d = Array.isArray(p.developers) ? p.developers[0] : p.developers
      return d?.slug ? `${base}/${d.slug}/${p.slug}` : null
    }
    // Records that should not be public: placeholder wording in the NAME. Reported on its own — it is not a
    // "missing data" check, and a project that looks like test data is fixed by unpublishing it, not by filling a field.
    const testProjects = rows.filter((p) => PLACEHOLDER_WORDS.test(p.name ?? ""))
    out.projects = {
      published: rows.length,
      complete_on_every_check: complete,
      gaps_by_check: counts,
      looks_like_test_data: testProjects.map((p) => ({ project: p.name, page: url(p) })),
      most_incomplete: [...gaps]
        .sort((a, b) => b.missing.length - a.missing.length || a.p.name.localeCompare(b.p.name))
        .slice(0, limit)
        .map((g) => ({ project: g.p.name, developer: (Array.isArray(g.p.developers) ? g.p.developers[0] : g.p.developers)?.name ?? null, missing: g.missing, page: url(g.p) })),
      by_developer_missing_payment_plan: tally(gaps.filter((g) => g.missing.includes("no payment plan")), (g) => (Array.isArray(g.p.developers) ? g.p.developers[0] : g.p.developers)?.name ?? "Unknown", 8),
      where_to_fix: "Projects → edit the project (price, payment plan, photos, handover, map pin, permit)",
    }
    stats.push(stat("Published projects", rows.length, null, `${complete} complete on every check`), stat("No payment plan", counts.find((c) => c.name === "no payment plan")?.count ?? 0), stat("No handover date", counts.find((c) => c.name === "no handover date")?.count ?? 0), stat("No map pin", counts.find((c) => c.name === "no map pin")?.count ?? 0))
    charts.push(...barsChart("Projects missing…", counts.filter((c) => c.count > 0).map((c) => ({ label: c.name.replace(/^no /, ""), value: c.count, display: String(c.count) }))))
  }

  if (area === "all" || area === "listings") {
    const { data, error } = await admin.from("agent_listings").select("id, title, description, price, unit_type, project_id, agent_id, status, slug, created_at, projects(name, is_published, is_active, deleted_at)").is("deleted_at", null).neq("status", "archived").limit(2000)
    if (error) throw new Error(error.message)
    type LProject = ({ name: string | null } & ProjectLiveFlags) | null
    type L = { id: string; title: string | null; description: string | null; price: number | string | null; unit_type: string | null; project_id: number | null; agent_id: string; status: string; slug: string | null; created_at: string | null; projects: LProject | LProject[] }
    const rows = (data ?? []) as unknown as L[]
    const projectOf = (l: L): LProject => (Array.isArray(l.projects) ? l.projects[0] ?? null : l.projects ?? null)
    const { data: imgs } = rows.length ? await admin.from("agent_listing_images").select("listing_id").in("listing_id", rows.map((l) => l.id)) : { data: [] }
    const withImg = new Set(((imgs ?? []) as { listing_id: string }[]).map((i) => i.listing_id))
    const names = await profileNames(admin, rows.map((l) => l.agent_id))
    const noPrice = rows.filter((l) => !(Number(l.price ?? 0) > 0))
    const noPhoto = rows.filter((l) => !withImg.has(l.id))
    const noType = rows.filter((l) => !l.unit_type)
    // A page with next to no text is thin content in search (the publish checklist asks for MIN_LISTING_DESCRIPTION
    // characters; listings that went live before it existed are not held to it).
    const shortDescription = rows.filter((l) => (l.description ?? "").trim().length < MIN_LISTING_DESCRIPTION)
    const drafts = rows.filter((l) => l.status === "draft")
    // Records that should not be public: test/placeholder wording in the title, the description or the NAME of
    // the project it links (the test listing that reached the sitemap is titled just "luxury" — the giveaways
    // are "Test development" in its text and the project "Test IT purposes"; the site already hides it by
    // title + project name, this keeps it on the clean-up list until an admin unpublishes it), a listing on a
    // project that is no longer public (its page shows no photos or price and is noindex), and the same
    // title posted more than once (the slug trigger suffixes the later ones, "azizi-venice-d35c") —
    // duplicate pages competing with each other in search.
    const testNamed = rows.filter(
      (l) => isTestRecord({ title: l.title, projectName: projectOf(l)?.name }) || PLACEHOLDER_WORDS.test(l.description ?? ""),
    )
    const onRetiredProject = rows.filter((l) => l.project_id != null && !isLiveProject(projectOf(l)))
    const byTitle = new Map<string, L[]>()
    for (const l of rows) {
      const t = (l.title ?? "").trim().toLowerCase().replace(/\s+/g, " ")
      if (t) byTitle.set(t, [...(byTitle.get(t) ?? []), l])
    }
    const duplicateTitles = [...byTitle.values()].filter((list) => list.length > 1)
    out.listings = {
      live_or_draft: rows.length,
      no_price: noPrice.length,
      no_photo: noPhoto.length,
      no_unit_type: noType.length,
      short_description: shortDescription.length,
      drafts_never_published: drafts.length,
      looks_like_test_data: testNamed.map((l) => ({ listing: l.title, status: l.status, linked_project: projectOf(l)?.name ?? null, page: l.slug ? `${SITE_URL.replace(/\/$/, "")}/listings/${l.slug}` : null })),
      linked_project_not_live: onRetiredProject.map((l) => ({ listing: l.title, status: l.status, linked_project: projectOf(l)?.name ?? null, page: l.slug ? `${SITE_URL.replace(/\/$/, "")}/listings/${l.slug}` : null })),
      duplicate_title_groups: duplicateTitles.slice(0, limit).map((list) => {
        // Keep the OLDEST copy: its address has the history (links, indexing); the later ones carry the suffixed slugs.
        const oldestFirst = [...list].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
        const pageOf = (l: L) => (l.slug ? `/listings/${l.slug}` : l.id)
        return {
          title: list[0].title,
          copies: list.length,
          keep: pageOf(oldestFirst[0]),
          remove: oldestFirst.slice(1).map(pageOf),
          agents: [...new Set(list.map((l) => names.get(String(l.agent_id)) ?? "Unknown"))],
        }
      }),
      fix_list: rows
        .map((l) => ({ l, missing: [!(Number(l.price ?? 0) > 0) && "no price", !withImg.has(l.id) && "no photo", !l.unit_type && "no unit type", !l.project_id && "no project linked", (l.description ?? "").trim().length < MIN_LISTING_DESCRIPTION && "short description"].filter(Boolean) as string[] }))
        .filter((x) => x.missing.length)
        .slice(0, limit)
        .map((x) => ({ listing: x.l.title, agent: names.get(String(x.l.agent_id)) ?? "Unknown", status: x.l.status, missing: x.missing })),
      where_to_fix: "Listings → the agent edits their own; admins can edit any",
    }
    stats.push(stat("Listings without a price", noPrice.length, null, `of ${rows.length}`), stat("Listings with a short description", shortDescription.length, null, `under ${MIN_LISTING_DESCRIPTION} characters`))
    if (testNamed.length || duplicateTitles.length || onRetiredProject.length) {
      stats.push(
        stat("Test-looking listings", testNamed.length),
        stat("Listings on a project that is not public", onRetiredProject.length),
        stat("Duplicate-title listings", duplicateTitles.reduce((a, list) => a + list.length, 0)),
      )
    }
  }

  if (area === "all" || area === "clients") {
    const { data, error } = await admin.from("clients").select("id, first_name, last_name, email, phone, country, created_by").limit(5000)
    if (error) throw new Error(error.message)
    type C = { id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null; country: string | null; created_by: string | null }
    const rows = (data ?? []) as C[]
    const byEmail = new Map<string, C[]>()
    for (const c of rows) {
      const e = (c.email ?? "").trim().toLowerCase()
      if (e) byEmail.set(e, [...(byEmail.get(e) ?? []), c])
    }
    const shared = [...byEmail.entries()].filter(([, list]) => list.length > 1)
    const names = await profileNames(admin, rows.map((c) => c.created_by))
    out.clients = {
      total: rows.length,
      missing_email: rows.filter((c) => !c.email?.trim()).length,
      missing_phone: rows.filter((c) => !c.phone?.trim()).length,
      missing_country: rows.filter((c) => !c.country?.trim()).length,
      clients_sharing_one_email: shared.reduce((a, [, l]) => a + l.length, 0),
      shared_emails: shared.slice(0, limit).map(([email, list]) => ({ email, clients: list.map((c) => [c.first_name, c.last_name].filter(Boolean).join(" ")), recorded_by: [...new Set(list.map((c) => names.get(String(c.created_by)) ?? "Unknown"))] })),
      note: "Several clients on one email usually means the agent typed their own address as a placeholder — the client can't be contacted",
      where_to_fix: "Sales → open the sale → client details",
    }
    stats.push(stat("Clients sharing one email", shared.reduce((a, [, l]) => a + l.length, 0), null, `of ${rows.length}`))
  }

  out._stats = stats
  out._charts = charts
  return out
}

// ─── OpenAI tool definitions + dispatcher ────────────────────────────────────

export const FHI_CHAT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "top_agents",
      description:
        "Leaderboard of agents by VALIDATED sales value for a period (company Top Sales board). Can be narrowed to ONE developer's or ONE project's deals — use that for 'which agents sold Azizi deals' / 'who sold this project'.",
      parameters: {
        type: "object",
        properties: {
          scope: { type: "string", enum: ["month", "quarter", "year", "all"], description: "Period shape. Default year." },
          year: { type: "integer" }, month: { type: "integer", description: "1-12, anchors month/quarter" },
          from_date: { type: "string", description: "YYYY-MM-DD inclusive — overrides scope for exact ranges like today" },
          to_date: { type: "string", description: "YYYY-MM-DD exclusive" },
          developer_name: { type: "string", description: "Only deals of this developer (partial name ok)" },
          project_name: { type: "string", description: "Only deals of this project (partial name ok)" },
          limit: { type: "integer" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "top_developers",
      description: "Leaderboard of developers by VALIDATED sales value for a period.",
      parameters: {
        type: "object",
        properties: {
          scope: { type: "string", enum: ["month", "quarter", "year", "all"] },
          year: { type: "integer" }, month: { type: "integer" },
          from_date: { type: "string", description: "YYYY-MM-DD inclusive — overrides scope for exact ranges" },
          to_date: { type: "string", description: "YYYY-MM-DD exclusive" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "top_teams",
      description:
        "Team leaderboard — teams ranked by their members' VALIDATED sales ('strongest team', 'best team'). Defaults to all time.",
      parameters: {
        type: "object",
        properties: {
          scope: { type: "string", enum: ["month", "quarter", "year", "all"] },
          year: { type: "integer" }, month: { type: "integer" },
          from_date: { type: "string", description: "YYYY-MM-DD inclusive — overrides scope for exact ranges" },
          to_date: { type: "string", description: "YYYY-MM-DD exclusive" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "sales_summary",
      description: "Totals of sales (count + AED value) split by validation status, optionally within a date range.",
      parameters: {
        type: "object",
        properties: {
          from_date: { type: "string", description: "YYYY-MM-DD inclusive" },
          to_date: { type: "string", description: "YYYY-MM-DD exclusive" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "agent_sales",
      description:
        "One agent's profile, CONTACT DETAILS (phone, email) and sales record, looked up by (partial) name. ONE SPECIFIC PERSON only — NEVER a company or developer name. For 'which agents sold developer X's deals' use top_agents with developer_name instead.",
      parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "agent_recruits",
      description:
        "The RECRUITS of ONE SPECIFIC PERSON — accounts registered under them (downline/referrals), with each recruit's validated sales. Optionally limited to a period ('recruits of Michelle this month'). Requires the person's name; for company-wide recruit counts use new_accounts instead. Never pass a company name here.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          from_date: { type: "string", description: "YYYY-MM-DD inclusive — registrations from this date" },
          to_date: { type: "string", description: "YYYY-MM-DD exclusive" },
          days: { type: "integer", description: "Window back from today when from_date is omitted" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "agent_network",
      description:
        "The WHOLE NETWORK (downline, all levels) of ONE SPECIFIC PERSON: their recruits, their recruits' recruits and so on — how many per level, statuses, the VALIDATED sales of everyone in the network combined, each direct recruit's branch (branch size and branch sales), the top sellers with their level, the network's deals grouped by project, and the deals themselves (date, agent, level, project, developer, credited amount). Use for 'whole network', 'downline', 'all levels', 'everyone under X', 'how much did X's network/team sell all in all'. For DIRECT recruits only use agent_recruits. Requires the person's name.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          from_date: { type: "string", description: "YYYY-MM-DD inclusive — count only sales reserved from this date" },
          to_date: { type: "string", description: "YYYY-MM-DD exclusive" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "developer_overview",
      description:
        "Without a name: every developer with their project count. With a name: that developer's projects (counts, statuses, names) and validated sales.",
      parameters: { type: "object", properties: { name: { type: "string" } } },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "projects_stats",
      description: "Project counts filtered by developer name, status (pre_launch|launch|under_construction|completed) and/or city.",
      parameters: {
        type: "object",
        properties: {
          developer_name: { type: "string" }, status: { type: "string" }, city: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "platform_counts",
      description: "Site-wide KPIs: accounts, active developers, published projects/listings, clients, support tickets by status.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "recent_sales",
      description: "The most recent sales with agent, project, developer, price and validation status.",
      parameters: { type: "object", properties: { limit: { type: "integer" } } },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "website_traffic",
      description:
        "Website statistics from Google Analytics for a period: visitors (new vs RETURNING), sessions, page views, engagement, avg time on site, device split (mobile/desktop), live visitors right now, top pages, traffic sources (channels AND exact platforms like google/facebook), LEAD CLICKS (WhatsApp/phone/email/inquiry submissions), visitor COUNTRIES and CITIES. Defaults to the last 7 days.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "integer", description: "Window back from today (default 7)" },
          from_date: { type: "string", description: "YYYY-MM-DD" },
          to_date: { type: "string", description: "YYYY-MM-DD" },
          country: {
            type: "string",
            description: "Limit the CITY breakdown to one country (e.g. 'Philippines') — use for 'which cities in X' questions",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_keywords",
      description:
        "What people type into GOOGLE SEARCH to find the website (Search Console): top keywords with clicks, impressions and average position, plus the pages that appear most in Google. Defaults to the last 28 days.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "integer", description: "Window back from today (default 28)" },
          from_date: { type: "string", description: "YYYY-MM-DD" },
          to_date: { type: "string", description: "YYYY-MM-DD" },
          limit: { type: "integer", description: "Max keywords (default 15)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "upcoming_birthdays",
      description:
        "Upcoming birthdays of ACTIVE members/agents, soonest first — use for 'whose birthday is today / this week / this month / coming up'. Returns name, role and date with photo cards.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "integer", description: "Days ahead to look: 0 = today only, 7 = this week, 30 = this month-ish (default 30, max 366)" },
          limit: { type: "integer", description: "Max people listed (default 15)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "birthday_poster",
      description:
        "CREATE a personalized birthday poster image (the member's photo on FHI birthday artwork). Use whenever the admin asks to make/generate a birthday poster — for a named person, or for today's birthday celebrant(s) when no name is given. Four designs: navy (Navy Balloons), marble (Marble & Gold), midnight (Midnight Skyline, default), cream (Cream Minimal) — or 'all' to render every design for one person. The posters render in the chat under the reply.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "The member's name; omit to use today's birthday celebrant(s)" },
          design: { type: "string", enum: ["navy", "marble", "midnight", "cream", "all"], description: "Artwork choice; default midnight; 'all' shows every design" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "meeting_poster",
      description:
        "CREATE a meeting/event invite poster (navy & gold FHI design with speaker cards). Use when the admin asks to make a meeting poster. Requires title, date, time and venue — if any are missing, the tool says so: ask the admin ONE friendly question for the missing details, then call again. Speakers are optional; FHI member names get their profile photo automatically. The poster renders in the chat under the reply.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Event title, e.g. Monthly Sales Rally" },
          subtitle: { type: "string", description: "One supporting line (optional)" },
          tagline: { type: "string", description: "Small eyebrow text, default YOU'RE INVITED (optional)" },
          date: { type: "string", description: "Human date, e.g. Saturday, 12 September 2026" },
          time: { type: "string", description: "e.g. 7:00 PM GST" },
          venue: { type: "string", description: "Place or link, e.g. FHI Global Office, Business Bay" },
          speakers: {
            type: "array",
            description: "Up to 6 speakers (optional)",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                role: { type: "string", description: "e.g. CEO, Top Agent (optional)" },
                topic: { type: "string", description: "What they present (optional)" },
              },
            },
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "business_card",
      description:
        "Show the FHI business card(s) of one or more members — the branded share card each member customized on their profile, plus their public profile link to share with clients. Use for 'show/make the business card of X'.",
      parameters: {
        type: "object",
        properties: {
          names: {
            type: "array",
            items: { type: "string" },
            description: "Member name(s), up to 6 — typo-tolerant lookup",
          },
        },
        required: ["names"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "print_business_card",
      description:
        "PRINTABLE business card (FRONT and BACK) for one member — six designs: classic (Skyline Classic), platinum (Pearl Prestige), noir (Executive Noir), arc (Gilded Arc), split (Marina Split), gold (Gold Leaf), or 'all' to show every design. Use for 'business card design / front and back / printable card'. Defaults to the member's own saved design. (business_card is the DIGITAL share card + link; this one is the print card.)",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "The member's name — typo-tolerant" },
          design: { type: "string", enum: ["classic", "platinum", "noir", "arc", "split", "gold", "all"], description: "Design choice; omit for the member's saved design" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "send_email",
      description:
        "Send an email NOW, composed from this conversation — use ONLY when the admin explicitly asks to email something ('email me this report', 'send this to Michelle'). One recipient: 'me' (the admin asking), an email address, or one FHI member's name. Write the full message body yourself from what the admin asked to send (plain text, line breaks preserved).",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "'me', an email address, or one member's name (default: me)" },
          subject: { type: "string", description: "Email subject line" },
          message: { type: "string", description: "Full plain-text body composed from the conversation content the admin asked to send" },
          birthday_poster_uid: { type: "string", description: "Echo from a birthday_poster result's email_attachment_refs to embed that poster" },
          birthday_poster_design: { type: "string", description: "Goes with birthday_poster_uid" },
          meeting_poster_payload: { type: "string", description: "Echo from a meeting_poster result's email_attachment_ref to embed that poster" },
          business_card_uid: { type: "string", description: "Echo from a business_card result to embed that card image" },
        },
        required: ["subject", "message"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "congratulate_top_agents",
      description:
        "BULK congratulations for the top sellers of a period ('email the top agents this month to congratulate them'). Sends one branded congratulation email PER top agent, each with their personalized Top Seller certificate. send_directly=true delivers to each agent's own email; false/omitted delivers labeled previews to the asking admin's inbox instead. Accepts the same period parameters as top_agents, an optional limit (default top 3) and an optional custom_note added to each email.",
      parameters: {
        type: "object",
        properties: {
          scope: { type: "string", enum: ["month", "quarter", "year", "all"] },
          year: { type: "integer" }, month: { type: "integer", description: "1-12" },
          from_date: { type: "string", description: "YYYY-MM-DD inclusive" },
          to_date: { type: "string", description: "YYYY-MM-DD exclusive" },
          limit: { type: "integer", description: "How many top agents (default 3, max 8)" },
          custom_note: { type: "string", description: "Optional personal line added to each email" },
          send_directly: { type: "boolean", description: "true ONLY when the admin asked to email the agents themselves ('email this to them'); false/omitted = previews to the admin" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "activity_feed",
      description:
        "Chronological WHAT-HAPPENED feed of platform activity: every sale submitted (who, project, amount, status), account created (with recruiter), listing added, project added and event registration in the window. Use for 'how's the update today', 'what's new', 'what happened yesterday', 'any updates'. Defaults to since yesterday.",
      parameters: {
        type: "object",
        properties: {
          from_date: { type: "string", description: "YYYY-MM-DD inclusive (default: yesterday)" },
          to_date: { type: "string", description: "YYYY-MM-DD exclusive" },
          days: { type: "integer", description: "Alternative: days back from today (default 1)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "sales_pipeline",
      description:
        "PIPELINE HEALTH as of now: sales WAITING FOR VALIDATION (oldest first, how many days, how many past a threshold), REJECTED sales, validation turnaround, COMMISSION STATUS per validated sale (status only — no amounts), shared PARTNER deals, and QUIET AGENTS — active selling accounts with no validated sale this quarter (or month/year/custom dates), with their last sale date. Use for 'anything waiting for validation', 'stuck sales', 'pending commissions', 'who hasn't sold anything this quarter', 'inactive agents', 'how fast do we validate'. Not for totals by period — that is sales_summary.",
      parameters: {
        type: "object",
        properties: {
          stale_days: { type: "integer", description: "A pending sale older than this counts as stale (default 7)" },
          quiet_scope: { type: "string", enum: ["month", "quarter", "year"], description: "Period for quiet agents (default quarter = the current quarter)" },
          quiet_from_date: { type: "string", description: "YYYY-MM-DD — custom period start for quiet agents" },
          quiet_to_date: { type: "string", description: "YYYY-MM-DD exclusive" },
          include_quiet_agents: { type: "boolean", description: "Default true; false skips that section" },
          limit: { type: "integer", description: "Rows per list (default 20, max 60)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "support_tickets",
      description: "SUPPORT TICKETS: what is still open or in progress (oldest first, days open, unassigned), by module and type, with reporter, assignee and comment count; resolved/closed on request. Use for 'any open tickets', 'oldest unresolved ticket', 'what are people reporting', 'tickets nobody picked up'.",
      parameters: { type: "object", properties: {"status":{"type":"string","enum":["open","in_progress","resolved","closed","all"],"description":"Default open = open + in_progress"},"limit":{"type":"integer","description":"Default 20, max 60"}} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "company_purchases",
      description: "COMPANY PURCHASES / EXPENSES (the tax ledger under Purchases): totals by category, tax entity, month and tax type, plus the invoices, for a year or a date range. Use for 'how much did we spend this month/year', 'expenses by category', 'purchases of entity X', 'VAT purchases'. Amounts as recorded (gross taxable and total actual).",
      parameters: { type: "object", properties: {"from_date":{"type":"string","description":"YYYY-MM-DD on tax_month, inclusive"},"to_date":{"type":"string","description":"YYYY-MM-DD exclusive"},"year":{"type":"integer","description":"Whole year when no dates given (default current year)"},"category":{"type":"string","description":"Partial category name"},"entity":{"type":"string","description":"Partial tax entity name"},"limit":{"type":"integer"}} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "agent_websites",
      description: "AGENT WEBSITES (Website Builder): how many agents have a website, which are live vs draft, each site's agent, title, address, contact and last update. Use for 'who has a website', 'is X's website live', 'how many agent websites'.",
      parameters: { type: "object", properties: {"agent_name":{"type":"string","description":"One agent (partial name ok)"},"published_only":{"type":"boolean"},"limit":{"type":"integer"}} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "listings_overview",
      description: "AGENT LISTINGS (sale and rent units agents list themselves — NOT developer projects): counts by status/kind/agent/project, and the listings with price, unit type, project, area, agent and public link. Filters: agent, sale|rent, status, project, budget, free text (area, title). Use for 'how many listings', 'who has the most listings', 'rent listings in Marina', 'X's listings', 'listings under 2M'.",
      parameters: { type: "object", properties: {"agent_name":{"type":"string"},"kind":{"type":"string","enum":["sale","rent"]},"status":{"type":"string","enum":["published","draft","archived","all"],"description":"Default published"},"project_name":{"type":"string"},"min_price":{"type":"number"},"max_price":{"type":"number"},"search":{"type":"string","description":"Matches title, description, project or community"},"limit":{"type":"integer"}} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "clients_overview",
      description: "CLIENTS (buyers recorded on sales): total, by country/city/agent, and the client list with contact details, who recorded them, their deals and projects. Filters: agent, country, search by name/email/phone. Use for 'how many clients', 'clients of Michelle', 'clients from the Philippines', 'find client Juan'.",
      parameters: { type: "object", properties: {"agent_name":{"type":"string"},"country":{"type":"string"},"search":{"type":"string"},"limit":{"type":"integer"}} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "agent_reviews",
      description:
        "AGENT REVIEWS / RATINGS from clients (the feedback form): which agent has the MOST reviews, the BEST RATED agents (minimum reviews rule), average rating and the seven detail scores (communication, market knowledge, understanding, professionalism, negotiation, process, experience), 'would recommend' answers, one agent's reviews in full with what clients wrote, and reviews WAITING FOR APPROVAL. Use for 'who has the most reviews', 'best rated agent', 'Michelle's rating', 'what do clients say about X', 'any reviews to approve'.",
      parameters: {
        type: "object",
        properties: {
          agent_name: { type: "string", description: "One agent (partial name ok)" },
          status: { type: "string", enum: ["all", "approved", "new", "hidden"], description: "Default all; new = waiting for approval" },
          min_reviews: { type: "integer", description: "Minimum reviews to appear in best_rated (default 3)" },
          limit: { type: "integer" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "activity_log",
      description: "ACTIVITY & SECURITY LOG (audit trail): who did what and when — project/developer/listing edits, account activations and role changes, team changes, emails sent, LOGINS and FAILED LOGINS, sales and inquiry actions. Filter by period (default last 7 days), category, event, the person who acted, or a search word (e.g. a project name). Use for 'who changed Azizi Venice', 'what did Juliecor do today', 'any failed logins', 'who activated X', 'who logged in this week'. NOT for business totals — those are the other tools.",
      parameters: { type: "object", properties: {"days":{"type":"integer","description":"Last N days (default 7)"},"from_date":{"type":"string"},"to_date":{"type":"string"},"category":{"type":"string","enum":["projects","mailer","auth","user_management","teams","security","developers","listings","sales","inquiry","events","finance","website","owner_documents","feedback","contact","support"]},"event":{"type":"string","description":"e.g. login, login_failed, updated, created, deleted, activated, role_granted, email_sent"},"actor_name":{"type":"string","description":"Who acted (partial name)"},"search":{"type":"string","description":"Word in the subject or description, e.g. a project or person name"},"limit":{"type":"integer"}} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "member_lookup",
      description: "WHO IS THIS — one member's full profile in one answer, found by NAME, EMAIL, PHONE NUMBER or USERNAME: role, status, contacts, nationality, license, joined date, last login, who invited them, recruits, team(s), website, listings, reviews, validated and pending sales with last sale date, and the dashboard link. Use for 'who is 0505725463', 'look up juan@gmail.com', 'tell me about Agnes White', 'when did X join and who invited them'. For a person's SALES RECORD alone agent_sales still works; for their downline use agent_network.",
      parameters: { type: "object", properties: {"query":{"type":"string","description":"Name, email, phone number or username"},"limit":{"type":"integer","description":"Max matches (default 5)"}}, required: ["query"] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "owner_documents",
      description: "OWNER DOCUMENT REQUESTS — the title-deed / NOC collection links agents send to property owners (Owner Documents): pending (link sent, not yet submitted, incl. expired links), submitted (waiting review), cancelled; per agent; each with owner, property, deed number, NOC validity, files uploaded. Use for 'any pending owner documents', 'did the owner of X submit', 'owner documents of agent Y'.",
      parameters: { type: "object", properties: {"status":{"type":"string","enum":["all","pending","submitted","cancelled"]},"agent_name":{"type":"string"},"limit":{"type":"integer"}} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "teams_detail",
      description: "TEAMS IN DETAIL: every active team with its leader(s), member count, roster (each member's account role, team role, joined date, validated sales) and the team's validated sales — plus selling accounts that belong to NO team. Use for 'who is in team X', 'who leads X', 'agents without a team', 'how many teams', 'team roster'. For the ranked leaderboard alone top_teams still works.",
      parameters: { type: "object", properties: {"team_name":{"type":"string","description":"One team (partial name); omit for all"},"include_members":{"type":"boolean","description":"Default true (rosters); false for summary only"},"limit":{"type":"integer","description":"Roster rows per team"}} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "event_engagement",
      description: "HOW EACH EVENT DID: registrations, certificates sent and DOWNLOADED (unique downloaders, download rate), page views, QR scans, views-to-registration rate, who invited most registrants, whether an agent's event is shown on /events. Use for 'how did the Career Summit go', 'how many downloaded their certificate', 'event stats', 'which event had most registrations'. Registrant names are event_attendees.",
      parameters: { type: "object", properties: {"event_title":{"type":"string","description":"Partial title; omit for all events"},"limit":{"type":"integer"}} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "news_overview",
      description: "WEBSITE NEWS (the /news feed and homepage carousel): latest articles, MOST READ articles with view counts, how many published this week/month, by category, with links. Use for 'what's the latest news', 'most read article', 'top news this week', 'how many news articles do we have'. Not FHI sales news — these are market articles shown on the site.",
      parameters: { type: "object", properties: {"limit":{"type":"integer","description":"Articles per list (default 8)"},"search":{"type":"string","description":"Keyword in the articles"},"category":{"type":"string","description":"Partial category name"}} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "data_health",
      description: "DATA HEALTH / what's MISSING on our own records: published projects without a price, payment plan, photo, handover date, map pin, Trakheesi permit number (Dubai) or a permit QR with no verify link, unit table, area or description (with the most incomplete projects and which developers' projects lack payment plans); listings without price/photo/unit type, listings or projects that look like test data (the site already hides listings with a test-like title or project name), listings on a project that is no longer public, and listings posted twice under the same title (with which copy to keep — the oldest — and which to remove); clients sharing one email or missing contacts. Use for 'what's missing on our projects', 'which projects have no payment plan', 'data quality', 'listings without prices', 'duplicate listings', 'test listings', 'duplicate client emails'.",
      parameters: { type: "object", properties: {"area":{"type":"string","enum":["all","projects","listings","clients"],"description":"Default all"},"limit":{"type":"integer"}} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "find_projects",
      description:
        "SHORTLIST projects by what a buyer wants — area/community (JVC, Dubai Marina, Business Bay…), developer, number of bedrooms (0 = studio), property type (apartment, villa, townhouse), budget (min/max AED), handover year, off-plan or ready. Returns the matching published projects sorted (cheapest first when a budget or bedroom count is given) with price, handover, unit mix, sizes, payment plan and the page link, plus counts by developer/area/handover year. Use for 'cheapest 1-bedroom in JVC', 'Azizi projects handing over 2027', 'villas under AED 3M', 'what do we have in Dubai South', 'ready apartments'. For everything about ONE named project use project_details instead.",
      parameters: {
        type: "object",
        properties: {
          area: { type: "string", description: "Community / area / city, partial ok (JVC, Marina, Downtown, Dubai South, Abu Dhabi)" },
          developer_name: { type: "string", description: "Partial developer name" },
          bedrooms: { type: "integer", description: "Exact bedroom count; 0 = studio. Prices then refer to the cheapest unit of that size" },
          property_type: { type: "string", description: "apartment | villa | townhouse | penthouse | retail | office | plot" },
          status: { type: "string", enum: ["pre_launch", "launch", "under_construction", "completed"] },
          off_plan_only: { type: "boolean", description: "Anything not completed" },
          ready_only: { type: "boolean", description: "Completed projects only" },
          min_price: { type: "number", description: "AED" },
          max_price: { type: "number", description: "AED — 'under 1M' = 1000000" },
          handover_year: { type: "integer", description: "Handover in exactly this year" },
          handover_by_year: { type: "integer", description: "Handover in or before this year" },
          name_contains: { type: "string", description: "Part of the project name" },
          sort: { type: "string", enum: ["price_asc", "price_desc", "handover", "name"] },
          limit: { type: "integer", description: "Default 12, max 40" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "project_details",
      description:
        "EVERYTHING about ONE project by name: price range, every unit type with bedrooms/size/price, handover and dates, the payment plan (milestones + fees + the text as written), down payment, amenities, what's nearby, highlights, developer contacts, permit number, ownership, ROI/yield, the public page link and FHI's validated sales on it. Use for 'tell me about Azizi Venice', 'payment plan of Samana Greenfield', 'what units does Rukan Tower have', 'handover of X'.",
      parameters: { type: "object", properties: { name: { type: "string", description: "Project name, partial ok" } }, required: ["name"] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "leads_overview",
      description:
        "LEADS — every way a prospect reached the company in a period: project INQUIRIES (Inquire forms on project, landing and developer pages — each lead says which page, see by_page), CONTACT messages (/contact), BUYERS LINK and Sellers Link BRIEFS (each agent's own link, graded Priority/Qualified/Nurture/Information) and REPLIES in the company inbox. Returns totals per source with previous-period comparison, breakdowns (which project/developer, which agent's link, grade, budget, goal, readiness) and the newest entries with phone/WhatsApp/email for follow-up. Use for 'how many leads this week', 'any new inquiries', 'unanswered messages', 'which project gets the most inquiries', 'Buyers Link leads of Michelle', 'priority buyers this month'. Default: last 30 days, all sources.",
      parameters: {
        type: "object",
        properties: {
          from_date: { type: "string", description: "YYYY-MM-DD inclusive" },
          to_date: { type: "string", description: "YYYY-MM-DD exclusive" },
          days: { type: "integer", description: "Alternative to from_date: the last N days (default 30)" },
          source: { type: "string", enum: ["all", "inquiries", "contact", "buyers_link", "inbox"], description: "One source only, or all (default)" },
          agent_name: { type: "string", description: "Buyers Link briefs that came through THIS agent's link (partial name ok)" },
          project_name: { type: "string", description: "Inquiries about this project only (partial name ok)" },
          developer_name: { type: "string", description: "Inquiries about this developer's projects only" },
          only_unanswered: { type: "boolean", description: "Only what still waits for a reply: inquiries marked new, unread contact messages, unread inbox replies" },
          limit: { type: "integer", description: "Newest entries listed per source (default 15, max 60)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "events_overview",
      description: "Recent and upcoming FHI events with dates, venues and registration counts. For the registrant NAMES use event_attendees.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "new_accounts",
      description:
        "Accounts REGISTERED in a period (new users/signups) with role/status breakdown, how many were RECRUITED (registered under someone) and the top recruiters. Use for ALL company-wide or time-based signup/recruit questions ('new recruits this month'). Defaults to the last 7 days; accepts from_date/to_date (YYYY-MM-DD) or days.",
      parameters: {
        type: "object",
        properties: {
          from_date: { type: "string", description: "YYYY-MM-DD inclusive" },
          to_date: { type: "string", description: "YYYY-MM-DD exclusive" },
          days: { type: "integer", description: "Window size back from today when from_date is omitted" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "event_attendees",
      description:
        "The registrant list of one event — names, emails, WhatsApp numbers. Omit event_title for the latest event.",
      parameters: { type: "object", properties: { event_title: { type: "string" } } },
    },
  },
]

/** Runs a tool. Returns the model-facing JSON and the UI cards separately —
 *  image URLs never enter the model context (wasted tokens, and the model
 *  must never be able to alter them). */
export type FhiChatTrendPoint = { date: string; visitors: number }
export type FhiChatShareRow = { label: string; value: number; display?: string; iso?: string | null; icon?: string | null }
/** Charts the UI renders under an answer — attached by tools as `_charts`,
 *  stripped before the model sees the JSON (same contract as cards). */
export type FhiChatBarPoint = { label: string; value: number; display?: string }
export type FhiChatChart =
  | { kind: "trend"; title: string; points: FhiChatTrendPoint[] }
  | { kind: "shares"; title: string; rows: FhiChatShareRow[] }
  | { kind: "bars"; title: string; points: FhiChatBarPoint[] }
  | { kind: "pie"; title: string; rows: FhiChatShareRow[] }

export async function runFhiChatTool(
  name: string,
  args: Record<string, unknown>,
  sender?: FhiChatSender,
): Promise<{
  forModel: string
  cards: FhiChatCard[]
  names: string[]
  charts: FhiChatChart[]
  printCards: FhiChatPrintCard[]
  stats: FhiChatStat[]
}> {
  const admin = createAdminSupabase()
  try {
    let result: Record<string, unknown>
    switch (name) {
      case "top_agents": result = await topAgents(admin, args); break
      case "top_developers": result = await topDevelopers(admin, args); break
      case "top_teams": result = await topTeams(admin, args); break
      case "sales_summary": result = await salesSummary(admin, args); break
      case "agent_sales": result = await agentSales(admin, args); break
      case "agent_recruits": result = await agentRecruits(admin, args); break
      case "agent_network": result = await agentNetwork(admin, args); break
      case "developer_overview": result = await developerOverview(admin, args); break
      case "projects_stats": result = await projectsStats(admin, args); break
      case "platform_counts": result = await platformCounts(admin); break
      case "recent_sales": result = await recentSales(admin, args); break
      case "events_overview": result = await eventsOverview(admin); break
      case "leads_overview": result = await leadsOverview(admin, args as LeadsArgs); break
      case "find_projects": result = await findProjects(admin, args as FindProjectsArgs); break
      case "sales_pipeline": result = await salesPipeline(admin, args as PipelineArgs); break
      case "support_tickets": result = await supportTickets(admin, args); break
      case "company_purchases": result = await companyPurchases(admin, args); break
      case "agent_websites": result = await agentWebsites(admin, args); break
      case "listings_overview": result = await listingsOverview(admin, args as Parameters<typeof listingsOverview>[1]); break
      case "clients_overview": result = await clientsOverview(admin, args); break
      case "agent_reviews": result = await agentReviews(admin, args); break
      case "news_overview": result = await newsOverview(admin, args); break
      case "data_health": result = await dataHealth(admin, args); break
      case "activity_log": result = await activityLog(admin, args); break
      case "member_lookup": result = await memberLookup(admin, args); break
      case "owner_documents": result = await ownerDocuments(admin, args); break
      case "teams_detail": result = await teamsDetail(admin, args); break
      case "event_engagement": result = await eventEngagement(admin, args); break
      case "project_details": result = await projectDetails(admin, args); break
      case "event_attendees": result = await eventAttendees(admin, args); break
      case "new_accounts": result = await newAccounts(admin, args); break
      case "website_traffic": result = await websiteTraffic(args); break
      case "search_keywords": result = await searchKeywords(args); break
      case "activity_feed": result = await activityFeed(admin, args); break
      case "upcoming_birthdays": result = await upcomingBirthdays(admin, args); break
      case "birthday_poster": result = await birthdayPoster(admin, args); break
      case "meeting_poster": result = await meetingPoster(admin, args as Parameters<typeof meetingPoster>[1]); break
      case "business_card": result = await businessCard(admin, args); break
      case "print_business_card": result = await printBusinessCard(admin, args); break
      case "send_email": result = await sendChatEmail(admin, args, sender); break
      case "congratulate_top_agents": result = await congratulateTopAgents(admin, args, sender); break
      default: return { forModel: JSON.stringify({ error: `Unknown tool ${name}` }), cards: [], names: [], charts: [], printCards: [], stats: [] }
    }
    const { _cards, _names, _charts, _printCards, _stats, ...rest } = result as {
      _cards?: FhiChatCard[]; _names?: string[]; _charts?: FhiChatChart[]; _printCards?: FhiChatPrintCard[]; _stats?: FhiChatStat[]
    } & Record<string, unknown>
    return {
      forModel: JSON.stringify(rest),
      cards: Array.isArray(_cards) ? _cards : [],
      names: Array.isArray(_names) ? _names : [],
      charts: Array.isArray(_charts) ? _charts : [],
      printCards: Array.isArray(_printCards) ? _printCards : [],
      stats: Array.isArray(_stats) ? _stats : [],
    }
  } catch (e) {
    return {
      forModel: JSON.stringify({ error: e instanceof Error ? e.message : "Query failed" }),
      cards: [], names: [], charts: [], printCards: [], stats: [],
    }
  }
}
