import { NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import { revalidatePath } from "next/cache"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { agentWebsite, placementProblem, requireEventAccess } from "@/lib/events/access"
import { eventPublicPath } from "@/lib/events/paths"
import { sanitizeEventInput } from "@/lib/events/validate"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { SITE_URL } from "@/lib/seo"
import { submitToIndexNow } from "@/lib/indexnow"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Fields editors can change via sanitizeEventInput — diffed for the audit trail.
const EDITABLE = ["title", "description", "brand", "image_url", "venue", "status", "event_date", "event_days", "day_times", "day_pax", "registration_open", "registration_fields", "certificate", "video_url", "show_on_main", "show_on_website", "venue_lat", "venue_lng", "venue_place_id"] as const

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
  // jsonb lists (day times, pax per date, fields…) compare by content.
  if (before && after && typeof before === "object" && typeof after === "object") {
    return JSON.stringify(before) === JSON.stringify(after)
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
    .select("id, slug, agent_id, title, description, brand, image_url, venue, status, event_date, event_days, day_times, day_pax, registration_open, registration_fields, certificate, video_url, show_on_main, show_on_website, venue_lat, venue_lng, venue_place_id")
    .eq("id", id)
    .is("deleted_at", null)
  if (g.scope.kind === "own") existingQuery = existingQuery.eq("agent_id", g.scope.agentId)
  const { data: existing, error: fetchErr } = await existingQuery.maybeSingle<ExistingEvent & { slug: string | null; agent_id: string | null }>()

  if (fetchErr) return NextResponse.json({ error: "Failed to update event" }, { status: 500 })
  if (!existing) return NextResponse.json({ error: "Event not found" }, { status: 404 })

  // Where an agent's event appears is the agent's choice since 074 (admins can
  // change it too) — checked as the pair it ends up as. Company events are
  // always on /events, so the flags don't apply to them.
  const site = existing.agent_id ? await agentWebsite(admin, existing.agent_id) : null
  if (!existing.agent_id) {
    delete input.show_on_main
    delete input.show_on_website
  } else if (input.show_on_main !== undefined || input.show_on_website !== undefined) {
    const onMain = input.show_on_main ?? existing.show_on_main === true
    const onWebsite = input.show_on_website ?? existing.show_on_website !== false
    // A website only matters when this save turns the website on.
    const placementError = placementProblem(onMain, onWebsite, Boolean(site) || existing.show_on_website !== false)
    if (placementError) return placementError
  }

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
    // Fields a partial save didn't send (e.g. the publish toggle) weren't changed.
    if (!(key in input)) continue
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
  // An agent's event shown on their website lives there and its /events/<slug>
  // page forwards to it; one on fhiglobal.ae only renders at /events/<slug> —
  // purge both, since the choice may just have changed.
  const onWebsiteNow = (input.show_on_website ?? existing.show_on_website) !== false
  const onMainNow = !existing.agent_id || (input.show_on_main ?? existing.show_on_main) === true
  const publicPath = eventPublicPath(existing, onWebsiteNow && site?.isPublished ? site.slug : null)
  const mainPath = `/events/${existing.slug ?? id}`
  revalidatePath(publicPath)
  if (publicPath !== mainPath) revalidatePath(mainPath)
  // The list page decides by status and show_on_main — both may have just changed.
  revalidatePath("/events")
  if (input.status === "published") {
    // The URL Google should index: /events/<slug> whenever it's on the main page.
    const loc = `${SITE_URL.replace(/\/$/, "")}${onMainNow ? mainPath : publicPath}`
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
