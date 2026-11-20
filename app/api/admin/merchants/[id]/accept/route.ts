import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { getDashboardRouteByRole } from "@/lib/auth"
import { sendMerchantAcceptedEmail, sendMerchantAgentAcceptedEmail } from "@/lib/mailer"
import { merchantFlyerPdf } from "@/lib/merchant/flyer"
import { merchantQrPng } from "@/lib/merchant/qr"
import { agreementDates, checklistComplete, checklistFor, loadDocuments, loadMerchantById, merchantQr, newMerchantCode, peopleFor } from "@/lib/merchant/service"
import { SITE_URL } from "@/lib/seo"

/**
 * POST /api/admin/merchants/[id]/accept { note?, force? } — the admin's
 * decision: the merchant gets its code and QR, the one-year agreement is
 * dated from today, the account is active, and the merchant and the signing
 * agent are emailed (the QR PNG and the flyer PDF attached). Only from
 * submitted, or from onboarding with `force` when the admin accepts a
 * merchant whose paperwork came another way.
 */

export const runtime = "nodejs"

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireRole([...ROLES_ADMIN_STAFF])
  if (!session.ok) return session.response
  const { id } = await ctx.params
  const body = (await req.json().catch(() => ({}))) as { note?: unknown; force?: unknown }
  const note = (typeof body.note === "string" ? body.note : "").trim().slice(0, 1000)
  const force = body.force === true
  const admin = createAdminSupabase()
  try {
    const merchant = await loadMerchantById(admin, id)
    if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404 })
    if (merchant.status === "accepted") return NextResponse.json({ error: "This merchant is already accepted." }, { status: 409 })
    if (merchant.status === "ended") return NextResponse.json({ error: "This merchant's agreement has ended." }, { status: 409 })
    const docs = (await loadDocuments(admin, [merchant.id])).get(merchant.id) ?? []
    if (!checklistComplete(checklistFor(merchant, docs)) && !force) {
      return NextResponse.json({ error: "Not all four requirements are in. Tick \"accept anyway\" if the paperwork came another way." }, { status: 409 })
    }

    const code = merchant.code ?? (await newMerchantCode(admin))
    const dates = agreementDates()
    const now = new Date().toISOString()
    const { error } = await admin
      .from("merchants")
      .update({ status: "accepted", code, accepted_at: now, accepted_by: session.context.userId, declined_at: null, declined_by: null, decline_reason: null, agreement_starts_on: dates.starts_on, agreement_ends_on: dates.ends_on, ended_at: null, updated_at: now })
      .eq("id", merchant.id)
    if (error) throw new Error(error.message)
    // The login must work (a declined merchant's account was switched off).
    await admin.from("profiles").update({ status: "active" }).eq("id", merchant.profile_id)

    await logAuditEvent({
      category: "merchants",
      event: "merchant_accepted",
      source: "api",
      actor: { id: session.context.userId, name: session.context.profile.fullname ?? session.context.email, role: session.context.profile.role },
      subjectType: "merchants",
      subjectId: merchant.id,
      subjectLabel: merchant.business_name,
      description: `Accepted into the Merchant Partnership Programme as ${code}; agreement ${dates.starts_on} to ${dates.ends_on}${force ? " (accepted with requirements missing)" : ""}`,
      oldValues: { status: merchant.status },
      newValues: { status: "accepted", code, agreement_starts_on: dates.starts_on, agreement_ends_on: dates.ends_on },
      changedKeys: ["status", "code", "agreement_starts_on", "agreement_ends_on"],
      ...requestContextFromRequest(req),
    })

    // Emails, best effort: the decision stands even when SMTP is down.
    const emailed: string[] = []
    try {
      const qr = merchantQr({ code, status: "accepted" })
      const people = await peopleFor(admin, [merchant.profile_id, merchant.agent_id ?? ""])
      const account = people.get(merchant.profile_id)
      const agent = merchant.agent_id ? people.get(merchant.agent_id) : null
      const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
      if (account?.email && qr.url && qr.landing) {
        const [qrPng, flyerPdf] = await Promise.all([
          merchantQrPng(qr.url, 1024),
          merchantFlyerPdf({ businessName: merchant.business_name, voucherOffer: merchant.voucher_offer, qrUrl: qr.url, code, size: "a5" }),
        ])
        await sendMerchantAcceptedEmail({
          to: account.email,
          contactName: merchant.signatory_name ?? account.name,
          businessName: merchant.business_name,
          code,
          qrUrl: qr.url,
          landingUrl: qr.landing,
          agreementStartsOn: fmt(dates.starts_on),
          agreementEndsOn: fmt(dates.ends_on),
          agentName: agent?.name ?? null,
          dashboardUrl: `${SITE_URL.replace(/\/$/, "")}${getDashboardRouteByRole("merchant")}`,
          qrPng,
          flyerPdf: Buffer.from(flyerPdf),
          note: note || null,
        })
        emailed.push("merchant")
      }
      if (agent?.email) {
        await sendMerchantAgentAcceptedEmail({
          to: agent.email,
          agentName: agent.name,
          businessName: merchant.business_name,
          code,
          dashboardUrl: `${SITE_URL.replace(/\/$/, "")}${getDashboardRouteByRole(agent.role)}/invite?view=merchants`,
        })
        emailed.push("agent")
      }
    } catch (e) {
      console.error("[merchant-accept-email]", e)
    }
    return NextResponse.json({ ok: true, code, agreement: dates, emailed })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't accept the merchant." }, { status: 500 })
  }
}
