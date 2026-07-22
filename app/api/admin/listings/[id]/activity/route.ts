import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"

// Per-listing activity trail: every audit_logs row whose subject is this
// listing (indexed by idx_audit_logs_subject). Admin/super_admin only. Includes
// old/new values so the drawer can render diffs without a second fetch.

export const runtime = "nodejs"

const ACTIVITY_COLUMNS =
  "id, occurred_at, category, event, source, actor_id, actor_name, actor_role, " +
  "subject_type, subject_id, subject_label, description, changed_keys, old_values, new_values, ip_address, user_agent, url"

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const { id } = await context.params

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("audit_logs")
    .select(ACTIVITY_COLUMNS)
    .eq("subject_type", "agent_listings")
    .eq("subject_id", id)
    .order("occurred_at", { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ rows: data ?? [] })
}
