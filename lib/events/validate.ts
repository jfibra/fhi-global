import { EVENT_BRANDS } from "@/lib/events/brands"

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
  // Manual registration toggle; anything but an explicit false means open.
  const registration_open = body.registration_open !== false
  return {
    title,
    description: description || null,
    brand,
    image_url: image_url || null,
    venue: venue || null,
    status,
    event_date,
    registration_open,
  }
}
