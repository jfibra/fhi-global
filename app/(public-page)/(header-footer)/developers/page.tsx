import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Suspense } from "react"
import { getCachedDevelopersDirectory } from "@/lib/data/developers"
import { createPageMetadata } from "@/lib/seo"
import { breadcrumbList } from "@/lib/structured-data"
import { JsonLd } from "@/components/json-ld"
import { DeveloperCard, type DeveloperCardData } from "@/components/developer-card"
import { DeveloperSearch } from "./developer-search"
import { Building2, ShieldCheck } from "lucide-react"

export const metadata: Metadata = createPageMetadata({
  title: "Real Estate Developers in Dubai",
  description: "Browse top real estate developers in Dubai. Discover verified developers and their premium property projects.",
  pathname: "/developers",
  keywords: ["Dubai developers", "real estate developers Dubai", "verified developers UAE"],
})

type SearchParams = Promise<{ q?: string }>

function SearchFallback() {
  return <div className="h-11 bg-white border border-[#e8eaed] animate-pulse" aria-hidden />
}

export default async function DevelopersPage({ searchParams }: { searchParams: SearchParams }) {
  const { q } = await searchParams

  // Directory data comes from a 120s server cache (no Supabase round-trips on
  // the hot path); the search filter runs in memory over the small list.
  const { developers: allDevelopers } = await getCachedDevelopersDirectory()
  const needle = q?.trim().toLowerCase()
  const developers = needle
    ? allDevelopers.filter((d) => (d.name ?? "").toLowerCase().includes(needle))
    : allDevelopers

  const verifiedCount = (developers ?? []).filter((d) => d.is_verified).length

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-20 lg:py-24 text-center">
      <div className="w-20 h-20 bg-[#001f3f]/5 border border-[#e8eaed] flex items-center justify-center mb-6">
        <Building2 className="w-9 h-9 text-[#001f3f]/25" />
      </div>
      <h3 className="font-['Outfit'] font-bold text-[#0d1117] text-xl mb-2">No developers found</h3>
      <p className="text-sm text-[#6b7280] max-w-xs leading-relaxed">
        Try adjusting your search or{" "}
        <Link href="/developers" className="text-[#001f3f] font-medium hover:underline">
          browse all developers
        </Link>
        .
      </p>
    </div>
  )

  return (
    <div className="relative min-h-screen bg-[#f6f7f9] font-sans overflow-x-hidden">
      <JsonLd schema={breadcrumbList([{ name: "Home", path: "/" }, { name: "Developers" }])} />

      {/* Masthead — deliberately short: identity + the two trust figures, so
          the logo directory starts above the fold. */}
      <section className="relative bg-[#001f3f] overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/background/dubai.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#001428]/90 via-[#001428]/60 to-[#001f3f]/30" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6b357]">
            FHI Global · Trusted Developers
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
            <div>
              <h1
                className="font-['Outfit'] text-3xl md:text-[38px] font-bold text-white leading-[1.1] tracking-tight"
                style={{ textShadow: "0 2px 20px rgba(0,10,30,0.55)" }}
              >
                Dubai&apos;s Top <span className="text-[#d6b357]">Real Estate Developers</span>
              </h1>
              <p className="mt-1.5 text-sm text-white/85" style={{ textShadow: "0 1px 8px rgba(0,10,30,0.6)" }}>
                Vetted, RERA-registered developers behind Dubai&apos;s most iconic projects.
              </p>
            </div>
            <dl className="flex gap-10 pb-1">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d6b357] mb-1">Developers</dt>
                <dd className="font-['Outfit'] text-2xl font-bold text-white leading-none">{developers?.length ?? 0}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d6b357] mb-1">Verified</dt>
                <dd className="flex items-center gap-1.5 font-['Outfit'] text-2xl font-bold text-[#d6b357] leading-none">
                  <ShieldCheck className="w-5 h-5" /> {verifiedCount}
                </dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="relative h-[3px] bg-[#d6b357]" />
      </section>

      {/* Toolbar — search and the live count in one slim row */}
      <div className="bg-white border-b border-[#e8eaed]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-4">
          <div className="flex-1 min-w-0">
            <Suspense fallback={<SearchFallback />}>
              <DeveloperSearch initialQ={q ?? ""} />
            </Suspense>
          </div>
          <span className="text-[13px] text-[#6b7280] shrink-0">
            <span className="font-bold text-[#0d1117]">{developers?.length ?? 0}</span>{" "}
            developer{(developers?.length ?? 0) !== 1 ? "s" : ""}
            {q ? (
              <>
                {" "}
                matching <span className="font-medium text-[#001f3f]">&ldquo;{q}&rdquo;</span>
              </>
            ) : null}
          </span>
        </div>
      </div>

      {/* The logo wall */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-14">
        {developers && developers.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {developers.map((dev) => (
              <DeveloperCard key={dev.id} developer={dev as DeveloperCardData} variant="tile" />
            ))}
          </div>
        ) : (
          emptyState
        )}
      </section>

    </div>
  )
}
