import "server-only"

import type { createAdminSupabase } from "@/lib/admin-supabase"
import { saleCredits } from "@/lib/fhi-chat-tools"

/**
 * A team's sales for any span of time — the admin Teams page's "Team sales"
 * panel (2026-10-02). Validated sales are the headline (as on every
 * leaderboard); pending and rejected are counted beside them. The team is its
 * active members plus the members of its subteams.
 *
 * Shared sales follow the company rule (lib/fhi-chat-tools saleCredits):
 * each member is credited their share; for the team a deal counts once and is
 * worth the sum of its members' shares, so a deal shared with someone outside
 * the team only brings in the team's part. A sale's date is its reservation
 * date, else when it was recorded — the same date every board uses.
 *
 * from / to are YYYY-MM-DD, to exclusive. The caller checks who may see it.
 */

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

type Sale = {
  id: string
  agent_id: string
  developer_id: string
  project_id: number
  contract_price: number | string | null
  validation_status: string | null
  reservation_date: string | null
  created_at: string
  partners: unknown
  unit_number: string | null
  sale_type: string | null
  property_address: string | null
  projects: { name: string | null } | { name: string | null }[] | null
  developers: { name: string | null } | { name: string | null }[] | null
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)
const saleDate = (s: Sale) => s.reservation_date ?? s.created_at.slice(0, 10)
const statusOf = (s: Sale) => (s.validation_status ?? "pending").toLowerCase()

type Admin = ReturnType<typeof createAdminSupabase>

export async function computeTeamSales(admin: Admin, id: string, from: string, to: string) {
  if (!ISO_DAY.test(from) || !ISO_DAY.test(to) || from >= to) {
    return { status: 400, error: "Give from and to as YYYY-MM-DD, from before to." }
  }
  const spanDays = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
  if (spanDays > 3700) return { status: 400, error: "Pick a span of ten years or less." }
  const prevFrom = new Date(Date.parse(`${from}T00:00:00Z`) - spanDays * DAY_MS).toISOString().slice(0, 10)


  // The team and its subteams (any depth).
  const { data: allTeams, error: teamsErr } = await admin.from("teams").select("id, name, parent_id, is_active").limit(2000)
  if (teamsErr) return { status: 500, error: teamsErr.message }
  const team = (allTeams ?? []).find((t) => t.id === id)
  if (!team) return { status: 404, error: "Team not found" }
  const teamIds = new Set<string>([id])
  for (let grew = true; grew; ) {
    grew = false
    for (const t of allTeams ?? []) if (t.parent_id && teamIds.has(t.parent_id) && !teamIds.has(t.id)) { teamIds.add(t.id); grew = true }
  }

  // Active members (paged past PostgREST's 1000-row cap).
  type Member = { user_id: string; team_id: string; role_in_team: string | null; profiles: { id: string; fullname: string | null; role: string | null; profile_url: string | null; is_deleted: boolean | null } | null }
  const members: Member[] = []
  for (let page = 0; page < 20; page++) {
    const { data, error } = await admin
      .from("team_memberships")
      .select("user_id, team_id, role_in_team, profiles!inner(id, fullname, role, profile_url, is_deleted)")
      .in("team_id", [...teamIds])
      .is("left_at", null)
      .range(page * 1000, page * 1000 + 999)
    if (error) return { status: 500, error: error.message }
    members.push(...((data ?? []) as unknown as Member[]))
    if (!data || data.length < 1000) break
  }
  const live = members.filter((m) => m.profiles && m.profiles.is_deleted !== true)
  const memberById = new Map(live.map((m) => [m.user_id, m]))

  // Sales from the start of the previous window on (it feeds the comparison).
  const sales: Sale[] = []
  for (let page = 0; page < 20; page++) {
    const { data, error } = await admin
      .from("sales_reports")
      .select("id, agent_id, developer_id, project_id, contract_price, validation_status, reservation_date, created_at, partners, unit_number, sale_type, property_address, projects(name), developers(name)")
      .or(`reservation_date.gte.${prevFrom},and(reservation_date.is.null,created_at.gte.${prevFrom})`)
      .order("created_at", { ascending: true })
      .range(page * 1000, page * 1000 + 999)
    if (error) return { status: 500, error: error.message }
    sales.push(...((data ?? []) as unknown as Sale[]))
    if (!data || data.length < 1000) break
  }

  type Line = { sale_id: string; date: string; project: string; developer: string | null; unit: string | null; price: number; share: number; credited: number; status: string; shared: boolean }
  type Row = { validated: { deals: number; value: number }; pending: { deals: number; value: number }; rejected: number; deals: Line[] }
  const byMember = new Map<string, Row>()
  const team_totals = { validated: { deals: 0, value: 0 }, pending: { deals: 0, value: 0 }, rejected: { deals: 0, value: 0 } }
  const previous = { validated: { deals: 0, value: 0 } }
  const byMonth = new Map<string, { deals: number; value: number }>()
  const byProject = new Map<string, { deals: number; value: number }>()

  for (const s of sales) {
    const d = saleDate(s)
    if (d < prevFrom || d >= to) continue
    const credits = saleCredits(s).filter((c) => memberById.has(c.agentId))
    if (credits.length === 0) continue
    const status = statusOf(s)
    const teamValue = credits.reduce((a, c) => a + c.value, 0)
    if (d < from) {
      if (status === "validated") { previous.validated.deals++; previous.validated.value += teamValue }
      continue
    }
    const bucket = status === "validated" ? team_totals.validated : status === "rejected" ? team_totals.rejected : team_totals.pending
    bucket.deals++
    bucket.value += teamValue
    const project = s.sale_type && s.sale_type !== "project" ? s.property_address || "Secondary sale" : one(s.projects)?.name ?? "Unknown project"
    if (status === "validated") {
      const m = d.slice(0, 7)
      const cur = byMonth.get(m) ?? { deals: 0, value: 0 }
      cur.deals++; cur.value += teamValue; byMonth.set(m, cur)
      const p = byProject.get(project) ?? { deals: 0, value: 0 }
      p.deals++; p.value += teamValue; byProject.set(project, p)
    }
    const price = Number(s.contract_price ?? 0) || 0
    const shared = saleCredits(s).length > 1
    for (const c of credits) {
      const row = byMember.get(c.agentId) ?? { validated: { deals: 0, value: 0 }, pending: { deals: 0, value: 0 }, rejected: 0, deals: [] }
      if (status === "validated") { row.validated.deals++; row.validated.value += c.value }
      else if (status === "rejected") row.rejected++
      else { row.pending.deals++; row.pending.value += c.value }
      row.deals.push({ sale_id: s.id, date: d, project, developer: one(s.developers)?.name ?? null, unit: s.unit_number, price, share: c.share, credited: Math.round(c.value), status, shared })
      byMember.set(c.agentId, row)
    }
  }

  // Every month in the window, empty ones included, for the chart.
  const months: Array<{ month: string; deals: number; value: number }> = []
  {
    const cur = new Date(`${from.slice(0, 7)}-01T00:00:00Z`)
    const last = to
    while (cur.toISOString().slice(0, 10) < last && months.length < 130) {
      const key = cur.toISOString().slice(0, 7)
      const v = byMonth.get(key) ?? { deals: 0, value: 0 }
      months.push({ month: key, deals: v.deals, value: Math.round(v.value) })
      cur.setUTCMonth(cur.getUTCMonth() + 1)
    }
  }

  const sellers = [...byMember.entries()]
    .map(([agentId, r]) => {
      const m = memberById.get(agentId)!
      const subteam = m.team_id !== id ? (allTeams ?? []).find((t) => t.id === m.team_id)?.name ?? null : null
      return {
        id: agentId,
        name: m.profiles?.fullname ?? "Unknown",
        role: m.profiles?.role ?? null,
        role_in_team: m.role_in_team,
        subteam,
        profile_url: m.profiles?.profile_url ?? null,
        validated_deals: r.validated.deals,
        validated_value: Math.round(r.validated.value),
        pending_deals: r.pending.deals,
        pending_value: Math.round(r.pending.value),
        rejected_deals: r.rejected,
        deals: r.deals.sort((a, b) => b.date.localeCompare(a.date)),
      }
    })
    .sort((a, b) => b.validated_value - a.validated_value || b.pending_value - a.pending_value || a.name.localeCompare(b.name))

  const round = (t: { deals: number; value: number }) => ({ deals: t.deals, value: Math.round(t.value) })
  return {
    status: 200,
    team: { id: team.id, name: team.name, subteams: teamIds.size - 1 },
    period: { from, to, days: spanDays, previous_from: prevFrom },
    members_total: live.length,
    totals: { validated: round(team_totals.validated), pending: round(team_totals.pending), rejected: round(team_totals.rejected) },
    previous: { validated: round(previous.validated) },
    members_who_sold: sellers.filter((s) => s.validated_deals > 0).length,
    sellers,
    months,
    by_project: [...byProject.entries()].map(([project, v]) => ({ project, deals: v.deals, value: Math.round(v.value) })).sort((a, b) => b.value - a.value).slice(0, 10),
  }
}
