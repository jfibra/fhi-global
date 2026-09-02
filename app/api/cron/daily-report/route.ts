import { NextRequest, NextResponse } from "next/server"
import { buildDailyReport } from "@/lib/daily-report"
import { sendDailyReportEmail, hasMailerConfig } from "@/lib/mailer"

/**
 * The 8AM (Dubai) daily report email — triggered by Vercel Cron (vercel.json:
 * "0 4 * * *" UTC). Vercel calls with "Authorization: Bearer $CRON_SECRET";
 * a manual test can pass ?secret= instead. In local dev, with no CRON_SECRET
 * set, the route is open and ?to= can override the recipient for testing.
 * Recipient(s) come from DAILY_REPORT_TO (comma-separated for several).
 */

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const isProd = process.env.NODE_ENV === "production"
  if (secret) {
    const auth = req.headers.get("authorization")
    const qs = req.nextUrl.searchParams.get("secret")
    if (auth !== `Bearer ${secret}` && qs !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  } else if (isProd) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 })
  }

  if (!hasMailerConfig()) {
    return NextResponse.json({ error: "SMTP is not configured." }, { status: 503 })
  }
  const configured = (process.env.DAILY_REPORT_TO ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  // Local testing convenience only — production always uses the env list.
  const to = configured.length ? configured : !isProd ? [req.nextUrl.searchParams.get("to") ?? ""].filter(Boolean) : []
  if (!to.length) {
    return NextResponse.json({ error: "DAILY_REPORT_TO is not configured." }, { status: 503 })
  }

  const report = await buildDailyReport()
  await sendDailyReportEmail(to, report)
  return NextResponse.json({ ok: true, sent_to: to, report_for: report.dateLabel })
}
