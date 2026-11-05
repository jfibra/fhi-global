import "server-only"

import { NextRequest, NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { brandImage, pdfImage } from "@/lib/company-report/brand-images"
import { registerReportFonts } from "@/lib/company-report/pdf-kit"
import { sseEvents } from "@/lib/fhi-chat-stream"
import { recordReportUsage, reportBudget, type ReportBudget } from "./budget"
import { buildTeamReport, type TeamReport } from "./data"
import { buildTeamInsights, ruleInsights, sanitizeInsights, type ModelUsage, type TeamInsights } from "./insights"
import { TeamReportDocument, teamReportFileName, type TeamReportImages } from "./pdf"

/**
 * The request logic of the Team Performance Report, shared by its two doors so they can never drift
 * apart: the admin route (app/api/admin/teams/[id]/report — any team, admin staff) and the leader
 * route (app/api/team/report — the caller's OWN team, resolved on the server, never from the request).
 * The doors check who may ask and for which team; everything below trusts that.
 *
 *   GET  ?from&to&format=json   { report, insights, note }; with Accept: text/event-stream:
 *                               status > report > status > insights > done
 *   POST { from, to, insights } the PDF of what the page shows — the analysis is the one posted back
 *                               (checked), so the model runs once per report and costs nothing here
 *   GET  ?from&to               the PDF straight away (direct link)
 *
 * `note` says why the standard analysis was used instead of the AI one (a leader over their daily
 * limit, or the month's budget). Admins are never limited. to is exclusive; never cached.
 */

export type ReportActor = { kind: "admin" } | { kind: "leader"; userId: string; role: string | null }

type Admin = ReturnType<typeof createAdminSupabase>

type ReportEvent =
  | { type: "status"; text: string }
  | { type: "report"; report: TeamReport }
  | { type: "insights"; insights: TeamInsights; note: string | null }
  | { type: "done" }
  | { type: "error"; error: string }

/** The document element, built outside the handlers' try/catch (rendering errors surface from renderToBuffer). */
const reportDocument = (props: Parameters<typeof TeamReportDocument>[0]) => <TeamReportDocument {...props} />

const lastDay = (toExclusive: string) => new Date(Date.parse(`${toExclusive}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
const failed = () => NextResponse.json({ error: "Couldn't build the report. Try again in a moment." }, { status: 500 })
const buildOptions = (actor: ReportActor) => (actor.kind === "leader" ? { networkRootIds: [actor.userId] } : {})

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

/** The analysis for a report: the AI one, or — for a leader over a limit — the standard one with the reason. */
async function analyse(admin: Admin, report: TeamReport, actor: ReportActor, timeoutMs?: number): Promise<{ insights: TeamInsights; note: string | null }> {
  let gate: ReportBudget = { allowed: true }
  if (actor.kind === "leader") gate = await reportBudget(admin, actor.userId)
  if (!gate.allowed) return { insights: ruleInsights(report), note: gate.note }
  const usages: ModelUsage[] = []
  const insights = await buildTeamInsights(report, { timeoutMs, onUsage: (u) => usages.push(u) })
  if (actor.kind === "leader") {
    for (const u of usages) await recordReportUsage(admin, { userId: actor.userId, role: actor.role, from: report.period.from, to: report.period.to, model: u.model, promptTokens: u.promptTokens, completionTokens: u.completionTokens, ok: u.ok })
  }
  return { insights, note: null }
}

export async function reportGET(req: NextRequest, teamId: string, actor: ReportActor): Promise<Response> {
  const from = req.nextUrl.searchParams.get("from") ?? ""
  const to = req.nextUrl.searchParams.get("to") ?? ""
  const admin = createAdminSupabase()
  const asJson = req.nextUrl.searchParams.get("format") === "json"

  if (asJson && req.headers.get("accept")?.includes("text/event-stream")) {
    return sseEvents<ReportEvent>(
      async (send) => {
        const built = await buildTeamReport(admin, teamId, from, to, buildOptions(actor))
        if (built.status !== 200) {
          send({ type: "error", error: built.error })
          return
        }
        send({ type: "report", report: built.report })
        send({ type: "status", text: "FHI Assistant is writing the analysis…" })
        const { insights, note } = await analyse(admin, built.report, actor)
        send({ type: "insights", insights, note })
        send({ type: "done" })
      },
      { type: "status", text: "Adding up the team's sales, recruits and requirements…" },
      { type: "error", error: "Couldn't build the report. Try again in a moment." },
    )
  }

  try {
    const built = await buildTeamReport(admin, teamId, from, to, buildOptions(actor))
    if (built.status !== 200) return NextResponse.json({ error: built.error }, { status: built.status })
    if (asJson) {
      const { insights, note } = await analyse(admin, built.report, actor)
      return NextResponse.json({ report: built.report, insights, note }, { headers: { "Cache-Control": "private, no-store", "X-Report-Insights": insights.source } })
    }
    const { insights } = await analyse(admin, built.report, actor, 20_000)
    return await renderPdf(req.nextUrl.origin, built.report, insights)
  } catch (e) {
    console.error("team report failed", e)
    return failed()
  }
}

export async function reportPOST(req: NextRequest, teamId: string, actor: ReportActor): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { from?: unknown; to?: unknown; insights?: unknown } | null
  if (!body || typeof body.from !== "string" || typeof body.to !== "string") return NextResponse.json({ error: "Send from and to as YYYY-MM-DD." }, { status: 400 })
  try {
    const built = await buildTeamReport(createAdminSupabase(), teamId, body.from, body.to, buildOptions(actor))
    if (built.status !== 200) return NextResponse.json({ error: built.error }, { status: built.status })
    const rules = ruleInsights(built.report)
    const insights = sanitizeInsights(body.insights, rules) ?? rules
    return await renderPdf(req.nextUrl.origin, built.report, insights)
  } catch (e) {
    console.error("team report pdf failed", e)
    return failed()
  }
}
