import { NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { canSignMerchants, isAdminStaffRole } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { AGENT_INCENTIVE_AED } from "@/lib/merchant/rules"
import { MERCHANT_COLUMNS, listRows, type MerchantRow } from "@/lib/merchant/service"
import type { MerchantListRow } from "@/lib/merchant/types"

/**
 * GET /api/agent/merchants — "My merchants": every merchant the caller signed
 * (merchants.agent_id), with the checklist, scans, closed deals and the
 * agent's own incentive this month. The sales ladder only.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export type AgentMerchantsPayload = {
  rows: MerchantListRow[]
  totals: { merchants: number; active: number; scans_month: number; deals_month: number; agent_incentive_month: number; rate: number }
}

export async function GET() {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  const { userId, profile } = session.context
  if (!canSignMerchants(profile.role) && !isAdminStaffRole(profile.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const admin = createAdminSupabase()
  try {
    const { data, error } = await admin.from("merchants").select(MERCHANT_COLUMNS).eq("agent_id", userId).order("created_at", { ascending: false }).limit(500)
    if (error) throw new Error(error.message)
    const rows = await listRows(admin, (data ?? []) as MerchantRow[])
    const payload: AgentMerchantsPayload = {
      rows,
      totals: {
        merchants: rows.length,
        active: rows.filter((r) => r.merchant.status === "accepted").length,
        scans_month: rows.reduce((a, r) => a + r.scans_month, 0),
        deals_month: rows.reduce((a, r) => a + r.deals_month, 0),
        agent_incentive_month: rows.reduce((a, r) => a + r.agent_incentive_month, 0),
        rate: AGENT_INCENTIVE_AED,
      },
    }
    return NextResponse.json(payload, { headers: { "cache-control": "no-store" } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't load your merchants." }, { status: 500 })
  }
}
