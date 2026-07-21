import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { isAdminStaffRole, normalizeAppRole } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

/**
 * Approve (activate) a recruit — a team-leader / unit-manager-facing version of
 * the admin activation. Deliberately narrow:
 *
 *   • the caller must be a team_leader or unit_manager (admin staff may also use
 *     it, though they have the full admin route too);
 *   • the target must have registered through the caller's invite link
 *     (profiles.metadata->>invited_by === caller id) — admin staff bypass this;
 *   • the target's role must be `member` or `agent`, and the caller may set
 *     which of the two the approved account becomes (body `{ role }`).
 *
 * Activation writes the same fields the admin route does
 * (app/api/admin/users/[id]/route.ts): status='active' + clear the soft-delete
 * flags. `isInactiveProfile` (status !== 'active' || is_deleted) is the login
 * gate, so this is exactly what makes the account usable.
 */

const APPROVABLE_TARGET_ROLES = new Set(["member", "agent"])

export async function POST(
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

  // Optional role to set on approval — restricted to member/agent.
  const body = (await req.json().catch(() => ({}))) as { role?: unknown }
  const requestedRole = typeof body.role === "string" ? normalizeAppRole(body.role) : null
  if (requestedRole && !APPROVABLE_TARGET_ROLES.has(requestedRole)) {
    return NextResponse.json({ error: "Role must be member or agent." }, { status: 400 })
  }

  const admin = createAdminSupabase()

  const { data: target } = await admin
    .from("profiles")
    .select("id, role, status, is_deleted, fullname, metadata")
    .eq("id", id)
    .maybeSingle<{
      id: string
      role: string | null
      status: string | null
      is_deleted: boolean | null
      fullname: string | null
      metadata: Record<string, unknown> | null
    }>()

  if (!target) {
    return NextResponse.json({ error: "Recruit not found." }, { status: 404 })
  }

  // Only members and agents can be approved through this route.
  if (!APPROVABLE_TARGET_ROLES.has(normalizeAppRole(target.role))) {
    return NextResponse.json(
      { error: "You can only approve members and agents here." },
      { status: 403 },
    )
  }

  // Ownership: leaders may only approve their own recruits. Admin staff bypass.
  const invitedBy = typeof target.metadata?.invited_by === "string" ? target.metadata.invited_by : null
  if (!isAdmin && invitedBy !== userId) {
    return NextResponse.json(
      { error: "This recruit didn't register through your invite." },
      { status: 403 },
    )
  }

  // Already usable — no-op (idempotent).
  if (target.status === "active" && target.is_deleted !== true) {
    return NextResponse.json({ ok: true, alreadyActive: true })
  }

  const previousRole = normalizeAppRole(target.role)
  const finalRole = requestedRole ?? previousRole
  const roleChanged = requestedRole !== null && requestedRole !== previousRole

  const { error } = await admin
    .from("profiles")
    .update({
      status: "active",
      is_deleted: false,
      deleted_at: null,
      ...(requestedRole ? { role: requestedRole } : {}),
    })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    category: "user_management",
    event: "activated",
    source: "dashboard",
    actor: { id: userId, name: profile.fullname ?? email ?? null, role: profile.role },
    subjectType: "profiles",
    subjectId: id,
    subjectLabel: target.fullname ?? null,
    description: `Approved recruit ${target.fullname ?? id} as ${finalRole || "member"}`,
    oldValues: { status: target.status ?? null, ...(roleChanged ? { role: previousRole } : {}) },
    newValues: { status: "active", ...(roleChanged ? { role: finalRole } : {}) },
    changedKeys: roleChanged ? ["status", "role"] : ["status"],
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ ok: true, role: finalRole })
}
