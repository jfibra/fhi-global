import { NextRequest, NextResponse } from "next/server"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { requireMerchantAccess } from "@/lib/merchant/access"
import { MERCHANT_CATEGORIES } from "@/lib/merchant/rules"
import { ibanLast4, normalizeIban, sealIban } from "@/lib/merchant/secrets"
import { checklistFor, figuresFor, loadDocuments, merchantQr, peopleFor, refreshStatus, toRecord } from "@/lib/merchant/service"
import type { MerchantMePayload } from "@/lib/merchant/types"

/**
 * GET  /api/merchant/me[?merchant=<id>] — the merchant record with its
 *      account, agent, documents, checklist, figures and QR. The merchant
 *      reads its own; the signing agent and admin staff name one.
 * PATCH the same — business details, the signatory, the licence, the voucher
 *      and the bank details (the IBAN is sealed on the way in). Only the
 *      fields sent change. The onboarding ↔ submitted status follows.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const access = await requireMerchantAccess(req.nextUrl.searchParams.get("merchant"))
  if (!access.ok) return access.response
  const { admin, merchant } = access.access
  try {
    const [docs, people, figures] = await Promise.all([
      loadDocuments(admin, [merchant.id]),
      peopleFor(admin, [merchant.profile_id, merchant.agent_id ?? ""]),
      figuresFor(admin, merchant),
    ])
    const documents = docs.get(merchant.id) ?? []
    const payload: MerchantMePayload = {
      merchant: toRecord(merchant),
      account: people.get(merchant.profile_id) ?? { id: merchant.profile_id, name: merchant.signatory_name, role: "merchant", email: null, phone: null, whatsapp: null, avatar_url: null },
      agent: merchant.agent_id ? people.get(merchant.agent_id) ?? null : null,
      documents,
      checklist: checklistFor(merchant, documents),
      figures,
      qr: merchantQr(merchant),
    }
    return NextResponse.json({ ...payload, who: access.access.who }, { headers: { "cache-control": "no-store" } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't load the merchant." }, { status: 500 })
  }
}

const TEXT_FIELDS = [
  "business_name",
  "address",
  "emirate",
  "website",
  "signatory_name",
  "signatory_title",
  "emirates_id_number",
  "trade_licence_number",
  "trade_licence_authority",
  "voucher_offer",
  "bank_account_name",
  "bank_name",
  "notes",
] as const
const DATE_FIELDS = ["emirates_id_expires_on", "trade_licence_expires_on"] as const
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

export async function PATCH(req: NextRequest) {
  const access = await requireMerchantAccess(req.nextUrl.searchParams.get("merchant"))
  if (!access.ok) return access.response
  const { admin, merchant, who, caller } = access.access
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: "Send the fields to change." }, { status: 400 })

  const update: Record<string, unknown> = {}
  for (const f of TEXT_FIELDS) {
    if (!(f in body)) continue
    const v = body[f]
    if (v !== null && typeof v !== "string") return NextResponse.json({ error: `${f} must be text.` }, { status: 400 })
    const t = (v ?? "").trim().replace(/\s+/g, " ").slice(0, f === "notes" ? 2000 : 200)
    if (f === "business_name" && t.length < 2) return NextResponse.json({ error: "The business name is required." }, { status: 400 })
    if (f === "notes" && who !== "admin") continue
    update[f] = t || null
  }
  if ("category" in body) {
    const c = typeof body.category === "string" ? body.category.trim() : ""
    if (c && !MERCHANT_CATEGORIES.includes(c as (typeof MERCHANT_CATEGORIES)[number])) return NextResponse.json({ error: "Choose a kind of business from the list." }, { status: 400 })
    update.category = c || null
  }
  for (const f of DATE_FIELDS) {
    if (!(f in body)) continue
    const v = body[f]
    if (v !== null && v !== "" && (typeof v !== "string" || !ISO_DAY.test(v))) return NextResponse.json({ error: `${f} must be a date (YYYY-MM-DD).` }, { status: 400 })
    update[f] = v || null
  }
  if (typeof body.iban === "string" && body.iban.trim()) {
    const iban = normalizeIban(body.iban)
    if (!iban) return NextResponse.json({ error: "That doesn't look like an IBAN (two letters, two digits, then 11 to 30 characters)." }, { status: 400 })
    update.iban_sealed = sealIban(iban, merchant.id)
    update.iban_last4 = ibanLast4(iban)
  } else if (body.clear_iban === true) {
    update.iban_sealed = null
    update.iban_last4 = null
  }

  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to change." }, { status: 400 })
  update.updated_at = new Date().toISOString()

  try {
    const { error } = await admin.from("merchants").update(update).eq("id", merchant.id)
    if (error) throw new Error(error.message)
    const status = await refreshStatus(admin, merchant.id)
    const changed = Object.keys(update).filter((k) => k !== "updated_at" && k !== "iban_sealed")
    await logAuditEvent({
      category: "merchants",
      event: "merchant_updated",
      source: "api",
      actor: { id: caller.userId, name: caller.profile.fullname ?? caller.email, role: caller.profile.role },
      subjectType: "merchants",
      subjectId: merchant.id,
      subjectLabel: (update.business_name as string | undefined) ?? merchant.business_name,
      description: `${who === "merchant" ? "The merchant" : who === "agent" ? "The signing agent" : "An admin"} updated ${changed.join(", ")}`,
      changedKeys: changed,
      ...requestContextFromRequest(req),
    })
    return NextResponse.json({ ok: true, status })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't save." }, { status: 500 })
  }
}
