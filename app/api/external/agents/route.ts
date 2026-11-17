import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { ROLES_SALES_PIPELINE, normalizeAppRole, roleToLabel } from "@/lib/app-roles"
import { EMAIL_RE, UUID_RE, pageParams, requireExternalKey } from "@/lib/external-api"
import { businessDate, fetchAllSales, saleCredits } from "@/lib/fhi-chat-tools"
import { titleCaseName } from "@/lib/public-profile"

/**
 * GET /api/external/agents — the agents' accounts for FHI's own systems (the
 * cross-company AI chat, boss via Juliecor 2026-11-17). Keyed
 * (lib/external-api.ts). Read-only.
 *
 *   ?role=agent|team_leader|unit_manager|global_partner|all   default: every selling role
 *   ?status=active|pending|inactive|all   default active
 *   ?team=<team id>        members of that team (its subteams too)
 *   ?q=<words>             name or email contains
 *   ?id=<profile id>  ?email=<address>   one person
 *   ?page=1&limit=50       limit ≤ 100; by name
 *
 * → { success, data: agent[], meta: { total, page, limit } }
 * An agent carries their name, email, phone, role, status, when they joined,
 * their team, and their sales totals (validated deals and value by their
 * share, pending deals, last sale date). Amounts are AED.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Profile = {
  id: string
  fname: string | null
  lname: string | null
  fullname: string | null
  role: string | null
  status: string | null
  profile_url: string | null
  joined_at: string | null
  is_deleted: boolean | null
  metadata: Record<string, unknown> | null
}

const PROFILE_COLUMNS = "id, fname, lname, fullname, role, status, profile_url, joined_at, is_deleted, metadata"

/** The number as the profile stores it (metadata.phone_country_code + phone_number), else the WhatsApp one from the partner sign-up. */
function phoneOf(meta: Record<string, unknown>): string | null {
  const join = (code: unknown, number: unknown) => {
    const n = typeof number === "string" ? number.trim() : ""
    if (!n) return null
    const c = typeof code === "string" ? code.trim() : ""
    return c && !n.startsWith("+") ? `${c.startsWith("+") ? c : `+${c}`} ${n}` : n
  }
  return join(meta.phone_country_code, meta.phone_number) ?? join(meta.whatsapp_country_code, meta.whatsapp_number)
}

// Emails live in auth.users; one listing serves many calls.
let emailCache: { at: number; map: Map<string, string> } | null = null
async function emailMap(admin: ReturnType<typeof createAdminSupabase>): Promise<Map<string, string>> {
  if (emailCache && Date.now() - emailCache.at < 5 * 60_000) return emailCache.map
  const map = new Map<string, string>()
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    for (const u of data.users) if (u.email) map.set(u.id, u.email)
    if (data.users.length < 200) break
  }
  emailCache = { at: Date.now(), map }
  return map
}

export async function GET(req: NextRequest) {
  const denied = requireExternalKey(req)
  if (denied) return denied

  const q = req.nextUrl.searchParams
  const admin = createAdminSupabase()
  const { page, limit, from, to } = pageParams(q)
  const roleParam = (q.get("role") ?? "").trim().toLowerCase()
  const statusParam = (q.get("status") ?? "active").trim().toLowerCase()
  const teamId = (q.get("team") ?? "").trim()
  const words = (q.get("q") ?? "").trim().toLowerCase()
  const oneId = (q.get("id") ?? "").trim()
  const oneEmail = (q.get("email") ?? "").trim().toLowerCase()
  if (oneId && !UUID_RE.test(oneId)) return NextResponse.json({ error: "id must be a profile id." }, { status: 400 })
  if (oneEmail && !EMAIL_RE.test(oneEmail)) return NextResponse.json({ error: "email is not valid." }, { status: 400 })
  if (teamId && !UUID_RE.test(teamId)) return NextResponse.json({ error: "team must be a team id." }, { status: 400 })

  let emails: Map<string, string>
  try {
    emails = await emailMap(admin)
  } catch {
    return NextResponse.json({ error: "Couldn't read the accounts." }, { status: 500 })
  }

  // Which profiles: one person, or everyone of the chosen roles and status.
  let query = admin.from("profiles").select(PROFILE_COLUMNS).neq("is_deleted", true).limit(5000)
  if (oneId) query = query.eq("id", oneId)
  else if (oneEmail) {
    const id = [...emails.entries()].find(([, e]) => e.toLowerCase() === oneEmail)?.[0]
    if (!id) return NextResponse.json({ success: true, data: [], meta: { total: 0, page, limit } })
    query = query.eq("id", id)
  } else {
    const roles = roleParam && roleParam !== "all" ? [normalizeAppRole(roleParam)] : roleParam === "all" ? null : [...ROLES_SALES_PIPELINE]
    if (roles) query = query.in("role", roles)
    if (statusParam !== "all") query = query.eq("status", statusParam)
  }
  const { data: profiles, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  let people = (profiles ?? []) as Profile[]

  // Teams: every active membership, with the team's name; the team filter includes subteams.
  const { data: allTeams } = await admin.from("teams").select("id, name, parent_id").limit(2000)
  const teamName = new Map((allTeams ?? []).map((t) => [t.id as string, t.name as string]))
  const wantedTeams = new Set<string>()
  if (teamId) {
    wantedTeams.add(teamId)
    for (let grew = true; grew; ) {
      grew = false
      for (const t of allTeams ?? []) if (t.parent_id && wantedTeams.has(t.parent_id as string) && !wantedTeams.has(t.id as string)) { wantedTeams.add(t.id as string); grew = true }
    }
  }
  const membership = new Map<string, { team_id: string; role_in_team: string | null }>()
  for (let p = 0; p < 5; p++) {
    const { data } = await admin.from("team_memberships").select("user_id, team_id, role_in_team").is("left_at", null).range(p * 1000, p * 1000 + 999)
    for (const m of (data ?? []) as Array<{ user_id: string; team_id: string; role_in_team: string | null }>) membership.set(m.user_id, { team_id: m.team_id, role_in_team: m.role_in_team })
    if (!data || data.length < 1000) break
  }
  if (teamId) people = people.filter((p) => wantedTeams.has(membership.get(p.id)?.team_id ?? ""))

  if (words) {
    people = people.filter((p) => {
      const hay = `${p.fullname ?? ""} ${p.fname ?? ""} ${p.lname ?? ""} ${emails.get(p.id) ?? ""}`.toLowerCase()
      return words.split(/\s+/).every((w) => hay.includes(w))
    })
  }
  people.sort((a, b) => (a.fullname ?? "").localeCompare(b.fullname ?? ""))
  const total = people.length
  const pageOf = people.slice(from, to + 1)

  // Sales totals by share, like the leaderboards.
  const totals = new Map<string, { validated: number; value: number; pending: number; last: string | null }>()
  const ids = new Set(pageOf.map((p) => p.id))
  for (const s of await fetchAllSales(admin)) {
    for (const c of saleCredits(s)) {
      if (!ids.has(c.agentId)) continue
      const t = totals.get(c.agentId) ?? { validated: 0, value: 0, pending: 0, last: null }
      const st = (s.validation_status ?? "pending").toLowerCase()
      if (st === "validated") {
        t.validated++
        t.value += c.value
      } else if (st === "pending") t.pending++
      if (st !== "invalid") {
        const d = businessDate(s)
        if (!t.last || d > t.last) t.last = d
      }
      totals.set(c.agentId, t)
    }
  }

  const data = pageOf.map((p) => {
    const m = membership.get(p.id)
    const t = totals.get(p.id)
    const meta = p.metadata ?? {}
    return {
      id: p.id,
      name: titleCaseName(p.fullname ?? "") || null,
      first_name: p.fname,
      last_name: p.lname,
      email: emails.get(p.id) ?? null,
      phone: phoneOf(meta),
      role: p.role,
      role_label: roleToLabel(p.role),
      status: p.status,
      joined_at: p.joined_at,
      avatar_url: p.profile_url,
      team: m ? { id: m.team_id, name: teamName.get(m.team_id) ?? null, role_in_team: m.role_in_team } : null,
      invited_by: typeof meta.invited_by === "string" ? (meta.invited_by as string) : null,
      sales: { validated_deals: t?.validated ?? 0, validated_value: Math.round(t?.value ?? 0), pending_deals: t?.pending ?? 0, last_sale_date: t?.last ?? null, currency: "AED" },
    }
  })

  return NextResponse.json({ success: true, data, meta: { total, page, limit, filters: { role: roleParam || "selling", status: statusParam, team: teamId || null, q: words || null } } }, { headers: { "cache-control": "no-store" } })
}
