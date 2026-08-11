import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { listPublishedSites } from "@/lib/website-builder-service"

// Public directory of the agents' personal websites (Website Builder sites) —
// linked from the header's About Us dropdown. Each card shows the site's HERO
// banner photo and links to /website/{slug}.

export const revalidate = 300

export const metadata: Metadata = {
  title: "Agent Websites",
  description: "Browse the personal websites of FHI Global's real estate agents in Dubai.",
}

export default async function AgentWebsitesPage() {
  let sites: Awaited<ReturnType<typeof listPublishedSites>> = []
  try {
    sites = await listPublishedSites(createAdminSupabase())
  } catch {
    // Directory degrades to the empty state rather than erroring the page.
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-10 text-center">
        <div className="mb-5 flex items-center justify-center gap-3" aria-hidden="true">
          <span className="h-px w-16 bg-[#d6b357]/70" />
          <span className="h-1.5 w-1.5 rotate-45 bg-[#d6b357]" />
          <span className="h-px w-16 bg-[#d6b357]/70" />
        </div>
        <h1 className="font-['Outfit'] text-3xl font-bold tracking-tight text-[#0d1117] sm:text-4xl">
          Agent Websites
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-[#6b7280]">
          The personal websites of our agents — explore their featured projects, listings and service areas.
        </p>
      </div>

      {sites.length === 0 ? (
        <div className="border border-[#e5e8ec] bg-white p-16 text-center">
          <p className="text-sm text-[#6b7280]">Agent websites are being published — check back shortly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <Link
              key={site.slug}
              href={`/website/${site.slug}`}
              className="group relative block aspect-[1200/630] overflow-hidden border border-[#e5e8ec] bg-[#0a1628]"
            >
              {site.banner ? (
                <Image
                  src={site.banner}
                  alt={site.name ? `${site.name}'s website` : "Agent website"}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  loading="lazy"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold uppercase tracking-[0.2em] text-white/60">
                  {site.name || "Agent Website"}
                </span>
              )}
              {/* Name plate over a bottom fade */}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-5 pb-4 pt-10">
                <span className="block truncate text-[13px] font-bold uppercase tracking-[0.14em] text-white">
                  {site.name || site.slug}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
