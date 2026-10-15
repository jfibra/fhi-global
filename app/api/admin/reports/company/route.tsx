import { NextRequest, NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { REPORT_PERIOD_KEYS, buildCompanyReport, type ReportPeriodKey } from "@/lib/company-report/data"
import { buildInsights } from "@/lib/company-report/insights"
import { CompanyReportDocument, registerReportFonts, type ReportImages } from "@/lib/company-report/pdf"

/**
 * The company performance report as a PDF (boss via Juliecor, 2026-10-15) —
 * FHI Assistant's Daily / Weekly / Monthly reports as a document: KPI tiles,
 * teams and leader networks, sales, pipeline, recruitment, leads and website
 * with tables and charts, and recommendations drafted from the figures.
 *
 *   GET ?period=today | last7 | month | last_month   (admin staff only)
 *
 * Company-wide sales figures, so never cached by a CDN.
 */

export const runtime = "nodejs"
export const maxDuration = 60

/** The brand marks, shrunk for print (the originals are 2–3k px PNGs), cached per process. */
const imageCache = new Map<string, Promise<Buffer | null>>()
function brandImage(origin: string, file: string, width: number): Promise<Buffer | null> {
  const key = `${origin}/${file}@${width}`
  let p = imageCache.get(key)
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(`${origin}/${file}`)
        if (!res.ok) return null
        const buf = Buffer.from(await res.arrayBuffer())
        try {
          const { default: sharp } = await import("sharp")
          return await sharp(buf).resize({ width, withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer()
        } catch {
          return buf
        }
      } catch {
        return null
      }
    })()
    p.then((b) => { if (!b) imageCache.delete(key) })
    imageCache.set(key, p)
  }
  return p
}

/** The document element, built outside the handler's try/catch (rendering errors surface from renderToBuffer). */
const reportDocument = (props: Parameters<typeof CompanyReportDocument>[0]) => <CompanyReportDocument {...props} />

export async function GET(req: NextRequest) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const key = (req.nextUrl.searchParams.get("period") ?? "last7") as ReportPeriodKey
  if (!REPORT_PERIOD_KEYS.includes(key)) return NextResponse.json({ error: "Unknown period." }, { status: 400 })

  const origin = req.nextUrl.origin
  try {
    registerReportFonts(origin)
    const [report, whiteLogo, navyLogo] = await Promise.all([
      buildCompanyReport(key),
      brandImage(origin, "FHI_Branding_White.png", 480),
      brandImage(origin, "fhi-branding-navy.png", 300),
    ])
    const insights = await buildInsights(report)
    const images: ReportImages = { whiteLogo, navyLogo }
    const pdf = await renderToBuffer(reportDocument({ r: report, insights, images }))
    const slug = `${report.period.kind}-${report.period.label}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="fhi-${slug}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Report-Insights": insights.source,
      },
    })
  } catch (e) {
    console.error("company report failed", e)
    return NextResponse.json({ error: "Couldn't build the report. Try again in a moment." }, { status: 500 })
  }
}
