import "server-only"

import { randomUUID } from "node:crypto"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { birthdayEmailCopy, sendBirthdayEmail } from "@/lib/mailer"
import { renderBirthdayPosterPng } from "@/lib/birthday-poster"

/**
 * Birthday greetings — every ACTIVE member/agent whose birthday (Dubai time)
 * is today gets a branded happy-birthday email. Run once a day by the
 * /api/cron/birthdays route. People born on Feb 29 are celebrated on Mar 1
 * in non-leap years.
 */

const dubaiToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" })
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

export type BirthdayPerson = {
  id: string
  name: string
  /** Full name as it should appear on the poster artwork. */
  posterName: string
  photo: string | null
  role: string | null
  email: string | null
}

export async function findTodaysBirthdays(): Promise<BirthdayPerson[]> {
  const admin = createAdminSupabase()
  const today = dubaiToday()
  const monthDays = [today.slice(5)]
  if (monthDays[0] === "03-01" && !isLeap(Number(today.slice(0, 4)))) monthDays.push("02-29")

  const { data, error } = await admin
    .from("profiles")
    .select("id, fname, fullname, role, birthday, profile_url")
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
      posterName: (p.fullname ?? p.fname ?? "").trim().replace(/\s+/g, " ") || "You",
      photo: (p.profile_url as string | null) ?? null,
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
    // The poster is a bonus — a render failure never blocks the greeting.
    const posterPng = await renderBirthdayPosterPng({ name: p.posterName, photoUrl: p.photo }).catch(() => null)
    let sendError: string | null = null
    try {
      await sendBirthdayEmail({ to: p.email, name: p.name, posterPng })
      sent.push(p.email)
    } catch (err) {
      // One failed send must not stop the other birthdays.
      sendError = err instanceof Error ? err.message : String(err)
      skipped.push(`${p.name} (send failed)`)
    }
    await recordInSentFolder(p, posterPng, sendError)
  }
  return { matched: people.length, sent, skipped }
}

/**
 * Every greeting shows in the admin Emails → Sent folder like any email sent
 * from the dashboard (inquiry_emails, no sender profile), with the poster as
 * an attachment so admins see exactly what went out. A failed send is listed
 * too, marked failed. Recording never throws — the greetings matter more.
 */
async function recordInSentFolder(p: BirthdayPerson, posterPng: Buffer | null, sendError: string | null) {
  try {
    const { subject, text } = birthdayEmailCopy(p.name)
    const attachments: Array<{ name: string; url: string; size: number; type: string }> = []
    if (posterPng) {
      try {
        const key = `fhi_global/email-attachments/${randomUUID()}-happy-birthday.png`
        await posterBucket().send(
          new PutObjectCommand({ Bucket: process.env.S3_BUCKET_NAME!, Key: key, Body: posterPng, ContentType: "image/png", CacheControl: "public, max-age=31536000, immutable" }),
        )
        attachments.push({ name: "happy-birthday.png", url: `${(process.env.S3_PUBLIC_URL ?? "").replace(/\/+$/, "")}/${key}`, size: posterPng.length, type: "image/png" })
      } catch {
        // The record without its poster still beats no record.
      }
    }
    await createAdminSupabase()
      .from("inquiry_emails")
      .insert({
        to_email: p.email!.toLowerCase(),
        to_name: p.posterName,
        subject,
        body_text: text,
        sent_by: null,
        sent_by_name: "Birthday greeting (automatic)",
        status: sendError ? "failed" : "sent",
        error: sendError,
        from_email: (process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "").trim().toLowerCase() || null,
        from_name: process.env.SMTP_FROM_NAME || "FHI Global",
        attachments,
      })
  } catch {
    /* never block the greetings on the record */
  }
}

let bucket: S3Client | null = null
const posterBucket = () =>
  (bucket ??= new S3Client({
    region: process.env.S3_REGION!,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  }))
