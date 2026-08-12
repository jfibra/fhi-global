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
    .select("id, to_email, subject, sent_by")
    .eq("id", id)
    .maybeSingle<{ id: string; to_email: string; subject: string; sent_by: string | null }>()
  if (!existing) return NextResponse.json({ error: "Email not found." }, { status: 404 })
  // A personal mailbox can only clear its own outbox.
  if (!isAdmin && existing.sent_by !== session.context.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

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
    subjectLabel: existing.to_email,
    description: `Deleted sent email to ${existing.to_email} — "${existing.subject}"`,
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ ok: true })
}
