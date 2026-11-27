import "server-only"

import { after } from "next/server"
import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import { agentWebsite, placementIssue, type EventScope } from "@/lib/events/access"
import { eventPublicPath } from "@/lib/events/paths"
import { POSTER_DRAWN_FIELDS, isAutoPosterUrl } from "@/lib/events/poster-url"
import type { sanitizeEventInput } from "@/lib/events/validate"
import { logAuditEvent, type AuditActor, type AuditRequestContext } from "@/lib/audit-log"
import { SITE_URL } from "@/lib/seo"
import { submitToIndexNow } from "@/lib/indexnow"

/**
 * Saving an event — the ONE place it happens (2026-11-27). The dashboard
 * routes (app/api/admin/events, …/[id]) and Claude's event tools
 * (lib/mcp/events.ts) both call these, so the slug, the placement rule, the
 * audit trail, the page purges and the IndexNow ping can never differ
 * between the two. The caller does the access check and hands in fields
 * that already went through sanitizeEventInput().
 *
 * Runs on the service-role client, so the audit_logs DB trigger can't name
 * the actor (auth.uid() is NULL) — every write is logged here explicitly,
 * with `source` saying where it came from.
 */

export type EventInput = ReturnType<typeof sanitizeEventInput>
export type EventWriteMeta = { actor: AuditActor; source: "dashboard" | "claude"; request?: Partial<AuditRequestContext> }
export type EventWriteFailure = { ok: false; status: number; error: string; code?: string }

/** Activity Logs has no source column, so a write from Claude says so in its sentence. */
const via = (meta: EventWriteMeta) => (meta.source === "claude" ? " via Claude" : "")

// URL slug from the title ("FHI Global Summit 2026" -> "fhi-global-summit-2026").
// Generated once at creation and kept stable afterwards so shared links and
// printed QR codes never break when the title is edited.
function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

/**
 * Insert an event. `ownerId` null = a company event (always on /events);
 * otherwise the agent it belongs to, whose placement the caller has already
 * checked (placementProblem) and whose website is `site`.
 */
export async function createEvent(
  admin: SupabaseClient,
  p: { input: EventInput; ownerId: string | null; site: { slug: string; isPublished: boolean } | null; meta: EventWriteMeta },
): Promise<{ ok: true; id: string; slug: string | null } | EventWriteFailure> {
  const { input, ownerId, site, meta } = p
  const base = slugify(input.title)
  let slug: string | null = base || null

  let result = await admin
    .from("events")
    .insert({ ...input, slug, created_by: meta.actor.id, agent_id: ownerId })
    .select("id")
    .single()

  // Slug taken by another event — retry once with a short suffix.
  if (result.error?.code === "23505" && slug) {
    slug = `${base}-${Math.random().toString(36).slice(2, 7)}`
    result = await admin
      .from("events")
      .insert({ ...input, slug, created_by: meta.actor.id, agent_id: ownerId })
      .select("id")
      .single()
  }

  if (result.error || !result.data) {
    return { ok: false, status: 500, error: "Failed to create event" }
  }
  const id = String(result.data.id)

  await logAuditEvent({
    category: "events",
    event: "created",
    source: meta.source,
    actor: meta.actor,
    subjectType: "events",
    subjectId: id,
    subjectLabel: input.title,
    description: `Created event "${input.title}"${via(meta)}`,
    newValues: { ...input, slug },
    ...meta.request,
  })

  // Created live → tell IndexNow after the response is sent (after() keeps
  // the serverless function alive; see app/news-sitemap.xml/route.ts).
  const publicPath = eventPublicPath({ id, slug }, input.show_on_website && site?.isPublished ? site.slug : null)
  // The URL Google should index: /events/<slug> whenever the event is on the
  // main page (company events always), else the agent's website page.
  const mainPath = `/events/${slug ?? id}`
  const canonicalPath = !ownerId || input.show_on_main ? mainPath : publicPath
  if (ownerId && input.show_on_main) revalidatePath("/events")
  if (input.status === "published") {
    const loc = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`
    after(() => submitToIndexNow([loc]))
  }
  revalidatePath(publicPath)
  if (canonicalPath !== publicPath) revalidatePath(canonicalPath)
  // The agent's site lists their events — refresh its main page too.
  if (site?.isPublished) revalidatePath(`/website/${site.slug}`)

  return { ok: true, id, slug }
}

// Fields editors can change via sanitizeEventInput — diffed for the audit trail.
const EDITABLE = ["title", "description", "brand", "image_url", "venue", "status", "event_date", "event_days", "day_times", "day_pax", "registration_open", "registration_fields", "certificate", "video_url", "show_on_main", "show_on_website", "venue_lat", "venue_lng", "venue_place_id"] as const

type ExistingEvent = Record<(typeof EDITABLE)[number], unknown> & { id: string }

// Timestamps come back from Postgres as "+00:00" and from input as ".000Z" —
// compare instants, not strings, so unchanged dates don't produce diff noise.
function sameValue(key: string, before: unknown, next: unknown): boolean {
  if (key === "event_date" && typeof before === "string" && typeof next === "string") {
    return new Date(before).getTime() === new Date(next).getTime()
  }
  // jsonb lists (day times, pax per date, fields…) compare by content.
  if (before && next && typeof before === "object" && typeof next === "object") {
    return JSON.stringify(before) === JSON.stringify(next)
  }
  return (before ?? null) === (next ?? null)
}

/**
 * Update an event. `scope` pins a Website Builder user to their own events —
 * anyone else's answers 404, as if it didn't exist; admin staff ("all") act
 * on any. `input` is the whole sanitized payload: the fields
 * sanitizeEventInput always returns (title, description, brand, photo,
 * venue, status, date, registration_open) are written as sent, the
 * only-when-sent ones (days, times, pax, fields, certificate, video,
 * placement, pin) only when the caller included them.
 */
export async function updateEvent(
  admin: SupabaseClient,
  p: { id: string; input: EventInput; scope: EventScope; meta: EventWriteMeta },
): Promise<{ ok: true; changedKeys: string[] } | EventWriteFailure> {
  const { id, input, scope, meta } = p

  let existingQuery = admin
    .from("events")
    .select("id, slug, agent_id, title, description, brand, image_url, venue, status, event_date, event_days, day_times, day_pax, registration_open, registration_fields, certificate, video_url, show_on_main, show_on_website, venue_lat, venue_lng, venue_place_id")
    .eq("id", id)
    .is("deleted_at", null)
  if (scope.kind === "own") existingQuery = existingQuery.eq("agent_id", scope.agentId)
  const { data: existing, error: fetchErr } = await existingQuery.maybeSingle<ExistingEvent & { slug: string | null; agent_id: string | null }>()

  if (fetchErr) return { ok: false, status: 500, error: "Failed to update event" }
  if (!existing) return { ok: false, status: 404, error: "Event not found" }

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
    const issue = placementIssue(onMain, onWebsite, Boolean(site) || existing.show_on_website !== false)
    if (issue) return { ok: false, status: issue.status, error: issue.error, code: issue.code }
  }

  const { error } = await admin
    .from("events")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)

  if (error) {
    return { ok: false, status: 500, error: "Failed to update event" }
  }

  const oldValues: Record<string, unknown> = {}
  const newValues: Record<string, unknown> = {}
  const changedKeys: string[] = []
  for (const key of EDITABLE) {
    // Fields a partial save didn't send (e.g. the publish toggle) weren't changed.
    if (!(key in input)) continue
    const before = existing[key] ?? null
    const next = (input as Record<string, unknown>)[key] ?? null
    if (!sameValue(key, before, next)) {
      oldValues[key] = before
      newValues[key] = next
      changedKeys.push(key)
    }
  }

  if (changedKeys.length > 0) {
    await logAuditEvent({
      category: "events",
      event: "updated",
      source: meta.source,
      actor: meta.actor,
      subjectType: "events",
      subjectId: id,
      subjectLabel: input.title,
      description: `Edited event "${input.title}" (${changedKeys.join(", ")})${via(meta)}`,
      oldValues,
      newValues,
      changedKeys,
      ...meta.request,
    })
  }

  // An automatic poster prints the title, the date and the venue: when one of
  // them changed — from the dashboard or from Claude — it is drawn again, so the
  // cover never shows an old date (lib/events/poster.tsx; loaded only when
  // needed). A photo someone uploaded is not a poster and is left alone.
  if (isAutoPosterUrl(input.image_url) && changedKeys.some((k) => (POSTER_DRAWN_FIELDS as readonly string[]).includes(k))) {
    try {
      const { refreshAutoPoster } = await import("@/lib/events/poster")
      await refreshAutoPoster(admin, id)
    } catch (e) {
      console.error("[events] poster refresh", e instanceof Error ? e.message : e)
    }
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
  // The agent's site lists their events — refresh its main page too.
  if (site?.isPublished) revalidatePath(`/website/${site.slug}`)
  if (input.status === "published") {
    // The URL Google should index: /events/<slug> whenever it's on the main page.
    const loc = `${SITE_URL.replace(/\/$/, "")}${onMainNow ? mainPath : publicPath}`
    after(() => submitToIndexNow([loc]))
  }

  return { ok: true, changedKeys }
}
