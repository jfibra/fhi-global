import { NextRequest, NextResponse } from "next/server"
import { requireMerchantReviewer } from "@/lib/merchant/access"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

/**
 * PATCH /api/admin/merchants/[id]/documents/[docId] { verified: boolean } —
 * the admin's tick on one of the four requirements ("I checked this one").
 */

export const runtime = "nodejs"

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; docId: string }> }) {
  const session = await requireMerchantReviewer()
  if (!session.ok) return session.response
  const { id, docId } = await ctx.params
  const body = (await req.json().catch(() => ({}))) as { verified?: unknown }
  if (typeof body.verified !== "boolean") return NextResponse.json({ error: "Send { verified: true | false }." }, { status: 400 })
  const admin = createAdminSupabase()
  const { data: doc, error: findError } = await admin.from("merchant_documents").select("id, kind, merchant_id").eq("id", docId).eq("merchant_id", id).maybeSingle()
  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 })
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 })
  const { error } = await admin
    .from("merchant_documents")
    .update(body.verified ? { verified_at: new Date().toISOString(), verified_by: session.context.userId } : { verified_at: null, verified_by: null })
    .eq("id", docId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAuditEvent({
    category: "merchants",
    event: body.verified ? "merchant_document_verified" : "merchant_document_unverified",
    source: "api",
    actor: { id: session.context.userId, name: session.context.profile.fullname ?? session.context.email, role: session.context.profile.role },
    subjectType: "merchants",
    subjectId: id,
    description: `${body.verified ? "Checked" : "Unchecked"} the ${doc.kind} document`,
    ...requestContextFromRequest(req),
  })
  return NextResponse.json({ ok: true })
}
