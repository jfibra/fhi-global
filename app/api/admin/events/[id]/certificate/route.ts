import { NextRequest, NextResponse } from "next/server"
import { canAccessEvent, eventNotFound, requireEventAccess } from "@/lib/events/access"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { parseCertificateSettings } from "@/lib/events/certificate"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Save the certificate design for one event — touches nothing else on the row. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireEventAccess()
  if (!access.ok) return access.response

  const { id } = await params
  // Admin staff: any event; an agent: only their own (migration 057).
  if (!(await canAccessEvent(createAdminSupabase(), id, access.scope))) return eventNotFound()
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const certificate = parseCertificateSettings(body.certificate ?? body)

  const admin = createAdminSupabase()
  const { error } = await admin
    .from("events")
    .update({ certificate, updated_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
  if (error) return NextResponse.json({ error: "Failed to save certificate design" }, { status: 500 })

  return NextResponse.json({ ok: true, certificate })
}
