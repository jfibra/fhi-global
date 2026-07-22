import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

// Revoke/reactivate/edit (PATCH) or soft-delete (DELETE) a developer invite link.

export const runtime = "nodejs"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const { id } = await params
  const body = (await req.json().catch(() => null)) as {
    isActive?: unknown
    label?: unknown
    autoActivate?: unknown
  } | null

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body?.isActive === "boolean") update.is_active = body.isActive
  if (typeof body?.autoActivate === "boolean") update.auto_activate = body.autoActivate
  if (typeof body?.label === "string") update.label = body.label.trim() || null

  const admin = createAdminSupabase()
  const { error } = await admin.from("developer_invites").update(update).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    category: "developers",
    event: "updated",
    source: "dashboard",
    actor: { id: guard.context.userId, name: guard.context.profile.fullname, role: guard.context.profile.role },
    subjectType: "developer_invites",
    subjectId: id,
    description:
      typeof body?.isActive === "boolean"
        ? `${body.isActive ? "Reactivated" : "Revoked"} developer invite link`
        : "Updated developer invite link",
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const { id } = await params
  const admin = createAdminSupabase()
  const { error } = await admin
    .from("developer_invites")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    category: "developers",
    event: "deleted",
    source: "dashboard",
    actor: { id: guard.context.userId, name: guard.context.profile.fullname, role: guard.context.profile.role },
    subjectType: "developer_invites",
    subjectId: id,
    description: "Deleted developer invite link",
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ ok: true })
}
