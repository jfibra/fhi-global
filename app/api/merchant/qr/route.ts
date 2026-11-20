import { NextRequest, NextResponse } from "next/server"
import { requireMerchantAccess } from "@/lib/merchant/access"
import { merchantFlyerPdf } from "@/lib/merchant/flyer"
import { merchantQrPng } from "@/lib/merchant/qr"
import { merchantQr } from "@/lib/merchant/service"

/**
 * GET /api/merchant/qr?format=png|flyer|banner[&merchant=<id>] — the
 * merchant's QR as a PNG, the A5 flyer or the roll-up banner as a PDF. Only
 * once a code has been issued (accepted). Served as a download.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const access = await requireMerchantAccess(req.nextUrl.searchParams.get("merchant"))
  if (!access.ok) return access.response
  const { merchant } = access.access
  const qr = merchantQr(merchant)
  if (!merchant.code || !qr.url) return NextResponse.json({ error: "The QR is issued when FHI accepts the merchant." }, { status: 409 })
  const format = (req.nextUrl.searchParams.get("format") ?? "png").toLowerCase()
  const slug = merchant.business_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "merchant"
  try {
    if (format === "png") {
      const png = await merchantQrPng(qr.url, 1024)
      return new NextResponse(new Uint8Array(png), {
        headers: { "content-type": "image/png", "content-disposition": `attachment; filename="qr-${slug}-${merchant.code}.png"`, "cache-control": "private, no-store" },
      })
    }
    if (format === "flyer" || format === "banner") {
      const pdf = await merchantFlyerPdf({ businessName: merchant.business_name, voucherOffer: merchant.voucher_offer, qrUrl: qr.url, code: merchant.code, size: format === "banner" ? "banner" : "a5" })
      return new NextResponse(new Uint8Array(pdf), {
        headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${format}-${slug}-${merchant.code}.pdf"`, "cache-control": "private, no-store" },
      })
    }
    return NextResponse.json({ error: "format must be png, flyer or banner." }, { status: 400 })
  } catch (e) {
    console.error("[merchant-qr]", e)
    return NextResponse.json({ error: "Couldn't draw the QR." }, { status: 500 })
  }
}
