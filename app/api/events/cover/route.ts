import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { canManageEvents, canManageOwnEvents } from "@/lib/app-roles"
import { requestContextFromRequest } from "@/lib/audit-log"
import { isInactiveProfile } from "@/lib/auth"
import { COVER_MAX_BYTES, normalizeCoverPhoto, readCoverTicket, storeEventImage } from "@/lib/events/cover"
import { sanitizeEventInput } from "@/lib/events/validate"
import { updateEvent } from "@/lib/events/write"
import { allowRequest, clientIp } from "@/lib/rate-limit"

/**
 * POST /api/events/cover?t=<ticket> — the event card's "Add photo" button
 * (2026-11-27). The card runs in a frame inside Claude: it has no FHI
 * session and Claude cannot hand a picture to a tool, so the person picks a
 * photo in the card and the card posts it here with the signed ticket the
 * event tools put in their answer (lib/mcp/events.ts → lib/events/cover.ts).
 *
 * The ticket names ONE event and ONE person and lasts twelve hours. It is
 * only the way in — every upload re-reads both:
 *   · the account is active and its role still runs events (company events
 *     for admin staff, their own for an agent or team leader);
 *   · the event exists, is the kind that person may change, and is still a
 *     DRAFT — a live event is changed in the dashboard, as from Claude.
 * The picture is decoded and re-encoded by sharp (so only a real image is
 * ever stored), saved beside the dashboard's uploads, and set as the cover
 * through updateEvent() — the same save, audit row ("… via Claude") and page
 * purges as everywhere else. It replaces an automatic poster.
 *
 * Open to other origins on purpose (the frame's origin is a Claude sandbox
 * host that changes per conversation): there are no cookies here, and the
 * ticket is the only credential. sharp → listed in outputFileTracingIncludes.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "600" }
const HEADERS = { ...CORS, "cache-control": "no-store" }
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: HEADERS })

type ProfileRow = { id: string; fullname: string | null; role: string | null; status: string | null; is_deleted: boolean | null }
type EventRow = { id: string; agent_id: string | null; title: string; description: string | null; brand: string | null; venue: string | null; status: string | null; event_date: string | null; registration_open: boolean | null }

export async function POST(req: NextRequest) {
  const ticket = readCoverTicket(req.nextUrl.searchParams.get("t"))
  if (!ticket) return fail("This Add photo button has expired. Ask Claude to show the event again, then press it.", 401)
  if (!allowRequest(`event-cover:${ticket.eventId}`, 12, 10 * 60_000) || !allowRequest(`event-cover-ip:${clientIp(req.headers)}`, 30, 10 * 60_000)) {
    return fail("Too many photos in a short time. Wait a few minutes and try again.", 429)
  }

  const admin = createAdminSupabase()
  const { data: profile } = await admin.from("profiles").select("id, fullname, role, status, is_deleted").eq("id", ticket.actorId).maybeSingle<ProfileRow>()
  if (!profile || isInactiveProfile(profile)) return fail("This FHI account is not active.", 403)
  const allowed = ticket.scope === "all" ? canManageEvents(profile.role) : canManageOwnEvents(profile.role)
  if (!allowed) return fail("This account can no longer change events from Claude.", 403)

  let query = admin.from("events").select("id, agent_id, title, description, brand, venue, status, event_date, registration_open").eq("id", ticket.eventId).is("deleted_at", null)
  // The same two tiers as the tools: a company event for admin staff, their own for an owner.
  query = ticket.scope === "all" ? query.is("agent_id", null) : query.eq("agent_id", profile.id)
  const { data: event, error } = await query.maybeSingle<EventRow>()
  if (error) return fail("FHI could not read the event. Try again.", 500)
  if (!event) return fail("This event is no longer there.", 404)
  if ((event.status ?? "draft") !== "draft") return fail("This event is live. Change its photo in the dashboard, or ask Claude to unpublish it first.", 409)

  const length = Number(req.headers.get("content-length") ?? 0)
  if (length > COVER_MAX_BYTES) return fail("That photo is too large. Choose one under 4 MB.", 413)
  const raw = Buffer.from(await req.arrayBuffer())
  if (!raw.length) return fail("No photo arrived. Try again.", 400)
  if (raw.length > COVER_MAX_BYTES) return fail("That photo is too large. Choose one under 4 MB.", 413)

  const photo = await normalizeCoverPhoto(raw)
  if (!photo) return fail("That file is not a photo FHI can read. Choose a JPG, PNG or WebP picture.", 415)

  let url: string | null
  try {
    url = await storeEventImage(`FHI_GLOBAL/events/${Date.now()}-${Math.random().toString(36).slice(2)}.${photo.ext}`, photo.body, photo.contentType)
  } catch (e) {
    console.error("[events/cover] store", e instanceof Error ? e.message : e)
    return fail("FHI could not save the photo. Try again.", 500)
  }
  if (!url) return fail("File storage is not configured.", 500)

  // The dashboard's own payload shape with the new picture: the same save as every other change.
  const input = sanitizeEventInput({
    title: event.title,
    description: event.description ?? "",
    brand: event.brand ?? "fhiglobal",
    image_url: url,
    venue: event.venue ?? "",
    status: event.status ?? "draft",
    event_date: event.event_date ?? "",
    registration_open: event.registration_open !== false,
  })
  const saved = await updateEvent(admin, {
    id: event.id,
    input,
    scope: ticket.scope === "all" ? { kind: "all" } : { kind: "own", agentId: profile.id },
    meta: { actor: { id: profile.id, name: profile.fullname, role: profile.role }, source: "claude", request: requestContextFromRequest(req) },
  })
  if (!saved.ok) return fail(saved.status === 404 ? "This event is no longer there." : "FHI could not save the photo. Try again.", saved.status === 404 ? 404 : 500)

  return NextResponse.json({ ok: true, cover_photo: url }, { headers: HEADERS })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}
