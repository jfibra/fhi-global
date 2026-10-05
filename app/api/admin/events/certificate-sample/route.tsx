import type { NextRequest } from "next/server"
import { canAccessEvent, requireEventAccess } from "@/lib/events/access"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { parseCertificateSettings } from "@/lib/events/certificate"
import { buildCertificateInput, loadCertificateEvent, type CertificateEventRow } from "@/lib/events/certificate-server"
import { renderCertificate } from "@/lib/events/certificate-image"
import { normalizeEventDays } from "@/lib/events/dates"

export const runtime = "nodejs"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const text = (v: string | null, max: number) => (v ?? "").replace(/\s+/g, " ").trim().slice(0, max)

/**
 * Certificate preview for the New / Edit event form — the event may not be
 * saved yet, so its details come from the query (title, brand, date, days,
 * venue, design) and a sample attendee name is shown. With `eventId` (an
 * event the caller may manage) the saved heading and signatories are used.
 */
export async function GET(req: NextRequest) {
  const access = await requireEventAccess()
  if (!access.ok) return access.response

  const q = req.nextUrl.searchParams
  const eventId = q.get("eventId")
  let saved: CertificateEventRow | null = null
  if (eventId && UUID_RE.test(eventId)) {
    const admin = createAdminSupabase()
    if (await canAccessEvent(admin, eventId, access.scope)) saved = await loadCertificateEvent(admin, eventId)
  }

  const iso = q.get("date")
  const event: CertificateEventRow = {
    id: saved?.id ?? "00000000-0000-4000-8000-000000000000",
    slug: saved?.slug ?? null,
    title: text(q.get("title"), 160) || "Your event title",
    event_date: iso && !Number.isNaN(new Date(iso).getTime()) ? iso : null,
    event_days: normalizeEventDays(Number(q.get("days") ?? 1)),
    venue: text(q.get("venue"), 200) || null,
    brand: text(q.get("brand"), 40) || "fhiglobal",
    certificate: saved?.certificate ?? null,
  }
  const settingsOverride = parseCertificateSettings({ ...parseCertificateSettings(event.certificate), design: q.get("design") })

  const input = await buildCertificateInput({ event, registration: null, settingsOverride, origin: req.nextUrl.origin })
  const res = renderCertificate(input)
  res.headers.set("Cache-Control", "no-store")
  return res
}
