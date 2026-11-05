import { NextRequest, NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { brandImage, pdfImage } from "@/lib/company-report/brand-images"
import { registerReportFonts } from "@/lib/company-report/pdf-kit"
import { sseEvents } from "@/lib/fhi-chat-stream"
import { buildTeamReport, type TeamReport } from "@/lib/team-report/data"
import { buildTeamInsights, ruleInsights, sanitizeInsights, type TeamInsights } from "@/lib/team-report/insights"
import { TeamReportDocument, teamReportFileName, type TeamReportImages } from "@/lib/team-report/pdf"

/**
 * The Team Performance Report for one team (boss, 2026-11-05) — what the
 * admin Teams page's "Performance report" button opens: the team's sales,
 * new vs tenured agents, recruits and how far each got through the
 * requirements, who sold and who went quiet, and FHI Assistant's plan to
 * double the sales over the next three months. Figures: lib/team-report/data
 * (counted like the Team sales panel); analysis: lib/team-report/insights.
 *
 *   GET  ?from=YYYY-MM-DD&to=YYYY-MM-DD&format=json   { report, insights }
 *        …with Accept: text/event-stream: status → report → status →
 *        insights → done, so the page shows the figures while the model writes
 *   POST { from, to, insights }   the PDF of what the page shows — the figures
 *        are rebuilt, the analysis is the one posted back (checked), so the
 *        model runs once per report and the document says what the screen said
 *   GET  ?from&to   the PDF straight away (direct link): the analysis is
 *        written here, with a shorter model timeout and the rules as fallback
 *
 * to is exclusive. Admin staff only; team sales are never cached by a CDN.
 */

export const runtime = "nodejs"
export const maxDuration = 60

type Ctx = { params: Promise<{ id: string }> }

type ReportEvent =
  | { type: "status"; text: string }
  | { type: "report"; report: TeamReport }
  | { type: "insights"; insights: TeamInsights }
  | { type: "done" }
  | { type: "error"; error: string }

/** The document element, built outside the handlers' try/catch (rendering errors surface from renderToBuffer). */
const reportDocument = (props: Parameters<typeof TeamReportDocument>[0]) => <TeamReportDocument {...props} />

const lastDay = (toExclusive: string) => new Date(Date.parse(`${toExclusive}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)

async function renderPdf(origin: string, report: TeamReport, insights: TeamInsights): Promise<NextResponse> {
  registerReportFonts(origin)
  const [whiteLogo, navyLogo, teamLogo] = await Promise.all([
    brandImage(origin, "FHI_Branding_White.png", 480),
    brandImage(origin, "fhi-branding-navy.png", 300),
    pdfImage(report.team.logoUrl, 240),
  ])
  const images: TeamReportImages = { whiteLogo, navyLogo, teamLogo }
  const pdf = await renderToBuffer(reportDocument({ r: report, insights, images }))
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${teamReportFileName(report.team.name, report.period.from, lastDay(report.period.to))}"`,
      "Cache-Control": "private, no-store",
      "X-Report-Insights": insights.source,
    },
  })
}

const failed = () => NextResponse.json({ error: "Couldn't build the report. Try again in a moment." }, { status: 500 })

export async function GET(req: NextRequest, context: Ctx) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const { id } = await context.params
  const from = req.nextUrl.searchParams.get("from") ?? ""
  const to = req.nextUrl.searchParams.get("to") ?? ""
  const admin = createAdminSupabase()
  const asJson = req.nextUrl.searchParams.get("format") === "json"

  if (asJson && req.headers.get("accept")?.includes("text/event-stream")) {
    return sseEvents<ReportEvent>(
      async (send) => {
        const built = await buildTeamReport(admin, id, from, to)
        if (built.status !== 200) {
          send({ type: "error", error: built.error })
          return
        }
        send({ type: "report", report: built.report })
        send({ type: "status", text: "FHI Assistant is writing the analysis…" })
        send({ type: "insights", insights: await buildTeamInsights(built.report) })
        send({ type: "done" })
      },
      { type: "status", text: "Adding up the team's sales, recruits and requirements…" },
      { type: "error", error: "Couldn't build the report. Try again in a moment." },
    )
  }

  try {
    const built = await buildTeamReport(admin, id, from, to)
    if (built.status !== 200) return NextResponse.json({ error: built.error }, { status: built.status })
    if (asJson) {
      const insights = await buildTeamInsights(built.report)
      return NextResponse.json({ report: built.report, insights }, { headers: { "Cache-Control": "private, no-store", "X-Report-Insights": insights.source } })
    }
    const insights = await buildTeamInsights(built.report, { timeoutMs: 20_000 })
    return await renderPdf(req.nextUrl.origin, built.report, insights)
  } catch (e) {
    console.error("team report failed", e)
    return failed()
  }
}

export async function POST(req: NextRequest, context: Ctx) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const { id } = await context.params
  const body = (await req.json().catch(() => null)) as { from?: unknown; to?: unknown; insights?: unknown } | null
  if (!body || typeof body.from !== "string" || typeof body.to !== "string") return NextResponse.json({ error: "Send from and to as YYYY-MM-DD." }, { status: 400 })
  try {
    const built = await buildTeamReport(createAdminSupabase(), id, body.from, body.to)
    if (built.status !== 200) return NextResponse.json({ error: built.error }, { status: built.status })
    const rules = ruleInsights(built.report)
    const insights = sanitizeInsights(body.insights, rules) ?? rules
    return await renderPdf(req.nextUrl.origin, built.report, insights)
  } catch (e) {
    console.error("team report pdf failed", e)
    return failed()
  }
}
