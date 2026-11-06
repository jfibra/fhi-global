import { NextRequest, NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import QRCode from "qrcode"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF, ROLES_AGENT_ASSISTANT } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { loadBrochure } from "@/lib/brochure/data"
import { BrochureDocument, registerReportFonts, type BrochureImages } from "@/lib/brochure/pdf"
import { brandImage, pdfImage } from "@/lib/company-report/brand-images"
import { NAVY } from "@/lib/company-report/pdf-kit"

/**
 * The project brochure PDF for the agent asking (boss via Juliecor, 2026-11-06):
 * FHI Assistant's "make me a brochure for Azizi Ruby" ends in a Download
 * button that opens this. One page: the project's photo, price, units, payment
 * plan, amenities, and the CALLER'S OWN contact card with a QR code to the
 * project on their website (or their WhatsApp) — lib/brochure/{data,pdf}.
 *
 *   GET ?project=<id>            attachment (download)
 *   GET ?project=<id>&inline=1   shown in the browser
 *
 * Agents, team leaders and admin staff; the contact block is always the
 * caller's, never chosen by a parameter. Never cached: it carries a person's
 * phone number.
 */

export const runtime = "nodejs"
export const maxDuration = 60

const document = (props: Parameters<typeof BrochureDocument>[0]) => <BrochureDocument {...props} />

export async function GET(req: NextRequest) {
  const guard = await requireRole([...ROLES_AGENT_ASSISTANT, ...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const id = Number(req.nextUrl.searchParams.get("project"))
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Which project? Pass its id." }, { status: 400 })

  const origin = req.nextUrl.origin
  try {
    registerReportFonts(origin)
    const admin = createAdminSupabase()
    const b = await loadBrochure(admin, id, { userId: guard.context.userId, email: guard.context.email })
    if (!b) return NextResponse.json({ error: "That project isn't on the website." }, { status: 404 })
    const [hero, agent, whiteLogo, navyLogo, qr] = await Promise.all([
      pdfImage(b.project.image, 1400, { photo: true }),
      pdfImage(b.agent.photo, 320, { photo: true }),
      brandImage(origin, "FHI_Branding_White.png", 480),
      brandImage(origin, "fhi-branding-navy.png", 300),
      QRCode.toBuffer(b.qr.url, { type: "png", width: 360, margin: 1, color: { dark: NAVY, light: "#ffffff" } }).catch(() => null),
    ])
    const images: BrochureImages = { hero, agent, whiteLogo, navyLogo, qr }
    const pdf = await renderToBuffer(document({ b, images }))
    const slug = `${b.project.slug}-${b.agent.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    const inline = req.nextUrl.searchParams.get("inline") === "1"
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="fhi-brochure-${slug}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (e) {
    console.error("brochure failed", e)
    return NextResponse.json({ error: "Couldn't build the brochure. Try again in a moment." }, { status: 500 })
  }
}
