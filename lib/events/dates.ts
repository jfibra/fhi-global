// Event dates in one place (migration 071): an event starts at `event_date`
// (a UTC instant entered as Dubai wall time) and runs `event_days` consecutive
// days, 1 by default. The last day starts at the same clock time as the first,
// so "past" and the registration cut-off follow the LAST day: a three-day
// summit stays upcoming and open for registration until its third day.
//
// Every label is Dubai time (GST, UTC+4, no DST) whatever the machine's zone,
// like the rest of events. Safe on the server and in the browser.

export const MAX_EVENT_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

/** A whole number of days, 1–14; anything else is 1. */
export function normalizeEventDays(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
  return Number.isInteger(n) && n >= 1 && n <= MAX_EVENT_DAYS ? n : 1
}

const valid = (iso: string | null | undefined): Date | null => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** When the last day starts (the first day for a one-day event). */
export function eventLastDayStart(startIso: string | null | undefined, days: unknown): Date | null {
  const d = valid(startIso)
  return d ? new Date(d.getTime() + (normalizeEventDays(days) - 1) * DAY_MS) : null
}

/** True once the last day has started — the event moves to "past". */
export function eventIsPast(startIso: string | null | undefined, days: unknown, now = Date.now()): boolean {
  const last = eventLastDayStart(startIso, days)
  return last ? last.getTime() < now : false
}

type Parts = { weekday: string; weekdayShort: string; day: string; month: string; monthShort: string; year: string }

function dubaiParts(d: Date): Parts {
  const get = (opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-AE", { ...opts, timeZone: "Asia/Dubai" })
  return {
    weekday: get({ weekday: "long" }),
    weekdayShort: get({ weekday: "short" }),
    day: get({ day: "numeric" }),
    month: get({ month: "long" }),
    monthShort: get({ month: "short" }),
    year: get({ year: "numeric" }),
  }
}

/**
 * The date (no time), Dubai time.
 *   one day, long:   "Friday, 10 October 2026"
 *   three days:      "Friday 10 – Sunday 12 October 2026"
 *   across months:   "Thursday 30 October – Saturday 1 November 2026"
 *   short style:     "Fri 10 – Sun 12 Oct 2026"
 * null when there is no date.
 */
export function eventDateRangeLabel(
  startIso: string | null | undefined,
  days: unknown,
  style: "long" | "short" | "plain" = "long",
): string | null {
  const start = valid(startIso)
  if (!start) return null
  const n = normalizeEventDays(days)
  const a = dubaiParts(start)
  const wd = (p: Parts) => (style === "short" ? p.weekdayShort : style === "plain" ? "" : p.weekday)
  const mo = (p: Parts) => (style === "short" ? p.monthShort : p.month)
  const lead = (p: Parts) => (wd(p) ? `${wd(p)} ` : "")
  if (n === 1) {
    if (style === "plain") return `${a.day} ${a.month} ${a.year}`
    return style === "short" ? `${a.weekdayShort} ${a.day} ${a.monthShort} ${a.year}` : `${a.weekday}, ${a.day} ${a.month} ${a.year}`
  }
  const b = dubaiParts(new Date(start.getTime() + (n - 1) * DAY_MS))
  if (a.year !== b.year) return `${lead(a)}${a.day} ${mo(a)} ${a.year} – ${lead(b)}${b.day} ${mo(b)} ${b.year}`
  if (a.month !== b.month) return `${lead(a)}${a.day} ${mo(a)} – ${lead(b)}${b.day} ${mo(b)} ${b.year}`
  return `${lead(a)}${a.day} – ${lead(b)}${b.day} ${mo(b)} ${b.year}`
}

/** "10:00" (Dubai time) for the start, or null. */
export function eventStartTime(startIso: string | null | undefined): string | null {
  const d = valid(startIso)
  return d ? d.toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" }) : null
}

/** "3-day event", or null for a one-day event. */
export function eventLengthLabel(days: unknown): string | null {
  const n = normalizeEventDays(days)
  return n > 1 ? `${n}-day event` : null
}

/** The full line used in lists and emails: "Fri 10 – Sun 12 Oct 2026 · 10:00 GST · 3 days". */
export function eventWhenLabel(startIso: string | null | undefined, days: unknown, style: "long" | "short" = "short"): string | null {
  const date = eventDateRangeLabel(startIso, days, style)
  if (!date) return null
  const time = eventStartTime(startIso)
  const n = normalizeEventDays(days)
  return [date, time ? `${n > 1 ? "from " : ""}${time} GST` : null, n > 1 ? `${n} days` : null].filter(Boolean).join(" · ")
}
