import { eventSchedule, normalizeEventDays } from "@/lib/events/dates"
import { eventPublicPath } from "@/lib/events/paths"

/**
 * "Add to my calendar" for event registrations (boss via Juliecor,
 * 2026-11-14): a website cannot write into someone's calendar, but it can hand
 * the calendar a ready-made event that the person approves with one tap. Two
 * forms, both standard: a Google Calendar link (opens pre-filled) and an .ics
 * file (Apple Calendar, Outlook, and Google too). Their own calendar then does
 * the reminding. Used by the thank-you screen, the confirmation email, the
 * day-before reminder email and GET /api/events/calendar.
 *
 * Safe in the browser and on the server (no imports beyond the date helpers).
 */

/** Events store a start time only; a calendar entry needs an end, so it runs this long. */
export const EVENT_HOURS = 2

export type CalendarSourceEvent = {
  id: string
  slug: string | null
  title: string
  venue: string | null
  event_date: string | null
  event_days?: number | null
  day_times?: unknown
}

export type EventCalendarEntry = {
  day: number
  of: number
  /** "Fri 21 Nov" style, Dubai. */
  dateLabel: string
  /** "11:00" style, Dubai. */
  time: string
  title: string
  start: Date
  end: Date
  location: string | null
  url: string
  description: string
}

export const DEFAULT_SITE = "https://fhiglobal.ae"

/**
 * One entry per day the person attends (every day when `attendingDays` is
 * null), each at that day's own start time (072). Nothing for an event with no
 * date yet.
 */
export function eventCalendarEntries(event: CalendarSourceEvent, attendingDays: number[] | null | undefined, siteUrl = DEFAULT_SITE): EventCalendarEntry[] {
  const schedule = eventSchedule(event.event_date, event.event_days, event.day_times)
  if (!schedule.length) return []
  const n = normalizeEventDays(event.event_days)
  const wanted = attendingDays?.length ? new Set(attendingDays) : null
  const url = `${siteUrl.replace(/\/$/, "")}${eventPublicPath({ id: event.id, slug: event.slug })}`
  return schedule
    .filter((d) => !wanted || wanted.has(d.day))
    .map((d) => ({
      day: d.day,
      of: n,
      dateLabel: d.dateLabel,
      time: d.time,
      title: n > 1 ? `${event.title} · Day ${d.day}` : event.title,
      start: d.start,
      end: new Date(d.start.getTime() + EVENT_HOURS * 3600e3),
      location: event.venue?.trim() || null,
      url,
      description: `You are registered for this FHI Global event. Details and directions: ${url}`,
    }))
}

/** 20261121T070000Z — the UTC instant in the compact form calendars take. */
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")

/** A link that opens Google Calendar with the event filled in; the person taps Save. */
export function googleCalendarUrl(e: EventCalendarEntry): string {
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${stamp(e.start)}/${stamp(e.end)}`,
    details: e.description,
    ctz: "Asia/Dubai",
  })
  if (e.location) q.set("location", e.location)
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}

/** Our .ics endpoint for an event and the days to include (all when empty). */
export function eventIcsPath(eventId: string, days?: number[] | null): string {
  const d = days?.length ? `&days=${days.join(",")}` : ""
  return `/api/events/calendar?event=${encodeURIComponent(eventId)}${d}`
}

// ─── The .ics file (RFC 5545) ────────────────────────────────────────────────

const escapeText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")

/** Lines longer than 75 octets continue on the next line after a space. */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8")
  if (bytes.length <= 75) return line
  const out: string[] = []
  let i = 0
  let first = true
  while (i < bytes.length) {
    const max = first ? 75 : 74
    let j = Math.min(i + max, bytes.length)
    // Never split inside a multi-byte character.
    while (j < bytes.length && j > i && (bytes[j] & 0xc0) === 0x80) j--
    out.push((first ? "" : " ") + bytes.subarray(i, j).toString("utf8"))
    i = j
    first = false
  }
  return out.join("\r\n")
}

/** One file holding every entry, each with a one-hour-before alert for calendars that honour it. */
export function eventIcs(entries: EventCalendarEntry[], eventId: string, now = new Date()): string {
  const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FHI Global//Events//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"]
  for (const e of entries) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${eventId}-day${e.day}@fhiglobal.ae`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(e.end)}`,
      `SUMMARY:${escapeText(e.title)}`,
      ...(e.location ? [`LOCATION:${escapeText(e.location)}`] : []),
      `DESCRIPTION:${escapeText(e.description)}`,
      `URL:${e.url}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT1H",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(e.title)} starts in one hour`,
      "END:VALARM",
      "END:VEVENT",
    )
  }
  lines.push("END:VCALENDAR")
  return lines.map(fold).join("\r\n") + "\r\n"
}

/** "fhi-global-be-the-landlord.ics" */
export function icsFilename(event: Pick<CalendarSourceEvent, "slug" | "id">): string {
  return `fhi-global-${(event.slug ?? event.id).replace(/[^a-z0-9-]+/gi, "-").slice(0, 60)}.ics`
}
