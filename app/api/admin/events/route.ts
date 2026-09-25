import { NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import { revalidatePath } from "next/cache"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { agentWebsite, publishedSiteSlugs, requireEventAccess } from "@/lib/events/access"
import { eventPublicPath } from "@/lib/events/paths"
import { sanitizeEventInput } from "@/lib/events/validate"
import { parseRegistrationFields } from "@/lib/events/fields"
import { parseCertificateSettings } from "@/lib/events/certificate"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { SITE_URL } from "@/lib/seo"
import { submitToIndexNow } from "@/lib/indexnow"

// Event mutations run on the service-role client, so the audit_logs DB trigger
// can't attribute an actor (auth.uid() is NULL) — routes log explicitly instead.
function actorFrom(ctx: { userId: string; email: string | null; profile: { role: string | null; fullname: string | null } }) {
  return { id: ctx.userId, name: ctx.profile.fullname ?? ctx.email ?? null, role: ctx.profile.role }
}

/**
 * Events (any status) with registration counts. Admin staff get every event,
 * company and agents'; a Website Builder user gets only their own (057). Each
 * comes with its public path — /events/<slug> for a company event, the owner's
 * website for an agent's.
 */
export async function GET() {
  const access = await requireEventAccess()
  if (!access.ok) return access.response

  const admin = createAdminSupabase()
  let query = admin
    .from("events")
    .select("id, slug, title, description, brand, image_url, event_date, venue, status, registration_open, registration_fields, certificate, created_at, view_count, qr_scan_count, agent_id, owner:profiles!events_agent_id_fkey(fullname), event_registrations(count)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
  if (access.scope.kind === "own") query = query.eq("agent_id", access.scope.agentId)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 })
  }

  const siteByAgent = await publishedSiteSlugs(
    admin,
    (data ?? []).map((e) => (e.agent_id as string | null) ?? ""),
  )

  const events = (data ?? []).map((e) => {
    const counts = e.event_registrations as unknown as { count: number }[] | null
    const agentId = (e.agent_id as string | null) ?? null
    const owner = (Array.isArray(e.owner) ? e.owner[0] : e.owner) as { fullname: string | null } | null
    return {
      id: e.id as string,
      slug: (e.slug as string | null) ?? null,
      title: e.title as string,
      description: (e.description as string | null) ?? null,
      brand: (e.brand as string) ?? "fhiglobal",
      imageUrl: (e.image_url as string | null) ?? null,
      eventDate: (e.event_date as string | null) ?? null,
      venue: (e.venue as string | null) ?? null,
      status: (e.status as string) ?? "draft",
      registrationOpen: (e.registration_open as boolean | null) !== false,
      registrationFields: parseRegistrationFields(e.registration_fields),
      certificate: parseCertificateSettings(e.certificate),
      createdAt: e.created_at as string,
      registrationCount: counts?.[0]?.count ?? 0,
      viewCount: (e.view_count as number | null) ?? 0,
      qrScanCount: (e.qr_scan_count as number | null) ?? 0,
      /** null = company event on /events; otherwise the agent it belongs to. */
      agentId,
      ownerName: agentId ? (owner?.fullname ?? null) : null,
      publicPath: eventPublicPath(
        { id: e.id as string, slug: (e.slug as string | null) ?? null },
        agentId ? siteByAgent.get(agentId) : null,
      ),
    }
  })

  return NextResponse.json({ events, scope: access.scope.kind })
}

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
 * Create an event. Admin staff create company events (listed on /events); a
 * Website Builder user creates their OWN event, shown on their website — which
 * they must have created first.
 */
export async function POST(req: NextRequest) {
  const access = await requireEventAccess()
  if (!access.ok) return access.response
  const session = { context: access.context }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const input = sanitizeEventInput(body)
  if (!input.title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  const admin = createAdminSupabase()

  // An agent's event lives on their website, so it needs one to live on.
  const ownerId = access.scope.kind === "own" ? access.scope.agentId : null
  const site = ownerId ? await agentWebsite(admin, ownerId) : null
  if (ownerId && !site) {
    return NextResponse.json(
      { error: "Create your website in the Website Builder first — your events are published on it.", code: "no_website" },
      { status: 409 },
    )
  }

  const base = slugify(input.title)
  let slug: string | null = base || null

  let result = await admin
    .from("events")
    .insert({ ...input, slug, created_by: session.context.userId, agent_id: ownerId })
    .select("id")
    .single()

  // Slug taken by another event — retry once with a short suffix.
  if (result.error?.code === "23505" && slug) {
    slug = `${base}-${Math.random().toString(36).slice(2, 7)}`
    result = await admin
      .from("events")
      .insert({ ...input, slug, created_by: session.context.userId, agent_id: ownerId })
      .select("id")
      .single()
  }

  if (result.error || !result.data) {
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 })
  }

  await logAuditEvent({
    category: "events",
    event: "created",
    source: "dashboard",
    actor: actorFrom(session.context),
    subjectType: "events",
    subjectId: String(result.data.id),
    subjectLabel: input.title,
    description: `Created event "${input.title}"`,
    newValues: { ...input, slug },
    ...requestContextFromRequest(req),
  })

  // Created live → tell IndexNow after the response is sent (after() keeps
  // the serverless function alive; see app/news-sitemap.xml/route.ts).
  const publicPath = eventPublicPath({ id: String(result.data.id), slug }, site?.isPublished ? site.slug : null)
  if (input.status === "published") {
    const loc = `${SITE_URL.replace(/\/$/, "")}${publicPath}`
    after(() => submitToIndexNow([loc]))
  }
  revalidatePath(publicPath)

  return NextResponse.json({ id: result.data.id })
}
