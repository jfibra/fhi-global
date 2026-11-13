import "server-only"

import type { createAdminSupabase } from "@/lib/admin-supabase"
import { ROLES_ADMIN_STAFF, ROLES_INTERNAL_RESOURCES } from "@/lib/app-roles"
import {
  ENTRY_AUDIENCES,
  ENTRY_KINDS,
  type CalendarEntry,
  type CalendarEntryInput,
  type EntryAudience,
  type EntryKind,
} from "@/lib/calendar/types"

/**
 * Company calendar entries (migration 090): what admins put on the calendar
 * themselves. Read and written only here, on the service role, behind the
 * admin API; the morning email for an entry goes from the daily cron
 * (app/api/cron/assistant-notes) to the people its audience names.
 */

type Admin = ReturnType<typeof createAdminSupabase>

export const ENTRY_COLUMNS =
  "id, title, kind, starts_on, ends_on, start_time, end_time, all_day, place, link, notes, audience, team_id, notify_morning, notified_on, created_by, created_at"

/** The leaders an entry "for team leaders" reaches: team leaders and unit managers. */
const LEADER_ROLES = ["team_leader", "unit_manager"] as const

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

const str = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim() : ""
  return s ? s.slice(0, max) : null
}

/** True when the table has not been created yet (migration 090 not applied) — the layer is then simply absent. */
export function isMissingEntriesTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return error.code === "42P01" || /calendar_entries/.test(error.message ?? "") && /does not exist|schema cache/i.test(error.message ?? "")
}

/** The form's payload tidied, or the one thing wrong with it. */
export function sanitizeEntryInput(raw: unknown): { ok: true; value: CalendarEntryInput } | { ok: false; error: string } {
  const r = (raw ?? {}) as Record<string, unknown>
  const title = str(r.title, 140)
  if (!title) return { ok: false, error: "Give the entry a title." }
  const kind = (typeof r.kind === "string" && (ENTRY_KINDS as readonly string[]).includes(r.kind) ? r.kind : "meeting") as EntryKind
  const starts_on = typeof r.starts_on === "string" && ISO_DAY.test(r.starts_on) ? r.starts_on : null
  if (!starts_on) return { ok: false, error: "Pick the date." }
  const ends_on = typeof r.ends_on === "string" && ISO_DAY.test(r.ends_on) ? r.ends_on : starts_on
  if (ends_on < starts_on) return { ok: false, error: "The end date is before the start date." }
  if (daysBetween(starts_on, ends_on) > 60) return { ok: false, error: "An entry can run 60 days at most." }
  const all_day = r.all_day === true
  const start_time = all_day ? null : typeof r.start_time === "string" && HHMM.test(r.start_time) ? r.start_time : null
  const end_time = all_day ? null : typeof r.end_time === "string" && HHMM.test(r.end_time) ? r.end_time : null
  if (!all_day && !start_time) return { ok: false, error: "Give the entry a start time, or tick All day." }
  if (start_time && end_time && end_time <= start_time && starts_on === ends_on) return { ok: false, error: "The end time is before the start time." }
  const audience = (typeof r.audience === "string" && (ENTRY_AUDIENCES as readonly string[]).includes(r.audience) ? r.audience : "admins") as EntryAudience
  const team_id = audience === "team" ? str(r.team_id, 64) : null
  if (audience === "team" && !team_id) return { ok: false, error: "Pick the team." }
  let link = str(r.link, 500)
  if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`
  return {
    ok: true,
    value: {
      title,
      kind,
      starts_on,
      ends_on,
      start_time,
      end_time,
      all_day,
      place: str(r.place, 200),
      link,
      notes: str(r.notes, 2000),
      audience,
      team_id,
      notify_morning: r.notify_morning === true,
    },
  }
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400e3)
}

async function decorate(admin: Admin, rows: CalendarEntry[]): Promise<CalendarEntry[]> {
  const teamIds = [...new Set(rows.map((r) => r.team_id).filter((x): x is string => !!x))]
  const authorIds = [...new Set(rows.map((r) => r.created_by).filter((x): x is string => !!x))]
  const [teams, authors] = await Promise.all([
    teamIds.length ? admin.from("teams").select("id, name").in("id", teamIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    authorIds.length ? admin.from("profiles").select("id, fullname").in("id", authorIds) : Promise.resolve({ data: [] as { id: string; fullname: string | null }[] }),
  ])
  const teamName = new Map((teams.data ?? []).map((t) => [t.id, t.name]))
  const authorName = new Map((authors.data ?? []).map((a) => [a.id, a.fullname]))
  return rows.map((r) => ({ ...r, team_name: r.team_id ? teamName.get(r.team_id) ?? null : null, created_by_name: r.created_by ? authorName.get(r.created_by) ?? null : null }))
}

/** Entries touching any day of [from, to]. `available: false` when migration 090 has not been applied. */
export async function listEntries(admin: Admin, from: string, to: string): Promise<{ entries: CalendarEntry[]; available: boolean }> {
  const { data, error } = await admin
    .from("calendar_entries")
    .select(ENTRY_COLUMNS)
    .is("deleted_at", null)
    .lte("starts_on", to)
    .gte("ends_on", from)
    .order("starts_on", { ascending: true })
    .limit(2000)
  if (error) {
    if (isMissingEntriesTable(error)) return { entries: [], available: false }
    throw new Error(error.message)
  }
  return { entries: await decorate(admin, (data ?? []) as unknown as CalendarEntry[]), available: true }
}

export async function getEntry(admin: Admin, id: string): Promise<CalendarEntry | null> {
  const { data, error } = await admin.from("calendar_entries").select(ENTRY_COLUMNS).eq("id", id).is("deleted_at", null).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const [row] = await decorate(admin, [data as unknown as CalendarEntry])
  return row
}

export async function createEntry(admin: Admin, input: CalendarEntryInput, createdBy: string): Promise<CalendarEntry> {
  const { data, error } = await admin.from("calendar_entries").insert({ ...input, created_by: createdBy }).select(ENTRY_COLUMNS).single()
  if (error) throw new Error(isMissingEntriesTable(error) ? "The calendar entries table is not set up yet (migration 090)." : error.message)
  const [row] = await decorate(admin, [data as unknown as CalendarEntry])
  return row
}

/** Saves the edit; a changed day clears `notified_on` so a morning email can go again on the new day. */
export async function updateEntry(admin: Admin, id: string, input: CalendarEntryInput, before: CalendarEntry): Promise<CalendarEntry> {
  const patch: Record<string, unknown> = { ...input, updated_at: new Date().toISOString() }
  if (before.starts_on !== input.starts_on) patch.notified_on = null
  const { data, error } = await admin.from("calendar_entries").update(patch).eq("id", id).is("deleted_at", null).select(ENTRY_COLUMNS).single()
  if (error) throw new Error(error.message)
  const [row] = await decorate(admin, [data as unknown as CalendarEntry])
  return row
}

export async function softDeleteEntry(admin: Admin, id: string): Promise<void> {
  const { error } = await admin.from("calendar_entries").update({ deleted_at: new Date().toISOString() }).eq("id", id).is("deleted_at", null)
  if (error) throw new Error(error.message)
}

// ─── The morning email ───────────────────────────────────────────────────────

/** Entries starting today whose author asked for the morning email and that have not had it. */
export async function entriesDueThisMorning(admin: Admin, today: string): Promise<CalendarEntry[]> {
  const { data, error } = await admin
    .from("calendar_entries")
    .select(ENTRY_COLUMNS)
    .is("deleted_at", null)
    .eq("notify_morning", true)
    .is("notified_on", null)
    .lte("starts_on", today)
    .gte("ends_on", today)
    .limit(200)
  if (error) {
    if (isMissingEntriesTable(error)) return []
    throw new Error(error.message)
  }
  return decorate(admin, (data ?? []) as unknown as CalendarEntry[])
}

export async function markEntriesNotified(admin: Admin, ids: string[], today: string): Promise<void> {
  if (!ids.length) return
  const { error } = await admin.from("calendar_entries").update({ notified_on: today }).in("id", ids)
  if (error) throw new Error(error.message)
}

type Person = { id: string; fullname: string | null; role: string | null }

/** The active people an entry's audience names. */
export async function entryAudience(admin: Admin, entry: Pick<CalendarEntry, "audience" | "team_id">): Promise<Person[]> {
  if (entry.audience === "team") {
    if (!entry.team_id) return []
    const { data: allTeams } = await admin.from("teams").select("id, parent_id").limit(2000)
    const teamIds = new Set<string>([entry.team_id])
    for (let grew = true; grew; ) {
      grew = false
      for (const t of allTeams ?? []) if (t.parent_id && teamIds.has(t.parent_id) && !teamIds.has(t.id)) { teamIds.add(t.id); grew = true }
    }
    const members: string[] = []
    for (let page = 0; page < 5; page++) {
      const { data } = await admin.from("team_memberships").select("user_id").in("team_id", [...teamIds]).is("left_at", null).range(page * 1000, page * 1000 + 999)
      members.push(...((data ?? []) as { user_id: string }[]).map((m) => m.user_id))
      if (!data || data.length < 1000) break
    }
    const ids = [...new Set(members)]
    if (!ids.length) return []
    const out: Person[] = []
    for (let i = 0; i < ids.length; i += 500) {
      const { data } = await admin.from("profiles").select("id, fullname, role").in("id", ids.slice(i, i + 500)).eq("status", "active").neq("is_deleted", true)
      out.push(...((data ?? []) as Person[]))
    }
    return out
  }
  const roles = entry.audience === "admins" ? [...ROLES_ADMIN_STAFF] : entry.audience === "leaders" ? [...LEADER_ROLES] : [...ROLES_INTERNAL_RESOURCES]
  const { data, error } = await admin.from("profiles").select("id, fullname, role").in("role", roles).eq("status", "active").neq("is_deleted", true).limit(3000)
  if (error) throw new Error(error.message)
  return (data ?? []) as Person[]
}

/** Email addresses for a set of profile ids (auth.users holds them). */
export async function emailsFor(admin: Admin, ids: Iterable<string>): Promise<Map<string, string>> {
  const wanted = new Set(ids)
  const out = new Map<string, string>()
  if (!wanted.size) return out
  if (wanted.size <= 40) {
    for (const id of wanted) {
      const email = await admin.auth.admin.getUserById(id).then((r) => r.data?.user?.email?.trim() || null).catch(() => null)
      if (email) out.set(id, email)
    }
    return out
  }
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    for (const u of data.users) if (wanted.has(u.id) && u.email?.trim()) out.set(u.id, u.email.trim())
    if (data.users.length < 200) break
  }
  return out
}

/** "11:00 to 12:30", "11:00", or "All day". */
export function entryTimeLabel(e: Pick<CalendarEntry, "all_day" | "start_time" | "end_time">): string {
  if (e.all_day || !e.start_time) return "All day"
  return e.end_time ? `${e.start_time} to ${e.end_time}` : e.start_time
}
