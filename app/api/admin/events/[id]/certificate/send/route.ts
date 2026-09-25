import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import { canAccessEvent, eventNotFound, requireEventAccess } from "@/lib/events/access"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { sendEventCertificateEmail } from "@/lib/mailer"
import {
  buildCertificateInput,
  certificateFilename,
  certificatePdfFromPng,
  loadCertificateEvent,
  loadCertificateRegistration,
  renderCertificatePng,
} from "@/lib/events/certificate-server"
import { certificateDateLabel } from "@/lib/events/certificate-image"

export const runtime = "nodejs"
export const maxDuration = 60

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Email ONE attendee their certificate (PDF attachment) using the event's
 * saved design, then stamp certificate_sent_at. Bulk sending is the admin UI
 * calling this once per person, so each send gets its own status and a slow
 * mail server can never time out a whole batch.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireEventAccess()
  if (!access.ok) return access.response

  const { id } = await params
  // Admin staff: any event; an agent: only their own (migration 057).
  if (!(await canAccessEvent(createAdminSupabase(), id, access.scope))) return eventNotFound()
  const body = (await req.json().catch(() => ({}))) as { registrationId?: unknown }
  const regId = typeof body.registrationId === "string" ? body.registrationId : ""
  if (!UUID_RE.test(id) || !UUID_RE.test(regId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const admin = createAdminSupabase()
  const event = await loadCertificateEvent(admin, id)
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })
  const registration = await loadCertificateRegistration(admin, id, regId)
  if (!registration) return NextResponse.json({ error: "Registration not found" }, { status: 404 })

  try {
    const input = await buildCertificateInput({ event, registration, origin: req.nextUrl.origin })
    const png = await renderCertificatePng(input)
    const pdf = await certificatePdfFromPng(png, { title: input.settings.heading, attendee: input.attendeeName })
    // Inline email preview: a third of the pixels, JPEG — ~150 KB instead of ~600 KB.
    const preview = await sharp(png).resize({ width: 1088 }).jpeg({ quality: 86, mozjpeg: true }).toBuffer()

    await sendEventCertificateEmail({
      to: registration.email,
      fullName: input.attendeeName,
      eventTitle: event.title,
      dateLabel: certificateDateLabel(event.event_date),
      venue: event.venue,
      heading: input.settings.heading,
      pdf,
      preview,
      filename: certificateFilename(input.attendeeName, event.slug),
    })
  } catch (e) {
    console.error("[certificate/send] failed:", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "Could not send the certificate — please try again" }, { status: 502 })
  }

  const sentAt = new Date().toISOString()
  await admin.from("event_registrations").update({ certificate_sent_at: sentAt }).eq("id", regId)
  return NextResponse.json({ ok: true, sentAt })
}
