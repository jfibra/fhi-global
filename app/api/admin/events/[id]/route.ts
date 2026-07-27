import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { canManageEvents } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { sanitizeEventInput } from "@/lib/events/validate"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Fields editors can change via sanitizeEventInput — diffed for the audit trail.
const EDITABLE = ["title", "description", "brand", "image_url", "venue", "status", "event_date", "registration_open"] as const

type ExistingEvent = Record<(typeof EDITABLE)[number], unknown> & { id: string }

// Event mutations run on the service-role client, so the audit_logs DB trigger
// can't attribute an actor (auth.uid() is NULL) — routes log explicitly instead.
function actorFrom(ctx: { userId: string; email: string | null; profile: { role: string | null; fullname: string | null } }) {
  return { id: ctx.userId, name: ctx.profile.fullname ?? ctx.email ?? null, role: ctx.profile.role }
}

async function guard() {
  const session = await requireActiveSession()
  if (!session.ok) return { ok: false as const, response: session.response }
  if (!canManageEvents(session.context.profile.role)) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { ok: true as const, context: session.context }
}

// Timestamps come back from Postgres as "+00:00" and from input as ".000Z" —
// compare instants, not strings, so unchanged dates don't produce diff noise.
function sameValue(key: string, before: unknown, after: unknown): boolean {
  if (key === "event_date" && typeof before === "string" && typeof after === "string") {
    return new Date(before).getTime() === new Date(after).getTime()
  }
  return (before ?? null) === (after ?? null)
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
  const { data: existing, error: fetchErr } = await admin
    .from("events")
    .select("id, title, description, brand, image_url, venue, status, event_date, registration_open")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<ExistingEvent>()

  if (fetchErr) return NextResponse.json({ error: "Failed to update event" }, { status: 500 })
  if (!existing) return NextResponse.json({ error: "Event not found" }, { status: 404 })

  const { error } = await admin
    .from("events")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)

  if (error) {
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 })
  }

  const oldValues: Record<string, unknown> = {}
  const newValues: Record<string, unknown> = {}
  const changedKeys: string[] = []
  for (const key of EDITABLE) {
    const before = existing[key] ?? null
    const after = input[key] ?? null
    if (!sameValue(key, before, after)) {
      oldValues[key] = before
      newValues[key] = after
      changedKeys.push(key)
    }
  }

  if (changedKeys.length > 0) {
    await logAuditEvent({
      category: "events",
      event: "updated",
      source: "dashboard",
      actor: actorFrom(g.context),
      subjectType: "events",
      subjectId: id,
      subjectLabel: input.title,
      description: `Edited event "${input.title}" (${changedKeys.join(", ")})`,
      oldValues,
      newValues,
      changedKeys,
      ...requestContextFromRequest(req),
    })
  }

  return NextResponse.json({ ok: true })
}

/** Soft-delete an event — admin only. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard()
  if (!g.ok) return g.response

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 })

  const admin = createAdminSupabase()
  const { data: existing, error: fetchErr } = await admin
    .from("events")
    .select("id, title")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; title: string }>()

  if (fetchErr) return NextResponse.json({ error: "Failed to delete event" }, { status: 500 })
  if (!existing) return NextResponse.json({ error: "Event not found" }, { status: 404 })

  const { error } = await admin
    .from("events")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 })
  }

  await logAuditEvent({
    category: "events",
    event: "deleted",
    source: "dashboard",
    actor: actorFrom(g.context),
    subjectType: "events",
    subjectId: id,
    subjectLabel: existing.title,
    description: `Deleted event "${existing.title}"`,
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ ok: true })
}
