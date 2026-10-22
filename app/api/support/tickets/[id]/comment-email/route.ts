import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { isAdminStaffRole, roleToSlug } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { hasMailerConfig, sendSupportReplyEmail, supportReplyCopy } from "@/lib/mailer"
import { SITE_URL } from "@/lib/seo"

/**
 * POST { commentId } — called by the ticket's comment box right after a
 * comment is saved (comments are written from the browser under RLS). When
 * the writer isn't the person who opened the ticket, that person is emailed
 * the comment with a link to the ticket in their own dashboard (boss via
 * Juliecor, 2026-10-22), and the email is listed in Emails → Sent.
 *
 * Guards: only the comment's own writer can announce it, only within 10
 * minutes of writing it, and only once (the Sent record carries the
 * comment id) — so the route can't be used to spam anyone.
 */

export const runtime = "nodejs"

// Roles whose dashboards have a ticket page at /<slug>/support/<id>; admins
// read tickets under the Communication hub.
const SUPPORT_PAGE_SLUGS = new Set(["agent", "teamleader", "unitmanager", "member", "globalpartner", "developer", "secretary", "teamsecretary"])

function ticketUrl(role: string | null, ticketId: string): string {
  const base = SITE_URL.replace(/\/$/, "")
  const slug = roleToSlug(role)
  if (isAdminStaffRole(role)) return `${base}/${slug}/communication/support/${ticketId}`
  if (SUPPORT_PAGE_SLUGS.has(slug)) return `${base}/${slug}/support/${ticketId}`
  return `${base}/dashboard`
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  const { id } = await ctx.params
  const body = (await req.json().catch(() => null)) as { commentId?: string } | null
  const commentId = body?.commentId?.trim()
  if (!commentId) return NextResponse.json({ error: "commentId is required." }, { status: 400 })
  if (!hasMailerConfig()) return NextResponse.json({ emailed: false, reason: "Email is not configured." })

  const admin = createAdminSupabase()
  const { data: comment } = await admin.from("support_ticket_comments").select("id, ticket_id, comment, commented_by, created_at").eq("id", commentId).maybeSingle()
  if (!comment || comment.ticket_id !== id) return NextResponse.json({ error: "Comment not found." }, { status: 404 })
  if (comment.commented_by !== session.context.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (Date.now() - Date.parse(comment.created_at) > 10 * 60 * 1000) return NextResponse.json({ emailed: false, reason: "Too late to announce this comment." })

  const marker = `support-comment:${comment.id}`
  const { data: already } = await admin.from("inquiry_emails").select("id").eq("message_id", marker).limit(1)
  if (already?.length) return NextResponse.json({ emailed: false, reason: "Already emailed." })

  const { data: ticket } = await admin.from("support_tickets").select("id, title, reported_by").eq("id", id).maybeSingle()
  if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 })
  // Commenting on your own ticket emails nobody.
  if (ticket.reported_by === comment.commented_by) return NextResponse.json({ emailed: false, reason: "Own ticket." })

  const [{ data: reporter }, { data: authUser }] = await Promise.all([
    admin.from("profiles").select("fname, fullname, role, is_deleted").eq("id", ticket.reported_by).maybeSingle(),
    admin.auth.admin.getUserById(ticket.reported_by),
  ])
  const to = authUser?.user?.email?.trim().toLowerCase() || null
  if (!to || reporter?.is_deleted) return NextResponse.json({ emailed: false, reason: "The reporter has no email." })

  const replierName = session.context.profile.fullname?.trim().replace(/\s+/g, " ") || "The FHI Global team"
  const input = {
    to,
    name: reporter?.fname ?? reporter?.fullname ?? null,
    ticketTitle: ticket.title,
    comment: comment.comment,
    replierName,
    ticketUrl: ticketUrl(reporter?.role ?? null, ticket.id),
  }
  let sendError: string | null = null
  try {
    await sendSupportReplyEmail(input)
  } catch (err) {
    sendError = err instanceof Error ? err.message : String(err)
  }

  // Listed in Emails → Sent like any dashboard email, failures included; the
  // marker keeps it to one email per comment.
  const { subject, text } = supportReplyCopy(input)
  await admin.from("inquiry_emails").insert({
    to_email: to,
    to_name: reporter?.fullname?.trim().replace(/\s+/g, " ") ?? null,
    subject,
    body_text: text,
    sent_by: session.context.userId,
    sent_by_name: replierName,
    status: sendError ? "failed" : "sent",
    error: sendError,
    from_email: (process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "").trim().toLowerCase() || null,
    from_name: process.env.SMTP_FROM_NAME || "FHI Global",
    message_id: marker,
  })

  if (sendError) return NextResponse.json({ emailed: false, reason: "The email couldn't be sent." }, { status: 502 })
  return NextResponse.json({ emailed: true, to_name: reporter?.fname?.trim() || reporter?.fullname?.trim().split(/\s+/)[0] || null })
}
