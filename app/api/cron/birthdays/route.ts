import { NextRequest, NextResponse } from "next/server"
import { findTodaysBirthdays, sendBirthdayGreetings } from "@/lib/birthday-greetings"
import { sendBirthdayEmail, hasMailerConfig } from "@/lib/mailer"

/**
 * Birthday greetings cron — 8:30 AM Dubai daily (vercel.json "30 4 * * *"
 * UTC). Every active member/agent with a birthday today gets the branded
 * greeting. Same auth as the daily report: Vercel sends
 * "Authorization: Bearer $CRON_SECRET"; manual runs can pass ?secret=.
 *
 * Extras: ?dry=1 lists today's birthday people WITHOUT sending (works in
 * prod too — safe check); ?test=<email> (non-production only) sends one
 * sample greeting to that address instead of the real run.
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

  const test = req.nextUrl.searchParams.get("test")?.trim()
  if (test && !isProd) {
    await sendBirthdayEmail({ to: test, name: req.nextUrl.searchParams.get("name") ?? "Juliecor" })
    return NextResponse.json({ ok: true, sample_sent_to: test })
  }

  if (req.nextUrl.searchParams.get("dry")) {
    const people = await findTodaysBirthdays()
    return NextResponse.json({
      ok: true,
      dry_run: true,
      birthdays_today: people.map((p) => ({ name: p.name, role: p.role, has_email: Boolean(p.email) })),
    })
  }

  const result = await sendBirthdayGreetings()
  return NextResponse.json({ ok: true, ...result })
}
