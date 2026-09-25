import { cache } from "react"
import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { loadSiteBySlug } from "@/lib/website-builder-service"
import { createPageMetadata, truncateDescription } from "@/lib/seo"
import { eventPublicPath, websiteEventsPath } from "@/lib/events/paths"
import { EventDetail, type PublicEvent } from "@/components/public/event-detail"
import { EventViewPing } from "@/components/public/event-view-ping"
import { JsonLd } from "@/components/json-ld"
import { breadcrumbList, eventSchema } from "@/lib/structured-data"
import { titleCaseName } from "@/lib/public-profile"
import { themeVars } from "../../../_data"
import { SiteHeader } from "../../../_components/header"
import { SiteFooter } from "../../../_components/footer"

// An agent's own event (migration 057) on their website: the site's header,
// footer and theme around the same event page body, registration form,
// certificate banner and scan-tracking as the company events. Only events the
// site's owner owns render here — a company event is never served under an
// agent's site. Always fresh, like the site itself.

export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const getSite = cache((slug: string) => loadSiteBySlug(createAdminSupabase(), slug))

/** A live, published event owned by this site's agent — by slug or legacy id. */
const getEvent = cache(async (agentId: string, key: string): Promise<PublicEvent | null> => {
  const query = createAdminSupabase()
    .from("events")
    .select("id, slug, title, description, brand, image_url, video_url, event_date, venue, registration_open, registration_fields, certificate")
    .eq("agent_id", agentId)
    .eq("status", "published")
    .is("deleted_at", null)
  const { data, error } = UUID_RE.test(key) ? await query.eq("id", key).maybeSingle() : await query.eq("slug", key).maybeSingle()
  if (error) throw new Error("Failed to load event")
  return (data as PublicEvent | null) ?? null
})

type Props = {
  params: Promise<{ slug: string; event: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, event: key } = await params
  const site = await getSite(slug)
  if (!site) notFound()
  const event = await getEvent(site.agentId, key)
  if (!event) notFound()
  const host = titleCaseName(site.data.agent.name?.replace(/\s+/g, " ").trim() ?? "")
  return createPageMetadata({
    title: event.title,
    description:
      truncateDescription(event.description) ||
      `Register for ${event.title}${event.venue ? ` at ${event.venue}` : ""}${host ? ` — hosted by ${host}` : ""}.`,
    imageUrl: event.image_url,
    pathname: eventPublicPath(event, site.slug),
    keywords: [event.title, host, "Dubai real estate event"].filter(Boolean) as string[],
  })
}

export default async function AgentEventPage({ params, searchParams }: Props) {
  const { slug, event: key } = await params
  const site = await getSite(slug)
  if (!site) notFound()
  // A previous site address (migration 058) → the current one, keeping the
  // query so a flyer scan (?src=qr) still counts as one.
  if (site.slug !== slug) {
    const query = new URLSearchParams(
      Object.entries(await searchParams).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v != null ? [[k, v]] : [])),
    ).toString()
    permanentRedirect(`/website/${site.slug}/events/${key}${query ? `?${query}` : ""}`)
  }
  const event = await getEvent(site.agentId, key)
  if (!event) notFound()

  const data = site.data
  const home = `/website/${site.slug}`
  const host = titleCaseName(data.agent.name?.replace(/\s+/g, " ").trim() ?? "") || "Agent"
  const path = eventPublicPath(event, site.slug)

  return (
    <div style={themeVars(data.theme)}>
      {/* Event entity hosted by the agent (rich-result eligible) + the trail. */}
      <JsonLd
        schema={[
          eventSchema({
            title: event.title,
            description: event.description,
            path,
            imageUrl: event.image_url,
            eventDate: event.event_date,
            venue: event.venue,
            organizer: { name: host, path: home },
            // Agents run events abroad too (e.g. roadshows in Manila) — claim no country.
            country: null,
          }),
          breadcrumbList([
            { name: host, path: home },
            { name: "Events", path: home },
            { name: event.title },
          ]),
        ]}
      />
      <SiteHeader data={data} showEvents basePath={home} />
      <main className="relative bg-[#fafafa] font-sans overflow-x-hidden">
        <EventViewPing eventId={event.id} />
        <EventDetail
          event={event}
          sharePath={path}
          back={{ href: websiteEventsPath(site.slug), label: `${host}'s events` }}
          breadcrumbs={[
            { href: home, label: host },
            { href: websiteEventsPath(site.slug), label: "Events" },
          ]}
          moreEventsHref={websiteEventsPath(site.slug)}
        />
      </main>
      <SiteFooter data={data} />
    </div>
  )
}
