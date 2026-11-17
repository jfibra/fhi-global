import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { roleToLabel } from "@/lib/app-roles"
import { ISO_DAY, UUID_RE, pageParams, requireExternalKey } from "@/lib/external-api"
import { rankSales } from "@/lib/sales-top"
import { titleCaseName } from "@/lib/public-profile"

/**
 * GET /api/external/teams — the teams: leader, members, subteams and totals.
 * Keyed. Read-only. A team's figures include its subteams at any depth, the
 * same way the Teams page and the top-teams board count (lib/sales-top.ts).
 *
 *   ?q=<words>  ?id=<id>  ?slug=<slug>   find a team
 *   ?status=active|all                   default active
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD       the totals' period, inclusive; omit for all time
 *   ?include=members                     add the member list (name, role, role in team, joined)
 *   ?page=1&limit=50                     limit ≤ 100; by name
 *
 * "The leader" = the active membership whose role in the team reads like a
 * leader (lead / head), the Team Report's rule.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Team = { id: string; name: string; slug: string | null; description: string | null; logo_url: string | null; parent_id: string | null; team_type: string | null; is_active: boolean | null; created_at: string | null }
type Membership = { user_id: string; team_id: string; role_in_team: string | null; joined_at: string | null; profiles: { id: string; fullname: string | null; role: string | null; status: string | null; profile_url: string | null; is_deleted: boolean | null } | null }

const LEADER_RE = /lead|head/i

export async function GET(req: NextRequest) {
  const denied = requireExternalKey(req)
  if (denied) return denied

  const q = req.nextUrl.searchParams
  const admin = createAdminSupabase()
  const { page, limit, from: rangeFrom, to: rangeTo } = pageParams(q)
  const words = (q.get("q") ?? "").trim().toLowerCase()
  const oneId = (q.get("id") ?? "").trim()
  const oneSlug = (q.get("slug") ?? "").trim()
  const status = (q.get("status") ?? "active").toLowerCase()
  const from = q.get("from") ?? ""
  const to = q.get("to") ?? ""
  const includeMembers = (q.get("include") ?? "").split(",").map((s) => s.trim()).includes("members")
  if (oneId && !UUID_RE.test(oneId)) return NextResponse.json({ error: "id must be a team id." }, { status: 400 })
  if ((from && !ISO_DAY.test(from)) || (to && !ISO_DAY.test(to))) return NextResponse.json({ error: "from and to must be YYYY-MM-DD." }, { status: 400 })

  const { data: teamRows, error } = await admin.from("teams").select("id, name, slug, description, logo_url, parent_id, team_type, is_active, created_at").limit(2000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const allTeams = (teamRows ?? []) as Team[]
  const byId = new Map(allTeams.map((t) => [t.id, t]))

  // Every active membership with its profile, paged past the 1000-row cap.
  const memberships: Membership[] = []
  for (let p = 0; p < 20; p++) {
    const { data, error: mErr } = await admin
      .from("team_memberships")
      .select("user_id, team_id, role_in_team, joined_at, profiles!inner(id, fullname, role, status, profile_url, is_deleted)")
      .is("left_at", null)
      .range(p * 1000, p * 1000 + 999)
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })
    memberships.push(...((data ?? []) as unknown as Membership[]))
    if (!data || data.length < 1000) break
  }
  const live = memberships.filter((m) => m.profiles && m.profiles.is_deleted !== true)
  const membersOf = new Map<string, Membership[]>()
  for (const m of live) membersOf.set(m.team_id, [...(membersOf.get(m.team_id) ?? []), m])
  const childrenOf = new Map<string, string[]>()
  for (const t of allTeams) if (t.parent_id) childrenOf.set(t.parent_id, [...(childrenOf.get(t.parent_id) ?? []), t.id])
  const tree = (id: string): string[] => {
    const out = [id]
    for (let i = 0; i < out.length && out.length < 500; i++) for (const c of childrenOf.get(out[i]) ?? []) if (!out.includes(c)) out.push(c)
    return out
  }

  // Totals, the same counting as the top-teams board (top-level rows + subteams, both by id).
  const ranked = await rankSales(admin, { by: "teams", from: from || null, to: to || null, limit: 1000 })
  const totals = new Map<string, { deals: number; value: number }>()
  for (const r of ranked.rows) totals.set(r.id, { deals: r.deals, value: r.value })
  for (const s of ranked.subteams ?? []) totals.set(s.id, { deals: s.deals, value: s.value })

  let teams = allTeams.filter((t) => (status === "all" ? true : t.is_active !== false))
  if (oneId) teams = teams.filter((t) => t.id === oneId)
  if (oneSlug) teams = teams.filter((t) => t.slug === oneSlug)
  if (words) teams = teams.filter((t) => words.split(/\s+/).every((w) => t.name.toLowerCase().includes(w)))
  teams.sort((a, b) => a.name.localeCompare(b.name))
  const total = teams.length

  const person = (m: Membership) => ({
    id: m.user_id,
    name: titleCaseName(m.profiles?.fullname ?? "") || null,
    role: m.profiles?.role ?? null,
    role_label: roleToLabel(m.profiles?.role),
    status: m.profiles?.status ?? null,
    avatar_url: m.profiles?.profile_url ?? null,
    role_in_team: m.role_in_team,
    joined_at: m.joined_at,
  })

  const data = teams.slice(rangeFrom, rangeTo + 1).map((t) => {
    const own = membersOf.get(t.id) ?? []
    const ids = tree(t.id)
    const whole = ids.flatMap((id) => membersOf.get(id) ?? [])
    const leader = own.find((m) => LEADER_RE.test(m.role_in_team ?? "")) ?? null
    const tot = totals.get(t.id) ?? { deals: 0, value: 0 }
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.description,
      logo_url: t.logo_url,
      type: t.team_type,
      active: t.is_active !== false,
      parent: t.parent_id ? { id: t.parent_id, name: byId.get(t.parent_id)?.name ?? null } : null,
      subteams: (childrenOf.get(t.id) ?? []).map((id) => ({ id, name: byId.get(id)?.name ?? null })),
      leader: leader ? person(leader) : null,
      members_count: { own: own.length, with_subteams: whole.length },
      sales: { validated_deals: tot.deals, validated_value: tot.value, currency: "AED", period: { from: from || null, to: to || null } },
      ...(includeMembers ? { members: whole.slice(0, 1000).map((m) => ({ ...person(m), team_id: m.team_id, team_name: byId.get(m.team_id)?.name ?? null })) } : {}),
      created_at: t.created_at,
    }
  })

  return NextResponse.json(
    { success: true, data, meta: { total, page, limit, filters: { q: words || null, status, from: from || null, to: to || null, include: includeMembers ? "members" : null }, rules: "A team's sales include its subteams at any depth; each team is credited its members' shares and a deal shared inside one team counts once. The leader is the active member whose role in the team reads like a leader." } },
    { headers: { "cache-control": "no-store" } },
  )
}
