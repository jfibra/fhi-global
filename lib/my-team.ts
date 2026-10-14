import "server-only"

import type { createAdminSupabase } from "@/lib/admin-supabase"
import { buildGenealogy, type GenealogyNode } from "@/lib/genealogy"
import { saleCredits } from "@/lib/fhi-chat-tools"

/**
 * My Team (boss via Juliecor, 2026-10-14): everyone in one account's genealogy
 * (all levels — lib/genealogy.ts) and every sale credited to any of them, so
 * the page can show KPIs, who sold and who hasn't, and every deal with
 * filters. The caller decides whose team may be built (app/api/my-team: only
 * the signed-in account's own).
 *
 * Amounts: a sale shared inside the network credits each member their share;
 * a deal shared with someone outside only brings the network's part
 * (saleCredits — the company rule). A sale's date is its reservation date,
 * else when it was recorded, like every board.
 */

type Admin = ReturnType<typeof createAdminSupabase>
export type TeamMember = GenealogyNode & { validated: number; validatedValue: number; pending: number; pendingValue: number; rejected: number; lastSale: string | null }
export type TeamSale = {
  id: string
  date: string
  status: string
  project: string
  developer: string | null
  unit: string | null
  type: string | null
  price: number
  /** The network members credited on this sale and their share. */
  credits: Array<{ memberId: string; name: string; level: number; share: number; value: number }>
  /** Partners on the deal who are outside the network, by name. */
  outside: string[]
}
export type MyTeamResponse = {
  root: { id: string; name: string; photo: string | null; role: string | null }
  /** The formal team the root belongs to, if any — its logo brands the masthead. */
  team: { name: string; logo: string | null; roleInTeam: string | null } | null
  members: TeamMember[]
  sales: TeamSale[]
  perLevel: number[]
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

export async function buildMyTeam(admin: Admin, userId: string, fallback: { name: string | null; photo: string | null; role: string | null }): Promise<MyTeamResponse> {
  const tree = await buildGenealogy(admin, userId, fallback)
  const { data: membership } = await admin.from("team_memberships").select("role_in_team, teams(name, logo_url)").eq("user_id", userId).eq("is_active", true).order("joined_at", { ascending: false }).limit(1)
  const mt = (membership?.[0] ?? null) as unknown as { role_in_team: string | null; teams: { name: string | null; logo_url: string | null } | { name: string | null; logo_url: string | null }[] | null } | null
  const teamRow = mt ? one(mt.teams) : null
  const team = teamRow?.name ? { name: teamRow.name, logo: teamRow.logo_url ?? null, roleInTeam: mt?.role_in_team ?? null } : null
  const memberById = new Map(tree.nodes.map((n) => [n.id, n]))

  type Row = { id: string; agent_id: string; developer_id: string; project_id: number; contract_price: number | string | null; validation_status: string | null; reservation_date: string | null; created_at: string; partners: unknown; unit_number: string | null; sale_type: string | null; property_address: string | null; projects: { name: string | null } | { name: string | null }[] | null; developers: { name: string | null } | { name: string | null }[] | null }
  const rows: Row[] = []
  for (let page = 0; page < 20; page++) {
    const { data, error } = await admin
      .from("sales_reports")
      .select("id, agent_id, developer_id, project_id, contract_price, validation_status, reservation_date, created_at, partners, unit_number, sale_type, property_address, projects(name), developers(name)")
      .order("created_at", { ascending: true })
      .range(page * 1000, page * 1000 + 999)
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as unknown as Row[]))
    if (!data || data.length < 1000) break
  }

  // Names of partners outside the network, looked up once.
  const outsideIds = new Set<string>()
  const sales: TeamSale[] = []
  const stats = new Map<string, { validated: number; validatedValue: number; pending: number; pendingValue: number; rejected: number; lastSale: string | null }>()
  for (const s of rows) {
    const credits = saleCredits(s)
    const inside = credits.filter((c) => memberById.has(c.agentId))
    if (!inside.length) continue
    const status = (s.validation_status ?? "pending").toLowerCase()
    const date = s.reservation_date ?? s.created_at.slice(0, 10)
    for (const c of credits) if (!memberById.has(c.agentId)) outsideIds.add(c.agentId)
    for (const c of inside) {
      const t = stats.get(c.agentId) ?? { validated: 0, validatedValue: 0, pending: 0, pendingValue: 0, rejected: 0, lastSale: null }
      if (status === "validated") { t.validated++; t.validatedValue += c.value; if (!t.lastSale || date > t.lastSale) t.lastSale = date }
      else if (status === "rejected") t.rejected++
      else { t.pending++; t.pendingValue += c.value }
      stats.set(c.agentId, t)
    }
    sales.push({
      id: s.id,
      date,
      status,
      project: s.sale_type && s.sale_type !== "project" ? s.property_address || "Secondary sale" : one(s.projects)?.name ?? "Unknown project",
      developer: one(s.developers)?.name ?? null,
      unit: s.unit_number,
      type: s.sale_type,
      price: Number(s.contract_price ?? 0) || 0,
      credits: inside.map((c) => ({ memberId: c.agentId, name: memberById.get(c.agentId)!.name, level: memberById.get(c.agentId)!.level, share: c.share, value: Math.round(c.value) })),
      outside: credits.filter((c) => !memberById.has(c.agentId)).map((c) => c.agentId),
    })
  }
  const outsideNames = new Map<string, string>()
  if (outsideIds.size) {
    const { data } = await admin.from("profiles").select("id, fullname").in("id", [...outsideIds])
    for (const p of (data ?? []) as { id: string; fullname: string | null }[]) outsideNames.set(String(p.id), (p.fullname ?? "").replace(/\s+/g, " ").trim() || "another agent")
  }
  // The root's own share on a shared deal is not team credit, but it isn't an outsider either.
  for (const s of sales) s.outside = s.outside.map((id) => (id === userId ? "you" : outsideNames.get(id) ?? "another agent"))
  sales.sort((a, b) => b.date.localeCompare(a.date))

  const members: TeamMember[] = tree.nodes.map((n) => ({ ...n, ...(stats.get(n.id) ?? { validated: 0, validatedValue: 0, pending: 0, pendingValue: 0, rejected: 0, lastSale: null }) }))
  for (const m of members) { m.validatedValue = Math.round(m.validatedValue); m.pendingValue = Math.round(m.pendingValue) }
  return { root: tree.root, team, members, sales, perLevel: tree.summary.perLevel }
}
