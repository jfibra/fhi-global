import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { assistantUsageReport } from "@/lib/assistant-usage"

/** The agent assistant's usage: who asks what, how much it costs (assistant_usage, migration 079). Admin staff only. */
export async function GET(req: NextRequest) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const days = Number(req.nextUrl.searchParams.get("days")) || 30
  try {
    const report = await assistantUsageReport(createAdminSupabase(), days)
    return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Couldn't load the usage." }, { status: 500 })
  }
}
