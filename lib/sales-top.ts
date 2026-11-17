import "server-only"

import type { createAdminSupabase } from "@/lib/admin-supabase"
import { fetchAllSales, inRange, saleCredits, type SaleRow } from "@/lib/fhi-chat-tools"

/**
 * The sales leaderboards for the external API (boss via Juliecor,
 * 2026-11-17) — the SAME rules as the dashboards and FHI Assistant's
 * top_sales_board / top_developers / top_teams in lib/fhi-chat-tools.ts, so
 * the group's AI chat quotes the numbers the boss sees:
 *  - validated sales only; a sale's date is its reservation date, else the
 *    day it was recorded;
 *  - agents: a shared deal credits each agent their share of the price;
 *  - developers and projects: every sale counts once, in full;
 *  - teams: a team is its members plus its subteams' members at any depth;
 *    each team is credited its members' shares and a deal shared inside one
 *    team counts once; the ranking is of top-level teams, with subteams listed
 *    apart (already inside their parent's figure — never added again).
 */

type Admin = ReturnType<typeof createAdminSupabase>

export type TopBy = "agents" | "developers" | "projects" | "teams"
export const TOP_BY: TopBy[] = ["agents", "developers", "projects", "teams"]

export type TopRow = {
  rank: number
  id: string
  name: string | null
  slug?: string | null
  image?: string | null
  deals: number
  value: number
  /** Teams only. */
  members?: number
}

export type TopSubteam = { id: string; name: string | null; part_of: string | null; members: number; deals: number; value: number }

const DAY_MS = 86400e3
const shiftDay = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)

export type TopArgs = {
  by: TopBy
  /** Inclusive YYYY-MM-DD, either may be null for "all time". */
  from: string | null
  to: string | null
  /** Narrow the agents / projects boards to one developer, or the agents board to one project. */
  developerId?: string | null
  projectId?: number | null
  limit: number
}

export async function rankSales(admin: Admin, args: TopArgs): Promise<{ rows: TopRow[]; subteams?: TopSubteam[]; sales_counted: number }> {
  let sales = (await fetchAllSales(admin)).filter((s) => s.validation_status === "validated" && inRange(s, args.from, args.to ? shiftDay(args.to, 1) : null))
  if (args.developerId) sales = sales.filter((s) => s.developer_id === args.developerId)
  if (args.projectId !== null && args.projectId !== undefined) sales = sales.filter((s) => Number(s.project_id) === args.projectId)

  const tally = new Map<string, { deals: number; value: number }>()
  const add = (id: string, value: number) => {
    const t = tally.get(id) ?? { deals: 0, value: 0 }
    t.deals += 1
    t.value += value
    tally.set(id, t)
  }

  if (args.by === "teams") return rankTeams(admin, sales, args.limit)

  for (const s of sales) {
    if (args.by === "agents") for (const c of saleCredits(s)) add(c.agentId, c.value)
    else if (args.by === "developers") add(String(s.developer_id), Number(s.contract_price ?? 0))
    else add(String(s.project_id), Number(s.contract_price ?? 0))
  }
  const ranked = [...tally.entries()]
    .map(([id, t]) => ({ id, deals: t.deals, value: t.value }))
    .sort((a, b) => b.value - a.value || b.deals - a.deals)
    .slice(0, args.limit)

  const ids = ranked.map((r) => r.id)
  const names = new Map<string, { name: string | null; slug: string | null; image: string | null }>()
  if (ids.length) {
    if (args.by === "agents") {
      const { data } = await admin.from("profiles").select("id, fullname, profile_url").in("id", ids)
      for (const p of data ?? []) names.set(String(p.id), { name: (p.fullname ?? "").trim().replace(/\s+/g, " ") || null, slug: null, image: p.profile_url ?? null })
    } else if (args.by === "developers") {
      const { data } = await admin.from("developers").select("id, name, slug, logo_url").in("id", ids)
      for (const d of data ?? []) names.set(String(d.id), { name: d.name, slug: d.slug ?? null, image: d.logo_url ?? null })
    } else {
      const { data } = await admin.from("projects").select("id, name, slug, main_image").in("id", ids.map(Number))
      for (const p of data ?? []) names.set(String(p.id), { name: p.name, slug: p.slug ?? null, image: p.main_image ?? null })
    }
  }
  return {
    rows: ranked.map((r, i) => ({ rank: i + 1, id: r.id, name: names.get(r.id)?.name ?? null, slug: names.get(r.id)?.slug ?? null, image: names.get(r.id)?.image ?? null, deals: r.deals, value: Math.round(r.value) })),
    sales_counted: sales.length,
  }
}

async function rankTeams(admin: Admin, sales: SaleRow[], limit: number): Promise<{ rows: TopRow[]; subteams: TopSubteam[]; sales_counted: number }> {
  const [{ data: teams, error: teamErr }, { data: memberships, error: memErr }] = await Promise.all([
    admin.from("teams").select("id, name, logo_url, is_active, parent_id").eq("is_active", true).limit(500),
    admin.from("team_memberships").select("user_id, team_id").eq("is_active", true).limit(10000),
  ])
  if (teamErr) throw new Error(teamErr.message)
  if (memErr) throw new Error(memErr.message)

  // A member counts for their own team and every team above it.
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

  const byTeam = new Map<string, { deals: number; value: number }>()
  for (const s of sales) {
    const teamValue = new Map<string, number>()
    for (const c of saleCredits(s)) for (const tid of new Set(teamsOf.get(c.agentId) ?? [])) teamValue.set(tid, (teamValue.get(tid) ?? 0) + c.value)
    for (const [tid, value] of teamValue) {
      const t = byTeam.get(tid) ?? { deals: 0, value: 0 }
      t.deals += 1
      t.value += value
      byTeam.set(tid, t)
    }
  }
  const teamById = new Map((teams ?? []).map((t) => [String(t.id), t]))
  const isTop = (id: string) => !parentOf.get(id) || !teamById.has(parentOf.get(id) as string)
  const rows = [...byTeam.entries()]
    .filter(([id]) => teamById.has(id) && isTop(id))
    .map(([id, t]) => ({ id, ...t }))
    .sort((a, b) => b.value - a.value || b.deals - a.deals)
    .slice(0, limit)
    .map((t, i): TopRow => ({ rank: i + 1, id: t.id, name: teamById.get(t.id)?.name ?? null, image: teamById.get(t.id)?.logo_url ?? null, members: memberCount.get(t.id) ?? 0, deals: t.deals, value: Math.round(t.value) }))
  const subteams = [...byTeam.entries()]
    .filter(([id]) => teamById.has(id) && !isTop(id))
    .map(([id, t]): TopSubteam => ({ id, name: teamById.get(id)?.name ?? null, part_of: teamById.get(parentOf.get(id) as string)?.name ?? null, members: memberCount.get(id) ?? 0, deals: t.deals, value: Math.round(t.value) }))
    .sort((a, b) => b.value - a.value)
  return { rows, subteams, sales_counted: sales.length }
}
