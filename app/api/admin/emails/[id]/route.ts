import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

// Permanently delete a sent-email record from the Emails page. The message
// itself was already delivered — this removes only the dashboard record (and
// with it the copy shown on a lead's thread). Every send is still in the
// audit trail (category "mailer"), so nothing disappears forensically.

export const runtime = "nodejs"

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const { id } = await context.params

  const admin = createAdminSupabase()
  const { data: existing } = await admin
    .from("inquiry_emails")
    .select("id, to_email, subject")
    .eq("id", id)
    .maybeSingle<{ id: string; to_email: string; subject: string }>()
  if (!existing) return NextResponse.json({ error: "Email not found." }, { status: 404 })

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
