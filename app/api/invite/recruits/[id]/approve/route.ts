import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { canGrantInviteRole, invitableRolesFor, isAdminStaffRole, normalizeAppRole, roleToLabel } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { sendWelcomeEmail } from "@/lib/welcome-email"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

/**
 * Approve (activate) a recruit — a recruiter-facing version of the admin
 * activation. Deliberately narrow:
 *
 *   • the caller's rank must be able to grant something at all
 *     (INVITE_GRANTABLE_ROLES in app-roles.ts). Admin staff may also use it,
 *     though they have the full admin route too;
 *   • the target must have registered through the caller's invite link
 *     (profiles.metadata->>invited_by === caller id) — admin staff bypass this;
 *   • the target's current role must sit inside the caller's grantable set, and
 *     the caller may set which rank the approved account becomes (body
 *     `{ role }`) from that same set. Registration defaults everyone to `member`
 *     (app/api/register/route.ts), so a member's referral is already a member and
 *     approving it without a `role` simply keeps it there.
 *
 * Activation writes the same fields the admin route does
 * (app/api/admin/users/[id]/route.ts): status='active' + clear the soft-delete
 * flags. `isInactiveProfile` (status !== 'active' || is_deleted) is the login
 * gate, so this is exactly what makes the account usable.
 */

export async function POST(
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

  const allowedLabel = grantable.map(roleToLabel).join(", ")

  const { id } = await params

  // Optional role to set on approval — restricted to the caller's own ladder.
  const body = (await req.json().catch(() => ({}))) as { role?: unknown }
  const requestedRole = typeof body.role === "string" ? normalizeAppRole(body.role) : null
  if (requestedRole && !canGrantInviteRole(profile.role, requestedRole)) {
    return NextResponse.json({ error: `You can only approve as: ${allowedLabel}.` }, { status: 400 })
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

  // Only ranks below the caller's own can be approved through this route.
  if (!canGrantInviteRole(profile.role, target.role)) {
    return NextResponse.json(
      { error: `You can only approve: ${allowedLabel}.` },
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

  // Welcome email — sent from the approver's own @fhiglobal.ae mailbox when
  // they have one (the personal Emails accounts), the company address
  // otherwise. The account is already active either way: a mail hiccup is
  // reported via `welcomeSent`, never as an approval failure.
  const welcomeSent = await sendWelcomeEmail({
    targetId: id,
    targetName: target.fullname,
    approver: { id: userId, name: profile.fullname ?? email ?? null, mailbox: profile.mailbox_address },
    personalTeam: true,
  })

  return NextResponse.json({ ok: true, role: finalRole, welcomeSent })
}
