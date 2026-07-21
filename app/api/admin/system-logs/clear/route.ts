import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF, isSuperAdminRole } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

// Permanently delete audit logs older than N days. Restricted to super_admin —
// purging the audit trail is the classic cover-tracks vector, so regular admins
// can view but not clear. The purge itself is recorded as a cleared_logs event.

export const runtime = "nodejs"

const ALLOWED_DAYS = new Set([30, 60, 90, 180, 365])

export async function POST(req: NextRequest) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  if (!isSuperAdminRole(guard.context.profile.role)) {
    return NextResponse.json(
      { error: "Only a super admin can clear audit logs." },
      { status: 403 },
    )
  }

  const body = (await req.json().catch(() => null)) as { olderThanDays?: unknown } | null
  const days = Number(body?.olderThanDays)
  if (!ALLOWED_DAYS.has(days)) {
    return NextResponse.json({ error: "Invalid retention period." }, { status: 400 })
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const admin = createAdminSupabase()

  // Count first so the response can report how many were removed.
  const { count } = await admin
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .lt("occurred_at", cutoff)

  const { error } = await admin.from("audit_logs").delete().lt("occurred_at", cutoff)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ctx = requestContextFromRequest(req)
  await logAuditEvent({
    category: "system",
    event: "cleared_logs",
    source: "dashboard",
    actor: {
      id: guard.context.userId,
      name: guard.context.profile.fullname,
      role: guard.context.profile.role,
    },
    description: `Cleared ${count ?? 0} audit log(s) older than ${days} days`,
    newValues: { older_than_days: days, cutoff, deleted: count ?? 0 },
    ...ctx,
  })

  return NextResponse.json({ deleted: count ?? 0, cutoff })
}
