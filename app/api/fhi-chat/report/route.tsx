import { NextRequest, NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF, ROLES_AGENT_ASSISTANT } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { agentReportDates, buildAgentReport } from "@/lib/agent-report/data"
import { buildAgentInsights, ruleInsights, type ModelUsage } from "@/lib/agent-report/insights"
import { agentReportBudget, recordAgentReportUsage } from "@/lib/agent-report/budget"
import { AgentReportDocument, agentReportFileName, registerReportFonts, type AgentReportImages } from "@/lib/agent-report/pdf"
import { brandImage, pdfImage } from "@/lib/company-report/brand-images"

/**
 * My Performance Report as a PDF (boss via Juliecor, 2026-11-06): FHI
 * Assistant's "my report for this month" for agents and team leaders ends in
 * a Download button that opens this. The report is ALWAYS the caller's own —
 * never a parameter — built by lib/agent-report/data.ts, coached by
 * insights.ts (the advice model, within lib/agent-report/budget.ts; the
 * standard coaching when over a limit) and drawn by pdf.tsx.
 *
 *   GET ?from=YYYY-MM-DD&to=YYYY-MM-DD   (to exclusive)
 *   GET ?period=month|last_month|quarter|last_quarter|year|last_90|last_30
 *   …&inline=1 shows it in the browser instead of downloading.
 *
 * Private, never cached: it carries a person's sales and their clients' names.
 */

export const runtime = "nodejs"
export const maxDuration = 60

const document = (props: Parameters<typeof AgentReportDocument>[0]) => <AgentReportDocument {...props} />

export async function GET(req: NextRequest) {
  const guard = await requireRole([...ROLES_AGENT_ASSISTANT, ...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const sp = req.nextUrl.searchParams
  const named = sp.get("period")
  const { from, to } = named ? agentReportDates(named) : { from: sp.get("from") ?? "", to: sp.get("to") ?? "" }
  const origin = req.nextUrl.origin
  try {
    const admin = createAdminSupabase()
    const { userId, profile, email } = guard.context
    const built = await buildAgentReport(admin, { userId, name: profile.fullname, role: profile.role, email }, from, to)
    if (built.status !== 200) return NextResponse.json({ error: built.error }, { status: built.status })
    const report = built.report

    // The coaching: AI within the person's budget, the standard one otherwise — never a report without it.
    const gate = await agentReportBudget(admin, userId)
    let insights = ruleInsights(report)
    if (gate.allowed) {
      const usages: ModelUsage[] = []
      insights = await buildAgentInsights(report, { timeoutMs: 25_000, onUsage: (u) => usages.push(u) })
      for (const u of usages) await recordAgentReportUsage(admin, { userId, role: profile.role, from, to, model: u.model, promptTokens: u.promptTokens, completionTokens: u.completionTokens, ok: u.ok })
    }

    registerReportFonts(origin)
    const [whiteLogo, navyLogo, photo] = await Promise.all([brandImage(origin, "FHI_Branding_White.png", 480), brandImage(origin, "fhi-branding-navy.png", 300), pdfImage(report.person.photo, 320, { photo: true })])
    const images: AgentReportImages = { whiteLogo, navyLogo, photo }
    const pdf = await renderToBuffer(document({ r: report, insights, images }))
    const inline = sp.get("inline") === "1"
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${agentReportFileName(report.person.name, from, to)}"`,
        "Cache-Control": "private, no-store",
        "X-Report-Insights": insights.source,
        ...(gate.allowed ? {} : { "X-Report-Note": gate.note.replace(/[^\x20-\x7e]/g, "") }),
      },
    })
  } catch (e) {
    console.error("agent report failed", e)
    return NextResponse.json({ error: "Couldn't build the report. Try again in a moment." }, { status: 500 })
  }
}
