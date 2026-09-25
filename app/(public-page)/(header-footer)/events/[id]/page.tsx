import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { createPageMetadata, truncateDescription } from "@/lib/seo"
import { fetchSectionPage } from "@/lib/sitemap-sections"
import { breadcrumbList, eventSchema } from "@/lib/structured-data"
import { JsonLd } from "@/components/json-ld"
import { EventViewPing } from "@/components/public/event-view-ping"
import { EventDetail } from "@/components/public/event-detail"
import { EventMovedRedirect } from "@/components/public/event-moved-redirect"
import { eventPublicPath } from "@/lib/events/paths"

export const revalidate = 120

/**
 * Prerender published events (production only) so they serve from the ISR
 * cache; params reuse the sitemap's enumeration. New events render on
 * demand and are cached on first hit.
 */
export async function generateStaticParams(): Promise<{ id: string }[]> {
  if (process.env.VERCEL_ENV !== "production") return []
  try {
    const rows = await fetchSectionPage("events", 1)
    return (rows ?? []).flatMap((r) => {
      const param = r.slug ?? (r.id != null ? String(r.id) : null)
      return param ? [{ id: param }] : []
    })
  } catch {
    return []
  }
}

type Props = { params: Promise<{ id: string }> }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// The segment accepts the human slug (/events/fhi-global-summit-2026) or the
// legacy uuid (/events/3df3ff47-…) — old shared links and printed QR codes
// keep working. The canonical URL in metadata always points at the slug.
async function fetchEvent(idOrSlug: string) {
  const supabase = createPublicSupabaseClient()
  const query = supabase
    .from("events")
    .select("id, slug, title, description, brand, image_url, video_url, event_date, venue, registration_open, registration_fields, certificate, agent_id")
    .eq("status", "published")
    .is("deleted_at", null)
  const { data, error } = UUID_RE.test(idOrSlug)
    ? await query.eq("id", idOrSlug).maybeSingle()
    : await query.eq("slug", idOrSlug).maybeSingle()
  // Transient failure → 5xx from both callers; only a clean miss may reach
  // their notFound() (an outage-time 404 would be ISR-cached over a live page).
  if (error) throw new Error("Failed to load event")
  return data ?? null
}

/**
 * An agent's own event (migration 057) lives on their website — where this
 * page forwards, with the host's name for the interstitial. Null for a company
 * event, or when the agent's site isn't published (the event then keeps
 * rendering here, so a link never dies).
 */
async function agentHome(event: { id: string; slug: string | null; agent_id: string | null }) {
  if (!event.agent_id) return null
  const { data } = await createPublicSupabaseClient()
    .from("website_builder")
    .select("slug, contact")
    .eq("agent_id", event.agent_id)
    .eq("is_published", true)
    .maybeSingle()
  if (!data?.slug) return null
  const contact = (data.contact ?? {}) as { name?: unknown }
  return {
    path: eventPublicPath(event, data.slug as string),
    hostName: typeof contact.name === "string" && contact.name.trim() ? contact.name.trim() : null,
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const event = await fetchEvent(id)
  // notFound() here, not a placeholder title: aborting in metadata is what
  // turns a dead event URL into a real HTTP 404.
  if (!event) notFound()
  const home = await agentHome(event)
  const d = event.event_date ? new Date(event.event_date) : null
  const dateLabel =
    d && !Number.isNaN(d.getTime())
      ? d.toLocaleDateString("en-AE", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Dubai" })
      : null
  if (home) {
    return createPageMetadata({
      title: event.title,
      description: truncateDescription(event.description) || `Register for ${event.title}.`,
      imageUrl: event.image_url,
      pathname: home.path,
      robots: { index: false, follow: true },
    })
  }
  return createPageMetadata({
    title: event.title,
    description:
      truncateDescription(event.description) ||
      `Register for ${event.title}${dateLabel ? ` on ${dateLabel}` : ""}${event.venue ? ` at ${event.venue}` : ""}.`,
    imageUrl: event.image_url,
    pathname: `/events/${event.slug ?? event.id}`,
    keywords: [event.title, "FHI Global event", "Dubai real estate event"],
  })
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params
  const event = await fetchEvent(id)
  if (!event) notFound()

  const home = await agentHome(event)
  if (home) return <EventMovedRedirect to={home.path} title={event.title} hostName={home.hostName} />

  return (
    <div className="relative min-h-screen bg-[#fafafa] font-sans overflow-x-hidden">
      {/* Event entity (rich-result eligible) + the visible trail below. */}
      <JsonLd
        schema={[
          eventSchema({
            title: event.title,
            description: event.description,
            path: `/events/${event.slug ?? event.id}`,
            imageUrl: event.image_url,
            eventDate: event.event_date,
            venue: event.venue,
          }),
          breadcrumbList([
            { name: "Home", path: "/" },
            { name: "Events", path: "/events" },
            { name: event.title },
          ]),
        ]}
      />
      <EventViewPing eventId={event.id} />
      <EventDetail
        event={event}
        sharePath={`/events/${event.slug ?? event.id}`}
        back={{ href: "/events", label: "All Events" }}
        breadcrumbs={[
          { href: "/", label: "Home" },
          { href: "/events", label: "Events" },
        ]}
        moreEventsHref="/events"
      />
    </div>
  )
}
