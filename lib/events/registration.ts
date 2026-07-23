/** How long after the event's start registration stays available (walk-ins). */
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
}): boolean {
  if (event.registration_open === false) return false
  if (event.event_date) {
    const t = new Date(event.event_date).getTime()
    if (!Number.isNaN(t) && Date.now() > t + GRACE_MS) return false
  }
  return true
}
