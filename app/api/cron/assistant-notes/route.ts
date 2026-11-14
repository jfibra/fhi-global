import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { dubaiToday, dueLabel, dueRemindersByPerson, markRemindersSent } from "@/lib/assistant-notes"
import { calendarEntryEmailHtml, eventReminderEmailHtml, hasMailerConfig, reminderEmailHtml, sendCalendarEntryEmail, sendEventReminderEmail, sendReminderEmail, weeklyNoteHtml } from "@/lib/mailer"
import { eventRemindersDue, markReminded, venueMapUrl, type EventReminderBatch, type ReminderRegistration } from "@/lib/events/reminders"
import { eventPublicPath } from "@/lib/events/paths"
import { registrationDays } from "@/lib/events/pax"
import { SITE_URL } from "@/lib/seo"
import { assistantUrlFor, isMondayInDubai, namedRecipients, previewWeeklyNote, sendWeeklyNotes, weeklyNoteRecipients } from "@/lib/weekly-note"
import { emailsFor, entriesDueThisMorning, entryAudience, entryTimeLabel, markEntriesNotified } from "@/lib/calendar/entries"
import { ENTRY_AUDIENCE_LABELS, ENTRY_KIND_LABELS, type CalendarEntry } from "@/lib/calendar/types"

/**
 * FHI Assistant's morning mail to agents and team leaders — 9:00 AM Dubai
 * daily (vercel.json "0 5 * * *" UTC):
 *  - every day: the reminders due today ("remind me to call Maria on
 *    Friday" in the chat, lib/assistant-notes.ts), one email per person;
 *  - on Mondays: the weekly coaching note (lib/weekly-note.ts);
 *  - every day: the morning note for company calendar entries starting today
 *    whose admin ticked "Email them on the morning" (lib/calendar/entries.ts),
 *    to everyone the entry's audience names, once (notified_on);
 *  - every day: "See you tomorrow" to everyone registered for an event that
 *    starts tomorrow (lib/events/reminders.ts), once per registration
 *    (migration 091 reminder_sent_at); ?event=<id> limits it to one event.
 *
 * Same guard as the other crons: Vercel sends "Authorization: Bearer
 * $CRON_SECRET"; manual runs can pass ?secret=.
 *
 * Checks: ?dry=1 lists who would get what WITHOUT sending (safe in prod);
 * ?weekly=1 sends the weekly note on any day; ?only=<uid>[,<uid>] limits a
 * run to exactly those people, any role (a test to your own mailbox, a first
 * send to the boss); ?preview=<uid>&kind=weekly
 * or kind=reminder (non-production only) returns that person's email as HTML.
 */

export const runtime = "nodejs"
export const maxDuration = 300
export const dynamic = "force-dynamic"

type Admin = ReturnType<typeof createAdminSupabase>

async function sendDueReminders(admin: Admin, today: string, only: string[] | null): Promise<{ people: number; sent: string[]; skipped: string[]; failed: string[] }> {
  const due = await dueRemindersByPerson(admin, today)
  const out = { people: 0, sent: [] as string[], skipped: [] as string[], failed: [] as string[] }
  for (const [userId, rows] of due) {
    if (only && !only.includes(userId)) continue
    out.people++
    const { data: p } = await admin.from("profiles").select("fullname, role, status, is_deleted").eq("id", userId).maybeSingle<{ fullname: string | null; role: string | null; status: string | null; is_deleted: boolean | null }>()
    const live = p && p.status === "active" && p.is_deleted !== true
    const email = live ? await admin.auth.admin.getUserById(userId).then((r) => r.data?.user?.email?.trim() || null).catch(() => null) : null
    if (!email) {
      // No address or no longer active: nothing to send, and never retry it every morning.
      out.skipped.push(userId)
      await markRemindersSent(admin, rows.map((r) => r.id)).catch(() => undefined)
      continue
    }
    try {
      await sendReminderEmail({ to: email, name: p!.fullname, reminders: rows.map((r) => ({ body: r.body, client: r.client_name, when: dueLabel(r.due_on ?? today, today) })), assistantUrl: assistantUrlFor(p!.role) })
      await markRemindersSent(admin, rows.map((r) => r.id))
      out.sent.push(email)
    } catch {
      out.failed.push(email)
    }
  }
  return out
}

const entryWhen = (e: CalendarEntry, today: string) => {
  const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
  const span = e.starts_on === e.ends_on ? day(today) : `${day(e.starts_on)} to ${day(e.ends_on)}`
  return `${span} · ${entryTimeLabel(e)}`
}

const audienceWords = (e: CalendarEntry) =>
  e.audience === "team" ? `the ${e.team_name ?? "team"} team` : e.audience === "admins" ? "the admin team" : e.audience === "leaders" ? "team leaders and unit managers" : "all staff"

/** The morning note for company calendar entries starting today (migration 090), one email per person per entry. */
async function sendEntryMornings(admin: Admin, today: string, only: string[] | null): Promise<{ entries: number; sent: number; skipped: number; failed: string[] }> {
  const due = await entriesDueThisMorning(admin, today)
  const out = { entries: due.length, sent: 0, skipped: 0, failed: [] as string[] }
  for (const e of due) {
    const people = (await entryAudience(admin, e)).filter((p) => !only || only.includes(p.id)).slice(0, 1500)
    const emails = await emailsFor(admin, people.map((p) => p.id))
    for (const p of people) {
      const to = emails.get(p.id)
      if (!to) {
        out.skipped++
        continue
      }
      try {
        await sendCalendarEntryEmail({ to, name: p.fullname, title: e.title, kind: ENTRY_KIND_LABELS[e.kind] ?? "Entry", when: entryWhen(e, today), place: e.place, link: e.link, notes: e.notes, audience: audienceWords(e) })
        out.sent++
      } catch {
        out.failed.push(to)
      }
    }
    // Marked even when nobody could be reached, so a bad entry never retries every morning.
    if (!only) await markEntriesNotified(admin, [e.id], today).catch(() => undefined)
  }
  return out
}

const site = SITE_URL.replace(/\/$/, "")

function eventReminderInput(batch: EventReminderBatch, r: ReminderRegistration) {
  const attending = registrationDays(r.days, batch.event.event_days).filter((d) => d >= batch.day)
  return {
    to: r.email,
    fullName: r.full_name,
    event: batch.event,
    attendingDays: attending,
    day: batch.day,
    mapUrl: venueMapUrl(batch.event),
    eventUrl: `${site}${eventPublicPath({ id: batch.event.id, slug: batch.event.slug })}`,
  }
}

/** "See you tomorrow" to everyone registered for an event starting tomorrow, once per registration. */
async function sendEventReminders(admin: Admin, today: string, onlyEvent: string | null): Promise<{ events: number; sent: number; failed: string[] }> {
  const batches = await eventRemindersDue(admin, today, onlyEvent)
  const out = { events: batches.length, sent: 0, failed: [] as string[] }
  for (const batch of batches) {
    const done: string[] = []
    for (const r of batch.registrations.slice(0, 1000)) {
      try {
        await sendEventReminderEmail(eventReminderInput(batch, r))
        out.sent++
        done.push(r.id)
      } catch {
        out.failed.push(r.email)
      }
    }
    await markReminded(admin, done).catch(() => undefined)
  }
  return out
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const isProd = process.env.NODE_ENV === "production"
  if (secret) {
    const auth = req.headers.get("authorization")
    const qs = req.nextUrl.searchParams.get("secret")
    if (auth !== `Bearer ${secret}` && qs !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  } else if (isProd) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 })
  }

  const admin = createAdminSupabase()
  const q = req.nextUrl.searchParams
  const today = dubaiToday()
  const weekly = isMondayInDubai(today) || q.get("weekly") === "1"
  const only = (q.get("only") ?? "").split(",").map((s) => s.trim()).filter(Boolean)

  const preview = q.get("preview")?.trim()
  if (preview && !isProd) {
    if (q.get("kind") === "event") {
      // The first event due tomorrow (or ?day=<the day before it>), to the previewing person's name; a sample when none.
      const [batch] = await eventRemindersDue(admin, q.get("day")?.trim() || today, q.get("event")?.trim() || null).catch(() => [] as EventReminderBatch[])
      const { data: p } = await admin.from("profiles").select("fullname").eq("id", preview).maybeSingle<{ fullname: string | null }>()
      const name = p?.fullname ?? "there"
      const input = batch
        ? eventReminderInput(batch, { id: "", full_name: name, email: "", days: null })
        : eventReminderInput(
            { event: { id: "00000000-0000-4000-8000-000000000000", slug: "sample-event", title: "Investor evening · JLT", venue: "Dusit Thani Dubai, Sheikh Zayed Road", venue_lat: null, venue_lng: null, event_date: `${today}T15:00:00+04:00`, event_days: 1, day_times: [] }, day: 1, registrations: [] },
            { id: "", full_name: name, email: "", days: null },
          )
      return new NextResponse(eventReminderEmailHtml(input).html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } })
    }
    if (q.get("kind") === "entry") {
      const { data: p } = await admin.from("profiles").select("fullname, role").eq("id", preview).maybeSingle<{ fullname: string | null; role: string | null }>()
      if (!p) return NextResponse.json({ error: "No such profile." }, { status: 404 })
      const [e] = await entriesDueThisMorning(admin, q.get("day")?.trim() || today).catch(() => [] as CalendarEntry[])
      const input = e
        ? { to: "", name: p.fullname, title: e.title, kind: ENTRY_KIND_LABELS[e.kind], when: entryWhen(e, today), place: e.place, link: e.link, notes: e.notes, audience: audienceWords(e) }
        : { to: "", name: p.fullname, title: "Sales meeting", kind: "Meeting", when: "Monday, 16 November · 10:00 to 11:00", place: "Business Bay office", link: null, notes: "Bring last week's numbers.", audience: ENTRY_AUDIENCE_LABELS.staff.toLowerCase() }
      return new NextResponse(calendarEntryEmailHtml(input), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } })
    }
    if (q.get("kind") === "reminder") {
      const rows = (await dueRemindersByPerson(admin, q.get("day")?.trim() || today).catch(() => new Map<string, never[]>())).get(preview) ?? []
      const { data: p } = await admin.from("profiles").select("fullname, role").eq("id", preview).maybeSingle<{ fullname: string | null; role: string | null }>()
      if (!p) return NextResponse.json({ error: "No such profile." }, { status: 404 })
      const reminders = rows.length ? rows.map((r) => ({ body: r.body, client: r.client_name, when: dueLabel(r.due_on ?? today, today) })) : [{ body: "Call Maria about the 2-bedroom in JVC", client: "Maria", when: "today" }]
      return new NextResponse(reminderEmailHtml({ to: "", name: p.fullname, reminders, assistantUrl: assistantUrlFor(p.role) }), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } })
    }
    const note = await previewWeeklyNote(admin, preview, today)
    if (!note) return NextResponse.json({ error: "No such profile." }, { status: 404 })
    if (q.get("json") === "1") return NextResponse.json(note)
    return new NextResponse(weeklyNoteHtml(note), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } })
  }

  // The two jobs are independent: a failure in one is reported, never lets the other go unsent.
  const failure = (e: unknown) => ({ error: e instanceof Error ? e.message : String(e) })

  if (q.get("dry") === "1") {
    const [people, due, entries, eventBatches] = await Promise.all([
      (only.length ? namedRecipients(admin, only) : weeklyNoteRecipients(admin, today)).catch(failure),
      dueRemindersByPerson(admin, today).catch(failure),
      entriesDueThisMorning(admin, today).catch(failure),
      eventRemindersDue(admin, today, q.get("event")?.trim() || null).catch(failure),
    ])
    const chosen = "recipients" in people ? people.recipients : []
    const entryList = Array.isArray(entries) ? await Promise.all(entries.map(async (e) => ({ title: e.title, audience: e.audience, people: (await entryAudience(admin, e).catch(() => [])).length }))) : entries
    return NextResponse.json({
      ok: true,
      dry_run: true,
      today,
      weekly_note: "recipients" in people ? { would_send: weekly, recipients: chosen.length, skipped: people.skipped, people: chosen.map((r) => r.name) } : people,
      reminders: due instanceof Map ? { people: due.size, reminders: [...due.values()].reduce((a, rows) => a + rows.length, 0) } : due,
      calendar_entries: entryList,
      event_reminders: Array.isArray(eventBatches) ? eventBatches.map((b) => ({ event: b.event.title, day: b.day, people: b.registrations.length })) : eventBatches,
    })
  }

  if (!hasMailerConfig()) return NextResponse.json({ error: "SMTP is not configured." }, { status: 503 })

  const reminders = await sendDueReminders(admin, today, only.length ? only : null).catch(failure)
  const calendarEntries = await sendEntryMornings(admin, today, only.length ? only : null).catch(failure)
  // Event reminders go to attendees, not accounts, so ?only= does not apply; ?event=<id> narrows a manual run.
  const eventReminders = only.length ? { skipped: "only= names accounts; event reminders go to attendees" } : await sendEventReminders(admin, today, q.get("event")?.trim() || null).catch(failure)
  const note = weekly ? await sendWeeklyNotes({ admin, today, only: only.length ? only : null }).catch(failure) : null
  return NextResponse.json({ ok: true, today, reminders, calendar_entries: calendarEntries, event_reminders: eventReminders, weekly_note: note })
}
