import "server-only"

import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { merchantQrPng } from "@/lib/merchant/qr"

/**
 * The A5 flyer a merchant prints and puts by the till: the QR, the one line
 * that makes a customer scan it, the voucher they get, and the rentsouq.ae
 * mark. pdf-lib with the built-in fonts, so nothing is fetched. The roll-up
 * banner (850 × 2000 mm) is the same drawing at banner size.
 */

const NAVY = rgb(0 / 255, 31 / 255, 63 / 255)
const GOLD = rgb(214 / 255, 179 / 255, 87 / 255)
const INK = rgb(13 / 255, 17 / 255, 23 / 255)
const GREY = rgb(107 / 255, 114 / 255, 128 / 255)

/** Keep to what Helvetica (WinAnsi) can draw. */
const safe = (s: string) => s.replace(/[—–]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[^\x20-\x7E\xA0-\xFF]/g, "")

export type FlyerInput = {
  businessName: string
  voucherOffer: string | null
  qrUrl: string
  code: string
  /** "a5" (148 × 210 mm) or "banner" (850 × 2000 mm). */
  size?: "a5" | "banner"
}

const MM = 72 / 25.4

export async function merchantFlyerPdf(input: FlyerInput): Promise<Uint8Array> {
  const banner = input.size === "banner"
  const W = (banner ? 850 : 148) * MM
  const H = (banner ? 2000 : 210) * MM
  const doc = await PDFDocument.create()
  doc.setTitle(`${input.businessName} - rentsouq.ae merchant ${banner ? "banner" : "flyer"}`)
  const page = doc.addPage([W, H])
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const k = banner ? 5.2 : 1 // scale of type and spacing

  // Navy band top, gold rule under it.
  const bandH = (banner ? 260 : 46) * MM
  page.drawRectangle({ x: 0, y: H - bandH, width: W, height: bandH, color: NAVY })
  page.drawRectangle({ x: 0, y: H - bandH - 1.2 * MM * k, width: W, height: 1.2 * MM * k, color: GOLD })
  const brand = "rentsouq.ae"
  const brandSize = 26 * k
  page.drawText(brand, { x: (W - bold.widthOfTextAtSize(brand, brandSize)) / 2, y: H - bandH / 2 - brandSize / 3, size: brandSize, font: bold, color: rgb(1, 1, 1) })
  const sub = "FIND YOUR NEXT HOME IN DUBAI"
  const subSize = 8.5 * k
  page.drawText(sub, { x: (W - bold.widthOfTextAtSize(sub, subSize)) / 2, y: H - bandH + 8 * MM * k, size: subSize, font: bold, color: GOLD })

  // The one line.
  const headline = "Scan to see homes for rent"
  const hSize = 20 * k
  let y = H - bandH - 16 * MM * k
  page.drawText(headline, { x: (W - bold.widthOfTextAtSize(headline, hSize)) / 2, y, size: hSize, font: bold, color: INK })
  y -= 7 * MM * k
  const line2 = safe(`Browse, pick a unit and rent it directly on rentsouq.ae.`)
  const l2Size = 10 * k
  page.drawText(line2, { x: (W - font.widthOfTextAtSize(line2, l2Size)) / 2, y, size: l2Size, font, color: GREY })

  // The QR, framed.
  const qrPng = await doc.embedPng(await merchantQrPng(input.qrUrl, banner ? 2048 : 1024))
  const qrSide = (banner ? 520 : 86) * MM
  const qrX = (W - qrSide) / 2
  const qrY = y - 10 * MM * k - qrSide
  page.drawRectangle({ x: qrX - 3 * MM * k, y: qrY - 3 * MM * k, width: qrSide + 6 * MM * k, height: qrSide + 6 * MM * k, borderColor: GOLD, borderWidth: 1.2 * k, color: rgb(1, 1, 1) })
  page.drawImage(qrPng, { x: qrX, y: qrY, width: qrSide, height: qrSide })

  // The voucher, when the merchant gives one.
  y = qrY - 12 * MM * k
  if (input.voucherOffer?.trim()) {
    const v1 = "RENT THROUGH THIS CODE AND GET"
    const v1Size = 8 * k
    page.drawText(v1, { x: (W - bold.widthOfTextAtSize(v1, v1Size)) / 2, y, size: v1Size, font: bold, color: GOLD })
    y -= 7 * MM * k
    const v2 = safe(input.voucherOffer.trim())
    const v2Size = Math.min(16 * k, (W - 24 * MM * k) / Math.max(1, bold.widthOfTextAtSize(v2, 1)))
    page.drawText(v2, { x: (W - bold.widthOfTextAtSize(v2, v2Size)) / 2, y, size: v2Size, font: bold, color: INK })
    y -= 6 * MM * k
    const v3 = safe(`from ${input.businessName}`)
    const v3Size = 10 * k
    page.drawText(v3, { x: (W - font.widthOfTextAtSize(v3, v3Size)) / 2, y, size: v3Size, font, color: GREY })
  } else {
    const v = safe(`Shared with you by ${input.businessName}`)
    const vSize = 11 * k
    page.drawText(v, { x: (W - bold.widthOfTextAtSize(v, vSize)) / 2, y, size: vSize, font: bold, color: INK })
  }

  // Footer: the code and who runs it.
  const foot = safe(`Merchant ${input.code}  ·  rentsouq.ae is run by FHI Global Property LLC with MCG Properties LLC`)
  const fSize = 6.5 * k
  page.drawText(foot, { x: (W - font.widthOfTextAtSize(foot, fSize)) / 2, y: 8 * MM * k, size: fSize, font, color: GREY })

  return doc.save()
}
