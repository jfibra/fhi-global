import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { sendMerchantDeclinedEmail } from "@/lib/mailer"
import { loadMerchantById, peopleFor } from "@/lib/merchant/service"

/**
 * POST /api/admin/merchants/[id]/decline { reason } — the application is
 * declined with a reason the merchant and the agent are told; the merchant's
 * login is switched off (an accept later switches it back on).
 */

export const runtime = "nodejs"

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireRole([...ROLES_ADMIN_STAFF])
  if (!session.ok) return session.response
  const { id } = await ctx.params
  const body = (await req.json().catch(() => ({}))) as { reason?: unknown }
  const reason = (typeof body.reason === "string" ? body.reason : "").trim().replace(/\s+/g, " ").slice(0, 600)
  if (reason.length < 5) return NextResponse.json({ error: "Give the merchant a reason (a sentence is enough)." }, { status: 400 })
  const admin = createAdminSupabase()
  try {
    const merchant = await loadMerchantById(admin, id)
    if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404 })
    if (merchant.status === "declined") return NextResponse.json({ error: "Already declined." }, { status: 409 })
    const now = new Date().toISOString()
    const { error } = await admin
      .from("merchants")
      .update({ status: "declined", declined_at: now, declined_by: session.context.userId, decline_reason: reason, updated_at: now })
      .eq("id", merchant.id)
    if (error) throw new Error(error.message)
    await admin.from("profiles").update({ status: "inactive" }).eq("id", merchant.profile_id)
    await logAuditEvent({
      category: "merchants",
      event: "merchant_declined",
      source: "api",
      actor: { id: session.context.userId, name: session.context.profile.fullname ?? session.context.email, role: session.context.profile.role },
      subjectType: "merchants",
      subjectId: merchant.id,
      subjectLabel: merchant.business_name,
      description: `Declined: ${reason}`,
      oldValues: { status: merchant.status },
      newValues: { status: "declined" },
      changedKeys: ["status"],
      ...requestContextFromRequest(req),
    })
    try {
      const people = await peopleFor(admin, [merchant.profile_id, merchant.agent_id ?? ""])
      const account = people.get(merchant.profile_id)
      const agent = merchant.agent_id ? people.get(merchant.agent_id) : null
      const to = [account?.email, agent?.email].filter((e): e is string => !!e)
      if (to.length) await sendMerchantDeclinedEmail({ to, contactName: merchant.signatory_name ?? account?.name ?? null, businessName: merchant.business_name, reason, agentName: agent?.name ?? null })
    } catch (e) {
      console.error("[merchant-decline-email]", e)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't decline the merchant." }, { status: 500 })
  }
}
