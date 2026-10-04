import { cache } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { createPageMetadata, truncateDescription } from "@/lib/seo"
import { fetchSectionPage } from "@/lib/sitemap-sections"
import { breadcrumbList, eventSchema } from "@/lib/structured-data"
import { eventDateRangeLabel } from "@/lib/events/dates"
import { JsonLd } from "@/components/json-ld"
import { EventViewPing } from "@/components/public/event-view-ping"
import { EventDetail } from "@/components/public/event-detail"
import { EventMovedRedirect } from "@/components/public/event-moved-redirect"
import { eventPublicPath } from "@/lib/events/paths"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { loadEventHost } from "@/lib/events/host"

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
    .select("id, slug, title, description, brand, image_url, video_url, event_date, event_days, day_times, venue, venue_lat, venue_lng, registration_open, registration_fields, certificate, agent_id, show_on_main, show_on_website")
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
 * An agent's event on their website ONLY (not placed on the main page, 074)
 * lives there — where this page forwards, with the host's name for the
 * interstitial. Null for a company event and for any agent's event on
 * fhiglobal.ae (it renders right here with a "Hosted by" box, and this URL is
 * the one Google indexes), or when the agent's site isn't published (the event
 * then keeps rendering here, so a link never dies).
 */
async function agentHome(event: { id: string; slug: string | null; agent_id: string | null; show_on_main?: boolean | null; show_on_website?: boolean | null }) {
  if (!event.agent_id || event.show_on_main === true || event.show_on_website === false) return null
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

/** The agent behind an agent's event shown here — shared by metadata and the page. */
const getHost = cache((agentId: string) => loadEventHost(createAdminSupabase(), agentId))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const event = await fetchEvent(id)
  // notFound() here, not a placeholder title: aborting in metadata is what
  // turns a dead event URL into a real HTTP 404.
  if (!event) notFound()
  const home = await agentHome(event)
  const dateLabel = eventDateRangeLabel(event.event_date, event.event_days, "plain")
  if (home) {
    return createPageMetadata({
      title: event.title,
      description: truncateDescription(event.description) || `Register for ${event.title}.`,
      imageUrl: event.image_url,
      pathname: home.path,
      robots: { index: false, follow: true },
    })
  }
  const host = event.agent_id ? await getHost(event.agent_id) : null
  return createPageMetadata({
    title: event.title,
    description:
      truncateDescription(event.description) ||
      `Register for ${event.title}${dateLabel ? ` on ${dateLabel}` : ""}${event.venue ? ` at ${event.venue}` : ""}${host ? ` — hosted by ${host.name}` : ""}.`,
    imageUrl: event.image_url,
    pathname: `/events/${event.slug ?? event.id}`,
    keywords: [event.title, ...(host ? [host.name] : []), "FHI Global event", "Dubai real estate event"],
  })
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params
  const event = await fetchEvent(id)
  if (!event) notFound()

  const home = await agentHome(event)
  if (home) return <EventMovedRedirect to={home.path} title={event.title} hostName={home.hostName} />

  // An agent's event placed on the main page (074) renders here with its host.
  const host = event.agent_id ? await getHost(event.agent_id) : null
  const path = `/events/${event.slug ?? event.id}`

  return (
    <div className="relative min-h-screen bg-[#fafafa] font-sans overflow-x-hidden">
      {/* Event entity (rich-result eligible) + the visible trail below. */}
      <JsonLd
        schema={[
          eventSchema({
            title: event.title,
            description: event.description,
            path,
            imageUrl: event.image_url,
            eventDate: event.event_date,
            eventDays: event.event_days,
            dayTimes: event.day_times,
            venue: event.venue,
            // An agent's event names them as organiser — and, like on their
            // website, claims no country (agents run roadshows abroad too).
            ...(event.agent_id
              ? { organizer: host ? { name: host.name, path: host.websiteHref ?? path } : null, country: null }
              : {}),
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
        host={host}
        mapsKey={process.env.GOOGLE_MAPS_API_KEY?.trim() || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || ""}
        sharePath={path}
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
