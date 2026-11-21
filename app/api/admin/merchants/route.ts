import { NextResponse } from "next/server"
import { requireMerchantReviewer } from "@/lib/merchant/access"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { MERCHANT_COLUMNS, listRows, type MerchantRow } from "@/lib/merchant/service"
import type { MerchantListRow } from "@/lib/merchant/types"

/**
 * GET /api/admin/merchants — every merchant of the programme as list rows:
 * the record, the account, the signing agent, the checklist, scans and
 * closed deals. The page splits them into the review queue (submitted, and
 * onboarding apart), the active ones and the rest. Admin staff only.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export type AdminMerchantsPayload = {
  rows: MerchantListRow[]
  counts: Record<"onboarding" | "submitted" | "accepted" | "declined" | "ended", number>
}

export async function GET() {
  const session = await requireMerchantReviewer()
  if (!session.ok) return session.response
  const admin = createAdminSupabase()
  try {
    const { data, error } = await admin.from("merchants").select(MERCHANT_COLUMNS).order("created_at", { ascending: false }).limit(2000)
    if (error) throw new Error(error.message)
    const rows = await listRows(admin, (data ?? []) as MerchantRow[])
    const counts = { onboarding: 0, submitted: 0, accepted: 0, declined: 0, ended: 0 }
    for (const r of rows) counts[r.merchant.status]++
    return NextResponse.json({ rows, counts } satisfies AdminMerchantsPayload, { headers: { "cache-control": "no-store" } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't load the merchants." }, { status: 500 })
  }
}
