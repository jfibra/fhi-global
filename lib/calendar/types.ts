/**
 * The admin Calendar (boss via Juliecor, 2026-11-13): one shape for every
 * block on the page, whatever table it came from. The API
 * (app/api/admin/calendar) builds them on the server; the page only draws.
 */

export const CALENDAR_LAYERS = ["event", "project", "deal", "birthday", "document", "entry", "holiday", "automatic"] as const
export type CalendarLayer = (typeof CALENDAR_LAYERS)[number]

export const LAYER_LABELS: Record<CalendarLayer, string> = {
  event: "Events",
  project: "Project milestones",
  deal: "Deals",
  birthday: "Birthdays",
  document: "Document expiries",
  entry: "Company entries",
  holiday: "UAE holidays",
  automatic: "Automatic emails",
}

/** Layers switched on when the page first opens; the rest are a click away. */
export const DEFAULT_LAYERS: CalendarLayer[] = ["event", "project", "deal", "birthday", "document", "entry", "holiday"]

export type CalendarLink = {
  label: string
  /** A dashboard path without the role prefix ("/events"); the page adds the caller's base. */
  dash?: string
  /** An absolute or site-relative public URL ("/events/azizi-roadshow"). */
  url?: string
}

export type CalendarItem = {
  /** Unique on the page: "<layer>:<id>:<date>". */
  id: string
  layer: CalendarLayer
  /** The Dubai day it sits on, YYYY-MM-DD. A multi-day thing is one item per day. */
  date: string
  /** "11:00" Dubai, when the thing has a time. */
  time?: string | null
  /** "11:00 to 18:00" when both ends are known. */
  timeLabel?: string | null
  title: string
  subtitle?: string | null
  /** Label/value rows for the detail sheet. */
  details: Array<{ label: string; value: string }>
  links: CalendarLink[]
  /** "warn" draws the block in amber (a deal that has waited long). */
  tone?: "warn" | null
  /** Day 2 of 3 and the like, for multi-day things. */
  dayOf?: { day: number; of: number } | null
  /** Set on `entry` items: the stored row, for editing. */
  entry?: CalendarEntry | null
}

export const ENTRY_KINDS = ["meeting", "training", "roadshow", "launch", "deadline", "closure", "other"] as const
export type EntryKind = (typeof ENTRY_KINDS)[number]
export const ENTRY_KIND_LABELS: Record<EntryKind, string> = {
  meeting: "Meeting",
  training: "Training",
  roadshow: "Roadshow",
  launch: "Developer launch",
  deadline: "Deadline",
  closure: "Office closed",
  other: "Other",
}

export const ENTRY_AUDIENCES = ["admins", "staff", "leaders", "team"] as const
export type EntryAudience = (typeof ENTRY_AUDIENCES)[number]
export const ENTRY_AUDIENCE_LABELS: Record<EntryAudience, string> = {
  admins: "Admins only",
  staff: "All staff",
  leaders: "Team leaders",
  team: "One team",
}

/** A calendar_entries row as the API hands it to the page (migration 090). */
export type CalendarEntry = {
  id: string
  title: string
  kind: EntryKind
  starts_on: string
  ends_on: string
  start_time: string | null
  end_time: string | null
  all_day: boolean
  place: string | null
  link: string | null
  notes: string | null
  audience: EntryAudience
  team_id: string | null
  team_name?: string | null
  notify_morning: boolean
  notified_on: string | null
  created_by: string | null
  created_by_name?: string | null
  created_at: string
}

/** What the Add / Edit entry form sends. */
export type CalendarEntryInput = {
  title: string
  kind: EntryKind
  starts_on: string
  ends_on: string
  start_time: string | null
  end_time: string | null
  all_day: boolean
  place: string | null
  link: string | null
  notes: string | null
  audience: EntryAudience
  team_id: string | null
  notify_morning: boolean
}
