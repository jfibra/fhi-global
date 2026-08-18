import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { isAdminStaffRole } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

// Permanently delete a sent-email record from the Emails page. The message
// itself was already delivered — this removes only the dashboard record (and
// with it the copy shown on a lead's thread). Every send is still in the
// audit trail (category "mailer"), so nothing disappears forensically.

export const runtime = "nodejs"

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  const guard = session
  const isAdmin = isAdminStaffRole(session.context.profile.role)
  const ownMailbox = (session.context.profile.mailbox_address ?? "").trim()
  if (!isAdmin && !ownMailbox) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await context.params

  const admin = createAdminSupabase()
  const { data: existing } = await admin
    .from("inquiry_emails")
    .select("id, to_email, from_email, direction, subject, sent_by, owner_id")
    .eq("id", id)
    .maybeSingle<{
      id: string
      to_email: string
      from_email: string | null
      direction: string | null
      subject: string
      sent_by: string | null
      owner_id: string | null
    }>()
  if (!existing) return NextResponse.json({ error: "Email not found." }, { status: 404 })
  // A personal mailbox can clear its own outbox AND its own inbox — received
  // mail carries owner_id, never sent_by, so both checks are needed.
  if (
    !isAdmin &&
    existing.sent_by !== session.context.userId &&
    existing.owner_id !== session.context.userId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const inbound = existing.direction === "inbound"
  const counterpart = (inbound ? existing.from_email : existing.to_email) ?? existing.to_email

  const { error } = await admin.from("inquiry_emails").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    category: "inquiry",
    event: "email_deleted",
    source: "dashboard",
    actor: {
      id: guard.context.userId,
      name: guard.context.profile.fullname ?? guard.context.email ?? null,
      role: guard.context.profile.role,
    },
    subjectType: "inquiry_emails",
    subjectId: id,
    subjectLabel: counterpart,
    description: inbound
      ? `Deleted received email from ${counterpart} — "${existing.subject}"`
      : `Deleted sent email to ${counterpart} — "${existing.subject}"`,
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ ok: true })
}
