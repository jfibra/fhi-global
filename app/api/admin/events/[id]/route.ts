import { NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import { revalidatePath } from "next/cache"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { agentWebsite, requireEventAccess } from "@/lib/events/access"
import { eventPublicPath } from "@/lib/events/paths"
import { sanitizeEventInput } from "@/lib/events/validate"
import { updateEvent } from "@/lib/events/write"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { SITE_URL } from "@/lib/seo"
import { submitToIndexNow } from "@/lib/indexnow"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

/**
 * Update an event — admin staff, or the agent who owns it. The save itself
 * (placement rule, audit diff, page purges, IndexNow) is updateEvent() in
 * lib/events/write.ts, shared with Claude's event tools.
 */
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
  const saved = await updateEvent(createAdminSupabase(), {
    id,
    input,
    scope: g.scope,
    meta: { actor: actorFrom(g.context), source: "dashboard", request: requestContextFromRequest(req) },
  })
  if (!saved.ok) {
    return NextResponse.json({ error: saved.error, ...(saved.code ? { code: saved.code } : {}) }, { status: saved.status })
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
    .select("id, title, slug, agent_id, show_on_website")
    .eq("id", id)
    .is("deleted_at", null)
  if (g.scope.kind === "own") existingQuery = existingQuery.eq("agent_id", g.scope.agentId)
  const { data: existing, error: fetchErr } = await existingQuery.maybeSingle<{
    id: string
    title: string
    slug: string | null
    agent_id: string | null
    show_on_website: boolean | null
  }>()

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

  // Gone from every place it was shown, at once — the event's own page(s) must 404, the
  // /events list and the agent's site stop listing it (all ISR), and IndexNow is told the
  // URL is gone. The page may live at /events/<slug> and/or on the agent's website.
  const site = existing.agent_id ? await agentWebsite(admin, existing.agent_id) : null
  const mainPath = `/events/${existing.slug ?? id}`
  const sitePath = site?.isPublished ? eventPublicPath(existing, site.slug) : null
  revalidatePath(mainPath)
  if (sitePath && sitePath !== mainPath) revalidatePath(sitePath)
  revalidatePath("/events")
  if (site?.isPublished) revalidatePath(`/website/${site.slug}`)
  const origin = SITE_URL.replace(/\/$/, "")
  after(() => submitToIndexNow([...new Set([mainPath, sitePath].filter((p): p is string => Boolean(p)))].map((p) => `${origin}${p}`)))

  return NextResponse.json({ ok: true })
}
