import "server-only"

import type { createAdminSupabase } from "@/lib/admin-supabase"

/**
 * An agent's client notes and reminders (migration 089; boss via Juliecor,
 * 2026-11-13). In their FHI Assistant: "note: Maria wants a 2-bed in JVC
 * under 1.2M" → a note; "what did Maria want?" → the notes about Maria;
 * "remind me to call Maria on Friday" → a reminder that shows as a tile on
 * the welcome screen that day and is emailed that morning by
 * app/api/cron/assistant-notes. Everything here is the person's own: every
 * read and write carries their user id, and nothing is shown to anyone else.
 */

type Admin = ReturnType<typeof createAdminSupabase>

export type NoteRow = {
  id: number
  user_id: string
  kind: "note" | "reminder"
  client_name: string | null
  body: string
  /** Reminders: the Dubai day it is due (YYYY-MM-DD). */
  due_on: string | null
  done_at: string | null
  sent_at: string | null
  created_at: string
}

export const NOTE_COLUMNS = "id, user_id, kind, client_name, body, due_on, done_at, sent_at, created_at"
export const NOTE_MAX_CHARS = 600
/** Open rows one person may hold — a brake on runaway loops, not a feature limit. */
const ROWS_PER_PERSON = 2000

export const dubaiToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" })
export const shiftDay = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400e3).toISOString().slice(0, 10)
const isIsoDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))

/** "Maria Santos" → ["maria", "santos"], for matching names typed loosely. */
export const noteWords = (s: string | null | undefined) =>
  (s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

/** Every asked word starts a word of the text ("mar" finds Maria). */
const wordsMatch = (asked: string[], text: string | null | undefined) => {
  const have = noteWords(text)
  return asked.length > 0 && asked.every((w) => have.some((h) => h.startsWith(w)))
}

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "")

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
const pad = (n: number) => String(n).padStart(2, "0")
/** The coming occurrence of a weekday — never today ("on Friday" said on a Friday means next week). */
const nextWeekday = (wd: number, today: string) => {
  const diff = (wd - new Date(`${today}T00:00:00Z`).getUTCDay() + 7) % 7
  return shiftDay(today, diff === 0 ? 7 : diff)
}
const monthIndex = (word: string) => (word.length >= 3 ? MONTHS.findIndex((m) => word.startsWith(m)) : -1)
const dayInMonth = (y: number, m: number, d: number) => {
  const iso = `${y}-${pad(m + 1)}-${pad(d)}`
  return isIsoDay(iso) && new Date(`${iso}T00:00:00Z`).getUTCMonth() === m ? iso : null
}

/**
 * The day a reminder is due, from the words the person used — resolved HERE,
 * not by the model, which guessed "Monday" as today: "2026-11-16", "today",
 * "tomorrow", "Monday" / "next Monday" / "on Tuesday" (the coming one),
 * "next week" (the coming Monday), "in 3 days", "in 2 weeks", "20 Nov",
 * "Nov 20", "20 November 2026", "the 20th" (this month, else next). Null when
 * not understood.
 */
export function resolveDueDay(input: unknown, today = dubaiToday()): string | null {
  if (typeof input !== "string") return null
  const s = input.trim().toLowerCase().replace(/[,.]/g, " ").replace(/\s+/g, " ").trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return isIsoDay(s) ? s : null
  if (s === "today" || s === "now" || s === "later today") return today
  if (s === "tomorrow" || s === "tmr" || s === "tmrw") return shiftDay(today, 1)
  if (s === "next week" || s === "monday next week" || s === "start of next week") return nextWeekday(1, today)
  let m = s.match(/^(?:on |this |next |coming |the coming |this coming )*([a-z]+)$/)
  if (m && m[1].length >= 3) {
    const wd = WEEKDAYS.findIndex((w) => w.startsWith(m![1]))
    if (wd >= 0) return nextWeekday(wd, today)
  }
  m = s.match(/^in (a|an|\d{1,3}) (day|days|week|weeks)$/)
  if (m) return shiftDay(today, (/^\d/.test(m[1]) ? Number(m[1]) : 1) * (m[2].startsWith("week") ? 7 : 1))
  const year = Number(today.slice(0, 4))
  const withYear = (y: number | undefined, mo: number, d: number) => {
    if (y) return dayInMonth(y, mo, d)
    const thisYear = dayInMonth(year, mo, d)
    return thisYear && thisYear >= today ? thisYear : dayInMonth(year + 1, mo, d)
  }
  m = s.match(/^(?:on |the )*(\d{1,2})(?:st|nd|rd|th)?(?: of)? ([a-z]+)(?: (\d{4}))?$/)
  if (m && monthIndex(m[2]) >= 0) return withYear(m[3] ? Number(m[3]) : undefined, monthIndex(m[2]), Number(m[1]))
  m = s.match(/^(?:on )?([a-z]+) (\d{1,2})(?:st|nd|rd|th)?(?: (\d{4}))?$/)
  if (m && monthIndex(m[1]) >= 0) return withYear(m[3] ? Number(m[3]) : undefined, monthIndex(m[1]), Number(m[2]))
  m = s.match(/^(?:on |the )*(\d{1,2})(?:st|nd|rd|th)$/)
  if (m) {
    const mo = Number(today.slice(5, 7)) - 1
    const thisMonth = dayInMonth(year, mo, Number(m[1]))
    return thisMonth && thisMonth >= today ? thisMonth : dayInMonth(mo === 11 ? year + 1 : year, (mo + 1) % 12, Number(m[1]))
  }
  return null
}

/** Friday 14 Nov — how a due day reads in the chat, the tile and the email. */
export function dueLabel(iso: string, today = dubaiToday()): string {
  if (iso === today) return "today"
  if (iso === shiftDay(today, 1)) return "tomorrow"
  if (iso < today) {
    const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${iso}T00:00:00Z`)) / 86400e3)
    return `${days} day${days === 1 ? "" : "s"} overdue`
  }
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" })
}

async function countOpen(admin: Admin, userId: string): Promise<number> {
  const { count } = await admin.from("assistant_notes").select("id", { count: "exact", head: true }).eq("user_id", userId).is("done_at", null)
  return count ?? 0
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export async function addNote(admin: Admin, userId: string, input: { client_name?: unknown; text?: unknown }): Promise<NoteRow | { error: string }> {
  const body = clean(input.text, NOTE_MAX_CHARS)
  if (!body) return { error: "What should the note say?" }
  if ((await countOpen(admin, userId)) >= ROWS_PER_PERSON) return { error: "You have reached the limit of notes — ask the office to clear old ones." }
  const row = { user_id: userId, kind: "note", client_name: clean(input.client_name, 80) || null, body }
  const { data, error } = await admin.from("assistant_notes").insert(row).select(NOTE_COLUMNS).single<NoteRow>()
  if (error) throw new Error(error.message)
  return data
}

/**
 * The notes (and reminders) about one client, or the ones whose text matches
 * `search`, newest first; with neither, the newest notes. Matching is loose:
 * every word asked must start a word of the client's name or the text.
 */
export async function findNotes(admin: Admin, userId: string, input: { client_name?: unknown; search?: unknown; limit?: number }): Promise<{ rows: NoteRow[]; total: number }> {
  const { data, error } = await admin.from("assistant_notes").select(NOTE_COLUMNS).eq("user_id", userId).order("created_at", { ascending: false }).limit(ROWS_PER_PERSON)
  if (error) throw new Error(error.message)
  const all = (data ?? []) as NoteRow[]
  const name = noteWords(clean(input.client_name, 80))
  const search = noteWords(clean(input.search, 120))
  const rows = all.filter((r) => {
    if (name.length && !(wordsMatch(name, r.client_name) || wordsMatch(name, r.body))) return false
    if (search.length && !(wordsMatch(search, r.body) || wordsMatch(search, r.client_name))) return false
    return true
  })
  const limit = Math.min(Math.max(input.limit ?? 12, 1), 50)
  return { rows: rows.slice(0, limit), total: rows.length }
}

// ─── Reminders ───────────────────────────────────────────────────────────────

export async function addReminder(admin: Admin, userId: string, input: { text?: unknown; client_name?: unknown; due_on?: unknown }, today = dubaiToday()): Promise<NoteRow | { error: string }> {
  const body = clean(input.text, NOTE_MAX_CHARS)
  if (!body) return { error: "What should I remind you about?" }
  const dueOn = resolveDueDay(input.due_on, today)
  if (!dueOn) return { error: `Which day? Say it like 'tomorrow', 'Monday', 'in 3 days' or '20 Nov' (today in Dubai is ${today}).` }
  if (dueOn < today) return { error: `That day (${dueOn}) has passed — today in Dubai is ${today}.` }
  if (dueOn > shiftDay(today, 366)) return { error: "Reminders can be set up to a year ahead." }
  if ((await countOpen(admin, userId)) >= ROWS_PER_PERSON) return { error: "You have reached the limit of reminders — ask the office to clear old ones." }
  const row = { user_id: userId, kind: "reminder", client_name: clean(input.client_name, 80) || null, body, due_on: dueOn }
  const { data, error } = await admin.from("assistant_notes").insert(row).select(NOTE_COLUMNS).single<NoteRow>()
  if (error) throw new Error(error.message)
  return data
}

export type ReminderScope = "today" | "open" | "done"

/** today = due today or overdue; open = every reminder not done, soonest first; done = the last ones ticked off. */
export async function listReminders(admin: Admin, userId: string, scope: ReminderScope, today = dubaiToday(), limit = 20): Promise<NoteRow[]> {
  let q = admin.from("assistant_notes").select(NOTE_COLUMNS).eq("user_id", userId).eq("kind", "reminder")
  if (scope === "done") q = q.not("done_at", "is", null).order("done_at", { ascending: false })
  else {
    q = q.is("done_at", null).order("due_on", { ascending: true }).order("created_at", { ascending: true })
    if (scope === "today") q = q.lte("due_on", today)
  }
  const { data, error } = await q.limit(Math.min(Math.max(limit, 1), 100))
  if (error) throw new Error(error.message)
  return (data ?? []) as NoteRow[]
}

/** Ticks off the open reminder(s) whose text or client matches; `all_today` ticks off everything due by today. */
export async function completeReminder(admin: Admin, userId: string, input: { match?: unknown; all_today?: boolean }, today = dubaiToday()): Promise<{ done: NoteRow[]; candidates: NoteRow[] }> {
  const open = await listReminders(admin, userId, "open", today, 100)
  const asked = noteWords(clean(input.match, 120))
  const hits = input.all_today ? open.filter((r) => (r.due_on ?? "") <= today) : open.filter((r) => wordsMatch(asked, r.body) || wordsMatch(asked, r.client_name))
  if (!hits.length || (!input.all_today && hits.length > 1)) return { done: [], candidates: hits.length ? hits : open }
  const now = new Date().toISOString()
  const { error } = await admin.from("assistant_notes").update({ done_at: now }).eq("user_id", userId).in("id", hits.map((r) => r.id))
  if (error) throw new Error(error.message)
  return { done: hits.map((r) => ({ ...r, done_at: now })), candidates: [] }
}

/** Moves the one open reminder that matches to another day ("move the Ahmed reminder to Monday", "remind me again on Friday"); the morning email goes out again on the new day. */
export async function moveReminder(admin: Admin, userId: string, input: { match?: unknown; due_on?: unknown }, today = dubaiToday()): Promise<{ moved: NoteRow | null; candidates: NoteRow[]; error?: string }> {
  const dueOn = resolveDueDay(input.due_on, today)
  if (!dueOn) return { moved: null, candidates: [], error: `Which day? Say it like 'tomorrow', 'Monday', 'in 3 days' or '20 Nov' (today in Dubai is ${today}).` }
  if (dueOn < today) return { moved: null, candidates: [], error: `That day (${dueOn}) has passed — today in Dubai is ${today}.` }
  const open = await listReminders(admin, userId, "open", today, 100)
  const asked = noteWords(clean(input.match, 120))
  const hits = open.filter((r) => wordsMatch(asked, r.body) || wordsMatch(asked, r.client_name))
  if (hits.length !== 1) return { moved: null, candidates: hits.length ? hits : open }
  const { data, error } = await admin.from("assistant_notes").update({ due_on: dueOn, sent_at: null }).eq("user_id", userId).eq("id", hits[0].id).select(NOTE_COLUMNS).single<NoteRow>()
  if (error) throw new Error(error.message)
  return { moved: data, candidates: [] }
}

// ─── The morning email (cron) ────────────────────────────────────────────────

/** Every open reminder due by `today` whose email has not gone out, grouped by person. */
export async function dueRemindersByPerson(admin: Admin, today = dubaiToday()): Promise<Map<string, NoteRow[]>> {
  const { data, error } = await admin.from("assistant_notes").select(NOTE_COLUMNS).eq("kind", "reminder").is("done_at", null).is("sent_at", null).lte("due_on", today).order("due_on", { ascending: true }).limit(5000)
  if (error) throw new Error(error.message)
  const out = new Map<string, NoteRow[]>()
  for (const r of (data ?? []) as NoteRow[]) out.set(r.user_id, [...(out.get(r.user_id) ?? []), r])
  return out
}

export async function markRemindersSent(admin: Admin, ids: number[]): Promise<void> {
  if (!ids.length) return
  const { error } = await admin.from("assistant_notes").update({ sent_at: new Date().toISOString() }).in("id", ids)
  if (error) throw new Error(error.message)
}
