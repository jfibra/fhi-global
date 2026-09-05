import { NextRequest, NextResponse } from "next/server"
import { findTodaysBirthdays, sendBirthdayGreetings } from "@/lib/birthday-greetings"
import { sendBirthdayEmail, hasMailerConfig } from "@/lib/mailer"
import { renderBirthdayPosterPng } from "@/lib/birthday-poster"
import { createAdminSupabase } from "@/lib/admin-supabase"

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

  // ?poster=<profile id> — preview that member's rendered poster PNG in the
  // browser (secret-protected; handy to check the artwork placement).
  const posterUid = req.nextUrl.searchParams.get("poster")?.trim()
  if (posterUid) {
    const admin = createAdminSupabase()
    const { data: p } = await admin
      .from("profiles")
      .select("fullname, fname, profile_url")
      .eq("id", posterUid)
      .maybeSingle()
    if (!p) return NextResponse.json({ error: "No such profile." }, { status: 404 })
    const png = await renderBirthdayPosterPng({
      name: (p.fullname ?? p.fname ?? "You").trim().replace(/\s+/g, " "),
      photoUrl: p.profile_url ?? null,
      designId: req.nextUrl.searchParams.get("design")?.trim() || undefined,
    })
    if (!png) return NextResponse.json({ error: "Poster render failed." }, { status: 500 })
    return new NextResponse(new Uint8Array(png), {
      headers: { "content-type": "image/png", "cache-control": "no-store" },
    })
  }

  const test = req.nextUrl.searchParams.get("test")?.trim()
  if (test && !isProd) {
    // A uid makes the sample use that member's real name + photo poster.
    const uid = req.nextUrl.searchParams.get("uid")?.trim()
    let posterPng: Buffer | null = null
    let name = req.nextUrl.searchParams.get("name") ?? "Juliecor"
    if (uid) {
      const admin = createAdminSupabase()
      const { data: p } = await admin
        .from("profiles")
        .select("fullname, fname, profile_url")
        .eq("id", uid)
        .maybeSingle()
      if (p) {
        name = (p.fname ?? p.fullname ?? name).trim()
        posterPng = await renderBirthdayPosterPng({
          name: (p.fullname ?? p.fname ?? name).trim().replace(/\s+/g, " "),
          photoUrl: p.profile_url ?? null,
        }).catch(() => null)
      }
    }
    await sendBirthdayEmail({ to: test, name, posterPng })
    return NextResponse.json({ ok: true, sample_sent_to: test, poster_included: Boolean(posterPng) })
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
