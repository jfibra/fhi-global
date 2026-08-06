import type { Metadata } from "next"
import { SiteFooter } from "../_components/footer"
import { HeroSection } from "../_components/sections/hero"
import { AboutSection } from "../_components/sections/about"
import { FeaturedSection } from "../_components/sections/featured"
import { StatsBandSection } from "../_components/sections/stats"
import { ServiceAreasSection } from "../_components/sections/service-areas"
import { GallerySection } from "../_components/sections/gallery"
import { TestimonialsSection } from "../_components/sections/what-my-clients-say"
import { ClosingCtaSection } from "../_components/sections/closing-cta"

// Design sample for the next-generation Website Builder template — a full
// standalone agent site filled with placeholder data (see ../_data.ts).
// Sections are modular under ../_components; the navbar + footer come from
// the /website layout. Not indexable; exists so the layout can be reviewed
// at /website/sample before it's wired to real builder data.

export const metadata: Metadata = {
  title: "Website Builder — Sample Template",
  robots: { index: false, follow: false },
}

export default function WebsiteSamplePage() {
  return (
    <>
      <HeroSection />
      <AboutSection />
      <FeaturedSection />
      <StatsBandSection />
      <ServiceAreasSection />
      <GallerySection />
      <TestimonialsSection />
      <ClosingCtaSection />
      <SiteFooter />
    </>
  )
}
