import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { isAdminStaffRole } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { sanitizeEventInput } from "@/lib/events/validate"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function guard() {
  const session = await requireActiveSession()
  if (!session.ok) return { ok: false as const, response: session.response }
  if (!isAdminStaffRole(session.context.profile.role)) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { ok: true as const }
}

/** Update an event — admin only. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard()
  if (!g.ok) return g.response

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const input = sanitizeEventInput(body)
  if (!input.title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { error } = await admin
    .from("events")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)

  if (error) {
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

/** Soft-delete an event — admin only. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard()
  if (!g.ok) return g.response

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 })

  const admin = createAdminSupabase()
  const { error } = await admin
    .from("events")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
