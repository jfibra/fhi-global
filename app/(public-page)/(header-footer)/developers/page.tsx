import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Suspense } from "react"
import { getCachedDevelopersDirectory } from "@/lib/data/developers"
import { createPageMetadata } from "@/lib/seo"
import { breadcrumbList } from "@/lib/structured-data"
import { JsonLd } from "@/components/json-ld"
import { DeveloperDirectory, type DirectoryDeveloper } from "@/components/public/developer-directory"
import { InView } from "@/components/public/in-view"
import { CountUp } from "@/components/public/count-up"
import { EMIRATES, countByEmirate, emirateCodeForCity } from "@/lib/emirates"
import { DeveloperSearch } from "./developer-search"
import { Building2, ShieldCheck } from "lucide-react"

export const metadata: Metadata = createPageMetadata({
  title: "Real Estate Developers in Dubai",
  description: "Browse top real estate developers in Dubai. Discover verified developers and their premium property projects.",
  pathname: "/developers",
  keywords: ["Dubai developers", "real estate developers Dubai", "verified developers UAE"],
})

type SearchParams = Promise<{ q?: string; sort?: string }>

function SearchFallback() {
  return <div className="h-11 bg-white border border-[#e8eaed] animate-pulse" aria-hidden />
}

export default async function DevelopersPage({ searchParams }: { searchParams: SearchParams }) {
  const { q, sort } = await searchParams
  const alphabetical = sort === "az"

  // Directory data comes from a 120s server cache (no Supabase round-trips on
  // the hot path); counts, emirates, search and sort all run in memory over
  // the small list.
  const { developers: allDevelopers, projectCoords } = await getCachedDevelopersDirectory()
  const rows = (projectCoords ?? []) as { developer_id: string | null; city: string | null }[]

  // Live projects and emirates per developer, from the same published rows.
  const perDev = new Map<string, { count: number; emirates: Map<string, number> }>()
  for (const r of rows) {
    if (!r.developer_id) continue
    const entry = perDev.get(r.developer_id) ?? { count: 0, emirates: new Map() }
    entry.count += 1
    const code = emirateCodeForCity(r.city)
    if (code) entry.emirates.set(code, (entry.emirates.get(code) ?? 0) + 1)
    perDev.set(r.developer_id, entry)
  }
  const emirateName = new Map(EMIRATES.map((e) => [e.code, e.name]))
  const directory: DirectoryDeveloper[] = (allDevelopers ?? []).map((d) => {
    const entry = perDev.get(d.id)
    return {
      id: d.id,
      name: d.name,
      slug: d.slug,
      logo_url: d.logo_url ?? null,
      logo_bg: d.logo_bg ?? null,
      is_verified: d.is_verified ?? null,
      projectCount: entry?.count ?? 0,
      emirates: entry
        ? [...entry.emirates.entries()].sort((a, b) => b[1] - a[1]).map(([code]) => emirateName.get(code) ?? code)
        : [],
    }
  })

  const needle = q?.trim().toLowerCase()
  const developers = (needle ? directory.filter((d) => (d.name ?? "").toLowerCase().includes(needle)) : directory)
    .slice()
    .sort((a, b) => (alphabetical ? 0 : b.projectCount - a.projectCount) || a.name.localeCompare(b.name))

  // Masthead counters describe the whole directory, not the current search.
  const stats = [
    { value: directory.length, label: "Developers" },
    { value: directory.filter((d) => d.is_verified).length, label: "Verified" },
    { value: rows.length, label: "Live projects" },
    { value: Object.keys(countByEmirate(rows)).length, label: "Emirates" },
  ].filter((st) => st.value > 0)

  const sortHref = (az: boolean) => {
    const p = new URLSearchParams()
    if (q) p.set("q", q)
    if (az) p.set("sort", "az")
    const qs = p.toString()
    return qs ? `/developers?${qs}` : "/developers"
  }

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-20 lg:py-24 text-center">
      <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#d6b357]/50 bg-[#d6b357]/10">
        <Building2 className="h-6 w-6 text-[#b8913f]" />
      </span>
      <h3 className="font-['Outfit'] font-bold text-[#0d1117] text-xl mb-2">No developers match &ldquo;{q}&rdquo;</h3>
      <p className="text-sm text-[#6b7280] max-w-xs leading-relaxed">
        Try another spelling or{" "}
        <Link href="/developers" className="text-[#001f3f] font-bold hover:underline">
          browse all developers
        </Link>
        .
      </p>
    </div>
  )

  return (
    <div className="dvx wf relative min-h-screen bg-[#f6f7f9] font-sans overflow-x-clip">
      <noscript>
        <style>{`.dvx [class*="wf-"], .dvx .wf-word > span, .dvx .dv-tile, .dvx .dv-tile-in { opacity: 1 !important; transform: none !important; filter: none !important; }`}</style>
      </noscript>
      <JsonLd schema={breadcrumbList([{ name: "Home", path: "/" }, { name: "Developers" }])} />

      {/* Masthead — short, so the logo wall starts above the fold, with the
          site's entrance and the directory's real counts counting up. */}
      <section className="relative overflow-hidden bg-[#06182e] text-white">
        <div className="absolute inset-0" aria-hidden="true">
          <Image src="/background/dubai.webp" alt="" fill priority sizes="100vw" className="object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#06182e]/95 via-[#06182e]/70 to-[#06182e]/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#06182e]/80 via-transparent to-transparent" />
        </div>
        <InView className="relative mx-auto max-w-7xl px-4 pb-8 pt-9 sm:px-6 lg:px-8 lg:pb-10 lg:pt-12" threshold={0.2} rootMargin="0px">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.3em] text-[#f0d89b]">
                <span className="wf-rule h-px w-10 bg-[#d6b357]" aria-hidden="true" />
                <span className="wf-fade" style={{ ["--d" as string]: "200ms" }}>FHI Global · Trusted developers</span>
              </p>
              <h1 className="mt-3 font-['Outfit'] text-[34px] font-bold leading-[1.06] tracking-tight drop-shadow-[0_2px_16px_rgba(0,10,30,0.5)] sm:text-[44px] lg:text-[52px]">
                <span className="wf-word mr-[0.24em]"><span style={{ ["--i" as string]: 0 }}>Dubai&apos;s</span></span>
                <span className="wf-word mr-[0.24em]"><span style={{ ["--i" as string]: 1 }}>Top</span></span>
                {["Real", "Estate", "Developers"].map((w, i) => (
                  <span key={w} className="wf-word mr-[0.24em]"><span style={{ ["--i" as string]: 2 + i }} className="wf-gold">{w}</span></span>
                ))}
              </h1>
              <p className="wf-fade mt-3 max-w-xl text-[15px] text-white/80" style={{ ["--d" as string]: "600ms" }}>
                Vetted, RERA-registered developers behind Dubai&apos;s most iconic projects.
              </p>
            </div>
            <dl className="wf-fade flex flex-wrap gap-x-7 gap-y-3 lg:shrink-0 lg:flex-nowrap lg:pb-1" style={{ ["--d" as string]: "700ms" }}>
              {stats.map((st, i) => (
                <div key={st.label}>
                  <dd className={`flex items-center gap-1.5 font-['Outfit'] text-[30px] font-bold leading-none ${st.label === "Verified" ? "text-[#d6b357]" : "text-white"}`}>
                    {st.label === "Verified" && <ShieldCheck className="h-5 w-5" />}
                    <CountUp value={st.value} delay={800 + i * 120} duration={1200} />
                  </dd>
                  <dt className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#d6b357]">{st.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </InView>
        <div className="relative h-[3px] bg-[#d6b357]" />
      </section>

      {/* Toolbar — search, order and the live count; sticks under the slim header */}
      <div className="lg:sticky lg:top-[72px] z-[40] border-b border-[#e8eaed] bg-white/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-4">
          <div className="flex-1 min-w-0">
            <Suspense fallback={<SearchFallback />}>
              <DeveloperSearch initialQ={q ?? ""} />
            </Suspense>
          </div>
          <div role="group" aria-label="Order" className="flex shrink-0 gap-1.5">
            <Link href={sortHref(false)} scroll={false} aria-current={!alphabetical ? "true" : undefined} className={`pl-pill ${!alphabetical ? "pl-pill--on" : ""}`}>
              Most projects
            </Link>
            <Link href={sortHref(true)} scroll={false} aria-current={alphabetical ? "true" : undefined} className={`pl-pill ${alphabetical ? "pl-pill--on" : ""}`}>
              A to Z
            </Link>
          </div>
          <span className="text-[13px] text-[#6b7280] shrink-0">
            <span className="font-['Outfit'] text-[15px] font-bold text-[#0d1117]">{developers.length}</span>{" "}
            developer{developers.length !== 1 ? "s" : ""}
            {q ? (
              <>
                {" "}matching <span className="font-medium text-[#001f3f]">&ldquo;{q}&rdquo;</span>
              </>
            ) : null}
          </span>
        </div>
      </div>

      {/* The logo wall */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
        {developers.length > 0 ? <DeveloperDirectory developers={developers} /> : emptyState}
      </section>
    </div>
  )
}
