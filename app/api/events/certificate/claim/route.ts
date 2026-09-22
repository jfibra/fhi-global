import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { parseCertificateSettings } from "@/lib/events/certificate"
import { signClaim } from "@/lib/events/certificate-token"
import { allowRequest, clientIp } from "@/lib/rate-limit"
import { titleCaseName } from "@/lib/public-profile"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Self-service certificate claim (public, from the QR / event page).
 * Depending on the event's setting: "registered" matches the email against
 * the attendee list; "open" accepts a typed name. Returns a short-lived signed
 * token the page uses to fetch the preview and the PDF.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers)
  if (!allowRequest(`cert-claim:${ip}`, 12, 60_000)) {
    return NextResponse.json({ error: "Too many attempts — please wait a minute" }, { status: 429 })
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const eventId = typeof body.eventId === "string" ? body.eventId.trim() : ""
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : ""
  const typedName = typeof body.name === "string" ? body.name.replace(/\s+/g, " ").trim().slice(0, 80) : ""
  if (!UUID_RE.test(eventId)) return NextResponse.json({ error: "Invalid event" }, { status: 400 })

  const admin = createAdminSupabase()
  const { data: event } = await admin
    .from("events")
    .select("id, status, deleted_at, certificate")
    .eq("id", eventId)
    .maybeSingle()
  if (!event || event.status !== "published" || event.deleted_at) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }
  const mode = parseCertificateSettings(event.certificate).selfService
  if (mode === "off") return NextResponse.json({ error: "Certificates are not available for this event yet" }, { status: 403 })

  if (mode === "registered") {
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Please enter the email you registered with" }, { status: 400 })
    const { data: reg } = await admin
      .from("event_registrations")
      .select("id, full_name, email")
      .eq("event_id", eventId)
      .ilike("email", email)
      .maybeSingle()
    if (!reg) {
      return NextResponse.json(
        { error: "We couldn't find a registration with that email for this event. Please check the spelling, or ask the team at the desk." },
        { status: 404 },
      )
    }
    const name = titleCaseName(reg.full_name as string)
    return NextResponse.json({ ok: true, name, token: signClaim({ e: eventId, n: name, r: reg.id as string, m: reg.email as string }) })
  }

  // open: any name — drop anything tag-like first, then keep letters (any
  // script), spaces, . ' - so "<b>Clara</b>" becomes "Clara", not "bClarab".
  const clean = typedName.replace(/<[^>]*>/g, " ").replace(/[^\p{L}\p{M} .'\-]/gu, "").replace(/\s+/g, " ").trim()
  if (clean.length < 2) return NextResponse.json({ error: "Please enter your full name" }, { status: 400 })
  const name = titleCaseName(clean)
  return NextResponse.json({ ok: true, name, token: signClaim({ e: eventId, n: name }) })
}
