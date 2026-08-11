import { cache } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
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
  const data = site.data

  return (
    <div style={themeVars(data.theme)}>
      <SiteHeader data={data} />
      <HeroSection data={data} />
      <AboutSection data={data} qrValue={`${SITE_URL}/website/${site.slug}`} />
      <FeaturedSection data={data} />
      <StatsBandSection data={data} />
      <ServiceAreasSection data={data} />
      <GallerySection data={data} />
      <TestimonialsSection />
      <SiteFooter data={data} />
    </div>
  )
}
