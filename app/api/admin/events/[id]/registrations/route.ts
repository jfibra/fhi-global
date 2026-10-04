import { NextRequest, NextResponse } from "next/server"
import { canAccessEvent, eventNotFound, requireEventAccess } from "@/lib/events/access"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { titleCaseName } from "@/lib/public-profile"
import { daySeats, registrationDays, type DaySeats } from "@/lib/events/pax"
import { eventSchedule, normalizeEventDays } from "@/lib/events/dates"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Attendee list for one event — admin only (service role; RLS keeps this table
 * closed otherwise). Pax per date (075): each row says which days it attends,
 * and `seats` gives every day's count against its limit — counted in the
 * database, so it stays right past the list's 1000-row cap.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireEventAccess()
  if (!access.ok) return access.response

  const { id } = await params
  // Admin staff: any event; an agent: only their own (migration 057).
  if (!(await canAccessEvent(createAdminSupabase(), id, access.scope))) return eventNotFound()
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 })

  const admin = createAdminSupabase()
  const [{ data, error }, { data: event }, { data: counts }] = await Promise.all([
    admin
      .from("event_registrations")
      .select("id, full_name, email, whatsapp, invited_by, answers, days, created_at, certificate_sent_at")
      .eq("event_id", id)
      .order("created_at", { ascending: false })
      .limit(1000),
    admin.from("events").select("event_days, day_pax").eq("id", id).maybeSingle(),
    admin.rpc("event_day_counts", { p_event_id: id }),
  ])

  if (error) {
    return NextResponse.json({ error: "Failed to load registrations" }, { status: 500 })
  }

  // Attendees type their own names, often in ALL CAPS. Present them in proper
  // case everywhere the admin sees them (table, exports, raffle); the stored
  // value stays exactly as entered.
  const registrations = (data ?? []).map((r) => ({
    id: r.id as string,
    fullName: titleCaseName(r.full_name as string),
    email: r.email as string,
    whatsapp: (r.whatsapp as string | null) ?? null,
    invitedBy: r.invited_by ? titleCaseName(r.invited_by as string) : null,
    answers: (r.answers as Record<string, string | number | boolean> | null) ?? {},
    days: registrationDays(r.days, event?.event_days),
    createdAt: r.created_at as string,
    certificateSentAt: (r.certificate_sent_at as string | null) ?? null,
  }))

  return NextResponse.json({ registrations, seats: daySeats(event?.day_pax, event?.event_days, counts ?? []) })
}

/** Remove one registration (e.g. test/dummy sign-ups) — hard delete, scoped to the event. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireEventAccess()
  if (!access.ok) return access.response

  const { id } = await params
  // Admin staff: any event; an agent: only their own (migration 057).
  if (!(await canAccessEvent(createAdminSupabase(), id, access.scope))) return eventNotFound()
  const body = (await req.json().catch(() => ({}))) as { registrationId?: unknown }
  const registrationId = typeof body.registrationId === "string" ? body.registrationId : ""
  if (!UUID_RE.test(id) || !UUID_RE.test(registrationId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { error } = await admin
    .from("event_registrations")
    .delete()
    .eq("id", registrationId)
    .eq("event_id", id)

  if (error) {
    return NextResponse.json({ error: "Failed to delete registration" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Edit one registration's details. Only the fields present in the body change,
 * so the inline "Invited by" editor (which sends invitedBy alone) and the full
 * edit form share this handler. Empty invitedBy/whatsapp clear the value.
 *
 * `days` (Change days, 076) re-picks which days of a multi-day event the
 * person attends — through event_registration_set_days(), which locks the
 * event like a sign-up does and refuses a day being added that is full.
 * Answers with the person's days and every day's fresh seat count.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireEventAccess()
  if (!access.ok) return access.response

  const { id } = await params
  // Admin staff: any event; an agent: only their own (migration 057).
  if (!(await canAccessEvent(createAdminSupabase(), id, access.scope))) return eventNotFound()
  const body = (await req.json().catch(() => ({}))) as {
    registrationId?: unknown
    invitedBy?: unknown
    fullName?: unknown
    email?: unknown
    whatsapp?: unknown
    days?: unknown
  }
  const registrationId = typeof body.registrationId === "string" ? body.registrationId : ""
  if (!UUID_RE.test(id) || !UUID_RE.test(registrationId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const admin = createAdminSupabase()

  const clean = (v: unknown, max: number) =>
    typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : ""

  const update: Record<string, string | null> = {}

  if ("invitedBy" in body) {
    update.invited_by = clean(body.invitedBy, 120) || null
  }
  if ("fullName" in body) {
    const fullName = clean(body.fullName, 160)
    if (!fullName) return NextResponse.json({ error: "Name can't be empty" }, { status: 400 })
    update.full_name = fullName
  }
  if ("email" in body) {
    const email = clean(body.email, 255).toLowerCase()
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 })
    update.email = email
  }
  if ("whatsapp" in body) {
    update.whatsapp = clean(body.whatsapp, 40) || null
  }

  // Change days (after the fields above are checked, so a bad field never
  // leaves the days half-saved): only a multi-day event has days to pick.
  let days: number[] | undefined
  let seats: DaySeats[] | undefined
  if ("days" in body) {
    const { data: event } = await admin
      .from("events")
      .select("event_date, event_days, day_times, day_pax")
      .eq("id", id)
      .maybeSingle()
    const eventDays = normalizeEventDays(event?.event_days)
    if (!event || eventDays < 2) {
      return NextResponse.json({ error: "Only a multi-day event has days to change" }, { status: 400 })
    }
    const picked = Array.isArray(body.days) ? body.days.map(Number) : []
    days = [...new Set(picked.filter((d) => Number.isInteger(d) && d >= 1 && d <= eventDays))].sort((a, b) => a - b)
    if (days.length === 0) return NextResponse.json({ error: "Pick at least one day" }, { status: 400 })

    const { data: result, error: daysError } = await admin.rpc("event_registration_set_days", {
      p_event_id: id,
      p_registration_id: registrationId,
      p_days: days,
    })
    if (daysError) {
      console.error("[events/registrations] change days failed:", daysError.message)
      return NextResponse.json({ error: "Failed to change days" }, { status: 500 })
    }
    const row = (Array.isArray(result) ? result[0] : result) as { ok: boolean; full_day: number | null } | null
    if (!row?.ok) {
      if (!row?.full_day) return NextResponse.json({ error: "Registration not found" }, { status: 404 })
      const when = eventSchedule(event.event_date as string | null, event.event_days, event.day_times)[row.full_day - 1]
      return NextResponse.json(
        { error: `Day ${row.full_day}${when ? ` (${when.dateLabel})` : ""} is full — raise its pax in Edit event to add more people.`, full_day: row.full_day },
        { status: 409 },
      )
    }
    const { data: counts } = await admin.rpc("event_day_counts", { p_event_id: id })
    seats = daySeats(event.day_pax, event.event_days, counts ?? [])
  }

  if (Object.keys(update).length === 0 && days === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  if (Object.keys(update).length > 0) {
    const { error } = await admin
      .from("event_registrations")
      .update(update)
      .eq("id", registrationId)
      .eq("event_id", id)

    if (error) {
      return NextResponse.json({ error: "Failed to update registration" }, { status: 500 })
    }
  }
  return NextResponse.json({
    ok: true,
    ...(days !== undefined ? { days, seats } : {}),
    ...(update.invited_by !== undefined ? { invitedBy: update.invited_by ? titleCaseName(update.invited_by) : null } : {}),
    ...(update.full_name !== undefined ? { fullName: update.full_name } : {}),
    ...(update.email !== undefined ? { email: update.email } : {}),
    ...(update.whatsapp !== undefined ? { whatsapp: update.whatsapp } : {}),
  })
}
