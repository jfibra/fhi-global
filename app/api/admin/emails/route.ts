import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { isAdminStaffRole } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { hasMailerConfig, sendAdminDirectEmail } from "@/lib/mailer"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

// The admin Emails page's Sent folder (GET) and Compose (POST) — standalone
// emails to any address, not tied to a lead. Sends go through SMTP
// (lib/mailer.ts); every message is recorded in inquiry_emails (inquiry_id
// NULL), failures included. Service-role + super_admin/admin guard.

export const runtime = "nodejs"

const SENT_COLUMNS =
  "id, inquiry_id, to_email, to_name, subject, body_text, sent_by, sent_by_name, status, error, direction, from_email, from_name, attachments, created_at"
// Pre-migration-033 shape (no direction/from columns).
const SENT_COLUMNS_LEGACY =
  "id, inquiry_id, to_email, to_name, subject, body_text, sent_by, sent_by_name, status, error, created_at"
const MAX_SUBJECT = 200
const MAX_MESSAGE = 10_000
// Deliberately loose — SMTP is the real validator; this only catches typos.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/


/**
 * Personal-mailbox access model: admin staff manage the whole mailroom and
 * send as the house account; a profile with mailbox_address gets the same
 * screens scoped to their own mail, sent AS their address (SMTP AUTH must
 * match the From mailbox — the provider rejects anything else).
 */
async function resolveMailAccess() {
  const session = await requireActiveSession()
  if (!session.ok) return { response: session.response } as const
  const profile = session.context.profile
  const admin = isAdminStaffRole(profile.role)
  const mailbox = (profile.mailbox_address ?? "").trim().toLowerCase() || null
  if (!admin && !mailbox) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const
  }
  return {
    context: session.context,
    admin,
    mailbox,
    senderName: profile.fullname ?? session.context.email ?? null,
  } as const
}

export async function GET(req: NextRequest) {
  const access = await resolveMailAccess()
  if ("response" in access) return access.response

  const sp = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10))
  const perPage = Math.min(100, Math.max(1, parseInt(sp.get("perPage") ?? "20", 10)))
  const search = (sp.get("search") ?? "").trim()
  const box = sp.get("box") === "inbox" ? "inbox" : "sent"

  const admin = createAdminSupabase()
  const rangeFrom = (page - 1) * perPage

  /**
   * The Inbox: mail that arrived FOR this mailbox. Admin staff read the house
   * mailroom (owner_id NULL); a personal mailbox reads only its own, which is
   * what keeps Michelle's and Maysa's replies private from each other and
   * from the admins.
   */
  if (box === "inbox") {
    const scope = <T extends { is: (c: string, v: null) => T; eq: (c: string, v: string) => T }>(q: T) =>
      access.admin ? q.is("owner_id", null) : q.eq("owner_id", access.context.userId)

    // read_at drives the bold/unread state — without it every row reads as
    // unread forever. Falls back to the pre-migration-034 shape.
    const buildInbox = (columns: string) => {
      let q = admin
        .from("inquiry_emails")
        .select(columns, { count: "exact" })
        .eq("direction", "inbound")
        .order("created_at", { ascending: false })
        .range(rangeFrom, rangeFrom + perPage - 1)
      q = scope(q)
      if (search) {
        const safe = search.replace(/[%,()]/g, " ")
        q = q.or(`from_email.ilike.%${safe}%,from_name.ilike.%${safe}%,subject.ilike.%${safe}%`)
      }
      return q
    }
    const listQuery = (async () => {
      const withRead = await buildInbox(`${SENT_COLUMNS}, read_at`)
      return withRead.error?.code === "42703" ? await buildInbox(SENT_COLUMNS) : withRead
    })()

    let unreadQuery = admin
      .from("inquiry_emails")
      .select("id", { count: "exact", head: true })
      .eq("direction", "inbound")
      .is("read_at", null)
    unreadQuery = scope(unreadQuery)

    const [list, unread] = await Promise.all([listQuery, unreadQuery])
    if (list.error) {
      // Pre-migration environments: an empty inbox, not an error page.
      if (["42P01", "PGRST205", "42703"].includes(list.error.code ?? "")) {
        return NextResponse.json({ rows: [], total: 0, unreadCount: 0, page, perPage })
      }
      return NextResponse.json({ error: list.error.message }, { status: 500 })
    }
    return NextResponse.json({
      rows: list.data ?? [],
      total: list.count ?? 0,
      unreadCount: unread.error ? 0 : unread.count ?? 0,
      page,
      perPage,
    })
  }

  // The Sent folder lists what WE sent — inbound replies live on the threads.
  const buildQuery = (columns: string, withDirection: boolean) => {
    let query = admin
      .from("inquiry_emails")
      .select(columns, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(rangeFrom, rangeFrom + perPage - 1)
    if (withDirection) query = query.eq("direction", "outbound")
    // Personal mailboxes see their own outbox, not the whole mailroom.
    if (!access.admin) query = query.eq("sent_by", access.context.userId)
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
    // rows and the count badge in the Sent folder. Admins read the house
    // mailroom (owner NULL); a personal mailbox reads its own. Errors
    // (pre-migration-034) just mean an empty map.
    (() => {
      let q = admin
        .from("inquiry_emails")
        .select("from_email")
        .eq("direction", "inbound")
        .is("inquiry_id", null)
        .is("read_at", null)
        .limit(500)
      q = access.admin ? q.is("owner_id", null) : q.eq("owner_id", access.context.userId)
      return q
    })(),
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


type AttachmentInput = { name?: unknown; url?: unknown; size?: unknown; type?: unknown }

/**
 * Attachments must be files WE stored: only descriptors pointing under our
 * own email-attachments prefix are accepted, so the send can't be used to
 * exfiltrate arbitrary URLs into people's inboxes under our name.
 */
function sanitizeAttachments(raw: unknown): Array<{ name: string; url: string; size: number; type: string }> | null {
  if (raw == null) return []
  if (!Array.isArray(raw) || raw.length > 5) return null
  const base = (process.env.S3_PUBLIC_URL ?? "").replace(/[/]+$/, "")
  const prefix = base + "/fhi_global/email-attachments/"
  const out: Array<{ name: string; url: string; size: number; type: string }> = []
  for (const item of raw as AttachmentInput[]) {
    const name = String(item?.name ?? "").trim().slice(0, 200)
    const url = String(item?.url ?? "").trim()
    const size = Number(item?.size ?? 0)
    const type = String(item?.type ?? "").trim().slice(0, 100)
    if (!name || !url.startsWith(prefix)) return null
    out.push({ name, url, size: Number.isFinite(size) ? size : 0, type })
  }
  return out
}

export async function POST(req: NextRequest) {
  const access = await resolveMailAccess()
  if ("response" in access) return access.response

  let body: { to?: string; toName?: string; subject?: string; message?: string; attachments?: unknown }
  try {
    body = (await req.json()) as { to?: string; toName?: string; subject?: string; message?: string; attachments?: unknown }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const attachments = sanitizeAttachments(body.attachments)
  if (attachments === null) {
    return NextResponse.json({ error: "Invalid attachments." }, { status: 400 })
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

  const senderName = access.senderName

  let sendError: string | null = null
  try {
    await sendAdminDirectEmail({
      to,
      subject,
      message,
      senderName,
      // A personal mailbox sends as itself; admins send as the house account.
      fromAccount: access.mailbox ? { address: access.mailbox, name: senderName } : undefined,
      attachments,
    })
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
      sent_by: access.context.userId,
      sent_by_name: senderName,
      from_email: access.mailbox ?? ((process.env.SMTP_FROM_EMAIL ?? "").trim().toLowerCase() || null),
      status: sendError ? "failed" : "sent",
      error: sendError,
      attachments,
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
    actor: { id: access.context.userId, name: senderName, role: access.context.profile.role },
    subjectType: "inquiry_emails",
    subjectId: emailRow?.id,
    subjectLabel: to,
    description: `Composed an email to ${to} — "${subject}"`,
    newValues: { subject, to },
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ ok: true, email: emailRow })
}
