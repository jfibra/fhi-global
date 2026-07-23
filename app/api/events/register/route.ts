import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { isEventRegistrationOpen } from "@/lib/events/registration"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Public event registration (reached from the event page / its QR code).
 * Intentionally unauthenticated — attendees are not portal users. Validates
 * against published events only; the unique index rejects duplicate emails.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  const eventId = typeof body.eventId === "string" ? body.eventId.trim() : ""
  const fullName = typeof body.fullName === "string" ? body.fullName.trim().slice(0, 120) : ""
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : ""
  const whatsapp = typeof body.whatsapp === "string" ? body.whatsapp.trim().slice(0, 40) : ""

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

  const { data: event } = await admin
    .from("events")
    .select("id, status, deleted_at, event_date, registration_open")
    .eq("id", eventId)
    .maybeSingle()

  if (!event || event.status !== "published" || event.deleted_at) {
    return NextResponse.json({ error: "This event is not open for registration" }, { status: 404 })
  }
  if (!isEventRegistrationOpen(event)) {
    return NextResponse.json({ error: "Registration for this event has closed" }, { status: 403 })
  }

  const { error } = await admin.from("event_registrations").insert({
    event_id: eventId,
    full_name: fullName,
    email,
    whatsapp: whatsapp || null,
  })

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "This email is already registered for the event" }, { status: 409 })
    }
    return NextResponse.json({ error: "Registration failed — please try again" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
