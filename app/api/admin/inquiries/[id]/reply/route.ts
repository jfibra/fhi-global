import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { hasMailerConfig, sendAdminDirectEmail } from "@/lib/mailer"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

// Send a real email reply to a lead from the admin Emails page. The send goes
// through SMTP (lib/mailer.ts); the message is recorded in inquiry_emails so
// the thread persists — failed sends too, so they're visible in the thread
// instead of vanishing. A successful reply also advances a 'new' lead to
// 'contacted', because replying IS contacting.

export const runtime = "nodejs"

const MAX_SUBJECT = 200
const MAX_MESSAGE = 10_000

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const { id } = await context.params

  let body: { subject?: string; message?: string }
  try {
    body = (await req.json()) as { subject?: string; message?: string }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const subject = String(body.subject ?? "").trim()
  const message = String(body.message ?? "").trim()
  if (!subject || !message) {
    return NextResponse.json({ error: "Subject and message are required." }, { status: 400 })
  }
  if (subject.length > MAX_SUBJECT || message.length > MAX_MESSAGE) {
    return NextResponse.json({ error: "Subject or message is too long." }, { status: 400 })
  }
  if (!hasMailerConfig()) {
    return NextResponse.json(
      { error: "Email sending is not configured on the server (SMTP settings missing)." },
      { status: 503 },
    )
  }

  const admin = createAdminSupabase()
  // select("*") rather than naming read_at, so this still works before
  // migration 031 is applied (read_at is simply undefined then).
  const { data: lead } = await admin
    .from("inquiries")
    .select("*")
    .eq("id", id)
    .maybeSingle<{
      id: string
      name: string
      email: string
      project_name: string | null
      developer_name: string | null
      status: string
      contacted_at: string | null
      read_at: string | null
    }>()
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 })

  const senderName = guard.context.profile.fullname ?? guard.context.email ?? null
  const regarding = lead.project_name
    ? `${lead.project_name}${lead.developer_name ? ` · ${lead.developer_name}` : ""}`
    : null

  let sendError: string | null = null
  try {
    await sendAdminDirectEmail({ to: lead.email, subject, message, senderName, regarding })
  } catch (error) {
    sendError = error instanceof Error ? error.message : String(error)
  }

  const { data: emailRow, error: insertError } = await admin
    .from("inquiry_emails")
    .insert({
      inquiry_id: lead.id,
      to_email: lead.email,
      to_name: lead.name,
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
    // The email may already be out — surface the record failure honestly.
    return NextResponse.json(
      { error: sendError ?? `Sent, but failed to record the message: ${insertError.message}` },
      { status: 500 },
    )
  }

  if (sendError) {
    return NextResponse.json({ error: `Failed to send: ${sendError}`, email: emailRow }, { status: 502 })
  }

  const now = new Date().toISOString()
  const { error: stampError } = await admin
    .from("inquiries")
    .update({
      status: lead.status === "new" ? "contacted" : lead.status,
      contacted_at: lead.contacted_at ?? now,
      read_at: lead.read_at ?? now,
      updated_at: now,
    })
    .eq("id", lead.id)
  // Pre-migration-031 the read_at column doesn't exist — retry without it so
  // the contacted stamp still lands. The email is already out either way.
  // (42703 = missing column in a filter; PGRST204 = missing in the payload.)
  if (stampError?.code === "42703" || stampError?.code === "PGRST204") {
    await admin
      .from("inquiries")
      .update({
        status: lead.status === "new" ? "contacted" : lead.status,
        contacted_at: lead.contacted_at ?? now,
        updated_at: now,
      })
      .eq("id", lead.id)
  }

  await logAuditEvent({
    category: "inquiry",
    event: "replied",
    source: "dashboard",
    actor: { id: guard.context.userId, name: senderName, role: guard.context.profile.role },
    subjectType: "inquiries",
    subjectId: lead.id,
    subjectLabel: lead.name,
    description: `Replied to ${lead.name} — "${subject}"`,
    newValues: { subject, to: lead.email },
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ ok: true, email: emailRow })
}
