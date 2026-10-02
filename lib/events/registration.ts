import { eventLastDayStart } from "@/lib/events/dates"

/** How long after the (last) day's start registration stays available (walk-ins). */
const GRACE_MS = 24 * 60 * 60 * 1000

/**
 * Whether an event currently accepts registrations: the admin toggle must be
 * on AND the event must not be more than a day in the past. Used by the
 * public event page, the events list, and the register API (server-side
 * enforcement).
 */
export function isEventRegistrationOpen(event: {
  registration_open?: boolean | null
  event_date?: string | null
  /** Consecutive days (071): the grace runs from the LAST day's start. */
  event_days?: number | null
}): boolean {
  if (event.registration_open === false) return false
  const last = eventLastDayStart(event.event_date, event.event_days)
  if (last && Date.now() > last.getTime() + GRACE_MS) return false
  return true
}
