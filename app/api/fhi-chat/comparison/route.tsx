import { NextRequest, NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import QRCode from "qrcode"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF, ROLES_AGENT_ASSISTANT } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { COMPARISON_MAX, COMPARISON_MIN, loadComparison } from "@/lib/comparison/data"
import { ComparisonDocument, registerReportFonts, type ComparisonImages } from "@/lib/comparison/pdf"
import { brandImage, pdfImage } from "@/lib/company-report/brand-images"
import { NAVY } from "@/lib/company-report/pdf-kit"

/**
 * The project comparison sheet for the agent asking (boss via Juliecor,
 * 2026-11-12): FHI Assistant's "compare Azizi Ruby and Samana Greenfield"
 * ends in a Download button that opens this. One landscape page: the
 * projects side by side — price, homes, handover, payment plan, area,
 * amenities — with the CALLER'S OWN contact card and QR code
 * (lib/comparison/{data,pdf}, built on the brochure's data).
 *
 *   GET ?projects=<id>,<id>[,<id>]            attachment (download)
 *   GET ?projects=<id>,<id>[,<id>]&inline=1   shown in the browser
 *
 * Agents, team leaders and admin staff; the contact block is always the
 * caller's, never chosen by a parameter. Never cached: it carries a person's
 * phone number.
 */

export const runtime = "nodejs"
export const maxDuration = 60

const document = (props: Parameters<typeof ComparisonDocument>[0]) => <ComparisonDocument {...props} />

export async function GET(req: NextRequest) {
  const guard = await requireRole([...ROLES_AGENT_ASSISTANT, ...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const ids = [...new Set((req.nextUrl.searchParams.get("projects") ?? "").split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0))]
  if (ids.length < COMPARISON_MIN || ids.length > COMPARISON_MAX) return NextResponse.json({ error: `Pass ${COMPARISON_MIN} to ${COMPARISON_MAX} project ids.` }, { status: 400 })

  const origin = req.nextUrl.origin
  try {
    registerReportFonts(origin)
    const admin = createAdminSupabase()
    const c = await loadComparison(admin, ids, { userId: guard.context.userId, email: guard.context.email })
    if (!c) return NextResponse.json({ error: "One of those projects isn't on the website." }, { status: 404 })
    const [photos, agent, whiteLogo, qr] = await Promise.all([
      Promise.all(c.projects.map((p) => pdfImage(p.image, 700, { photo: true }))),
      pdfImage(c.agent.photo, 320, { photo: true }),
      brandImage(origin, "FHI_Branding_White.png", 480),
      QRCode.toBuffer(c.qr.url, { type: "png", width: 360, margin: 1, color: { dark: NAVY, light: "#ffffff" } }).catch(() => null),
    ])
    const images: ComparisonImages = { photos, agent, whiteLogo, qr }
    const pdf = await renderToBuffer(document({ c, images }))
    const slug = c.projects.map((p) => p.slug).join("-vs-").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "")
    const inline = req.nextUrl.searchParams.get("inline") === "1"
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="fhi-comparison-${slug}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (e) {
    console.error("comparison failed", e)
    return NextResponse.json({ error: "Couldn't build the comparison. Try again in a moment." }, { status: 500 })
  }
}
