import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

// Read one lead, change its status, or soft-delete/restore it. Unlike the
// contact inbox there is NO auto-advance on open — "contacted" means an admin
// actually reached out, so status only changes via an explicit PATCH.
// Service-role + super_admin/admin guard.

export const runtime = "nodejs"

const FULL_COLUMNS =
  "id, name, email, phone_country_code, phone, looking_for, property_category, project_id, project_name, developer_name, status, source, ip_address, user_agent, created_at, contacted_at, read_at, updated_at, deleted_at"
const EMAIL_COLUMNS =
  "id, inquiry_id, to_email, to_name, subject, body_text, sent_by, sent_by_name, status, error, created_at"
const STATUSES = new Set(["new", "contacted", "closed"])

function actorFrom(ctx: { userId: string; email: string | null; profile: { role: string | null; fullname: string | null } }) {
  return { id: ctx.userId, name: ctx.profile.fullname ?? ctx.email ?? null, role: ctx.profile.role }
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const { id } = await context.params

  const admin = createAdminSupabase()
  let result = await admin.from("inquiries").select(FULL_COLUMNS).eq("id", id).maybeSingle()
  // 42703 = read_at doesn't exist yet (migration 031 not applied).
  if (result.error?.code === "42703") {
    result = await admin
      .from("inquiries")
      .select(FULL_COLUMNS.replace(", read_at", ""))
      .eq("id", id)
      .maybeSingle()
  }
  const { data, error } = result

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Lead not found." }, { status: 404 })

  // The Emails page shows the lead as a conversation — include every email
  // sent from the dashboard on this thread, oldest first.
  const { data: emails } = await admin
    .from("inquiry_emails")
    .select(EMAIL_COLUMNS)
    .eq("inquiry_id", id)
    .order("created_at", { ascending: true })

  return NextResponse.json({ inquiry: data, emails: emails ?? [] })
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const { id } = await context.params

  let body: { status?: string; read?: boolean }
  try {
    body = (await req.json()) as { status?: string; read?: boolean }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const admin = createAdminSupabase()

  // Read/unread is inbox state, not a business event — no status change, no
  // audit row. Opening an email fires this on every click.
  if (typeof body.read === "boolean" && body.status === undefined) {
    const { error } = await admin
      .from("inquiries")
      .update({ read_at: body.read ? new Date().toISOString() : null })
      .eq("id", id)
    // 42703: migration 031 not applied — read state is a no-op until then.
    if (error && error.code !== "42703") {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  const status = String(body.status ?? "")
  if (!STATUSES.has(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 })
  const { data: existing } = await admin
    .from("inquiries")
    .select("id, name, status, contacted_at")
    .eq("id", id)
    .maybeSingle<{ id: string; name: string; status: string; contacted_at: string | null }>()
  if (!existing) return NextResponse.json({ error: "Lead not found." }, { status: 404 })

  const now = new Date().toISOString()
  const { error } = await admin
    .from("inquiries")
    .update({
      status,
      // Stamp first contact; keep the original stamp on later transitions.
      contacted_at: status === "new" ? null : existing.contacted_at ?? (status === "contacted" ? now : existing.contacted_at),
      updated_at: now,
    })
    .eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    category: "inquiry",
    event: "updated",
    source: "dashboard",
    actor: actorFrom(guard.context),
    subjectType: "inquiries",
    subjectId: id,
    subjectLabel: existing.name,
    description: `Marked lead from ${existing.name} as ${status}`,
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
    .from("inquiries")
    .select("id, name")
    .eq("id", id)
    .maybeSingle<{ id: string; name: string }>()
  if (!existing) return NextResponse.json({ error: "Lead not found." }, { status: 404 })

  const now = new Date().toISOString()
  const { error } = await admin
    .from("inquiries")
    .update({ deleted_at: restore ? null : now, updated_at: now })
    .eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    category: "inquiry",
    event: restore ? "restored" : "deleted",
    source: "dashboard",
    actor: actorFrom(guard.context),
    subjectType: "inquiries",
    subjectId: id,
    subjectLabel: existing.name,
    description: `${restore ? "Restored" : "Archived"} lead from ${existing.name}`,
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ ok: true })
}
