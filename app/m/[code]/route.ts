import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { clientIp } from "@/lib/rate-limit"
import { MERCHANT_CODE_RE } from "@/lib/merchant/rules"
import { loadMerchantByCode, merchantLandingUrl, recordScan } from "@/lib/merchant/service"

/**
 * GET /m/<code> — what a merchant's QR opens: the scan is counted for that
 * merchant and the customer is forwarded to rentsouq.ae with the code, so
 * the rental is credited. An unknown or retired code still lands on
 * rentsouq.ae, without a code. Never cached.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code: raw } = await ctx.params
  const code = decodeURIComponent(raw ?? "").trim().toUpperCase()
  const fallback = (process.env.MERCHANT_LANDING_URL ?? "https://rentsouq.ae/").trim()
  if (!MERCHANT_CODE_RE.test(code)) return NextResponse.redirect(fallback, 302)
  try {
    const admin = createAdminSupabase()
    const merchant = await loadMerchantByCode(admin, code)
    if (!merchant || merchant.status !== "accepted") return NextResponse.redirect(fallback, 302)
    try {
      await recordScan(admin, merchant.id, { ip: clientIp(req.headers), userAgent: req.headers.get("user-agent"), referer: req.headers.get("referer") })
    } catch (e) {
      console.error("[merchant-scan]", e)
    }
    return NextResponse.redirect(merchantLandingUrl(code) ?? fallback, 302)
  } catch {
    return NextResponse.redirect(fallback, 302)
  }
}
