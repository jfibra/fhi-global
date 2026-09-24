import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { unstable_cache } from "next/cache"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { createPageMetadata } from "@/lib/seo"
import { breadcrumbList } from "@/lib/structured-data"
import { JsonLd } from "@/components/json-ld"
import { TopBar } from "@/components/topbar"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProjectCard, type ProjectCardData } from "@/components/project-card"
import { ProjectFilters, type QuickPick } from "@/components/public/project-filters"
import { InView } from "@/components/public/in-view"
import { CountUp } from "@/components/public/count-up"
import { MagneticLink } from "@/components/public/magnetic-link"
import { countByEmirate } from "@/lib/emirates"
import { ArrowLeft, ArrowRight, ArrowUpRight, Building2 } from "lucide-react"
import { Suspense } from "react"

// The full catalog rendered on one page shipped ~1.9 MB of HTML (half of it
// RSC flight data duplicating the markup). 24 cards keeps the document a
// crawlable, parseable size; the rest is reachable through real <a> links.
const PAGE_SIZE = 24

type SpValues = {
  q?: string
  developer?: string
  status?: string
  city?: string
  featured?: string
  price_min?: string
  price_max?: string
  page?: string
}

type SearchParams = Promise<SpValues>

function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

/** The filters pagination links carry forward — a whitelist, so arbitrary or
 *  array-valued query params can never propagate into crawlable hrefs. */
const FILTER_KEYS = ["q", "developer", "status", "city", "featured", "price_min", "price_max"] as const

/** Pagination href that keeps every active filter and drops page=1. */
function pageHref(sp: SpValues, page: number): string {
  const p = new URLSearchParams()
  for (const k of FILTER_KEYS) {
    const v = sp[k]
    if (typeof v === "string" && v) p.set(k, v)
  }
  if (page > 1) p.set("page", String(page))
  const qs = p.toString()
  return qs ? `/projects?${qs}` : "/projects"
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { page } = await searchParams
  const pageNum = parsePage(page)
  // Self-canonical per page: canonicalizing everything to page 1 would orphan
  // every project card beyond the first 24 from the crawl graph.
  return createPageMetadata({
    title: pageNum > 1 ? `Real Estate Projects in Dubai — Page ${pageNum}` : "Real Estate Projects in Dubai",
    description: "Browse premium off-plan and ready residential projects from top Dubai developers.",
    pathname: pageNum > 1 ? `/projects?page=${pageNum}` : "/projects",
    keywords: ["Dubai projects", "off-plan properties Dubai", "ready properties UAE", "Dubai investment properties"],
  })
}

// Filter facets change rarely; the route itself stays dynamic (searchParams),
// so cache them at the data layer like lib/data/home.ts does.
const getProjectFacets = unstable_cache(
  async () => {
    const supabase = createPublicSupabaseClient()
    const [{ data: devOptions }, { data: cityOptions }, { data: live }] = await Promise.all([
      supabase.from("developers").select("id, name").eq("is_active", true).order("name"),
      supabase.from("projects").select("city").eq("is_active", true).not("city", "is", null),
      // The published catalogue, for the masthead counters and the quick
      // picks' live counts. Same rows the grid draws from.
      supabase
        .from("projects")
        .select("city, developer_id, status, launch_price_from, is_featured")
        .eq("is_active", true)
        .eq("is_published", true)
        .is("deleted_at", null)
        .limit(4000),
    ])
    const uniqueCities = Array.from(new Set((cityOptions ?? []).map((r) => r.city).filter(Boolean))) as string[]
    const rows = (live ?? []) as { city: string | null; developer_id: string | null; status: string; launch_price_from: number | string | null; is_featured: boolean | null }[]
    const stats = {
      total: rows.length,
      developers: new Set(rows.map((r) => r.developer_id).filter(Boolean)).size,
      emirates: Object.keys(countByEmirate(rows)).length,
      ready: rows.filter((r) => r.status === "completed").length,
      underMillion: rows.filter((r) => r.launch_price_from != null && Number(r.launch_price_from) > 0 && Number(r.launch_price_from) <= 1_000_000).length,
      featured: rows.filter((r) => r.is_featured).length,
    }
    return { devOptions: devOptions ?? [], uniqueCities, stats }
  },
  ["projects-facets-v2"],
  { revalidate: 120, tags: ["projects"] },
)

export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const { q, developer, status, city, featured, price_min, price_max } = sp
  const pageNum = parsePage(sp.page)
  const supabase = createPublicSupabaseClient()

  const priceMin = price_min ? Number(price_min) : null
  const priceMax = price_max ? Number(price_max) : null
  const hasPriceMin = Number.isFinite(priceMin)
  const hasPriceMax = Number.isFinite(priceMax)

  const { devOptions, uniqueCities, stats } = await getProjectFacets()

  // Fetch one page of projects (+ the exact total for the pager).
  let query = supabase
    .from("projects")
    .select(
      "id, name, slug, main_image, location, city, community, delivery_quarter, launch_price_from, launch_price_to, currency, status, is_featured, developers(name, logo_url, slug)",
      { count: "exact" },
    )
    .eq("is_active", true)
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (featured === "true") query = query.eq("is_featured", true)
  if (q) query = query.ilike("name", `%${q}%`)
  if (developer) query = query.eq("developer_id", developer)
  // "off_plan" is the buyer's word, not a database value: everything that
  // has not completed.
  if (status === "off_plan") query = query.neq("status", "completed")
  else if (status) query = query.eq("status", status)
  if (city) query = query.eq("city", city)
  if (hasPriceMin && priceMin !== null) query = query.gte("launch_price_from", priceMin)
  if (hasPriceMax && priceMax !== null) query = query.lte("launch_price_from", priceMax)

  const from = (pageNum - 1) * PAGE_SIZE
  const { data: projects, count, error } = await query.range(from, from + PAGE_SIZE - 1)

  // Transient failure → 5xx; a query error must not read as "empty page"
  // and 404 the archive (ISR would cache it).
  if (error) throw new Error("Failed to load projects")

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const anyFilter = Boolean(q || developer || status || city || featured === "true" || hasPriceMin || hasPriceMax)
  const pick = (label: string, count: number, params: Record<string, string>): QuickPick => ({ label, count, params })
  const picks: QuickPick[] = [
    pick("Ready to move in", stats.ready, { status: "completed" }),
    pick("Under AED 1M", stats.underMillion, { price_max: "1000000" }),
    pick("Featured", stats.featured, { featured: "true" }),
  ].filter((p) => p.count > 0)
  const headline = featured === "true" ? "Featured Projects" : status === "completed" ? "Ready-to-Move Homes" : status === "off_plan" ? "Off-Plan Projects" : "Property Projects"
  // Out-of-range pages 404 rather than serving an empty shell that indexes.
  if (pageNum > 1 && (projects ?? []).length === 0) notFound()

  return (
    <div className="pl wf relative min-h-screen bg-[#fafafa] font-sans overflow-x-clip">
      <noscript>
        <style>{`.pl [class*="wf-"], .pl .wf-word > span, .pl .pl-card { opacity: 1 !important; transform: none !important; clip-path: none !important; filter: none !important; }`}</style>
      </noscript>
      <JsonLd schema={breadcrumbList([{ name: "Home", path: "/" }, { name: "Projects" }])} />
      <TopBar />
      <Header />

      {/* Masthead — short, because the visitor came for the grid, but with
          the site's entrance: the rule draws, the title rises word by word,
          and the catalogue's real counts count up beside it. */}
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
                <span className="wf-fade" style={{ ["--d" as string]: "200ms" }}>FHI Global · {anyFilter ? "Filtered" : "All projects"}</span>
              </p>
              <h1 className="mt-3 font-['Outfit'] text-[34px] font-bold leading-[1.06] tracking-tight drop-shadow-[0_2px_16px_rgba(0,10,30,0.5)] sm:text-[44px] lg:text-[52px]">
                <span className="wf-word mr-[0.24em]"><span style={{ ["--i" as string]: 0 }}>Discover</span></span>
                <span className="wf-word mr-[0.24em]"><span style={{ ["--i" as string]: 1 }}>Premium</span></span>
                {headline.split(" ").map((w, i) => (
                  <span key={`${w}-${i}`} className="wf-word mr-[0.24em]"><span style={{ ["--i" as string]: 2 + i }} className="wf-gold">{w}</span></span>
                ))}
              </h1>
            </div>
            <dl className="wf-fade flex flex-wrap gap-x-8 gap-y-3 lg:pb-1" style={{ ["--d" as string]: "700ms" }}>
              {[
                { value: stats.total, label: "Live projects" },
                { value: stats.developers, label: "Developers" },
                { value: stats.emirates, label: "Emirates" },
              ].filter((st) => st.value > 0).map((st, i) => (
                <div key={st.label}>
                  <dd className="font-['Outfit'] text-[30px] font-bold leading-none text-white">
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

      {/* Filter bar — sticks under the slim header on wide screens */}
      <Suspense>
        <ProjectFilters
          developers={(devOptions ?? []).map((d) => ({ value: d.id, label: d.name }))}
          cities={uniqueCities.map((c) => ({ value: c, label: c }))}
          total={total}
          page={pageNum}
          totalPages={totalPages}
          picks={picks}
        />
      </Suspense>

      {/* Content */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((p, i) => (
              <InView key={p.id} className="pl-card" threshold={0.12} style={{ ["--d" as string]: `${(i % 4) * 90}ms` }}>
                <ProjectCard project={p as unknown as ProjectCardData} />
              </InView>
            ))}
          </div>
        ) : (
          <InView className="wf border border-[#e5e8ec] bg-white px-6 py-16 text-center sm:px-14" threshold={0.2}>
            <span className="wf-fade mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#d6b357]/50 bg-[#d6b357]/10">
              <Building2 className="h-6 w-6 text-[#b8913f]" />
            </span>
            <h3 className="wf-fade mt-5 font-['Outfit'] text-2xl font-bold text-[#0d1117]" style={{ ["--d" as string]: "120ms" }}>No projects match those filters</h3>
            <p className="wf-fade mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-[#6b7280]" style={{ ["--d" as string]: "220ms" }}>
              Loosen one filter, or tell a consultant what you are after and we will look beyond what is published.
            </p>
            <div className="wf-fade mt-7 flex flex-wrap justify-center gap-3" style={{ ["--d" as string]: "320ms" }}>
              <Link href="/projects" className="inline-flex items-center gap-2 border border-[#0d1117]/20 px-6 py-3.5 text-[15px] font-bold text-[#0d1117] transition-colors hover:border-[#d6b357] hover:text-[#b8913f]">
                Clear filters
              </Link>
              <MagneticLink href="/contact" className="inline-flex items-center gap-2 bg-[#0d1117] px-6 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-[#001f3f]">
                Ask a consultant <ArrowUpRight className="h-4 w-4 text-[#d6b357]" />
              </MagneticLink>
            </div>
          </InView>
        )}

        {/* Pagination — real <a> links so every card page stays in the crawl
            graph (this catalog used to render all ~185 cards in one 1.9 MB
            document). Numbers are windowed around the current page; a gold
            line shows how far through the catalogue the reader is. */}
        {totalPages > 1 && (
          <InView as="div" className="wf mt-12" threshold={0.3}>
            <div className="mx-auto max-w-2xl">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.16em] text-[#6b7280]">
                <span>Page {pageNum} of {totalPages}</span>
                <span>{fmtRange(from, projects?.length ?? 0, total)}</span>
              </div>
              <div className="mt-2 h-[2px] w-full bg-[#e5e8ec]">
                <span className="pl-pager-fill block h-full bg-[#d6b357]" style={{ ["--p" as string]: (pageNum / totalPages).toFixed(3) }} />
              </div>
            </div>
            <nav aria-label="Pagination" className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {pageNum > 1 && (
                <Link href={pageHref(sp, pageNum - 1)} className="group inline-flex items-center gap-2 border border-[#e5e8ec] bg-white px-4 py-2.5 text-sm font-semibold text-[#001f3f] transition-colors hover:border-[#d6b357]">
                  <ArrowLeft className="h-4 w-4 text-[#b8913f] transition-transform group-hover:-translate-x-0.5" /> Previous
                </Link>
              )}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === totalPages || Math.abs(n - pageNum) <= 2)
                .map((n, idx, arr) => (
                  <span key={n} className="flex items-center gap-2">
                    {idx > 0 && arr[idx - 1] !== n - 1 && <span className="text-[#9ca3af]">…</span>}
                    {n === pageNum ? (
                      <span aria-current="page" className="inline-flex h-10 min-w-10 items-center justify-center bg-[#0d1117] px-3 text-sm font-bold text-white">
                        {n}
                      </span>
                    ) : (
                      <Link href={pageHref(sp, n)} className="inline-flex h-10 min-w-10 items-center justify-center border border-[#e5e8ec] bg-white px-3 text-sm font-semibold text-[#001f3f] transition-colors hover:border-[#d6b357] hover:text-[#b8913f]">
                        {n}
                      </Link>
                    )}
                  </span>
                ))}
              {pageNum < totalPages && (
                <Link href={pageHref(sp, pageNum + 1)} className="group inline-flex items-center gap-2 bg-[#d6b357] px-4 py-2.5 text-sm font-bold text-[#001f3f] transition-colors hover:bg-[#e2c26a]">
                  Next <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </nav>
          </InView>
        )}
      </section>

      <Footer />
    </div>
  )
}

/** "Showing 25 to 48 of 273". */
function fmtRange(from: number, shown: number, total: number): string {
  if (shown === 0) return ""
  const a = (from + 1).toLocaleString("en-US")
  const b = (from + shown).toLocaleString("en-US")
  return `Showing ${a} to ${b} of ${total.toLocaleString("en-US")}`
}
