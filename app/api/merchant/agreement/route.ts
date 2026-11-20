import { NextRequest, NextResponse } from "next/server"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { requireMerchantAccess } from "@/lib/merchant/access"
import { merchantAgreementPdf, type AgreementInput } from "@/lib/merchant/agreement"
import { dubaiDay } from "@/lib/merchant/rules"
import { maskIban } from "@/lib/merchant/secrets"
import { agreementDates, peopleFor, refreshStatus, type MerchantRow } from "@/lib/merchant/service"
import { merchantFileKey, putMerchantFile } from "@/lib/merchant/storage"

/**
 * GET  /api/merchant/agreement[?merchant=<id>] — the Merchant Partnership
 *      Agreement pre-filled with the merchant's details, unsigned, to print
 *      and sign (then uploaded as the "agreement" document).
 * POST the same with { signatureDataUrl, signedName?, signedTitle? } — the
 *      merchant signs on screen: the PDF is built with the drawn signature,
 *      stored, and filed as the signed agreement. Only the merchant itself
 *      can sign; an agent or admin uploads a signed copy instead.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function inputFor(admin: Parameters<typeof peopleFor>[0], merchant: MerchantRow): Promise<AgreementInput> {
  const people = merchant.agent_id ? await peopleFor(admin, [merchant.agent_id]) : new Map()
  const dates = merchant.agreement_starts_on ? { starts_on: merchant.agreement_starts_on, ends_on: merchant.agreement_ends_on } : agreementDates()
  return {
    businessName: merchant.business_name,
    category: merchant.category,
    address: merchant.address,
    tradeLicenceNumber: merchant.trade_licence_number,
    tradeLicenceAuthority: merchant.trade_licence_authority,
    signatoryName: merchant.signatory_name,
    signatoryTitle: merchant.signatory_title,
    emiratesIdNumber: merchant.emirates_id_number,
    bankAccountName: merchant.bank_account_name,
    bankName: merchant.bank_name,
    ibanMasked: maskIban("AE", merchant.iban_last4),
    voucherOffer: merchant.voucher_offer,
    code: merchant.code,
    startsOn: dates.starts_on,
    endsOn: dates.ends_on ?? null,
    agentName: merchant.agent_id ? people.get(merchant.agent_id)?.name ?? null : null,
  }
}

const filenameFor = (m: MerchantRow, signed: boolean) =>
  `merchant-agreement-${m.business_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "merchant"}${signed ? "-signed" : ""}.pdf`

export async function GET(req: NextRequest) {
  const access = await requireMerchantAccess(req.nextUrl.searchParams.get("merchant"))
  if (!access.ok) return access.response
  const { admin, merchant } = access.access
  try {
    const pdf = await merchantAgreementPdf(await inputFor(admin, merchant))
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${filenameFor(merchant, false)}"`, "cache-control": "private, no-store" },
    })
  } catch (e) {
    console.error("[merchant-agreement]", e)
    return NextResponse.json({ error: "Couldn't build the agreement." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const access = await requireMerchantAccess(req.nextUrl.searchParams.get("merchant"))
  if (!access.ok) return access.response
  const { admin, merchant, who, caller } = access.access
  if (who !== "merchant") return NextResponse.json({ error: "Only the merchant can sign on screen. Upload the signed copy instead." }, { status: 403 })
  if (merchant.status !== "onboarding" && merchant.status !== "submitted") return NextResponse.json({ error: "This agreement is no longer open for signing." }, { status: 409 })
  const body = (await req.json().catch(() => null)) as { signatureDataUrl?: unknown; signedName?: unknown; signedTitle?: unknown } | null
  const signature = typeof body?.signatureDataUrl === "string" ? body.signatureDataUrl : ""
  if (!signature.startsWith("data:image/png;base64,") || signature.length < 200 || signature.length > 2_000_000) {
    return NextResponse.json({ error: "Draw your signature first." }, { status: 400 })
  }
  const signedName = (typeof body?.signedName === "string" ? body.signedName : "").trim().replace(/\s+/g, " ").slice(0, 120) || merchant.signatory_name
  const signedTitle = (typeof body?.signedTitle === "string" ? body.signedTitle : "").trim().slice(0, 80) || merchant.signatory_title
  if (!signedName) return NextResponse.json({ error: "Type the name of the person signing." }, { status: 400 })

  try {
    const base = await inputFor(admin, merchant)
    const signedDate = new Date(`${dubaiDay()}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    const pdf = await merchantAgreementPdf({ ...base, signatoryName: signedName, signatoryTitle: signedTitle, signatureDataUrl: signature, signedName, signedDate })
    const fileName = filenameFor(merchant, true)
    const url = await putMerchantFile(merchantFileKey(merchant.id, "agreement", fileName), pdf, "application/pdf")
    const { error } = await admin.from("merchant_documents").insert({
      merchant_id: merchant.id,
      kind: "agreement",
      file_name: fileName,
      file_url: url,
      file_type: "PDF",
      uploaded_by: caller.userId,
      uploaded_role: caller.profile.role,
      note: "Signed on screen",
    })
    if (error) throw new Error(error.message)
    // The typed name and title are the signatory's, kept on the record too.
    await admin.from("merchants").update({ signatory_name: signedName, signatory_title: signedTitle, updated_at: new Date().toISOString() }).eq("id", merchant.id)
    const status = await refreshStatus(admin, merchant.id)
    await logAuditEvent({
      category: "merchants",
      event: "merchant_agreement_signed",
      source: "api",
      actor: { id: caller.userId, name: caller.profile.fullname ?? caller.email, role: caller.profile.role },
      subjectType: "merchants",
      subjectId: merchant.id,
      subjectLabel: merchant.business_name,
      description: `The merchant signed the Merchant Partnership Agreement on screen as ${signedName}`,
      ...requestContextFromRequest(req),
    })
    return NextResponse.json({ ok: true, status, url })
  } catch (e) {
    console.error("[merchant-agreement-sign]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't sign the agreement." }, { status: 500 })
  }
}
