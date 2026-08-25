// Featured Projects and Featured Listings grids — both share one background
// photo (the same image as the site homepage's hero) under a soft white wash.
// A block with no featured items renders nothing (no orphan heading/button);
// with both empty the whole section disappears.

import { ArrowRight } from "lucide-react"
import { GOLD, IMG, NAVY, SAMPLE_DATA, type WebsiteData } from "../../_data"
import { ProjectCard, PropertyCard } from "../cards"

export function FeaturedSection({ data = SAMPLE_DATA }: { data?: WebsiteData }) {
  const hasProjects = data.projects.length > 0
  const hasProperties = data.properties.length > 0
  if (!hasProjects && !hasProperties) return null

  return (
    <section id="featured" className="relative scroll-mt-[72px] overflow-hidden">
      {/* Background photo + white wash */}
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={IMG.houseC} alt="" aria-hidden className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/95 via-white/80 to-white/75" />
      </div>

      {hasProjects && (
        <div id="projects" className="relative mx-auto max-w-[1400px] scroll-mt-[72px] px-5 py-16 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-serif text-3xl font-bold tracking-tight" style={{ color: NAVY }}>
              Featured Projects
            </h2>
            <span className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-bold" style={{ color: NAVY }}>
              View All Projects <ArrowRight className="h-4 w-4" style={{ color: GOLD }} />
            </span>
          </div>
          <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.projects.map((p, i) => (
              <ProjectCard key={`${p.title}-${i}`} project={p} />
            ))}
          </div>
        </div>
      )}

      {hasProperties && (
        <div id="properties" className={`relative mx-auto max-w-[1400px] scroll-mt-[72px] px-5 pb-16 sm:px-8 ${hasProjects ? "" : "pt-16"}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-serif text-3xl font-bold tracking-tight" style={{ color: NAVY }}>
              Featured Listings
            </h2>
            <span className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-bold" style={{ color: NAVY }}>
              View All Properties <ArrowRight className="h-4 w-4" style={{ color: GOLD }} />
            </span>
          </div>
          <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.properties.map((p, i) => (
              <PropertyCard key={`${p.title}-${i}`} property={p} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
