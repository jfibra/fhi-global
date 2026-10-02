import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { computeTeamSales } from "@/lib/team-sales-period"

/**
 * A team's sales for any span of time — the admin Teams page's "Team sales"
 * panel (lib/team-sales-period.ts does the counting).
 * GET ?from=YYYY-MM-DD&to=YYYY-MM-DD (to exclusive). Admin staff only.
 */

export const runtime = "nodejs"

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const { id } = await context.params
  const result = await computeTeamSales(createAdminSupabase(), id, req.nextUrl.searchParams.get("from") ?? "", req.nextUrl.searchParams.get("to") ?? "")
  const { status, ...body } = result
  return NextResponse.json(body, { status })
}
