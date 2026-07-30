import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { createAdminSupabase } from "@/lib/admin-supabase"
import type { TeamSalesMember, TeamSalesMonth, TeamSalesOverview } from "@/lib/team-sales"

/**
 * Team Sales overview for team leaders / unit managers: their team's
 * production for a chosen year (or single month), a per-member leaderboard,
 * the caller's own numbers, and a monthly trend for the year.
 *
 * Everything is scoped server-side to the CALLER's active team — no query
 * parameter can point this at somebody else's team. Aggregates run in SQL
 * (migration 018) so totals stay exact past PostgREST's row cap.
 */

export const runtime = "nodejs"

const ROLES_ALLOWED = ["team_leader", "unit_manager", "admin", "super_admin"] as const
/** Rows listed on the leaderboard; totals are exact regardless. */
const MEMBER_LIMIT = 200
/** Fallback chunk size for environments where migration 018 isn't applied. */
const IN_CHUNK = 100
const FALLBACK_ROW_CAP = 1000

type Admin = ReturnType<typeof createAdminSupabase>

type Totals = { deals: number; value: number }

function periodBounds(year: number, month: number | null): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, "0")
  if (month) {
    const nextY = month === 12 ? year + 1 : year
    const nextM = month === 12 ? 1 : month + 1
    return { from: `${year}-${pad(month)}-01`, to: `${nextY}-${pad(nextM)}-01` }
  }
  return { from: `${year}-01-01`, to: `${year + 1}-01-01` }
}

type FallbackRow = {
  agent_id: string | null
  contract_price: number | null
  reservation_date: string | null
  created_at: string | null
}

/**
 * Pre-018 fallback: one chunked read of raw rows, newest-first so the cap is
 * at least deterministic, then filtered/bucketed in JS. Totals CAN undercount
 * past FALLBACK_ROW_CAP per chunk — the RPCs exist precisely to avoid that,
 * so the miss is logged loudly instead of silently shipping wrong numbers.
 */
async function fallbackRows(admin: Admin, ids: string[]): Promise<FallbackRow[]> {
  console.warn("[team-sales] migration 018 RPCs missing — using capped fallback aggregation; run `npm run db:migrate` for exact totals")
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) chunks.push(ids.slice(i, i + IN_CHUNK))
  const results = await Promise.all(
    chunks.map((chunk) =>
      admin
        .from("sales_reports")
        .select("agent_id, contract_price, reservation_date, created_at")
        .in("agent_id", chunk)
        .order("created_at", { ascending: false })
        .limit(FALLBACK_ROW_CAP),
    ),
  )
  return results.flatMap((res) => (res.data ?? []) as FallbackRow[])
}

const bizDate = (r: FallbackRow) => (r.reservation_date ?? r.created_at ?? "").slice(0, 10)

/** Per-agent totals within [from, to) — RPC first, chunked select fallback. */
async function totalsByAgent(
  admin: Admin,
  ids: string[],
  from: string,
  to: string,
): Promise<Map<string, Totals>> {
  const out = new Map<string, Totals>()
  if (ids.length === 0) return out

  const { data, error } = await admin.rpc("sales_totals_by_agents_period", {
    p_agent_ids: ids,
    p_from: from,
    p_to: to,
  })
  if (!error && Array.isArray(data)) {
    for (const r of data as Array<{ agent_id: string; deal_count: number | string; total_value: number | string }>) {
      out.set(r.agent_id, { deals: Number(r.deal_count ?? 0), value: Number(r.total_value ?? 0) })
    }
    return out
  }

  for (const r of await fallbackRows(admin, ids)) {
    if (!r.agent_id) continue
    const d = bizDate(r)
    if (!d || d < from || d >= to) continue
    const prev = out.get(r.agent_id) ?? { deals: 0, value: 0 }
    out.set(r.agent_id, { deals: prev.deals + 1, value: prev.value + Number(r.contract_price ?? 0) })
  }
  return out
}

/** Month(1-12) → totals for the given agents across one calendar year. */
async function monthlySeries(admin: Admin, ids: string[], year: number): Promise<Map<number, Totals>> {
  const out = new Map<number, Totals>()
  if (ids.length === 0) return out

  const { data, error } = await admin.rpc("sales_monthly_series", {
    p_agent_ids: ids,
    p_from: `${year}-01-01`,
    p_to: `${year + 1}-01-01`,
  })
  if (!error && Array.isArray(data)) {
    for (const r of data as Array<{ month_start: string; deal_count: number | string; total_value: number | string }>) {
      const m = Number(String(r.month_start).slice(5, 7))
      if (m >= 1 && m <= 12) out.set(m, { deals: Number(r.deal_count ?? 0), value: Number(r.total_value ?? 0) })
    }
    return out
  }

  // Fallback: bucket ONE raw fetch by month — no per-month RPC retries.
  const y = String(year)
  for (const r of await fallbackRows(admin, ids)) {
    const d = bizDate(r)
    if (!d.startsWith(y)) continue
    const m = Number(d.slice(5, 7))
    if (m < 1 || m > 12) continue
    const prev = out.get(m) ?? { deals: 0, value: 0 }
    out.set(m, { deals: prev.deals + 1, value: prev.value + Number(r.contract_price ?? 0) })
  }
  return out
}

export async function GET(req: NextRequest) {
  const guard = await requireRole([...ROLES_ALLOWED])
  if (!guard.ok) return guard.response

  const callerId = guard.context.userId
  const admin = createAdminSupabase()

  const now = new Date()
  const yearParam = Number(req.nextUrl.searchParams.get("year"))
  const monthParam = Number(req.nextUrl.searchParams.get("month"))
  const year = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100 ? yearParam : now.getFullYear()
  const month = Number.isInteger(monthParam) && monthParam >= 1 && monthParam <= 12 ? monthParam : null
  const { from, to } = periodBounds(year, month)

  // ── Caller's active team + its active members (caller included) ─────────
  // order+limit(1) instead of maybeSingle(): the on_team_transfer trigger only
  // fires on INSERT, so duplicate active memberships are reachable (races,
  // manual fixes) — maybeSingle() would error and silently render "no team".
  const { data: membershipRows, error: membershipError } = await admin
    .from("team_memberships")
    .select("team_id, joined_at, teams(id, name)")
    .eq("user_id", callerId)
    .eq("is_active", true)
    .order("joined_at", { ascending: false })
    .limit(1)

  if (membershipError) {
    return NextResponse.json({ error: "Couldn't resolve your team." }, { status: 500 })
  }

  const team = (membershipRows?.[0] ?? null) as unknown as
    | { team_id: string; teams: { id: string; name: string | null } | null }
    | null

  type MemberRow = {
    user_id: string
    profiles: { id: string; fullname: string | null; role: string | null; profile_url: string | null } | null
  }
  type ProfileRow = { id: string; fullname: string | null; role: string | null; profile_url: string | null }

  let scope: "team" | "recruits" | "none" = "none"
  let memberRows: MemberRow[] = []
  let allMemberIds: string[] = []

  if (team?.team_id) {
    scope = "team"
    // Leaderboard rows are capped for payload size, but the id list feeding
    // the SQL aggregates is not — totals stay exact for oversized teams.
    const [rowsRes, idsRes] = await Promise.all([
      admin
        .from("team_memberships")
        .select("user_id, profiles!inner(id, fullname, role, profile_url)")
        .eq("team_id", team.team_id)
        .eq("is_active", true)
        .not("profiles.is_deleted", "is", true)
        .order("joined_at", { ascending: true })
        .limit(MEMBER_LIMIT),
      admin
        .from("team_memberships")
        .select("user_id")
        .eq("team_id", team.team_id)
        .eq("is_active", true)
        .limit(2000),
    ])
    memberRows = (rowsRes.data ?? []) as unknown as MemberRow[]
    allMemberIds = ((idsRes.data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)
  } else {
    // No formal team — fall back to the caller's recruit network (the people
    // who registered through their invite link), which is how this org
    // actually attributes agents to a leader. The caller joins the list so
    // they rank alongside their recruits.
    const [recruitsRes, idsRes, selfRes] = await Promise.all([
      admin
        .from("profiles")
        .select("id, fullname, role, profile_url")
        .eq("metadata->>invited_by", callerId)
        .not("is_deleted", "is", true)
        .order("joined_at", { ascending: false })
        .limit(MEMBER_LIMIT),
      admin
        .from("profiles")
        .select("id")
        .eq("metadata->>invited_by", callerId)
        .not("is_deleted", "is", true)
        .limit(2000),
      admin
        .from("profiles")
        .select("id, fullname, role, profile_url")
        .eq("id", callerId)
        .maybeSingle(),
    ])
    const recruits = (recruitsRes.data ?? []) as ProfileRow[]
    if (recruits.length > 0) {
      scope = "recruits"
      const self = (selfRes.data ?? null) as ProfileRow | null
      memberRows = [
        ...(self ? [{ user_id: self.id, profiles: self }] : []),
        ...recruits.map((p) => ({ user_id: p.id, profiles: p })),
      ]
      allMemberIds = ((idsRes.data ?? []) as Array<{ id: string }>).map((r) => r.id)
    }
  }

  // De-dupe and make sure the caller is present even without a membership row,
  // so "My sales" always has a subject.
  const memberIds = Array.from(new Set([...allMemberIds, ...memberRows.map((m) => m.user_id), callerId]))

  const [periodTotals, teamSeries, mySeries] = await Promise.all([
    totalsByAgent(admin, memberIds, from, to),
    monthlySeries(admin, memberIds, year),
    monthlySeries(admin, [callerId], year),
  ])

  const members: TeamSalesMember[] = memberRows
    .filter((m) => m.profiles)
    .map((m) => {
      const t = periodTotals.get(m.user_id) ?? { deals: 0, value: 0 }
      return {
        id: m.user_id,
        fullname: m.profiles!.fullname,
        role: m.profiles!.role,
        profileUrl: m.profiles!.profile_url,
        isSelf: m.user_id === callerId,
        deals: t.deals,
        value: t.value,
      }
    })
    .sort((a, b) => b.value - a.value || b.deals - a.deals)

  const personal = periodTotals.get(callerId) ?? { deals: 0, value: 0 }

  // Group totals sum EVERY member id (not just the capped leaderboard rows),
  // so they stay exact for oversized groups. No team AND no recruits → zeros;
  // the UI shows the group tile/series as absent rather than mislabelling
  // personal sales.
  const teamTotals = scope !== "none"
    ? memberIds.reduce<Totals>((acc, id) => {
        const t = periodTotals.get(id)
        return { deals: acc.deals + (t?.deals ?? 0), value: acc.value + (t?.value ?? 0) }
      }, { deals: 0, value: 0 })
    : { deals: 0, value: 0 }

  const trend: TeamSalesMonth[] = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const t = teamSeries.get(m) ?? { deals: 0, value: 0 }
    const p = mySeries.get(m) ?? { deals: 0, value: 0 }
    return { month: m, teamDeals: t.deals, teamValue: t.value, myDeals: p.deals, myValue: p.value }
  })

  const payload: TeamSalesOverview = {
    period: { year, month },
    scope,
    teamName: team?.teams?.name ?? null,
    members,
    membersTotal: scope !== "none" ? Math.max(allMemberIds.length, memberRows.length) : 0,
    teamTotals,
    personal,
    trend,
  }

  return NextResponse.json(payload)
}
