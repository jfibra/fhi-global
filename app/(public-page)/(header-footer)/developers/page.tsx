import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Suspense } from "react"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { createPageMetadata } from "@/lib/seo"
import { TopBar } from "@/components/topbar"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { DeveloperCard, type DeveloperCardData } from "@/components/developer-card"
import { DeveloperSearch } from "./developer-search"
import { BuyFiltersLoader } from "@/app/(public-page)/(header-footer)/buy/buy-filters-loader"
import { DevelopersGoogleMap } from "@/components/developers/developers-google-map"
import { DevelopersListToolbar } from "@/components/developers/developers-list-toolbar"
import { buildDeveloperMapMarkers } from "@/lib/developers/map-markers"
import { Building2, BadgeCheck, ChevronRight, Users, ShieldCheck } from "lucide-react"

export const metadata: Metadata = createPageMetadata({
  title: "Real Estate Developers in Dubai | FHI Global",
  description: "Browse top real estate developers in Dubai. Discover verified developers and their premium property projects.",
  pathname: "/developers",
  keywords: ["Dubai developers", "real estate developers Dubai", "verified developers UAE"],
})

type SearchParams = Promise<{ q?: string; view?: string }>

function listViewHrefFromQ(q: string | undefined): string {
  const p = new URLSearchParams()
  if (q) p.set("q", q)
  const qs = p.toString()
  return qs ? `/developers?${qs}` : "/developers"
}

function FiltersFallback() {
  return <div className="bg-white border-b border-[#e5e7eb] h-[88px] animate-pulse" aria-hidden />
}

function SearchFallback() {
  return <div className="h-14 rounded-2xl bg-white border border-[#e8eaed] animate-pulse" aria-hidden />
}

function ToolbarFallback() {
  return <div className="h-10 w-36 rounded-full bg-[#f1f5f9] animate-pulse shrink-0" aria-hidden />
}

export default async function DevelopersPage({ searchParams }: { searchParams: SearchParams }) {
  const { q, view } = await searchParams
  const isMap = view === "map"
  const supabase = createPublicSupabaseClient()

  let devQuery = supabase
    .from("developers")
    .select("id, name, slug, description, logo_url, rating, is_verified")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name")

  if (q) {
    devQuery = devQuery.ilike("name", `%${q}%`)
  }

  const coordsQuery = supabase
    .from("projects")
    .select("developer_id, latitude, longitude")
    .eq("is_active", true)
    .eq("is_published", true)
    .is("deleted_at", null)

  const [{ data: developers }, { data: projectCoords }] = await Promise.all([devQuery, coordsQuery])

  const verifiedCount = (developers ?? []).filter((d) => d.is_verified).length

  const mapMarkers = buildDeveloperMapMarkers(
    (developers ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      logo_url: d.logo_url,
    })),
    projectCoords ?? [],
  )

  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY?.trim() || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || ""

  const listViewHref = listViewHrefFromQ(q)

  const verifiedHint =
    !q && verifiedCount > 0 ? (
      <div className="flex items-center gap-2 mb-6 lg:mb-8 text-xs text-[#6b7280]">
        <BadgeCheck className="w-3.5 h-3.5 text-[#d6b357] shrink-0" />
        <span>
          {verifiedCount} verified developer{verifiedCount !== 1 ? "s" : ""} on this platform
        </span>
      </div>
    ) : null

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-20 lg:py-24 text-center">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#001f3f]/6 to-[#d6b357]/6 border border-[#e8eaed] flex items-center justify-center mb-6 shadow-sm">
        <Building2 className="w-9 h-9 text-[#001f3f]/25" />
      </div>
      <h3 className="font-['Outfit'] font-bold text-[#0d1117] text-xl mb-2">No developers found</h3>
      <p className="text-sm text-[#6b7280] max-w-xs leading-relaxed">
        Try adjusting your search or{" "}
        <a href="/developers" className="text-[#001f3f] font-medium hover:underline">
          browse all developers
        </a>
        .
      </p>
    </div>
  )

  const cardsBlock =
    developers && developers.length > 0 ? (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {developers.map((dev) => (
          <DeveloperCard key={dev.id} developer={dev as DeveloperCardData} />
        ))}
      </div>
    ) : (
      emptyState
    )

  if (isMap) {
    const total = developers?.length ?? 0
    const mapCards =
      developers && developers.length > 0 ? (
        <div className="flex flex-col gap-4 pb-4">
          {developers.map((dev) => (
            <DeveloperCard key={dev.id} developer={dev as DeveloperCardData} variant="directory" />
          ))}
        </div>
      ) : (
        emptyState
      )

    return (
      <div className="relative min-h-screen bg-[#f6f7f9] font-sans">
        <TopBar />
        <Header />

        <Suspense fallback={<FiltersFallback />}>
          <BuyFiltersLoader />
        </Suspense>

        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 pb-16">
          <div className="grid grid-cols-1 gap-6 lg:gap-8 lg:grid-cols-[minmax(0,50%)_minmax(0,1fr)] lg:items-start">
            <div className="scrollbar-none min-w-0 max-w-full lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto">
              <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-[#6b7280]">
                <span className="font-medium text-[#0f2940]">For Sale:</span>
                <Link href="/" className="text-[#0f2940] transition-colors hover:text-[#d6b357]">
                  Home
                </Link>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#9ca3af]" />
                <span className="font-semibold text-[#d6b357]">Developers</span>
              </nav>

              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h1 className="font-['Outfit'] text-2xl font-bold leading-tight tracking-tight text-[#0f2940] sm:text-3xl">
                    Dubai&apos;s Top Real Estate Developers
                  </h1>
                  <p className="mt-1 text-base font-semibold text-[#0f2940] sm:text-lg">
                    {total} Developer{total !== 1 ? "s" : ""}
                    {q ? (
                      <>
                        {" "}
                        <span className="font-normal text-[#6b7280]">
                          matching <span className="font-medium text-[#001f3f]">&ldquo;{q}&rdquo;</span>
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
                <Suspense fallback={<ToolbarFallback />}>
                  <DevelopersListToolbar className="mb-0 shrink-0" />
                </Suspense>
              </div>

              {mapCards}
            </div>

            <div className="mt-0 min-h-[min(55vh,520px)] w-full min-w-0 max-w-full flex-1 overflow-hidden lg:sticky lg:top-24 lg:mt-0 lg:min-h-0 lg:self-start">
              <DevelopersGoogleMap apiKey={apiKey} markers={mapMarkers} listViewHref={listViewHref} fillHeight />
            </div>
          </div>
        </div>

        <Footer />
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-[#f6f7f9] font-sans overflow-x-hidden">
      {/* Ambient blobs */}
      <div className="fixed top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-25 blur-[130px] -z-10 bg-[radial-gradient(circle,rgb(200,235,255)_0%,rgba(255,255,255,0)_70%)]" />
      <div className="fixed bottom-0 right-[-5%] w-[500px] h-[500px] rounded-full opacity-20 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(250,240,210)_0%,rgba(255,255,255,0)_70%)]" />

      <TopBar />
      <Header />

      {/* ─── Page Hero ─── */}
      <section className="relative pt-20 pb-36 overflow-hidden">
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
          {/* Light navy wash — photo stays visible like the approved mockup */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#001428]/60 via-[#001f3f]/35 to-[#001f3f]/15" />
          {/* Fade into the page background so the search card overlaps cleanly */}
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#f6f7f9] via-[#f6f7f9]/30 to-transparent" />
        </div>
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#d6b357]/70 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 border border-white/25 rounded-full text-xs font-medium text-white/90 mb-5 backdrop-blur-sm">
                <Building2 className="w-3.5 h-3.5 text-[#d6b357]" />
                Trusted Developers
              </div>
              <h1
                className="font-['Outfit'] text-4xl md:text-6xl font-bold text-white leading-[1.1] mb-4 tracking-tight"
                style={{ textShadow: "0 2px 24px rgba(0,10,30,0.6)" }}
              >
                Dubai&apos;s Top<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d6b357] to-[#f0d890]">
                  Real Estate Developers
                </span>
              </h1>
              {/* Gold underline bar (mockup) */}
              <span className="block w-14 h-1 rounded-full bg-[#d6b357] mb-5" aria-hidden="true" />
              <p
                className="text-white/90 text-lg max-w-lg leading-relaxed"
                style={{ textShadow: "0 1px 10px rgba(0,10,30,0.7)" }}
              >
                Explore verified developers behind Dubai&apos;s most iconic residential and commercial projects —{" "}
                <strong className="text-white">vetted,</strong> RERA-registered, and trusted.
              </p>
            </div>

            {/* Quick stats — solid navy tiles with gold icons (mockup) */}
            <div className="flex gap-4 shrink-0">
              <div className="bg-[#0a1f38]/90 backdrop-blur-sm border border-[#d6b357]/40 rounded-2xl px-6 py-5 text-center min-w-[130px] shadow-[0_16px_40px_-12px_rgba(0,10,25,0.6)]">
                <Building2 className="w-5 h-5 text-[#d6b357] mx-auto mb-2" />
                <p className="font-['Outfit'] text-3xl font-bold text-white leading-none">{developers?.length ?? 0}</p>
                <p className="text-[10px] font-bold text-white/65 mt-2 uppercase tracking-wider leading-tight">
                  Total<br />Developers
                </p>
              </div>
              <div className="bg-[#0a1f38]/90 backdrop-blur-sm border border-[#d6b357]/40 rounded-2xl px-6 py-5 text-center min-w-[130px] shadow-[0_16px_40px_-12px_rgba(0,10,25,0.6)]">
                <ShieldCheck className="w-5 h-5 text-[#d6b357] mx-auto mb-2" />
                <p className="font-['Outfit'] text-3xl font-bold text-[#d6b357] leading-none">{verifiedCount}</p>
                <p className="text-[10px] font-bold text-white/65 mt-2 uppercase tracking-wider leading-tight">
                  Verified<br />Developers
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Content — search card overlaps the hero (mockup) ─── */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 pb-14">
        {/* Floating search card */}
        <div className="bg-white rounded-[24px] border border-[#e8eaed] shadow-[0_18px_50px_-15px_rgba(0,20,40,0.25)] p-4 sm:p-5 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1 min-w-0">
              <Suspense fallback={<SearchFallback />}>
                <DeveloperSearch initialQ={q ?? ""} />
              </Suspense>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 shrink-0">
              <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#f9fafb] border border-[#e8eaed] rounded-full self-start">
                <Users className="w-3.5 h-3.5 text-[#d6b357]" />
                <span className="text-sm font-semibold text-[#0d1117]">{developers?.length ?? 0}</span>
                <span className="text-sm text-[#6b7280]">
                  developer{(developers?.length ?? 0) !== 1 ? "s" : ""}
                  {q ? (
                    <>
                      {" "}
                      matching <span className="font-medium text-[#001f3f]">&ldquo;{q}&rdquo;</span>
                    </>
                  ) : (
                    ""
                  )}
                </span>
              </div>
              <Suspense fallback={<ToolbarFallback />}>
                <DevelopersListToolbar className="mb-0 self-start sm:self-auto" />
              </Suspense>
            </div>
          </div>
        </div>

        {/* Verified filter hint */}
        {verifiedHint}

        {cardsBlock}
      </section>

      <Footer />
    </div>
  )
}
