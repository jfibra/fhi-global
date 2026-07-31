import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { canGrantInviteRole, invitableRolesFor, isAdminStaffRole, normalizeAppRole, roleToLabel } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

/**
 * Change a recruit's role WITHOUT approving/activating them — the recruiter-facing
 * counterpart to the admin role edit, scoped to their own recruits. Same guards
 * as the approve route:
 *
 *   • the caller's rank must be able to grant something at all
 *     (INVITE_GRANTABLE_ROLES — team_leader → unit_manager/agent/member,
 *     unit_manager → agent/member, agent and member → member);
 *   • the recruit must have registered through the caller's invite
 *     (metadata.invited_by === caller id) — admin staff bypass this;
 *   • BOTH the recruit's current role and the requested one must sit inside the
 *     caller's grantable set, so a leader can never touch a peer or a senior and
 *     can never grant a rank at or above their own.
 *
 * Only `role` is written; `status`/`is_deleted` are left untouched, so a pending
 * recruit stays pending. Activation is a separate action (the approve route).
 */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response

  const { userId, email, profile } = session.context
  const isAdmin = isAdminStaffRole(profile.role)
  const grantable = invitableRolesFor(profile.role)
  if (grantable.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Named in the message so the UI can show exactly what this caller may set.
  const allowedLabel = grantable.map(roleToLabel).join(", ")

  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { role?: unknown }
  const nextRole = typeof body.role === "string" ? normalizeAppRole(body.role) : ""
  if (!canGrantInviteRole(profile.role, nextRole)) {
    return NextResponse.json({ error: `You can only set: ${allowedLabel}.` }, { status: 400 })
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

  // The recruit's CURRENT rank must also be one the caller could have granted —
  // otherwise a unit manager could demote a team leader who happened to be in
  // their downline.
  const previousRole = normalizeAppRole(target.role)
  if (!canGrantInviteRole(profile.role, previousRole)) {
    return NextResponse.json({ error: `You can only change the role of: ${allowedLabel}.` }, { status: 403 })
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
