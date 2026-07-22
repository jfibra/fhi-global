import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

// Read one submission (auto-marks 'new' → 'read'), change its status, or
// soft-delete/restore it. Service-role + super_admin/admin guard.

export const runtime = "nodejs"

const FULL_COLUMNS =
  "id, name, email, phone, company, subject, message, status, source, ip_address, user_agent, created_at, read_at, updated_at, deleted_at"
const STATUSES = new Set(["new", "read", "archived"])

function actorFrom(ctx: { userId: string; email: string | null; profile: { role: string | null; fullname: string | null } }) {
  return { id: ctx.userId, name: ctx.profile.fullname ?? ctx.email ?? null, role: ctx.profile.role }
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const { id } = await context.params

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("contact_submissions")
    .select(FULL_COLUMNS)
    .eq("id", id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Submission not found." }, { status: 404 })

  // Mark as read on first open (idempotent — only when still 'new').
  if (data.status === "new") {
    const now = new Date().toISOString()
    await admin
      .from("contact_submissions")
      .update({ status: "read", read_at: now, updated_at: now })
      .eq("id", id)
      .eq("status", "new")
    data.status = "read"
    data.read_at = now
  }

  return NextResponse.json({ submission: data })
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const { id } = await context.params

  let body: { status?: string }
  try {
    body = (await req.json()) as { status?: string }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const status = String(body.status ?? "")
  if (!STATUSES.has(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 })

  const admin = createAdminSupabase()
  const { data: existing } = await admin
    .from("contact_submissions")
    .select("id, name, status")
    .eq("id", id)
    .maybeSingle<{ id: string; name: string; status: string }>()
  if (!existing) return NextResponse.json({ error: "Submission not found." }, { status: 404 })

  const now = new Date().toISOString()
  const { error } = await admin
    .from("contact_submissions")
    .update({ status, read_at: status === "read" ? now : null, updated_at: now })
    .eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    category: "contact",
    event: "updated",
    source: "dashboard",
    actor: actorFrom(guard.context),
    subjectType: "contact_submissions",
    subjectId: id,
    subjectLabel: existing.name,
    description: `Marked contact inquiry from ${existing.name} as ${status}`,
    oldValues: { status: existing.status },
    newValues: { status },
    changedKeys: ["status"],
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const { id } = await context.params
  const restore = req.nextUrl.searchParams.get("restore") === "1"

  const admin = createAdminSupabase()
  const { data: existing } = await admin
    .from("contact_submissions")
    .select("id, name")
    .eq("id", id)
    .maybeSingle<{ id: string; name: string }>()
  if (!existing) return NextResponse.json({ error: "Submission not found." }, { status: 404 })

  const now = new Date().toISOString()
  const { error } = await admin
    .from("contact_submissions")
    .update({ deleted_at: restore ? null : now, updated_at: now })
    .eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    category: "contact",
    event: restore ? "restored" : "deleted",
    source: "dashboard",
    actor: actorFrom(guard.context),
    subjectType: "contact_submissions",
    subjectId: id,
    subjectLabel: existing.name,
    description: `${restore ? "Restored" : "Deleted"} contact inquiry from ${existing.name}`,
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ ok: true })
}
