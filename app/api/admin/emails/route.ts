import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { hasMailerConfig, sendAdminDirectEmail } from "@/lib/mailer"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

// The admin Emails page's Sent folder (GET) and Compose (POST) — standalone
// emails to any address, not tied to a lead. Sends go through SMTP
// (lib/mailer.ts); every message is recorded in inquiry_emails (inquiry_id
// NULL), failures included. Service-role + super_admin/admin guard.

export const runtime = "nodejs"

const SENT_COLUMNS =
  "id, inquiry_id, to_email, to_name, subject, body_text, sent_by, sent_by_name, status, error, direction, from_email, from_name, created_at"
// Pre-migration-033 shape (no direction/from columns).
const SENT_COLUMNS_LEGACY =
  "id, inquiry_id, to_email, to_name, subject, body_text, sent_by, sent_by_name, status, error, created_at"
const MAX_SUBJECT = 200
const MAX_MESSAGE = 10_000
// Deliberately loose — SMTP is the real validator; this only catches typos.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function GET(req: NextRequest) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const sp = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10))
  const perPage = Math.min(100, Math.max(1, parseInt(sp.get("perPage") ?? "20", 10)))
  const search = (sp.get("search") ?? "").trim()

  const admin = createAdminSupabase()
  const rangeFrom = (page - 1) * perPage

  // The Sent folder lists what WE sent — inbound replies live on the threads.
  const buildQuery = (columns: string, withDirection: boolean) => {
    let query = admin
      .from("inquiry_emails")
      .select(columns, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(rangeFrom, rangeFrom + perPage - 1)
    if (withDirection) query = query.eq("direction", "outbound")
    if (search) {
      const safe = search.replace(/[%,()]/g, " ")
      query = query.or(`to_email.ilike.%${safe}%,to_name.ilike.%${safe}%,subject.ilike.%${safe}%`)
    }
    return query
  }

  const [listResult, unreadResult] = await Promise.all([
    (async () => {
      let r = await buildQuery(SENT_COLUMNS, true)
      // 42703: migration 033 not applied yet — no direction column, all rows are ours.
      if (r.error?.code === "42703") r = await buildQuery(SENT_COLUMNS_LEGACY, false)
      return r
    })(),
    // Unread replies to composed mail, grouped by sender — drives the bold
    // rows and the count badge in the Sent folder. Errors (pre-migration-034)
    // just mean an empty map.
    admin
      .from("inquiry_emails")
      .select("from_email")
      .eq("direction", "inbound")
      .is("inquiry_id", null)
      .is("read_at", null)
      .limit(500),
  ])
  const { data, count, error } = listResult

  const unreadByAddress: Record<string, number> = {}
  if (!unreadResult.error) {
    for (const row of (unreadResult.data ?? []) as Array<{ from_email: string | null }>) {
      const key = (row.from_email ?? "").toLowerCase()
      if (key) unreadByAddress[key] = (unreadByAddress[key] ?? 0) + 1
    }
  }
  if (error) {
    // 42P01 / PGRST205: inquiry_emails doesn't exist yet (migration 031 not
    // applied) — an empty Sent folder, not an error page.
    if (error.code === "42P01" || error.code === "PGRST205") {
      return NextResponse.json({ rows: [], total: 0, page, perPage })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rows: data ?? [], total: count ?? 0, page, perPage, unreadByAddress })
}

export async function POST(req: NextRequest) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  let body: { to?: string; toName?: string; subject?: string; message?: string }
  try {
    body = (await req.json()) as { to?: string; toName?: string; subject?: string; message?: string }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const to = String(body.to ?? "").trim().toLowerCase()
  const toName = String(body.toName ?? "").trim() || null
  const subject = String(body.subject ?? "").trim()
  const message = String(body.message ?? "").trim()

  if (!EMAIL_RE.test(to)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
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

  const senderName = guard.context.profile.fullname ?? guard.context.email ?? null

  let sendError: string | null = null
  try {
    await sendAdminDirectEmail({ to, subject, message, senderName })
  } catch (error) {
    sendError = error instanceof Error ? error.message : String(error)
  }

  const admin = createAdminSupabase()
  const { data: emailRow, error: insertError } = await admin
    .from("inquiry_emails")
    .insert({
      inquiry_id: null,
      to_email: to,
      to_name: toName,
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
    return NextResponse.json(
      { error: sendError ?? `Sent, but failed to record the message: ${insertError.message}` },
      { status: 500 },
    )
  }

  if (sendError) {
    return NextResponse.json({ error: `Failed to send: ${sendError}`, email: emailRow }, { status: 502 })
  }

  await logAuditEvent({
    category: "inquiry",
    event: "composed",
    source: "dashboard",
    actor: { id: guard.context.userId, name: senderName, role: guard.context.profile.role },
    subjectType: "inquiry_emails",
    subjectId: emailRow?.id,
    subjectLabel: to,
    description: `Composed an email to ${to} — "${subject}"`,
    newValues: { subject, to },
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ ok: true, email: emailRow })
}
