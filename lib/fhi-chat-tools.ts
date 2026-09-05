import "server-only"

import { createAdminSupabase } from "@/lib/admin-supabase"
import { gaConfigured, gaRunRealtime, gaRunReport, gscQuery } from "@/lib/ga-data"
import { DEFAULT_POSTER_DESIGN, posterDesignIds, posterDesignLabel } from "@/lib/birthday-poster"
import { SITE_URL } from "@/lib/seo"
import { DESIGNS as CARD_DESIGNS, isDesignId as isCardDesignId } from "@/features/business-card/card-render"
import { sendAdminDirectEmail, sendCongratsEmail } from "@/lib/mailer"
import { renderTopSellerCertificatePng } from "@/lib/congrats-poster"

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
}

const AED = (n: number) => `AED ${Math.round(n).toLocaleString("en-AE")}`

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
async function fetchAllSales(admin: Admin): Promise<SaleRow[]> {
  const out: SaleRow[] = []
  for (let page = 0; page < 10; page++) {
    const { data, error } = await admin
      .from("sales_reports")
      .select("id, agent_id, developer_id, project_id, contract_price, validation_status, reservation_date, created_at")
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
  const agentIds = [...new Set(sales.map((s) => s.agent_id))]
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
    const t = byAgent.get(s.agent_id) ?? { deals: 0, value: 0 }
    t.deals += 1
    t.value += Number(s.contract_price ?? 0)
    byAgent.set(s.agent_id, t)
  }
  const names = await nameMaps(admin, sales)
  const ranked = [...byAgent.entries()]
    .map(([id, t]) => ({ id, deals: t.deals, value: t.value }))
    .sort((a, b) => b.value - a.value || b.deals - a.deals)
    .slice(0, Math.min(args.limit ?? 10, 25))
  return {
    period: { scope, from, to },
    note: "validated sales only",
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
    admin.from("teams").select("id, name, logo_url, is_active").eq("is_active", true).limit(500),
    admin.from("team_memberships").select("user_id, team_id").eq("is_active", true).limit(5000),
  ])
  if (teamErr) throw new Error(teamErr.message)
  if (memErr) throw new Error(memErr.message)

  const teamsOf = new Map<string, string[]>()
  const memberCount = new Map<string, number>()
  for (const m of memberships ?? []) {
    const uid = String(m.user_id)
    const tid = String(m.team_id)
    teamsOf.set(uid, [...(teamsOf.get(uid) ?? []), tid])
    memberCount.set(tid, (memberCount.get(tid) ?? 0) + 1)
  }

  const sales = (await fetchAllSales(admin)).filter(
    (s) => s.validation_status === "validated" && inRange(s, from, to),
  )
  const byTeam = new Map<string, { deals: number; value: number }>()
  for (const s of sales) {
    for (const tid of teamsOf.get(String(s.agent_id)) ?? []) {
      const t = byTeam.get(tid) ?? { deals: 0, value: 0 }
      t.deals += 1
      t.value += Number(s.contract_price ?? 0)
      byTeam.set(tid, t)
    }
  }
  const teamById = new Map((teams ?? []).map((t) => [String(t.id), t]))
  const ranked = [...byTeam.entries()]
    .filter(([id]) => teamById.has(id))
    .map(([id, t]) => ({ id, ...t }))
    .sort((a, b) => b.value - a.value || b.deals - a.deals)
    .slice(0, 10)
  return {
    period: { scope, from, to },
    note: "teams ranked by their members' validated sales",
    teams_total: (teams ?? []).length,
    leaders: ranked.map((t, i) => ({
      rank: i + 1,
      team: teamById.get(t.id)?.name ?? t.id,
      members: memberCount.get(t.id) ?? 0,
      deals: t.deals,
      total: AED(t.value),
    })),
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
  return {
    period: { from: from ?? "beginning", to: to ?? "no upper bound" },
    validated: { count: cur.validated.count, total: cur.validated.total },
    pending: { count: cur.pending.count, total: cur.pending.total },
    rejected: { count: cur.rejected.count, total: cur.rejected.total },
    all_statuses_count: sales.length,
    ...comparison,
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
  const sales = (await fetchAllSales(admin)).filter((s) => s.agent_id === String(agent.id))
  const names = await nameMaps(admin, sales)
  const validated = sales.filter((s) => s.validation_status === "validated")
  const totalValidated = validated.reduce((a, s) => a + Number(s.contract_price ?? 0), 0)
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
    validated: { count: validated.length, total: AED(totalValidated) },
    pending_count: sales.filter((s) => (s.validation_status ?? "pending") === "pending").length,
    sales: list.map((s) => ({
      date: businessDate(s),
      project: names.proj.get(s.project_id)?.name ?? "?",
      developer: names.dev.get(String(s.developer_id))?.name ?? "?",
      price: AED(Number(s.contract_price ?? 0)),
      status: s.validation_status,
    })),
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
    const t = validatedByAgent.get(s.agent_id) ?? { deals: 0, value: 0 }
    t.deals += 1
    t.value += Number(s.contract_price ?? 0)
    validatedByAgent.set(s.agent_id, t)
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
    .select("id, title, event_date, venue, status, registration_open, image_url")
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
      venue: e.venue,
      status: e.status,
      registration_open: e.registration_open,
      registrations: regCount.get(String(e.id)) ?? 0,
    })),
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
  args: { to?: string; subject?: string; message?: string },
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

  await sendAdminDirectEmail({
    to,
    subject,
    message,
    senderName: sender?.name?.trim() || "The FHI Global Team",
  })
  return {
    sent: true,
    to,
    recipient: toLabel,
    subject,
    note: "Delivered from info@fhiglobal.ae in the FHI brand shell, signed with the admin's name. Confirm to the admin what was sent and to whom.",
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
    const t = byAgent.get(s.agent_id) ?? { deals: 0, value: 0 }
    t.deals += 1
    t.value += Number(s.contract_price ?? 0)
    byAgent.set(s.agent_id, t)
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
export type FhiChatChart =
  | { kind: "trend"; title: string; points: FhiChatTrendPoint[] }
  | { kind: "shares"; title: string; rows: FhiChatShareRow[] }

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
      case "developer_overview": result = await developerOverview(admin, args); break
      case "projects_stats": result = await projectsStats(admin, args); break
      case "platform_counts": result = await platformCounts(admin); break
      case "recent_sales": result = await recentSales(admin, args); break
      case "events_overview": result = await eventsOverview(admin); break
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
      default: return { forModel: JSON.stringify({ error: `Unknown tool ${name}` }), cards: [], names: [], charts: [], printCards: [] }
    }
    const { _cards, _names, _charts, _printCards, ...rest } = result as {
      _cards?: FhiChatCard[]; _names?: string[]; _charts?: FhiChatChart[]; _printCards?: FhiChatPrintCard[]
    } & Record<string, unknown>
    return {
      forModel: JSON.stringify(rest),
      cards: Array.isArray(_cards) ? _cards : [],
      names: Array.isArray(_names) ? _names : [],
      charts: Array.isArray(_charts) ? _charts : [],
      printCards: Array.isArray(_printCards) ? _printCards : [],
    }
  } catch (e) {
    return {
      forModel: JSON.stringify({ error: e instanceof Error ? e.message : "Query failed" }),
      cards: [], names: [], charts: [], printCards: [],
    }
  }
}
