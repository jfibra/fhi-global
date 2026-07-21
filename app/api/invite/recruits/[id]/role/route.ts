import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { isAdminStaffRole, normalizeAppRole } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

/**
 * Change a recruit's role WITHOUT approving/activating them — the team-leader /
 * unit-manager counterpart to the admin role edit, scoped to their own
 * recruits. Same guards as the approve route:
 *
 *   • caller must be team_leader / unit_manager (admin staff may also use it);
 *   • the recruit must have registered through the caller's invite
 *     (metadata.invited_by === caller id) — admin staff bypass this;
 *   • both the current and the new role must be `member` or `agent`.
 *
 * Only `role` is written; `status`/`is_deleted` are left untouched, so a pending
 * recruit stays pending. Activation is a separate action (the approve route).
 */

const EDITABLE_ROLES = new Set(["member", "agent"])

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response

  const { userId, email, profile } = session.context
  const callerRole = normalizeAppRole(profile.role)
  const isAdmin = isAdminStaffRole(profile.role)
  const isLeader = callerRole === "team_leader" || callerRole === "unit_manager"
  if (!isAdmin && !isLeader) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { role?: unknown }
  const nextRole = typeof body.role === "string" ? normalizeAppRole(body.role) : ""
  if (!EDITABLE_ROLES.has(nextRole)) {
    return NextResponse.json({ error: "Role must be member or agent." }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { data: target } = await admin
    .from("profiles")
    .select("id, role, fullname, metadata")
    .eq("id", id)
    .maybeSingle<{ id: string; role: string | null; fullname: string | null; metadata: Record<string, unknown> | null }>()

  if (!target) {
    return NextResponse.json({ error: "Recruit not found." }, { status: 404 })
  }

  const previousRole = normalizeAppRole(target.role)
  if (!EDITABLE_ROLES.has(previousRole)) {
    return NextResponse.json({ error: "You can only change the role of members and agents." }, { status: 403 })
  }

  // Ownership: leaders may only manage their own recruits. Admin staff bypass.
  const invitedBy = typeof target.metadata?.invited_by === "string" ? target.metadata.invited_by : null
  if (!isAdmin && invitedBy !== userId) {
    return NextResponse.json({ error: "This recruit didn't register through your invite." }, { status: 403 })
  }

  if (previousRole === nextRole) {
    return NextResponse.json({ ok: true, role: nextRole })
  }

  const { error } = await admin.from("profiles").update({ role: nextRole }).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    category: "security",
    event: "role_granted",
    source: "dashboard",
    actor: { id: userId, name: profile.fullname ?? email ?? null, role: profile.role },
    subjectType: "profiles",
    subjectId: id,
    subjectLabel: target.fullname ?? null,
    description: `Changed recruit ${target.fullname ?? id} role ${previousRole} → ${nextRole}`,
    oldValues: { role: previousRole },
    newValues: { role: nextRole },
    changedKeys: ["role"],
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ ok: true, role: nextRole })
}
