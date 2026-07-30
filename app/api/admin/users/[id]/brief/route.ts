import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"

/**
 * Small header card for one account: auth email + profile bits + active team +
 * lifetime sales totals. The full Account-360 payload (./overview) fans out to
 * ~15 queries; callers that only need to caption a person (e.g. the sales
 * drill-in) use this.
 */

export const runtime = "nodejs"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireRole([...ROLES_ADMIN_STAFF])
  if (!session.ok) return session.response

  const { id } = await ctx.params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const [authUser, profile, membership, lifetime, byStatus] = await Promise.all([
    admin.auth.admin.getUserById(id).catch(() => null),
    admin
      .from("profiles")
      .select("fullname, role, profile_url, joined_at")
      .eq("id", id)
      .maybeSingle(),
    admin
      .from("team_memberships")
      .select("teams(name)")
      .eq("user_id", id)
      .eq("is_active", true)
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.rpc("sales_totals_by_agents", { p_agent_ids: [id] }),
    admin.rpc("sales_status_breakdown", { p_agent_id: id }),
  ])

  const teams = membership?.data?.teams as { name: string } | { name: string }[] | null | undefined
  const teamName = Array.isArray(teams) ? teams[0]?.name ?? null : teams?.name ?? null

  const totalsRow = (lifetime?.data as Array<{ deal_count: number; total_value: number }> | null)?.[0]
  const statusRows = (byStatus?.data as Array<{ commission_status: string; deal_count: number }> | null) ?? []
  const statusCount = (status: string) =>
    Number(statusRows.find((r) => r.commission_status === status)?.deal_count ?? 0)

  return NextResponse.json({
    email: authUser?.data?.user?.email ?? null,
    fullname: profile?.data?.fullname ?? null,
    role: profile?.data?.role ?? null,
    profileUrl: profile?.data?.profile_url ?? null,
    joinedAt: profile?.data?.joined_at ?? null,
    teamName,
    sales: {
      deals: Number(totalsRow?.deal_count ?? 0),
      value: Number(totalsRow?.total_value ?? 0),
      pending: statusCount("pending"),
      released: statusCount("released"),
    },
  })
}
