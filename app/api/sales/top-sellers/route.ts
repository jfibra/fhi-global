import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import {
  ROLES_SALES_LEADERBOARD,
  ROLES_SALE_AGENT_PROFILES,
  roleInList,
  ROLES_ADMIN_STAFF,
  ROLES_SECRETARY_LIKE,
} from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"

/**
 * Production leaderboard for a period. Powers the Top Seller poster studio and
 * the Top Sales board on every internal overview.
 *
 * Totals come from the sales_totals_by_agents_period RPC (migration 018) so the
 * sums stay exact past PostgREST's row cap and the agent-id list travels in a
 * POST body rather than a multi-KB GET URL. A sale's business date there is
 * coalesce(reservation_date, created_at::date) and bounds are half-open.
 *
 * Open beyond admins: the board is meant to be seen by agents and members.
 * Developers (external partners) and editors (content only, walled off from
 * sales everywhere else) are not on the list.
 *
 * Only VALIDATED sales count. An agent can insert their own sale at any price
 * with status 'pending' and no approval, so an unfiltered leaderboard could be
 * topped by an invented row on everyone's dashboard — and admin-rejected sales
 * would keep counting.
 *
 * Contract VALUES are omitted for anyone who can't already read every sale.
 * Ranking and deal counts are what make the board motivating; another agent's
 * exact revenue is not theirs to see. This is stripped here rather than hidden
 * in the UI, because the response is readable in devtools either way.
 *
 * Runs on the service-role client, so migration 020's RLS doesn't apply; the
 * role check above is the authorization.
 */

export const runtime = "nodejs"

const TOP_N = 10
/** Period shapes. "month"/"year" are anchored to explicit params, not to now. */
const SCOPES = ["month", "quarter", "year", "all"] as const
type Scope = (typeof SCOPES)[number]

/** Oldest year offered, so a bad ?year= can't scan an absurd range. */
const MIN_YEAR = 2000

/**
 * Half-open [from, to) for the requested period.
 *
 * `year` and `month` are explicit so the board can look back at "March 2025"
 * rather than only the current month — the RPC's own bounds are half-open, so
 * `to` is the first day AFTER the period.
 */
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
  // "period" is the older name the poster studio still sends.
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
  const { data: agentRows, error: agentsError } = await admin
    .from("profiles")
    .select("id, fullname, role, profile_url")
    .in("role", [...ROLES_SALE_AGENT_PROFILES])
    .eq("status", "active")
    .neq("is_deleted", true)

  if (agentsError) {
    console.error("[sales/top-sellers] agents lookup failed:", agentsError.message)
    return NextResponse.json({ error: "Couldn't load agents" }, { status: 500 })
  }

  const agents = agentRows ?? []
  if (agents.length === 0) {
    return NextResponse.json({ scope, year, month, from, to, leaders: [] })
  }

  const agentIds = agents.map((a) => String(a.id))

  // Validated only — see the note at the top of this file.
  let { data: totals, error: totalsError } = await admin.rpc(
    "sales_totals_by_agents_period_status",
    { p_agent_ids: agentIds, p_from: from, p_to: to, p_statuses: ["validated"] },
  )

  // The status-aware function arrives in migration 021. Until that has been
  // applied it simply doesn't exist, and a hard failure here would take the
  // whole dashboard down — so fall back to the unfiltered totals from 018.
  // The board still works; it just counts unvalidated sales until you migrate.
  if (totalsError && /sales_totals_by_agents_period_status/.test(totalsError.message)) {
    console.warn(
      "[sales/top-sellers] migration 021 not applied — falling back to unfiltered totals. Run: npm run db:migrate",
    )
    const fallback = await admin.rpc("sales_totals_by_agents_period", {
      p_agent_ids: agentIds,
      p_from: from,
      p_to: to,
    })
    totals = fallback.data
    totalsError = fallback.error
  }

  if (totalsError) {
    console.error("[sales/top-sellers] totals rpc failed:", totalsError.message)
    return NextResponse.json({ error: "Couldn't total the sales" }, { status: 500 })
  }

  const byAgent = new Map<string, { deals: number; value: number }>()
  for (const row of (totals ?? []) as Array<{ agent_id: string; deal_count: number; total_value: number }>) {
    byAgent.set(String(row.agent_id), {
      deals: Number(row.deal_count ?? 0),
      value: Number(row.total_value ?? 0),
    })
  }

  // Whoever already reads every sale in Sales Reports loses nothing by seeing
  // the totals here; everyone else gets rank and deal count only.
  const callerRole = session.context.profile.role
  const showValues =
    roleInList(callerRole, ROLES_ADMIN_STAFF) || roleInList(callerRole, ROLES_SECRETARY_LIKE)

  const ranked = agents
    .map((a) => {
      const t = byAgent.get(String(a.id)) ?? { deals: 0, value: 0 }
      return {
        id: String(a.id),
        name: typeof a.fullname === "string" ? a.fullname : null,
        role: typeof a.role === "string" ? a.role : null,
        profileUrl: typeof a.profile_url === "string" ? a.profile_url : null,
        deals: t.deals,
        value: t.value,
      }
    })
    .filter((a) => a.deals > 0)
    // Value first, deal count as the tie-break — matches the Team Sales board.
    // The order still reflects value even when the number itself is withheld.
    .sort((a, b) => b.value - a.value || b.deals - a.deals)
    .slice(0, TOP_N)
    .map((a, i) => ({ ...a, rank: i + 1 }))

  // Drop the field entirely rather than zeroing it, so the client can tell
  // "not allowed to see" from "no sales".
  const leaders = showValues
    ? ranked
    : ranked.map((r) => {
        const withheld: Omit<typeof r, "value"> & { value?: number } = { ...r }
        delete withheld.value
        return withheld
      })

  return NextResponse.json({ scope, year, month, showValues, from, to, leaders })
}
