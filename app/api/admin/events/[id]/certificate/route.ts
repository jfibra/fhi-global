import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { canManageEvents } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { parseCertificateSettings } from "@/lib/events/certificate"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Save the certificate design for one event — touches nothing else on the row. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  if (!canManageEvents(session.context.profile.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
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
