import "server-only"

import type { createAdminSupabase } from "@/lib/admin-supabase"
import { ROLES_SALES_PIPELINE, roleInList } from "@/lib/app-roles"
import { hasProfilePhoto, isProfileMissingMinimumFields, type AppProfile } from "@/lib/auth"
import type { Bar, Kpi, Share } from "@/lib/company-report/data"
import { businessDate, fetchAllSales, nameMaps, saleCredits, type SaleRow } from "@/lib/fhi-chat-tools"
import { titleCaseName } from "@/lib/public-profile"
import { REQUIREMENT_HINTS, REQUIREMENT_KEYS, REQUIREMENT_LABELS, REQUIREMENT_NOTE, REQUIREMENT_OWNERS, type Requirement, type RequirementOwner } from "./labels"

/**
 * The Team Performance Report (boss, 2026-11-05): one team, one span of
 * time, everything a team leader needs to double the team's sales — what
 * the team sold, what its NEW agents (joined FHI inside the period) brought
 * against its EXISTING agents, how far each recruit got through the
 * requirements, who sold and who went quiet, and the figures behind a
 * "path to 2×" for the next three months. FHI Assistant's analysis
 * (lib/team-report/insights.ts) and the PDF (lib/team-report/pdf.tsx) are
 * built from this object only, so the chat, the page and the PDF agree.
 *
 * Counting follows the company rules (CLAUDE.md, lib/team-sales-period.ts):
 * the team is its active members plus its subteams at any depth; validated
 * sales are the headline, pending shown beside them; a shared sale credits
 * each member their share and counts once for the team; a sale's date is its
 * reservation date, else when it was recorded. from / to are YYYY-MM-DD, to
 * exclusive. The caller checks who may see it.
 */

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000
const MONTH_DAYS = 30.4375
const PAGE = 1000
/** How many names each list carries — the on-screen report shows the top few and offers the rest; the PDF slices its own. */
const LIST_CAP = 200

export type Cohort = "new" | "existing"

export { REQUIREMENT_HINTS, REQUIREMENT_LABELS, REQUIREMENT_KEYS, REQUIREMENT_NOTE, REQUIREMENT_OWNERS, type Requirement, type RequirementOwner }

export type CohortStats = {
  members: number
  active: number
  sellingRole: number
  sellers: number
  deals: number
  value: number
  /** 0–1 of the team's validated value. */
  share: number
  perSeller: number
  perMember: number
  pendingDeals: number
  pendingValue: number
}

export type MemberRow = {
  id: string
  name: string
  roleInTeam: string | null
  accountRole: string | null
  status: string
  /** The day the FHI account was created (Dubai). */
  joined: string | null
  cohort: Cohort
  subteam: string | null
  photo: string | null
  deals: number
  value: number
  pendingDeals: number
  pendingValue: number
  lastValidated: string | null
  firstRecorded: string | null
  ready: boolean
  missing: Requirement[]
  /**
   * Who invited them (metadata.invited_by). Only this person — or an admin — can press Approve on their
   * Invite page and set their role, so a leader reads it as "who has to act". null = signed up without a link.
   */
  invitedBy: { id: string; name: string; photo: string | null; onTeam: boolean } | null
}

/** One recruiter and how their recruits of the period stand — the table a leader acts on. */
export type RecruiterRow = {
  /** The recruiter's profile id, or "direct" for sign-ups without an invite link. */
  id: string
  name: string
  photo: string | null
  /** False for an inviter outside the team (an admin, the CEO's account) — the team leader cannot press Approve for them. */
  onTeam: boolean
  recruits: number
  ready: number
  notReady: number
  /** Recruits still waiting for the recruiter to press Approve. */
  waitingApproval: number
  /** Recruits whose role is not a selling role (the Team link registers everyone as Member). */
  waitingRole: number
  /** Recruits who still have to finish their profile or add a photo. */
  profileOrPhoto: number
}

export type TeamReportPeriod = {
  from: string
  /** Exclusive. */
  to: string
  prevFrom: string
  days: number
  /** Fractional calendar months in the span. */
  months: number
  /** "September – November 2026" / "1 Sep – 5 Nov 2026" */
  label: string
  /** "the 3 months before" — what the changes compare against. */
  versus: string
}

/**
 * One group of people who could close the gap. `needed` is how many extra deals the gap takes in
 * three months and `share` how much of the group (0–1, above 1 = not enough alone) would have to close
 * one deal to cover it by themselves — plain arithmetic, no assumed conversion rate.
 */
export type Lever = { title: string; people: number; detail: string; needed: number; share: number }

export type TeamReport = {
  team: { id: string; name: string; logoUrl: string | null; description: string | null; createdAt: string; leaders: string[]; subteams: number; subteamNames: string[] }
  period: TeamReportPeriod
  generatedAt: string
  kpis: Kpi[]
  members: { total: number; active: number; pending: number; inactive: number; sellingRole: number; ready: number; byRole: Share[]; byStatus: Share[]; tenureBands: Share[] }
  sales: {
    validated: { deals: number; value: number }
    previous: { deals: number; value: number }
    change: string | null
    pending: { deals: number; value: number }
    rejected: number
    avgDeal: number
    allTime: { deals: number; value: number }
    sharedDeals: number
    byMonth: Bar[]
    /** The same months with their validated deal counts, for the on-screen bars. */
    months: Array<{ label: string; value: number; deals: number }>
    topProjects: Array<{ name: string; developer: string | null; deals: number; value: number }>
    topDevelopers: Array<{ name: string; deals: number; value: number }>
  }
  cohorts: { new: CohortStats; existing: CohortStats; byMonth: Array<{ month: string; newValue: number; existingValue: number }> }
  recruitment: {
    recruited: number
    viaTeamInvite: number
    previous: number
    change: string | null
    byStatus: Share[]
    funnel: Array<{ label: string; value: number; hint: string }>
    missing: Array<{ label: string; value: number }>
    notReady: MemberRow[]
    notReadyTotal: number
    readyNotSelling: MemberRow[]
    readyNotSellingTotal: number
    /** Recruiters with the most recruits waiting on them first (approval + role). */
    recruiters: RecruiterRow[]
    recruitersTotal: number
    /** The recruits' account roles right now — how many are still Member (cannot sell). */
    byAccountRole: Share[]
  }
  activity: { sellers: MemberRow[]; sellersTotal: number; quiet: MemberRow[]; quietTotal: number; neverSold: number }
  targets: {
    /** Where the baseline pace comes from: the span itself, the span before (no validated sale in the span), or neither (first deals are the target). */
    basis: "period" | "previous" | "none"
    monthlyRunRate: number
    dealsPerMonth: number
    baseline3m: number
    target3m: number
    targetMonthly: number
    dealsNeeded3m: number
    dealsNow3m: number
    extraDealsPerMonth: number
    gap3m: number
    /** Extra validated deals the next three months need on top of today's pace (first deals when there is no pace). */
    extraDeals3m: number
    levers: Lever[]
    /** For spans over six months: the pace of the last 90 days, so a long span's average doesn't hide a recent change. */
    last90dRunRate: number | null
  }
}

type Admin = ReturnType<typeof createAdminSupabase>

// ─── Dates ───────────────────────────────────────────────────────────────────

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS)
const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AE", { ...opts, timeZone: "UTC" })
const dubaiDay = (ts: string | null | undefined) => (ts ? new Date(ts).toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" }) : null)

export function pctChange(cur: number, prev: number): string | null {
  if (prev === 0) return cur === 0 ? null : "new"
  const p = Math.round(((cur - prev) / prev) * 100)
  return `${p > 0 ? "+" : ""}${p}%`
}
const toneOf = (change: string | null): Kpi["tone"] => (!change || change === "0%" ? "flat" : change.startsWith("-") ? "down" : "up")
export const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n)))

/** "September – November 2026" for whole months, else "1 Sep – 5 Nov 2026". */
export function teamReportPeriod(from: string, to: string): TeamReportPeriod {
  const days = daysBetween(from, to)
  const last = addDays(to, -1)
  const wholeMonths = from.endsWith("-01") && to.endsWith("-01")
  let label: string
  if (wholeMonths) {
    if (from.slice(0, 7) === last.slice(0, 7)) label = fmt(from, { month: "long", year: "numeric" })
    else if (from.slice(0, 4) === last.slice(0, 4)) label = `${fmt(from, { month: "long" })} – ${fmt(last, { month: "long", year: "numeric" })}`
    else label = `${fmt(from, { month: "short", year: "numeric" })} – ${fmt(last, { month: "short", year: "numeric" })}`
  } else if (from.slice(0, 4) === last.slice(0, 4)) {
    label = `${fmt(from, { day: "numeric", month: "short" })} – ${fmt(last, { day: "numeric", month: "short", year: "numeric" })}`
  } else {
    label = `${fmt(from, { day: "numeric", month: "short", year: "numeric" })} – ${fmt(last, { day: "numeric", month: "short", year: "numeric" })}`
  }
  const months = days / MONTH_DAYS
  const whole = Math.round(months)
  const versus = wholeMonths && Math.abs(months - whole) < 0.15 ? (whole === 1 ? "the month before" : `the ${whole} months before`) : `the ${days} days before`
  return { from, to, prevFrom: addDays(from, -days), days, months, label, versus }
}

// ─── Build ───────────────────────────────────────────────────────────────────

type ProfileRow = AppProfile & { joined_at: string | null }
type Membership = { user_id: string; team_id: string; role_in_team: string | null; joined_at: string | null; profiles: ProfileRow | null }

const isSellingRole = (role: string | null) => roleInList(role, ROLES_SALES_PIPELINE)
const r0 = (n: number) => Math.round(n)

export type BuildResult = { status: 200; report: TeamReport } | { status: 400 | 404 | 500; error: string }

export async function buildTeamReport(admin: Admin, teamId: string, from: string, to: string): Promise<BuildResult> {
  if (!ISO_DAY.test(from) || !ISO_DAY.test(to) || from >= to) return { status: 400, error: "Give from and to as YYYY-MM-DD, from before to." }
  const period = teamReportPeriod(from, to)
  if (period.days > 1100) return { status: 400, error: "Pick a span of three years or less." }
  if (period.days < 7) return { status: 400, error: "Pick a span of at least a week." }

  // The team and its subteams (any depth).
  const { data: allTeams, error: teamsErr } = await admin.from("teams").select("id, name, parent_id, is_active, logo_url, description, created_at").limit(2000)
  if (teamsErr) return { status: 500, error: teamsErr.message }
  const team = (allTeams ?? []).find((t) => t.id === teamId)
  if (!team) return { status: 404, error: "Team not found" }
  const teamIds = new Set<string>([teamId])
  for (let grew = true; grew; ) {
    grew = false
    for (const t of allTeams ?? []) if (t.parent_id && teamIds.has(t.parent_id) && !teamIds.has(t.id)) { teamIds.add(t.id); grew = true }
  }
  const teamName = new Map((allTeams ?? []).map((t) => [t.id, t.name as string]))

  // Active members with the profile fields the requirements need.
  const memberships: Membership[] = []
  for (let page = 0; page < 20; page++) {
    const { data, error } = await admin
      .from("team_memberships")
      .select("user_id, team_id, role_in_team, joined_at, profiles!inner(id, fullname, fname, lname, role, status, profile_url, joined_at, timezone, birthday, gender, metadata, is_deleted)")
      .in("team_id", [...teamIds])
      .is("left_at", null)
      .range(page * PAGE, page * PAGE + PAGE - 1)
    if (error) return { status: 500, error: error.message }
    memberships.push(...((data ?? []) as unknown as Membership[]))
    if (!data || data.length < PAGE) break
  }
  // One row per person (a transfer inside the tree could leave two during the same second), accounts
  // created after the span left out — they weren't on the team then.
  const byUser = new Map<string, Membership>()
  for (const m of memberships) {
    if (!m.profiles || m.profiles.is_deleted === true) continue
    const joined = dubaiDay(m.profiles.joined_at)
    if (joined && joined >= to) continue
    if (!byUser.has(m.user_id)) byUser.set(m.user_id, m)
  }
  const roster = [...byUser.values()]
  const rosterIds = new Set(roster.map((m) => m.user_id))

  // Every sale (cached helper), then the team's part of each.
  let allSales: SaleRow[]
  try {
    allSales = await fetchAllSales(admin)
  } catch (e) {
    return { status: 500, error: e instanceof Error ? e.message : "Couldn't read the sales." }
  }
  const status = (s: SaleRow) => (s.validation_status ?? "pending").toLowerCase()

  type Acc = { deals: number; value: number; pendingDeals: number; pendingValue: number; lastValidated: string | null; firstRecorded: string | null }
  const acc = new Map<string, Acc>()
  const accOf = (id: string) => {
    let a = acc.get(id)
    if (!a) { a = { deals: 0, value: 0, pendingDeals: 0, pendingValue: 0, lastValidated: null, firstRecorded: null }; acc.set(id, a) }
    return a
  }
  const validated = { deals: 0, value: 0 }
  const previous = { deals: 0, value: 0 }
  const pending = { deals: 0, value: 0 }
  const allTime = { deals: 0, value: 0 }
  let rejected = 0
  let sharedDeals = 0
  const last90From = addDays(to, -90)
  let last90Value = 0
  const monthTotals = new Map<string, { value: number; newValue: number; existingValue: number; deals: number }>()
  const projT = new Map<string, { name: string; developer: string | null; deals: number; value: number }>()
  const devT = new Map<string, { deals: number; value: number }>()
  const cohortOf = (m: Membership): Cohort => {
    const j = dubaiDay(m.profiles?.joined_at)
    return j && j >= from ? "new" : "existing"
  }
  const cohortAcc: Record<Cohort, { deals: number; value: number; pendingDeals: number; pendingValue: number; sellers: Set<string> }> = {
    new: { deals: 0, value: 0, pendingDeals: 0, pendingValue: 0, sellers: new Set() },
    existing: { deals: 0, value: 0, pendingDeals: 0, pendingValue: 0, sellers: new Set() },
  }
  const windowSales: SaleRow[] = []

  for (const s of allSales) {
    const credits = saleCredits(s).filter((c) => rosterIds.has(c.agentId))
    if (!credits.length) continue
    const d = businessDate(s)
    if (d >= to) continue
    const st = status(s)
    const teamValue = credits.reduce((a, c) => a + c.value, 0)
    // Activation and "last sale" look at everything up to the end of the span.
    for (const c of credits) {
      const a = accOf(c.agentId)
      if (!a.firstRecorded || d < a.firstRecorded) a.firstRecorded = d
      if (st === "validated" && (!a.lastValidated || d > a.lastValidated)) a.lastValidated = d
    }
    if (st === "validated") { allTime.deals++; allTime.value += teamValue }
    if (d < period.prevFrom) continue
    if (d < from) {
      if (st === "validated") { previous.deals++; previous.value += teamValue }
      continue
    }
    windowSales.push(s)
    const touched = new Set<Cohort>()
    for (const c of credits) {
      const m = byUser.get(c.agentId)!
      const cohort = cohortOf(m)
      const a = accOf(c.agentId)
      if (st === "validated") { a.deals++; a.value += c.value; cohortAcc[cohort].value += c.value; cohortAcc[cohort].sellers.add(c.agentId) }
      else if (st !== "rejected") { a.pendingDeals++; a.pendingValue += c.value; cohortAcc[cohort].pendingValue += c.value }
      touched.add(cohort)
    }
    if (st === "validated") {
      validated.deals++
      validated.value += teamValue
      if (d >= last90From) last90Value += teamValue
      if (saleCredits(s).length > 1) sharedDeals++
      for (const cohort of touched) cohortAcc[cohort].deals++
      const mk = d.slice(0, 7)
      const mt = monthTotals.get(mk) ?? { value: 0, newValue: 0, existingValue: 0, deals: 0 }
      mt.value += teamValue
      mt.deals++
      for (const c of credits) {
        if (cohortOf(byUser.get(c.agentId)!) === "new") mt.newValue += c.value
        else mt.existingValue += c.value
      }
      monthTotals.set(mk, mt)
      const pk = s.project_id ? `p:${s.project_id}` : "secondary"
      const p = projT.get(pk) ?? { name: "", developer: null, deals: 0, value: 0 }
      p.deals++; p.value += teamValue; projT.set(pk, p)
      const dv = devT.get(String(s.developer_id ?? "")) ?? { deals: 0, value: 0 }
      dv.deals++; dv.value += teamValue; devT.set(String(s.developer_id ?? ""), dv)
    } else if (st === "rejected") {
      rejected++
    } else {
      pending.deals++
      pending.value += teamValue
      for (const cohort of touched) cohortAcc[cohort].pendingDeals++
    }
  }

  // Project and developer names for the span's sales.
  const names = await nameMaps(admin, windowSales).catch(() => null)
  const topProjects = [...projT.entries()]
    .map(([key, p]) => {
      const pid = key.startsWith("p:") ? Number(key.slice(2)) : null
      const sale = pid ? windowSales.find((s) => Number(s.project_id) === pid) : null
      return {
        name: pid ? names?.proj.get(pid)?.name ?? "Unknown project" : "Secondary & rental deals",
        developer: sale ? names?.dev.get(String(sale.developer_id))?.name ?? null : null,
        deals: p.deals,
        value: r0(p.value),
      }
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
  const topDevelopers = [...devT.entries()]
    .filter(([id]) => id)
    .map(([id, t]) => ({ name: names?.dev.get(id)?.name ?? "Unknown developer", deals: t.deals, value: r0(t.value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

  // Every month in the span, empty ones included.
  const byMonth: Bar[] = []
  const monthsDetailed: Array<{ label: string; value: number; deals: number }> = []
  const cohortByMonth: TeamReport["cohorts"]["byMonth"] = []
  {
    const cur = new Date(`${from.slice(0, 7)}-01T00:00:00Z`)
    while (cur.toISOString().slice(0, 10) < to && byMonth.length < 40) {
      const key = cur.toISOString().slice(0, 7)
      const v = monthTotals.get(key) ?? { value: 0, newValue: 0, existingValue: 0, deals: 0 }
      const monthLabel = new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-AE", { month: "short", year: "2-digit", timeZone: "UTC" })
      monthsDetailed.push({ label: monthLabel, value: r0(v.value), deals: v.deals })
      byMonth.push({ label: new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-AE", { month: "short", year: "2-digit", timeZone: "UTC" }), value: r0(v.value), inPeriod: true })
      cohortByMonth.push({ month: key, newValue: r0(v.newValue), existingValue: r0(v.existingValue) })
      cur.setUTCMonth(cur.getUTCMonth() + 1)
    }
  }

  // Who invited each member. The roster resolves most; the few inviters outside the team (admins, the
  // CEO's account) come from one small profiles lookup. A failed lookup only costs the name.
  const inviterOf = (m: Membership): string | null => {
    const meta = (m.profiles?.metadata ?? {}) as Record<string, unknown>
    return typeof meta.invited_by === "string" && meta.invited_by && !meta.developer_invite_id ? meta.invited_by : null
  }
  const personName = (p: { fullname?: string | null; fname?: string | null; lname?: string | null }) => titleCaseName(p.fullname ?? [p.fname, p.lname].filter(Boolean).join(" ")) || "Unnamed account"
  const outsideInviters = new Map<string, { name: string; photo: string | null }>()
  {
    const ids = [...new Set(roster.map(inviterOf).filter((id): id is string => !!id && !byUser.has(id)))]
    for (let i = 0; i < ids.length; i += 100) {
      const { data } = await admin.from("profiles").select("id, fullname, fname, lname, profile_url").in("id", ids.slice(i, i + 100))
      for (const o of (data ?? []) as Array<{ id: string; fullname: string | null; fname: string | null; lname: string | null; profile_url: string | null }>) outsideInviters.set(o.id, { name: personName(o), photo: o.profile_url || null })
    }
  }
  const invitedByOf = (m: Membership): MemberRow["invitedBy"] => {
    const id = inviterOf(m)
    if (!id) return null
    const inTeam = byUser.get(id)?.profiles
    if (inTeam) return { id, name: personName(inTeam), photo: inTeam.profile_url || null, onTeam: true }
    const outside = outsideInviters.get(id)
    return { id, name: outside?.name ?? "Unknown account", photo: outside?.photo ?? null, onTeam: false }
  }

  // Members: cohort, requirements, activity.
  const rows: MemberRow[] = roster.map((m) => {
    const p = m.profiles!
    const a = acc.get(m.user_id)
    const st = (p.status ?? "pending").toLowerCase()
    const missing: Requirement[] = []
    if (st !== "active") missing.push("approved")
    if (isProfileMissingMinimumFields(p)) missing.push("profile")
    if (!hasProfilePhoto(p.profile_url)) missing.push("photo")
    if (!isSellingRole(p.role)) missing.push("selling_role")
    return {
      id: m.user_id,
      name: titleCaseName(p.fullname ?? [p.fname, p.lname].filter(Boolean).join(" ")) || "Unnamed account",
      roleInTeam: m.role_in_team,
      accountRole: p.role,
      status: st,
      joined: dubaiDay(p.joined_at),
      cohort: cohortOf(m),
      subteam: m.team_id !== teamId ? teamName.get(m.team_id) ?? null : null,
      photo: p.profile_url || null,
      deals: a?.deals ?? 0,
      value: r0(a?.value ?? 0),
      pendingDeals: a?.pendingDeals ?? 0,
      pendingValue: r0(a?.pendingValue ?? 0),
      lastValidated: a?.lastValidated ?? null,
      firstRecorded: a?.firstRecorded ?? null,
      ready: missing.length === 0,
      missing,
      invitedBy: invitedByOf(m),
    }
  })
  // Leaders of THIS team (a subteam's leader shows under their own team; unit managers are not leaders).
  const leaders = roster
    .filter((m) => m.team_id === teamId && /lead|head/i.test(m.role_in_team ?? ""))
    .map((m) => titleCaseName(m.profiles?.fullname ?? "") || "Unnamed")
  const newRows = rows.filter((r) => r.cohort === "new")
  const existingRows = rows.filter((r) => r.cohort === "existing")

  const cohortStats = (list: MemberRow[], c: Cohort): CohortStats => {
    const a = cohortAcc[c]
    return {
      members: list.length,
      active: list.filter((r) => r.status === "active").length,
      sellingRole: list.filter((r) => isSellingRole(r.accountRole)).length,
      sellers: a.sellers.size,
      deals: a.deals,
      value: r0(a.value),
      share: validated.value ? a.value / validated.value : 0,
      perSeller: a.sellers.size ? r0(a.value / a.sellers.size) : 0,
      perMember: list.length ? r0(a.value / list.length) : 0,
      pendingDeals: a.pendingDeals,
      pendingValue: r0(a.pendingValue),
    }
  }

  // Recruitment and activation (the new cohort). The span before is counted the same way, one row per person.
  const recruitedBefore = (() => {
    const seen = new Set<string>()
    for (const m of memberships) {
      if (!m.profiles || m.profiles.is_deleted === true) continue
      const j = dubaiDay(m.profiles.joined_at)
      if (j && j >= period.prevFrom && j < from) seen.add(m.user_id)
    }
    return seen.size
  })()
  const viaTeamInvite = newRows.filter((r) => {
    const meta = (byUser.get(r.id)?.profiles?.metadata ?? {}) as Record<string, unknown>
    return typeof meta.invited_by === "string" && rosterIds.has(meta.invited_by) && !meta.developer_invite_id
  }).length
  const approved = newRows.filter((r) => r.status === "active").length
  const readyNew = newRows.filter((r) => r.ready).length
  const recordedNew = newRows.filter((r) => r.firstRecorded).length
  const validatedNew = newRows.filter((r) => r.lastValidated).length
  const funnel = [
    { label: "Recruited", value: newRows.length, hint: `joined FHI in ${period.label}` },
    { label: "Approved", value: approved, hint: "the recruiter pressed Approve" },
    { label: "Ready to sell", value: readyNew, hint: "approved, profile and photo done, selling role set" },
    { label: "Recorded a sale", value: recordedNew, hint: "any status" },
    { label: "Validated a sale", value: validatedNew, hint: "counts on the leaderboard" },
  ]
  const missingCounts = REQUIREMENT_KEYS.map((k) => ({ label: REQUIREMENT_LABELS[k], value: newRows.filter((r) => r.missing.includes(k)).length }))
  const byJoinedDesc = (a: MemberRow, b: MemberRow) => (b.joined ?? "").localeCompare(a.joined ?? "") || a.name.localeCompare(b.name)
  const notReady = newRows.filter((r) => !r.ready).sort(byJoinedDesc)
  const readyNotSelling = newRows.filter((r) => r.ready && !r.firstRecorded).sort(byJoinedDesc)

  // Who has recruits waiting: only the direct inviter can press Approve and set the role, so this is the
  // list of people a leader has to nudge. Recruits of the period; sign-ups without a link have no recruiter.
  const byRecruiter = new Map<string, RecruiterRow>()
  for (const r of newRows) {
    const key = r.invitedBy?.id ?? "direct"
    let g = byRecruiter.get(key)
    if (!g) {
      g = { id: key, name: r.invitedBy?.name ?? "No invite link (signed up directly)", photo: r.invitedBy?.photo ?? null, onTeam: r.invitedBy?.onTeam ?? false, recruits: 0, ready: 0, notReady: 0, waitingApproval: 0, waitingRole: 0, profileOrPhoto: 0 }
      byRecruiter.set(key, g)
    }
    g.recruits++
    if (r.ready) g.ready++
    else g.notReady++
    if (r.missing.includes("approved")) g.waitingApproval++
    if (r.missing.includes("selling_role")) g.waitingRole++
    if (r.missing.includes("profile") || r.missing.includes("photo")) g.profileOrPhoto++
  }
  const recruiters = [...byRecruiter.values()].sort((a, b) => b.waitingApproval + b.waitingRole - (a.waitingApproval + a.waitingRole) || b.notReady - a.notReady || a.name.localeCompare(b.name))

  // Who sold, who went quiet.
  const sellers = rows.filter((r) => r.value > 0 || r.deals > 0).sort((a, b) => b.value - a.value || b.deals - a.deals || a.name.localeCompare(b.name))
  const quiet = existingRows
    .filter((r) => r.status === "active" && isSellingRole(r.accountRole) && r.deals === 0)
    .sort((a, b) => (b.lastValidated ?? "").localeCompare(a.lastValidated ?? "") || a.name.localeCompare(b.name))

  // The path to 2×: the next three months at double the span's monthly pace. A span with no
  // validated sale borrows the pace of the span before; with neither, first deals are the target.
  const months = Math.max(period.months, 0.25)
  const basis: TeamReport["targets"]["basis"] = validated.value > 0 ? "period" : previous.value > 0 ? "previous" : "none"
  const baseValue = basis === "period" ? validated.value : basis === "previous" ? previous.value : 0
  const baseDeals = basis === "period" ? validated.deals : basis === "previous" ? previous.deals : 0
  const monthlyRunRate = baseValue / months
  const dealsPerMonth = baseDeals / months
  const avgDeal = validated.deals ? validated.value / validated.deals : previous.deals ? previous.value / previous.deals : allTime.deals ? allTime.value / allTime.deals : 0
  const baseline3m = monthlyRunRate * 3
  const target3m = baseline3m * 2
  const dealsNow3m = Math.round(dealsPerMonth * 3)
  const periodSellers = sellers.filter((r) => r.deals > 0)
  // With no pace to double, the target is a first deal from everyone who is ready and never recorded a sale.
  const readyNeverSold = rows.filter((r) => r.ready && !r.firstRecorded).length
  const dealsNeeded3m = basis === "none" ? Math.max(1, readyNeverSold) : avgDeal ? Math.ceil(target3m / avgDeal) : 0
  const extraDeals3m = Math.max(0, dealsNeeded3m - dealsNow3m)
  const leverOf = (title: string, people: number, detail: string): Lever => ({ title, people, detail, needed: extraDeals3m, share: people ? Math.round((extraDeals3m / people) * 100) / 100 : 0 })
  // Four groups that never overlap (quiet = existing without a deal; the recruit groups have no
  // recorded sale; the sellers sold), so each can be read on its own.
  const notReadyNeverSold = notReady.filter((r) => !r.firstRecorded)
  const levers: Lever[] = [
    leverOf("Wake the quiet sellers", quiet.length, "existing sellers with no validated deal in the period — one deal each in the next three months"),
    leverOf("Activate the ready recruits", readyNotSelling.length, "recruits who finished every requirement but have not recorded a sale — a first deal each"),
    leverOf("Finish the recruits' requirements", notReadyNeverSold.length, "recruits still missing a requirement and yet to record a sale — ready, then a first deal each"),
    leverOf("One more deal from every seller", periodSellers.length, "everyone who sold in the period closes one extra deal"),
  ].filter((l) => l.people > 0)
  const gap3m = target3m - baseline3m

  // How long each member has been with FHI at the end of the span.
  const tenureBands: Share[] = (() => {
    const labels = ["Under 3 months", "3–6 months", "6–12 months", "Over 12 months"]
    const counts = [0, 0, 0, 0]
    for (const r of rows) {
      const m = r.joined ? daysBetween(r.joined, to) / MONTH_DAYS : Number.POSITIVE_INFINITY
      counts[m < 3 ? 0 : m < 6 ? 1 : m < 12 ? 2 : 3]++
    }
    return labels.map((label, i) => ({ label, value: counts[i] }))
  })()

  const change = pctChange(validated.value, previous.value)
  const activeMembers = rows.filter((r) => r.status === "active").length
  // With only a handful of deals a percentage misleads ("+50%" for 2 → 3), so say the difference in deals.
  const dealsChange = (cur: number, prev: number): string | null => {
    if (cur >= 5 && prev >= 5) return pctChange(cur, prev)
    const d = cur - prev
    return d === 0 ? null : `${d > 0 ? "+" : "-"}${Math.abs(d)} deal${Math.abs(d) === 1 ? "" : "s"}`
  }
  const kpi = (label: string, value: string, chg: string | null, hint: string | null): Kpi => ({ label, value, change: chg, tone: toneOf(chg), hint })
  const newShare = validated.value ? Math.round((cohortAcc.new.value / validated.value) * 100) : 0
  const kpis: Kpi[] = [
    kpi("Validated sales", `AED ${short(validated.value)}`, change, previous.value ? `vs AED ${short(previous.value)} ${period.versus}` : `nothing ${period.versus}`),
    kpi("Validated deals", String(validated.deals), dealsChange(validated.deals, previous.deals), `avg deal AED ${short(avgDeal)}`),
    kpi("Members who sold", `${periodSellers.length} of ${activeMembers}`, null, "active members with a validated deal"),
    kpi("New recruits", String(newRows.length), pctChange(newRows.length, recruitedBefore), `vs ${recruitedBefore} ${period.versus}`),
    kpi("Ready to sell", `${readyNew} of ${newRows.length}`, null, "recruits who finished every requirement"),
    kpi("New-agent share", `${newShare}%`, null, `AED ${short(cohortAcc.new.value)} of the validated value`),
  ]

  const tally = (list: MemberRow[], pick: (r: MemberRow) => string): Share[] => {
    const m = new Map<string, number>()
    for (const r of list) m.set(pick(r), (m.get(pick(r)) ?? 0) + 1)
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  }
  const roleLabel = (r: string | null) => (r ?? "member").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

  const report: TeamReport = {
    team: {
      id: team.id,
      name: team.name,
      logoUrl: (team.logo_url as string | null) || null,
      description: (team.description as string | null) || null,
      createdAt: String(team.created_at),
      leaders,
      subteams: teamIds.size - 1,
      subteamNames: [...teamIds].filter((id) => id !== teamId).map((id) => teamName.get(id) ?? id),
    },
    period,
    generatedAt: new Date().toLocaleString("en-AE", { timeZone: "Asia/Dubai", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    kpis,
    members: {
      total: rows.length,
      active: activeMembers,
      pending: rows.filter((r) => r.status === "pending").length,
      inactive: rows.filter((r) => r.status !== "active" && r.status !== "pending").length,
      sellingRole: rows.filter((r) => isSellingRole(r.accountRole)).length,
      ready: rows.filter((r) => r.ready).length,
      byRole: tally(rows, (r) => roleLabel(r.accountRole)),
      byStatus: tally(rows, (r) => roleLabel(r.status)),
      tenureBands,
    },
    sales: {
      validated: { deals: validated.deals, value: r0(validated.value) },
      previous: { deals: previous.deals, value: r0(previous.value) },
      change,
      pending: { deals: pending.deals, value: r0(pending.value) },
      rejected,
      avgDeal: r0(avgDeal),
      allTime: { deals: allTime.deals, value: r0(allTime.value) },
      sharedDeals,
      byMonth,
      months: monthsDetailed,
      topProjects,
      topDevelopers,
    },
    cohorts: { new: cohortStats(newRows, "new"), existing: cohortStats(existingRows, "existing"), byMonth: cohortByMonth },
    recruitment: {
      recruited: newRows.length,
      viaTeamInvite,
      previous: recruitedBefore,
      change: pctChange(newRows.length, recruitedBefore),
      byStatus: tally(newRows, (r) => roleLabel(r.status)),
      funnel,
      missing: missingCounts,
      notReady: notReady.slice(0, LIST_CAP),
      notReadyTotal: notReady.length,
      readyNotSelling: readyNotSelling.slice(0, LIST_CAP),
      readyNotSellingTotal: readyNotSelling.length,
      recruiters: recruiters.slice(0, 60),
      recruitersTotal: recruiters.length,
      byAccountRole: tally(newRows, (r) => roleLabel(r.accountRole)),
    },
    activity: {
      sellers: sellers.slice(0, LIST_CAP),
      sellersTotal: periodSellers.length,
      quiet: quiet.slice(0, LIST_CAP),
      quietTotal: quiet.length,
      neverSold: quiet.filter((r) => !r.lastValidated).length,
    },
    targets: {
      basis,
      monthlyRunRate: r0(monthlyRunRate),
      dealsPerMonth: Math.round(dealsPerMonth * 10) / 10,
      baseline3m: r0(baseline3m),
      target3m: r0(target3m),
      targetMonthly: r0(target3m / 3),
      dealsNeeded3m,
      dealsNow3m,
      extraDealsPerMonth: Math.round((extraDeals3m / 3) * 10) / 10,
      gap3m: r0(gap3m),
      extraDeals3m,
      levers,
      last90dRunRate: period.days > 183 ? r0(last90Value / (90 / MONTH_DAYS)) : null,
    },
  }
  return { status: 200, report }
}
