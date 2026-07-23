import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { canManageEvents } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Attendee list for one event — admin only (service role; RLS keeps this table closed otherwise). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  if (!canManageEvents(session.context.profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 })

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("event_registrations")
    .select("id, full_name, email, whatsapp, created_at")
    .eq("event_id", id)
    .order("created_at", { ascending: false })
    .limit(1000)

  if (error) {
    return NextResponse.json({ error: "Failed to load registrations" }, { status: 500 })
  }

  const registrations = (data ?? []).map((r) => ({
    id: r.id as string,
    fullName: r.full_name as string,
    email: r.email as string,
    whatsapp: (r.whatsapp as string | null) ?? null,
    createdAt: r.created_at as string,
  }))

  return NextResponse.json({ registrations })
}

/** Remove one registration (e.g. test/dummy sign-ups) — hard delete, scoped to the event. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  if (!canManageEvents(session.context.profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { registrationId?: unknown }
  const registrationId = typeof body.registrationId === "string" ? body.registrationId : ""
  if (!UUID_RE.test(id) || !UUID_RE.test(registrationId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { error } = await admin
    .from("event_registrations")
    .delete()
    .eq("id", registrationId)
    .eq("event_id", id)

  if (error) {
    return NextResponse.json({ error: "Failed to delete registration" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
