import "server-only"

import { createAdminSupabase } from "@/lib/admin-supabase"

/**
 * FHI Chat's toolbox — the predefined, parameterized queries the assistant is
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
  kind: "agent" | "developer" | "project"
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

async function topAgents(admin: Admin, args: { scope?: string; year?: number; month?: number; limit?: number }) {
  const now = new Date()
  const scope = normScope(args.scope)
  const { from, to } = periodRange(scope, args.year ?? now.getUTCFullYear(), args.month ?? now.getUTCMonth() + 1)
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
  const names = await nameMaps(admin, sales)
  const ranked = [...byAgent.entries()]
    .map(([id, t]) => ({ id, deals: t.deals, value: t.value }))
    .sort((a, b) => b.value - a.value || b.deals - a.deals)
    .slice(0, Math.min(args.limit ?? 10, 25))
  return {
    period: { scope, from, to },
    note: "validated sales only",
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
  }
}

async function topDevelopers(admin: Admin, args: { scope?: string; year?: number; month?: number }) {
  const now = new Date()
  const scope = normScope(args.scope)
  const { from, to } = periodRange(scope, args.year ?? now.getUTCFullYear(), args.month ?? now.getUTCMonth() + 1)
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
  }
}

async function topTeams(admin: Admin, args: { scope?: string; year?: number; month?: number }) {
  const now = new Date()
  const scope = normScope(args.scope ?? "all")
  const { from, to } = periodRange(scope, args.year ?? now.getUTCFullYear(), args.month ?? now.getUTCMonth() + 1)
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
  const sales = (await fetchAllSales(admin)).filter((s) => inRange(s, from, to))
  const bucket = (status: string) => {
    const rows = sales.filter((s) => (s.validation_status ?? "pending") === status)
    return { count: rows.length, total: AED(rows.reduce((a, s) => a + Number(s.contract_price ?? 0), 0)) }
  }
  return {
    period: { from: from ?? "beginning", to: to ?? "no upper bound" },
    validated: bucket("validated"),
    pending: bucket("pending"),
    rejected: bucket("rejected"),
    all_statuses_count: sales.length,
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

  return {
    period: { from, to: to || "today" },
    new_accounts_total: rows.length,
    recruited_count: recruited.length,
    organic_count: rows.length - recruited.length,
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

// ─── OpenAI tool definitions + dispatcher ────────────────────────────────────

export const FHI_CHAT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "top_agents",
      description: "Leaderboard of agents by VALIDATED sales value for a period (company Top Sales board).",
      parameters: {
        type: "object",
        properties: {
          scope: { type: "string", enum: ["month", "quarter", "year", "all"], description: "Period shape. Default year." },
          year: { type: "integer" }, month: { type: "integer", description: "1-12, anchors month/quarter" },
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
        "One agent's profile, CONTACT DETAILS (phone, email) and sales record, looked up by (partial) name. Use for any question about a specific person.",
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
export async function runFhiChatTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ forModel: string; cards: FhiChatCard[]; names: string[] }> {
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
      default: return { forModel: JSON.stringify({ error: `Unknown tool ${name}` }), cards: [], names: [] }
    }
    const { _cards, _names, ...rest } = result as { _cards?: FhiChatCard[]; _names?: string[] } & Record<string, unknown>
    return {
      forModel: JSON.stringify(rest),
      cards: Array.isArray(_cards) ? _cards : [],
      names: Array.isArray(_names) ? _names : [],
    }
  } catch (e) {
    return { forModel: JSON.stringify({ error: e instanceof Error ? e.message : "Query failed" }), cards: [], names: [] }
  }
}
