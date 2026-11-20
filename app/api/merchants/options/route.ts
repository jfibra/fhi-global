import { NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { canAccessSalesReportsArea, isAdminStaffRole, isMerchantRole } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"

/**
 * GET /api/merchants/options — the accepted merchants, for Record Your Sale's
 * "Came through a merchant QR" on a rental and for showing a tagged sale's
 * merchant by name. Everyone who can see sales; only the public-ish fields.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export type MerchantOption = { id: string; business_name: string; code: string | null; category: string | null; status: string }

export async function GET() {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  const role = session.context.profile.role
  if (!canAccessSalesReportsArea(role) && !isAdminStaffRole(role) && !isMerchantRole(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("merchants")
    .select("id, business_name, code, category, status")
    .in("status", ["accepted", "ended"])
    .order("business_name")
    .limit(2000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ options: (data ?? []) as MerchantOption[] }, { headers: { "cache-control": "private, max-age=60" } })
}
