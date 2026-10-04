// Pax per date (migration 075). Every date of an event has its own
// registration list and its own pax: events.day_pax holds the most attendees
// each day takes (index = day − 1, null = no limit), and a registration's
// `days` lists the days it attends (NULL = every day — one-day events and
// registrations made before 075). One sign-up can tick several dates and
// counts one pax on each; a full date closes on its own.

import { normalizeEventDays } from "@/lib/events/dates"

/** Biggest pax an organiser can set for one day. */
export const MAX_DAY_PAX = 100_000

/** day_pax tidied to exactly `days` entries: a whole number ≥ 1, or null for no limit. */
export function normalizeDayPax(raw: unknown, days: unknown): (number | null)[] {
  const n = normalizeEventDays(days)
  const list = Array.isArray(raw) ? raw : []
  return Array.from({ length: n }, (_, i) => {
    const v = typeof list[i] === "string" ? Number(list[i]) : list[i]
    return typeof v === "number" && Number.isFinite(v) && v >= 1 ? Math.min(MAX_DAY_PAX, Math.floor(v)) : null
  })
}

/** Does any day have a limit? */
export function hasPaxLimits(dayPax: unknown, days: unknown): boolean {
  return normalizeDayPax(dayPax, days).some((v) => v !== null)
}

/** The days a registration attends: its own list, or every day when it has none. */
export function registrationDays(days: unknown, eventDays: unknown): number[] {
  const n = normalizeEventDays(eventDays)
  if (Array.isArray(days) && days.length) {
    return [...new Set(days.map(Number).filter((d) => Number.isInteger(d) && d >= 1 && d <= n))].sort((a, b) => a - b)
  }
  return Array.from({ length: n }, (_, i) => i + 1)
}

/** One date's seats: its limit (null = none), how many are taken, and what's left. */
export type DaySeats = { day: number; limit: number | null; taken: number; left: number | null; full: boolean }

/** Seats per day from the event's limits and each day's count (rpc event_day_counts). */
export function daySeats(dayPax: unknown, eventDays: unknown, counts: Array<{ day: unknown; taken: unknown }>): DaySeats[] {
  return normalizeDayPax(dayPax, eventDays).map((limit, i) => {
    const taken = Number(counts.find((c) => Number(c.day) === i + 1)?.taken) || 0
    const left = limit === null ? null : Math.max(0, limit - taken)
    return { day: i + 1, limit, taken, left, full: left === 0 }
  })
}

/** What the public seats endpoint hands out — no head count for a day without a limit. */
export type PublicDaySeats = Omit<DaySeats, "taken">

/** Seats as the public sees them: what's left on limited days, nothing about who came. */
export function publicDaySeats(seats: DaySeats[]): PublicDaySeats[] {
  return seats.map(({ day, limit, left, full }) => ({ day, limit, left, full }))
}

/** "Day 2" etc. for a list of days; "All days" when it's every day of a multi-day event. */
export function daysLabel(days: number[], eventDays: unknown): string {
  const n = normalizeEventDays(eventDays)
  if (n <= 1) return ""
  if (days.length === n) return "All days"
  return days.map((d) => `Day ${d}`).join(", ")
}
