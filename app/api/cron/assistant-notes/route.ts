import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { dubaiToday, dueLabel, dueRemindersByPerson, markRemindersSent } from "@/lib/assistant-notes"
import { hasMailerConfig, reminderEmailHtml, sendReminderEmail, weeklyNoteHtml } from "@/lib/mailer"
import { assistantUrlFor, isMondayInDubai, namedRecipients, previewWeeklyNote, sendWeeklyNotes, weeklyNoteRecipients } from "@/lib/weekly-note"

/**
 * FHI Assistant's morning mail to agents and team leaders — 9:00 AM Dubai
 * daily (vercel.json "0 5 * * *" UTC):
 *  - every day: the reminders due today ("remind me to call Maria on
 *    Friday" in the chat, lib/assistant-notes.ts), one email per person;
 *  - on Mondays: the weekly coaching note (lib/weekly-note.ts).
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
    const [people, due] = await Promise.all([(only.length ? namedRecipients(admin, only) : weeklyNoteRecipients(admin, today)).catch(failure), dueRemindersByPerson(admin, today).catch(failure)])
    const chosen = "recipients" in people ? people.recipients : []
    return NextResponse.json({
      ok: true,
      dry_run: true,
      today,
      weekly_note: "recipients" in people ? { would_send: weekly, recipients: chosen.length, skipped: people.skipped, people: chosen.map((r) => r.name) } : people,
      reminders: due instanceof Map ? { people: due.size, reminders: [...due.values()].reduce((a, rows) => a + rows.length, 0) } : due,
    })
  }

  if (!hasMailerConfig()) return NextResponse.json({ error: "SMTP is not configured." }, { status: 503 })

  const reminders = await sendDueReminders(admin, today, only.length ? only : null).catch(failure)
  const note = weekly ? await sendWeeklyNotes({ admin, today, only: only.length ? only : null }).catch(failure) : null
  return NextResponse.json({ ok: true, today, reminders, weekly_note: note })
}
