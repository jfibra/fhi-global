import type { Metadata } from "next"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { fetchListingCards, fetchProjectCards } from "@/lib/website-builder-service"
import { SAMPLE_DATA, themeVars, type WebsiteData } from "../_data"
import { SiteHeader } from "../_components/header"
import { SiteFooter } from "../_components/footer"
import { HeroSection } from "../_components/sections/hero"
import { AboutSection } from "../_components/sections/about"
import { FeaturedSection } from "../_components/sections/featured"
import { StatsBandSection } from "../_components/sections/stats"
import { ServiceAreasSection } from "../_components/sections/service-areas"
import { GallerySection } from "../_components/sections/gallery"
import { TestimonialsSection } from "../_components/sections/what-my-clients-say"

// Design sample for the Website Builder template — a full standalone agent
// site with placeholder agent copy (see ../_data.ts) but REAL featured cards:
// the newest published projects and listings from the database, so the
// sample shows exactly what agents' sites render. Falls back to the
// placeholder cards only when the database has nothing to show (or is
// unreachable). Sections are modular under ../_components; the navbar +
// footer come from the /website layout. Not indexable.

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Website Builder — Sample Template",
  robots: { index: false, follow: false },
}

/** One row of four cards per block — the same grid the live sites use. */
const SAMPLE_CARDS = 4

async function loadSampleData(): Promise<WebsiteData> {
  const data = structuredClone(SAMPLE_DATA)
  try {
    const admin = createAdminSupabase()
    const [projects, properties] = await Promise.all([
      fetchProjectCards(admin),
      fetchListingCards(admin),
    ])
    if (projects.length) data.projects = projects.slice(0, SAMPLE_CARDS)
    if (properties.length) data.properties = properties.slice(0, SAMPLE_CARDS)
  } catch {
    // Keep the placeholder cards — the sample must never 500 over card data.
  }
  return data
}

export default async function WebsiteSamplePage() {
  const data = await loadSampleData()
  return (
    <div style={themeVars()}>
      <SiteHeader />
      <HeroSection />
      <AboutSection />
      <FeaturedSection data={data} />
      <StatsBandSection />
      <ServiceAreasSection />
      <GallerySection />
      <TestimonialsSection />
      <SiteFooter />
    </div>
  )
}
