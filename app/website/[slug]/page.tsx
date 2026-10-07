import { cache } from "react"
import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { loadSiteBySlug } from "@/lib/website-builder-service"
import { SITE_URL, createPageMetadata } from "@/lib/seo"
import {
  agentDisplayName,
  agentSiteDescription,
  agentSiteTitle,
  isPlausibleBrn,
  isSinglePersonName,
} from "@/lib/agent-site"
import { JsonLd } from "@/components/json-ld"
import { agentProfileSchema } from "@/lib/structured-data"
import { themeVars } from "../_data"
import { SiteHeader } from "../_components/header"
import { SiteFooter } from "../_components/footer"
import { HeroSection } from "../_components/sections/hero"
import { AboutSection } from "../_components/sections/about"
import { FeaturedSection } from "../_components/sections/featured"
import { StatsBandSection } from "../_components/sections/stats"
import { ServiceAreasSection } from "../_components/sections/service-areas"
import { GallerySection } from "../_components/sections/gallery"
import { TestimonialsSection } from "../_components/sections/what-my-clients-say"
import { EventsSection } from "../_components/sections/events"
import { loadAgentWebsiteEvents } from "@/lib/events/website-events"
import { loadAgentWebsiteReviews } from "@/lib/website-reviews"
import { loadShareContact, withDialableNumbers } from "@/lib/website-project-share"

// A published agent site from the Website Builder. Cached for five minutes, and
// refreshed the moment the agent saves (PUT /api/website-builder/site), an event
// of theirs changes or one of their reviews is approved — those writes revalidate
// this path. It used to render on every request (~2 s), which an agent's own
// "show my change at once" expectation did not need: the save purges it.
//
// ISR rule: a failed query THROWS (loadSite and the strict loaders below), so a
// transient outage serves the previous page instead of caching a 404, an empty
// events section or a dial code defaulted to +971 over a +63 number.
//
// The static /website/sample route wins over this dynamic segment, so the design
// sample stays reachable.

export const revalidate = 300

// One fetch shared by generateMetadata and the page render.
const getSite = cache((slug: string) => loadSiteBySlug(createAdminSupabase(), slug))

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const site = await getSite(slug)
  if (!site) notFound()
  // An address the site had before (migration 058) → its current one, for good —
  // decided here too, so crawlers get the 308 from the metadata pass.
  if (site.slug !== slug) permanentRedirect(`/website/${site.slug}`)
  const { agent, hero, about } = site.data
  return createPageMetadata({
    title: agentSiteTitle(agent),
    description: agentSiteDescription(agent, hero, about),
    pathname: `/website/${site.slug}`,
    ogType: "profile",
    // Offered to search engines only once it is really the agent's (own name, own
    // bio, own portrait). Until then: not indexed, links still followed.
    robots: site.complete ? undefined : { index: false, follow: true },
    // The share card is this route's opengraph-image.tsx (the agent's hero and
    // contact panel): leave og:image / twitter:image to it.
    useFileImage: true,
  })
}

export default async function AgentWebsitePage({ params }: Props) {
  const { slug } = await params
  const site = await getSite(slug)
  if (!site) notFound()
  // An address the site had before (migration 058) → its current one, for good.
  if (site.slug !== slug) permanentRedirect(`/website/${site.slug}`)
  // The agent's own published events (migration 057) and approved client
  // reviews — each section and its nav link only appear once there is one.
  const admin = createAdminSupabase()
  const [events, reviews, contact] = await Promise.all([
    loadAgentWebsiteEvents(admin, site.agentId, 12, { strict: true }),
    loadAgentWebsiteReviews(admin, site.agentId, 12, { strict: true }),
    loadShareContact(admin, site.agentId, site.data.agent, site.data.about.portrait, { strict: true }),
  ])
  const hasEvents = events.upcoming.length + events.past.length > 0
  // Contact Me (header) and the About channels dial the agent's numbers WITH
  // their country code — the site stores them as typed, usually without it.
  const data = withDialableNumbers(site.data, contact)

  const path = `/website/${site.slug}`
  const name = agentDisplayName(site.data.agent.name)

  return (
    <div style={themeVars(data.theme)}>
      {/* The agent as a ProfilePage → Person working for the FHI Global node.
          Left out for a couple/team name ("Carlos & Michelle Guinto"): that is not one Person. */}
      <JsonLd
        schema={[
          ...(isSinglePersonName(site.data.agent.name)
            ? [
                agentProfileSchema({
                  path,
                  name,
                  jobTitle: site.data.agent.title,
                  description: agentSiteDescription(site.data.agent, site.data.hero, site.data.about),
                  image: site.data.about.portrait,
                  sameAs: Object.values(site.data.about.socials),
                  brn: isPlausibleBrn(site.data.agent.brn) ? site.data.agent.brn.trim() : null,
                  dateModified: site.updatedAt,
                }),
              ]
            : []),
          // No breadcrumb node: the site's page shows no breadcrumb trail, and schema mirrors visible content.
        ]}
      />
      <SiteHeader data={data} showEvents={hasEvents} showReviews={reviews.length > 0} />
      <HeroSection data={data} />
      <AboutSection data={data} qrValue={`${SITE_URL}/website/${site.slug}`} />
      <FeaturedSection data={data} share={{ siteSlug: site.slug, contact }} />
      <EventsSection siteSlug={site.slug} upcoming={events.upcoming} past={events.past} />
      <StatsBandSection data={data} />
      <ServiceAreasSection data={data} placeholders={false} />
      <GallerySection data={data} placeholders={false} />
      <TestimonialsSection testimonials={reviews} />
      <SiteFooter data={data} />
    </div>
  )
}
