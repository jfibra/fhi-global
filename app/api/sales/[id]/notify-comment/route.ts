import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { roleToLabel, ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { getDashboardRouteByRole } from "@/lib/auth"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { hasMailerConfig, sendSaleCommentEmail, type SaleEmailDetails } from "@/lib/mailer"
import { SITE_URL } from "@/lib/seo"

/**
 * Email the *other party* about a new validation-discussion comment:
 *  - admin comment      → the sale's agent (owner)
 *  - non-admin comment  → all admin staff (super_admin / admin)
 *
 * The payload carries only the comment id — the comment, the sale, and every
 * recipient's email are re-read here, so a caller can never inject email
 * content or pick who gets mailed. Only the comment's own author may trigger
 * its email. SMTP being unconfigured is a silent skip (matches the repo's
 * feature-gated pattern), and a failed send never breaks the comment post
 * (the client fires this fire-and-forget).
 */

export const runtime = "nodejs"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_EXCERPT = 600

const SALE_TYPE_LABELS: Record<string, string> = {
  project: "Project Sale",
  brokerage: "Brokerage Sale",
  rental: "Rental",
}
const VALIDATION_LABELS: Record<string, string> = {
  pending: "Pending",
  under_review: "Under Review",
  validated: "Validated",
  invalid_sale: "Invalid Sale",
}

type Rel<T> = T | T[] | null
type SaleRow = {
  id: string
  sale_type: string
  agent_id: string
  contract_price: number
  reservation_date: string | null
  validation_status: string
  property_address: string | null
  property_type: string | null
  clients: Rel<{ first_name: string | null; last_name: string | null }>
  projects: Rel<{ name: string | null }>
  developers: Rel<{ name: string | null }>
  profiles: Rel<{ fullname: string | null; role: string | null }>
}

function one<T>(rel: Rel<T>): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response

  const { id } = await ctx.params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid sale id" }, { status: 400 })
  }

  const body = (await req.json().catch(() => ({}))) as { commentId?: unknown }
  const commentId = typeof body.commentId === "string" ? body.commentId : ""
  if (!UUID_RE.test(commentId)) {
    return NextResponse.json({ error: "Invalid comment id" }, { status: 400 })
  }

  const admin = createAdminSupabase()

  // Load the comment. Only its own author may notify about it, and it must
  // belong to this sale — a mismatch answers with the same 404 as a missing
  // comment so the route is never an existence oracle.
  const { data: commentData, error: commentError } = await admin
    .from("sales_validation_comments")
    .select("id, sales_report_id, comment, commented_by, commenter_role, is_admin_comment")
    .eq("id", commentId)
    .maybeSingle()

  if (commentError) {
    console.error("[sales/notify-comment] comment lookup failed:", commentError.message)
    return NextResponse.json({ error: "Couldn't look up the comment" }, { status: 500 })
  }
  const comment = commentData as {
    id: string
    sales_report_id: string
    comment: string
    commented_by: string
    commenter_role: string | null
    is_admin_comment: boolean
  } | null
  if (!comment || comment.sales_report_id !== id || comment.commented_by !== session.context.userId) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 })
  }

  if (!hasMailerConfig()) {
    return NextResponse.json({ ok: true, skipped: "smtp-not-configured" })
  }

  const { data: saleData, error: saleError } = await admin
    .from("sales_reports")
    .select(
      `id, sale_type, agent_id, contract_price, reservation_date, validation_status,
       property_address, property_type,
       clients(first_name, last_name), projects(name), developers(name),
       profiles:agent_id(fullname, role)`,
    )
    .eq("id", id)
    .maybeSingle()

  if (saleError || !saleData) {
    return NextResponse.json({ error: "Sale not found" }, { status: 404 })
  }
  const sale = saleData as unknown as SaleRow

  // Commenter display name — the sale join only carries the agent.
  const { data: commenterProfile } = await admin
    .from("profiles")
    .select("fullname, role")
    .eq("id", comment.commented_by)
    .maybeSingle()
  const commenterName = (commenterProfile?.fullname as string | null) ?? null
  const commenterRoleLabel = roleToLabel(comment.commenter_role ?? (commenterProfile?.role as string | null) ?? null)

  // Recipients: admin comment → the agent; otherwise → all admin staff.
  type Recipient = { userId: string; name: string | null; role: string | null }
  let recipients: Recipient[] = []
  if (comment.is_admin_comment) {
    const agent = one(sale.profiles)
    recipients = [{ userId: sale.agent_id, name: agent?.fullname ?? null, role: agent?.role ?? null }]
  } else {
    const { data: admins } = await admin
      .from("profiles")
      .select("id, fullname, role")
      .in("role", [...ROLES_ADMIN_STAFF])
    recipients = (admins ?? []).map((a) => ({
      userId: String(a.id),
      name: (a.fullname as string | null) ?? null,
      role: (a.role as string | null) ?? null,
    }))
  }

  // Never notify the commenter themselves.
  const targets = recipients.filter((r) => r.userId !== comment.commented_by)
  if (targets.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no-recipients" })
  }

  const client = one(sale.clients)
  const clientName = client ? [client.first_name, client.last_name].filter(Boolean).join(" ") || null : null
  const propertyLabel = one(sale.projects)?.name ?? sale.property_address ?? sale.property_type ?? null
  const developerName = one(sale.developers)?.name ?? null
  const statusLabel = VALIDATION_LABELS[sale.validation_status] ?? sale.validation_status.replace(/_/g, " ")
  const excerpt =
    comment.comment.length > MAX_EXCERPT ? `${comment.comment.slice(0, MAX_EXCERPT)}…` : comment.comment

  let sent = 0
  let failed = 0
  await Promise.all(
    targets.map(async (r) => {
      const authUser = await admin.auth.admin.getUserById(r.userId).catch(() => null)
      const to = authUser?.data?.user?.email ?? null
      if (!to) return
      const details: SaleEmailDetails = {
        saleTypeLabel: SALE_TYPE_LABELS[sale.sale_type] ?? "Sale",
        clientName,
        propertyLabel,
        developerName,
        contractPrice: Number(sale.contract_price ?? 0),
        reservationDate: sale.reservation_date,
        dashboardUrl: `${SITE_URL}${getDashboardRouteByRole(r.role)}/sales`,
      }
      try {
        await sendSaleCommentEmail({
          to,
          recipientName: r.name,
          commenterName,
          commenterRoleLabel,
          commentExcerpt: excerpt,
          statusLabel,
          details,
        })
        sent += 1
      } catch (e) {
        failed += 1
        console.error("[sales/notify-comment] send failed:", e instanceof Error ? e.message : e)
      }
    }),
  )

  if (sent === 0 && failed > 0) {
    return NextResponse.json({ error: "Couldn't send the email — check the SMTP settings" }, { status: 502 })
  }
  return NextResponse.json({ ok: true, sent })
}
