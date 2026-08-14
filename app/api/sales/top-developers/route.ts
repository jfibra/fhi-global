import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import {
  ROLES_SALES_LEADERBOARD,
  roleInList,
  ROLES_ADMIN_STAFF,
  ROLES_SECRETARY_LIKE,
} from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"

/**
 * Developer leaderboard for a period — which developers our validated sales
 * were written against. The counterpart of /api/sales/top-sellers, sharing
 * its period semantics (business date = coalesce(reservation_date,
 * created_at::date), half-open bounds) via the
 * sales_totals_by_developers_period RPC from migration 045.
 *
 * Same audience and the same value-withholding rule as the seller board:
 * ranking and deal counts for everyone on the overview; the AED totals only
 * for roles that can already read every sale.
 */

export const runtime = "nodejs"

const TOP_N = 10
const SCOPES = ["month", "quarter", "year", "all"] as const
type Scope = (typeof SCOPES)[number]

const MIN_YEAR = 2000

/** Half-open [from, to) for the requested period — see top-sellers. */
function periodRange(
  scope: Scope,
  year: number,
  month: number | null,
): { from: string | null; to: string | null } {
  if (scope === "all") return { from: null, to: null }
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  if (scope === "year") {
    return { from: iso(new Date(Date.UTC(year, 0, 1))), to: iso(new Date(Date.UTC(year + 1, 0, 1))) }
  }
  if (scope === "quarter") {
    const qStart = Math.floor(((month ?? 1) - 1) / 3) * 3
    return { from: iso(new Date(Date.UTC(year, qStart, 1))), to: iso(new Date(Date.UTC(year, qStart + 3, 1))) }
  }
  const m = (month ?? 1) - 1
  return { from: iso(new Date(Date.UTC(year, m, 1))), to: iso(new Date(Date.UTC(year, m + 1, 1))) }
}

export async function GET(req: NextRequest) {
  const session = await requireRole([...ROLES_SALES_LEADERBOARD])
  if (!session.ok) return session.response

  const params = req.nextUrl.searchParams
  const now = new Date()
  const rawScope = params.get("scope") ?? params.get("period")
  const scope = (SCOPES.find((s) => s === rawScope) ?? "year") as Scope

  const yearParam = Number(params.get("year"))
  const year =
    Number.isInteger(yearParam) && yearParam >= MIN_YEAR && yearParam <= now.getUTCFullYear() + 1
      ? yearParam
      : now.getUTCFullYear()

  const monthParam = Number(params.get("month"))
  const month =
    Number.isInteger(monthParam) && monthParam >= 1 && monthParam <= 12
      ? monthParam
      : now.getUTCMonth() + 1

  const { from, to } = periodRange(scope, year, month)

  const admin = createAdminSupabase()

  // Validated only — an unvalidated row must not move a developer up the board.
  const { data: totals, error: totalsError } = await admin.rpc(
    "sales_totals_by_developers_period",
    { p_from: from, p_to: to, p_statuses: ["validated"] },
  )
  if (totalsError) {
    // Migration 045 not applied yet — an empty board, not a broken overview.
    if (/sales_totals_by_developers_period/.test(totalsError.message)) {
      console.warn("[sales/top-developers] migration 045 not applied. Run: npm run db:migrate")
      return NextResponse.json({ scope, year, month, from, to, showValues: false, leaders: [] })
    }
    console.error("[sales/top-developers] totals rpc failed:", totalsError.message)
    return NextResponse.json({ error: "Couldn't total the sales" }, { status: 500 })
  }

  const rows = (totals ?? []) as Array<{ developer_id: string; deal_count: number; total_value: number }>
  const ranked = rows
    .map((r) => ({
      id: String(r.developer_id),
      deals: Number(r.deal_count ?? 0),
      value: Number(r.total_value ?? 0),
    }))
    .filter((r) => r.deals > 0)
    .sort((a, b) => b.value - a.value || b.deals - a.deals)
    .slice(0, TOP_N)

  // Names/logos for just the ranked ids, plus each one's live portfolio size
  // (the poster's "PROJECTS" figure — published projects on the platform).
  const nameById = new Map<string, { name: string; logoUrl: string | null; slug: string | null }>()
  const projectsById = new Map<string, number>()
  if (ranked.length > 0) {
    const ids = ranked.map((r) => r.id)
    const [{ data: devs, error: devsError }, { data: projRows }] = await Promise.all([
      admin.from("developers").select("id, name, logo_url, slug").in("id", ids),
      admin
        .from("projects")
        .select("developer_id")
        .in("developer_id", ids)
        .eq("is_active", true)
        .eq("is_published", true),
    ])
    if (devsError) {
      console.error("[sales/top-developers] developers lookup failed:", devsError.message)
      return NextResponse.json({ error: "Couldn't load developers" }, { status: 500 })
    }
    for (const d of devs ?? []) {
      nameById.set(String(d.id), {
        name: typeof d.name === "string" ? d.name : "Developer",
        logoUrl: typeof d.logo_url === "string" ? d.logo_url : null,
        slug: typeof d.slug === "string" ? d.slug : null,
      })
    }
    for (const p of (projRows ?? []) as Array<{ developer_id: string | number }>) {
      const key = String(p.developer_id)
      projectsById.set(key, (projectsById.get(key) ?? 0) + 1)
    }
  }

  const callerRole = session.context.profile.role
  const showValues =
    roleInList(callerRole, ROLES_ADMIN_STAFF) || roleInList(callerRole, ROLES_SECRETARY_LIKE)

  const leaders = ranked.map((r, i) => {
    const meta = nameById.get(r.id)
    const base = {
      id: r.id,
      name: meta?.name ?? "Developer",
      logoUrl: meta?.logoUrl ?? null,
      slug: meta?.slug ?? null,
      deals: r.deals,
      projects: projectsById.get(r.id) ?? 0,
      rank: i + 1,
    }
    return showValues ? { ...base, value: r.value } : base
  })

  return NextResponse.json({ scope, year, month, showValues, from, to, leaders })
}
