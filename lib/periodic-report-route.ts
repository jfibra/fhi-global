import "server-only"

import { NextRequest, NextResponse } from "next/server"
import { buildPeriodicReport, type ReportKind } from "@/lib/periodic-report"
import { renderReportPng } from "@/lib/report-image"
import { hasMailerConfig, sendPeriodicReportEmail } from "@/lib/mailer"

/**
 * Shared handler for the weekly (Monday) and monthly (1st) report crons —
 * same guard and recipient rules as the daily report: Vercel calls with
 * "Authorization: Bearer $CRON_SECRET" (manual runs may pass ?secret=);
 * recipients come from DAILY_REPORT_TO. In local dev without CRON_SECRET the
 * route is open and ?to= can override the recipient.
 *
 * Dev-only checks that never send: ?dry=1 returns the report JSON;
 * ?preview=1 returns the picture as a PNG.
 */
export async function handlePeriodicReport(req: NextRequest, kind: ReportKind) {
  const secret = process.env.CRON_SECRET?.trim()
  const isProd = process.env.NODE_ENV === "production"
  if (secret) {
    const auth = req.headers.get("authorization")
    const qs = req.nextUrl.searchParams.get("secret")
    if (auth !== `Bearer ${secret}` && qs !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  } else if (isProd) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 })
  }

  const report = await buildPeriodicReport(kind)
  const dry = !isProd && req.nextUrl.searchParams.get("dry") === "1"
  const preview = !isProd && req.nextUrl.searchParams.get("preview") === "1"
  if (dry) return NextResponse.json({ report, picture: null })
  const picture = await renderReportPng(report)
  if (preview) {
    if (!picture) return NextResponse.json({ error: "Nothing to draw" }, { status: 404 })
    return new NextResponse(new Uint8Array(picture), { headers: { "content-type": "image/png", "cache-control": "no-store" } })
  }

  if (!hasMailerConfig()) return NextResponse.json({ error: "SMTP is not configured." }, { status: 503 })
  const configured = (process.env.DAILY_REPORT_TO ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  const to = configured.length ? configured : !isProd ? [req.nextUrl.searchParams.get("to") ?? ""].filter(Boolean) : []
  if (!to.length) return NextResponse.json({ error: "DAILY_REPORT_TO is not configured." }, { status: 503 })

  await sendPeriodicReportEmail(to, report, picture)
  return NextResponse.json({ ok: true, kind, sent_to: to, period: report.periodLabel, picture: Boolean(picture) })
}
