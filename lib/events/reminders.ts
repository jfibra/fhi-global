import "server-only"

import type { createAdminSupabase } from "@/lib/admin-supabase"
import type { CalendarSourceEvent } from "@/lib/events/calendar"
import { eventSchedule } from "@/lib/events/dates"
import { registrationDays } from "@/lib/events/pax"

/**
 * The day-before reminder (boss via Juliecor, 2026-11-14): who to email this
 * morning because an event they registered for starts tomorrow. A person on a
 * multi-day event is reminded once, the day before the first day they attend
 * (migration 091 `reminder_sent_at`).
 */

type Admin = ReturnType<typeof createAdminSupabase>

const DAY_MS = 86400e3
const shiftDay = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
const dubaiDay = (d: Date) => new Date(d.getTime() + 4 * 3600e3).toISOString().slice(0, 10)

export type ReminderEvent = CalendarSourceEvent & { venue_lat: number | null; venue_lng: number | null }
export type ReminderRegistration = { id: string; full_name: string; email: string; days: number[] | null }

export type EventReminderBatch = {
  event: ReminderEvent
  /** The day number (1-based) that starts tomorrow. */
  day: number
  registrations: ReminderRegistration[]
}

/** Google Maps for the venue: the exact pin when one was picked, else a search for the address. */
export function venueMapUrl(event: Pick<ReminderEvent, "venue" | "venue_lat" | "venue_lng">): string | null {
  if (typeof event.venue_lat === "number" && typeof event.venue_lng === "number") return `https://www.google.com/maps?q=${event.venue_lat},${event.venue_lng}`
  return event.venue ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue)}` : null
}

/** Every published event with a day starting tomorrow, with the registrations not yet reminded that attend that day. */
export async function eventRemindersDue(admin: Admin, today: string, onlyEvent?: string | null): Promise<EventReminderBatch[]> {
  const tomorrow = shiftDay(today, 1)
  let q = admin
    .from("events")
    .select("id, slug, title, venue, venue_lat, venue_lng, event_date, event_days, day_times")
    .eq("status", "published")
    .is("deleted_at", null)
    .not("event_date", "is", null)
    .gte("event_date", `${shiftDay(tomorrow, -14)}T00:00:00+04:00`)
    .lte("event_date", `${tomorrow}T23:59:59+04:00`)
    .limit(200)
  if (onlyEvent) q = q.eq("id", onlyEvent)
  const { data: events, error } = await q
  if (error) throw new Error(error.message)

  const out: EventReminderBatch[] = []
  for (const e of (events ?? []) as ReminderEvent[]) {
    const day = eventSchedule(e.event_date, e.event_days, e.day_times).find((d) => dubaiDay(d.start) === tomorrow)?.day
    if (!day) continue
    const { data: regs, error: regError } = await admin
      .from("event_registrations")
      .select("id, full_name, email, days")
      .eq("event_id", e.id)
      .is("reminder_sent_at", null)
      .limit(2000)
    if (regError) throw new Error(regError.message)
    const attending = ((regs ?? []) as ReminderRegistration[]).filter((r) => registrationDays(r.days, e.event_days).includes(day))
    if (attending.length) out.push({ event: e, day, registrations: attending })
  }
  return out
}

export async function markReminded(admin: Admin, ids: string[]): Promise<void> {
  if (!ids.length) return
  const { error } = await admin.from("event_registrations").update({ reminder_sent_at: new Date().toISOString() }).in("id", ids)
  if (error) throw new Error(error.message)
}
