import { NextRequest, NextResponse } from "next/server"
import { requireMerchantReviewer } from "@/lib/merchant/access"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { openIban } from "@/lib/merchant/secrets"
import { checklistFor, figuresFor, loadDocuments, loadMerchantById, merchantQr, peopleFor, toRecord } from "@/lib/merchant/service"
import type { MerchantMePayload } from "@/lib/merchant/types"

/**
 * GET /api/admin/merchants/[id][?reveal=1] — one merchant in full for the
 * review sheet: record, account, agent, documents, checklist, figures and
 * QR. `reveal=1` opens the sealed IBAN for this one response and is audited.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export type AdminMerchantDetail = MerchantMePayload & { iban: string | null }

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireMerchantReviewer()
  if (!session.ok) return session.response
  const { id } = await ctx.params
  const admin = createAdminSupabase()
  try {
    const merchant = await loadMerchantById(admin, id)
    if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404 })
    const reveal = req.nextUrl.searchParams.get("reveal") === "1"
    const [docs, people, figures] = await Promise.all([
      loadDocuments(admin, [merchant.id]),
      peopleFor(admin, [merchant.profile_id, merchant.agent_id ?? ""]),
      figuresFor(admin, merchant),
    ])
    const documents = docs.get(merchant.id) ?? []
    let iban: string | null = null
    if (reveal && merchant.iban_sealed) {
      iban = openIban(merchant.iban_sealed, merchant.id)
      await logAuditEvent({
        category: "merchants",
        event: "merchant_iban_revealed",
        source: "api",
        actor: { id: session.context.userId, name: session.context.profile.fullname ?? session.context.email, role: session.context.profile.role },
        subjectType: "merchants",
        subjectId: merchant.id,
        subjectLabel: merchant.business_name,
        description: iban ? "An admin revealed the merchant's IBAN" : "An admin tried to reveal the merchant's IBAN but it could not be opened",
        ...requestContextFromRequest(req),
      })
    }
    const payload: AdminMerchantDetail = {
      merchant: toRecord(merchant),
      account: people.get(merchant.profile_id) ?? { id: merchant.profile_id, name: merchant.signatory_name, role: "merchant", email: null, phone: null, whatsapp: null, avatar_url: null },
      agent: merchant.agent_id ? people.get(merchant.agent_id) ?? null : null,
      documents,
      checklist: checklistFor(merchant, documents),
      figures,
      qr: merchantQr(merchant),
      iban,
    }
    return NextResponse.json(payload, { headers: { "cache-control": "no-store" } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't load the merchant." }, { status: 500 })
  }
}
