import { EVENT_BRANDS } from "@/lib/events/brands"
import { parseRegistrationFields } from "@/lib/events/fields"
import { parseCertificateSettings } from "@/lib/events/certificate"
import { isPlayableVideoUrl } from "@/lib/video-embed"
import { normalizeDayTimes, normalizeEventDays } from "@/lib/events/dates"

const STATUSES = ["draft", "published", "archived"] as const

/** Normalizes and bounds admin-supplied event fields (server-side use). */
export function sanitizeEventInput(body: Record<string, unknown>) {
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : ""
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 5000) : ""
  const brand = typeof body.brand === "string" && EVENT_BRANDS.some((b) => b.key === body.brand)
    ? body.brand
    : "fhiglobal"
  const image_url = typeof body.image_url === "string" ? body.image_url.trim().slice(0, 1000) : ""
  const venue = typeof body.venue === "string" ? body.venue.trim().slice(0, 300) : ""
  const status = typeof body.status === "string" && (STATUSES as readonly string[]).includes(body.status)
    ? body.status
    : "draft"
  let event_date: string | null = null
  if (typeof body.event_date === "string" && body.event_date.trim()) {
    const d = new Date(body.event_date)
    if (!Number.isNaN(d.getTime())) event_date = d.toISOString()
  }
  // How many consecutive days the event runs (migration 071). Only when sent.
  const event_days = body.event_days !== undefined ? normalizeEventDays(body.event_days) : undefined
  // A start time per day (migration 072), day 1 mirroring event_date. Only when sent.
  const day_times = body.day_times !== undefined ? normalizeDayTimes(body.day_times, event_date, body.event_days ?? 1) : undefined
  // Manual registration toggle; anything but an explicit false means open.
  const registration_open = body.registration_open !== false
  // Per-event questions. Editable at any time — parseRegistrationFields drops
  // malformed entries rather than rejecting the whole save, so one bad row in
  // the builder can never block an event update.
  // jsonb designs are written only when the caller sends them. The PATCH
  // route spreads this whole object into UPDATE, so a partial payload (the
  // publish toggle, for instance) must not reset them to empty.
  const registration_fields = body.registration_fields !== undefined ? parseRegistrationFields(body.registration_fields) : undefined
  const certificate = body.certificate !== undefined ? parseCertificateSettings(body.certificate) : undefined
  // Optional video LINK (YouTube, Facebook, Drive, .mp4…) — videos are never
  // uploaded. Same only-when-sent rule; a link no page can play is dropped
  // rather than saved as a broken player.
  const rawVideo = typeof body.video_url === "string" ? body.video_url.trim().slice(0, 1000) : ""
  const video_url = body.video_url !== undefined ? (rawVideo && isPlayableVideoUrl(rawVideo) ? rawVideo : null) : undefined
  // Admin pick (migration 067): an agent's event also listed on /events. Only
  // when sent; the PATCH route drops it for owners.
  const show_on_main = body.show_on_main !== undefined ? body.show_on_main === true : undefined
  // The venue's exact spot (migration 068), from a picked place suggestion.
  // Only when sent; anything but a valid pair clears it.
  let venue_pin: { venue_lat: number | null; venue_lng: number | null; venue_place_id: string | null } | undefined
  if (body.venue_lat !== undefined || body.venue_lng !== undefined) {
    const lat = typeof body.venue_lat === "number" && Number.isFinite(body.venue_lat) && Math.abs(body.venue_lat) <= 90 ? body.venue_lat : null
    const lng = typeof body.venue_lng === "number" && Number.isFinite(body.venue_lng) && Math.abs(body.venue_lng) <= 180 ? body.venue_lng : null
    const ok = lat !== null && lng !== null
    const placeId = typeof body.venue_place_id === "string" ? body.venue_place_id.trim().slice(0, 300) : ""
    venue_pin = { venue_lat: ok ? lat : null, venue_lng: ok ? lng : null, venue_place_id: ok && placeId ? placeId : null }
  }
  return {
    title,
    description: description || null,
    brand,
    image_url: image_url || null,
    venue: venue || null,
    status,
    event_date,
    ...(event_days !== undefined ? { event_days } : {}),
    ...(day_times !== undefined ? { day_times } : {}),
    registration_open,
    ...(registration_fields !== undefined ? { registration_fields } : {}),
    ...(certificate !== undefined ? { certificate } : {}),
    ...(video_url !== undefined ? { video_url } : {}),
    ...(show_on_main !== undefined ? { show_on_main } : {}),
    ...(venue_pin ?? {}),
  }
}
