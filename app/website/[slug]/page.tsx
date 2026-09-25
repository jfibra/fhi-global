import { cache } from "react"
import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { loadSiteBySlug } from "@/lib/website-builder-service"
import { SITE_URL } from "@/lib/seo"
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

// A published agent site from the Website Builder. Always fresh — agents
// expect a save in the editor to show up on their public link immediately.
// The static /website/sample route wins over this dynamic segment, so the
// design sample stays reachable.

export const dynamic = "force-dynamic"

// One fetch shared by generateMetadata and the page render.
const getSite = cache((slug: string) => loadSiteBySlug(createAdminSupabase(), slug))

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const site = await getSite(slug)
  if (!site) notFound()
  const { agent, hero } = site.data
  const title = [agent.name, agent.title].filter(Boolean).join(" — ") || site.title
  const description = hero.description || site.title
  // Explicit OpenGraph/Twitter text so share cards show the AGENT, not the
  // root site's defaults (the og image itself comes from opengraph-image.tsx).
  return {
    title: agent.name || site.title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/website/${site.slug}`,
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  }
}

export default async function AgentWebsitePage({ params }: Props) {
  const { slug } = await params
  const site = await getSite(slug)
  if (!site) notFound()
  // An address the site had before (migration 058) → its current one, for good.
  if (site.slug !== slug) permanentRedirect(`/website/${site.slug}`)
  const data = site.data
  // The agent's own published events (migration 057) and approved client
  // reviews — each section and its nav link only appear once there is one.
  const [events, reviews] = await Promise.all([
    loadAgentWebsiteEvents(createAdminSupabase(), site.agentId),
    loadAgentWebsiteReviews(createAdminSupabase(), site.agentId),
  ])
  const hasEvents = events.upcoming.length + events.past.length > 0

  return (
    <div style={themeVars(data.theme)}>
      <SiteHeader data={data} showEvents={hasEvents} showReviews={reviews.length > 0} />
      <HeroSection data={data} />
      <AboutSection data={data} qrValue={`${SITE_URL}/website/${site.slug}`} />
      <FeaturedSection data={data} />
      <EventsSection siteSlug={site.slug} upcoming={events.upcoming} past={events.past} />
      <StatsBandSection data={data} />
      <ServiceAreasSection data={data} />
      <GallerySection data={data} />
      <TestimonialsSection testimonials={reviews} />
      <SiteFooter data={data} />
    </div>
  )
}
