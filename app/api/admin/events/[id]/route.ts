import { NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import { revalidatePath } from "next/cache"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { agentWebsite, requireEventAccess } from "@/lib/events/access"
import { eventPublicPath } from "@/lib/events/paths"
import { sanitizeEventInput } from "@/lib/events/validate"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { SITE_URL } from "@/lib/seo"
import { submitToIndexNow } from "@/lib/indexnow"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Fields editors can change via sanitizeEventInput — diffed for the audit trail.
const EDITABLE = ["title", "description", "brand", "image_url", "venue", "status", "event_date", "registration_open", "registration_fields", "certificate"] as const

type ExistingEvent = Record<(typeof EDITABLE)[number], unknown> & { id: string }

// Event mutations run on the service-role client, so the audit_logs DB trigger
// can't attribute an actor (auth.uid() is NULL) — routes log explicitly instead.
function actorFrom(ctx: { userId: string; email: string | null; profile: { role: string | null; fullname: string | null } }) {
  return { id: ctx.userId, name: ctx.profile.fullname ?? ctx.email ?? null, role: ctx.profile.role }
}

// Admin staff act on any event; a Website Builder user only on their own
// (migration 057) — anyone else's event answers 404, as if it didn't exist.
async function guard() {
  const access = await requireEventAccess()
  if (!access.ok) return { ok: false as const, response: access.response }
  return { ok: true as const, context: access.context, scope: access.scope }
}


// Timestamps come back from Postgres as "+00:00" and from input as ".000Z" —
// compare instants, not strings, so unchanged dates don't produce diff noise.
function sameValue(key: string, before: unknown, after: unknown): boolean {
  if (key === "event_date" && typeof before === "string" && typeof after === "string") {
    return new Date(before).getTime() === new Date(after).getTime()
  }
  return (before ?? null) === (after ?? null)
}

/** Update an event — admin staff, or the agent who owns it. */
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
  let existingQuery = admin
    .from("events")
    .select("id, slug, agent_id, title, description, brand, image_url, venue, status, event_date, registration_open, registration_fields, certificate")
    .eq("id", id)
    .is("deleted_at", null)
  if (g.scope.kind === "own") existingQuery = existingQuery.eq("agent_id", g.scope.agentId)
  const { data: existing, error: fetchErr } = await existingQuery.maybeSingle<ExistingEvent & { slug: string | null; agent_id: string | null }>()

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

  // Purge the public page immediately (a draft flip must not serve stale for
  // up to `revalidate` seconds) and, when live, ping IndexNow after response.
  // An agent's event lives on their website; its old /events/<slug> page only
  // forwards there, so purge both.
  const site = existing.agent_id ? await agentWebsite(admin, existing.agent_id) : null
  const publicPath = eventPublicPath(existing, site?.isPublished ? site.slug : null)
  revalidatePath(publicPath)
  if (publicPath !== `/events/${existing.slug ?? id}`) revalidatePath(`/events/${existing.slug ?? id}`)
  if (input.status === "published") {
    const loc = `${SITE_URL.replace(/\/$/, "")}${publicPath}`
    after(() => submitToIndexNow([loc]))
  }

  return NextResponse.json({ ok: true })
}

/** Soft-delete an event — admin staff, or the agent who owns it. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard()
  if (!g.ok) return g.response

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 })

  const admin = createAdminSupabase()
  let existingQuery = admin
    .from("events")
    .select("id, title")
    .eq("id", id)
    .is("deleted_at", null)
  if (g.scope.kind === "own") existingQuery = existingQuery.eq("agent_id", g.scope.agentId)
  const { data: existing, error: fetchErr } = await existingQuery.maybeSingle<{ id: string; title: string }>()

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
