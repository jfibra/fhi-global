import { NextRequest, NextResponse } from "next/server"
import { canAccessEvent, eventNotFound, requireEventAccess } from "@/lib/events/access"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { parseCertificateSettings } from "@/lib/events/certificate"
import { buildCertificateInput, loadCertificateEvent, loadCertificateRegistration } from "@/lib/events/certificate-server"
import { renderCertificate } from "@/lib/events/certificate-image"

export const runtime = "nodejs"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Live PNG preview for the certificate designer — admin only. Design values
 * come from the query string so the admin sees edits before saving; with no
 * overrides the saved design is used. `registrationId` picks a real attendee,
 * otherwise a sample name is shown.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireEventAccess()
  if (!access.ok) return access.response

  const { id } = await params
  // Admin staff: any event; an agent: only their own (migration 057).
  if (!(await canAccessEvent(createAdminSupabase(), id, access.scope))) return eventNotFound()
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 })

  const admin = createAdminSupabase()
  const event = await loadCertificateEvent(admin, id)
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

  const q = req.nextUrl.searchParams
  const regId = q.get("registrationId")
  const registration = regId && UUID_RE.test(regId) ? await loadCertificateRegistration(admin, id, regId) : null

  const hasOverride = ["heading", "line", "note", "s1n", "s1t", "s2n", "s2t"].some((k) => q.has(k))
  const settingsOverride = hasOverride
    ? parseCertificateSettings({
        heading: q.get("heading"),
        line: q.get("line"),
        note: q.get("note"),
        signatories: [
          { name: q.get("s1n"), title: q.get("s1t") },
          { name: q.get("s2n"), title: q.get("s2t") },
        ],
      })
    : undefined

  const input = await buildCertificateInput({ event, registration, settingsOverride, origin: req.nextUrl.origin })
  const res = renderCertificate(input)
  res.headers.set("Cache-Control", "no-store")
  return res
}
