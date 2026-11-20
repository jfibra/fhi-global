import "server-only"

import { NextResponse } from "next/server"
import { requireActiveSession, type GuardResult } from "@/lib/auth-guard"
import { canSignMerchants, isAdminStaffRole, isMerchantRole } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { loadMerchantById, loadMerchantByProfile, type MerchantRow } from "@/lib/merchant/service"

/**
 * Who may touch a merchant record (migration 092): the merchant itself (its
 * own record, never another's), the agent who signed it (`merchants.agent_id`),
 * and admin staff (any). Every merchant route starts here; the tables are
 * service role only, so this is THE access rule.
 */

export type MerchantAccess = {
  who: "merchant" | "agent" | "admin"
  caller: GuardResult
  merchant: MerchantRow
  admin: ReturnType<typeof createAdminSupabase>
}

export async function requireMerchantAccess(
  merchantIdParam: string | null | undefined,
): Promise<{ ok: true; access: MerchantAccess } | { ok: false; response: NextResponse }> {
  const session = await requireActiveSession()
  if (!session.ok) return session
  const { profile, userId } = session.context
  const admin = createAdminSupabase()
  const wanted = (merchantIdParam ?? "").trim() || null

  try {
    if (isMerchantRole(profile.role)) {
      const merchant = await loadMerchantByProfile(admin, userId)
      if (!merchant) return { ok: false, response: NextResponse.json({ error: "No merchant record is linked to this account yet." }, { status: 404 }) }
      if (wanted && wanted !== merchant.id) return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
      return { ok: true, access: { who: "merchant", caller: session.context, merchant, admin } }
    }
    if (!wanted) return { ok: false, response: NextResponse.json({ error: "Say which merchant (merchant=<id>)." }, { status: 400 }) }
    const merchant = await loadMerchantById(admin, wanted)
    if (!merchant) return { ok: false, response: NextResponse.json({ error: "Merchant not found" }, { status: 404 }) }
    if (isAdminStaffRole(profile.role)) return { ok: true, access: { who: "admin", caller: session.context, merchant, admin } }
    if (canSignMerchants(profile.role) && merchant.agent_id === userId) return { ok: true, access: { who: "agent", caller: session.context, merchant, admin } }
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  } catch (e) {
    return { ok: false, response: NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't load the merchant." }, { status: 500 }) }
  }
}
