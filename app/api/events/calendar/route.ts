import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { eventCalendarEntries, eventIcs, icsFilename } from "@/lib/events/calendar"
import { SITE_URL } from "@/lib/seo"

/**
 * The .ics file for an event — "Apple / Outlook" on the thank-you screen and
 * in the emails. Public like the event page itself; only a published, live
 * event answers. GET ?event=<id>[&days=1,2] (days = the ones the person
 * attends; every day when omitted).
 */

export const runtime = "nodejs"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const id = (q.get("event") ?? "").trim()
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid event" }, { status: 400 })
  const days = (q.get("days") ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 14)

  const admin = createAdminSupabase()
  const { data: event, error } = await admin
    .from("events")
    .select("id, slug, title, venue, event_date, event_days, day_times, status, deleted_at")
    .eq("id", id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: "Couldn't read the event." }, { status: 500 })
  if (!event || event.status !== "published" || event.deleted_at) return NextResponse.json({ error: "No such event" }, { status: 404 })

  const entries = eventCalendarEntries(event as Parameters<typeof eventCalendarEntries>[0], days.length ? days : null, SITE_URL)
  if (!entries.length) return NextResponse.json({ error: "This event has no date yet." }, { status: 404 })

  return new NextResponse(eventIcs(entries, event.id as string), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${icsFilename({ slug: event.slug as string | null, id: event.id as string })}"`,
      "cache-control": "public, max-age=300",
    },
  })
}
