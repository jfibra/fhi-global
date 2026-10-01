import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { hasMailerConfig, sendAdminDirectEmail } from "@/lib/mailer"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

/**
 * Answer a /contact message from the inbox. The email goes out from the
 * house mailbox with the admin's name as signer (same mailer as inquiry
 * replies), the reply is recorded in contact_replies (migration 070) and the
 * submission is stamped replied_at. A send failure is recorded as 'failed'
 * and reported honestly — nothing is silently lost. Admin staff only.
 */

export const runtime = "nodejs"

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const { id } = await context.params

  let body: { subject?: unknown; message?: unknown }
  try {
    body = (await req.json()) as { subject?: unknown; message?: unknown }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const subject = String(body.subject ?? "").trim().slice(0, 200)
  const message = String(body.message ?? "").trim().slice(0, 10_000)
  if (!subject || !message) return NextResponse.json({ error: "Subject and message are required." }, { status: 400 })

  if (!hasMailerConfig()) {
    return NextResponse.json({ error: "Email sending is not configured on the server (SMTP settings missing)." }, { status: 503 })
  }

  const admin = createAdminSupabase()
  const { data: submission } = await admin
    .from("contact_submissions")
    .select("id, name, email, subject, status, deleted_at")
    .eq("id", id)
    .maybeSingle<{ id: string; name: string; email: string; subject: string | null; status: string; deleted_at: string | null }>()
  if (!submission || submission.deleted_at) return NextResponse.json({ error: "Message not found." }, { status: 404 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submission.email)) {
    return NextResponse.json({ error: "This message has no valid email address to reply to." }, { status: 422 })
  }

  const senderName = guard.context.profile.fullname ?? guard.context.email ?? null
  let sendError: string | null = null
  try {
    await sendAdminDirectEmail({
      to: submission.email,
      subject,
      message,
      senderName,
      regarding: submission.subject ? `Your message: ${submission.subject}` : "Your message to FHI Global",
    })
  } catch (error) {
    sendError = error instanceof Error ? error.message : String(error)
  }

  const { data: reply, error: insertError } = await admin
    .from("contact_replies")
    .insert({
      submission_id: submission.id,
      to_email: submission.email,
      to_name: submission.name,
      subject,
      body_text: message,
      sent_by: guard.context.userId,
      sent_by_name: senderName,
      status: sendError ? "failed" : "sent",
      error: sendError,
    })
    .select()
    .single()
  if (insertError) {
    return NextResponse.json({ error: sendError ?? `Sent, but failed to record the reply: ${insertError.message}` }, { status: 500 })
  }
  if (sendError) return NextResponse.json({ error: `Failed to send: ${sendError}`, reply }, { status: 502 })

  const now = new Date().toISOString()
  await admin
    .from("contact_submissions")
    .update({ replied_at: now, status: submission.status === "new" ? "read" : submission.status, read_at: now, updated_at: now })
    .eq("id", submission.id)

  await logAuditEvent({
    category: "contact",
    event: "replied",
    source: "dashboard",
    actor: { id: guard.context.userId, name: senderName, role: guard.context.profile.role },
    subjectType: "contact_submissions",
    subjectId: submission.id,
    subjectLabel: submission.name,
    description: `Replied to ${submission.name} — "${subject}"`,
    newValues: { subject, to: submission.email },
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ ok: true, reply })
}
