import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF, ROLES_SALE_AGENT_PROFILES } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"

/**
 * Production leaderboard for a period — powers the Top Seller poster studio.
 *
 * Totals come from the sales_totals_by_agents_period RPC (migration 018) so the
 * sums stay exact past PostgREST's row cap and the agent-id list travels in a
 * POST body rather than a multi-KB GET URL. A sale's business date there is
 * coalesce(reservation_date, created_at::date) and bounds are half-open.
 */

export const runtime = "nodejs"

const TOP_N = 10
const PERIODS = ["month", "quarter", "year", "all"] as const
type Period = (typeof PERIODS)[number]

/** [from, to) for a period, in Dubai's calendar — null = unbounded. */
function periodRange(period: Period, now: Date): { from: string | null; to: string | null } {
  if (period === "all") return { from: null, to: null }
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  if (period === "year") {
    return { from: iso(new Date(Date.UTC(y, 0, 1))), to: iso(new Date(Date.UTC(y + 1, 0, 1))) }
  }
  if (period === "quarter") {
    const qStart = Math.floor(m / 3) * 3
    return { from: iso(new Date(Date.UTC(y, qStart, 1))), to: iso(new Date(Date.UTC(y, qStart + 3, 1))) }
  }
  return { from: iso(new Date(Date.UTC(y, m, 1))), to: iso(new Date(Date.UTC(y, m + 1, 1))) }
}

export async function GET(req: NextRequest) {
  const session = await requireRole([...ROLES_ADMIN_STAFF])
  if (!session.ok) return session.response

  const raw = req.nextUrl.searchParams.get("period")
  const period = (PERIODS.find((p) => p === raw) ?? "year") as Period
  const { from, to } = periodRange(period, new Date())

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
    return NextResponse.json({ period, from, to, leaders: [] })
  }

  const { data: totals, error: totalsError } = await admin.rpc("sales_totals_by_agents_period", {
    p_agent_ids: agents.map((a) => String(a.id)),
    p_from: from,
    p_to: to,
  })

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

  const leaders = agents
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
    .sort((a, b) => b.value - a.value || b.deals - a.deals)
    .slice(0, TOP_N)
    .map((a, i) => ({ ...a, rank: i + 1 }))

  return NextResponse.json({ period, from, to, leaders })
}
