import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF, isDeveloperRole } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { forgetDeveloperPassword, readDeveloperPassword } from "@/lib/developer-login-secrets"

/**
 * Developers Login → Show: the password an admin last set for this developer
 * login (lib/developer-login-secrets.ts), decrypted for the admin who asked.
 * Every view is written to the Activity Logs. POST and no-store so nothing
 * caches it. Admin staff only.
 */

export const runtime = "nodejs"

const NO_STORE = { "Cache-Control": "no-store" }

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const { id } = await context.params
  const admin = createAdminSupabase()

  const { data: target } = await admin
    .from("profiles")
    .select("fullname, username, role")
    .eq("id", id)
    .maybeSingle<{ fullname: string | null; username: string | null; role: string | null }>()
  if (!target || !isDeveloperRole(target.role)) {
    return NextResponse.json({ error: "That isn't a developer login." }, { status: 404, headers: NO_STORE })
  }

  const saved = await readDeveloperPassword(admin, id)
  if (saved.status === "none") {
    return NextResponse.json({ error: "No saved password for this login — set a new one to see it here." }, { status: 404, headers: NO_STORE })
  }
  if (saved.status === "unreadable") {
    return NextResponse.json({ error: "This saved password can't be read any more — set a new one." }, { status: 409, headers: NO_STORE })
  }

  // The developer changed it since (and the copy somehow stayed)? Then it no longer works.
  const { data: changed } = await admin
    .from("audit_logs")
    .select("occurred_at")
    .eq("subject_id", id)
    .eq("category", "security")
    .eq("event", "password_changed")
    .gt("occurred_at", saved.setAt)
    .limit(1)
  if (changed?.length) {
    await forgetDeveloperPassword(admin, id)
    return NextResponse.json({ error: "The developer has changed it since — only they know the new one." }, { status: 409, headers: NO_STORE })
  }

  const label = target.fullname?.replace(/\s+/g, " ").trim() || null
  await logAuditEvent({
    category: "security",
    event: "password_viewed",
    source: "dashboard",
    actor: { id: guard.context.userId, name: guard.context.profile.fullname, role: guard.context.profile.role },
    subjectType: "profiles",
    subjectId: id,
    subjectLabel: label,
    description: `Viewed the saved password for ${target.username ? `@${target.username}` : (label ?? id)}`,
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ password: saved.password, setAt: saved.setAt, setBy: saved.setBy }, { headers: NO_STORE })
}
