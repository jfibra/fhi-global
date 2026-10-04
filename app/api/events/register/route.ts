import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { parseRegistrationFields, validateAnswers } from "@/lib/events/fields"
import { isEventRegistrationOpen } from "@/lib/events/registration"
import { normalizeEventDays, eventSchedule } from "@/lib/events/dates"
import { sendEventRegistrationEmail } from "@/lib/mailer"
import { SITE_URL } from "@/lib/seo"
import { titleCaseName } from "@/lib/public-profile"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Public event registration (reached from the event page / its QR code).
 * Intentionally unauthenticated — attendees are not portal users. Validates
 * against published events only; the unique index rejects duplicate emails.
 *
 * Pax per date (075): a multi-day event's sign-up ticks the days it attends
 * (`days`, at least one); a one-day event's doesn't. event_register() checks
 * each chosen day still has room and inserts in one locked step, so a full
 * date answers 409 and names it.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  const eventId = typeof body.eventId === "string" ? body.eventId.trim() : ""
  const fullName = typeof body.fullName === "string" ? body.fullName.trim().slice(0, 120) : ""
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : ""
  const whatsapp = typeof body.whatsapp === "string" ? body.whatsapp.trim().slice(0, 40) : ""
  const invitedBy = typeof body.invitedBy === "string" ? body.invitedBy.trim().slice(0, 120) : ""

  if (!UUID_RE.test(eventId)) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 })
  }
  if (!fullName || fullName.length < 2) {
    return NextResponse.json({ error: "Please enter your full name" }, { status: 400 })
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 })
  }

  const admin = createAdminSupabase()

  const { data: event, error: eventError } = await admin
    .from("events")
    .select("id, slug, title, venue, status, deleted_at, event_date, event_days, day_times, registration_open, registration_fields")
    .eq("id", eventId)
    .maybeSingle()

  if (eventError) {
    console.error("[events/register] event lookup failed:", eventError)
    return NextResponse.json({ error: "Registration failed — please try again" }, { status: 500 })
  }
  if (!event || event.status !== "published" || event.deleted_at) {
    return NextResponse.json({ error: "This event is not open for registration" }, { status: 404 })
  }
  if (!isEventRegistrationOpen(event)) {
    return NextResponse.json({ error: "Registration for this event has closed" }, { status: 403 })
  }

  // Answers are checked against the event's CURRENT field list, so a field
  // removed since the page was opened cannot smuggle data through, and a
  // required one cannot be skipped by posting straight to the API.
  const fields = parseRegistrationFields(event.registration_fields)
  const checked = validateAnswers(fields, body.answers)
  if (!checked.ok) {
    return NextResponse.json({ error: checked.error }, { status: 400 })
  }

  // The days this sign-up attends: only a multi-day event asks (NULL = every day).
  const eventDays = normalizeEventDays(event.event_days)
  let days: number[] | null = null
  if (eventDays > 1) {
    const picked = Array.isArray(body.days) ? body.days.map(Number) : []
    days = [...new Set(picked.filter((d) => Number.isInteger(d) && d >= 1 && d <= eventDays))].sort((a, b) => a - b)
    if (days.length === 0) {
      return NextResponse.json({ error: "Please choose the day(s) you'll attend" }, { status: 400 })
    }
  }

  const { data: result, error } = await admin.rpc("event_register", {
    p_event_id: eventId,
    p_full_name: fullName,
    p_email: email,
    p_whatsapp: whatsapp || null,
    p_invited_by: invitedBy || null,
    p_answers: checked.answers,
    p_days: days,
  })

  if (error) {
    if (error.code === "23505") {
      // One registration per email: on a multi-day event, a new day is added by the organizer (Change days).
      const message =
        eventDays > 1
          ? "This email is already registered for this event. To add or change your days, please contact the organizer."
          : "This email is already registered for the event"
      return NextResponse.json({ error: message }, { status: 409 })
    }
    console.error("[events/register] insert failed:", error.message)
    return NextResponse.json({ error: "Registration failed — please try again" }, { status: 500 })
  }
  const row = (Array.isArray(result) ? result[0] : result) as { registration_id: string | null; full_day: number | null } | null
  if (!row?.registration_id) {
    const full = row?.full_day ?? null
    const when = full ? eventSchedule(event.event_date as string | null, event.event_days, event.day_times)[full - 1] : null
    const message =
      eventDays > 1 && full
        ? `Day ${full}${when ? ` (${when.dateLabel})` : ""} is fully booked — please choose another day.`
        : "This event is fully booked."
    return NextResponse.json({ error: message, full_day: full }, { status: 409 })
  }

  // Confirmation email — best effort; a mail hiccup must never undo a
  // successful registration.
  try {
    await sendEventRegistrationEmail({
      to: email,
      fullName: titleCaseName(fullName),
      eventTitle: (event.title as string) ?? "FHI Global event",
      eventDate: (event.event_date as string | null) ?? null,
      eventDays: (event.event_days as number | null) ?? 1,
      dayTimes: event.day_times,
      venue: (event.venue as string | null) ?? null,
      attendingDays: days,
      eventUrl: `${SITE_URL.replace(/\/$/, "")}/events/${(event.slug as string | null) ?? eventId}`,
    })
  } catch (e) {
    console.error("[events/register] confirmation email failed:", e instanceof Error ? e.message : e)
  }

  return NextResponse.json({ ok: true })
}
