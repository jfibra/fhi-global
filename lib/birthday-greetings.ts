import "server-only"

import { createAdminSupabase } from "@/lib/admin-supabase"
import { sendBirthdayEmail } from "@/lib/mailer"

/**
 * Birthday greetings — every ACTIVE member/agent whose birthday (Dubai time)
 * is today gets a branded happy-birthday email. Run once a day by the
 * /api/cron/birthdays route. People born on Feb 29 are celebrated on Mar 1
 * in non-leap years.
 */

const dubaiToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" })
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

export type BirthdayPerson = { id: string; name: string; role: string | null; email: string | null }

export async function findTodaysBirthdays(): Promise<BirthdayPerson[]> {
  const admin = createAdminSupabase()
  const today = dubaiToday()
  const monthDays = [today.slice(5)]
  if (monthDays[0] === "03-01" && !isLeap(Number(today.slice(0, 4)))) monthDays.push("02-29")

  const { data, error } = await admin
    .from("profiles")
    .select("id, fname, fullname, role, birthday")
    .eq("status", "active")
    .neq("is_deleted", true)
    .not("birthday", "is", null)
    .limit(3000)
  if (error) throw new Error(error.message)

  const matches = (data ?? []).filter((p) => p.birthday && monthDays.includes(String(p.birthday).slice(5, 10)))
  const out: BirthdayPerson[] = []
  for (const p of matches) {
    // Emails live in auth.users — same admin lookup the assistant uses.
    const email = await admin.auth.admin
      .getUserById(String(p.id))
      .then((r) => r.data?.user?.email?.trim() ?? null)
      .catch(() => null)
    out.push({
      id: String(p.id),
      name: (p.fname ?? p.fullname ?? "").trim() || "there",
      role: p.role ?? null,
      email,
    })
  }
  return out
}

export async function sendBirthdayGreetings(): Promise<{
  matched: number
  sent: string[]
  skipped: string[]
}> {
  const people = await findTodaysBirthdays()
  const sent: string[] = []
  const skipped: string[] = []
  for (const p of people) {
    if (!p.email) {
      skipped.push(`${p.name} (no email)`)
      continue
    }
    try {
      await sendBirthdayEmail({ to: p.email, name: p.name })
      sent.push(p.email)
    } catch {
      // One failed send must not stop the other birthdays.
      skipped.push(`${p.name} (send failed)`)
    }
  }
  return { matched: people.length, sent, skipped }
}
