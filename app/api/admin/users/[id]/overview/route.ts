import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import type {
  UserOverview, UserTeam, UserPerson, UserInvite, SalesTotals,
} from "@/lib/user-overview"

/**
 * User 360 — every relationship of one account in a single payload, so the
 * Account Directory detail view renders without a request waterfall.
 *
 * Each section is fetched independently and degrades to empty on failure: a
 * missing optional table must not blank out the whole profile.
 */

export const runtime = "nodejs"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RECENT_LIMIT = 8
/** Cap on rows pulled for the fallback client-side aggregation. */
const AGGREGATE_LIMIT = 1000
/** How far up the referral chain to walk. */
const UPLINE_DEPTH = 4
/** Rows listed per relation; true totals come from separate exact counts. */
const TEAMMATE_LIMIT = 200
const RECRUIT_LIMIT = 500
/** UUIDs per `.in()` filter — keeps the fallback query URL well under gateway limits. */
const IN_CHUNK = 100

type Admin = ReturnType<typeof createAdminSupabase>

/* ── section loaders — each swallows its own failure ─────────────────────── */

async function loadTeams(admin: Admin, userId: string): Promise<{ teams: UserTeam[]; activeTeamId: string | null }> {
  const { data, error } = await admin
    .from("team_memberships")
    .select("team_id, role_in_team, joined_at, left_at, is_active, teams(id, name, slug)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })

  if (error || !data) return { teams: [], activeTeamId: null }

  const rows = data as unknown as Array<{
    team_id: string
    role_in_team: string | null
    joined_at: string | null
    left_at: string | null
    is_active: boolean | null
    teams: { id: string; name: string | null; slug: string | null } | null
  }>

  const teams: UserTeam[] = rows.map((r) => ({
    id: r.team_id,
    name: r.teams?.name ?? "Unknown team",
    slug: r.teams?.slug ?? null,
    roleInTeam: r.role_in_team,
    joinedAt: r.joined_at,
    leftAt: r.left_at,
    isActive: r.is_active === true,
  }))

  return { teams, activeTeamId: teams.find((t) => t.isActive)?.id ?? null }
}

async function loadTeammates(admin: Admin, teamId: string | null, userId: string): Promise<UserPerson[]> {
  if (!teamId) return []
  const { data, error } = await admin
    .from("team_memberships")
    .select("role_in_team, joined_at, profiles!inner(id, fullname, role, status, profile_url)")
    .eq("team_id", teamId)
    .eq("is_active", true)
    .neq("user_id", userId)
    // `is_deleted` is nullable on legacy rows, so exclude only an explicit true.
    .not("profiles.is_deleted", "is", true)
    .order("joined_at", { ascending: true })
    .limit(TEAMMATE_LIMIT)

  if (error || !data) return []

  return (data as unknown as Array<{
    role_in_team: string | null
    joined_at: string | null
    profiles: { id: string; fullname: string | null; role: string | null; status: string | null; profile_url: string | null }
  }>).map((r) => ({
    id: r.profiles.id,
    fullname: r.profiles.fullname,
    role: r.profiles.role,
    status: r.profiles.status,
    profileUrl: r.profiles.profile_url,
    roleInTeam: r.role_in_team,
    joinedAt: r.joined_at,
  }))
}

async function loadRecruits(admin: Admin, userId: string): Promise<UserPerson[]> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, fullname, role, status, profile_url, joined_at")
    .eq("metadata->>invited_by", userId)
    // Developer-invite registrations aren't personal recruits — they're tracked
    // by developer_invite_id and shown under their own link's Registrations list.
    .is("metadata->>developer_invite_id", null)
    .not("is_deleted", "is", true)
    .order("joined_at", { ascending: false })
    .limit(RECRUIT_LIMIT)

  if (error || !data) return []

  return data.map((p) => ({
    id: p.id as string,
    fullname: (p.fullname as string | null) ?? null,
    role: (p.role as string | null) ?? null,
    status: (p.status as string | null) ?? null,
    profileUrl: (p.profile_url as string | null) ?? null,
    joinedAt: (p.joined_at as string | null) ?? null,
  }))
}

type ProfileWithMeta = {
  id: string
  fullname: string | null
  role: string | null
  status: string | null
  profile_url: string | null
  metadata: Record<string, unknown> | null
}

async function fetchProfileWithMeta(admin: Admin, id: string): Promise<ProfileWithMeta | null> {
  const { data } = await admin
    .from("profiles")
    .select("id, fullname, role, status, profile_url, metadata")
    .eq("id", id)
    .maybeSingle()
  return (data as ProfileWithMeta | null) ?? null
}

function referrerIdOf(profile: ProfileWithMeta | null): string | null {
  const v = profile?.metadata?.invited_by
  return typeof v === "string" && v ? v : null
}

/** Walk metadata.invited_by upwards — direct referrer first. Cycle-safe. */
async function loadUpline(admin: Admin, userId: string): Promise<UserPerson[]> {
  const chain: UserPerson[] = []
  const seen = new Set<string>([userId])
  let cursor = await fetchProfileWithMeta(admin, userId)

  for (let i = 0; i < UPLINE_DEPTH; i++) {
    const parentId = referrerIdOf(cursor)
    if (!parentId || seen.has(parentId)) break
    const parent = await fetchProfileWithMeta(admin, parentId)
    if (!parent) break
    chain.push({
      id: parent.id,
      fullname: parent.fullname,
      role: parent.role,
      status: parent.status,
      profileUrl: parent.profile_url,
    })
    seen.add(parent.id)
    cursor = parent
  }

  return chain
}

/**
 * Deals + contract value per agent, aggregated in SQL (migration 017).
 *
 * The fallback exists only for environments where 017 hasn't been applied yet.
 * It chunks the id list because a `.in()` of hundreds of UUIDs serializes into
 * a multi-KB GET URL that gateways reject, and it can undercount past
 * PostgREST's row cap — which is exactly why the RPC is preferred.
 */
async function loadSalesByAgent(admin: Admin, ids: string[]): Promise<Map<string, SalesTotals>> {
  const out = new Map<string, SalesTotals>()
  if (ids.length === 0) return out

  const { data, error } = await admin.rpc("sales_totals_by_agents", { p_agent_ids: ids })
  if (!error && Array.isArray(data)) {
    for (const row of data as Array<{ agent_id: string; deal_count: number | string; total_value: number | string }>) {
      out.set(row.agent_id, { count: Number(row.deal_count ?? 0), value: Number(row.total_value ?? 0) })
    }
    return out
  }

  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) chunks.push(ids.slice(i, i + IN_CHUNK))

  const results = await Promise.all(
    chunks.map((chunk) =>
      admin.from("sales_reports").select("agent_id, contract_price").in("agent_id", chunk).limit(AGGREGATE_LIMIT),
    ),
  )

  for (const res of results) {
    for (const row of (res.data ?? []) as Array<{ agent_id: string | null; contract_price: number | null }>) {
      if (!row.agent_id) continue
      const prev = out.get(row.agent_id) ?? { count: 0, value: 0 }
      out.set(row.agent_id, { count: prev.count + 1, value: prev.value + Number(row.contract_price ?? 0) })
    }
  }
  return out
}

function sumTotals(people: UserPerson[]): SalesTotals {
  return people.reduce<SalesTotals>(
    (acc, p) => ({ count: acc.count + (p.salesCount ?? 0), value: acc.value + (p.salesValue ?? 0) }),
    { count: 0, value: 0 },
  )
}

function inviteStatus(row: {
  is_active: boolean | null
  expires_at: string | null
  max_uses: number | null
  use_count: number | null
}): UserInvite["status"] {
  if (row.is_active === false) return "revoked"
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return "expired"
  if (row.max_uses != null && (row.use_count ?? 0) >= row.max_uses) return "used_up"
  return "active"
}

async function loadInvites(admin: Admin, userId: string): Promise<UserInvite[]> {
  const { data, error } = await admin
    .from("developer_invites")
    .select("id, label, is_active, expires_at, max_uses, use_count, created_at, developers(name)")
    .eq("created_by", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error || !data) return []

  return (data as unknown as Array<{
    id: string
    label: string | null
    is_active: boolean | null
    expires_at: string | null
    max_uses: number | null
    use_count: number | null
    created_at: string | null
    developers: { name: string | null } | null
  }>).map((r) => ({
    id: r.id,
    label: r.label,
    status: inviteStatus(r),
    useCount: r.use_count ?? 0,
    maxUses: r.max_uses,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
    developerName: r.developers?.name ?? null,
  }))
}

async function loadSales(admin: Admin, userId: string): Promise<UserOverview["sales"]> {
  // Totals come from the SQL aggregate (migration 017) so they stay exact past
  // PostgREST's row cap; the fallback mirrors the old capped client-side sum.
  const [breakdown, { data: recent }] = await Promise.all([
    admin.rpc("sales_status_breakdown", { p_agent_id: userId }),
    admin
      .from("sales_reports")
      .select("id, contract_price, sale_type, commission_status, validation_status, reservation_date, created_at, projects(name), developers(name)")
      .eq("agent_id", userId)
      .order("created_at", { ascending: false })
      .limit(RECENT_LIMIT),
  ])

  const byStatus: Record<string, number> = {}
  let totalValue = 0
  let count = 0

  if (!breakdown.error && Array.isArray(breakdown.data)) {
    for (const r of breakdown.data as Array<{ commission_status: string | null; deal_count: number | string; total_value: number | string }>) {
      const deals = Number(r.deal_count ?? 0)
      count += deals
      totalValue += Number(r.total_value ?? 0)
      byStatus[r.commission_status ?? "unknown"] = deals
    }
  } else {
    const { data: rows } = await admin
      .from("sales_reports")
      .select("contract_price, commission_status")
      .eq("agent_id", userId)
      .order("created_at", { ascending: false })
      .limit(AGGREGATE_LIMIT)
    for (const r of (rows ?? []) as Array<{ contract_price: number | null; commission_status: string | null }>) {
      count += 1
      totalValue += Number(r.contract_price ?? 0)
      const k = r.commission_status ?? "unknown"
      byStatus[k] = (byStatus[k] ?? 0) + 1
    }
  }

  const recentRows = (recent ?? []) as unknown as Array<{
    id: string
    contract_price: number | null
    sale_type: string | null
    commission_status: string | null
    validation_status: string | null
    reservation_date: string | null
    created_at: string | null
    projects: { name: string | null } | null
    developers: { name: string | null } | null
  }>

  return {
    count,
    totalValue,
    byStatus,
    recent: recentRows.map((r) => ({
      id: r.id,
      projectName: r.projects?.name ?? null,
      developerName: r.developers?.name ?? null,
      contractPrice: Number(r.contract_price ?? 0),
      saleType: r.sale_type,
      commissionStatus: r.commission_status,
      validationStatus: r.validation_status,
      date: r.reservation_date ?? r.created_at,
    })),
  }
}

async function loadListings(admin: Admin, userId: string): Promise<UserOverview["listings"]> {
  // `count: exact` gives the true total even though we only pull a page of rows.
  const { data, error, count } = await admin
    .from("agent_listings")
    .select("id, title, status, price, currency, listing_kind, updated_at", { count: "exact" })
    .eq("agent_id", userId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(AGGREGATE_LIMIT)

  if (error || !data) return { count: 0, byStatus: {}, recent: [] }

  const rows = data as unknown as Array<{
    id: string
    title: string | null
    status: string | null
    price: number | null
    currency: string | null
    listing_kind: string | null
    updated_at: string | null
  }>

  const byStatus: Record<string, number> = {}
  for (const r of rows) {
    const k = r.status ?? "unknown"
    byStatus[k] = (byStatus[k] ?? 0) + 1
  }

  return {
    count: count ?? rows.length,
    byStatus,
    recent: rows.slice(0, RECENT_LIMIT).map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      price: r.price == null ? null : Number(r.price),
      currency: r.currency,
      listingKind: r.listing_kind,
      updatedAt: r.updated_at,
    })),
  }
}

async function headCount(admin: Admin, table: string, column: string, userId: string): Promise<number> {
  const { count, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, userId)
  return error ? 0 : (count ?? 0)
}

/** True number of accounts this user referred (the list itself is capped). */
async function recruitsTotal(admin: Admin, userId: string): Promise<number> {
  const { count, error } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("metadata->>invited_by", userId)
    // Exclude developer-invite registrations (tracked by developer_invite_id).
    .is("metadata->>developer_invite_id", null)
    .not("is_deleted", "is", true)
  return error ? 0 : (count ?? 0)
}

/** True number of active members in the team (the list itself is capped). */
async function teammatesTotal(admin: Admin, teamId: string | null, userId: string): Promise<number> {
  if (!teamId) return 0
  const { count, error } = await admin
    .from("team_memberships")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .eq("is_active", true)
    .neq("user_id", userId)
  return error ? 0 : (count ?? 0)
}

/* ── handler ─────────────────────────────────────────────────────────────── */

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const { id } = await ctx.params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 })
  }

  const admin = createAdminSupabase()

  // Team membership gates the teammate queries, so chain those off it rather
  // than awaiting it up front — everything else starts immediately.
  const teamsPromise = loadTeams(admin, id)
  const teammatesPromise = teamsPromise.then((t) => loadTeammates(admin, t.activeTeamId, id))
  const teammatesTotalPromise = teamsPromise.then((t) => teammatesTotal(admin, t.activeTeamId, id))

  const [
    { teams },
    authUser,
    teammates,
    teamTotal,
    recruits,
    recruitTotal,
    upline,
    invites,
    sales,
    listings,
    reported,
    assigned,
    activity,
  ] = await Promise.all([
    teamsPromise,
    admin.auth.admin.getUserById(id).catch(() => null),
    teammatesPromise,
    teammatesTotalPromise,
    loadRecruits(admin, id),
    recruitsTotal(admin, id),
    loadUpline(admin, id),
    loadInvites(admin, id),
    loadSales(admin, id),
    loadListings(admin, id),
    headCount(admin, "support_tickets", "reported_by", id),
    headCount(admin, "support_tickets", "assigned_to", id),
    // `estimated` uses the planner for big tables and an exact count for small
    // ones — audit_logs has no index on (actor_id, subject_id), and an exact
    // COUNT there would gate every Account 360 open on a sequential scan.
    admin
      .from("audit_logs")
      .select("id", { count: "estimated", head: true })
      .or(`actor_id.eq.${id},subject_id.eq.${id}`),
  ])

  // Roll up production for everyone around this account in one query, then
  // attach it to each person so the UI can show per-member and group totals.
  const memberIds = Array.from(new Set([...teammates.map((p) => p.id), ...recruits.map((p) => p.id)]))
  const byAgent = await loadSalesByAgent(admin, memberIds)
  for (const p of [...teammates, ...recruits]) {
    const totals = byAgent.get(p.id)
    p.salesCount = totals?.count ?? 0
    p.salesValue = totals?.value ?? 0
  }

  // Combined counts each person once (a recruit can also be a teammate) and
  // includes this account's own production.
  const combined = memberIds.reduce<SalesTotals>(
    (acc, memberId) => {
      const t = byAgent.get(memberId)
      return { count: acc.count + (t?.count ?? 0), value: acc.value + (t?.value ?? 0) }
    },
    { count: sales.count, value: sales.totalValue },
  )

  const payload: UserOverview = {
    email: authUser?.data?.user?.email ?? null,
    lastSignInAt: authUser?.data?.user?.last_sign_in_at ?? null,
    teams,
    teammates,
    teammatesTotal: Math.max(teamTotal, teammates.length),
    recruits,
    recruitsTotal: Math.max(recruitTotal, recruits.length),
    upline,
    groupSales: {
      team: sumTotals(teammates),
      recruits: sumTotals(recruits),
      combined,
    },
    invites,
    sales,
    listings,
    support: { reported, assigned },
    activityTotal: activity.error ? 0 : (activity.count ?? 0),
  }

  return NextResponse.json(payload)
}
